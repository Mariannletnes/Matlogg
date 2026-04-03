// Vi bruker en proxy for å unngå CORS-feil på GitHub
const PROXY_URL = "https://corsproxy.io/?";
const MATVARE_URL = encodeURIComponent("https://www.matvaretabellen.no/api/nb/foods.json");
let foodsCache = [];
let rowsState = [];

const unitToGrams = {
    "g": 1, "gram": 1, "kg": 1000, "dl": 100, "l": 1000, "stk": 100, "eple": 150, "egg": 60
};

// Hjelpefunksjon for å hente ut verdier fra Matvaretabellens komplekse format
function extractMacros(food) {
    const findNutrient = (id) => {
        const n = food.nutrients.find(nutrient => nutrient.nutrientId === id);
        return n ? n.quantity : 0;
    };

    return {
        kcal: findNutrient('Energij'), // 'Energij' er ID for kJ/kcal i tabellen
        protein: findNutrient('Protei'),
        carbs: findNutrient('Karbo'),
        fat: findNutrient('Fett')
    };
}

async function loadFoods() {
    if (foodsCache.length > 0) return;
    try {
        const response = await fetch(PROXY_URL + MATVARE_URL);
        const data = await response.json();
        foodsCache = Array.isArray(data) ? data : (data.foods || []);
        console.log("Data lastet: ", foodsCache.length, "varer");
    } catch (e) {
        console.error("Kunne ikke laste data via proxy:", e);
    }
}

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

document.getElementById("parseBtn").addEventListener("click", async () => {
    const btn = document.getElementById("parseBtn");
    btn.textContent = "Laster data...";
    
    await loadFoods();
    
    const input = document.getElementById("recipeInput").value;
    const lines = input.split("\n").filter(l => l.trim() !== "");
    
    rowsState = lines.map(line => {
        const parsed = parseLine(line);
        if (!parsed) return null;

        // Finn beste match ved å sjekke om navnet inneholder søkeordet[cite: 1]
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
