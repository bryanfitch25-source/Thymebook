// Thymebook service worker.
//
// Responsible for two things: (1) letting the browser install the app as a
// PWA (a service worker's mere presence + the manifest is what unlocks
// "Add to Home Screen" / install prompts on most platforms) and (2)
// receiving Web Push messages and showing a notification even when no tab
// is open. This app doesn't need offline caching (it's Supabase-backed and
// pointless without a network connection), so there's deliberately no
// fetch-event caching layer here - keep it minimal.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = { title: "Thymebook", body: "You have a reminder." };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }

  const title = payload.title || "Thymebook";
  const options = {
    body: payload.body || "",
    icon: "/Thymebook/icon-192.png",
    badge: "/Thymebook/icon-192.png",
    data: { url: "/Thymebook/", ...payload },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/Thymebook/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("/Thymebook/") && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
