const MATVARE_URL = "https://www.matvaretabellen.no/api/nb/foods.json";

let foodsCache = [];
let rowsState = [];

const exampleRecipe = `1,5 kg lammelår
1 kg poteter
1 hodekål
2 epler
300 g mager kesam`;

const fallbackDb = {
  "egg": { name: "Egg, rå", kcal: 143, protein: 13, carbs: 1.1, fat: 10.3 },
  "banan": { name: "Banan, rå", kcal: 89, protein: 1.1, carbs: 23, fat: 0.3 },
  "eple": { name: "Eple, rå", kcal: 52, protein: 0.3, carbs: 14, fat: 0.2 },
  "appelsin": { name: "Appelsin, rå", kcal: 47, protein: 0.9, carbs: 11.8, fat: 0.1 },
  "pære": { name: "Pære, rå", kcal: 57, protein: 0.4, carbs: 15, fat: 0.1 },
  "hodekål": { name: "Hodekål, rå", kcal: 25, protein: 1.3, carbs: 6, fat: 0.1 },
  "potet": { name: "Potet, rå", kcal: 77, protein: 2, carbs: 17, fat: 0.1 },
  "poteter": { name: "Potet, rå", kcal: 77, protein: 2, carbs: 17, fat: 0.1 },
  "kyllingfilet": { name: "Kyllingfilet, rå", kcal: 120, protein: 23, carbs: 0, fat: 2 },
  "laks": { name: "Laks, rå", kcal: 208, protein: 20, carbs: 0, fat: 13 },
  "oksefilet": { name: "Oksefilet, rå", kcal: 125, protein: 22, carbs: 0, fat: 4 },
  "lammelår": { name: "Lam, rå", kcal: 250, protein: 25, carbs: 0, fat: 18 },
  "lam": { name: "Lam, rå", kcal: 250, protein: 25, carbs: 0, fat: 18 },
  "mager kesam": { name: "Kesam mager", kcal: 59, protein: 10, carbs: 3.9, fat: 1 },
  "havregryn": { name: "Havregryn", kcal: 366, protein: 13, carbs: 60, fat: 7 },
  "hvetemel": { name: "Hvetemel", kcal: 340, protein: 10, carbs: 71, fat: 1.5 }
};

const unitToGrams = {
  "g": 1,
  "gram": 1,
  "kg": 1000,
  "dl": 100,
  "l": 1000,
  "ts": 5,
  "ss": 13,
  "pose": 11,
  "boks": 110,
  "egg": 60,
  "banan": 120,
  "bananer": 120,
  "eple": 180,
  "epler": 180,
  "appelsin": 180,
  "appelsiner": 180,
  "pære": 170,
  "pærer": 170,
  "hodekål": 900,
  "potet": 150,
  "poteter": 150
};

function normalizeText(text) {
  return (text || "")
    .toLowerCase()
    .trim()
    .replace(/\blunkent\b/g, "")
    .replace(/[.,]$/g, "")
    .replace(/\s+/g, " ");
}

