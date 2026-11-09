const express = require("express");
const path = require("path");

const app = express();
const pokemonTypes = [
    "normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground",
    "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy"
];
const POKEAPI_BASE = "https://pokeapi.co/api/v2/";
const API_CACHE_TTL_MS = 5 * 60 * 1000;
const API_CACHE_LIMIT = 500;
const pokeApiCache = new Map();
const pendingPokeApiRequests = new Map();

app.use(express.static(path.join(__dirname, "dist")));
app.use(express.static(path.join(__dirname, "Public")));

app.get("/api/pokemon/names", async (req, res) => {
    try {
        const data = await getPokeApiJson("pokemon?limit=2000");
        if (!Array.isArray(data.results) || !data.results.every(item => isRecord(item) && isValidPokemonName(item.name))) {
            throw new Error("PokéAPI returned invalid Pokémon names");
        }
        res.json(data.results.map(pokemon => pokemon.name));
    } catch (error) {
        console.error(error);
        res.status(502).json({ error: "Could not load Pokémon names" });
    }
});

/* =========================
   GET BASIC POKEMON DATA
========================= */

app.get("/api/pokemon", async (req, res) => {
    try {
        const search = req.query.search === undefined ? "pikachu" : req.query.search;
        if (typeof search !== "string" || !isValidPokemonName(search.trim().toLowerCase())) {
            return res.status(400).json({ error: "ชื่อหรือหมายเลข Pokémon ไม่ถูกต้อง" });
        }

        const data = await getPokeApiJson(`pokemon/${encodeURIComponent(search.trim().toLowerCase())}`);
        res.json(formatPokemon(data));

    } catch (error) {
        console.error(error);

        res.status(error.status === 404 ? 404 : 502).json({
            error: error.status === 404 ? "ไม่พบ Pokémon ตัวนี้" : "เกิดข้อผิดพลาดในการเชื่อมต่อ API"
        });
    }
});


/* =========================
   GET EVOLUTION + FORMS
========================= */

app.get("/api/pokemon/:name/family", async (req, res) => {
    try {
        const name = req.params.name.trim().toLowerCase();
        if (!isValidPokemonName(name)) {
            return res.status(400).json({ error: "ชื่อหรือหมายเลข Pokémon ไม่ถูกต้อง" });
        }

        const pokemonData = await getPokeApiJson(`pokemon/${encodeURIComponent(name)}`);
        validatePokemonData(pokemonData);

        const speciesData = await getPokeApiJson(pokemonData.species.url);
        if (!isRecord(speciesData) || !isRecord(speciesData.evolution_chain) || typeof speciesData.evolution_chain.url !== "string") {
            throw new Error("PokéAPI returned invalid species data");
        }

        /* =========================
           EVOLUTION CHAIN
        ========================= */

        const evolutionData = await getPokeApiJson(speciesData.evolution_chain.url);
        if (!isRecord(evolutionData) || !isRecord(evolutionData.chain)) {
            throw new Error("PokéAPI returned invalid evolution data");
        }

        const evolutionNames = [];
        const evolutionStageNames = [];

        function collectEvolution(chain, stage = 0) {
            if (!isRecord(chain) || !isRecord(chain.species) || !isValidPokemonName(chain.species.name)) {
                throw new Error("PokéAPI returned an invalid evolution stage");
            }

            evolutionNames.push(chain.species.name);
            evolutionStageNames[stage] ??= [];
            evolutionStageNames[stage].push(chain.species.name);

            if (!Array.isArray(chain.evolves_to)) {
                throw new Error("PokéAPI returned invalid evolution branches");
            }
            chain.evolves_to.forEach(next => collectEvolution(next, stage + 1));
        }

        collectEvolution(evolutionData.chain);

        // Remove duplicates
        const uniqueEvolutionNames = [
            ...new Set(evolutionNames)
        ];

        const evolutionPokemon = await Promise.all(
            uniqueEvolutionNames.map(async pokemonName => {
                try {
                    const data = await getPokeApiJson(`pokemon/${encodeURIComponent(pokemonName)}`);
                    validatePokemonData(data);

                    return {
                        id: data.id,
                        name: data.name,
                        image:
                            data.sprites.other?.["official-artwork"]
                                ?.front_default ||
                            data.sprites.front_default,
                        types: data.types.map(type => type.type.name)
                    };

                } catch {
                    return null;
                }
            })
        );

        const availableEvolution = evolutionPokemon.filter(Boolean);
        const evolutionByName = new Map(
            availableEvolution.map(pokemon => [pokemon.name, pokemon])
        );
        const evolutionStages = evolutionStageNames.map(stage =>
            stage.map(name => evolutionByName.get(name)).filter(Boolean)
        );

        const damageMultipliers = new Map(
            pokemonTypes.map(type => [type, 1])
        );

        const typeResponses = await Promise.all(
            pokemonData.types.map(type =>
                getPokeApiJson(`type/${encodeURIComponent(type.type.name)}`)
                    .catch(() => null)
            )
        );

        for (const typeData of typeResponses.filter(Boolean)) {
            const relations = typeData.damage_relations;
            for (const type of relations.double_damage_from) {
                damageMultipliers.set(type.name, damageMultipliers.get(type.name) * 2);
            }
            for (const type of relations.half_damage_from) {
                damageMultipliers.set(type.name, damageMultipliers.get(type.name) * 0.5);
            }
            for (const type of relations.no_damage_from) {
                damageMultipliers.set(type.name, 0);
            }
        }

        const weaknesses = [...damageMultipliers]
            .filter(([, multiplier]) => multiplier > 1)
            .map(([type, multiplier]) => ({ type, multiplier }));

        /* =========================
           FORMS / VARIETIES
        ========================= */

        const varieties = Array.isArray(speciesData.varieties) ? speciesData.varieties : [];

        const forms = await Promise.all(
            varieties.map(async variety => {
                try {
                    if (!isRecord(variety) || !isRecord(variety.pokemon) || typeof variety.pokemon.url !== "string") return null;
                    const data = await getPokeApiJson(variety.pokemon.url);
                    validatePokemonData(data);

                    return {
                        id: data.id,
                        name: data.name,
                        image:
                            data.sprites.other?.["official-artwork"]
                                ?.front_default ||
                            data.sprites.front_default,
                        types: data.types.map(type => type.type.name)
                    };

                } catch {
                    return null;
                }
            })
        );

        res.json({
            evolution: availableEvolution,
            evolutionStages,
            forms: forms.filter(Boolean),
            weaknesses
        });

    } catch (error) {
        console.error(error);

        res.status(error.status === 404 ? 404 : 502).json({
            error: error.status === 404 ? "ไม่พบ Pokémon" : "ไม่สามารถโหลด Evolution / Forms ได้"
        });
    }
});


