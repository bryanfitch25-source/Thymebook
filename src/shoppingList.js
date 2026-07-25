import { formatQuantity, normalizeIngredientName, parseIngredientLine, scaleIngredientLine, unitLabel } from "./ingredientScale";

const LIST_KEY = "thymebook:shoppingList";
const STAPLES_KEY = "thymebook:staples";

export const DEFAULT_STAPLES = [
  "salt",
  "pepper",
  "olive oil",
  "vegetable oil",
  "flour",
  "sugar",
  "water",
  "baking powder",
  "baking soda",
  "cooking spray",
];

function newItemId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyShoppingList() {
  return {
    recipeEntries: [], // { id, recipeId, recipeTitle, servings, lines: [scaledIngredientLine, ...] }
    manualItems: [], // { id, text, checked }
    checked: {}, // { [groupKey]: true }
    staplesOverride: {}, // { [groupKey]: true } - excluded staple re-added to this list
  };
}

export function loadShoppingList() {
  try {
    const raw = localStorage.getItem(LIST_KEY);
    if (!raw) return emptyShoppingList();
    const parsed = JSON.parse(raw);
    return {
      ...emptyShoppingList(),
      ...parsed,
      recipeEntries: Array.isArray(parsed.recipeEntries) ? parsed.recipeEntries : [],
      manualItems: Array.isArray(parsed.manualItems) ? parsed.manualItems : [],
      checked: parsed.checked && typeof parsed.checked === "object" ? parsed.checked : {},
      staplesOverride: parsed.staplesOverride && typeof parsed.staplesOverride === "object" ? parsed.staplesOverride : {},
    };
  } catch {
    return emptyShoppingList();
  }
}

export function saveShoppingList(list) {
  localStorage.setItem(LIST_KEY, JSON.stringify(list));
}

export function loadStaples() {
  try {
    const raw = localStorage.getItem(STAPLES_KEY);
    if (!raw) return DEFAULT_STAPLES.slice();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_STAPLES.slice();
  } catch {
    return DEFAULT_STAPLES.slice();
  }
}

export function saveStaples(staples) {
  localStorage.setItem(STAPLES_KEY, JSON.stringify(staples));
}

// Adds a recipe's ingredients (scaled to `servings`) as a new entry in the
// shopping list. Lines are snapshotted at add-time so later edits/deletes of
// the recipe don't retroactively change an already-built list.
export function addRecipeToShoppingList(list, recipe, servings) {
  const baseServings = (() => {
    const n = parseFloat(recipe.servings);
    return Number.isFinite(n) && n > 0 ? n : 1;
  })();
  const factor = (Number(servings) || baseServings) / baseServings;
  const lines = recipe.ingredients
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => scaleIngredientLine(line, factor));

  const entry = {
    id: newItemId(),
    recipeId: recipe.id,
    recipeTitle: recipe.title,
    servings: Number(servings) || baseServings,
    lines,
  };
  return { ...list, recipeEntries: [...list.recipeEntries, entry] };
}

export function removeRecipeEntry(list, entryId) {
  return { ...list, recipeEntries: list.recipeEntries.filter((e) => e.id !== entryId) };
}

export function addManualItem(list, text) {
  const trimmed = text.trim();
  if (!trimmed) return list;
  const item = { id: newItemId(), text: trimmed, checked: false };
  return { ...list, manualItems: [...list.manualItems, item] };
}

export function removeManualItem(list, itemId) {
  return { ...list, manualItems: list.manualItems.filter((i) => i.id !== itemId) };
}

export function toggleManualItem(list, itemId) {
  return {
    ...list,
    manualItems: list.manualItems.map((i) => (i.id === itemId ? { ...i, checked: !i.checked } : i)),
  };
}

export function clearShoppingList() {
  return emptyShoppingList();
}

export function toggleChecked(list, key) {
  const next = { ...list.checked };
  if (next[key]) delete next[key];
  else next[key] = true;
  return { ...list, checked: next };
}

export function toggleStapleOverride(list, key) {
  const next = { ...list.staplesOverride };
  if (next[key]) delete next[key];
  else next[key] = true;
  return { ...list, staplesOverride: next };
}

function wordSet(s) {
  return new Set(s.split(/\s+/).filter(Boolean));
}

