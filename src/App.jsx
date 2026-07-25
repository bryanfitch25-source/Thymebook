import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import {
  fetchRecipes,
  upsertRecipe,
  upsertRecipes,
  deleteRecipeRemote,
  subscribeRecipes,
  emptyRecipe,
  normalizeRecipe,
  newRecipeId,
} from "./storage";
import { exportAllAsJson, parseImportedJson } from "./exportImport";
import {
  loadShoppingList,
  saveShoppingList,
  subscribeShoppingList,
  loadStaples,
  saveStaples,
  subscribeStaples,
  addRecipeToShoppingList,
  clearShoppingList,
} from "./shoppingList";
import {
  loadMealPlan,
  saveMealPlan,
  subscribeMealPlan,
  assignRecipe,
  assignMeal,
  removeAssignment,
  clearMealPlan,
} from "./mealPlan";
import { loadMeals, saveMeals, subscribeMeals, createMeal, addMeal, removeMeal } from "./meals";
import {
  fetchReminders,
  subscribeReminders,
  createReminder,
  cancelReminder,
  deleteReminder,
  computeMealPlanReminderTime,
} from "./reminders";
import {
  isPushSupported,
  notificationPermission,
  subscribeToPush,
  getCurrentSubscriptionStatus,
  registerServiceWorker,
} from "./push/pushSubscribe";
import Login from "./components/Login";
import RecipeList from "./components/RecipeList";
import RecipeDetail from "./components/RecipeDetail";
import RecipeForm from "./components/RecipeForm";
import CookMode from "./components/CookMode";
import QuickCapture from "./components/QuickCapture";
import ShoppingList from "./components/ShoppingList";
import MealPlanner from "./components/MealPlanner";
import Meals from "./components/Meals";
import Reminders from "./components/Reminders";
import Toast from "./components/Toast";
import "./App.css";

const UNDO_TIMEOUT = 6000;

// Views that belong to the "Recipes" primary nav destination.
const RECIPE_VIEWS = new Set(["list", "detail", "new", "edit", "cook", "capture"]);

// Applies a single recipe insert/update to an array, used both for our own
// optimistic writes and for realtime events (including echoes of our own
// writes) - always an idempotent "replace by id" rather than a blind append.
function applyRecipeUpsert(current, recipe) {
  const exists = current.some((r) => r.id === recipe.id);
  return exists ? current.map((r) => (r.id === recipe.id ? recipe : r)) : [recipe, ...current];
}

