/*
 * Main JavaScript for the Inventory Web App
 *
 * This file implements a simple client‑side inventory manager with
 * user authentication, item CRUD operations and CSV export. Data is
 * persisted in the browser’s localStorage and can be easily swapped
 * for a real backend such as Firebase. A service worker is also
 * registered to enable offline access to the application shell.
 */

// Categories will be loaded from localStorage per user. When a user logs in for
// the first time, a default set of categories is created. Categories can be
// added, renamed or deleted via the category management UI.
const DEFAULT_CATEGORIES = [
  'Visseuses',
  'Batteries',
  'Visses autoforeuses',
  'Coupe tubes',
  'Riveteuses',
  'Rivets',
  'EEG',
  'Batteries neuves M/S/ST',
  'Batteries usagées M/S/ST'
];

// Dynamic state: list of categories for the current user and current tab
let categories = [];
let currentTab = 'chantier';

// State variables to keep track of the current user and inventory
let currentUser = null;
let inventory = [];

/* Utility functions for localStorage persistence */
function loadUsers() {
  const users = localStorage.getItem('users');
  return users ? JSON.parse(users) : {};
}

function saveUsers(users) {
  localStorage.setItem('users', JSON.stringify(users));
}

function loadInventoryForUser(email) {
  const data = localStorage.getItem(`inventory_${email}`);
  return data ? JSON.parse(data) : [];
}

function saveInventoryForUser(email, data) {
  localStorage.setItem(`inventory_${email}`, JSON.stringify(data));
}

/* Category persistence functions */
function loadCategoriesForUser(email) {
  const data = localStorage.getItem(`categories_${email}`);
  if (data) {
    return JSON.parse(data);
  }
  // If no categories saved yet, return default set
  return [...DEFAULT_CATEGORIES];
}

function saveCategoriesForUser(email, data) {
  localStorage.setItem(`categories_${email}`, JSON.stringify(data));
}

/* Authentication functions */
function registerUser() {
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;
  if (!email || !password) {
    alert('Veuillez saisir un email et un mot de passe.');
    return;
  }
  const users = loadUsers();
  if (users[email]) {
    alert('Un compte existe déjà avec cet email.');
    return;
  }
  // In a real application, never store plain passwords! Use a proper auth
  // provider such as Firebase Auth. Here we store the password as is for
  // demonstration purposes.
  users[email] = { password };
  saveUsers(users);
  alert('Compte créé avec succès. Vous pouvez maintenant vous connecter.');
  // Clear inputs and switch back to login form
  document.getElementById('register-email').value = '';
  document.getElementById('register-password').value = '';
  showLoginForm();
}

function loginUser() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const users = loadUsers();
  if (!users[email] || users[email].password !== password) {
    alert('Email ou mot de passe incorrect.');
    return;
  }
  currentUser = email;
  inventory = loadInventoryForUser(email);
  categories = loadCategoriesForUser(email);
  // Clear login inputs
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  showApp();
}

function logoutUser() {
  currentUser = null;
  inventory = [];
  categories = [];
  showAuth();
}

/* UI show/hide helper functions */
function showLoginForm() {
  document.getElementById('login-section').style.display = 'block';
  document.getElementById('register-section').style.display = 'none';
}

function showRegisterForm() {
  document.getElementById('login-section').style.display = 'none';
  document.getElementById('register-section').style.display = 'block';
}

function showAuth() {
  document.getElementById('auth').style.display = 'block';
  document.getElementById('app-section').style.display = 'none';
}

function showApp() {
  document.getElementById('auth').style.display = 'none';
  document.getElementById('app-section').style.display = 'block';
  populateCategories();
  renderInventory();
  // Ensure correct tab is active when showing the app
  setActiveTab(currentTab);
}

