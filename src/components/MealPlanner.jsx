import { useState } from "react";
import { DAYS } from "../mealPlan";
import { LEAD_HOUR_OPTIONS } from "../reminders";

export default function MealPlanner({ plan, recipes, onAssign, onRemove, onClear, onGenerateShoppingList, onSetThawReminder, onBack }) {
  const [pendingDay, setPendingDay] = useState(null);
  const [pendingRecipeId, setPendingRecipeId] = useState("");
  const [pendingServings, setPendingServings] = useState("");
  const [thawPickerFor, setThawPickerFor] = useState(null); // assignment id

  function recipeFor(assignment) {
    return recipes.find((r) => r.id === assignment.recipeId);
  }

  function confirmThawReminder(day, assignment, leadHours) {
    onSetThawReminder(day, assignment, leadHours);
    setThawPickerFor(null);
  }

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
                {plan.days[day].map((a) => {
                  const recipe = recipeFor(a);
                  return (
                    <li key={a.id} className="planner-assignment-item">
                      <div className="planner-assignment-row">
                        <span>
                          {a.recipeTitle} <span className="shopping-source-servings">({a.servings} servings)</span>
                        </span>
                        <button className="btn-close no-print" aria-label={`Remove ${a.recipeTitle}`} onClick={() => onRemove(day, a.id)}>
                          ×
                        </button>
                      </div>

                      {recipe?.needsThaw && (
                        <div className="no-print thaw-reminder-row">
                          {thawPickerFor === a.id ? (
                            <div className="thaw-picker">
                              <span className="hint">Remind me before ~6pm {day}:</span>
                              <div className="thaw-picker-options">
                                {LEAD_HOUR_OPTIONS.map((h) => (
                                  <button key={h} type="button" className="btn" onClick={() => confirmThawReminder(day, a, h)}>
                                    {h}h before
                                  </button>
                                ))}
                                <button type="button" className="btn btn-link" onClick={() => setThawPickerFor(null)}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button type="button" className="btn btn-link thaw-btn" onClick={() => setThawPickerFor(a.id)}>
                              🧊 Set thaw reminder
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
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
