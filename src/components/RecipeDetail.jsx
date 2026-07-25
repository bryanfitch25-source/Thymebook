import { exportRecipeAsMarkdown } from "../exportImport";

export default function RecipeDetail({ recipe, onEdit, onDelete, onBack }) {
  const ingredients = recipe.ingredients.split("\n").map((l) => l.trim()).filter(Boolean);
  const steps = recipe.instructions.split("\n").map((l) => l.trim()).filter(Boolean);

  return (
    <div className="recipe-detail">
      <button className="btn btn-link" onClick={onBack}>
        ← Back
      </button>

      <h1>{recipe.title}</h1>

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

      {recipe.source && (
        <p className="recipe-source">
          Source: {recipe.source}
        </p>
      )}

      <div className="recipe-actions">
        <button className="btn" onClick={onEdit}>
          Edit
        </button>
        <button className="btn" onClick={() => exportRecipeAsMarkdown(recipe)}>
          Export as text
        </button>
        <button className="btn btn-danger" onClick={onDelete}>
          Delete
        </button>
      </div>

      {ingredients.length > 0 && (
        <section>
          <h2>Ingredients</h2>
          <ul className="ingredient-list">
            {ingredients.map((line, i) => (
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
