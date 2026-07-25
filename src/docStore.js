import { supabase } from "./supabaseClient";

// Generic helper for the `app_documents` table: a small set of named JSON
// blobs (shopping_list, staples, meal_plan, meals) that mirror what used to
// be single localStorage keys. Each document is a single row keyed by name,
// so persistence stays "write the whole object" just like localStorage did,
// but now other devices get told about changes via realtime.
const TABLE = "app_documents";

export async function fetchDocument(key, fallback) {
  const { data, error } = await supabase.from(TABLE).select("data").eq("key", key).maybeSingle();
  if (error) throw error;
  if (!data) {
    // Document row doesn't exist yet (e.g. migration hasn't been run, or
    // this is a brand-new project) - fall back to the in-app default and
    // try to seed the row so future writes have somewhere to land.
    await supabase.from(TABLE).upsert({ key, data: fallback }, { onConflict: "key" });
    return fallback;
  }
  return data.data;
}

export async function saveDocument(key, data) {
  const { error } = await supabase
    .from(TABLE)
    .upsert({ key, data, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
}

// Subscribes to realtime changes for a single document key. `onChange` is
// called with the new `data` payload whenever the row is inserted/updated
// (including echoes of this client's own writes - callers should treat this
// as an idempotent "replace local state" rather than merge/append).
export function subscribeDocument(key, onChange) {
  const channel = supabase
    .channel(`app_documents-${key}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: TABLE, filter: `key=eq.${key}` },
      (payload) => {
        if (payload.eventType === "DELETE") return;
        onChange(payload.new.data);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
