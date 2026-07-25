import { fetchDocument, saveDocument, subscribeDocument } from "./docStore";

const MEALS_KEY = "meals";

function newMealId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// A Meal is a named collection of recipes, each with its own chosen
// servings: { id, name, createdAt, recipes: [{ recipeId, recipeTitle, servings }] }
function normalizeMeals(parsed) {
  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  return items
    .filter((m) => m && typeof m === "object" && typeof m.id === "string")
    .map((m) => ({
      id: m.id,
      name: typeof m.name === "string" ? m.name : "Untitled meal",
      createdAt: m.createdAt || new Date().toISOString(),
      recipes: Array.isArray(m.recipes) ? m.recipes.filter((r) => r && typeof r.recipeId === "string") : [],
    }));
}

export async function loadMeals() {
  const data = await fetchDocument(MEALS_KEY, { items: [] });
  return normalizeMeals(data);
}

export async function saveMeals(meals) {
  await saveDocument(MEALS_KEY, { items: meals });
}

export function subscribeMeals(onChange) {
  return subscribeDocument(MEALS_KEY, (data) => onChange(normalizeMeals(data)));
}

export function createMeal(name, entries) {
  return {
    id: newMealId(),
    name: name.trim() || "Untitled meal",
    createdAt: new Date().toISOString(),
    recipes: entries.map((e) => ({
      recipeId: e.recipeId,
      recipeTitle: e.recipeTitle,
      servings: e.servings,
    })),
  };
}

export function addMeal(meals, meal) {
  return [meal, ...meals];
}

export function removeMeal(meals, mealId) {
  return meals.filter((m) => m.id !== mealId);
}
