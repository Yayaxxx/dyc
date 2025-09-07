/*
 * Main JavaScript for the Inventory Web App
 *
 * Gestion d’inventaire client-side avec Auth, CRUD d’articles,
 * export CSV et préparation Firestore. Ajout de gardes robustes
 * (DOM/Firebase), délégation d’événements, et boutons basés sur
 * l’ID Firestore (pas d’index fragile).
 */

/* ---------------------------------- Données -------------------------------- */

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

// Références Firebase (compat ou modulaire via global firebase)
const auth = typeof firebase !== 'undefined' ? firebase.auth() : null;
const db   = typeof firebase !== 'undefined' ? firebase.firestore() : null;

// État dynamique
let categories = [];
let currentTab = 'chantier';
let currentUser = null;
let inventory = [];
let unsubscribeInventory = null;

// ID de l’article en cours d’édition (null si création)
let editingItemId = null;

/* ----------------------------- Helpers généraux ---------------------------- */

// Attache un listener sans crasher si l’élément est absent
function on(id, evt, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(evt, handler);
}

function $(selector) {
  return document.querySelector(selector);
}

/* --------------------------- Firestore: Catégories ------------------------- */

async function loadCategoriesFromFirestore() {
  if (!currentUser) return;
  if (!db) {
    console.error('Firestore non initialisé. Catégories par défaut chargées.');
    categories = [...DEFAULT_CATEGORIES];
    return;
  }
  try {
    const docRef = db.collection('users').doc(currentUser);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      const data = docSnap.data();
      if (data && Array.isArray(data.categories)) {
        categories = data.categories;
      } else {
        categories = [...DEFAULT_CATEGORIES];
        await docRef.set({ categories }, { merge: true });
      }
    } else {
      categories = [...DEFAULT_CATEGORIES];
      await docRef.set({ categories });
    }
  } catch (err) {
    console.error('Erreur chargement catégories Firestore :', err);
    categories = [...DEFAULT_CATEGORIES];
  }
}

async function saveCategoriesToFirestore() {
  if (!currentUser) return;
  if (!db) {
    console.error('Firestore non initialisé. Sauvegarde catégories ignorée.');
    return;
  }
  try {
    await db.collection('users').doc(currentUser).set({ categories }, { merge: true });
  } catch (err) {
    console.error('Erreur enregistrement catégories :', err);
  }
}

/* --------------------------- Firestore: Inventaire ------------------------- */

function subscribeToInventory() {
  if (!currentUser) return;
  if (!db) {
    console.error('Firestore non initialisé. Abonnement inventaire ignoré.');
    return;
  }
  // Annuler l’abonnement précédent si présent
  if (typeof unsubscribeInventory === 'function') unsubscribeInventory();

  unsubscribeInventory = db
    .collection('users')
    .doc(currentUser)
    .collection('items')
    .onSnapshot(
      (snapshot) => {
        const items = [];
        snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() }));
        inventory = items;
        renderInventory();
      },
      (error) => {
        console.error('Erreur sync inventaire :', error);
      }
    );
}

/* ------------------------------- Auth Firebase ----------------------------- */

async function registerUser() {
  const email = (document.getElementById('register-email')?.value || '').trim();
  const password = document.getElementById('register-password')?.value || '';
  if (!email || !password) {
    alert('Veuillez saisir un email et un mot de passe.');
    return;
  }
  if (!auth || !db) {
    alert('Firebase non initialisé (Auth/Firestore).');
    return;
  }
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    currentUser = cred.user.uid;
    categories = [...DEFAULT_CATEGORIES];
    await db.collection('users').doc(currentUser).set({ categories });
    alert('Compte créé avec succès. Vous pouvez maintenant vous connecter.');
    await auth.signOut();
    currentUser = null;
    const re = document.getElementById('register-email');
    const rp = document.getElementById('register-password');
    if (re) re.value = '';
    if (rp) rp.value = '';
    showLoginForm();
  } catch (error) {
    alert('Erreur lors de la création du compte : ' + error.message);
  }
}

async function loginUser() {
  const email = (document.getElementById('login-email')?.value || '').trim();
  const password = document.getElementById('login-password')?.value || '';
  if (!email || !password) {
    alert('Veuillez saisir un email et un mot de passe.');
    return;
  }
  if (!auth) {
    alert('Firebase Auth n’est pas initialisé.');
    return;
  }
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
    alert('Erreur lors de la connexion : ' + error.message);
  }
}

async function logoutUser() {
  try {
    if (auth) await auth.signOut();
  } catch (error) {
    console.error('Erreur lors de la déconnexion :', error);
  }
  currentUser = null;
  inventory = [];
  categories = [];
  if (typeof unsubscribeInventory === 'function') {
    unsubscribeInventory();
    unsubscribeInventory = null;
  }
  showAuth();
}

/* ---------------------------- UI show/hide helpers ------------------------- */

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
  const app = document.getElem
