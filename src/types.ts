export interface PokemonSummary {
  id: number;
  name: string;
  image: string | null;
  types: string[];
}

export interface Pokemon extends PokemonSummary {
  height: number;
  weight: number;
  cry: string | null;
  stats: {
    hp: number;
    attack: number;
    defense: number;
    specialAttack: number;
    specialDefense: number;
    speed: number;
  };
}

export interface PokemonFamily {
  evolution: PokemonSummary[];
  evolutionStages?: PokemonSummary[][];
  forms: PokemonSummary[];
  weaknesses?: { type: string; multiplier: number }[];
}

export type SortOrder = "newest" | "oldest" | "id" | "name-asc" | "name-desc";