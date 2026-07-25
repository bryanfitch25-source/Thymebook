function locationBadgeLabel(location) {
  if (location === "home") return "🏠 Home";
  if (location === "work") return "💼 Work";
  if (location === "both") return "🏠💼 Both";
  return "";
}

export default function RecipeList({
  recipes,
  search,
  onSearch,
  activeTag,
  onTagSelect,
  allTags,
  favoritesOnly,
  onToggleFavoritesOnly,
  locationFilter,
  onLocationFilterChange,
  sortBy,
  onSortChange,
  onOpen,
  onNew,
  onCapture,
  onToggleFavorite,
  onSurpriseMe,
}) {
  return (
    <div className="recipe-list-view">
      <div className="list-toolbar">
        <input
          id="recipe-search-input"
          type="search"
          className="search-input"
          placeholder="Search recipes... (press / to focus)"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
        <button className="btn btn-primary" onClick={onNew}>
          + New recipe
        </button>
        <button className="btn" onClick={onCapture}>
          📷 Scan a recipe
        </button>
      </div>

      <div className="list-controls-row">
        <button
          className={`tag-filter favorites-filter ${favoritesOnly ? "active" : ""}`}
          onClick={onToggleFavoritesOnly}
          aria-pressed={favoritesOnly}
        >
          ★ Favorites only
        </button>

        <div className="location-filter-group" role="group" aria-label="Filter by home or work">
          {[
            { value: null, label: "Anywhere" },
            { value: "home", label: "🏠 Home" },
            { value: "work", label: "💼 Work" },
          ].map((opt) => (
            <button
              key={opt.label}
              className={`tag-filter ${locationFilter === opt.value ? "active" : ""}`}
              onClick={() => onLocationFilterChange(locationFilter === opt.value ? null : opt.value)}
              aria-pressed={locationFilter === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <label className="sort-control">
          Sort
          <select value={sortBy} onChange={(e) => onSortChange(e.target.value)}>
            <option value="updated">Recently updated</option>
            <option value="created">Recently added</option>
            <option value="title">Title (A–Z)</option>
          </select>
        </label>

        <button className="btn surprise-btn" onClick={onSurpriseMe} disabled={recipes.length === 0}>
          🎲 Surprise me
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
          {search || activeTag || favoritesOnly ? "No recipes match your search." : "No recipes yet — add your first one."}
        </p>
      ) : (
        <ul className="recipe-cards">
          {recipes.map((r) => (
            <li key={r.id} className="recipe-card" onClick={() => onOpen(r.id)}>
              {r.photo && <img className="recipe-card-photo" src={r.photo} alt="" />}
              <div className="recipe-card-body">
                <div className="recipe-card-title-row">
                  <h3>{r.title}</h3>
                  {r.location && <span className={`location-badge location-${r.location}`}>{locationBadgeLabel(r.location)}</span>}
                  <button
                    className={`star-toggle ${r.favorite ? "active" : ""}`}
                    aria-label={r.favorite ? "Remove from favorites" : "Add to favorites"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(r.id);
                    }}
                  >
                    {r.favorite ? "★" : "☆"}
                  </button>
                </div>
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
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
