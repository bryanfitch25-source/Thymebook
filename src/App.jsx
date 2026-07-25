import { useEffect, useMemo, useRef, useState } from "react";
import { loadRecipes, saveRecipes, emptyRecipe, normalizeRecipe, newRecipeId } from "./storage";
import { exportAllAsJson, parseImportedJson } from "./exportImport";
import RecipeList from "./components/RecipeList";
import RecipeDetail from "./components/RecipeDetail";
import RecipeForm from "./components/RecipeForm";
import CookMode from "./components/CookMode";
import Toast from "./components/Toast";
import "./App.css";

const UNDO_TIMEOUT = 6000;

export default function App() {
  const [recipes, setRecipes] = useState(() => loadRecipes());
  const [view, setView] = useState("list"); // list | detail | new | edit | cook
  const [activeId, setActiveId] = useState(null);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState("updated"); // updated | title | created
  const [importMessage, setImportMessage] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null); // { recipe, index }
  const fileInputRef = useRef(null);
  const undoTimerRef = useRef(null);

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

  function handleToggleFavorite(id) {
    persist(recipes.map((r) => (r.id === id ? { ...r, favorite: !r.favorite } : r)));
  }

  function handleDuplicate(recipe) {
    const now = new Date().toISOString();
    const copy = {
      ...recipe,
      id: newRecipeId(),
      title: `${recipe.title} (copy)`,
      favorite: false,
      createdAt: now,
      updatedAt: now,
    };
    persist([copy, ...recipes]);
    setActiveId(copy.id);
    setView("edit");
  }

  function handleDelete(id) {
    const index = recipes.findIndex((r) => r.id === id);
    if (index === -1) return;
    const recipe = recipes[index];
    persist(recipes.filter((r) => r.id !== id));
    setView("list");
    setActiveId(null);

    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setPendingDelete({ recipe, index });
    undoTimerRef.current = setTimeout(() => setPendingDelete(null), UNDO_TIMEOUT);
  }

  function handleUndoDelete() {
    if (!pendingDelete) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setRecipes((current) => {
      const next = current.slice();
      const insertAt = Math.min(pendingDelete.index, next.length);
      next.splice(insertAt, 0, pendingDelete.recipe);
      saveRecipes(next);
      return next;
    });
    setPendingDelete(null);
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = parseImportedJson(String(reader.result)).map(normalizeRecipe);
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
    const filtered = recipes.filter((r) => {
      if (favoritesOnly && !r.favorite) return false;
      if (activeTag && !r.tags?.includes(activeTag)) return false;
      if (!q) return true;
      const haystack = [r.title, r.ingredients, r.notes, ...(r.tags || [])].join(" ").toLowerCase();
      return haystack.includes(q);
    });

    const sorted = filtered.slice();
    if (sortBy === "title") {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === "created") {
      sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else {
      sorted.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }
    return sorted;
  }, [recipes, search, activeTag, favoritesOnly, sortBy]);

  function handleSurpriseMe() {
    if (filteredRecipes.length === 0) return;
    const pick = filteredRecipes[Math.floor(Math.random() * filteredRecipes.length)];
    setActiveId(pick.id);
    setView("detail");
  }

  const activeRecipe = recipes.find((r) => r.id === activeId) || null;

  // Keyboard shortcuts on the list view: "/" focuses search, "n" opens the
  // new-recipe form. Ignored while typing into a form field.
  useEffect(() => {
    function onKeyDown(e) {
      if (view !== "list") return;
      const target = e.target;
      const isTyping =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
      if (isTyping) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "/") {
        e.preventDefault();
        document.getElementById("recipe-search-input")?.focus();
      } else if (e.key === "n") {
        e.preventDefault();
        setView("new");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [view]);

  return (
    <div className="app">
      <header className="app-header no-print">
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
        <div className="import-banner no-print">
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
            favoritesOnly={favoritesOnly}
            onToggleFavoritesOnly={() => setFavoritesOnly((v) => !v)}
            sortBy={sortBy}
            onSortChange={setSortBy}
            onOpen={(id) => {
              setActiveId(id);
              setView("detail");
            }}
            onNew={() => setView("new")}
            onToggleFavorite={handleToggleFavorite}
            onSurpriseMe={handleSurpriseMe}
          />
        )}

        {view === "detail" && activeRecipe && (
          <RecipeDetail
            recipe={activeRecipe}
            onEdit={() => setView("edit")}
            onDelete={() => handleDelete(activeRecipe.id)}
            onBack={() => setView("list")}
            onToggleFavorite={() => handleToggleFavorite(activeRecipe.id)}
            onDuplicate={() => handleDuplicate(activeRecipe)}
            onCookMode={() => setView("cook")}
          />
        )}

        {view === "cook" && activeRecipe && (
          <CookMode
            recipe={activeRecipe}
            ingredients={activeRecipe.ingredients.split("\n").map((l) => l.trim()).filter(Boolean)}
            steps={activeRecipe.instructions.split("\n").map((l) => l.trim()).filter(Boolean)}
            onExit={() => setView("detail")}
          />
        )}

        {view === "new" && (
          <RecipeForm recipe={emptyRecipe()} onSave={handleSave} onCancel={() => setView("list")} />
        )}

        {view === "edit" && activeRecipe && (
          <RecipeForm recipe={activeRecipe} onSave={handleSave} onCancel={() => setView("detail")} />
        )}
      </main>

      {pendingDelete && (
        <Toast
          message={`"${pendingDelete.recipe.title}" deleted`}
          actionLabel="Undo"
          onAction={handleUndoDelete}
          onDismiss={() => {
            if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
            setPendingDelete(null);
          }}
        />
      )}
    </div>
  );
}