function formatNumber(value, decimals = 1) {
  return value.toLocaleString("no-NO", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function formatInt(value) {
  return Math.round(value).toLocaleString("no-NO");
}

function getSavedMappings() {
  try {
    return JSON.parse(localStorage.getItem("matloggMappings") || "{}");
  } catch {
    return {};
  }
}

function saveMapping(query, option) {
  const map = getSavedMappings();
  map[normalizeText(query)] = option;
  localStorage.setItem("matloggMappings", JSON.stringify(map));
}

async function loadFoods() {
  if (foodsCache.length > 0) return foodsCache;

  const response = await fetch(MATVARE_URL);
  const data = await response.json();
  foodsCache = data.foods || [];
  return foodsCache;
}

function findQuantityDeep(obj, needles) {
  if (!obj || typeof obj !== "object") return null;

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    if (needles.some(needle => lowerKey.includes(needle))) {
      if (value && typeof value === "object" && typeof value.quantity === "number") {
        return value.quantity;
      }
      if (typeof value === "number") {
        return value;
      }
    }

    if (value && typeof value === "object") {
      const nested = findQuantityDeep(value, needles);
      if (nested !== null) return nested;
    }
  }

  return null;
}

function extractMacros(food) {
  return {
    kcal: findQuantityDeep(food, ["kcal", "calories", "energi"]) ?? 0,
    protein: findQuantityDeep(food, ["protein"]) ?? 0,
    carbs: findQuantityDeep(food, ["karbo", "carb"]) ?? 0,
    fat: findQuantityDeep(food, ["fett", "fat"]) ?? 0
  };
}

function buildFallbackOptions(query) {
  const normalized = normalizeText(query);
  const options = [];

  Object.entries(fallbackDb).forEach(([key, value]) => {
    if (normalized.includes(key) || key.includes(normalized)) {
      options.push({
        id: `fallback:${key}`,
        source: "fallback",
        name: value.name,
        macros: { kcal: value.kcal, protein: value.protein, carbs: value.carbs, fat: value.fat }
      });
    }
  });

  return options;
}

function scoreFood(food, query) {
  const q = normalizeText(query);
  const name = normalizeText(food.foodName || "");
  const keywords = Array.isArray(food.searchKeywords)
    ? food.searchKeywords.map(k => normalizeText(k))
    : [];

  let score = 0;

  if (name === q) score += 100;
  if (name.includes(q)) score += 60;

  const qWords = q.split(" ").filter(Boolean);
  const nameWords = name.split(" ").filter(Boolean);

  qWords.forEach(word => {
    if (nameWords.includes(word)) score += 22;
    else if (name.includes(word)) score += 10;
  });

  keywords.forEach(keyword => {
    if (keyword === q) score += 80;
    qWords.forEach(word => {
      if (keyword.includes(word) && word.length > 2) score += 8;
    });
  });

  if (name.includes("rå")) score += 12;
  if (name.includes("naturell")) score += 6;

  const banned = ["vin", "øl", "cider", "brus", "saft", "juice", "likør", "drink", "cocktail"];
  banned.forEach(word => {
    if (name.includes(word)) score -= 80;
  });

  return score;
}

function buildApiOptions(query) {
  const scored = foodsCache
    .map(food => ({
      id: `api:${food.foodName || ""}`,
      source: "api",
      name: food.foodName || "Ukjent vare",
      macros: extractMacros(food),
      score: scoreFood(food, query)
    }))
    .filter(item => item.score >= 25)
    .sort((a, b) => b.score - a.score);

  const unique = [];
  const seen = new Set();

  for (const item of scored) {
    const key = normalizeText(item.name);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
    if (unique.length === 5) break;
  }

  return unique.map(item => ({
    id: item.id,
    source: item.source,
    name: item.name,
    macros: item.macros
  }));
}

function dedupeOptions(options) {
  const unique = [];
  const seen = new Set();

  options.forEach(option => {
    const key = normalizeText(option.name);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(option);
    }
  });

  return unique;
}

function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let amount = 0;
  let unit = "";
  let ingredient = "";

  let match = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-ZæøåÆØÅ]+)\s+(.+)$/i);

  if (match) {
    amount = parseFloat(match[1].replace(",", "."));
    unit = normalizeText(match[2]);
    ingredient = normalizeText(match[3]);
  } else {
    match = trimmed.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/i);
    if (!match) return null;

    amount = parseFloat(match[1].replace(",", "."));
    ingredient = normalizeText(match[2]);

    if (unitToGrams[ingredient]) {
      unit = ingredient;
    } else {
      const words = ingredient.split(" ");
      if (words.length > 0 && unitToGrams[words[0]]) {
        unit = words[0];
      }
    }
  }

  const grams = unitToGrams[unit] ? amount * unitToGrams[unit] : amount;

  return {
    originalLine: trimmed,
    ingredient,
    grams,
    searchTerm: ingredient
  };
}

