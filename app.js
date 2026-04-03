// 1. Konfigurasjon og en mer stabil Proxy
const PROXY_URL = "https://api.allorigins.win/raw?url=";
const MATVARE_URL = encodeURIComponent("https://www.matvaretabellen.no/api/nb/foods.json");
let foodsCache = [];
let rowsState = [];

// 2. Utvidet vekt-ordbok (inkluderer flertall)
const unitToGrams = {
    "g": 1, "gram": 1, "kg": 1000, "dl": 100, "l": 1000, "stk": 100,
    "eple": 150, "epler": 150, 
    "appelsin": 150, "appelsiner": 150, 
    "egg": 60
};

// 3. Hjelpefunksjon for å hente næringsverdier
function extractMacros(food) {
    const findNutrient = (id) => {
        if (!food.nutrients) return 0;
        const n = food.nutrients.find(nutrient => nutrient.nutrientId === id);
        return n ? n.quantity : 0;
    };

    return {
        kcal: findNutrient('Energij'),
        protein: findNutrient('Protei'),
        carbs: findNutrient('Karbo'),
        fat: findNutrient('Fett')
    };
}

// 4. Hente data fra Matvaretabellen
async function loadFoods() {
    if (foodsCache.length > 0) return;
    try {
        const response = await fetch(PROXY_URL + MATVARE_URL);
        const data = await response.json();
        foodsCache = Array.isArray(data) ? data : (data.foods || []);
        console.log(`Vellykket nedlasting: Fant ${foodsCache.length} matvarer.`);
    } catch (e) {
        console.error("Kunne ikke laste matvaredata:", e);
        alert("Klarte ikke å hente data fra Matvaretabellen. Sjekk nettkoblingen.");
    }
}

// 5. Forbedret logikk for å tolke tekstlinjene
function parseLine(line) {
    const regex = /^(\d+(?:[.,]\d+)?)\s*([a-zA-ZæøåÆØÅ]*)\s*(.*)$/i;
    const match = line.trim().match(regex);
    if (!match) return null;

    const amount = parseFloat(match[1].replace(",", "."));
    let unit = match[2].toLowerCase();
    let ingredient = match[3].trim().toLowerCase();

    // HVIS ingrediens mangler (f.eks. "1 eple"), bruker vi enheten som ingrediens.
    if (ingredient === "") {
        ingredient = unit;
    }

    // Finn vekt basert på enhet eller ingrediensnavn (f.eks "eple")
    const grams = (unitToGrams[unit] || unitToGrams[ingredient] || 1) * amount;

    return { originalLine: line, ingredient: ingredient, grams: grams };
}

// 6. Kjøres når du trykker på knappen
document.getElementById("parseBtn").addEventListener("click", async () => {
    const btn = document.getElementById("parseBtn");
    btn.textContent = "Laster data...";
    
    await loadFoods();
    
    const input = document.getElementById("recipeInput").value;
    const lines = input.split("\n").filter(l => l.trim() !== "");
    
    rowsState = lines.map(line => {
        const parsed = parseLine(line);
        if (!parsed) return null;

        // Fjerner en 's' eller 'er' på slutten for enklere søk (epler -> eple)
        let searchWord = parsed.ingredient;
        if (searchWord.endsWith("er")) searchWord = searchWord.slice(0, -2);
        else if (searchWord.endsWith("s")) searchWord = searchWord.slice(0, -1);

        const match = foodsCache.find(f => 
            f.foodName.toLowerCase().includes(searchWord)
        );

        return {
            ...parsed,
            selectedOption: match ? { name: match.foodName, macros: extractMacros(match) } : null
        };
    }).filter(r => r !== null);

    renderTable();
    btn.textContent = "Analyser oppskrift";
});

// 7. Bygger tabellen
function renderTable() {
    const tbody = document.getElementById("resultsBody");
    tbody.innerHTML = "";

    rowsState.forEach(row => {
        const factor = row.grams / 100;
        const kcal = row.selectedOption ? (row.selectedOption.macros.kcal * factor) : 0;
        
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${row.originalLine}</td>
            <td>${row.ingredient}</td>
            <td>${Math.round(row.grams)}g</td>
            <td>${row.selectedOption ? Math.round(kcal) : '-'}</td>
            <td><span class="badge ${row.selectedOption ? 'ok' : 'waiting'}">
                ${row.selectedOption ? 'Funnet' : 'Ingen treff'}
            </span></td>
        `;
        tbody.appendChild(tr);
    });
}
