// ── js/sync.js ────────────────────────────────────────────────────────────────
// Handles all Firebase sync logic.
// - Reads from Firestore on app open
// - Firebase always wins on conflict
// - Manual refresh via returned sync function
// - Debounced push after local changes

window.APP = window.APP || {};

// ── Sync status ───────────────────────────────────────────────────────────────
window.APP.syncStatus = {
  lastSynced: null,
  syncing:    false,
  error:      null,
  enabled:    false,
};

function setStatus(patch) {
  Object.assign(window.APP.syncStatus, patch);
  if (typeof window.APP.onSyncStatusChange === "function") {
    window.APP.onSyncStatusChange({ ...window.APP.syncStatus });
  }
}

// ── Pull from Firebase ────────────────────────────────────────────────────────
async function pullFromFirebase(householdId, callbacks) {
  const {
    setGroceryList, setRecipes, setCostLog,
    setSpending, setCookHistory, setMealPlan,
  } = callbacks;
  const fb = window.APP.firebase;

  setStatus({ syncing: true, error: null });

  try {
    const [grocery, recipes, costlog, spending, cookhistory, mealplan] = await Promise.all([
      fb.readGrocery(householdId),
      fb.readRecipes(householdId),
      fb.readCostLog(householdId),
      fb.readSpending(householdId),
      fb.readCookHistory(householdId),
      fb.readMealPlan(householdId),
    ]);

    setGroceryList(grocery);
    setRecipes(recipes);
    setCostLog(costlog);
    setSpending(spending);
    setCookHistory(cookhistory);
    if (setMealPlan) setMealPlan(mealplan);

    setStatus({ syncing: false, lastSynced: new Date(), error: null });
  } catch (e) {
    setStatus({ syncing: false, error: "Sync failed. Check your connection." });
    console.error("Firebase pull error:", e);
  }
}

// ── Push to Firebase ──────────────────────────────────────────────────────────
async function pushToFirebase(householdId, data) {
  const { groceryList, recipes, costLog, spending, cookHistory, mealPlan } = data;
  const fb = window.APP.firebase;

  setStatus({ syncing: true, error: null });

  try {
    await Promise.all([
      fb.writeGrocery(householdId, groceryList),
      fb.writeRecipes(householdId, recipes),
      fb.writeCostLog(householdId, costLog),
      fb.writeSpending(householdId, spending),
      fb.writeCookHistory(householdId, cookHistory),
      fb.writeMealPlan(householdId, mealPlan || []),
    ]);
    setStatus({ syncing: false, lastSynced: new Date(), error: null });
  } catch (e) {
    setStatus({ syncing: false, error: "Sync failed. Check your connection." });
    console.error("Firebase push error:", e);
  }
}

// ── Sync manager ──────────────────────────────────────────────────────────────
// Call once on app load. Returns a manual sync function.
window.APP.startSync = function(householdId, callbacks) {
  if (!householdId) {
    setStatus({ enabled: false });
    return null;
  }

  setStatus({ enabled: true });

  // Pull once on app open
  pullFromFirebase(householdId, callbacks);

  // Return manual sync function for the refresh button
  return () => pullFromFirebase(householdId, callbacks);
};

// ── Debounced push ────────────────────────────────────────────────────────────
// Call after any local state change that should persist to Firebase.
// Waits 1.5s after last change before writing.
let pushTimer = null;
window.APP.schedulePush = function(householdId, data) {
  if (!householdId) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => pushToFirebase(householdId, data), 1500);
};

// ── Household ID generator ────────────────────────────────────────────────────
window.APP.generateHouseholdId = function() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
};

// ── useSyncStatus hook ────────────────────────────────────────────────────────
const { useState, useEffect, createElement: h } = React;

window.APP.useSyncStatus = function() {
  const [status, setStatus_] = useState({ ...window.APP.syncStatus });

  useEffect(() => {
    window.APP.onSyncStatusChange = s => setStatus_(s);
    return () => { window.APP.onSyncStatusChange = null; };
  }, []);

  return status;
};

// ── SyncIndicator component ───────────────────────────────────────────────────
window.APP.SyncIndicator = function() {
  const status = window.APP.useSyncStatus();
  if (!status.enabled) return null;

  const timeStr = status.lastSynced
    ? status.lastSynced.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "never";

  return h("div", {
    style: {
      display:     "flex",
      alignItems:  "center",
      gap:         6,
      fontSize:    11,
      color:       status.error ? "#C0392B" : "#7A6A55",
      padding:     "6px 12px",
      background:  status.error ? "#FFF0EE" : "#FFF8F0",
      borderRadius:8,
      marginBottom:12,
      border:      `1px solid ${status.error ? "#F0C0BB" : "#F0E6D3"}`,
    },
  },
    h("span", { style: status.syncing ? { display: "inline-block", animation: "spin 1s linear infinite" } : {} },
      status.syncing ? "⟳" : status.error ? "⚠️" : "✓"
    ),
    status.error   ? status.error :
    status.syncing ? "Syncing…"   :
    `Synced at ${timeStr}`,
  );
};

// Spin animation
const _style = document.createElement("style");
_style.textContent = `@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`;
document.head.appendChild(_style);
