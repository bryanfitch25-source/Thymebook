export default function RecipeList({ recipes, search, onSearch, activeTag, onTagSelect, allTags, onOpen, onNew }) {
  return (
    <div className="recipe-list-view">
      <div className="list-toolbar">
        <input
          type="search"
          className="search-input"
          placeholder="Search recipes..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
        <button className="btn btn-primary" onClick={onNew}>
          + New recipe
        </button>
      </div>

      {allTags.length > 0 && (
        <div className="tag-filter-row">
          <button className={`tag-filter ${activeTag === null ? "active" : ""}`} onClick={() => onTagSelect(null)}>
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              className={`tag-filter ${activeTag === tag ? "active" : ""}`}
              onClick={() => onTagSelect(activeTag === tag ? null : tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {recipes.length === 0 ? (
        <p className="empty-state">
          {search || activeTag ? "No recipes match your search." : "No recipes yet — add your first one."}
        </p>
      ) : (
        <ul className="recipe-cards">
          {recipes.map((r) => (
            <li key={r.id} className="recipe-card" onClick={() => onOpen(r.id)}>
              <h3>{r.title}</h3>
              <div className="recipe-card-meta">
                {r.cookTime && <span>{r.cookTime}</span>}
                {r.servings && <span>Serves {r.servings}</span>}
              </div>
              {r.tags?.length > 0 && (
                <div className="tag-list">
                  {r.tags.map((tag) => (
                    <span className="tag" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
