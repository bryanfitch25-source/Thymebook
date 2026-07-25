import { useState } from "react";

export default function RecipeForm({ recipe, onSave, onCancel }) {
  const [form, setForm] = useState({
    ...recipe,
    tagsText: (recipe.tags || []).join(", "),
  });

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    const tags = form.tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    onSave({
      ...recipe,
      title: form.title.trim(),
      tags,
      prepTime: form.prepTime.trim(),
      cookTime: form.cookTime.trim(),
      servings: form.servings.trim(),
      source: form.source.trim(),
      ingredients: form.ingredients,
      instructions: form.instructions,
      notes: form.notes,
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <form className="recipe-form" onSubmit={handleSubmit}>
      <label>
        Title
        <input
          type="text"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Grandma's lasagna"
          autoFocus
          required
        />
      </label>

      <div className="form-row">
        <label>
          Prep time
          <input type="text" value={form.prepTime} onChange={(e) => set("prepTime", e.target.value)} placeholder="15 min" />
        </label>
        <label>
          Cook time
          <input type="text" value={form.cookTime} onChange={(e) => set("cookTime", e.target.value)} placeholder="45 min" />
        </label>
        <label>
          Servings
          <input type="text" value={form.servings} onChange={(e) => set("servings", e.target.value)} placeholder="4" />
        </label>
      </div>

      <label>
        Tags <span className="hint">(comma-separated)</span>
        <input type="text" value={form.tagsText} onChange={(e) => set("tagsText", e.target.value)} placeholder="dinner, italian, freezer-friendly" />
      </label>

      <label>
        Source <span className="hint">(URL, cookbook, or person)</span>
        <input type="text" value={form.source} onChange={(e) => set("source", e.target.value)} placeholder="https://... or Mom" />
      </label>

      <label>
        Ingredients <span className="hint">(one per line)</span>
        <textarea
          value={form.ingredients}
          onChange={(e) => set("ingredients", e.target.value)}
          rows={8}
          placeholder={"1 lb ground beef\n2 cups tomato sauce\n..."}
        />
      </label>

      <label>
        Instructions <span className="hint">(one step per line)</span>
        <textarea
          value={form.instructions}
          onChange={(e) => set("instructions", e.target.value)}
          rows={8}
          placeholder={"Preheat oven to 375F\nBrown the beef\n..."}
        />
      </label>

      <label>
        Notes
        <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={4} placeholder="Substitutions, tips, variations..." />
      </label>

      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          Save recipe
        </button>
      </div>
    </form>
  );
}
