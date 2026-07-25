const MEALS_KEY = "thymebook:meals";

function newMealId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// A Meal is a named collection of recipes, each with its own chosen
// servings: { id, name, createdAt, recipes: [{ recipeId, recipeTitle, servings }] }
export function loadMeals() {
  try {
    const raw = localStorage.getItem(MEALS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m) => m && typeof m === "object" && typeof m.id === "string")
      .map((m) => ({
        id: m.id,
        name: typeof m.name === "string" ? m.name : "Untitled meal",
        createdAt: m.createdAt || new Date().toISOString(),
        recipes: Array.isArray(m.recipes)
          ? m.recipes.filter((r) => r && typeof r.recipeId === "string")
          : [],
      }));
  } catch {
    return [];
  }
}

export function saveMeals(meals) {
  localStorage.setItem(MEALS_KEY, JSON.stringify(meals));
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