app.get(/^\/(?!api(?:\/|$)).*/, (req, res, next) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"), error => {
        if (error) next();
    });
});

/* =========================
   FORMAT POKEMON
========================= */

function formatPokemon(data) {
    validatePokemonData(data);
    return {
        id: data.id,

        name: data.name,

        image:
            data.sprites.other?.["official-artwork"]
                ?.front_default ||
            data.sprites.front_default,

        height: data.height,

        weight: data.weight,

        types: data.types.map(type => type.type.name),

        cry: data.cries?.latest || null,

        stats: {
            hp: data.stats[0].base_stat,
            attack: data.stats[1].base_stat,
            defense: data.stats[2].base_stat,
            specialAttack: data.stats[3].base_stat,
            specialDefense: data.stats[4].base_stat,
            speed: data.stats[5].base_stat
        }
    };
}

function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidPokemonName(value) {
    return typeof value === "string" && value.length <= 80 && /^(?:[a-z0-9]+(?:-[a-z0-9]+)*|\d+)$/.test(value);
}

function validatePokemonData(data) {
    if (
        !isRecord(data) ||
        !Number.isInteger(data.id) ||
        typeof data.name !== "string" ||
        !isRecord(data.sprites) ||
        !isRecord(data.species) ||
        typeof data.species.url !== "string" ||
        !Array.isArray(data.types) ||
        !data.types.every(item => isRecord(item) && isRecord(item.type) && typeof item.type.name === "string") ||
        !Array.isArray(data.stats) ||
        data.stats.length < 6 ||
        !data.stats.slice(0, 6).every(item => isRecord(item) && Number.isFinite(item.base_stat)) ||
        !Number.isFinite(data.height) ||
        !Number.isFinite(data.weight)
    ) {
        throw new Error("PokéAPI returned invalid Pokémon data");
    }
}

async function getPokeApiJson(pathOrUrl) {
    const url = new URL(pathOrUrl, POKEAPI_BASE);
    if (url.origin !== "https://pokeapi.co" || !url.pathname.startsWith("/api/v2/")) {
        throw new Error("Invalid PokéAPI URL");
    }

    const key = url.toString();
    const cached = pokeApiCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.data;
    if (cached) pokeApiCache.delete(key);

    const pending = pendingPokeApiRequests.get(key);
    if (pending) return pending;

    const request = fetch(key).then(async response => {
        if (!response.ok) {
            const error = new Error(`PokéAPI request failed: ${response.status}`);
            error.status = response.status;
            throw error;
        }

        const data = await response.json();
        if (!isRecord(data)) throw new Error("PokéAPI returned an invalid response");

        pokeApiCache.set(key, { data, expiresAt: Date.now() + API_CACHE_TTL_MS });
        if (pokeApiCache.size > API_CACHE_LIMIT) {
            const oldestKey = pokeApiCache.keys().next().value;
            if (oldestKey) pokeApiCache.delete(oldestKey);
        }
        return data;
    }).finally(() => pendingPokeApiRequests.delete(key));

    pendingPokeApiRequests.set(key, request);
    return request;
}

if (require.main === module) {
    const PORT = process.env.PORT || 3001;

    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
}

module.exports = app;