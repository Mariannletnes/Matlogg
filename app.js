const MATVARE_URL = "https://www.matvaretabellen.no/api/nb/foods.json";

let foodsCache = [];

const fallbackDb = {
  "egg": { kcal: 143, protein: 13, carbs: 1.1, fat: 10.3 },
  "banan": { kcal: 89, protein: 1.1, carbs: 23, fat: 0.3 },
  "bananer": { kcal: 89, protein: 1.1, carbs: 23, fat: 0.3 },
  "kyllingfilet": { kcal: 120, protein: 23, carbs: 0, fat: 2 },
  "makrell i tomat": { kcal: 220, protein: 13, carbs: 4, fat: 16 }
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
  "bananer": 120
};

function normalizeText(text) {
  return (text || "")
    .toLowerCase()
    .trim()
    .replace(/\blunkent\b/g, "")
    .replace(/\s+/g, " ");
}

async function loadFoods() {
  if (foodsCache.length) return foodsCache;

  const res = await fetch(MATVARE_URL);
  const data = await res.json();
  foodsCache = data.foods || [];
  return foodsCache;
}

function findQuantityDeep(obj, needles) {
  if (!obj || typeof obj !== "object") return null;

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    if (needles.some(n => lowerKey.includes(n))) {
      if (value && typeof value === "object" && typeof value.quantity === "number") {
        return value.quantity;
      }
      if (typeof value === "number") {
        return value;
      }
    }

    if (value && typeof value === "object") {
      const found = findQuantityDeep(value, needles);
      if (found !== null) return found;
    }
  }

  return null;
}

function extractMacros(food) {
  const kcal =
    findQuantityDeep(food, ["calories", "kcal"]) ?? 0;

  const protein =
    findQuantityDeep(food, ["protein"]) ?? 0;

  const carbs =
    findQuantityDeep(food, ["karbo", "carb"]) ?? 0;

  const fat =
    findQuantityDeep(food, ["fett", "fat"]) ?? 0;

  return { kcal, protein, carbs, fat };
}

function scoreFoodMatch(food, query) {
  const q = normalizeText(query);
  const name = normalizeText(food.foodName || "");
  const keywords = (food.searchKeywords || []).map(k => normalizeText(k));

  if (name === q) return 100;
  if (keywords.includes(q)) return 95;
  if (name.includes(q)) return 80;
  if (q.includes(name) && name.length > 2) return 70;

  for (const kw of keywords) {
    if (q.includes(kw) && kw.length > 2) return 65;
    if (kw.includes(q) && q.length > 2) return 60;
  }

  return 0;
}

function findBestFood(query) {
  const scored = foodsCache
    .map(food => ({ food, score: scoreFoodMatch(food, query) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.length ? scored[0].food : null;
}

async function lookupIngredient(ingredientName) {
  const cleaned = normalizeText(ingredientName);

  if (fallbackDb[cleaned]) {
    return {
      ingredientName: cleaned,
      macros: fallbackDb[cleaned],
      status: "OK"
    };
  }

  await loadFoods();
  const match = findBestFood(cleaned);

  if (!match) {
    return {
      ingredientName: cleaned,
      macros: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      status: "Ukjent"
    };
  }

  return {
    ingredientName: match.foodName || cleaned,
    macros: extractMacros(match),
    status: "OK"
  };
}

function parseLine(line) {
  let amount = 0;
  let unit = "";
  let ingredient = "";

  let match = line.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-Zæøå]+)\s+(.+)$/i);

  if (match) {
    amount = parseFloat(match[1].replace(",", "."));
    unit = match[2].toLowerCase();
    ingredient = match[3].trim();
  } else {
    match = line.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/i);
    if (!match) return null;

    amount = parseFloat(match[1].replace(",", "."));
    ingredient = match[2].trim().toLowerCase();

    if (ingredient === "egg" || ingredient === "eggene") {
      unit = "egg";
      ingredient = "egg";
    } else if (ingredient === "banan" || ingredient === "bananer") {
      unit = ingredient;
    } else {
      unit = "";
    }
  }

  const grams = unitToGrams[unit] ? amount * unitToGrams[unit] : amount;

  return {
    originalLine: line,
    ingredient,
    grams
  };
}

async function parseRecipe() {
  const text = document.getElementById("recipeInput").value;
  const servings = parseInt(document.getElementById("servings").value) || 1;

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  const tbody = document.getElementById("resultsBody");
  tbody.innerHTML = "";

  let totalKcal = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  for (const line of lines) {
    const parsed = parseLine(line);
    if (!parsed) continue;

    const lookup = await lookupIngredient(parsed.ingredient);
    const factor = parsed.grams / 100;

    const kcal = lookup.macros.kcal * factor;
    const protein = lookup.macros.protein * factor;
    const carbs = lookup.macros.carbs * factor;
    const fat = lookup.macros.fat * factor;

    totalKcal += kcal;
    totalProtein += protein;
    totalCarbs += carbs;
    totalFat += fat;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${line}</td>
      <td>${lookup.ingredientName}</td>
      <td>${Math.round(parsed.grams)}</td>
      <td>${Math.round(kcal)}</td>
      <td>${protein.toFixed(1)} g</td>
      <td>${carbs.toFixed(1)} g</td>
      <td>${fat.toFixed(1)} g</td>
      <td>${lookup.status}</td>
    `;
    tbody.appendChild(row);
  }

  document.getElementById("totalKcal").innerText = Math.round(totalKcal) + " kcal";
  document.getElementById("totalProtein").innerText = totalProtein.toFixed(1) + " g";
  document.getElementById("totalCarbs").innerText = totalCarbs.toFixed(1) + " g";
  document.getElementById("totalFat").innerText = totalFat.toFixed(1) + " g";

  document.getElementById("perKcal").innerText = Math.round(totalKcal / servings) + " kcal";
  document.getElementById("perProtein").innerText = (totalProtein / servings).toFixed(1) + " g";
  document.getElementById("perCarbs").innerText = (totalCarbs / servings).toFixed(1) + " g";
  document.getElementById("perFat").innerText = (totalFat / servings).toFixed(1) + " g";
}

document.getElementById("parseBtn").addEventListener("click", parseRecipe);

loadFoods().catch(() => {
  console.log("Klarte ikke å laste Matvaretabellen. Bruker fallback der det finnes.");
});
