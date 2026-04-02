const ingredientDb = {
  "vann": { kcal: 0, protein: 0 },
  "tørrgjær": { kcal: 325, protein: 40 },
  "salt": { kcal: 0, protein: 0 },
  "olje": { kcal: 900, protein: 0 },
  "hvetemel": { kcal: 340, protein: 10 },
  "sammalt hvete fin": { kcal: 336, protein: 13 },
  "havregryn": { kcal: 366, protein: 13 },
  "solsikkekjerner": { kcal: 584, protein: 21 },
  "chiafrø": { kcal: 444, protein: 21 },
  "mager kesam": { kcal: 59, protein: 10 },
  "kesam": { kcal: 89, protein: 9 },
  "kokt skinke": { kcal: 110, protein: 20 },
  "kyllingfilet": { kcal: 114, protein: 23 },
  "ris": { kcal: 360, protein: 7 },
  "egg": { kcal: 143, protein: 13 },
  "torsk": { kcal: 82, protein: 18 },
  "laks": { kcal: 208, protein: 20 },
  "makrell i tomat": { kcal: 190, protein: 13 },
  "frokost fullkorn wasa knekkebrød": { kcal: 350, protein: 11 }
};

const unitToGrams = {
  g: 1,
  gram: 1,
  kg: 1000,
  dl: {
    "vann": 100,
    "olje": 92,
    "hvetemel": 60,
    "sammalt hvete fin": 55,
    "havregryn": 35,
    "solsikkekjerner": 55,
    "chiafrø": 65,
    "mager kesam": 100,
    default: 100
  },
  ss: {
    "olje": 13,
    "chiafrø": 12,
    default: 15
  },
  ts: {
    "salt": 5,
    default: 5
  },
  pose: {
    "tørrgjær": 11,
    default: 1
  },
  stk: {
    "egg": 63,
    default: 1
  }
};

const els = {
  recipeName: document.getElementById("recipeName"),
  servings: document.getElementById("servings"),
  recipeInput: document.getElementById("recipeInput"),
  parseBtn: document.getElementById("parseBtn"),
  fillExampleBtn: document.getElementById("fillExampleBtn"),
  clearBtn: document.getElementById("clearBtn"),
  resultsCard: document.getElementById("resultsCard"),
  resultsBody: document.getElementById("resultsBody"),
  totalKcal: document.getElementById("totalKcal"),
  totalProtein: document.getElementById("totalProtein"),
  perServingKcal: document.getElementById("perServingKcal"),
  perServingProtein: document.getElementById("perServingProtein"),
  matchStatus: document.getElementById("matchStatus"),
  ingredientList: document.getElementById("ingredientList")
};

function renderIngredientPills() {
  const names = Object.keys(ingredientDb).sort((a, b) => a.localeCompare(b, "no"));
  els.ingredientList.innerHTML = names
    .map(name => `<span class="ingredient-pill">${name}</span>`)
    .join("");
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[,]/g, ".")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAmount(raw) {
  const cleaned = raw.replace(",", ".");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function findIngredient(name) {
  const normalized = normalizeText(name);
  if (ingredientDb[normalized]) return normalized;

  const direct = Object.keys(ingredientDb).find(key => normalized.includes(key));
  if (direct) return direct;

  return null;
}

function gramsFromUnit(amount, unit, ingredientKey) {
  if (!unit) return amount;

  const normalizedUnit = unit.toLowerCase();
  const mapping = unitToGrams[normalizedUnit];

  if (!mapping) return null;
  if (typeof mapping === "number") return amount * mapping;

  const specific = mapping[ingredientKey] ?? mapping.default;
  return amount * specific;
}

function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d+(?:[\.,]\d+)?)\s*(kg|gram|g|dl|ss|ts|pose|stk)?\s+(.+)$/i);

  if (!match) {
    return {
      raw: trimmed,
      ingredient: null,
      grams: null,
      kcal: 0,
      protein: 0,
      matched: false,
      reason: "Kunne ikke lese linjen"
    };
  }

  const amount = parseAmount(match[1]);
  const unit = match[2] ? match[2].toLowerCase() : "g";
  const name = match[3].trim();
  const ingredientKey = findIngredient(name);

  if (!ingredientKey) {
    return {
      raw: trimmed,
      ingredient: name,
      grams: null,
      kcal: 0,
      protein: 0,
      matched: false,
      reason: "Fant ikke ingrediens"
    };
  }

  const grams = gramsFromUnit(amount, unit, ingredientKey);

  if (!grams && grams !== 0) {
    return {
      raw: trimmed,
      ingredient: ingredientKey,
      grams: null,
      kcal: 0,
      protein: 0,
      matched: false,
      reason: "Mangler omregning"
    };
  }

  const nutrition = ingredientDb[ingredientKey];
  const factor = grams / 100;
  const kcal = nutrition.kcal * factor;
  const protein = nutrition.protein * factor;

  return {
    raw: trimmed,
    ingredient: ingredientKey,
    grams,
    kcal,
    protein,
    matched: true,
    reason: "OK"
  };
}

