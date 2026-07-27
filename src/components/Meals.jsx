import { useState } from "react";
import { DAYS } from "../mealPlan";
import RecipePicker from "./RecipePicker";

export default function Meals({ meals, recipes, onCreate, onDelete, onAddToShoppingList, onAssignToDay }) {
  const [mode, setMode] = useState("list"); // list | create | detail
  const [activeMealId, setActiveMealId] = useState(null);

  const [name, setName] = useState("");
  const [picked, setPicked] = useState([]); // { recipeId, recipeTitle, servings }
  const [pendingRecipeId, setPendingRecipeId] = useState("");

  const sortedRecipes = recipes.slice().sort((a, b) => a.title.localeCompare(b.title));
  const activeMeal = meals.find((m) => m.id === activeMealId) || null;

  function startCreate() {
    setName("");
    setPicked([]);
    setPendingRecipeId(sortedRecipes[0]?.id || "");
    setMode("create");
  }

  function addPicked() {
    const recipe = recipes.find((r) => r.id === pendingRecipeId);
    if (!recipe || picked.some((p) => p.recipeId === recipe.id)) return;
    const n = parseFloat(recipe.servings);
    const baseServings = Number.isFinite(n) && n > 0 ? n : 1;
    setPicked((p) => [...p, { recipeId: recipe.id, recipeTitle: recipe.title, servings: baseServings }]);
  }

  function removePicked(recipeId) {
    setPicked((p) => p.filter((x) => x.recipeId !== recipeId));
  }

  function setPickedServings(recipeId, servings) {
    setPicked((p) => p.map((x) => (x.recipeId === recipeId ? { ...x, servings } : x)));
  }

  function handleSaveMeal() {
    if (!name.trim() || picked.length === 0) return;
    onCreate(name, picked);
    setMode("list");
  }

  if (mode === "create") {
    return (
      <div className="meals-view">
        <button className="btn btn-link no-print" onClick={() => setMode("list")}>
          ← Back
        </button>
        <h1>Create a meal</h1>
        <p className="capture-intro">Name it and pick the recipes that make it up, with each one's serving size.</p>

        <label className="meal-name-label">
          Meal name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sunday Roast"
            autoFocus
          />
        </label>

        {picked.length > 0 && (
          <ul className="meal-recipe-list">
            {picked.map((p) => (
              <li key={p.recipeId}>
                <span className="meal-recipe-name">{p.recipeTitle}</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="servings-input"
                  value={p.servings}
                  onChange={(e) => setPickedServings(p.recipeId, e.target.value)}
                  aria-label={`Servings for ${p.recipeTitle}`}
                />
                <button className="btn-close" aria-label={`Remove ${p.recipeTitle}`} onClick={() => removePicked(p.recipeId)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        {sortedRecipes.length > 0 ? (
          <div className="planner-add-form meal-add-form">
            <RecipePicker recipes={sortedRecipes} value={pendingRecipeId} onChange={setPendingRecipeId} />
            <button type="button" className="btn" onClick={addPicked}>
              + Add recipe
            </button>
          </div>
        ) : (
          <p className="empty-state">Add some recipes first, then come back to build a meal.</p>
        )}

        <div className="form-actions">
          <button className="btn" onClick={() => setMode("list")}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSaveMeal} disabled={!name.trim() || picked.length === 0}>
            Save meal
          </button>
        </div>
      </div>
    );
  }

  if (mode === "detail" && activeMeal) {
    return (
      <div className="meals-view">
        <button className="btn btn-link no-print" onClick={() => setMode("list")}>
          ← Back
        </button>
        <div className="shopping-header">
          <h1>{activeMeal.name}</h1>
          <div className="shopping-header-actions no-print">
            <button className="btn btn-primary" onClick={() => onAddToShoppingList(activeMeal)}>
              🛒 Add to shopping list
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                onDelete(activeMeal.id);
                setMode("list");
              }}
            >
              Delete meal
            </button>
          </div>
        </div>

        <ul className="meal-recipe-list">
          {activeMeal.recipes.map((r) => (
            <li key={r.recipeId}>
              <span className="meal-recipe-name">{r.recipeTitle}</span>
              <span className="shopping-source-servings">{r.servings} servings</span>
            </li>
          ))}
        </ul>

        <section>
          <h2>Assign to a day</h2>
          <div className="meal-assign-days">
            {DAYS.map((day) => (
              <button key={day} className="btn" onClick={() => onAssignToDay(activeMeal, day)}>
                {day}
              </button>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="meals-view">
      <div className="shopping-header">
        <h1>Meals</h1>
        <div className="shopping-header-actions no-print">
          <button className="btn btn-primary" onClick={startCreate}>
            + Create meal
          </button>
        </div>
      </div>

      {meals.length === 0 ? (
        <p className="empty-state">No saved meals yet — combine a few recipes into a meal like "Sunday Roast."</p>
      ) : (
        <ul className="recipe-cards">
          {meals.map((m) => (
            <li
              key={m.id}
              className="recipe-card meal-card"
              onClick={() => {
                setActiveMealId(m.id);
                setMode("detail");
              }}
            >
              <div className="recipe-card-body">
                <h3>{m.name}</h3>
                <div className="recipe-card-meta">
                  <span>
                    {m.recipes.length} recipe{m.recipes.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="tag-list">
                  {m.recipes.map((r) => (
                    <span className="tag" key={r.recipeId}>
                      {r.recipeTitle}
                    </span>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
