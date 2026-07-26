// Supabase Edge Function: provision-families
//
// ONE-TIME setup helper for the multi-family rollout (see
// supabase/migrations/20260726000001_families.sql). Creates the 8 adult
// accounts (2 per family x 4 families) via the Auth Admin API and links each
// to their family in `family_members`. Generates a random password for each
// account server-side and returns it ONCE in the response - nothing
// sensitive is ever hardcoded in this file or committed to the repo.
//
// Safe to re-run: if an email already has an auth user, this reuses it
// (and generates a fresh random password for it) rather than erroring, and
// family_members linking is an upsert.
//
// SECURITY: guarded by a PROVISION_TOKEN secret - the caller must send
// `Authorization: Bearer <PROVISION_TOKEN>`. Delete this function (Dashboard
// -> Edge Functions -> provision-families -> Delete) once the 4 families are
// provisioned - it creates user accounts and has no reason to stay deployed
// afterward.
//
// Required secrets:
//   PROJECT_SECRET_KEY - same service-role/secret key used by
//                         send-reminders. Needed for admin.createUser and to
//                         bypass RLS when writing family_members.
//   PROVISION_TOKEN    - any random string you choose. Set it, call this
//                         function once with it, then you're free to delete
//                         both the function and the secret.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const PROJECT_SECRET_KEY = Deno.env.get("PROJECT_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PROVISION_TOKEN = Deno.env.get("PROVISION_TOKEN") ?? "";

// (family name in `families` table) -> adult accounts to create for it.
const ROSTER: Record<string, string[]> = {
  "Summerside Fitches": ["stephen@summersidefitches.local", "jenn@summersidefitches.local"],
  "Phillips Family": ["jon@phillipsfamily.local", "lindsay@phillipsfamily.local"],
  "Morningside Fitches": ["bryan@morningsidefitches.local", "amy@morningsidefitches.local"],
  "Ashley Fitches": ["stacy@ashleyfitches.local", "rob@ashleyfitches.local"],
  "Maplehurst Fitches": ["carmel@maplehurstfitches.local"],
};

// One shared, trivial password for every account - this app has no
// sensitive data and only 8 trusted family members will ever log in, so
// simplicity/typability was explicitly chosen over per-account randomness.
// Padded to 7 characters ("01" suffix) since Supabase Auth's default
// minimum password length is 6 and "Fitch" alone is only 5.
function randomPassword(): string {
  return "Fitch01";
}

Deno.serve(async (req) => {
  try {
    if (!PROVISION_TOKEN) {
      return new Response(JSON.stringify({ error: "PROVISION_TOKEN secret is not set on this function." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    const authHeader = req.headers.get("Authorization") ?? "";
    if (authHeader !== `Bearer ${PROVISION_TOKEN}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!PROJECT_SECRET_KEY) {
      return new Response(JSON.stringify({ error: "PROJECT_SECRET_KEY secret is not set on this function." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, PROJECT_SECRET_KEY);

    const { data: families, error: familiesError } = await supabase.from("families").select("id, name");
    if (familiesError) throw familiesError;
    const familyIdByName = new Map((families || []).map((f) => [f.name, f.id]));

    const results: Array<{ family: string; email: string; password: string; userId: string }> = [];

    for (const [familyName, emails] of Object.entries(ROSTER)) {
      const familyId = familyIdByName.get(familyName);
      if (!familyId) {
        throw new Error(`Family "${familyName}" not found - run the families migration first.`);
      }

      for (const email of emails) {
        const password = randomPassword();
        let userId: string;

        const { data: created, error: createError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

        if (createError) {
          // Already exists - look it up and reset its password instead so
          // this stays safely re-runnable.
          const alreadyExists = /already.*registered|already.*exists/i.test(createError.message || "");
          if (!alreadyExists) throw createError;

          const { data: page, error: listError } = await supabase.auth.admin.listUsers();
          if (listError) throw listError;
          const existing = page.users.find((u) => u.email === email);
          if (!existing) throw new Error(`Could not find existing user for ${email} after createUser conflict.`);
          userId = existing.id;

          const { error: updateError } = await supabase.auth.admin.updateUserById(userId, { password });
          if (updateError) throw updateError;
        } else {
          userId = created.user.id;
        }

        const { error: memberError } = await supabase
          .from("family_members")
          .upsert({ user_id: userId, family_id: familyId }, { onConflict: "user_id" });
        if (memberError) throw memberError;

        results.push({ family: familyName, email, password, userId });
      }
    }

    return new Response(JSON.stringify({ provisioned: results.length, accounts: results }, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("provision-families failed:", err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
