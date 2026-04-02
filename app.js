const ingredientDb = {
  vann: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  tørrgjær: { kcal: 325, protein: 40, carbs: 41, fat: 7 },
  salt: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  olje: { kcal: 900, protein: 0, carbs: 0, fat: 100 },
  olivenolje: { kcal: 884, protein: 0, carbs: 0, fat: 100 },
  hvetemel: { kcal: 340, protein: 10, carbs: 71, fat: 1.5 },
  sammalt hvete fin: { kcal: 336, protein: 13, carbs: 60, fat: 2.5 },
  sammalt hvete grov: { kcal: 325, protein: 12, carbs: 58, fat: 2.5 },
  havregryn: { kcal: 366, protein: 13, carbs: 58.7, fat: 6.7 },
  solsikkekjerner: { kcal: 584, protein: 21, carbs: 11, fat: 51.5 },
  chiafrø: { kcal: 446, protein: 21, carbs: 4.9, fat: 31 },
  mager kesam: { kcal: 59, protein: 10, carbs: 3.9, fat: 0.2 },
  kesam: { kcal: 89, protein: 10, carbs: 4, fat: 3 },
  cottage cheese: { kcal: 98, protein: 11.5, carbs: 3.4, fat: 4.3 },
  egg: { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5 },
  sukker: { kcal: 400, protein: 0, carbs: 100, fat: 0 },
  smør: { kcal: 717, protein: 0.9, carbs: 0.6, fat: 81 },
  melk: { kcal: 42, protein: 3.5, carbs: 5, fat: 1 },
  lettmelk: { kcal: 42, protein: 3.5, carbs: 4.7, fat: 1 },
  skummet melk: { kcal: 35, protein: 3.5, carbs: 5, fat: 0.1 },
  yoghurt: { kcal: 63, protein: 4, carbs: 7, fat: 1.5 }
};

const unitToGrams = {
  g: 1,
  gram: 1,
  gr: 1,
  kg: 1000,
  dl: 100,
  l: 1000,
  ml: 1,
  ss: 13,
  ts: 5,
  pose: 11,
  pk: 100,
  stk: 60
};

const exampleRecipe = `4 dl lunkent vann
1 pose tørrgjær
1 ts salt
1 ss olje
150 g hvetemel
220 g sammalt hvete fin
200 g havregryn
20 g solsikkekjerner
2 ss chiafrø
300 g mager kesam`;

const els = {
  recipeName: document.getElementById('recipeName'),
  servings: document.getElementById('servings'),
  recipeInput: document.getElementById('recipeInput'),
  parseBtn: document.getElementById('parseBtn'),
  exampleBtn: document.getElementById('exampleBtn'),
  clearBtn: document.getElementById('clearBtn'),
  parseStatus: document.getElementById('parseStatus'),
  resultsBody: document.getElementById('resultsBody'),
  totalKcal: document.getElementById('totalKcal'),
  totalProtein: document.getElementById('totalProtein'),
  totalCarbs: document.getElementById('totalCarbs'),
  totalFat: document.getElementById('totalFat'),
  perKcal: document.getElementById('perKcal'),
  perProtein: document.getElementById('perProtein'),
  perCarbs: document.getElementById('perCarbs'),
  perFat: document.getElementById('perFat')
};

