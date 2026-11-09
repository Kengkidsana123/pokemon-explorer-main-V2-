import type { Pokemon, PokemonFamily, PokemonSummary, SortOrder } from "./types";

export const FEATURED_NAMES = [
  "pikachu",
  "mewtwo",
  "kyogre",
  "groudon",
  "rayquaza",
  "giratina-altered",
  "arceus",
  "bulbasaur",
  "charmander",
  "squirtle",
  "treecko",
  "froakie",
  "torchic",
  "mudkip",
  "chikorita",
  "cyndaquil",
  "totodile",
  "turtwig",
  "chimchar",
  "piplup",
];

export const HISTORY_LIMIT = 10;
const HISTORY_STORAGE_KEY = "pokemonExplorer.recentlyViewed";
const FAVORITES_STORAGE_KEY = "pokemonExplorer.favorites";
const pokemonRequests = new Map<string, Promise<Pokemon>>();
const familyRequests = new Map<string, Promise<PokemonFamily>>();
let pokemonNamesRequest: Promise<string[]> | undefined;

export function fetchPokemonNames(): Promise<string[]> {
  if (!pokemonNamesRequest) {
    pokemonNamesRequest = fetch("/api/pokemon/names")
      .then(async (response) => {
        const data: unknown = await response.json();
        if (!response.ok || !Array.isArray(data)) {
          throw new Error("Could not load Pokémon names");
        }
        return data.filter((name): name is string => typeof name === "string");
      })
      .catch((error: unknown) => {
        pokemonNamesRequest = undefined;
        throw error;
      });
  }

  return pokemonNamesRequest;
}

export function findPokemonMatches(query: string, names: string[], limit = 7): string[] {
  const normalized = query.trim().toLowerCase().replace(/^#/, "");
  if (!normalized) return [];

  const matches = names.flatMap((name) => {
    const candidate = name.toLowerCase();
    const distance = levenshtein(normalized, candidate);
    const score = candidate.startsWith(normalized)
      ? 0
      : candidate.includes(normalized)
        ? 1
        : distance + 2;
    const maxDistance = Math.max(2, Math.floor(normalized.length * 0.35));
    return score < 2 || distance <= maxDistance ? [{ name, score, distance }] : [];
  });

  return matches
    .sort((first, second) => first.score - second.score || first.distance - second.distance || first.name.localeCompare(second.name))
    .slice(0, limit)
    .map((match) => match.name);
}

export function fetchPokemon(name: string): Promise<Pokemon> {
  const query = name.trim().toLowerCase().replace(/^#/, "");
  const existing = pokemonRequests.get(query);
  if (existing) return existing;

  const request = (async () => {
    const response = await fetch(`/api/pokemon?search=${encodeURIComponent(query)}`);
    const data: unknown = await response.json();

    if (!response.ok) {
      throw new Error(getErrorMessage(data, "ไม่พบโปเกมอนตัวนี้"));
    }

    if (!isPokemon(data)) throw new Error("ได้รับข้อมูล Pokémon ที่ไม่ถูกต้อง");
    return data;
  })();

  pokemonRequests.set(query, request);
  void request.catch(() => pokemonRequests.delete(query));
  return request;
}

export function fetchFamily(name: string): Promise<PokemonFamily> {
  const query = name.trim().toLowerCase();
  const existing = familyRequests.get(query);
  if (existing) return existing;

  const request = (async () => {
    const response = await fetch(`/api/pokemon/${encodeURIComponent(query)}/family`);
    const data: unknown = await response.json();

    if (!response.ok) {
      throw new Error(getErrorMessage(data, "โหลดข้อมูลสายวิวัฒนาการไม่ได้"));
    }

    if (!isPokemonFamily(data)) throw new Error("ได้รับข้อมูลสายวิวัฒนาการที่ไม่ถูกต้อง");
    return data;
  })();

  familyRequests.set(query, request);
  void request.catch(() => familyRequests.delete(query));
  return request;
}

export function readHistory(): PokemonSummary[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(stored)) return [];

    const stack: PokemonSummary[] = [];
    for (const item of stored) {
      if (!isPokemonSummary(item)) continue;
      const previousIndex = stack.findIndex((pokemon) => pokemon.id === item.id);
      if (previousIndex !== -1) stack.splice(previousIndex, 1);
      stack.push(item);
    }

    return stack.slice(-HISTORY_LIMIT);
  } catch {
    return [];
  }
}

