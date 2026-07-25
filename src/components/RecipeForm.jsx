import { useState } from "react";
import { compressImageFile } from "../imageUtils";

export default function RecipeForm({ recipe, onSave, onCancel }) {
  const [form, setForm] = useState({
    ...recipe,
    tagsText: (recipe.tags || []).join(", "),
  });
  const [photoError, setPhotoError] = useState("");

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoError("");
    try {
      const dataUrl = await compressImageFile(file);
      set("photo", dataUrl);
    } catch {
      setPhotoError("Couldn't load that image — try a different file.");
    }
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
      photo: form.photo || null,
      favorite: Boolean(form.favorite),
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

      <label>
        Photo <span className="hint">(optional)</span>
        <input type="file" accept="image/*" onChange={handlePhotoChange} />
      </label>
      {photoError && <p className="form-error">{photoError}</p>}
      {form.photo && (
        <div className="photo-preview-row">
          <img className="photo-preview" src={form.photo} alt="Recipe preview" />
          <button type="button" className="btn" onClick={() => set("photo", null)}>
            Remove photo
          </button>
        </div>
      )}

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

      <label className="checkbox-label">
        <input type="checkbox" checked={Boolean(form.favorite)} onChange={(e) => set("favorite", e.target.checked)} />
        Mark as favorite
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