/* Inventory CRUD functions */
function renderInventory() {
  const tbody = document.querySelector('#inventory-table tbody');
  tbody.innerHTML = '';
  // Preserve the current selected team leader before refreshing the options
  const chefSelectElement = document.getElementById('chef-select');
  const preservedChef = chefSelectElement ? chefSelectElement.value : 'All';
  // Refresh team leader filter options; this will rebuild the options list
  populateChefs();
  // After repopulating options, try to restore the previously selected value
  if (chefSelectElement && preservedChef && Array.from(chefSelectElement.options).some(opt => opt.value === preservedChef)) {
    chefSelectElement.value = preservedChef;
  }
  // Now compute filters
  const selectedCategory = document.getElementById('category-select').value;
  const selectedChef = chefSelectElement ? chefSelectElement.value : 'All';
  const searchTerm = document.getElementById('search-input').value.trim().toLowerCase();
  inventory.forEach((item, index) => {
    // Filter by location (tab) first
    if (item.location !== currentTab) {
      return;
    }
    // Filter by category
    if (selectedCategory !== 'All' && item.category !== selectedCategory) {
      return;
    }
    // Filter by chef
    if (selectedChef !== 'All' && (item.chef || '') !== selectedChef) {
      return;
    }
    // Filter by search term on name or site
    if (searchTerm && !item.name.toLowerCase().includes(searchTerm) && !(item.site || '').toLowerCase().includes(searchTerm)) {
      return;
    }
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.name}</td>
      <td>${item.category}</td>
      <td>${item.quantity}</td>
      <td>${item.date || ''}</td>
      <td>${item.site || ''}</td>
      <td>${item.chef || ''}</td>
      <td>${item.location}</td>
      <td class="actions">
        <button class="secondary" onclick="openItemModal(${index})">Modifier</button>
        <button class="secondary" onclick="deleteItem(${index})">Supprimer</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openItemModal(index) {
  const modal = document.getElementById('item-modal');
  const title = document.getElementById('modal-title');
  const nameInput = document.getElementById('item-name');
  const categorySelect = document.getElementById('item-category-select');
  const quantityInput = document.getElementById('item-quantity');
  const dateInput = document.getElementById('item-date');
  const siteInput = document.getElementById('item-site');
  const chefInput = document.getElementById('item-chef');
  const locationSelect = document.getElementById('item-location');
  modal.style.display = 'flex';
  // If index is provided, edit existing item
  // Determine whether we're editing an existing item. In JavaScript,
  // comparing `null >= 0` evaluates to true, so we must explicitly check
  // that `index` is not null and is a number.
  if (typeof index === 'number' && index >= 0) {
    const item = inventory[index];
    title.textContent = 'Modifier l’article';
    nameInput.value = item.name;
    categorySelect.value = item.category;
    quantityInput.value = item.quantity;
    dateInput.value = item.date || '';
    siteInput.value = item.site || '';
    chefInput.value = item.chef || '';
    locationSelect.value = item.location || 'chantier';
    // Save handler updates existing item
    document.getElementById('save-item-button').onclick = () => {
      saveItem(index);
    };
  } else {
    // New item
    title.textContent = 'Nouvel article';
    nameInput.value = '';
    categorySelect.value = categories.length ? categories[0] : '';
    quantityInput.value = '';
    dateInput.value = '';
    siteInput.value = '';
    chefInput.value = '';
    locationSelect.value = currentTab;
    document.getElementById('save-item-button').onclick = () => {
      saveItem(null);
    };
  }
}

function closeItemModal() {
  document.getElementById('item-modal').style.display = 'none';
}

function saveItem(index) {
  const name = document.getElementById('item-name').value.trim();
  const category = document.getElementById('item-category-select').value;
  const quantity = parseInt(document.getElementById('item-quantity').value, 10);
  const date = document.getElementById('item-date').value;
  const site = document.getElementById('item-site').value.trim();
  const chef = document.getElementById('item-chef').value.trim();
  const location = document.getElementById('item-location').value;
  if (!name) {
    alert('Veuillez saisir un nom pour l’article.');
    return;
  }
  if (isNaN(quantity) || quantity < 0) {
    alert('Veuillez saisir une quantité valide.');
    return;
  }
  if (index !== null && index >= 0) {
    // Update existing item
    inventory[index] = { name, category, quantity, date, site, chef, location };
  } else {
    // Add new item
    inventory.push({ name, category, quantity, date, site, chef, location });
  }
  saveInventoryForUser(currentUser, inventory);
  closeItemModal();
  renderInventory();
}

function deleteItem(index) {
  if (confirm('Supprimer cet article ?')) {
    inventory.splice(index, 1);
    saveInventoryForUser(currentUser, inventory);
    renderInventory();
  }
}

function exportCSV() {
  if (!inventory.length) {
    alert('Aucun article à exporter.');
    return;
  }
  const rows = [ ['Nom', 'Catégorie', 'Quantité', 'Date', 'Chantier', "Chef d’équipe", 'Lieu'] ];
  inventory.forEach(item => {
    // Export only items visible in the current tab
    if (item.location !== currentTab) return;
    rows.push([
      item.name,
      item.category,
      item.quantity,
      item.date || '',
      item.site || '',
      item.chef || '',
      item.location
    ]);
  });
  const csvContent = rows.map(e => e.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inventaire_${currentUser}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* Populate category options for selects */
function populateCategories() {
  const catSelect = document.getElementById('category-select');
  const modalCatSelect = document.getElementById('item-category-select');
  // Clear existing options
  catSelect.innerHTML = '';
  modalCatSelect.innerHTML = '';
  // Add "All" option to category filter
  const allOption = document.createElement('option');
  allOption.value = 'All';
  allOption.textContent = 'Toutes';
  catSelect.appendChild(allOption);
  categories.forEach(cat => {
    // Category filter option
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    catSelect.appendChild(option);
    // Modal select option
    const modalOption = document.createElement('option');
    modalOption.value = cat;
    modalOption.textContent = cat;
    modalCatSelect.appendChild(modalOption);
  });
}

/* Populate team leader options for filter */
function populateChefs() {
  const chefSelect = document.getElementById('chef-select');
  if (!chefSelect) return;
  // Build unique list of team leaders for current tab
  const chefs = new Set();
  inventory.forEach(item => {
    if (item.location === currentTab && item.chef) {
      chefs.add(item.chef);
    }
  });
  // Preserve currently selected value
  const previous = chefSelect.value;
  // Clear existing options
  chefSelect.innerHTML = '';
  // Add "All" option
  const allOption = document.createElement('option');
  allOption.value = 'All';
  allOption.textContent = 'Tous';
  chefSelect.appendChild(allOption);
  chefs.forEach(chef => {
    const opt = document.createElement('option');
    opt.value = chef;
    opt.textContent = chef;
    chefSelect.appendChild(opt);
  });
  // Restore previously selected value if still available
  if (previous && Array.from(chefSelect.options).some(opt => opt.value === previous)) {
    chefSelect.value = previous;
  }
}

/* Service worker registration for offline support */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js')
        .catch(err => {
          console.error('Service worker registration failed:', err);
        });
    });
  }
}