export function saveHistory(stack: PokemonSummary[]): void {
  try {
    if (stack.length) localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(stack));
    else localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch {
    // History remains usable for the current session when storage is unavailable.
  }
}

export function readFavorites(): Set<number> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(stored)) return new Set();

    return new Set(
      stored.filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
    );
  } catch {
    return new Set();
  }
}

export function saveFavorites(favoriteIds: Set<number>): void {
  try {
    if (favoriteIds.size) localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...favoriteIds]));
    else localStorage.removeItem(FAVORITES_STORAGE_KEY);
  } catch {
    // Favorites remain usable for the current session when storage is unavailable.
  }
}

export function pushHistory(
  stack: PokemonSummary[],
  pokemon: PokemonSummary,
): PokemonSummary[] {
  return [
    ...stack.filter((item) => item.id !== pokemon.id),
    pokemon,
  ].slice(-HISTORY_LIMIT);
}

export function sortPokemon(
  items: PokemonSummary[],
  order: SortOrder,
  isStack: boolean,
): PokemonSummary[] {
  if (order === "newest") return isStack ? [...items].reverse() : [...items];
  if (order === "oldest") return isStack ? [...items] : [...items].reverse();

  return [...items].sort((first, second) => {
    if (order === "id") return first.id - second.id;
    const byName = first.name.localeCompare(second.name);
    return order === "name-desc" ? -byName : byName;
  });
}

export function formatName(name: string): string {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isPokemonSummary(value: unknown): value is PokemonSummary {
  if (typeof value !== "object" || value === null) return false;
  const pokemon = value as Partial<PokemonSummary>;
  return (
    Number.isInteger(pokemon.id) &&
    typeof pokemon.name === "string" && pokemon.name.length > 0 &&
    (typeof pokemon.image === "string" || pokemon.image === null) &&
    Array.isArray(pokemon.types) &&
    pokemon.types.every((type) => typeof type === "string")
  );
}

function isPokemon(value: unknown): value is Pokemon {
  if (typeof value !== "object" || value === null || !isPokemonSummary(value)) return false;
  const pokemon = value as Partial<Pokemon>;
  const stats = pokemon.stats;
  return (
    Number.isFinite(pokemon.height) &&
    Number.isFinite(pokemon.weight) &&
    (typeof pokemon.cry === "string" || pokemon.cry === null) &&
    typeof stats === "object" && stats !== null &&
    [stats.hp, stats.attack, stats.defense, stats.specialAttack, stats.specialDefense, stats.speed]
      .every(Number.isFinite)
  );
}

function isPokemonFamily(value: unknown): value is PokemonFamily {
  if (typeof value !== "object" || value === null) return false;
  const family = value as Partial<PokemonFamily>;
  return (
    Array.isArray(family.evolution) && family.evolution.every(isPokemonSummary) &&
    (family.evolutionStages === undefined || (
      Array.isArray(family.evolutionStages) &&
      family.evolutionStages.every((stage) => Array.isArray(stage) && stage.every(isPokemonSummary))
    )) &&
    Array.isArray(family.forms) && family.forms.every(isPokemonSummary) &&
    (family.weaknesses === undefined || (
      Array.isArray(family.weaknesses) &&
      family.weaknesses.every((weakness) => (
        typeof weakness?.type === "string" && Number.isFinite(weakness.multiplier) && weakness.multiplier > 0
      ))
    ))
  );
}

function getErrorMessage(data: unknown, fallback: string): string {
  if (typeof data === "object" && data !== null && "error" in data) {
    const error = data.error;
    if (typeof error === "string") return error;
  }
  return fallback;
}

function levenshtein(first: string, second: string): number {
  let previous = Array.from({ length: second.length + 1 }, (_, index) => index);

  for (let row = 1; row <= first.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= second.length; column += 1) {
      const substitutionCost = first[row - 1] === second[column - 1] ? 0 : 1;
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + substitutionCost,
      );
    }
    previous = current;
  }

  return previous[second.length];
}