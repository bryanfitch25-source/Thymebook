const STORAGE_KEY = "thymebook:recipes";

export function normalizeRecipe(recipe) {
  return {
    ...recipe,
    tags: Array.isArray(recipe.tags) ? recipe.tags : [],
    photo: typeof recipe.photo === "string" ? recipe.photo : null,
    favorite: Boolean(recipe.favorite),
  };
}

export function loadRecipes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeRecipe) : [];
  } catch {
    return [];
  }
}

export function saveRecipes(recipes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
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
    favorite: false,
    createdAt: now,
    updatedAt: now,
  };
}