function createRowState(parsed, index) {
  return {
    id: index,
    originalLine: parsed.originalLine,
    ingredient: parsed.ingredient,
    grams: parsed.grams,
    searchTerm: parsed.searchTerm,
    options: [],
    selectedOptionId: "",
    selectedOption: null,
    status: "Venter"
  };
}

async function buildSuggestions(row) {
  await loadFoods();

  const fallbackOptions = buildFallbackOptions(row.searchTerm);
  const apiOptions = buildApiOptions(row.searchTerm);
  let options = dedupeOptions([...fallbackOptions, ...apiOptions]);

  const savedMap = getSavedMappings();
  const saved = savedMap[normalizeText(row.ingredient)];

  if (saved) {
    const existing = options.find(option => option.name === saved.name);
    if (!existing) {
      options.unshift(saved);
    }
  }

  if (options.length === 0) {
    row.status = "Ukjent";
  } else {
    row.status = "Velg forslag";
  }

  row.options = options;
  return row;
}

function findOptionById(row, optionId) {
  return row.options.find(option => option.id === optionId) || null;
}

function calculateRowMacros(row) {
  if (!row.selectedOption) {
    return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  }

  const factor = row.grams / 100;

  return {
    kcal: row.selectedOption.macros.kcal * factor,
    protein: row.selectedOption.macros.protein * factor,
    carbs: row.selectedOption.macros.carbs * factor,
    fat: row.selectedOption.macros.fat * factor
  };
}

function updateTotals() {
  const servings = Math.max(1, parseInt(document.getElementById("servings").value || "1", 10));

  let totalKcal = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let chosenCount = 0;

  rowsState.forEach(row => {
    const macros = calculateRowMacros(row);
    totalKcal += macros.kcal;
    totalProtein += macros.protein;
    totalCarbs += macros.carbs;
    totalFat += macros.fat;
    if (row.selectedOption) chosenCount += 1;
  });

  document.getElementById("totalKcal").textContent = `${formatInt(totalKcal)} kcal`;
  document.getElementById("totalProtein").textContent = `${formatNumber(totalProtein)} g`;
  document.getElementById("totalCarbs").textContent = `${formatNumber(totalCarbs)} g`;
  document.getElementById("totalFat").textContent = `${formatNumber(totalFat)} g`;

  document.getElementById("perKcal").textContent = `${formatInt(totalKcal / servings)} kcal`;
  document.getElementById("perProtein").textContent = `${formatNumber(totalProtein / servings)} g`;
  document.getElementById("perCarbs").textContent = `${formatNumber(totalCarbs / servings)} g`;
  document.getElementById("perFat").textContent = `${formatNumber(totalFat / servings)} g`;

  const statusText = document.getElementById("statusText");
  if (rowsState.length === 0) {
    statusText.textContent = "Ingen ingredienser tolket ennå.";
  } else {
    statusText.textContent = `${chosenCount} av ${rowsState.length} ingredienser er valgt.`;
  }
}

function badgeClass(status) {
  if (status === "Valgt" || status === "Lagret") return "ok";
  if (status === "Ukjent") return "unknown";
  return "waiting";
}

