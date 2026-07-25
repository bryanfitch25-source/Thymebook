import { useMemo, useRef, useState } from "react";
import { loadRecipes, saveRecipes, emptyRecipe } from "./storage";
import { exportAllAsJson, parseImportedJson } from "./exportImport";
import RecipeList from "./components/RecipeList";
import RecipeDetail from "./components/RecipeDetail";
import RecipeForm from "./components/RecipeForm";
import "./App.css";

export default function App() {
  const [recipes, setRecipes] = useState(() => loadRecipes());
  const [view, setView] = useState("list"); // list | detail | new | edit
  const [activeId, setActiveId] = useState(null);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState(null);
  const [importMessage, setImportMessage] = useState("");
  const fileInputRef = useRef(null);

  function persist(next) {
    setRecipes(next);
    saveRecipes(next);
  }

  function handleSave(recipe) {
    const exists = recipes.some((r) => r.id === recipe.id);
    const next = exists ? recipes.map((r) => (r.id === recipe.id ? recipe : r)) : [recipe, ...recipes];
    persist(next);
    setActiveId(recipe.id);
    setView("detail");
  }

  function handleDelete(id) {
    if (!window.confirm("Delete this recipe? This can't be undone.")) return;
    persist(recipes.filter((r) => r.id !== id));
    setView("list");
    setActiveId(null);
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = parseImportedJson(String(reader.result));
        const byId = new Map(recipes.map((r) => [r.id, r]));
        let added = 0;
        let updated = 0;
        imported.forEach((r) => {
          if (byId.has(r.id)) updated++;
          else added++;
          byId.set(r.id, r);
        });
        persist(Array.from(byId.values()));
        setImportMessage(`Imported ${added} new, updated ${updated} existing recipe${added + updated === 1 ? "" : "s"}.`);
      } catch (err) {
        setImportMessage(`Import failed: ${err.message}`);
      }
    };
    reader.readAsText(file);
  }

  const allTags = useMemo(() => {
    const set = new Set();
    recipes.forEach((r) => r.tags?.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [recipes]);

  const filteredRecipes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipes.filter((r) => {
      if (activeTag && !r.tags?.includes(activeTag)) return false;
      if (!q) return true;
      const haystack = [r.title, r.ingredients, r.notes, ...(r.tags || [])].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [recipes, search, activeTag]);

  const activeRecipe = recipes.find((r) => r.id === activeId) || null;

  return (
    <div className="app">
      <header className="app-header">
        <h1 onClick={() => setView("list")} className="app-title">
          🌿 Thymebook
        </h1>
        <div className="header-actions">
          <button className="btn" onClick={() => exportAllAsJson(recipes)}>
            Export backup
          </button>
          <button className="btn" onClick={() => fileInputRef.current?.click()}>
            Import backup
          </button>
          <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleImportFile} />
        </div>
      </header>

      {importMessage && (
        <div className="import-banner">
          {importMessage}
          <button className="btn-close" onClick={() => setImportMessage("")}>
            ×
          </button>
        </div>
      )}

      <main>
        {view === "list" && (
          <RecipeList
            recipes={filteredRecipes}
            search={search}
            onSearch={setSearch}
            activeTag={activeTag}
            onTagSelect={setActiveTag}
            allTags={allTags}
            onOpen={(id) => {
              setActiveId(id);
              setView("detail");
            }}
            onNew={() => setView("new")}
          />
        )}

        {view === "detail" && activeRecipe && (
          <RecipeDetail
            recipe={activeRecipe}
            onEdit={() => setView("edit")}
            onDelete={() => handleDelete(activeRecipe.id)}
            onBack={() => setView("list")}
          />
        )}

        {view === "new" && (
          <RecipeForm recipe={emptyRecipe()} onSave={handleSave} onCancel={() => setView("list")} />
        )}

        {view === "edit" && activeRecipe && (
          <RecipeForm recipe={activeRecipe} onSave={handleSave} onCancel={() => setView("detail")} />
        )}
      </main>
    </div>
  );
}