function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat("no-NO", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}

function renderResults(items) {
  const servings = Math.max(1, Number(els.servings.value) || 1);
  const matchedCount = items.filter(item => item.matched).length;
  const totalKcal = items.reduce((sum, item) => sum + item.kcal, 0);
  const totalProtein = items.reduce((sum, item) => sum + item.protein, 0);

  els.resultsBody.innerHTML = items.map(item => `
    <tr>
      <td>${item.raw}</td>
      <td>${item.ingredient ?? ""}</td>
      <td>${item.grams != null ? formatNumber(item.grams, 0) : ""}</td>
      <td>${formatNumber(item.kcal, 0)}</td>
      <td>${formatNumber(item.protein, 1)} g</td>
      <td><span class="status ${item.matched ? "ok" : "warn"}">${item.reason}</span></td>
    </tr>
  `).join("");

  els.totalKcal.textContent = `${formatNumber(totalKcal, 0)} kcal`;
  els.totalProtein.textContent = `${formatNumber(totalProtein, 1)} g`;
  els.perServingKcal.textContent = `${formatNumber(totalKcal / servings, 0)} kcal`;
  els.perServingProtein.textContent = `${formatNumber(totalProtein / servings, 1)} g`;
  els.matchStatus.textContent = `${matchedCount} av ${items.length} linjer ble tolket.`;
  els.resultsCard.classList.remove("hidden");
}

function parseRecipe() {
  const text = els.recipeInput.value.trim();
  if (!text) return;

  const lines = text.split("\n").map(line => line.trim()).filter(Boolean);
  const items = lines.map(parseLine).filter(Boolean);
  renderResults(items);
}

function fillExample() {
  els.recipeName.value = "Proteinbrød";
  els.servings.value = 12;
  els.recipeInput.value = `4 dl lunkent vann
1 pose tørrgjær
1 ts salt
1 ss olje
150 g hvetemel
220 g sammalt hvete fin
200 g havregryn
20 g solsikkekjerner
2 ss chiafrø
300 g mager kesam`;
}

function clearAll() {
  els.recipeName.value = "";
  els.servings.value = 1;
  els.recipeInput.value = "";
  els.resultsBody.innerHTML = "";
  els.totalKcal.textContent = "0 kcal";
  els.totalProtein.textContent = "0 g";
  els.perServingKcal.textContent = "0 kcal";
  els.perServingProtein.textContent = "0 g";
  els.matchStatus.textContent = "";
  els.resultsCard.classList.add("hidden");
}

els.parseBtn.addEventListener("click", parseRecipe);
els.fillExampleBtn.addEventListener("click", fillExample);
els.clearBtn.addEventListener("click", clearAll);

renderIngredientPills();
