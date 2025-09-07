/*
 * Inventaire partagé (tous les utilisateurs authentifiés voient/éditent tout).
 * Firestore : lecture via collectionGroup('items'), édition/suppression via chemin complet.
 * Créations rangées sous users/{currentUser}/items.
 */

/* ------------------------------- Constantes -------------------------------- */

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

const auth = typeof firebase !== 'undefined' ? firebase.auth() : null;
const db   = typeof firebase !== 'undefined' ? firebase.firestore() : null;

/* --------------------------------- État ----------------------------------- */

let categories = [];
let currentTab = 'chantier';
let currentUser = null;
let inventory = [];
let unsubscribeInventory = null;
let editingItemPath = null; // ex: "users/uid/items/docId"

/* -------------------------------- Helpers --------------------------------- */

function on(id, evt, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(evt, handler);
}

function $(selector) {
  return document.querySelector(selector);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/* --------------------------- Catégories (par user) ------------------------- */

async function loadCategoriesFromFirestore() {
  if (!currentUser) return;
  if (!db) {
    console.error('Firestore non initialisé. Catégories par défaut.');
    categories = [...DEFAULT_CATEGORIES];
    return;
  }
  try {
    const docRef = db.collection('users').doc(currentUser);
    const snap = await docRef.get();
    if (snap.exists) {
      const data = snap.data();
      categories = Array.isArray(data?.categories) ? data.categories : [...DEFAULT_CATEGORIES];
      if (!Array.isArray(data?.categories)) {
        await docRef.set({ categories }, { merge: true });
      }
    } else {
      categories = [...DEFAULT_CATEGORIES];
      await docRef.set({ categories });
    }
  } catch (err) {
    console.error('Erreur chargement catégories :', err);
    categories = [...DEFAULT_CATEGORIES];
  }
}

async function saveCategoriesToFirestore() {
  if (!currentUser || !db) return;
  try {
    await db.collection('users').doc(currentUser).set({ categories }, { merge: true });
  } catch (err) {
    console.error('Erreur enregistrement catégories :', err);
  }
}

/* ----------------------------- Inventaire partagé -------------------------- */

function subscribeToInventory() {
  if (!db) {
    console.error('Firestore non initialisé. Abonnement ignoré.');
    return;
  }
  if (typeof unsubscribeInventory === 'function') unsubscribeInventory();

  // Lecture de TOUS les items (tous les utilisateurs)
  unsubscribeInventory = db
    .collectionGroup('items')
    .onSnapshot(
      (snapshot) => {
        const items = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, path: doc.ref.path, ...doc.data() });
        });
        inventory = items;
        renderInventory();
      },
      (error) => console.error('Erreur sync inventaire :', error)
    );
}

/* --------------------------------- Auth ----------------------------------- */

async function registerUser() {
  const email = (document.getElementById('register-email')?.value || '').trim();
  const password = document.getElementById('register-password')?.value || '';
  if (!email || !password) { alert('Saisis un email et un mot de passe.'); return; }
  if (!auth || !db) { alert('Firebase non initialisé.'); return; }

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    currentUser = cred.user.uid;
    categories = [...DEFAULT_CATEGORIES];
    await db.collection('users').doc(currentUser).set({ categories });
    alert('Compte créé. Tu peux te connecter.');
    await auth.signOut();
    currentUser = null;
    const re = document.getElementById('register-email');
    const rp = document.getElementById('register-password');
    if (re) re.value = '';
    if (rp) rp.value = '';
    showLoginForm();
  } catch (error) {
    alert('Erreur création compte : ' + error.message);
  }
}

async function loginUser() {
  const email = (document.getElementById('login-email')?.value || '').trim();
  const password = document.getElementById('login-password')?.value || '';
  if (!email || !password) { alert('Saisis un email et un mot de passe.'); return; }
  if (!auth) { alert('Firebase Auth non initialisé.'); return; }

  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    currentUser = cred.user.uid;
    const le = document.getElementById('login-email');
    const lp = document.getElementById('login-password');
    if (le) le.value = '';
    if (lp) lp.value = '';
    await loadCategoriesFromFirestore();
    subscribeToInventory();
    showApp();
  } catch (error) {
    alert('Erreur connexion : ' + error.message);
  }
}

async function logoutUser() {
  try { if (auth) await auth.signOut(); } catch (e) { console.error(e); }
  currentUser = null;
  inventory = [];
  categories = [];
  if (typeof unsubscribeInventory === 'function') { unsubscribeInventory(); unsubscribeInventory = null; }
  showAuth();
}

