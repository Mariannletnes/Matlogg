// Konstanter og konfigurasjon[cite: 1]
const MATVARE_URL = "https://www.matvaretabellen.no/api/nb/foods.json";
let foodsCache = [];
let rowsState = [];

// Enhetskonvertering til gram[cite: 1]
const unitToGrams = {
    "g": 1, "gram": 1, "kg": 1000, "dl": 100, "l": 1000,
    "ts": 5, "ss": 13, "stk": 100, "egg": 60, "eple": 180,
    "banan": 120, "potet": 150, "hodekål": 900
};

/**
 * Steg 1: Parsing av tekstlinje
 * Tolker formatet "mengde enhet ingrediens"
 */
function parseLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return null;

    // Regex for å fange tall (også med komma), enhet og navn
    const regex = /^(\d+(?:[.,]\d+)?)\s*([a-zA-ZæøåÆØÅ]*)\s*(.*)$/i;
    const match = trimmed.match(regex);

    if (match) {
        let amount = parseFloat(match[1].replace(",", "."));
        let unit = match[2].toLowerCase();
        let ingredient = match[3].trim().toLowerCase();

        // Hvis enhet mangler, men er en kjent matvare (f.eks. "2 egg")
        if (!unit && unitToGrams[ingredient]) {
            unit = ingredient;
        }

        const grams = (unitToGrams[unit] || 1) * amount;

        return {
            originalLine: trimmed,
            ingredient: ingredient || unit, 
            grams: grams,
            searchTerm: ingredient || unit
        };
    }
    return null;
}

/**
 * Steg 2: Hente data fra Matvaretabellen
 * Inkluderer feilhåndtering for CORS/Nettverk[cite: 1]
 */
async function loadFoods() {
    if (foodsCache.length > 0) return foodsCache;
    try {
        const response = await fetch(MATVARE_URL);
        const data = await response.json();
        // API-et returnerer ofte en liste direkte eller i et 'foods' felt
        foodsCache = Array.isArray(data) ? data : (data.foods || []);
        return foodsCache;
    } catch (error) {
        console.error("Kunne ikke laste matvaredata:", error);
        return []; // Returnerer tom liste ved feil
    }
}

/**
 * Steg 3: Beregning av makronæringsstoffer
 * Regner ut verdier basert på mengde i gram[cite: 1]
 */
function calculateMacros(row) {
    if (!row.selectedOption) return { kcal: 0, protein: 0, carbs: 0, fat: 0 };

    const factor = row.grams / 100; // API-data er per 100g
    const m = row.selectedOption.macros;

    return {
        kcal: (m.kcal || 0) * factor,
        protein: (m.protein || 0) * factor,
        carbs: (m.carbs || 0) * factor,
        fat: (m.fat || 0) * factor
    };
}

/**
 * Steg 4: Oppdatering av brukergrensesnitt (UI)
 */
function renderTable() {
    const tbody = document.getElementById("resultsBody");
    tbody.innerHTML = "";

    rowsState.forEach(row => {
        const macros = calculateMacros(row);
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${row.originalLine}</td>
            <td>${row.ingredient}</td>
            <td>${Math.round(row.grams)}g</td>
            <td>${row.selectedOption ? Math.round(macros.kcal) : '-'}</td>
            <td><span class="badge ${row.selectedOption ? 'ok' : 'waiting'}">
                ${row.selectedOption ? 'Valgt' : 'Venter'}
            </span></td>
        `;
        tbody.appendChild(tr);
    });
    updateTotals();
}

// Event Listeners for knappene i HTML-en din
document.getElementById("parseBtn").addEventListener("click", async () => {
    const text = document.getElementById("recipeInput").value;
    const lines = text.split("\n").filter(l => l.trim() !== "");
    
    await loadFoods(); // Sikre at data er lastet

    rowsState = lines.map(line => {
        const parsed = parseLine(line);
        if (!parsed) return null;
        
        // Enkel søkelogikk: finn første matvare som inneholder navnet
        const match = foodsCache.find(f => 
            f.foodName.toLowerCase().includes(parsed.searchTerm)
        );

        return {
            ...parsed,
            selectedOption: match ? {
                name: match.foodName,
                macros: {
                    kcal: extractMacros(match).kcal,
                    protein: extractMacros(match).protein,
                    carbs: extractMacros(match).carbs,
                    fat: extractMacros(match).fat
                }
            } : null
        };
    }).filter(r => r !== null);

    renderTable();
});
