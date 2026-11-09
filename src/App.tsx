import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { ComparePage } from "./ComparePage";
import { DetailsPage } from "./DetailsPage";
import { PokemonSearchBox } from "./PokemonSearchBox";
import { useTheme } from "./ThemeContext";
import {
  FEATURED_NAMES,
  fetchPokemon,
  formatName,
  pushHistory,
  readFavorites,
  readHistory,
  saveFavorites,
  saveHistory,
  sortPokemon,
} from "./pokemon";
import type { PokemonSummary, SortOrder } from "./types";

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "id", label: "Pokédex ID" },
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
];
const FILTER_TYPES = [
  "all", "normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison",
  "ground", "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy",
] as const;
type PokemonTypeFilter = (typeof FILTER_TYPES)[number];

export function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [recommended, setRecommended] = useState<PokemonSummary[]>([]);
  const [history, setHistory] = useState<PokemonSummary[]>(readHistory);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(() => readFavorites());
  const [favoriteDetails, setFavoriteDetails] = useState<Map<number, PokemonSummary>>(new Map());
  const [recommendedSort, setRecommendedSort] = useState<SortOrder>("newest");
  const [historySort, setHistorySort] = useState<SortOrder>("newest");
  const [favoriteSort, setFavoriteSort] = useState<SortOrder>("newest");
  const [recommendedLoading, setRecommendedLoading] = useState(true);
  const [searchError, setSearchError] = useState("");

  const sortedRecommended = useMemo(
    () => sortPokemon(recommended, recommendedSort, false),
    [recommended, recommendedSort],
  );
  const sortedHistory = useMemo(
    () => sortPokemon(history, historySort, true),
    [history, historySort],
  );

  const favoriteEntries = useMemo(() => {
    const merged = new Map<number, PokemonSummary>();

    for (const item of [...recommended, ...history]) {
      if (favoriteIds.has(item.id)) merged.set(item.id, item);
    }

    for (const item of favoriteDetails.values()) {
      if (favoriteIds.has(item.id)) merged.set(item.id, item);
    }

    return Array.from(merged.values());
  }, [favoriteDetails, favoriteIds, history, recommended]);

  const sortedFavorites = useMemo(
    () => sortPokemon(favoriteEntries, favoriteSort, false),
    [favoriteEntries, favoriteSort],
  );

  useEffect(() => {
    let active = true;
    Promise.allSettled(FEATURED_NAMES.map(fetchPokemon)).then((results) => {
      if (!active) return;
      setRecommended(
        results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []),
      );
      setRecommendedLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => saveHistory(history), [history]);
  useEffect(() => saveFavorites(favoriteIds), [favoriteIds]);

  const recordPokemon = useCallback((pokemon: PokemonSummary) => {
    setHistory((stack) => pushHistory(stack, pokemon));
  }, []);

  const toggleFavorite = useCallback((pokemon: PokemonSummary) => {
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (next.has(pokemon.id)) next.delete(pokemon.id);
      else next.add(pokemon.id);
      return next;
    });
    setFavoriteDetails((current) => {
      const next = new Map(current);
      next.set(pokemon.id, pokemon);
      return next;
    });
  }, []);

  const openPokemon = useCallback((pokemon: PokemonSummary) => {
    recordPokemon(pokemon);
    navigate(`/pokemon/${pokemon.id}`);
  }, [navigate, recordPokemon]);

  async function handleHomeSearch(name: string) {
    setSearchError("");
    try {
      const pokemon = await fetchPokemon(name);
      const summary: PokemonSummary = {
        id: pokemon.id,
        name: pokemon.name,
        image: pokemon.image,
        types: pokemon.types,
      };
      recordPokemon(summary);
      navigate(`/pokemon/${pokemon.id}`);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Could not find that Pokémon");
    }
  }

  useEffect(() => {
    if (location.pathname !== "/") return;
    requestAnimationFrame(() => {
      document.getElementById("search-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [location.pathname]);

  return (
    <>
      <Navbar />
      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              recommended={sortedRecommended}
              recent={sortedHistory}
              favoriteIds={favoriteIds}
              searchError={searchError}
              recommendedLoading={recommendedLoading}
              recommendedSort={recommendedSort}
              historySort={historySort}
              onSearch={handleHomeSearch}
              onRecommendedSortChange={setRecommendedSort}
              onHistorySortChange={setHistorySort}
              onPokemonSelect={openPokemon}
              onToggleFavorite={toggleFavorite}
            />
          }
        />
        <Route
          path="/history"
          element={
            <HistoryPage
              pokemon={history}
              favoriteIds={favoriteIds}
              onPokemonSelect={openPokemon}
              onToggleFavorite={toggleFavorite}
              onClearHistory={() => setHistory([])}
            />
          }
        />
        <Route
          path="/favorites"
          element={
            <FavoritesPage
              pokemon={sortedFavorites}
              favoriteIds={favoriteIds}
              onPokemonSelect={openPokemon}
              onToggleFavorite={toggleFavorite}
              sort={favoriteSort}
              onSortChange={setFavoriteSort}
              onClearFavorites={() => setFavoriteIds(new Set())}
            />
          }
        />
        <Route
          path="/pokemon/:id"
          element={<DetailsPage onRecord={recordPokemon} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} />}
        />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <footer className="site-footer">
        <span>Pokémon Explorer</span>
        <span>Data powered by PokéAPI</span>
      </footer>
    </>
  );
}

function Navbar() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="topbar">
      <Link className="brand" to="/" aria-label="Pokémon Explorer home">
        <span className="brand-mark" aria-hidden="true">P</span>
        <span>Pokémon <strong>Explorer</strong></span>
      </Link>
      <nav className="topbar-nav" aria-label="Main navigation">
        <Link to="/#recommended">Discover</Link>
        <Link to="/history">History</Link>
        <Link to="/favorites">Favorites</Link>
        <Link to="/compare">Compare</Link>
      </nav>
      <button
        className="theme-toggle"
        type="button"
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        aria-pressed={theme === "dark"}
      >
        <span aria-hidden="true">{theme === "light" ? "☾" : "☀"}</span>
        <span className="theme-toggle-label">{theme === "light" ? "Dark mode" : "Light mode"}</span>
      </button>
    </header>
  );
}