/* Event listeners registration */
function setupEventListeners() {
  document.getElementById('login-button').addEventListener('click', loginUser);
  document.getElementById('register-button').addEventListener('click', registerUser);
  document.getElementById('logout-button').addEventListener('click', logoutUser);
  document.getElementById('show-register').addEventListener('click', (e) => {
    e.preventDefault();
    showRegisterForm();
  });
  document.getElementById('show-login').addEventListener('click', (e) => {
    e.preventDefault();
    showLoginForm();
  });
  document.getElementById('category-select').addEventListener('change', renderInventory);
  const chefSelectEl = document.getElementById('chef-select');
  if (chefSelectEl) {
    chefSelectEl.addEventListener('change', renderInventory);
  }
  document.getElementById('search-input').addEventListener('input', renderInventory);
  document.getElementById('add-item-button').addEventListener('click', () => {
    openItemModal(null);
  });
  document.getElementById('cancel-item-button').addEventListener('click', () => {
    closeItemModal();
  });
  document.getElementById('export-button').addEventListener('click', exportCSV);
  // Close modal when clicking outside content
  document.getElementById('item-modal').addEventListener('click', (e) => {
    if (e.target.id === 'item-modal') {
      closeItemModal();
    }
  });

  // Tabs navigation
  document.getElementById('tab-chantier').addEventListener('click', () => {
    currentTab = 'chantier';
    setActiveTab('chantier');
    renderInventory();
  });
  document.getElementById('tab-atelier').addEventListener('click', () => {
    currentTab = 'atelier';
    setActiveTab('atelier');
    renderInventory();
  });

  // Category management button
  document.getElementById('manage-categories-button').addEventListener('click', () => {
    openCategoryModal();
  });
  document.getElementById('close-category-button').addEventListener('click', () => {
    closeCategoryModal();
  });
  document.getElementById('add-category-button').addEventListener('click', () => {
    addCategory();
  });
  // Close category modal when clicking outside content
  document.getElementById('category-modal').addEventListener('click', (e) => {
    if (e.target.id === 'category-modal') {
      closeCategoryModal();
    }
  });
}

