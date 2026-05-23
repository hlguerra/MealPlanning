// ── js/firebase.js ────────────────────────────────────────────────────────────
// Firebase initialization and Firestore helpers.
// All Firebase interaction goes through this file.

import { initializeApp }                          from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Config ────────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyAGsLTqTtqJ_2ofBvzIHZ18rT74Ifj5MTw",
  authDomain:        "meal-planner-5df26.firebaseapp.com",
  projectId:         "meal-planner-5df26",
  storageBucket:     "meal-planner-5df26.firebasestorage.app",
  messagingSenderId: "591027849531",
  appId:             "1:591027849531:web:16799ab95c09098ebf8f1e",
};

const firebaseApp = initializeApp(firebaseConfig);
const db          = getFirestore(firebaseApp);

// ── Household path helpers ────────────────────────────────────────────────────
// All data is scoped under /households/{householdId}/
// Grocery list  → /households/{id}/grocery/items   (single doc, array of items)
// Recipes       → /households/{id}/recipes/backup  (single doc, array of recipes)
// Cost log      → /households/{id}/costlog/entries (single doc, array of entries)

const householdRef  = id => doc(db, "households", id);
const groceryRef    = id => doc(db, "households", id, "grocery",  "items");
const recipesRef    = id => doc(db, "households", id, "recipes",  "backup");
const costlogRef    = id => doc(db, "households", id, "costlog",  "entries");

// ── Read helpers ──────────────────────────────────────────────────────────────
async function readGrocery(householdId) {
  const snap = await getDoc(groceryRef(householdId));
  return snap.exists() ? (snap.data().items || []) : [];
}

async function readRecipes(householdId) {
  const snap = await getDoc(recipesRef(householdId));
  return snap.exists() ? (snap.data().recipes || []) : [];
}

async function readCostLog(householdId) {
  const snap = await getDoc(costlogRef(householdId));
  return snap.exists() ? (snap.data().entries || []) : [];
}

// ── Write helpers ─────────────────────────────────────────────────────────────
async function writeGrocery(householdId, items) {
  await setDoc(groceryRef(householdId), { items, updatedAt: Date.now() });
}

async function writeRecipes(householdId, recipes) {
  await setDoc(recipesRef(householdId), { recipes, updatedAt: Date.now() });
}

async function writeCostLog(householdId, entries) {
  await setDoc(costlogRef(householdId), { entries, updatedAt: Date.now() });
}

// ── Household existence check ─────────────────────────────────────────────────
// Returns true if the household doc exists in Firestore.
async function householdExists(householdId) {
  const snap = await getDoc(householdRef(householdId));
  return snap.exists();
}

// ── Create household ──────────────────────────────────────────────────────────
// Called when a new household is set up for the first time.
async function createHousehold(householdId, name) {
  await setDoc(householdRef(householdId), {
    name,
    createdAt: Date.now(),
  });
}

// ── Export ────────────────────────────────────────────────────────────────────
window.APP = window.APP || {};
window.APP.firebase = {
  readGrocery,
  readRecipes,
  readCostLog,
  writeGrocery,
  writeRecipes,
  writeCostLog,
  householdExists,
  createHousehold,
};
