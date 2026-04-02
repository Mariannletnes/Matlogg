const STORAGE_KEYS = {
  recipes: 'matapp_recipes',
  diary: 'matapp_diary'
};

const recipeNameInput = document.getElementById('recipeName');
const recipeServingsInput = document.getElementById('recipeServings');
const ingredientsContainer = document.getElementById('ingredientsContainer');
const addIngredientBtn = document.getElementById('addIngredientBtn');
const saveRecipeBtn = document.getElementById('saveRecipeBtn');
const recipeMessage = document.getElementById('recipeMessage');
const recipesList = document.getElementById('recipesList');
const recipeSelect = document.getElementById('recipeSelect');
const diaryDateInput = document.getElementById('diaryDate');
const mealTypeSelect = document.getElementById('mealType');
const portionsEatenInput = document.getElementById('portionsEaten');
const addToDiaryBtn = document.getElementById('addToDiaryBtn');
const diaryMessage = document.getElementById('diaryMessage');
const diaryEntries = document.getElementById('diaryEntries');
const dayCaloriesEl = document.getElementById('dayCalories');
const dayProteinEl = document.getElementById('dayProtein');

const previewCalories = document.getElementById('previewCalories');
const previewProtein = document.getElementById('previewProtein');
const previewCaloriesPerServing = document.getElementById('previewCaloriesPerServing');
const previewProteinPerServing = document.getElementById('previewProteinPerServing');

const ingredientTemplate = document.getElementById('ingredientRowTemplate');

let recipes = loadData(STORAGE_KEYS.recipes, []);
let diary = loadData(STORAGE_KEYS.diary, []);

function loadData(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

function todayString() {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  return new Date(now - tzOffset).toISOString().slice(0, 10);
}

function addIngredientRow(data = {}) {
  const row = ingredientTemplate.content.firstElementChild.cloneNode(true);
  row.querySelector('.ingredient-name').value = data.name || '';
  row.querySelector('.ingredient-grams').value = data.grams ?? 0;
  row.querySelector('.ingredient-calories').value = data.caloriesPer100g ?? 0;
  row.querySelector('.ingredient-protein').value = data.proteinPer100g ?? 0;

  row.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', updatePreview);
  });

  row.querySelector('.remove-ingredient-btn').addEventListener('click', () => {
    row.remove();
    updatePreview();
  });

  ingredientsContainer.appendChild(row);
  updatePreview();
}

function getCurrentIngredients() {
  return [...ingredientsContainer.querySelectorAll('.ingredient-row')].map(row => ({
    name: row.querySelector('.ingredient-name').value.trim(),
    grams: Number(row.querySelector('.ingredient-grams').value) || 0,
    caloriesPer100g: Number(row.querySelector('.ingredient-calories').value) || 0,
    proteinPer100g: Number(row.querySelector('.ingredient-protein').value) || 0
  }));
}

function calculateNutrition(ingredients, servings) {
  const totals = ingredients.reduce((acc, item) => {
    const factor = item.grams / 100;
    acc.calories += item.caloriesPer100g * factor;
    acc.protein += item.proteinPer100g * factor;
    return acc;
  }, { calories: 0, protein: 0 });

  const safeServings = servings > 0 ? servings : 1;

  return {
    calories: Math.round(totals.calories),
    protein: Math.round(totals.protein * 10) / 10,
    caloriesPerServing: Math.round(totals.calories / safeServings),
    proteinPerServing: Math.round((totals.protein / safeServings) * 10) / 10
  };
}

function updatePreview() {
  const servings = Number(recipeServingsInput.value) || 1;
  const ingredients = getCurrentIngredients();
  const nutrition = calculateNutrition(ingredients, servings);

  previewCalories.textContent = nutrition.calories;
  previewProtein.textContent = `${nutrition.protein} g`;
  previewCaloriesPerServing.textContent = nutrition.caloriesPerServing;
  previewProteinPerServing.textContent = `${nutrition.proteinPerServing} g`;
}

function resetRecipeForm() {
  recipeNameInput.value = '';
  recipeServingsInput.value = 1;
  ingredientsContainer.innerHTML = '';
  addIngredientRow();
  addIngredientRow();
}

function showMessage(element, text, isError = false) {
  element.textContent = text;
  element.style.color = isError ? '#b91c1c' : '#166534';
  setTimeout(() => {
    if (element.textContent === text) {
      element.textContent = '';
    }
  }, 3000);
}

function saveRecipe() {
  const name = recipeNameInput.value.trim();
  const servings = Number(recipeServingsInput.value) || 1;
  const ingredients = getCurrentIngredients().filter(item => item.name && item.grams > 0);

  if (!name) {
    showMessage(recipeMessage, 'Skriv inn navn på oppskriften.', true);
    return;
  }

  if (ingredients.length === 0) {
    showMessage(recipeMessage, 'Legg inn minst én ingrediens med navn og gram.', true);
    return;
  }

  const nutrition = calculateNutrition(ingredients, servings);
  const recipe = {
    id: uid(),
    name,
    servings,
    ingredients,
    nutrition,
    createdAt: new Date().toISOString()
  };

  recipes.unshift(recipe);
  saveData(STORAGE_KEYS.recipes, recipes);
  renderRecipes();
  populateRecipeSelect();
  resetRecipeForm();
  showMessage(recipeMessage, 'Oppskriften er lagret.');
}

function deleteRecipe(recipeId) {
  recipes = recipes.filter(recipe => recipe.id !== recipeId);
  diary = diary.filter(entry => entry.recipeId !== recipeId);
  saveData(STORAGE_KEYS.recipes, recipes);
  saveData(STORAGE_KEYS.diary, diary);
  renderRecipes();
  populateRecipeSelect();
  renderDiary();
}

