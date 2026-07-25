import { supabase } from "../supabaseClient";
import { VAPID_PUBLIC_KEY } from "./vapidPublicKey";

// Converts a URL-safe base64 VAPID public key into the Uint8Array shape
// pushManager.subscribe expects.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// Whether this browser can plausibly support Web Push at all. False on,
// e.g., desktop Safari, or iOS Safari when the site hasn't been added to
// the home screen (iOS 16.4+ only supports Web Push for installed PWAs).
export function isPushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function notificationPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission; // "default" | "granted" | "denied"
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  const base = import.meta.env.BASE_URL || "/";
  return navigator.serviceWorker.register(`${base}sw.js`);
}

// Requests notification permission, subscribes this browser to push, and
// stores the subscription as its own row in `push_subscriptions`. Returns
// { ok: true } on success, or { ok: false, reason } on any failure so the
// caller can show an inline message instead of crashing.
export async function subscribeToPush() {
  if (!isPushSupported()) {
    return { ok: false, reason: "not-supported" };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { ok: false, reason: "permission-denied" };
    }

    const registration = await registerServiceWorker();
    if (!registration) return { ok: false, reason: "not-supported" };
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const json = subscription.toJSON();
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      },
      { onConflict: "endpoint" }
    );
    if (error) throw error;

    return { ok: true };
  } catch (err) {
    return { ok: false, reason: "error", error: err };
  }
}

export async function unsubscribeFromPush() {
  if (!isPushSupported()) return { ok: false, reason: "not-supported" };
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return { ok: true };
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: "error", error: err };
  }
}

// Whether *this* browser currently has an active push subscription.
export async function getCurrentSubscriptionStatus() {
  if (!isPushSupported()) return { supported: false, subscribed: false };
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    return { supported: true, subscribed: Boolean(subscription) };
  } catch {
    return { supported: true, subscribed: false };
  }
}
