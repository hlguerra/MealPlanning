// ── js/firebase.js ────────────────────────────────────────────────────────────
// Firebase helpers are initialized in index.html as an ES module
// because Firestore functions (doc, getDoc, setDoc) must stay in module scope.
//
// All helpers are attached to window.APP.firebase in index.html:
//
//   readGrocery(id)          → Promise<items[]>
//   writeGrocery(id, items)  → Promise<void>
//   readRecipes(id)          → Promise<recipes[]>
//   writeRecipes(id, recipes)→ Promise<void>
//   readCostLog(id)          → Promise<entries[]>
//   writeCostLog(id,entries) → Promise<void>
//   readSpending(id)         → Promise<entries[]>
//   writeSpending(id,entries)→ Promise<void>
//   readCookHistory(id)      → Promise<entries[]>
//   writeCookHistory(id,e)   → Promise<void>
//   householdExists(id)      → Promise<boolean>
//   createHousehold(id,name) → Promise<void>
//
// To add a new collection, add read/write helpers in index.html
// following the same pattern, then add sync callbacks in sync.js.