/* Category management functions */
function openCategoryModal() {
  const modal = document.getElementById('category-modal');
  modal.style.display = 'flex';
  renderCategoryList();
}

function closeCategoryModal() {
  document.getElementById('category-modal').style.display = 'none';
}

function renderCategoryList() {
  const list = document.getElementById('category-list');
  list.innerHTML = '';
  categories.forEach((cat, index) => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = cat;
    li.appendChild(span);
    const btnRename = document.createElement('button');
    btnRename.className = 'secondary';
    btnRename.textContent = 'Renommer';
    btnRename.onclick = () => renameCategory(index);
    const btnDelete = document.createElement('button');
    btnDelete.className = 'secondary';
    btnDelete.textContent = 'Supprimer';
    btnDelete.onclick = () => deleteCategory(index);
    li.appendChild(btnRename);
    li.appendChild(btnDelete);
    list.appendChild(li);
  });
}

function addCategory() {
  const newNameInput = document.getElementById('new-category-name');
  const name = newNameInput.value.trim();
  if (!name) {
    alert('Veuillez saisir un nom pour la catégorie.');
    return;
  }
  if (categories.includes(name)) {
    alert('Cette catégorie existe déjà.');
    return;
  }
  categories.push(name);
  saveCategoriesForUser(currentUser, categories);
  populateCategories();
  renderCategoryList();
  newNameInput.value = '';
}

function renameCategory(index) {
  const oldName = categories[index];
  const newName = prompt('Nouveau nom pour la catégorie :', oldName);
  if (!newName || newName.trim() === '' || newName === oldName) {
    return;
  }
  if (categories.includes(newName)) {
    alert('Une catégorie avec ce nom existe déjà.');
    return;
  }
  // Update category name
  categories[index] = newName;
  // Update all items referencing this category
  inventory.forEach(item => {
    if (item.category === oldName) {
      item.category = newName;
    }
  });
  saveCategoriesForUser(currentUser, categories);
  saveInventoryForUser(currentUser, inventory);
  populateCategories();
  renderCategoryList();
  renderInventory();
}

function deleteCategory(index) {
  const name = categories[index];
  // Prevent deletion if any item uses this category
  const used = inventory.some(item => item.category === name);
  if (used) {
    alert('Impossible de supprimer cette catégorie car elle est utilisée par un article.');
    return;
  }
  if (confirm('Supprimer la catégorie ?')) {
    categories.splice(index, 1);
    saveCategoriesForUser(currentUser, categories);
    populateCategories();
    renderCategoryList();
  }
}

/* Helper to set active tab visually */
function setActiveTab(tab) {
  const chantierBtn = document.getElementById('tab-chantier');
  const atelierBtn = document.getElementById('tab-atelier');
  chantierBtn.classList.remove('active');
  atelierBtn.classList.remove('active');
  if (tab === 'chantier') {
    chantierBtn.classList.add('active');
  } else if (tab === 'atelier') {
    atelierBtn.classList.add('active');
  }
}

/* Initialize the application on page load */
function init() {
  registerServiceWorker();
  setupEventListeners();
  showLoginForm();
}

// Initialise the app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);