/* ----------------------------- UI: show/hide ------------------------------- */

function showLoginForm() {
  const login = document.getElementById('login-section');
  const register = document.getElementById('register-section');
  if (login) login.style.display = 'block';
  if (register) register.style.display = 'none';
}

function showRegisterForm() {
  const login = document.getElementById('login-section');
  const register = document.getElementById('register-section');
  if (login) login.style.display = 'none';
  if (register) register.style.display = 'block';
}

function showAuth() {
  const authEl = document.getElementById('auth');
  const app = document.getElementById('app-section');
  if (authEl) authEl.style.display = 'block';
  if (app) app.style.display = 'none';
}

function showApp() {
  const authEl = document.getElementById('auth');
  const app = document.getElementById('app-section');
  if (authEl) authEl.style.display = 'none';
  if (app) app.style.display = 'block';
  populateCategories();
  renderInventory();
  setActiveTab(currentTab);
}

/* ------------------------------ Rendu table -------------------------------- */

function renderInventory() {
  const tbody = $('#inventory-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  // Mémoriser le chef sélectionné, régénérer, puis restaurer
  const chefSelectElement = document.getElementById('chef-select');
  const preservedChef = chefSelectElement ? chefSelectElement.value : 'All';
  populateChefs();
  if (chefSelectElement && preservedChef && Array.from(chefSelectElement.options).some(opt => opt.value === preservedChef)) {
    chefSelectElement.value = preservedChef;
  }

  const selectedCategory = document.getElementById('category-select')?.value || 'All';
  const selectedChef = chefSelectElement ? chefSelectElement.value : 'All';
  const searchTerm = (document.getElementById('search-input')?.value || '').trim().toLowerCase();

  let visibleCount = 0;

  inventory.forEach((item) => {
    if (item.location !== currentTab) return;
    if (selectedCategory !== 'All' && item.category !== selectedCategory) return;
    if (selectedChef !== 'All' && (item.chef || '') !== selectedChef) return;
    if (searchTerm && !((item.name || '').toLowerCase().includes(searchTerm) || (item.site || '').toLowerCase().includes(searchTerm))) return;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(item.name || '')}</td>
      <td>${escapeHtml(item.category || '')}</td>
      <td>${Number.isFinite(item.quantity) ? item.quantity : ''}</td>
      <td>${escapeHtml(item.date || '')}</td>
      <td>${escapeHtml(item.site || '')}</td>
      <td>${escapeHtml(item.chef || '')}</td>
      <td>${escapeHtml(item.location || '')}</td>
      <td class="actions">
        <button class="secondary" data-action="edit" data-path="${item.path}">Modifier</button>
        <button class="secondary" data-action="delete" data-path="${item.path}">Supprimer</button>
      </td>
    `;
    tbody.appendChild(tr);
    visibleCount++;
  });

  const emptyMsg = document.getElementById('empty-message');
  if (emptyMsg) emptyMsg.style.display = visibleCount ? 'none' : 'block';
}

/* ------------------------------ Modale article ----------------------------- */

function openItemModal(itemPath = null) {
  const modal = document.getElementById('item-modal');
  if (!modal) return;

  const title = document.getElementById('modal-title');
  const nameInput = document.getElementById('item-name');
  const categorySelect = document.getElementById('item-category-select');
  const quantityInput = document.getElementById('item-quantity');
  const dateInput = document.getElementById('item-date');
  const siteInput = document.getElementById('item-site');
  const chefInput = document.getElementById('item-chef');
  const locationSelect = document.getElementById('item-location');

  modal.style.display = 'flex';
  editingItemPath = itemPath;

  if (itemPath) {
    const item = inventory.find(i => i.path === itemPath);
    if (!item) { alert('Article introuvable.'); closeItemModal(); return; }
    if (title) title.textContent = 'Modifier l’article';
    if (nameInput) nameInput.value = item.name || '';
    if (categorySelect) categorySelect.value = item.category || (categories[0] || '');
    if (quantityInput) quantityInput.value = Number.isFinite(item.quantity) ? item.quantity : '';
    if (dateInput) dateInput.value = item.date || '';
    if (siteInput) siteInput.value = item.site || '';
    if (chefInput) chefInput.value = item.chef || '';
    if (locationSelect) locationSelect.value = item.location || 'chantier';
  } else {
    if (title) title.textContent = 'Nouvel article';
    if (nameInput) nameInput.value = '';
    if (categorySelect) categorySelect.value = categories.length ? categories[0] : '';
    if (quantityInput) quantityInput.value = '';
    if (dateInput) dateInput.value = '';
    if (siteInput) siteInput.value = '';
    if (chefInput) chefInput.value = '';
    if (locationSelect) locationSelect.value = currentTab;
  }

  const saveBtn = document.getElementById('save-item-button');
  if (saveBtn) saveBtn.onclick = () => saveItem();
}

function closeItemModal() {
  const modal = document.getElementById('item-modal');
  if (modal) modal.style.display = 'none';
  editingItemPath = null;
}

async function saveItem() {
  const name = (document.getElementById('item-name')?.value || '').trim();
  const category = document.getElementById('item-category-select')?.value || '';
  const quantityRaw = document.getElementById('item-quantity')?.value || '';
  const date = document.getElementById('item-date')?.value || '';
  const site = (document.getElementById('item-site')?.value || '').trim();
  const chef = (document.getElementById('item-chef')?.value || '').trim();
  const location = document.getElementById('item-location')?.value || currentTab;

  if (!name) { alert('Saisis un nom.'); return; }
  const quantity = parseInt(quantityRaw, 10);
  if (!Number.isFinite(quantity) || quantity < 0) { alert('Quantité invalide.'); return; }
  if (!db) { alert('Firestore non initialisé.'); return; }

  const itemData = { name, category, quantity, date, site, chef, location };

  try {
    if (editingItemPath) {
      await db.doc(editingItemPath).set(itemData);
    } else {
      if (!currentUser) { alert('Aucun utilisateur connecté.'); return; }
      await db.collection('users').doc(currentUser).collection('items').add(itemData);
    }
    closeItemModal();
  } catch (err) {
    console.error('Erreur enregistrement article :', err);
    alert('Impossible d’enregistrer l’article.');
  }
}

async function deleteItem(itemPath) {
  if (!itemPath) return;
  if (!confirm('Supprimer cet article ?')) return;
  if (!db) { alert('Firestore non initialisé.'); return; }
  try {
    await db.doc(itemPath).delete();
  } catch (err) {
    console.error('Erreur suppression article :', err);
    alert('Impossible de supprimer l’article.');
  }
}

/* -------------------------------- Export CSV ------------------------------- */

function exportCSV() {
  if (!inventory.length) { alert('Aucun article à exporter.'); return; }
  const rows = [['Nom','Catégorie','Quantité','Date','Chantier',"Chef d’équipe",'Lieu']];
  let exported = 0;
  inventory.forEach(item => {
    if (item.location !== currentTab) return;
    rows.push([
      item.name || '',
      item.category || '',
      Number.isFinite(item.quantity) ? item.quantity : '',
      item.date || '',
      item.site || '',
      item.chef || '',
      item.location || ''
    ]);
    exported++;
  });
  if (!exported) { alert('Aucun article à exporter pour l’onglet courant.'); return; }
  const csvContent = rows
    .map(e => e.map(v => String(v).includes(',') ? `"${String(v).replaceAll('"','""')}"` : v).join(','))
    .join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inventaire_partage_${currentTab}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* -------------------------- Selects catégories/chefs ----------------------- */

function populateCategories() {
  const catSelect = document.getElementById('category-select');
  const modalCatSelect = document.getElementById('item-category-select');
  if (!catSelect && !modalCatSelect) return;

  if (catSelect) {
    catSelect.innerHTML = '';
    const allOption = document.createElement('option');
    allOption.value = 'All';
    allOption.textContent = 'Toutes';
    catSelect.appendChild(allOption);
  }
  if (modalCatSelect) modalCatSelect.innerHTML = '';

  categories.forEach(cat => {
    if (catSelect) {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      catSelect.appendChild(opt);
    }
    if (modalCatSelect) {
      const mopt = document.createElement('option');
      mopt.value = cat;
      mopt.textContent = cat;
      modalCatSelect.appendChild(mopt);
    }
  });
}

function populateChefs() {
  const chefSelect = document.getElementById('chef-select');
  if (!chefSelect) return;
  const chefs = new Set();
  inventory.forEach(item => {
    if (item.location === currentTab && item.chef) chefs.add(item.chef);
  });
  const previous = chefSelect.value;
  chefSelect.innerHTML = '';
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
  if (previous && Array.from(chefSelect.options).some(opt => opt.value === previous)) {
    chefSelect.value = previous;
  }
}

/* ---------------------------- Gestion catégories --------------------------- */

function openCategoryModal() {
  const modal = document.getElementById('category-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  renderCategoryList();
}

function closeCategoryModal() {
  const modal = document.getElementById('category-modal');
  if (modal) modal.style.display = 'none';
}

function renderCategoryList() {
  const list = document.getElementById('category-list');
  if (!list) return;
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
  const name = (newNameInput?.value || '').trim();
  if (!name) { alert('Nom de catégorie requis.'); return; }
  if (categories.includes(name)) { alert('Catégorie déjà existante.'); return; }
  categories.push(name);
  saveCategoriesToFirestore();
  populateCategories();
  renderCategoryList();
  if (newNameInput) newNameInput.value = '';
}

function renameCategory(index) {
  const oldName = categories[index];
  const newName = prompt('Nouveau nom de catégorie :', oldName);
  if (!newName || newName.trim() === '' || newName === oldName) return;
  if (categories.includes(newName)) { alert('Ce nom existe déjà.'); return; }
  categories[index] = newName;

  // Mettre à jour les articles du user courant uniquement
  if (db && currentUser) {
    inventory.forEach(item => {
      if (item.category === oldName && typeof item.path === 'string' && item.path.startsWith(`users/${currentUser}/items/`)) {
        db.doc(item.path).update({ category: newName }).catch(err => console.error('Erreur maj catégorie article :', err));
      }
    });
  }

  saveCategoriesToFirestore();
  populateCategories();
  renderCategoryList();
}

function deleteCategory(index) {
  const name = categories[index];
  const used = inventory.some(item => item.category === name && item.path?.startsWith(`users/${currentUser}/items/`));
  if (used) { alert('Catégorie utilisée par au moins un de tes articles.'); return; }
  if (confirm('Supprimer la catégorie ?')) {
    categories.splice(index, 1);
    saveCategoriesToFirestore();
    populateCategories();
    renderCategoryList();
  }
}

/* --------------------------------- Tabs ----------------------------------- */

function setActiveTab(tab) {
  const chantierBtn = document.getElementById('tab-chantier');
  const atelierBtn = document.getElementById('tab-atelier');
  if (chantierBtn) chantierBtn.classList.remove('active');
  if (atelierBtn) atelierBtn.classList.remove('active');
  if (tab === 'chantier' && chantierBtn) chantierBtn.classList.add('active');
  if (tab === 'atelier' && atelierBtn) atelierBtn.classList.add('active');
}

/* --------------------------- Service worker (PWA) -------------------------- */

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js')
        .catch(err => console.error('Service worker registration failed:', err));
    });
  }
}