// A staple keyword matches an ingredient if every word in the staple
// keyword appears somewhere in the ingredient name (so generic staple
// "salt" matches "kosher salt", and "garlic powder" matches "garlic
// powder" but NOT plain "garlic" - direction matters so a specific
// staple never swallows a more general, likely-perishable ingredient).
function isStapleMatch(normalizedName, staples) {
  if (!normalizedName) return false;
  const nameWords = wordSet(normalizedName);
  return staples.some((s) => {
    const ns = normalizeIngredientName(s);
    if (!ns) return false;
    if (normalizedName === ns) return true;
    const stapleWords = wordSet(ns);
    for (const w of stapleWords) {
      if (!nameWords.has(w)) return false;
    }
    return true;
  });
}

function groupKeyFor(normalizedName, unit) {
  return `${normalizedName}::${unit || ""}`;
}

function formatGroupLabel(normalizedName, displayName, unit, quantity) {
  const namePart = displayName || normalizedName;
  if (quantity == null) return namePart;
  const unitPart = unitLabel(unit, quantity);
  return unitPart ? `${formatQuantity(quantity)} ${unitPart} ${namePart}` : `${formatQuantity(quantity)} ${namePart}`;
}

// Builds the consolidated, staple-filtered shopping list ready for display:
// { groups, excludedStaples } where each group is
// { key, label, checked, sources: [recipeTitle...], quantity, unit, name }
// and unparseable/incompatible lines are kept as their own group (never
// summed together) rather than guessed at.
export function buildConsolidatedList(list, staples) {
  const mergeable = new Map(); // key -> { quantity, unit, displayName, normalizedName, sources: Set }
  const standalone = []; // lines that can't be safely merged with anything

  function ingest(line, sourceLabel) {
    const parsed = parseIngredientLine(line);
    const normalizedName = normalizeIngredientName(parsed.name);
    if (parsed.quantity == null || !normalizedName) {
      standalone.push({
        key: `standalone::${sourceLabel}::${line}::${standalone.length}`,
        label: line,
        normalizedName,
        sources: sourceLabel ? [sourceLabel] : [],
      });
      return;
    }
    const key = groupKeyFor(normalizedName, parsed.unit);
    const existing = mergeable.get(key);
    if (existing) {
      existing.quantity += parsed.quantity;
      existing.sources.add(sourceLabel);
    } else {
      mergeable.set(key, {
        quantity: parsed.quantity,
        unit: parsed.unit,
        displayName: parsed.name,
        normalizedName,
        sources: new Set(sourceLabel ? [sourceLabel] : []),
      });
    }
  }

  list.recipeEntries.forEach((entry) => {
    entry.lines.forEach((line) => ingest(line, entry.recipeTitle));
  });
  list.manualItems.forEach((item) => {
    standalone.push({
      key: `manual::${item.id}`,
      label: item.text,
      normalizedName: normalizeIngredientName(item.text),
      sources: [],
      manualId: item.id,
      checked: item.checked,
    });
  });

  const groups = [];
  const excludedStaples = [];

  mergeable.forEach((data, key) => {
    const isStaple = isStapleMatch(data.normalizedName, staples);
    const overridden = Boolean(list.staplesOverride[key]);
    const group = {
      key,
      label: formatGroupLabel(data.normalizedName, data.displayName, data.unit, data.quantity),
      checked: Boolean(list.checked[key]),
      sources: Array.from(data.sources),
      quantity: data.quantity,
      unit: data.unit,
      name: data.displayName,
      isStaple,
    };
    if (isStaple && !overridden) {
      excludedStaples.push(group);
    } else {
      groups.push(group);
    }
  });

  standalone.forEach((s) => {
    if (s.manualId != null) {
      groups.push({ key: s.key, label: s.label, checked: Boolean(s.checked), sources: [], isManual: true, manualId: s.manualId });
      return;
    }
    const isStaple = isStapleMatch(s.normalizedName, staples);
    const overridden = Boolean(list.staplesOverride[s.key]);
    const group = { key: s.key, label: s.label, checked: Boolean(list.checked[s.key]), sources: s.sources, isStaple };
    if (isStaple && !overridden) {
      excludedStaples.push(group);
    } else {
      groups.push(group);
    }
  });

  groups.sort((a, b) => a.label.localeCompare(b.label));
  excludedStaples.sort((a, b) => a.label.localeCompare(b.label));

  return { groups, excludedStaples };
}
