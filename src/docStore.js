import { supabase } from "./supabaseClient";

// Generic helper for the `app_documents` table: a small set of named JSON
// blobs (shopping_list, staples, meal_plan, meals) that mirror what used to
// be single localStorage keys. Each document is a row keyed by (key,
// family_id) - one document per family per name - so persistence stays
// "write the whole object" just like localStorage did, but now other
// devices signed in as the same family get told about changes via realtime.
const TABLE = "app_documents";

// Mobile connections drop requests mid-flight often enough that a single
// blip shouldn't surface as a scary error (Safari reports these as
// `TypeError: Load failed`, Chrome as `TypeError: Failed to fetch` - both
// are the browser giving up on the network layer, not a real app error).
// Retries a couple of times with a short backoff before giving up for real.
async function withRetry(fn, attempts = 3, delayMs = 500) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastErr;
}

export async function fetchDocument(key, familyId, fallback) {
  const { data, error } = await withRetry(() =>
    supabase.from(TABLE).select("data").eq("key", key).eq("family_id", familyId).maybeSingle()
  );
  if (error) throw error;
  if (!data) {
    // Document row doesn't exist yet for this family (e.g. brand-new
    // family, or this document was never written) - fall back to the
    // in-app default and try to seed the row so future writes have
    // somewhere to land.
    await withRetry(() => supabase.from(TABLE).upsert({ key, family_id: familyId, data: fallback }, { onConflict: "key,family_id" }));
    return fallback;
  }
  return data.data;
}

export async function saveDocument(key, familyId, data) {
  const { error } = await withRetry(() =>
    supabase.from(TABLE).upsert({ key, family_id: familyId, data, updated_at: new Date().toISOString() }, { onConflict: "key,family_id" })
  );
  if (error) throw error;
}

// Subscribes to realtime changes for a single document key, scoped to one
// family. `onChange` is called with the new `data` payload whenever the row
// is inserted/updated (including echoes of this client's own writes -
// callers should treat this as an idempotent "replace local state" rather
// than merge/append).
//
// Supabase JS v2's `postgres_changes` filter is a single "column=eq.value"
// string per binding - it doesn't support compound "and" filters - so we
// filter server-side on `key` (cheap, coarse) and discard events for other
// families' rows client-side by comparing `payload.new.family_id`.
export function subscribeDocument(key, familyId, onChange) {
  const channel = supabase
    .channel(`app_documents-${key}-${familyId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: TABLE, filter: `key=eq.${key}` },
      (payload) => {
        if (payload.eventType === "DELETE") return;
        if (payload.new.family_id !== familyId) return;
        onChange(payload.new.data);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
