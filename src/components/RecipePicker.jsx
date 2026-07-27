import { useEffect, useRef, useState } from "react";

// Searchable stand-in for a plain <select> of recipes - typing filters the
// list by title instead of scrolling through everything. Drop-in compatible
// with the old <select value onChange> API (onChange receives just the id).
export default function RecipePicker({
  recipes,
  value,
  onChange,
  placeholder = "Search recipes...",
  includeNoneOption = false,
  noneLabel = "— None —",
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    function handleOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const selected = recipes.find((r) => r.id === value);
  const filtered = query.trim()
    ? recipes.filter((r) => r.title.toLowerCase().includes(query.trim().toLowerCase()))
    : recipes;

  function pick(recipe) {
    onChange(recipe ? recipe.id : "");
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="recipe-picker" ref={wrapRef}>
      <input
        type="text"
        className="recipe-picker-input"
        placeholder={placeholder}
        value={open ? query : selected?.title || (includeNoneOption ? noneLabel : "")}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => setQuery(e.target.value)}
      />
      {open && (
        <ul className="recipe-picker-list">
          {includeNoneOption && (
            <li className="recipe-picker-option" onClick={() => pick(null)}>
              {noneLabel}
            </li>
          )}
          {filtered.length === 0 ? (
            <li className="recipe-picker-empty">No matches</li>
          ) : (
            filtered.map((r) => (
              <li key={r.id} className="recipe-picker-option" onClick={() => pick(r)}>
                {r.title}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
