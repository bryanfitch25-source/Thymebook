import { useState } from "react";

function locationBadgeLabel(location) {
  if (location === "home") return "🏠 Home";
  if (location === "work") return "💼 Work";
  if (location === "both") return "🏠💼 Both";
  return "";
}

// Known cuisine names, used to split the flat tag list into a "Cuisine"
// dropdown vs the remaining tag pills (meal-type, dietary, technique, etc).
// Matched case-insensitively against each recipe's tags.
const CUISINE_TAGS = new Set([
  "african",
  "american",
  "asian",
  "british",
  "cajun",
  "caribbean",
  "chinese",
  "creole",
  "cuban",
  "european",
  "french",
  "german",
  "greek",
  "hawaiian",
  "indian",
  "irish",
  "italian",
  "japanese",
  "korean",
  "mediterranean",
  "mexican",
  "middle-eastern",
  "moroccan",
  "southern",
  "southwestern",
  "spanish",
  "tex-mex",
  "thai",
  "vietnamese",
]);

function splitTags(allTags) {
  const cuisines = [];
  const other = [];
  allTags.forEach((tag) => {
    if (CUISINE_TAGS.has(tag.toLowerCase())) cuisines.push(tag);
    else other.push(tag);
  });
  return { cuisines, other };
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
  favoriteIds,
  popularOnly,
  onTogglePopularOnly,
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
  const { cuisines, other } = splitTags(allTags);
  const sortedCuisines = [...cuisines].sort((a, b) => a.localeCompare(b));
  const sortedOther = [...other].sort((a, b) => a.localeCompare(b));
  const activeCuisine = activeTag && cuisines.includes(activeTag) ? activeTag : "";
  const activeOtherTag = activeTag && other.includes(activeTag) ? activeTag : "";

  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = [favoritesOnly, popularOnly, Boolean(locationFilter), Boolean(activeTag)].filter(Boolean).length;

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
        <button
          className={`btn filters-toggle ${filtersOpen ? "active" : ""}`}
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
        >
          ⚙ Filters{activeFilterCount > 0 && <span className="filters-count">{activeFilterCount}</span>}
        </button>
      </div>

      <div className={`list-filters ${filtersOpen ? "open" : ""}`}>
        <div className="list-controls-row">
          <button
            className={`tag-filter favorites-filter ${favoritesOnly ? "active" : ""}`}
            onClick={onToggleFavoritesOnly}
            aria-pressed={favoritesOnly}
          >
            ★ Favorites only
          </button>

          <button
            className={`tag-filter favorites-filter ${popularOnly ? "active" : ""}`}
            onClick={onTogglePopularOnly}
            aria-pressed={popularOnly}
            title="Recipes favorited by at least one of the 4 families"
          >
            🌟 Popular with any family
          </button>

          <label className="sort-control">
            Location
            <select value={locationFilter || ""} onChange={(e) => onLocationFilterChange(e.target.value || null)}>
              <option value="">Anywhere</option>
              <option value="home">🏠 Home</option>
              <option value="work">💼 Work</option>
            </select>
          </label>

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

        {sortedCuisines.length > 0 && (
          <label className="sort-control cuisine-select">
            Cuisine
            <select value={activeCuisine} onChange={(e) => onTagSelect(e.target.value || null)}>
              <option value="">All cuisines</option>
              {sortedCuisines.map((cuisine) => (
                <option key={cuisine} value={cuisine}>
                  {cuisine}
                </option>
              ))}
            </select>
          </label>
        )}

        {sortedOther.length > 0 && (
          <label className="sort-control cuisine-select">
            Tag
            <select value={activeOtherTag} onChange={(e) => onTagSelect(e.target.value || null)}>
              <option value="">All tags</option>
              {sortedOther.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {recipes.length === 0 ? (
        <p className="empty-state">
          {search || activeTag || favoritesOnly || popularOnly ? "No recipes match your search." : "No recipes yet — add your first one."}
        </p>
      ) : (
        <ul className="recipe-cards">
          {recipes.map((r) => (
            <li key={r.id} className="recipe-card" onClick={() => onOpen(r.id)}>
              {r.photo && <img className="recipe-card-photo" src={r.photo} alt="" />}
              <div className="recipe-card-body">
                <div className="recipe-card-title-row">
                  <h3>{r.title}</h3>
                  <div className="recipe-card-badges">
                    {r.location && <span className={`location-badge location-${r.location}`}>{locationBadgeLabel(r.location)}</span>}
                    <button
                      className={`star-toggle ${favoriteIds?.has(r.id) ? "active" : ""}`}
                      aria-label={favoriteIds?.has(r.id) ? "Remove from favorites" : "Add to favorites"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(r.id);
                      }}
                    >
                      {favoriteIds?.has(r.id) ? "★" : "☆"}
                    </button>
                  </div>
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
