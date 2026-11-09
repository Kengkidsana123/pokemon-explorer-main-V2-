/* =========================
   FEATURED POKEMON
========================= */

const featuredPokemon = [

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
    "piplup"

];


/* =========================
   STACK
========================= */

// Stack = Last In First Out
const recentlyViewed = [];


/* =========================
   ELEMENTS
========================= */

const featuredContainer =
    document.getElementById("featuredContainer");

const pokemonDetail =
    document.getElementById("pokemonDetail");

const evolutionContainer =
    document.getElementById("evolutionContainer");

const formsSection =
    document.getElementById("formsSection");

const formsContainer =
    document.getElementById("formsContainer");

const recentContainer =
    document.getElementById("recentContainer");

const searchInput =
    document.getElementById("searchInput");

const searchButton =
    document.getElementById("searchButton");

const searchMessage =
    document.getElementById("searchMessage");

const sortSelect =
    document.getElementById("sortSelect");

const darkModeButton =
    document.getElementById("darkModeButton");


/* =========================
   GET POKEMON
========================= */

async function getPokemon(name) {

    const response = await fetch(
        `/api/pokemon?search=${encodeURIComponent(name)}`
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.error || "ไม่พบ Pokémon"
        );
    }

    return data;
}


/* =========================
   LOAD FEATURED
========================= */

async function loadFeaturedPokemon() {

    featuredContainer.innerHTML =
        `<p class="loading">Loading Pokémon...</p>`;

    try {

        const pokemonList =
            await Promise.all(
                featuredPokemon.map(name =>
                    getPokemon(name)
                )
            );

        featuredContainer.innerHTML =
            pokemonList
                .map(pokemon =>
                    createFeaturedCard(pokemon)
                )
                .join("");

    } catch (error) {

        featuredContainer.innerHTML =
            `<p class="empty-message">
                Failed to load Pokémon.
            </p>`;

        console.error(error);
    }
}


/* =========================
   FEATURED CARD
========================= */

function createFeaturedCard(pokemon) {

    return `

        <div
            class="featured-card"
            onclick="selectPokemon('${pokemon.name}')"
        >

            <img
                src="${pokemon.image}"
                alt="${pokemon.name}"
            >

            <h3>
                ${formatName(pokemon.name)}
            </h3>

            <p>
                #${pokemon.id}
            </p>

        </div>

    `;
}


/* =========================
   SELECT POKEMON
========================= */

async function selectPokemon(name) {

    await searchPokemon(name);

    setTimeout(() => {

        document
            .querySelector(".detail-section")
            .scrollIntoView({
                behavior: "smooth"
            });

    }, 100);
}


/* =========================
   SEARCH
========================= */

async function searchPokemon(name) {

    if (!name) return;

    searchMessage.textContent = "";

    pokemonDetail.innerHTML =
        `<p class="loading">
            Loading Pokémon...
        </p>`;

    evolutionContainer.innerHTML =
        `<p class="loading">
            Loading Evolution...
        </p>`;

    formsSection.classList.add("hidden");


    try {

        const pokemon =
            await getPokemon(name);

        displayPokemon(pokemon);

        addToStack(pokemon);

        await loadFamily(pokemon.name);

        searchInput.value = "";

    } catch (error) {

        pokemonDetail.innerHTML =
            `<p class="empty-message">
                Pokémon not found.
            </p>`;

        evolutionContainer.innerHTML = "";

        searchMessage.textContent =
            error.message;

        console.error(error);
    }
}


/* =========================
   DISPLAY DETAIL
========================= */

