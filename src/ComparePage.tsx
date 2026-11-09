import { useState } from "react";
import { PokemonSearchBox } from "./PokemonSearchBox";
import { formatName, fetchPokemon } from "./pokemon";
import type { Pokemon } from "./types";

const COMPARE_STATS = [
  { key: "hp", label: "HP" },
  { key: "attack", label: "Attack" },
  { key: "defense", label: "Defense" },
  { key: "specialAttack", label: "Sp. Attack" },
  { key: "specialDefense", label: "Sp. Defense" },
  { key: "speed", label: "Speed" },
] as const;

export function ComparePage() {
  const [leftPokemon, setLeftPokemon] = useState<Pokemon | null>(null);
  const [rightPokemon, setRightPokemon] = useState<Pokemon | null>(null);
  const [leftError, setLeftError] = useState("");
  const [rightError, setRightError] = useState("");

  async function selectPokemon(name: string, side: "left" | "right") {
    const setError = side === "left" ? setLeftError : setRightError;
    const setPokemon = side === "left" ? setLeftPokemon : setRightPokemon;
    setError("");
    try {
      setPokemon(await fetchPokemon(name));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load this Pokémon");
    }
  }

  const leftTotal = leftPokemon ? Object.values(leftPokemon.stats).reduce((sum, value) => sum + value, 0) : 0;
  const rightTotal = rightPokemon ? Object.values(rightPokemon.stats).reduce((sum, value) => sum + value, 0) : 0;

  return (
    <main className="route-shell compare-page">
      <header className="compare-intro">
        <p className="eyebrow">SIDE BY SIDE</p>
        <h1>Make the comparison.</h1>
        <p>Pick two Pokémon and see how their base stats stack up.</p>
      </header>

      <div className="compare-pickers">
        <section className="compare-picker">
          <p className="eyebrow">POKÉMON A</p>
          <PokemonSearchBox
            id="compare-search-a"
            label="Search Pokémon A"
            placeholder="Search first Pokémon"
            buttonLabel="Choose"
            compact
            onSelect={(name) => void selectPokemon(name, "left")}
          />
          {leftError && <p className="compare-error" role="alert">{leftError}</p>}
        </section>
        <span className="versus-mark" aria-hidden="true">VS</span>
        <section className="compare-picker">
          <p className="eyebrow">POKÉMON B</p>
          <PokemonSearchBox
            id="compare-search-b"
            label="Search Pokémon B"
            placeholder="Search second Pokémon"
            buttonLabel="Choose"
            compact
            onSelect={(name) => void selectPokemon(name, "right")}
          />
          {rightError && <p className="compare-error" role="alert">{rightError}</p>}
        </section>
      </div>

      <section className="comparison-results" aria-live="polite" aria-label="Pokémon comparison">
        <div className="compare-total-row">
          <CompareProfile pokemon={leftPokemon} total={leftTotal} side="a" />
          <p>Total base stats</p>
          <CompareProfile pokemon={rightPokemon} total={rightTotal} side="b" />
        </div>
        <div className="compare-chart">
          {COMPARE_STATS.map(({ key, label }) => {
            const leftValue = leftPokemon?.stats[key] ?? 0;
            const rightValue = rightPokemon?.stats[key] ?? 0;
            return (
              <div className="compare-stat-row" key={key}>
                <strong className="compare-value compare-value-a">{leftPokemon ? leftValue : "–"}</strong>
                <div className="compare-bars compare-bars-a">
                  <span className="compare-bar compare-bar-a" style={{ width: `${leftPokemon ? leftValue / 255 * 100 : 0}%` }} />
                </div>
                <span className="compare-stat-label">{label}</span>
                <div className="compare-bars compare-bars-b">
                  <span className="compare-bar compare-bar-b" style={{ width: `${rightPokemon ? rightValue / 255 * 100 : 0}%` }} />
                </div>
                <strong className="compare-value compare-value-b">{rightPokemon ? rightValue : "–"}</strong>
              </div>
            );
          })}
        </div>
        {(!leftPokemon || !rightPokemon) && <p className="compare-prompt">Choose both Pokémon to complete the comparison.</p>}
      </section>
      <div className="chart-legend" aria-label="Chart legend">
        <span><i className="legend-a" /> Pokémon A</span>
        <span><i className="legend-b" /> Pokémon B</span>
      </div>
    </main>
  );
}

function CompareProfile({ pokemon, total, side }: { pokemon: Pokemon | null; total: number; side: "a" | "b" }) {
  return (
    <div className={`compare-profile compare-profile-${side}`}>
      {pokemon?.image ? <img src={pokemon.image} alt="" /> : <span className="compare-profile-empty">?</span>}
      <div>
        <span>{pokemon ? `#${String(pokemon.id).padStart(3, "0")}` : "SELECT"}</span>
        <strong>{pokemon ? formatName(pokemon.name) : `Pokémon ${side.toUpperCase()}`}</strong>
        {pokemon && <small>{total} BST</small>}
      </div>
    </div>
  );
}