interface HomePageProps {
  recommended: PokemonSummary[];
  recent: PokemonSummary[];
  favoriteIds: Set<number>;
  searchError: string;
  recommendedLoading: boolean;
  recommendedSort: SortOrder;
  historySort: SortOrder;
  onSearch: (value: string) => void;
  onRecommendedSortChange: (value: SortOrder) => void;
  onHistorySortChange: (value: SortOrder) => void;
  onPokemonSelect: (pokemon: PokemonSummary) => void;
  onToggleFavorite: (pokemon: PokemonSummary) => void;
}

function HomePage({
  recommended,
  recent,
  favoriteIds,
  searchError,
  recommendedLoading,
  recommendedSort,
  historySort,
  onSearch,
  onRecommendedSortChange,
  onHistorySortChange,
  onPokemonSelect,
  onToggleFavorite,
}: HomePageProps) {
  const [selectedType, setSelectedType] = useState<PokemonTypeFilter>("all");
  const filteredRecommended = useMemo(
    () => selectedType === "all"
      ? recommended
      : recommended.filter((pokemon) => pokemon.types.includes(selectedType)),
    [recommended, selectedType],
  );

  return (
    <main id="home" className="page-shell">
      <section id="search-section" className="welcome-row" aria-labelledby="page-title">
        <div>
          <p className="eyebrow"><span className="eyebrow-dot" /> THE FIELD GUIDE</p>
          <h1 id="page-title">Meet your next <em>favorite.</em></h1>
          <p className="welcome-copy">A little curiosity goes a long way. Find a Pokémon and follow its story.</p>
        </div>
        <PokemonSearchBox
          id="pokemon-search"
          label="Search Pokémon by name or ID"
          placeholder="Try Pikachu or #025"
          buttonLabel="Explore"
          onSelect={onSearch}
        />
        {searchError && <p className="search-error" role="alert">{searchError}</p>}
      </section>

      <div className="type-filter-row">
        <span className="type-filter-label">Type</span>
        <div className="type-filter-options" role="group" aria-label="Filter recommendations by type">
          {FILTER_TYPES.map((type) => (
            <button
              className={`type-filter-button ${selectedType === type ? "is-active" : ""}`}
              type="button"
              key={type}
              aria-pressed={selectedType === type}
              onClick={() => setSelectedType(type)}
            >
              {type === "all" ? "All" : type}
            </button>
          ))}
        </div>
      </div>

      <RecommendedSection
        pokemon={filteredRecommended}
        loading={recommendedLoading}
        emptyMessage={selectedType === "all" ? "Recommendations are unavailable right now." : `No recommended Pokémon with the ${selectedType} type yet.`}
        sort={recommendedSort}
        onSortChange={onRecommendedSortChange}
        onPokemonSelect={onPokemonSelect}
        favoriteIds={favoriteIds}
        onToggleFavorite={onToggleFavorite}
      />

      <RecentlyViewedSection
        pokemon={recent}
        sort={historySort}
        onSortChange={onHistorySortChange}
        onPokemonSelect={onPokemonSelect}
        favoriteIds={favoriteIds}
        onToggleFavorite={onToggleFavorite}
      />
    </main>
  );
}

