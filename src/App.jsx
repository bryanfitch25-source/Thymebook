import { useEffect, useMemo, useRef, useState } from "react";
import { loadRecipes, saveRecipes, emptyRecipe, normalizeRecipe, newRecipeId } from "./storage";
import { exportAllAsJson, parseImportedJson } from "./exportImport";
import {
  loadShoppingList,
  saveShoppingList,
  loadStaples,
  saveStaples,
  addRecipeToShoppingList,
  clearShoppingList,
} from "./shoppingList";
import { loadMealPlan, saveMealPlan, assignRecipe, assignMeal, removeAssignment, clearMealPlan } from "./mealPlan";
import { loadMeals, saveMeals, createMeal, addMeal, removeMeal } from "./meals";
import RecipeList from "./components/RecipeList";
import RecipeDetail from "./components/RecipeDetail";
import RecipeForm from "./components/RecipeForm";
import CookMode from "./components/CookMode";
import QuickCapture from "./components/QuickCapture";
import ShoppingList from "./components/ShoppingList";
import MealPlanner from "./components/MealPlanner";
import Meals from "./components/Meals";
import Toast from "./components/Toast";
import "./App.css";

const UNDO_TIMEOUT = 6000;

// Views that belong to the "Recipes" primary nav destination.
const RECIPE_VIEWS = new Set(["list", "detail", "new", "edit", "cook", "capture"]);

