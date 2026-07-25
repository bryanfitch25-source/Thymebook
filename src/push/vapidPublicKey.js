// Public half of the VAPID keypair used to sign Web Push subscriptions.
// This is safe to ship client-side (same trust model as the Supabase
// publishable/anon key already hardcoded in src/supabaseClient.js) - it
// identifies the application to push services, it doesn't grant any
// privileged access. The matching PRIVATE key lives only as the
// VAPID_PRIVATE_KEY secret on the send-reminders Edge Function and must
// never be committed here.
export const VAPID_PUBLIC_KEY =
  "BET_IutvQunPhjrtU6koFv9e4KRqjeHftynErE1BwIdYkEjBpY7D2mGl__uVrjaTQIWjZDWazKcBsQWs39t6dDc";
