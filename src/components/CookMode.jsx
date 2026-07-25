import { useState } from "react";

export default function CookMode({ recipe, ingredients, steps, onExit }) {
  const [checkedIngredients, setCheckedIngredients] = useState(() => new Set());
  const [checkedSteps, setCheckedSteps] = useState(() => new Set());

  function toggle(setFn, index) {
    setFn((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <div className="cook-mode">
      <div className="cook-mode-header">
        <h1>{recipe.title}</h1>
        <button className="btn btn-primary cook-mode-exit" onClick={onExit}>
          Exit cook mode
        </button>
      </div>

      {ingredients.length > 0 && (
        <section className="cook-mode-section">
          <h2>Ingredients</h2>
          <ul className="cook-checklist">
            {ingredients.map((line, i) => (
              <li key={i}>
                <label className={checkedIngredients.has(i) ? "checked" : ""}>
                  <input
                    type="checkbox"
                    checked={checkedIngredients.has(i)}
                    onChange={() => toggle(setCheckedIngredients, i)}
                  />
                  <span>{line}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {steps.length > 0 && (
        <section className="cook-mode-section">
          <h2>Instructions</h2>
          <ul className="cook-checklist">
            {steps.map((line, i) => (
              <li key={i}>
                <label className={checkedSteps.has(i) ? "checked" : ""}>
                  <input
                    type="checkbox"
                    checked={checkedSteps.has(i)}
                    onChange={() => toggle(setCheckedSteps, i)}
                  />
                  <span className="cook-step-num">{i + 1}.</span>
                  <span>{line}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      <button className="btn cook-mode-exit-bottom" onClick={onExit}>
        Exit cook mode
      </button>
    </div>
  );
}
