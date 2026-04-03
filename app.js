const MATVARE_URL = "https://www.matvaretabellen.no/api/nb/foods.json";

let foodsCache = [];

const fallbackDb = {
  "egg": { kcal: 143, protein: 13, carbs: 1.1, fat: 10.3 },
  "banan": { kcal: 89, protein: 1.1, carbs: 23, fat: 0.3 },
  "bananer": { kcal: 89, protein: 1.1, carbs: 23, fat: 0.3 },
  "eple": { kcal: 52, protein: 0.3, carbs: 14, fat: 0.2 },
  "epler": { kcal: 52, protein: 0.3, carbs: 14, fat: 0.2 },
  "appelsin": { kcal: 47, protein: 0.9, carbs: 11.8, fat: 0.1 },
  "appelsiner": { kcal: 47, protein: 0.9, carbs: 11.8, fat: 0.1 },
  "pære": { kcal: 57, protein: 0.4, carbs: 15, fat: 0.1 },
  "pærer": { kcal: 57, protein: 0.4, carbs: 15, fat: 0.1 },
  "kyllingfilet": { kcal: 120, protein: 23, carbs: 0, fat: 2 },
  "oksefilet": { kcal: 125, protein: 22, carbs: 0, fat: 4 },
  "laksefilet": { kcal: 208, protein: 20, carbs: 0, fat: 13 },
  "makrell i tomat": { kcal: 220, protein: 13, carbs: 4, fat: 16 },
  "vann": { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  "tørrgjær": { kcal: 325, protein: 40, carbs: 20, fat: 6 },
  "salt": { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  "olje": { kcal: 900, protein: 0, carbs: 0, fat: 100 },
  "hvetemel": { kcal: 340, protein: 10, carbs: 71, fat: 1.5 },
  "sammalt hvete fin": { kcal: 336, protein: 13, carbs: 60, fat: 2.5 },
  "havregryn": { kcal: 366, protein: 13, carbs: 60, fat: 7 },
  "solsikkekjerner": { kcal: 585, protein: 21, carbs: 12, fat: 51 },
  "chiafrø": { kcal: 446, protein: 21, carbs: 4, fat: 31 },
  "mager kesam": { kcal: 59, protein: 10, carbs: 3.9, fat: 1 },
  "kesam": { kcal: 59, protein: 10, carbs: 3.9, fat: 1 }
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
  "pærer": 170
};

function normalizeText(text) {
  return (text || "")
    .toLowerCase()
    .trim()
    .replace(/\blunkent\b/g, "")
    .replace(/\brå\b/g, "rå")
    .replace(/[.,]$/, "")
    .replace(/\s+/g, " ");
}

function getIngredientVariants(text) {
  const value = normalizeText(text);
  const variants = [value];

  if (value.endsWith("er")) {
    variants.push(value.slice(0, -2));
  }

  if (value.endsWith("ene")) {
    variants.push(value.slice(0, -3));
  }

  if (!value.endsWith("er")) {
    variants.push(value + "er");
  }

  return [...new Set(variants.filter(Boolean))];
}

async function loadFoods() {
  if (foodsCache.length > 0) {
    return foodsCache;
  }

  const response = await fetch(MATVARE_URL);
  const data = await response.json();
  foodsCache = data.foods || [];
  return foodsCache;
}

function findQuantityDeep(obj, needles) {
  if (!obj || typeof obj !== "object") {
    return null;
  }

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
      if (nested !== null) {
        return nested;
      }
    }
  }

  return null;
}

function extractMacros(food) {
  const kcal = findQuantityDeep(food, ["kcal", "calories", "energi"]) ?? 0;
  const protein = findQuantityDeep(food, ["protein"]) ?? 0;
  const carbs = findQuantityDeep(food, ["karbo", "carb"]) ?? 0;
  const fat = findQuantityDeep(food, ["fett", "fat"]) ?? 0;

  return { kcal, protein, carbs, fat };
}

function badMatchPenalty(name) {
  const bannedWords = [
    "cider",
    "øl",
    "vin",
    "brus",
    "saft",
    "juice",
    "likør",
    "drink",
    "cocktail",
    "energidrikk",
    "is",
    "godteri",
    "snacks"
  ];

  let penalty = 0;

  for (const word of bannedWords) {
    if (name.includes(word)) {
      penalty -= 80;
    }
  }

  return penalty;
}

function goodMatchBonus(name, query) {
  let bonus = 0;

  if (name.includes("rå")) {
    bonus += 20;
  }

  if (name.includes("naturell")) {
    bonus += 10;
  }

  if (name.includes(query)) {
    bonus += 25;
  }

  return bonus;
}