function applyRecipeDelete(current, id) {
  return current.filter((r) => r.id !== id);
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = not checked yet, null = signed out
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState("");

  const [recipes, setRecipes] = useState([]);
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
  const [shoppingList, setShoppingList] = useState(null);
  const [staples, setStaples] = useState([]);
  const [mealPlan, setMealPlan] = useState(null);
  const [meals, setMeals] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState("default");
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef(null);
  const undoTimerRef = useRef(null);
  const toastTimerRef = useRef(null);

  function showToast(message) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(message);
    toastTimerRef.current = setTimeout(() => setToastMessage(""), 3500);
  }

  function showError(prefix, err) {
    console.error(prefix, err);
    setDataError(`${prefix}: ${err?.message || "something went wrong talking to the server."}`);
  }

  // --- Auth -------------------------------------------------------------

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  function handleSignOut() {
    setMenuOpen(false);
    supabase.auth.signOut();
  }

  // --- Push notification support/registration -----------------------------

  useEffect(() => {
    const supported = isPushSupported();
    setPushSupported(supported);
    if (!supported) return;
    setPushPermission(notificationPermission());
    registerServiceWorker().catch((err) => console.error("Service worker registration failed", err));
    getCurrentSubscriptionStatus().then((status) => setPushSubscribed(status.subscribed));
  }, []);

  async function handleSubscribePush() {
    const result = await subscribeToPush();
    setPushPermission(notificationPermission());
    if (result.ok) {
      setPushSubscribed(true);
      showToast("Notifications enabled on this device");
    } else if (result.reason === "permission-denied") {
      showToast("Notification permission was denied");
    } else if (result.reason === "not-supported") {
      showToast("This browser doesn't support push notifications");
    } else {
      showError("Couldn't enable notifications", result.error);
    }
  }

  // --- Initial data load + realtime subscriptions ------------------------

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setDataLoading(true);
    setDataError("");

    Promise.all([fetchRecipes(), loadShoppingList(), loadStaples(), loadMealPlan(), loadMeals(), fetchReminders()])
      .then(([r, sl, st, mp, ml, rem]) => {
        if (cancelled) return;
        setRecipes(r);
        setShoppingList(sl);
        setStaples(st);
        setMealPlan(mp);
        setMeals(ml);
        setReminders(rem);
      })
      .catch((err) => {
        if (!cancelled) showError("Couldn't load your data", err);
      })
      .finally(() => {
        if (!cancelled) setDataLoading(false);
      });

    const unsubRecipes = subscribeRecipes((eventType, payload) => {
      setRecipes((current) =>
        eventType === "DELETE" ? applyRecipeDelete(current, payload.id) : applyRecipeUpsert(current, payload)
      );
    });
    const unsubShoppingList = subscribeShoppingList((data) => setShoppingList(data));
    const unsubStaples = subscribeStaples((data) => setStaples(data));
    const unsubMealPlan = subscribeMealPlan((data) => setMealPlan(data));
    const unsubMeals = subscribeMeals((data) => setMeals(data));
    const unsubReminders = subscribeReminders((eventType, payload) => {
      setReminders((current) => {
        if (eventType === "DELETE") return current.filter((r) => r.id !== payload.id);
        const exists = current.some((r) => r.id === payload.id);
        return exists ? current.map((r) => (r.id === payload.id ? payload : r)) : [payload, ...current];
      });
    });

    return () => {
      cancelled = true;
      unsubRecipes();
      unsubShoppingList();
      unsubStaples();
      unsubMealPlan();
      unsubMeals();
      unsubReminders();
    };
  }, [session]);

  // --- Meals --------------------------------------------------------------

  function persistMeals(next) {
    setMeals(next);
    saveMeals(next).catch((err) => showError("Couldn't save meals", err));
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

  // --- Reminders ------------------------------------------------------------

  function handleSetThawReminder(day, assignment, leadHours) {
    const remindAt = computeMealPlanReminderTime(day, leadHours);
    if (!remindAt) return;
    createReminder({
      recipeId: assignment.recipeId,
      label: `Thaw ${assignment.recipeTitle} for ${day}`,
      remindAt,
      leadHours,
      source: "mealplan",
    })
      .then((reminder) => setReminders((current) => [reminder, ...current]))
      .catch((err) => showError("Couldn't create the thaw reminder", err));
    showToast(`Thaw reminder set for ${leadHours}h before ~6pm ${day}`);
  }

  function handleCreateStandaloneReminder({ label, recipeId, remindAt }) {
    createReminder({ recipeId, label, remindAt, leadHours: 0, source: "manual" })
      .then((reminder) => {
        setReminders((current) => [reminder, ...current]);
        showToast("Reminder created");
      })
      .catch((err) => showError("Couldn't create the reminder", err));
  }

  function handleCancelReminder(id) {
    setReminders((current) => current.map((r) => (r.id === id ? { ...r, status: "cancelled" } : r)));
    cancelReminder(id).catch((err) => showError("Couldn't cancel the reminder", err));
  }

  function handleDeleteReminder(id) {
    setReminders((current) => current.filter((r) => r.id !== id));
    deleteReminder(id).catch((err) => showError("Couldn't delete the reminder", err));
  }

  // --- Shopping list / staples / meal plan ---------------------------------

  function persistShoppingList(next) {
    setShoppingList(next);
    saveShoppingList(next).catch((err) => showError("Couldn't save the shopping list", err));
  }

  function persistStaples(next) {
    setStaples(next);
    saveStaples(next).catch((err) => showError("Couldn't save staples", err));
  }

  function persistMealPlan(next) {
    setMealPlan(next);
    saveMealPlan(next).catch((err) => showError("Couldn't save the meal plan", err));
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

  // --- Recipes --------------------------------------------------------------

  function persistRecipeUpsert(recipe) {
    setRecipes((current) => applyRecipeUpsert(current, recipe));
    upsertRecipe(recipe).catch((err) => showError("Couldn't save the recipe", err));
  }

  function handleSave(recipe) {
    persistRecipeUpsert(recipe);
    setActiveId(recipe.id);
    setNewDraft(null);
    setView("detail");
  }

  function handleParsedCapture(draft) {
    setNewDraft({ ...emptyRecipe(), ...draft });
    setView("new");
  }

  function handleToggleFavorite(id) {
    const recipe = recipes.find((r) => r.id === id);
    if (!recipe) return;
    persistRecipeUpsert({ ...recipe, favorite: !recipe.favorite });
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
    persistRecipeUpsert(copy);
    setActiveId(copy.id);
    setView("edit");
  }

  function handleDelete(id) {
    const index = recipes.findIndex((r) => r.id === id);
    if (index === -1) return;
    const recipe = recipes[index];
    setRecipes((current) => applyRecipeDelete(current, id));
    deleteRecipeRemote(id).catch((err) => showError("Couldn't delete the recipe", err));
    setView("list");
    setActiveId(null);

    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setPendingDelete({ recipe, index });
    undoTimerRef.current = setTimeout(() => setPendingDelete(null), UNDO_TIMEOUT);
  }

  function handleUndoDelete() {
    if (!pendingDelete) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    persistRecipeUpsert(pendingDelete.recipe);
    setPendingDelete(null);
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      (async () => {
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
          setRecipes(Array.from(byId.values()));
          await upsertRecipes(imported);
          setImportMessage(`Imported ${added} new, updated ${updated} existing recipe${added + updated === 1 ? "" : "s"}.`);
        } catch (err) {
          setImportMessage(`Import failed: ${err.message}`);
        }
      })();
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
    { key: "reminders", label: "Reminders", icon: "🧊", active: view === "reminders" },
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

  // --- Render gates: auth check in flight, signed out, data loading -------

  if (session === undefined) {
    return <div className="app-loading-screen">Loading…</div>;
  }

  if (session === null) {
    return <Login />;
  }

  if (dataLoading || !shoppingList || !mealPlan) {
    return <div className="app-loading-screen">Loading your recipe book…</div>;
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
                <button className="app-menu-item" onClick={handleSignOut}>
                  Sign out
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

      {dataError && (
        <div className="data-error-banner no-print">
          {dataError}
          <button className="btn-close" onClick={() => setDataError("")}>
            ×
          </button>
        </div>
      )}

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
            onSetThawReminder={handleSetThawReminder}
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

        {view === "reminders" && (
          <Reminders
            reminders={reminders}
            recipes={recipes}
            pushSupported={pushSupported}
            pushPermission={pushPermission}
            pushSubscribed={pushSubscribed}
            onSubscribe={handleSubscribePush}
            onCreateStandalone={handleCreateStandaloneReminder}
            onCancel={handleCancelReminder}
            onDelete={handleDeleteReminder}
            onBack={() => setView("list")}
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
