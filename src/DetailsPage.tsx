import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fetchFamily, fetchPokemon, formatName } from "./pokemon";
import type { Pokemon, PokemonFamily, PokemonSummary } from "./types";

const STAT_FIELDS = [
  { key: "hp", label: "HP" },
  { key: "attack", label: "Attack" },
  { key: "defense", label: "Defense" },
  { key: "specialAttack", label: "Sp. Attack" },
  { key: "specialDefense", label: "Sp. Defense" },
  { key: "speed", label: "Speed" },
] as const;

interface DetailsPageProps {
  onRecord: (pokemon: PokemonSummary) => void;
  favoriteIds: Set<number>;
  onToggleFavorite: (pokemon: PokemonSummary) => void;
}

export function DetailsPage({ onRecord, favoriteIds, onToggleFavorite }: DetailsPageProps) {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [pokemon, setPokemon] = useState<Pokemon | null>(null);
  const [family, setFamily] = useState<PokemonFamily | null>(null);
  const [loading, setLoading] = useState(true);
  const [familyLoading, setFamilyLoading] = useState(true);
  const [error, setError] = useState("");

  const totalStats = useMemo(
    () => pokemon ? Object.values(pokemon.stats).reduce((total, value) => total + value, 0) : 0,
    [pokemon],
  );
  const isFavorite = pokemon ? favoriteIds.has(pokemon.id) : false;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setPokemon(null);
    setFamily(null);
    setFamilyLoading(true);
    window.scrollTo({ top: 0, behavior: "smooth" });

    fetchPokemon(id)
      .then((result) => {
        if (!active) return;
        setPokemon(result);
        onRecord(result);
        setLoading(false);
        return fetchFamily(result.name)
          .then((resultFamily) => { if (active) setFamily(resultFamily); })
          .catch(() => { if (active) setFamily(null); })
          .finally(() => { if (active) setFamilyLoading(false); });
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Could not load this Pokémon");
        setLoading(false);
      });

    return () => { active = false; };
  }, [id, onRecord]);

  function openPokemon(member: PokemonSummary) {
    onRecord(member);
    navigate(`/pokemon/${member.id}`);
  }

  if (loading) {
    return <main className="route-shell"><p className="section-message">Loading Pokémon profile...</p></main>;
  }

  if (error || !pokemon) {
    return (
      <main className="route-shell route-empty">
        <p className="eyebrow">NO MATCH FOUND</p>
        <h1>That Pokémon is out of sight.</h1>
        <p>{error || "Try another name or Pokédex number."}</p>
        <Link className="text-link" to="/">Back to discovery <span aria-hidden="true">↗</span></Link>
      </main>
    );
  }

  const stages = family?.evolutionStages?.length
    ? family.evolutionStages
    : family?.evolution.length ? [family.evolution] : [];

  return (
    <main className="route-shell detail-page">
      <Link className="back-link" to="/">← Back to discovery</Link>
      <header className="profile-hero">
        <div className="profile-art">
          {pokemon.image && <img src={pokemon.image} alt={formatName(pokemon.name)} />}
          <span className="profile-number">#{String(pokemon.id).padStart(3, "0")}</span>
        </div>
        <div className="profile-intro">
          <p className="eyebrow">POKÉDEX PROFILE / #{String(pokemon.id).padStart(3, "0")}</p>
          <h1>{formatName(pokemon.name)}</h1>
          <div className="type-list detail-types">
            {pokemon.types.map((type) => <span className={`type-tag type-${type}`} key={type}>{type}</span>)}
          </div>
          <div className="detail-actions">
            <button
              type="button"
              className={`favorite-toggle-page ${isFavorite ? "is-favorite" : ""}`}
              aria-pressed={isFavorite}
              onClick={() => onToggleFavorite(pokemon)}
            >
              {isFavorite ? "❤️ Remove favorite" : "🤍 Save to favorites"}
            </button>
          </div>
          <p className="measurements">Height {pokemon.height / 10} m <span /> Weight {pokemon.weight / 10} kg</p>
          <div className="profile-summary">
            <span><strong>{totalStats}</strong> Total base stats</span>
            <span><strong>{family?.weaknesses?.length ?? 0}</strong> Type weaknesses</span>
          </div>
        </div>
      </header>

      <section className="route-section" aria-labelledby="base-stats-title">
        <div className="route-section-heading">
          <div><p className="eyebrow">BUILT DIFFERENT</p><h2 id="base-stats-title">Base stats</h2></div>
          <span className="total-score">BST <strong>{totalStats}</strong></span>
        </div>
        <div className="base-stat-chart">
          {STAT_FIELDS.map(({ key, label }) => {
            const value = pokemon.stats[key];
            return (
              <div className="base-stat-row" key={key}>
                <span>{label}</span>
                <div className="base-stat-track"><span style={{ width: `${Math.min(value / 255 * 100, 100)}%` }} /></div>
                <strong>{value}</strong>
              </div>
            );
          })}
        </div>
      </section>

      <section className="route-section" aria-labelledby="evolution-title">
        <div className="route-section-heading">
          <div><p className="eyebrow">GROWTH & CHANGE</p><h2 id="evolution-title">Evolution chain</h2></div>
        </div>
        {familyLoading ? <p className="section-message">Tracing the evolution chain...</p> : stages.length ? (
          <div className="evolution-stages">
            {stages.map((stage, index) => (
              <div className="evolution-stage-wrap" key={`stage-${index}`}>
                <div className="evolution-stage">
                  <p>STAGE {index + 1}</p>
                  <div>
                    {stage.map((member) => (
                      <button
                        type="button"
                        className={`stage-pokemon ${member.id === pokemon.id ? "is-current" : ""}`}
                        key={`${member.id}-${member.name}`}
                        onClick={() => openPokemon(member)}
                      >
                        {member.image && <img src={member.image} alt="" loading="lazy" />}
                        <span>{formatName(member.name)}</span>
                        <small>#{String(member.id).padStart(3, "0")}</small>
                      </button>
                    ))}
                  </div>
                </div>
                {index < stages.length - 1 && <span className="stage-arrow" aria-hidden="true">→</span>}
              </div>
            ))}
          </div>
        ) : <p className="section-message">Evolution information is unavailable.</p>}
      </section>

      <section className="route-section" aria-labelledby="weakness-title">
        <div className="route-section-heading">
          <div><p className="eyebrow">KNOW THE MATCHUP</p><h2 id="weakness-title">Type weaknesses</h2></div>
        </div>
        {familyLoading ? <p className="section-message">Checking type matchups...</p> : family?.weaknesses?.length ? (
          <div className="weakness-list">
            {family.weaknesses.map(({ type, multiplier }) => (
              <span className={`weakness-item type-${type}`} key={type}>
                <strong>{formatName(type)}</strong><small>{multiplier}× damage</small>
              </span>
            ))}
          </div>
        ) : <p className="section-message">No weaknesses data available.</p>}
      </section>
    </main>
  );
}