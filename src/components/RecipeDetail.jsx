import { useMemo, useState } from "react";
import { exportRecipeAsMarkdown } from "../exportImport";
import { scaleIngredientLine } from "../ingredientScale";

function locationBadgeLabel(location) {
  if (location === "home") return "🏠 Home";
  if (location === "work") return "💼 Work";
  if (location === "both") return "🏠💼 Both";
  return "";
}

export default function RecipeDetail({
  recipe,
  isFavorite,
  onEdit,
  onDelete,
  onBack,
  onToggleFavorite,
  onDuplicate,
  onCookMode,
  onAddToShoppingList,
}) {
  const baseServings = useMemo(() => {
    const n = parseFloat(recipe.servings);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }, [recipe.servings]);

  const [servings, setServings] = useState(baseServings);

  const ingredients = recipe.ingredients.split("\n").map((l) => l.trim()).filter(Boolean);
  const steps = recipe.instructions.split("\n").map((l) => l.trim()).filter(Boolean);

  const factor = servings / baseServings;
  const scaledIngredients = factor === 1 ? ingredients : ingredients.map((line) => scaleIngredientLine(line, factor));

  function adjustServings(delta) {
    setServings((s) => Math.max(1, Math.round((s + delta) * 100) / 100));
  }

  return (
    <div className="recipe-detail">
      <button className="btn btn-link no-print" onClick={onBack}>
        ← Back
      </button>

      {recipe.photo && <img className="recipe-detail-photo" src={recipe.photo} alt="" />}

      <div className="recipe-title-row">
        <h1>{recipe.title}</h1>
        {recipe.location && <span className={`location-badge location-${recipe.location}`}>{locationBadgeLabel(recipe.location)}</span>}
        {recipe.needsThaw && <span className="location-badge thaw-badge">🧊 Needs thaw</span>}
        <button
          className={`star-toggle star-toggle-lg no-print ${isFavorite ? "active" : ""}`}
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          onClick={onToggleFavorite}
        >
          {isFavorite ? "★" : "☆"}
        </button>
      </div>

      <div className="recipe-meta">
        {recipe.prepTime && <span>Prep: {recipe.prepTime}</span>}
        {recipe.cookTime && <span>Cook: {recipe.cookTime}</span>}
        {recipe.servings && <span>Servings: {recipe.servings}</span>}
      </div>

      {recipe.tags?.length > 0 && (
        <div className="tag-list">
          {recipe.tags.map((tag) => (
            <span className="tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {recipe.source && <p className="recipe-source">Source: {recipe.source}</p>}

      <div className="recipe-actions no-print">
        <button className="btn" onClick={onEdit}>
          Edit
        </button>
        <button className="btn" onClick={onDuplicate}>
          Duplicate
        </button>
        <button className="btn" onClick={() => exportRecipeAsMarkdown(recipe)}>
          Export as text
        </button>
        <button className="btn btn-primary" onClick={onCookMode}>
          👨‍🍳 Cook mode
        </button>
        <button className="btn" onClick={() => onAddToShoppingList(servings)}>
          🛒 Add to shopping list
        </button>
        <button className="btn btn-danger" onClick={onDelete}>
          Delete
        </button>
      </div>

      {ingredients.length > 0 && (
        <section>
          <div className="ingredients-header">
            <h2>Ingredients</h2>
            <div className="servings-scaler no-print">
              <span>Servings</span>
              <button type="button" className="stepper-btn" onClick={() => adjustServings(-1)} aria-label="Fewer servings">
                −
              </button>
              <input
                className="servings-input"
                type="number"
                min="1"
                step="1"
                value={servings}
                onChange={(e) => {
                  const n = parseFloat(e.target.value);
                  if (Number.isFinite(n) && n > 0) setServings(n);
                }}
              />
              <button type="button" className="stepper-btn" onClick={() => adjustServings(1)} aria-label="More servings">
                +
              </button>
            </div>
          </div>
          <ul className="ingredient-list">
            {scaledIngredients.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      {steps.length > 0 && (
        <section>
          <h2>Instructions</h2>
          <ol className="instruction-list">
            {steps.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
        </section>
      )}

      {recipe.notes && (
        <section>
          <h2>Notes</h2>
          <p className="recipe-notes">{recipe.notes}</p>
        </section>
      )}
    </div>
  );
}