function scoreFoodMatch(food, query) {
  const q = normalizeText(query);
  const name = normalizeText(food.foodName || "");
  const keywords = Array.isArray(food.searchKeywords)
    ? food.searchKeywords.map(k => normalizeText(k))
    : [];

  let score = 0;

  if (name === q) score += 100;
  if (keywords.includes(q)) score += 95;
  if (name.includes(q)) score += 70;
  if (q.includes(name) && name.length > 2) score += 50;

  for (const keyword of keywords) {
    if (q === keyword) score += 80;
    if (q.includes(keyword) && keyword.length > 2) score += 45;
    if (keyword.includes(q) && q.length > 2) score += 35;
  }

  score += goodMatchBonus(name, q);
  score += badMatchPenalty(name);

  return score;
}

function findBestFood(query) {
  const scored = foodsCache
    .map(food => ({
      food,
      score: scoreFoodMatch(food, query)
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.length ? scored[0].food : null;
}

async function lookupIngredient(ingredientName) {
  const variants = getIngredientVariants(ingredientName);

  for (const variant of variants) {
    if (fallbackDb[variant]) {
      return {
        ingredientName: variant,
        macros: fallbackDb[variant],
        status: "OK"
      };
    }
  }

  try {
    await loadFoods();

    for (const variant of variants) {
      const match = findBestFood(variant);

      if (match) {
        return {
          ingredientName: match.foodName || variant,
          macros: extractMacros(match),
          status: "OK"
        };
      }
    }
  } catch (error) {
    console.log("Klarte ikke å hente Matvaretabellen", error);
  }

  return {
    ingredientName: normalizeText(ingredientName),
    macros: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    status: "Ukjent"
  };
}

function parseLine(line) {
  let amount = 0;
  let unit = "";
  let ingredient = "";

  let match = line.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-ZæøåÆØÅ]+)\s+(.+)$/i);

  if (match) {
    amount = parseFloat(match[1].replace(",", "."));
    unit = match[2].toLowerCase();
    ingredient = match[3].trim();
  } else {
    match = line.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/i);

    if (!match) {
      return null;
    }

    amount = parseFloat(match[1].replace(",", "."));
    ingredient = match[2].trim().toLowerCase();

    if (["egg", "eggene"].includes(ingredient)) {
      unit = "egg";
      ingredient = "egg";
    } else if (["banan", "bananer"].includes(ingredient)) {
      unit = ingredient;
    } else if (["eple", "epler"].includes(ingredient)) {
      unit = ingredient;
    } else if (["appelsin", "appelsiner"].includes(ingredient)) {
      unit = ingredient;
    } else if (["pære", "pærer"].includes(ingredient)) {
      unit = ingredient;
    } else {
      unit = "";
    }
  }

  const grams = unitToGrams[unit] ? amount * unitToGrams[unit] : amount;

  return {
    originalLine: line,
    ingredient: normalizeText(ingredient),
    grams
  };
}

function setTotals(totalKcal, totalProtein, totalCarbs, totalFat, servings) {
  document.getElementById("totalKcal").innerText = Math.round(totalKcal) + " kcal";
  document.getElementById("totalProtein").innerText = totalProtein.toFixed(1) + " g";
  document.getElementById("totalCarbs").innerText = totalCarbs.toFixed(1) + " g";
  document.getElementById("totalFat").innerText = totalFat.toFixed(1) + " g";

  document.getElementById("perKcal").innerText = Math.round(totalKcal / servings) + " kcal";
  document.getElementById("perProtein").innerText = (totalProtein / servings).toFixed(1) + " g";
  document.getElementById("perCarbs").innerText = (totalCarbs / servings).toFixed(1) + " g";
  document.getElementById("perFat").innerText = (totalFat / servings).toFixed(1) + " g";
}

async function parseRecipe() {
  const text = document.getElementById("recipeInput").value;
  const servings = parseInt(document.getElementById("servings").value, 10) || 1;
  const lines = text.split("\n").map(line => line.trim()).filter(Boolean);

  const tbody = document.getElementById("resultsBody");
  tbody.innerHTML = "";

  let totalKcal = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  for (const line of lines) {
    const parsed = parseLine(line);

    if (!parsed) {
      continue;
    }

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

  setTotals(totalKcal, totalProtein, totalCarbs, totalFat, servings);
}

document.getElementById("parseBtn").addEventListener("click", parseRecipe);

loadFoods().catch(() => {
  console.log("Matvaretabellen kunne ikke lastes ved oppstart.");
});