interface ListingProps {
  pokemon: PokemonSummary[];
  sort: SortOrder;
  onSortChange: (value: SortOrder) => void;
  onPokemonSelect: (pokemon: PokemonSummary) => void;
  favoriteIds: Set<number>;
  onToggleFavorite: (pokemon: PokemonSummary) => void;
}

function RecommendedSection({
  pokemon,
  loading,
  emptyMessage,
  sort,
  onSortChange,
  onPokemonSelect,
  favoriteIds,
  onToggleFavorite,
}: ListingProps & { loading: boolean; emptyMessage: string }) {
  return (
    <section id="recommended" className="listing-section" aria-labelledby="recommended-title">
      <SectionHeading
        eyebrow="A GOOD PLACE TO START"
        title="Recommended"
        count={pokemon.length}
        sort={sort}
        onSortChange={onSortChange}
        sortLabel="Sort recommendations"
      />
      {loading ? (
        <p className="section-message">Gathering a few favorites...</p>
      ) : pokemon.length ? (
        <PokemonGrid
          pokemon={pokemon}
          idPrefix="recommended"
          favoriteIds={favoriteIds}
          onPokemonSelect={onPokemonSelect}
          onToggleFavorite={onToggleFavorite}
        />
      ) : (
        <p className="section-message">{emptyMessage}</p>
      )}
    </section>
  );
}

function RecentlyViewedSection({
  pokemon,
  sort,
  onSortChange,
  onPokemonSelect,
  favoriteIds,
  onToggleFavorite,
}: ListingProps) {
  return (
    <section id="recent" className="listing-section recent-section" aria-labelledby="recent-title">
      <SectionHeading
        eyebrow="YOUR FIELD NOTES"
        title="Recently viewed"
        count={pokemon.length}
        sort={sort}
        onSortChange={onSortChange}
        sortLabel="Sort recently viewed Pokémon"
      />
      {pokemon.length ? (
        <PokemonGrid
          pokemon={pokemon}
          idPrefix="recent"
          favoriteIds={favoriteIds}
          onPokemonSelect={onPokemonSelect}
          onToggleFavorite={onToggleFavorite}
          recent
        />
      ) : (
        <p className="section-message">Your next discovery will show up here.</p>
      )}
    </section>
  );
}

function HistoryPage({
  pokemon,
  favoriteIds,
  onPokemonSelect,
  onToggleFavorite,
  onClearHistory,
}: {
  pokemon: PokemonSummary[];
  favoriteIds: Set<number>;
  onPokemonSelect: (pokemon: PokemonSummary) => void;
  onToggleFavorite: (pokemon: PokemonSummary) => void;
  onClearHistory: () => void;
}) {
  const [sort, setSort] = useState<SortOrder>("newest");
  const items = useMemo(() => sortPokemon(pokemon, sort, true), [pokemon, sort]);

  return (
    <main className="route-shell">
      <header className="compare-intro">
        <p className="eyebrow">STACK HISTORY</p>
        <h1>Recently viewed</h1>
        <p>Your latest discoveries are kept in a LIFO stack with deduplication and a 10-item cap.</p>
      </header>

      <section className="listing-section" aria-labelledby="history-page-title">
        <SectionHeading
          eyebrow="YOUR FIELD NOTES"
          title="History"
          count={items.length}
          sort={sort}
          onSortChange={setSort}
          sortLabel="Sort history"
          clearLabel="Clear History"
          onClear={onClearHistory}
        />
        {items.length ? (
          <PokemonGrid
            pokemon={items}
            idPrefix="history"
            favoriteIds={favoriteIds}
            onPokemonSelect={onPokemonSelect}
            onToggleFavorite={onToggleFavorite}
            recent
          />
        ) : (
          <p className="section-message">No Pokémon have been viewed yet.</p>
        )}
      </section>
    </main>
  );
}

