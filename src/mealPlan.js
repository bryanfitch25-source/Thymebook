import { fetchDocument, saveDocument, subscribeDocument } from "./docStore";

const PLAN_KEY = "meal_plan";

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function newAssignmentId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyMealPlan() {
  const days = {};
  DAYS.forEach((d) => {
    days[d] = [];
  });
  return { days };
}

function normalizePlan(parsed) {
  const plan = emptyMealPlan();
  if (parsed && typeof parsed.days === "object") {
    DAYS.forEach((d) => {
      if (Array.isArray(parsed.days[d])) plan.days[d] = parsed.days[d];
    });
  }
  return plan;
}

export async function loadMealPlan(familyId) {
  const data = await fetchDocument(PLAN_KEY, familyId, emptyMealPlan());
  return normalizePlan(data);
}

export async function saveMealPlan(plan, familyId) {
  await saveDocument(PLAN_KEY, familyId, plan);
}

export function subscribeMealPlan(familyId, onChange) {
  return subscribeDocument(PLAN_KEY, familyId, (data) => onChange(normalizePlan(data)));
}

export function assignRecipe(plan, day, recipe, servings, mealMeta) {
  const baseServings = (() => {
    const n = parseFloat(recipe.servings);
    return Number.isFinite(n) && n > 0 ? n : 1;
  })();
  const assignment = {
    id: newAssignmentId(),
    recipeId: recipe.id,
    recipeTitle: recipe.title,
    servings: Number(servings) || baseServings,
    ...(mealMeta ? { mealId: mealMeta.mealId, mealName: mealMeta.mealName } : {}),
  };
  return { ...plan, days: { ...plan.days, [day]: [...plan.days[day], assignment] } };
}

// Expands a saved Meal into individual per-recipe assignments on a single
// day, tagged with the meal's id/name so the planner can show them grouped.
export function assignMeal(plan, day, meal, recipes) {
  let next = plan;
  meal.recipes.forEach((entry) => {
    const recipe = recipes.find((r) => r.id === entry.recipeId);
    if (!recipe) return;
    next = assignRecipe(next, day, recipe, entry.servings, { mealId: meal.id, mealName: meal.name });
  });
  return next;
}

export function removeAssignment(plan, day, assignmentId) {
  return {
    ...plan,
    days: { ...plan.days, [day]: plan.days[day].filter((a) => a.id !== assignmentId) },
  };
}

export function clearMealPlan() {
  return emptyMealPlan();
}

export function allAssignments(plan) {
  return DAYS.flatMap((day) => plan.days[day].map((a) => ({ ...a, day })));
}
