import { useMemo, useState } from "react";
import {
  addManualItem,
  buildConsolidatedList,
  removeManualItem,
  removeRecipeEntry,
  toggleChecked,
  toggleManualItem,
  toggleStapleOverride,
} from "../shoppingList";

export default function ShoppingList({ list, onChange, staples, onAddStaple, onRemoveStaple, onClear, onBack }) {
  const [manualText, setManualText] = useState("");
  const [staplesOpen, setStaplesOpen] = useState(false);
  const [newStaple, setNewStaple] = useState("");

  const { groups, excludedStaples } = useMemo(() => buildConsolidatedList(list, staples), [list, staples]);

  function handleToggle(group) {
    if (group.isManual) {
      onChange(toggleManualItem(list, group.manualId));
    } else {
      onChange(toggleChecked(list, group.key));
    }
  }

  function handleAddManual(e) {
    e.preventDefault();
    if (!manualText.trim()) return;
    onChange(addManualItem(list, manualText));
    setManualText("");
  }

  function handleAddStapleBack(key) {
    onChange(toggleStapleOverride(list, key));
  }

  function handleAddStapleKeyword(e) {
    e.preventDefault();
    if (!newStaple.trim()) return;
    onAddStaple(newStaple.trim());
    setNewStaple("");
  }

  const checkedCount = groups.filter((g) => g.checked).length;

  return (
    <div className="shopping-list-view">
      <button className="btn btn-link no-print" onClick={onBack}>
        ← Back
      </button>

      <div className="shopping-header">
        <h1>Shopping list</h1>
        <div className="shopping-header-actions no-print">
          <button className="btn" onClick={() => window.print()}>
            🖨 Print
          </button>
          <button className="btn btn-danger" onClick={onClear} disabled={list.recipeEntries.length === 0 && list.manualItems.length === 0}>
            Clear list
          </button>
        </div>
      </div>

      {list.recipeEntries.length > 0 && (
        <section className="shopping-recipe-sources no-print">
          <h2>From recipes</h2>
          <ul className="shopping-source-list">
            {list.recipeEntries.map((entry) => (
              <li key={entry.id}>
                <span>
                  {entry.recipeTitle} <span className="shopping-source-servings">({entry.servings} servings)</span>
                </span>
                <button className="btn-close" aria-label={`Remove ${entry.recipeTitle} from list`} onClick={() => onChange(removeRecipeEntry(list, entry.id))}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="shopping-list-header-row">
          <h2>Items</h2>
          {groups.length > 0 && (
            <span className="shopping-progress">
              {checkedCount}/{groups.length}
            </span>
          )}
        </div>

        {groups.length === 0 ? (
          <p className="empty-state">No items yet — add a recipe or a manual item below.</p>
        ) : (
          <ul className="shopping-items">
            {groups.map((g) => (
              <li key={g.key}>
                <label className={g.checked ? "checked" : ""}>
                  <input type="checkbox" checked={g.checked} onChange={() => handleToggle(g)} />
                  <span>{g.label}</span>
                  {g.sources?.length > 0 && <span className="shopping-item-sources no-print">{g.sources.join(", ")}</span>}
                </label>
                {g.isManual && (
                  <button className="btn-close no-print" aria-label="Remove item" onClick={() => onChange(removeManualItem(list, g.manualId))}>
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <form className="shopping-add-form no-print" onSubmit={handleAddManual}>
          <input
            type="text"
            placeholder="Add an item (e.g. paper towels)"
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
          />
          <button className="btn" type="submit">
            Add
          </button>
        </form>
      </section>

      {excludedStaples.length > 0 && (
        <section className="no-print">
          <h2>Excluded staples</h2>
          <p className="hint-text">These are on your staples list, so they're left off by default. Tap to add one back in.</p>
          <ul className="staple-excluded-list">
            {excludedStaples.map((g) => (
              <li key={g.key}>
                <span>{g.label}</span>
                <button className="btn" onClick={() => handleAddStapleBack(g.key)}>
                  + Add to list
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="no-print">
        <button className="btn-link" onClick={() => setStaplesOpen((v) => !v)}>
          {staplesOpen ? "Hide" : "Manage"} staples list
        </button>
        {staplesOpen && (
          <div className="staples-manager">
            <p className="hint-text">Staples are ingredients you always have on hand; matching items are excluded from generated lists by default.</p>
            <ul className="staple-manage-list">
              {staples.map((s) => (
                <li key={s}>
                  <span>{s}</span>
                  <button className="btn-close" aria-label={`Remove ${s} from staples`} onClick={() => onRemoveStaple(s)}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <form className="shopping-add-form" onSubmit={handleAddStapleKeyword}>
              <input
                type="text"
                placeholder="Add a staple (e.g. soy sauce)"
                value={newStaple}
                onChange={(e) => setNewStaple(e.target.value)}
              />
              <button className="btn" type="submit">
                Add
              </button>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
