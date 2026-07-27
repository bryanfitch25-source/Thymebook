import { supabase } from "./supabaseClient";
import { withRetry } from "./withRetry";

// `recipe_favorites` replaces the old single shared `recipes.favorite`
// column: each family favorites recipes independently, tracked as rows of
// (recipe_id, family_id).
const TABLE = "recipe_favorites";

// Fetches the set of recipe ids the CURRENT family has favorited. RLS scopes
// `recipe_favorites` selects to the caller's own family already, so no
// manual family_id filter is needed here.
export async function fetchFavoriteIds() {
  const { data, error } = await withRetry(() => supabase.from(TABLE).select("recipe_id"));
  if (error) throw error;
  return new Set((data || []).map((r) => r.recipe_id));
}

export async function addFavorite(recipeId, familyId) {
  const { error } = await withRetry(() => supabase.from(TABLE).insert({ recipe_id: recipeId, family_id: familyId }));
  if (error) throw error;
}

export async function removeFavorite(recipeId, familyId) {
  const { error } = await withRetry(() => supabase.from(TABLE).delete().eq("recipe_id", recipeId).eq("family_id", familyId));
  if (error) throw error;
}

// Subscribes to realtime changes on `recipe_favorites`. RLS still limits
// which rows a client ever receives to its own family (see the migration),
// so this only ever fires for the current family's favorites - it's what
// lets a second device signed in as the same family see the favorited set
// update live.
export function subscribeFavorites(onChange) {
  const channel = supabase
    .channel("recipe-favorites-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, (payload) => {
      if (payload.eventType === "DELETE") {
        onChange("DELETE", payload.old?.recipe_id);
      } else {
        onChange("UPSERT", payload.new.recipe_id);
      }
    })
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// Aggregate "favorited by any family" view, via the `recipes_favorited_by_any()`
// security-definer function - reveals which recipes at least one family has
// favorited without exposing which family. This is a nice-to-have aggregate,
// not a primary data path, so callers fetch it once/lazily rather than
// subscribing to it live.
export async function fetchPopularFavoriteIds() {
  const { data, error } = await withRetry(() => supabase.rpc("recipes_favorited_by_any"));
  if (error) throw error;
  return new Set((data || []).map((r) => r.recipe_id));
}