function duplicateRecipe(recipeId) {
  const recipe = recipes.find(item => item.id === recipeId);
  if (!recipe) return;

  recipeNameInput.value = `${recipe.name} kopi`;
  recipeServingsInput.value = recipe.servings;
  ingredientsContainer.innerHTML = '';
  recipe.ingredients.forEach(addIngredientRow);
  updatePreview();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderRecipes() {
  if (recipes.length === 0) {
    recipesList.innerHTML = '<p class="empty">Ingen oppskrifter lagret ennå.</p>';
    return;
  }

  recipesList.innerHTML = recipes.map(recipe => `
    <div class="recipe-card">
      <h3>${escapeHtml(recipe.name)}</h3>
      <div class="recipe-meta">
        <div><span class="small">Porsjoner</span><strong>${recipe.servings}</strong></div>
        <div><span class="small">Totalt kcal</span><strong>${recipe.nutrition.calories}</strong></div>
        <div><span class="small">Totalt protein</span><strong>${recipe.nutrition.protein} g</strong></div>
        <div><span class="small">Per porsjon</span><strong>${recipe.nutrition.caloriesPerServing} kcal</strong></div>
      </div>
      <p class="small">Ingredienser: ${recipe.ingredients.map(item => `${escapeHtml(item.name)} ${item.grams} g`).join(', ')}</p>
      <div class="recipe-actions">
        <button type="button" class="secondary" onclick="duplicateRecipe('${recipe.id}')">Bruk som mal</button>
        <button type="button" class="danger" onclick="deleteRecipe('${recipe.id}')">Slett</button>
      </div>
    </div>
  `).join('');
}

function populateRecipeSelect() {
  if (recipes.length === 0) {
    recipeSelect.innerHTML = '<option value="">Ingen oppskrifter lagret</option>';
    return;
  }

  recipeSelect.innerHTML = recipes.map(recipe => `
    <option value="${recipe.id}">${escapeHtml(recipe.name)} , ${recipe.nutrition.caloriesPerServing} kcal , ${recipe.nutrition.proteinPerServing} g protein per porsjon</option>
  `).join('');
}

function addDiaryEntry() {
  const recipeId = recipeSelect.value;
  const date = diaryDateInput.value;
  const mealType = mealTypeSelect.value;
  const portions = Number(portionsEatenInput.value) || 0;
  const recipe = recipes.find(item => item.id === recipeId);

  if (!recipe) {
    showMessage(diaryMessage, 'Velg en oppskrift.', true);
    return;
  }

  if (!date) {
    showMessage(diaryMessage, 'Velg dato.', true);
    return;
  }

  if (portions <= 0) {
    showMessage(diaryMessage, 'Antall porsjoner må være større enn 0.', true);
    return;
  }

  const entry = {
    id: uid(),
    recipeId: recipe.id,
    recipeName: recipe.name,
    date,
    mealType,
    portions,
    calories: Math.round(recipe.nutrition.caloriesPerServing * portions),
    protein: Math.round(recipe.nutrition.proteinPerServing * portions * 10) / 10,
    createdAt: new Date().toISOString()
  };

  diary.unshift(entry);
  saveData(STORAGE_KEYS.diary, diary);
  renderDiary();
  showMessage(diaryMessage, 'Lagt til i dagboken.');
}

function deleteDiaryEntry(entryId) {
  diary = diary.filter(entry => entry.id !== entryId);
  saveData(STORAGE_KEYS.diary, diary);
  renderDiary();
}

function renderDiary() {
  const selectedDate = diaryDateInput.value || todayString();
  const entries = diary.filter(entry => entry.date === selectedDate);

  const totalCalories = entries.reduce((sum, entry) => sum + entry.calories, 0);
  const totalProtein = Math.round(entries.reduce((sum, entry) => sum + entry.protein, 0) * 10) / 10;

  dayCaloriesEl.textContent = totalCalories;
  dayProteinEl.textContent = `${totalProtein} g`;

  if (entries.length === 0) {
    diaryEntries.innerHTML = '<p class="empty">Ingen registreringer for valgt dato.</p>';
    return;
  }

  diaryEntries.innerHTML = entries.map(entry => `
    <div class="diary-card">
      <h3>${escapeHtml(entry.mealType)} , ${escapeHtml(entry.recipeName)}</h3>
      <div class="diary-meta">
        <div><span class="small">Porsjoner</span><strong>${entry.portions}</strong></div>
        <div><span class="small">Kcal</span><strong>${entry.calories}</strong></div>
        <div><span class="small">Protein</span><strong>${entry.protein} g</strong></div>
      </div>
      <div class="diary-actions">
        <button type="button" class="danger" onclick="deleteDiaryEntry('${entry.id}')">Slett</button>
      </div>
    </div>
  `).join('');
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

addIngredientBtn.addEventListener('click', () => addIngredientRow());
saveRecipeBtn.addEventListener('click', saveRecipe);
addToDiaryBtn.addEventListener('click', addDiaryEntry);
recipeServingsInput.addEventListener('input', updatePreview);
diaryDateInput.addEventListener('change', renderDiary);

window.deleteRecipe = deleteRecipe;
window.duplicateRecipe = duplicateRecipe;
window.deleteDiaryEntry = deleteDiaryEntry;

function init() {
  diaryDateInput.value = todayString();
  addIngredientRow();
  addIngredientRow();
  renderRecipes();
  populateRecipeSelect();
  renderDiary();
}

init();