/* ------------------------------ Événements -------------------------------- */

function setupEventListeners() {
  on('login-button', 'click', loginUser);
  on('register-button', 'click', registerUser);
  on('logout-button', 'click', logoutUser);

  on('show-register', 'click', (e) => { e.preventDefault(); showRegisterForm(); });
  on('show-login',    'click', (e) => { e.preventDefault(); showLoginForm(); });

  on('category-select', 'change', renderInventory);
  on('chef-select',     'change', renderInventory);
  on('search-input',    'input',  renderInventory);

  on('add-item-button',    'click', () => openItemModal(null));
  on('cancel-item-button', 'click', closeItemModal);
  on('export-button',      'click', exportCSV);

  on('item-modal', 'click', (e) => { if (e.target.id === 'item-modal') closeItemModal(); });

  on('tab-chantier', 'click', () => { currentTab = 'chantier'; setActiveTab('chantier'); renderInventory(); });
  on('tab-atelier',  'click', () => { currentTab = 'atelier';  setActiveTab('atelier');  renderInventory(); });

  on('manage-categories-button', 'click', openCategoryModal);
  on('close-category-button',    'click', closeCategoryModal);
  on('add-category-button',      'click', addCategory);
  on('category-modal', 'click', (e) => { if (e.target.id === 'category-modal') closeCategoryModal(); });

  // Délégation sur le tableau
  const tbody = $('#inventory-table tbody');
  if (tbody) {
    tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      const path = btn.getAttribute('data-path');
      if (action === 'edit') openItemModal(path);
      if (action === 'delete') deleteItem(path);
    });
  }
}

/* --------------------------------- Init ----------------------------------- */

function init() {
  registerServiceWorker();
  setupEventListeners();
  showAuth();
  showLoginForm();
}

document.addEventListener('DOMContentLoaded', init);