function renderTable() {
  const tbody = document.getElementById("resultsBody");
  tbody.innerHTML = "";

  rowsState.forEach(row => {
    const macros = calculateRowMacros(row);
    const tr = document.createElement("tr");

    const optionsHtml = ['<option value="">Velg forslag</option>']
      .concat(row.options.map(option => {
        const selected = row.selectedOptionId === option.id ? "selected" : "";
        return `<option value="${escapeHtml(option.id)}" ${selected}>${escapeHtml(option.name)}</option>`;
      }))
      .join("");

    tr.innerHTML = `
      <td>${escapeHtml(row.originalLine)}</td>
      <td>${escapeHtml(row.ingredient)}</td>
      <td>${formatInt(row.grams)}</td>
      <td>
        <input class="row-search" type="text" value="${escapeHtml(row.searchTerm)}" data-row-id="${row.id}" data-role="search">
        <button class="inline-button" type="button" data-row-id="${row.id}" data-role="search-button">Søk</button>
      </td>
      <td>
        <select class="row-select" data-row-id="${row.id}" data-role="select">
          ${optionsHtml}
        </select>
      </td>
      <td>${row.selectedOption ? escapeHtml(row.selectedOption.name) : '<small>Ingen valgt</small>'}</td>
      <td>${row.selectedOption ? formatInt(macros.kcal) : "0"}</td>
      <td>${row.selectedOption ? `${formatNumber(macros.protein)} g` : "0 g"}</td>
      <td>${row.selectedOption ? `${formatNumber(macros.carbs)} g` : "0 g"}</td>
      <td>${row.selectedOption ? `${formatNumber(macros.fat)} g` : "0 g"}</td>
      <td><span class="badge ${badgeClass(row.status)}">${escapeHtml(row.status)}</span></td>
    `;

    tbody.appendChild(tr);
  });

  updateTotals();
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function parseRecipe() {
  const text = document.getElementById("recipeInput").value;
  const lines = text.split("\n").map(line => line.trim()).filter(Boolean);

  rowsState = lines
    .map(parseLine)
    .filter(Boolean)
    .map((parsed, index) => createRowState(parsed, index));

  for (const row of rowsState) {
    await buildSuggestions(row);

    const savedMap = getSavedMappings();
    const saved = savedMap[normalizeText(row.ingredient)];

    if (saved) {
      const hit = row.options.find(option => option.name === saved.name);
      if (hit) {
        row.selectedOption = hit;
        row.selectedOptionId = hit.id;
        row.status = "Lagret";
      }
    }
  }

  renderTable();
}

async function rerunSearch(rowId) {
  const row = rowsState.find(item => item.id === rowId);
  if (!row) return;

  await buildSuggestions(row);
  row.selectedOption = null;
  row.selectedOptionId = "";
  if (row.options.length > 0) {
    row.status = "Velg forslag";
  }

  renderTable();
}

function selectOption(rowId, optionId) {
  const row = rowsState.find(item => item.id === rowId);
  if (!row) return;

  row.selectedOptionId = optionId;
  row.selectedOption = findOptionById(row, optionId);

  if (row.selectedOption) {
    row.status = "Valgt";
    saveMapping(row.ingredient, row.selectedOption);
  } else if (row.options.length === 0) {
    row.status = "Ukjent";
  } else {
    row.status = "Velg forslag";
  }

  renderTable();
}

document.getElementById("parseBtn").addEventListener("click", parseRecipe);

document.getElementById("exampleBtn").addEventListener("click", () => {
  document.getElementById("recipeName").value = "Testoppskrift";
  document.getElementById("servings").value = 6;
  document.getElementById("recipeInput").value = exampleRecipe;
  parseRecipe();
});

document.getElementById("clearBtn").addEventListener("click", () => {
  document.getElementById("recipeName").value = "";
  document.getElementById("servings").value = 1;
  document.getElementById("recipeInput").value = "";
  rowsState = [];
  renderTable();
});

document.getElementById("servings").addEventListener("input", updateTotals);

document.getElementById("resultsBody").addEventListener("input", event => {
  const role = event.target.dataset.role;
  const rowId = Number(event.target.dataset.rowId);

  if (role === "search") {
    const row = rowsState.find(item => item.id === rowId);
    if (row) {
      row.searchTerm = event.target.value;
    }
  }
});

document.getElementById("resultsBody").addEventListener("click", event => {
  const role = event.target.dataset.role;
  const rowId = Number(event.target.dataset.rowId);

  if (role === "search-button") {
    rerunSearch(rowId);
  }
});

document.getElementById("resultsBody").addEventListener("change", event => {
  const role = event.target.dataset.role;
  const rowId = Number(event.target.dataset.rowId);

  if (role === "select") {
    selectOption(rowId, event.target.value);
  }
});

loadFoods().catch(() => {
  console.log("Matvaretabellen kunne ikke lastes ved oppstart.");
});
