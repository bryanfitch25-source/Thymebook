import { supabase } from "./supabaseClient";
import { withRetry } from "./withRetry";

const TABLE = "recipes";

const VALID_LOCATIONS = new Set(["home", "work", "both", ""]);

export function normalizeRecipe(recipe) {
  return {
    ...recipe,
    tags: Array.isArray(recipe.tags) ? recipe.tags : [],
    photo: typeof recipe.photo === "string" ? recipe.photo : null,
    location: VALID_LOCATIONS.has(recipe.location) ? recipe.location : "",
    needsThaw: Boolean(recipe.needsThaw),
  };
}

export function newRecipeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyRecipe() {
  const now = new Date().toISOString();
  return {
    id: newRecipeId(),
    title: "",
    tags: [],
    prepTime: "",
    cookTime: "",
    servings: "",
    source: "",
    ingredients: "",
    instructions: "",
    notes: "",
    photo: null,
    location: "",
    needsThaw: false,
    createdAt: now,
    updatedAt: now,
  };
}

// --- Supabase <-> app shape mapping -----------------------------------------

function rowToRecipe(row) {
  return normalizeRecipe({
    id: row.id,
    title: row.title || "",
    tags: row.tags || [],
    prepTime: row.prep_time || "",
    cookTime: row.cook_time || "",
    servings: row.servings || "",
    source: row.source || "",
    ingredients: row.ingredients || "",
    instructions: row.instructions || "",
    notes: row.notes || "",
    photo: row.photo ?? null,
    location: row.location || "",
    needsThaw: Boolean(row.needs_thaw),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function recipeToRow(recipe) {
  return {
    id: recipe.id,
    title: recipe.title || "",
    tags: Array.isArray(recipe.tags) ? recipe.tags : [],
    prep_time: recipe.prepTime || "",
    cook_time: recipe.cookTime || "",
    servings: recipe.servings || "",
    source: recipe.source || "",
    ingredients: recipe.ingredients || "",
    instructions: recipe.instructions || "",
    notes: recipe.notes || "",
    photo: recipe.photo ?? null,
    location: recipe.location || "",
    needs_thaw: Boolean(recipe.needsThaw),
    created_at: recipe.createdAt || new Date().toISOString(),
    updated_at: recipe.updatedAt || new Date().toISOString(),
  };
}

// --- Supabase-backed persistence ---------------------------------------------

export async function fetchRecipes() {
  const { data, error } = await withRetry(() => supabase.from(TABLE).select("*").order("updated_at", { ascending: false }));
  if (error) throw error;
  return (data || []).map(rowToRecipe);
}

export async function upsertRecipe(recipe) {
  const { error } = await withRetry(() => supabase.from(TABLE).upsert(recipeToRow(recipe), { onConflict: "id" }));
  if (error) throw error;
}

export async function upsertRecipes(recipes) {
  if (!recipes.length) return;
  const { error } = await withRetry(() => supabase.from(TABLE).upsert(recipes.map(recipeToRow), { onConflict: "id" }));
  if (error) throw error;
}

export async function deleteRecipeRemote(id) {
  const { error } = await withRetry(() => supabase.from(TABLE).delete().eq("id", id));
  if (error) throw error;
}

// Subscribes to realtime changes on the recipes table. `onChange` is called
// with (eventType, recipe) for INSERT/UPDATE, or (eventType, { id }) for
// DELETE. Returns an unsubscribe function.
export function subscribeRecipes(onChange) {
  const channel = supabase
    .channel("recipes-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, (payload) => {
      if (payload.eventType === "DELETE") {
        onChange("DELETE", { id: payload.old?.id });
      } else {
        onChange(payload.eventType, rowToRecipe(payload.new));
      }
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
