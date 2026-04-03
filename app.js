// 1. Konfigurasjon og Proxy for å unngå CORS-feil på GitHub[cite: 1]
const PROXY_URL = "https://corsproxy.io/?";
const MATVARE_URL = encodeURIComponent("https://www.matvaretabellen.no/api/nb/foods.json");
let foodsCache = [];
let rowsState = [];

// Standardvekter for enheter[cite: 1]
const unitToGrams = {
    "g": 1, "gram": 1, "kg": 1000, "dl": 100, "l": 1000, "stk": 100, "eple": 150, "egg": 60
};

// 2. Hjelpefunksjon for å hente næringsverdier fra Matvaretabellens format[cite: 1]
function extractMacros(food) {
    const findNutrient = (id) => {
        const n = food.nutrients.find(nutrient => nutrient.nutrientId === id);
        return n ? n.quantity : 0;
    };

    return {
        kcal: findNutrient('Energij'), // Kalorier[cite: 1]
        protein: findNutrient('Protei'), // Protein[cite: 1]
        carbs: findNutrient('Karbo'),   // Karbohydrater[cite: 1]
        fat: findNutrient('Fett')        // Fett[cite: 1]
    };
}

// 3. Hente data fra API[cite: 1]
async function loadFoods() {
    if (foodsCache.length > 0) return;
    try {
        const response = await fetch(PROXY_URL + MATVARE_URL);
        const data = await response.json();
        foodsCache = Array.isArray(data) ? data : (data.foods || []);
    } catch (e) {
        console.error("Kunne ikke laste matvaredata:", e);
    }
}

// 4. Tolke tekstlinjer (f.eks. "150 g havregryn")[cite: 1]
function parseLine(line) {
    const regex = /^(\d+(?:[.,]\d+)?)\s*([a-zA-ZæøåÆØÅ]*)\s*(.*)$/i;
    const match = line.trim().match(regex);
    if (!match) return null;

    const amount = parseFloat(match[1].replace(",", "."));
    const unit = match[2].toLowerCase();
    const ingredient = match[3].trim();
    const grams = (unitToGrams[unit] || 1) * amount;

    return { originalLine: line, ingredient, grams };
}

// 5. Hovedfunksjon som kjøres ved knappetrykk[cite: 1, 2]
document.getElementById("parseBtn").addEventListener("click", async () => {
    const btn = document.getElementById("parseBtn");
    btn.textContent = "Laster data...";
    
    await loadFoods();
    
    const input = document.getElementById("recipeInput").value;
    const lines = input.split("\n").filter(l => l.trim() !== "");
    
    rowsState = lines.map(line => {
        const parsed = parseLine(line);
        if (!parsed) return null;

        // Finn nærmeste match i matvarenavnene[cite: 1]
        const match = foodsCache.find(f => 
            f.foodName.toLowerCase().includes(parsed.ingredient.toLowerCase())
        );

        return {
            ...parsed,
            selectedOption: match ? { name: match.foodName, macros: extractMacros(match) } : null
        };
    }).filter(r => r !== null);

    renderTable();
    btn.textContent = "Analyser oppskrift";
});

// 6. Oppdatere tabellen i HTML[cite: 1, 2]
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