function displayPokemon(pokemon) {

    const typeHTML =
        pokemon.types
            .map(type =>
                `<span class="type">
                    ${formatName(type)}
                </span>`
            )
            .join("");


    pokemonDetail.innerHTML = `

        <div class="detail-content">

            <div class="detail-image">

                <img
                    src="${pokemon.image}"
                    alt="${pokemon.name}"
                >

            </div>


            <div class="detail-info">

                <p class="pokemon-number">
                    #${pokemon.id}
                </p>

                <h2>
                    ${formatName(pokemon.name)}
                </h2>


                <div class="type-container">

                    ${typeHTML}

                </div>


                <div class="stats-grid">

                    <div class="stat">
                        <span>HP</span>
                        <span>
                            ${pokemon.stats.hp}
                        </span>
                    </div>

                    <div class="stat">
                        <span>Attack</span>
                        <span>
                            ${pokemon.stats.attack}
                        </span>
                    </div>

                    <div class="stat">
                        <span>Defense</span>
                        <span>
                            ${pokemon.stats.defense}
                        </span>
                    </div>

                    <div class="stat">
                        <span>Sp. Attack</span>
                        <span>
                            ${pokemon.stats.specialAttack}
                        </span>
                    </div>

                    <div class="stat">
                        <span>Sp. Defense</span>
                        <span>
                            ${pokemon.stats.specialDefense}
                        </span>
                    </div>

                    <div class="stat">
                        <span>Speed</span>
                        <span>
                            ${pokemon.stats.speed}
                        </span>
                    </div>

                </div>

            </div>

        </div>

    `;
}


/* =========================
   LOAD EVOLUTION + FORMS
========================= */

async function loadFamily(name) {

    try {

        const response =
            await fetch(
                `/api/pokemon/${encodeURIComponent(name)}/family`
            );

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "โหลดข้อมูลไม่ได้"
            );
        }


        /* =========================
           EVOLUTION
        ========================== */

        if (
            data.evolution &&
            data.evolution.length > 0
        ) {

            evolutionContainer.innerHTML =
                data.evolution
                    .map((pokemon, index) => {

                        const card = `

                            <div
                                class="evolution-card"
                                onclick="selectPokemon('${pokemon.name}')"
                            >

                                <img
                                    src="${pokemon.image}"
                                    alt="${pokemon.name}"
                                >

                                <h3>
                                    ${formatName(pokemon.name)}
                                </h3>

                                <p>
                                    #${pokemon.id}
                                </p>

                            </div>

                        `;

                        const arrow =
                            index <
                            data.evolution.length - 1
                                ? `<div class="evolution-arrow">
                                    →
                                   </div>`
                                : "";

                        return card + arrow;

                    })
                    .join("");

        } else {

            evolutionContainer.innerHTML =
                `<p class="empty-message">
                    No evolution data.
                </p>`;
        }


        /* =========================
           FORMS
        ========================== */

        if (
            data.forms &&
            data.forms.length > 1
        ) {

            formsSection.classList.remove(
                "hidden"
            );

            formsContainer.innerHTML =
                data.forms
                    .map(form => `

                        <div
                            class="form-card"
                            onclick="selectPokemon('${form.name}')"
                        >

                            <img
                                src="${form.image}"
                                alt="${form.name}"
                            >

                            <h3>
                                ${formatFormName(form.name)}
                            </h3>

                            <p>
                                #${form.id}
                            </p>

                        </div>

                    `)
                    .join("");

        } else {

            formsSection.classList.add(
                "hidden"
            );

            formsContainer.innerHTML = "";
        }


    } catch (error) {

        console.error(
            "Family error:",
            error
        );

        evolutionContainer.innerHTML =
            `<p class="empty-message">
                Could not load evolution data.
            </p>`;
    }
}


/* =========================
   STACK
========================= */

function addToStack(pokemon) {

    // Remove duplicate
    const existingIndex =
        recentlyViewed.findIndex(
            item => item.id === pokemon.id
        );

    if (existingIndex !== -1) {

        recentlyViewed.splice(
            existingIndex,
            1
        );
    }


    // Push new item onto stack
    recentlyViewed.push(pokemon);


    // Keep maximum 5 items
    if (recentlyViewed.length > 5) {

        // Remove oldest item
        recentlyViewed.shift();

    }


    displayRecentlyViewed();
}


/* =========================
   DISPLAY STACK
========================= */

