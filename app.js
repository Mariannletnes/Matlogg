const MATVARE_URL = "https://www.matvaretabellen.no/api/nb/foods.json";

let foodsCache = [];

const fallbackDb = {
  egg: { kcal: 143, protein: 13, carbs: 1.1, fat: 10.3 },
  banan: { kcal: 89, protein: 1.1, carbs: 23, fat: 0.3 },
  eple: { kcal: 52, protein: 0.3, carbs: 14, fat: 0.2 },
  appelsin: { kcal: 47, protein: 0.9, carbs: 11.8, fat: 0.1 },
  pære: { kcal: 57, protein: 0.4, carbs: 15, fat: 0.1 },
  kyllingfilet: { kcal: 120, protein: 23, carbs: 0, fat: 2 },
  oksefilet: { kcal: 125, protein: 22, carbs: 0, fat: 4 },
  lam: { kcal: 250, protein: 25, carbs: 0, fat: 18 },
  laks: { kcal: 208, protein: 20, carbs: 0, fat: 13 },
  potet: { kcal: 77, protein: 2, carbs: 17, fat: 0.1 },
  hodekål: { kcal: 25, protein: 1.3, carbs: 6, fat: 0.1 }
};

const unitToGrams = {
  g: 1,
  gram: 1,
  kg: 1000,
  dl: 100,
  l: 1000,
  ts: 5,
  ss: 13,
  egg: 60,
  banan: 120,
  eple: 180,
  appelsin: 180,
  pære: 170,
  hodekål: 900,
  løk: 100
};

function normalize(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ");
}

function parseLine(line) {
  let amount = 0;
  let unit = "";
  let ingredient = "";

  let match = line.match(/^(\d+(?:[.,]\d+)?)\s*([a-zæøå]+)\s+(.+)$/i);

  if (match) {
    amount = parseFloat(match[1].replace(",", "."));
    unit = match[2].toLowerCase();
    ingredient = normalize(match[3]);
  } else {
    match = line.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/i);

    if (!match) return null;

    amount = parseFloat(match[1].replace(",", "."));
    ingredient = normalize(match[2]);

    if (unitToGrams[ingredient]) {
      unit = ingredient;
    }
  }

  const grams = unitToGrams[unit] ? amount * unitToGrams[unit] : amount;

  return { ingredient, grams, original: line };
}

async function loadFoods() {
  if (foodsCache.length) return foodsCache;

  const res = await fetch(MATVARE_URL);
  const data = await res.json();

  foodsCache = data.foods || [];
  return foodsCache;
}

function extractMacros(food) {
  const nutrients = food.nutrients || [];

  let kcal = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;

  for (const n of nutrients) {
    const name = normalize(n.name);

    if (name.includes("energi")) kcal = n.value;
    if (name.includes("protein")) protein = n.value;
    if (name.includes("karbo")) carbs = n.value;
    if (name.includes("fett")) fat = n.value;
  }

  return { kcal, protein, carbs, fat };
}

function scoreMatch(foodName, query) {
  const name = normalize(foodName);

  let score = 0;

  if (name === query) score += 100;
  if (name.includes(query)) score += 50;

  const bad = [
    "øl",
    "vin",
    "cider",
    "brus",
    "saft",
    "juice",
    "drink",
    "godteri",
    "is"
  ];

  for (const word of bad) {
    if (name.includes(word)) score -= 80;
  }

  if (name.includes("rå")) score += 20;

  return score;
}

function findBestMatch(query) {
  let best = null;
  let bestScore = 0;

  for (const food of foodsCache) {
    const score = scoreMatch(food.foodName, query);

    if (score > bestScore) {
      best = food;
      bestScore = score;
    }
  }

  return best;
}

async function lookupIngredient(name) {
  const ingredient = normalize(name);

  if (fallbackDb[ingredient]) {
    return {
      name: ingredient,
      macros: fallbackDb[ingredient],
      status: "OK"
    };
  }

  try {
    await loadFoods();

    const match = findBestMatch(ingredient);

    if (match) {
      return {
        name: match.foodName,
        macros: extractMacros(match),
        status: "OK"
      };
    }
  } catch {}

  return {
    name: ingredient,
    macros: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    status: "Ukjent"
  };
}

function setTotals(kcal, protein, carbs, fat, portions) {
  document.getElementById("totalKcal").innerText = Math.round(kcal) + " kcal";
  document.getElementById("totalProtein").innerText = protein.toFixed(1) + " g";
  document.getElementById("totalCarbs").innerText = carbs.toFixed(1) + " g";
  document.getElementById("totalFat").innerText = fat.toFixed(1) + " g";

  document.getElementById("perKcal").innerText =
    Math.round(kcal / portions) + " kcal";
  document.getElementById("perProtein").innerText =
    (protein / portions).toFixed(1) + " g";
  document.getElementById("perCarbs").innerText =
    (carbs / portions).toFixed(1) + " g";
  document.getElementById("perFat").innerText =
    (fat / portions).toFixed(1) + " g";
}

async function parseRecipe() {
  const text = document.getElementById("recipeInput").value;
  const portions =
    parseInt(document.getElementById("servings").value) || 1;

  const lines = text
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  const tbody = document.getElementById("resultsBody");
  tbody.innerHTML = "";

  let kcal = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;

  for (const line of lines) {
    const parsed = parseLine(line);

    if (!parsed) continue;

    const result = await lookupIngredient(parsed.ingredient);

    const factor = parsed.grams / 100;

    const k = result.macros.kcal * factor;
    const p = result.macros.protein * factor;
    const c = result.macros.carbs * factor;
    const f = result.macros.fat * factor;

    kcal += k;
    protein += p;
    carbs += c;
    fat += f;

    const row = document.createElement("tr");

    row.innerHTML = `
<td>${line}</td>
<td>${result.name}</td>
<td>${Math.round(parsed.grams)}</td>
<td>${Math.round(k)}</td>
<td>${p.toFixed(1)} g</td>
<td>${c.toFixed(1)} g</td>
<td>${f.toFixed(1)} g</td>
<td>${result.status}</td>
`;

    tbody.appendChild(row);
  }

  setTotals(kcal, protein, carbs, fat, portions);
}

document
  .getElementById("parseBtn")
  .addEventListener("click", parseRecipe);

loadFoods().catch(() => {});
