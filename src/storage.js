const STORAGE_KEY = "thymebook:recipes";

export function loadRecipes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
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
    createdAt: now,
    updatedAt: now,
  };
}