function displayRecentlyViewed() {

    // Reverse for LIFO display
    const reversedStack =
        [...recentlyViewed].reverse();


    if (reversedStack.length === 0) {

        recentContainer.innerHTML =
            `<p class="empty-message">
                No Pokémon viewed yet.
            </p>`;

        return;
    }


    recentContainer.innerHTML =
        reversedStack
            .map(pokemon => `

                <div
                    class="recent-card"
                    onclick="selectPokemon('${pokemon.name}')"
                >

                    <img
                        src="${pokemon.image}"
                        alt="${pokemon.name}"
                    >

                    <h3>
                        ${formatName(pokemon.name)}
                    </h3>

                    <p>
                        #${pokemon.id}
                    </p>

                </div>

            `)
            .join("");
}


/* =========================
   SORT
========================= */

function sortPokemonList() {

    const sortType =
        sortSelect.value;


    recentlyViewed.sort(
        (a, b) => {

            switch (sortType) {

                case "id":
                    return a.id - b.id;


                case "name":
                    return a.name.localeCompare(
                        b.name
                    );


                case "hp":
                    return (
                        b.stats.hp -
                        a.stats.hp
                    );


                case "attack":
                    return (
                        b.stats.attack -
                        a.stats.attack
                    );


                case "defense":
                    return (
                        b.stats.defense -
                        a.stats.defense
                    );


                case "speed":
                    return (
                        b.stats.speed -
                        a.stats.speed
                    );


                default:
                    return 0;
            }

        }
    );


    displayRecentlyViewed();
}


/* =========================
   FORMAT NAME
========================= */

function formatName(name) {

    return name
        .split("-")
        .map(word =>
            word.charAt(0).toUpperCase() +
            word.slice(1)
        )
        .join(" ");
}


/* =========================
   FORM NAME
========================= */

function formatFormName(name) {

    return name
        .split("-")
        .map(word =>
            word.charAt(0).toUpperCase() +
            word.slice(1)
        )
        .join(" ");
}


/* =========================
   SEARCH BUTTON
========================= */

searchButton.addEventListener(
    "click",
    () => {

        const name =
            searchInput.value
                .trim()
                .toLowerCase();

        if (name) {
            searchPokemon(name);
        }

    }
);


/* =========================
   ENTER SEARCH
========================= */

searchInput.addEventListener(
    "keydown",
    event => {

        if (event.key === "Enter") {

            const name =
                searchInput.value
                    .trim()
                    .toLowerCase();

            if (name) {
                searchPokemon(name);
            }

        }

    }
);


/* =========================
   SORT EVENT
========================= */

sortSelect.addEventListener(
    "change",
    sortPokemonList
);


/* =========================
   DARK MODE
========================= */

function updateDarkModeButton() {

    const isDark =
        document.body.classList.contains("dark");

    darkModeButton.querySelector(".theme-icon").textContent =
        isDark ? "🌙" : "☀️";

    darkModeButton.querySelector(".theme-label").textContent =
        isDark ? "โหมดกลางคืน" : "โหมดกลางวัน";

    darkModeButton.setAttribute(
        "aria-label",
        isDark ? "เปลี่ยนเป็นโหมดกลางวัน" : "เปลี่ยนเป็นโหมดกลางคืน"
    );

    darkModeButton.setAttribute(
        "aria-pressed",
        String(isDark)
    );
}


darkModeButton.addEventListener(
    "click",
    () => {

        document.body.classList.toggle(
            "dark"
        );


        const isDark =
            document.body.classList.contains(
                "dark"
            );


        localStorage.setItem(
            "darkMode",
            isDark
                ? "true"
                : "false"
        );


        updateDarkModeButton();

    }
);


/* =========================
   LOAD DARK MODE
========================= */

if (
    localStorage.getItem("darkMode") ===
    "true"
) {

    document.body.classList.add("dark");

}

updateDarkModeButton();


/* =========================
   START
========================= */

loadFeaturedPokemon();

searchPokemon("pikachu");