const ingredientDb = {
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
  "pose": 11
};

function parseRecipe() {

  const text = document.getElementById("recipeInput").value;
  const servings = parseInt(document.getElementById("servings").value) || 1;

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  const tbody = document.getElementById("resultsBody");
  tbody.innerHTML = "";

  let totalKcal = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  lines.forEach(line => {

    const match = line.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-Zæøå]+)\s+(.+)$/i);

    if(!match) return;

    const amount = parseFloat(match[1].replace(",", "."));
    const unit = match[2].toLowerCase();
    const ingredient = match[3].toLowerCase().trim();

    const grams = amount * (unitToGrams[unit] || 0);

    let data = ingredientDb[ingredient];

    if(!data){
      const key = Object.keys(ingredientDb).find(k => ingredient.includes(k));
      data = ingredientDb[key];
    }

    if(!data) return;

    const factor = grams / 100;

    const kcal = data.kcal * factor;
    const protein = data.protein * factor;
    const carbs = data.carbs * factor;
    const fat = data.fat * factor;

    totalKcal += kcal;
    totalProtein += protein;
    totalCarbs += carbs;
    totalFat += fat;

    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${line}</td>
      <td>${ingredient}</td>
      <td>${Math.round(grams)}</td>
      <td>${Math.round(kcal)}</td>
      <td>${protein.toFixed(1)}</td>
      <td>${carbs.toFixed(1)}</td>
      <td>${fat.toFixed(1)}</td>
    `;

    tbody.appendChild(row);

  });

  document.getElementById("totalKcal").innerText = Math.round(totalKcal) + " kcal";
  document.getElementById("totalProtein").innerText = totalProtein.toFixed(1) + " g";
  document.getElementById("totalCarbs").innerText = totalCarbs.toFixed(1) + " g";
  document.getElementById("totalFat").innerText = totalFat.toFixed(1) + " g";

  document.getElementById("perKcal").innerText = Math.round(totalKcal/servings) + " kcal";
  document.getElementById("perProtein").innerText = (totalProtein/servings).toFixed(1) + " g";
  document.getElementById("perCarbs").innerText = (totalCarbs/servings).toFixed(1) + " g";
  document.getElementById("perFat").innerText = (totalFat/servings).toFixed(1) + " g";
}

document.getElementById("parseBtn").addEventListener("click", parseRecipe);