function normalizeIngredientName(text) {
  return text
    .toLowerCase()
    .replace(/[,.;:()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^lunkent\s+/, '')
    .replace(/^lett\s+/, '')
    .replace(/^fin\s+/, '')
    .replace(/^grov\s+/, '');
}

function findIngredient(name) {
  const normalized = normalizeIngredientName(name);

  if (ingredientDb[normalized]) {
    return { key: normalized, data: ingredientDb[normalized], matched: true };
  }

  const keys = Object.keys(ingredientDb);
  const partial = keys.find(key => normalized.includes(key) || key.includes(normalized));

  if (partial) {
    return { key: partial, data: ingredientDb[partial], matched: true };
  }

  return { key: normalized, data: null, matched: false };
}

function parseLine(line) {
  const clean = line.trim();
  if (!clean) return null;

  const match = clean.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-ZæøåÆØÅ]+)\s+(.+)$/);
  if (!match) {
    return {
      line: clean,
      ingredient: clean,
      grams: 0,
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      status: 'Ikke tolket'
    };
  }

  const amount = Number(match[1].replace(',', '.'));
  const unit = match[2].toLowerCase();
  const ingredientText = match[3].trim();
  const grams = Math.round((unitToGrams[unit] || 0) * amount);

  const found = findIngredient(ingredientText);

  if (!found.matched || !grams) {
    return {
      line: clean,
      ingredient: found.key || ingredientText,
      grams,
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      status: 'Sjekk ingrediens'
    };
  }

  const factor = grams / 100;
  return {
    line: clean,
    ingredient: found.key,
    grams,
    kcal: roundNumber(found.data.kcal * factor),
    protein: roundNumber(found.data.protein * factor),
    carbs: roundNumber(found.data.carbs * factor),
    fat: roundNumber(found.data.fat * factor),
    status: 'OK'
  };
}

function roundNumber(value) {
  return Math.round(value * 10) / 10;
}

function formatNumber(value) {
  return new Intl.NumberFormat('no-NO', { maximumFractionDigits: 1 }).format(value);
}

function renderRows(rows) {
  els.resultsBody.innerHTML = '';

  if (!rows.length) {
    els.resultsBody.innerHTML = '<tr><td colspan="8" class="muted">Ingen linjer tolket ennå.</td></tr>';
    return;
  }

  rows.forEach(row => {
    const tr = document.createElement('tr');
    const badgeClass = row.status === 'OK' ? 'ok' : 'warn';
    tr.innerHTML = `
      <td>${row.line}</td>
      <td>${row.ingredient}</td>
      <td>${row.grams || 0}</td>
      <td>${formatNumber(row.kcal)}</td>
      <td>${formatNumber(row.protein)} g</td>
      <td>${formatNumber(row.carbs)} g</td>
      <td>${formatNumber(row.fat)} g</td>
      <td><span class="badge ${badgeClass}">${row.status}</span></td>
    `;
    els.resultsBody.appendChild(tr);
  });
}

function updateSummary(rows) {
  const servings = Math.max(1, Number(els.servings.value) || 1);

  const totals = rows.reduce((acc, row) => {
    acc.kcal += row.kcal;
    acc.protein += row.protein;
    acc.carbs += row.carbs;
    acc.fat += row.fat;
    return acc;
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });

  els.totalKcal.textContent = `${Math.round(totals.kcal)} kcal`;
  els.totalProtein.textContent = `${formatNumber(totals.protein)} g`;
  els.totalCarbs.textContent = `${formatNumber(totals.carbs)} g`;
  els.totalFat.textContent = `${formatNumber(totals.fat)} g`;

  els.perKcal.textContent = `${Math.round(totals.kcal / servings)} kcal`;
  els.perProtein.textContent = `${formatNumber(totals.protein / servings)} g`;
  els.perCarbs.textContent = `${formatNumber(totals.carbs / servings)} g`;
  els.perFat.textContent = `${formatNumber(totals.fat / servings)} g`;
}

function parseRecipe() {
  const lines = els.recipeInput.value
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const rows = lines.map(parseLine).filter(Boolean);
  const okCount = rows.filter(row => row.status === 'OK').length;

  els.parseStatus.textContent = `${okCount} av ${rows.length} linjer ble tolket.`;

  renderRows(rows);
  updateSummary(rows);
}

function clearAll() {
  els.recipeName.value = '';
  els.servings.value = 1;
  els.recipeInput.value = '';
  els.parseStatus.textContent = '';
  renderRows([]);
  updateSummary([]);
}

els.parseBtn.addEventListener('click', parseRecipe);
els.exampleBtn.addEventListener('click', () => {
  els.recipeName.value = 'Proteinbrød';
  els.servings.value = 12;
  els.recipeInput.value = exampleRecipe;
  parseRecipe();
});
els.clearBtn.addEventListener('click', clearAll);
els.servings.addEventListener('input', parseRecipe);

renderRows([]);
updateSummary([]);
