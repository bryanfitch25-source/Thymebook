// Supabase Edge Function: send-reminders
//
// Invoked on a schedule (see supabase/migrations/20260725000003_reminder_cron.sql,
// every 15 minutes via pg_cron + pg_net) or manually for testing. For every
// `reminders` row that is still `pending` and whose `remind_at` has arrived,
// sends a Web Push notification to every row in `push_subscriptions` (there
// is no per-user scoping - this app has one shared household login, and
// every subscribed device should get every reminder), then marks the
// reminder `sent`.
//
// Uses Supabase Edge Functions' support for npm: specifiers to pull in the
// `web-push` package directly (it implements the full Web Push protocol -
// VAPID signing + payload encryption - so we don't have to hand-roll it).
//
// Required secrets (set with `supabase secrets set NAME=value`, or via the
// Dashboard -> Edge Functions -> send-reminders -> Secrets UI):
//   VAPID_PRIVATE_KEY    - the private half of the VAPID keypair. NEVER
//                          commit this. The matching public key is
//                          hardcoded in the client at
//                          src/push/vapidPublicKey.js.
//   PROJECT_SECRET_KEY   - this project's full-access key (Project Settings
//                          -> API -> the "service_role" / "secret" key -
//                          whichever label your project's API settings
//                          page uses). Needed so this function can read
//                          every pending reminder and every device's push
//                          subscription regardless of the single shared
//                          auth user, bypassing RLS. Set explicitly rather
//                          than relying on the reserved SUPABASE_SERVICE_
//                          ROLE_KEY env var Supabase auto-injects for
//                          legacy-key-system projects - that auto-injection
//                          isn't reliably populated for projects on the
//                          newer publishable/secret key system, which is
//                          what this project uses (its anon-equivalent key
//                          is "sb_publishable_..."). NEVER commit this
//                          value either.
// SUPABASE_URL is still read from the reserved auto-injected env var - that
// one's just a URL, not a secret, and is populated regardless of key system.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY =
  "BET_IutvQunPhjrtU6koFv9e4KRqjeHftynErE1BwIdYkEjBpY7D2mGl__uVrjaTQIWjZDWazKcBsQWs39t6dDc";

const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
// Prefer the explicit PROJECT_SECRET_KEY; fall back to the reserved name in
// case a future/different project setup does populate it after all.
const PROJECT_SECRET_KEY = Deno.env.get("PROJECT_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails("mailto:bryanfitch25@gmail.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

Deno.serve(async (_req) => {
  try {
    if (!VAPID_PRIVATE_KEY) {
      return new Response(
        JSON.stringify({ error: "VAPID_PRIVATE_KEY secret is not set on this function." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    if (!PROJECT_SECRET_KEY) {
      return new Response(
        JSON.stringify({ error: "PROJECT_SECRET_KEY secret is not set on this function." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, PROJECT_SECRET_KEY);

    const { data: dueReminders, error: remindersError } = await supabase
      .from("reminders")
      .select("id, recipe_id, label, remind_at, source")
      .eq("status", "pending")
      .lte("remind_at", new Date().toISOString());
    if (remindersError) throw remindersError;

    if (!dueReminders || dueReminders.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reminders: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: subscriptions, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth");
    if (subsError) throw subsError;

    // Resolve recipe titles for reminders that reference one, so the
    // notification can say "Thaw the chicken thighs" instead of just
    // whatever manual label (if any) was typed in.
    const recipeIds = dueReminders.map((r) => r.recipe_id).filter(Boolean);
    let titleById = new Map();
    if (recipeIds.length > 0) {
      const { data: recipeRows } = await supabase.from("recipes").select("id, title").in("id", recipeIds);
      titleById = new Map((recipeRows || []).map((r) => [r.id, r.title]));
    }

    let sentCount = 0;
    const staleSubscriptionIds = new Set();

    for (const reminder of dueReminders) {
      const recipeTitle = reminder.recipe_id ? titleById.get(reminder.recipe_id) : null;
      const title = "🧊 Thaw reminder";
      const body = reminder.label?.trim()
        ? reminder.label.trim()
        : recipeTitle
          ? `Move "${recipeTitle}" from the freezer to the fridge.`
          : "Time to move it from the freezer to the fridge.";

      const payload = JSON.stringify({
        title,
        body,
        reminderId: reminder.id,
        recipeId: reminder.recipe_id,
      });

      for (const sub of subscriptions || []) {
        if (staleSubscriptionIds.has(sub.id)) continue;
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload
          );
          sentCount++;
        } catch (err) {
          const statusCode = err?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            // Subscription is gone (browser data cleared, permission
            // revoked, etc). Delete it so future runs stop retrying it.
            staleSubscriptionIds.add(sub.id);
          } else {
            console.error(`Push failed for subscription ${sub.id}:`, err);
          }
        }
      }

      await supabase.from("reminders").update({ status: "sent" }).eq("id", reminder.id);
    }

    if (staleSubscriptionIds.size > 0) {
      await supabase.from("push_subscriptions").delete().in("id", Array.from(staleSubscriptionIds));
    }

    return new Response(
      JSON.stringify({
        reminders: dueReminders.length,
        sent: sentCount,
        staleSubscriptionsRemoved: staleSubscriptionIds.size,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-reminders failed:", err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