function FavoritesPage({
  pokemon,
  favoriteIds,
  onPokemonSelect,
  onToggleFavorite,
  sort,
  onSortChange,
  onClearFavorites,
}: {
  pokemon: PokemonSummary[];
  favoriteIds: Set<number>;
  onPokemonSelect: (pokemon: PokemonSummary) => void;
  onToggleFavorite: (pokemon: PokemonSummary) => void;
  sort: SortOrder;
  onSortChange: (value: SortOrder) => void;
  onClearFavorites: () => void;
}) {
  return (
    <main className="route-shell">
      <header className="compare-intro">
        <p className="eyebrow">SET COLLECTION</p>
        <h1>Favorites</h1>
        <p>Your liked Pokémon are stored in a Set for fast lookup and synced to localStorage.</p>
      </header>

      <section className="listing-section" aria-labelledby="favorites-page-title">
        <SectionHeading
          eyebrow="SAVED PICKS"
          title="Favorites"
          count={pokemon.length}
          sort={sort}
          onSortChange={onSortChange}
          sortLabel="Sort favorites"
          clearLabel="Clear Favorites"
          onClear={onClearFavorites}
        />
        {pokemon.length ? (
          <PokemonGrid
            pokemon={pokemon}
            idPrefix="favorite"
            favoriteIds={favoriteIds}
            onPokemonSelect={onPokemonSelect}
            onToggleFavorite={onToggleFavorite}
            recent
          />
        ) : (
          <p className="section-message">Favorite a Pokémon to save it here.</p>
        )}
      </section>
    </main>
  );
}

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  count: number;
  sort: SortOrder;
  onSortChange: (value: SortOrder) => void;
  sortLabel: string;
  clearLabel?: string;
  onClear?: () => void;
}

function SectionHeading({ eyebrow, title, count, sort, onSortChange, sortLabel, clearLabel, onClear }: SectionHeadingProps) {
  const id =
    title === "Recommended"
      ? "recommended-title"
      : title === "History"
        ? "history-page-title"
        : title === "Favorites"
          ? "favorites-page-title"
          : "recent-title";

  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <div className="heading-line">
          <h2 id={id}>{title}</h2>
          <span className="item-count">{String(count).padStart(2, "0")}</span>
        </div>
      </div>
      <div className="heading-controls">
        <label className="sort-control">
          <span>Sort by</span>
          <select value={sort} onChange={(event) => onSortChange(event.target.value as SortOrder)} aria-label={sortLabel}>
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        {clearLabel && onClear && (
          <button className="clear-list-button" type="button" onClick={onClear} disabled={count === 0}>
            {clearLabel}
          </button>
        )}
      </div>
    </div>
  );
}

interface PokemonCardProps {
  pokemon: PokemonSummary;
  index: number;
  idPrefix: string;
  isFavorite?: boolean;
  highlighted?: boolean;
  onSelect: (pokemon: PokemonSummary) => void;
  onToggleFavorite?: (pokemon: PokemonSummary) => void;
}

interface PokemonGridProps {
  pokemon: PokemonSummary[];
  idPrefix: string;
  favoriteIds: Set<number>;
  onPokemonSelect: (pokemon: PokemonSummary) => void;
  onToggleFavorite: (pokemon: PokemonSummary) => void;
  recent?: boolean;
}

function PokemonGrid({
  pokemon,
  idPrefix,
  favoriteIds,
  onPokemonSelect,
  onToggleFavorite,
  recent = false,
}: PokemonGridProps) {
  return (
    <div className={recent ? "pokemon-grid recent-grid" : "pokemon-grid"}>
      {pokemon.map((item, index) => (
        <PokemonCard
          key={item.id}
          pokemon={item}
          index={index}
          idPrefix={idPrefix}
          isFavorite={favoriteIds.has(item.id)}
          onSelect={onPokemonSelect}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  );
}

function PokemonCard({
  pokemon,
  index,
  idPrefix,
  isFavorite = false,
  highlighted = false,
  onSelect,
  onToggleFavorite,
}: PokemonCardProps) {
  return (
    <div className="pokemon-card-shell">
      <button
        id={`${idPrefix}-card-${pokemon.id}`}
        type="button"
        className={`pokemon-card ${highlighted ? "is-highlighted" : ""}`}
        onClick={() => onSelect(pokemon)}
        style={{ "--card-index": index } as React.CSSProperties}
        aria-label={`View ${formatName(pokemon.name)}, number ${pokemon.id}`}
      >
        <span className="card-number">#{String(pokemon.id).padStart(3, "0")}</span>
        <span className="card-art">
          {pokemon.image ? <img src={pokemon.image} alt="" loading="lazy" /> : <span className="image-fallback">?</span>}
        </span>
        <span className="card-meta">
          <span className="card-name">{formatName(pokemon.name)}</span>
          <span className="type-list">
            {pokemon.types.slice(0, 2).map((type) => (
              <span className={`type-tag type-${type}`} key={type}>{type}</span>
            ))}
          </span>
        </span>
        <span className="card-arrow" aria-hidden="true">↗</span>
      </button>
      {onToggleFavorite && (
        <button
          type="button"
          className={`favorite-toggle ${isFavorite ? "is-favorite" : ""}`}
          aria-label={isFavorite ? `Remove ${formatName(pokemon.name)} from favorites` : `Add ${formatName(pokemon.name)} to favorites`}
          aria-pressed={isFavorite}
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite(pokemon);
          }}
        >
          {isFavorite ? "❤️" : "🤍"}
        </button>
      )}
    </div>
  );
}
