import { supabase } from "./supabaseClient";
import { withRetry } from "./withRetry";

// Resolves the signed-in user's family: which family they belong to (from
// `family_members`, admin-provisioned - see supabase/functions/provision-families)
// and that family's display name (joined from `families`). RLS on both
// tables already restricts what comes back to the caller's own row, so no
// manual filter is needed here - this is always a single-row lookup.
//
// Returns null if the signed-in user has no `family_members` row at all
// (shouldn't normally happen since provisioning creates both together, but
// callers should treat it as a real, user-facing error state rather than
// silently rendering with an undefined family).
export async function fetchFamily() {
  const { data, error } = await withRetry(() =>
    supabase.from("family_members").select("family_id, families(name)").maybeSingle()
  );
  if (error) throw error;
  if (!data) return null;
  return { familyId: data.family_id, familyName: data.families?.name || "" };
}
