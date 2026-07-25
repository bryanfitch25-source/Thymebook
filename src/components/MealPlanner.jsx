import { useState } from "react";
import { DAYS } from "../mealPlan";

export default function MealPlanner({ plan, recipes, onAssign, onRemove, onClear, onGenerateShoppingList, onBack }) {
  const [pendingDay, setPendingDay] = useState(null);
  const [pendingRecipeId, setPendingRecipeId] = useState("");
  const [pendingServings, setPendingServings] = useState("");

  const sortedRecipes = recipes.slice().sort((a, b) => a.title.localeCompare(b.title));

  function startAdding(day) {
    setPendingDay(day);
    setPendingRecipeId(sortedRecipes[0]?.id || "");
    const r = sortedRecipes[0];
    setPendingServings(r?.servings || "");
  }

  function handleRecipeChange(id) {
    setPendingRecipeId(id);
    const r = recipes.find((rec) => rec.id === id);
    setPendingServings(r?.servings || "");
  }

  function confirmAdd(day) {
    const recipe = recipes.find((r) => r.id === pendingRecipeId);
    if (!recipe) return;
    onAssign(day, recipe, pendingServings);
    setPendingDay(null);
    setPendingRecipeId("");
    setPendingServings("");
  }

  const totalAssignments = DAYS.reduce((sum, d) => sum + plan.days[d].length, 0);

  return (
    <div className="meal-planner-view">
      <button className="btn btn-link no-print" onClick={onBack}>
        ← Back
      </button>

      <div className="shopping-header">
        <h1>Meal planner</h1>
        <div className="shopping-header-actions no-print">
          <button className="btn btn-primary" onClick={onGenerateShoppingList} disabled={totalAssignments === 0}>
            Generate shopping list from this week
          </button>
          <button className="btn btn-danger" onClick={onClear} disabled={totalAssignments === 0}>
            Clear week
          </button>
        </div>
      </div>

      {recipes.length === 0 ? (
        <p className="empty-state">Add some recipes first, then come back to plan your week.</p>
      ) : (
        <div className="planner-grid">
          {DAYS.map((day) => (
            <div className="planner-day" key={day}>
              <h2>{day}</h2>
              <ul className="planner-assignments">
                {plan.days[day].map((a) => (
                  <li key={a.id}>
                    <span>
                      {a.recipeTitle} <span className="shopping-source-servings">({a.servings} servings)</span>
                    </span>
                    <button className="btn-close no-print" aria-label={`Remove ${a.recipeTitle}`} onClick={() => onRemove(day, a.id)}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>

              {pendingDay === day ? (
                <div className="planner-add-form no-print">
                  <select value={pendingRecipeId} onChange={(e) => handleRecipeChange(e.target.value)}>
                    {sortedRecipes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className="servings-input"
                    value={pendingServings}
                    onChange={(e) => setPendingServings(e.target.value)}
                    aria-label="Servings"
                  />
                  <div className="planner-add-actions">
                    <button className="btn btn-primary" onClick={() => confirmAdd(day)}>
                      Add
                    </button>
                    <button className="btn" onClick={() => setPendingDay(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button className="btn planner-add-btn no-print" onClick={() => startAdding(day)}>
                  + Add recipe
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