export default function App() {
  const [recipes, setRecipes] = useState(() => loadRecipes());
  const [view, setView] = useState("list"); // list | detail | new | edit | cook | capture | shopping | mealplan | meals
  const [activeId, setActiveId] = useState(null);
  const [newDraft, setNewDraft] = useState(null);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [locationFilter, setLocationFilter] = useState(null); // null | "home" | "work"
  const [sortBy, setSortBy] = useState("updated"); // updated | title | created
  const [importMessage, setImportMessage] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null); // { recipe, index }
  const [shoppingList, setShoppingList] = useState(() => loadShoppingList());
  const [staples, setStaples] = useState(() => loadStaples());
  const [mealPlan, setMealPlan] = useState(() => loadMealPlan());
  const [meals, setMeals] = useState(() => loadMeals());
  const [toastMessage, setToastMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef(null);
  const undoTimerRef = useRef(null);
  const toastTimerRef = useRef(null);

  function persistMeals(next) {
    setMeals(next);
    saveMeals(next);
  }

  function handleCreateMeal(name, entries) {
    const meal = createMeal(name, entries);
    persistMeals(addMeal(meals, meal));
    showToast(`Saved meal "${meal.name}"`);
  }

  function handleDeleteMeal(mealId) {
    persistMeals(removeMeal(meals, mealId));
  }

  function handleAddMealToShoppingList(meal) {
    let next = shoppingList;
    meal.recipes.forEach((entry) => {
      const recipe = recipes.find((r) => r.id === entry.recipeId);
      if (recipe) next = addRecipeToShoppingList(next, recipe, entry.servings);
    });
    persistShoppingList(next);
    showToast(`Added "${meal.name}" to the shopping list`);
  }

  function handleAssignMealToDay(meal, day) {
    persistMealPlan(assignMeal(mealPlan, day, meal, recipes));
    showToast(`Assigned "${meal.name}" to ${day}`);
  }

  function persistShoppingList(next) {
    setShoppingList(next);
    saveShoppingList(next);
  }

  function persistStaples(next) {
    setStaples(next);
    saveStaples(next);
  }

  function persistMealPlan(next) {
    setMealPlan(next);
    saveMealPlan(next);
  }

  function showToast(message) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(message);
    toastTimerRef.current = setTimeout(() => setToastMessage(""), 3500);
  }

  function handleAddToShoppingList(recipe, servings) {
    persistShoppingList(addRecipeToShoppingList(shoppingList, recipe, servings));
    showToast(`Added "${recipe.title}" to the shopping list`);
  }

  function handleGenerateShoppingListFromPlan() {
    let next = shoppingList;
    let count = 0;
    ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].forEach((day) => {
      mealPlan.days[day].forEach((a) => {
        const recipe = recipes.find((r) => r.id === a.recipeId);
        if (recipe) {
          next = addRecipeToShoppingList(next, recipe, a.servings);
          count++;
        }
      });
    });
    persistShoppingList(next);
    setView("shopping");
    if (count > 0) showToast(`Added ${count} recipe${count === 1 ? "" : "s"} from this week's plan to the shopping list`);
  }

  function persist(next) {
    setRecipes(next);
    saveRecipes(next);
  }

  function handleSave(recipe) {
    const exists = recipes.some((r) => r.id === recipe.id);
    const next = exists ? recipes.map((r) => (r.id === recipe.id ? recipe : r)) : [recipe, ...recipes];
    persist(next);
    setActiveId(recipe.id);
    setNewDraft(null);
    setView("detail");
  }

  function handleParsedCapture(draft) {
    setNewDraft({ ...emptyRecipe(), ...draft });
    setView("new");
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
      if (locationFilter && r.location !== locationFilter && r.location !== "both") return false;
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
  }, [recipes, search, activeTag, favoritesOnly, locationFilter, sortBy]);

  function handleSurpriseMe() {
    if (filteredRecipes.length === 0) return;
    const pick = filteredRecipes[Math.floor(Math.random() * filteredRecipes.length)];
    setActiveId(pick.id);
    setView("detail");
  }

  const activeRecipe = recipes.find((r) => r.id === activeId) || null;

  // Close the "more actions" menu on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e) {
      if (!e.target.closest?.(".app-menu-wrap")) setMenuOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

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
        setNewDraft(null);
        setView("new");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [view]);

  const navItems = [
    { key: "list", label: "Recipes", icon: "📖", active: RECIPE_VIEWS.has(view) },
    { key: "shopping", label: "Shopping", icon: "🛒", active: view === "shopping" },
    { key: "mealplan", label: "Meal Plan", icon: "📅", active: view === "mealplan" },
    { key: "meals", label: "Meals", icon: "🍽️", active: view === "meals" },
  ];

  function goTo(key) {
    setMenuOpen(false);
    if (key === "list") {
      setActiveId(null);
      setView("list");
    } else {
      setView(key);
    }
  }

  return (
    <div className="app">
      <header className="app-header no-print">
        <div className="app-header-top">
          <h1 onClick={() => goTo("list")} className="app-title">
            🌿 Thymebook
          </h1>
          <div className="app-menu-wrap">
            <button
              className="btn app-menu-btn"
              aria-label="More actions"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              ⋯
            </button>
            {menuOpen && (
              <div className="app-menu">
                <button
                  className="app-menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    exportAllAsJson(recipes);
                  }}
                >
                  Export backup
                </button>
                <button
                  className="app-menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    fileInputRef.current?.click();
                  }}
                >
                  Import backup
                </button>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleImportFile} />
          </div>
        </div>

        <nav className="main-nav" aria-label="Primary">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`main-nav-item ${item.active ? "active" : ""}`}
              onClick={() => goTo(item.key)}
              aria-current={item.active ? "page" : undefined}
            >
              <span className="main-nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="main-nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
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
            locationFilter={locationFilter}
            onLocationFilterChange={setLocationFilter}
            sortBy={sortBy}
            onSortChange={setSortBy}
            onOpen={(id) => {
              setActiveId(id);
              setView("detail");
            }}
            onNew={() => {
              setNewDraft(null);
              setView("new");
            }}
            onCapture={() => setView("capture")}
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
            onAddToShoppingList={(servings) => handleAddToShoppingList(activeRecipe, servings)}
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
          <RecipeForm
            recipe={newDraft || emptyRecipe()}
            onSave={handleSave}
            onCancel={() => {
              setNewDraft(null);
              setView("list");
            }}
          />
        )}

        {view === "edit" && activeRecipe && (
          <RecipeForm recipe={activeRecipe} onSave={handleSave} onCancel={() => setView("detail")} />
        )}

        {view === "capture" && (
          <QuickCapture onParsed={handleParsedCapture} onCancel={() => setView("list")} />
        )}

        {view === "shopping" && (
          <ShoppingList
            list={shoppingList}
            onChange={persistShoppingList}
            staples={staples}
            onAddStaple={(s) => persistStaples([...staples, s])}
            onRemoveStaple={(s) => persistStaples(staples.filter((x) => x !== s))}
            onClear={() => persistShoppingList(clearShoppingList())}
            onBack={() => setView("list")}
          />
        )}

        {view === "mealplan" && (
          <MealPlanner
            plan={mealPlan}
            recipes={recipes}
            onAssign={(day, recipe, servings) => persistMealPlan(assignRecipe(mealPlan, day, recipe, servings))}
            onRemove={(day, assignmentId) => persistMealPlan(removeAssignment(mealPlan, day, assignmentId))}
            onClear={() => persistMealPlan(clearMealPlan())}
            onGenerateShoppingList={handleGenerateShoppingListFromPlan}
            onBack={() => setView("list")}
          />
        )}

        {view === "meals" && (
          <Meals
            meals={meals}
            recipes={recipes}
            onCreate={handleCreateMeal}
            onDelete={handleDeleteMeal}
            onAddToShoppingList={handleAddMealToShoppingList}
            onAssignToDay={handleAssignMealToDay}
          />
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

      {!pendingDelete && toastMessage && (
        <Toast message={toastMessage} onDismiss={() => setToastMessage("")} />
      )}
    </div>
  );
}
