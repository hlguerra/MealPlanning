// ── js/sync.js ────────────────────────────────────────────────────────────────
// Handles all Firebase sync logic.
// - Reads from Firestore on app open
// - Auto-syncs every 2 minutes while app is open
// - Sheets (Firebase) always wins on conflict
// - Exposes sync status for the grocery screen indicator

window.APP = window.APP || {};

const SYNC_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

// ── Sync status ───────────────────────────────────────────────────────────────
// Shared mutable state for sync indicator.
// Components read this via window.APP.syncStatus
window.APP.syncStatus = {
  lastSynced:  null,   // Date object or null
  syncing:     false,  // true while a sync is in progress
  error:       null,   // string or null
  enabled:     false,  // true once a householdId is configured
};

// ── Internal helpers ──────────────────────────────────────────────────────────
function setStatus(patch) {
  Object.assign(window.APP.syncStatus, patch);
  // Notify any listeners (grocery screen re-renders via polling its own timer)
  if (typeof window.APP.onSyncStatusChange === "function") {
    window.APP.onSyncStatusChange({ ...window.APP.syncStatus });
  }
}

// ── Pull from Firebase (Firebase wins) ───────────────────────────────────────
// Reads grocery, recipes, and cost log from Firestore and overwrites local state.
async function pullFromFirebase(householdId, callbacks) {
  const { setGroceryList, setRecipes, setCostLog } = callbacks;
  const { readGrocery, readRecipes, readCostLog }  = window.APP.firebase;

  setStatus({ syncing: true, error: null });

  try {
    const [grocery, recipes, costlog] = await Promise.all([
      readGrocery(householdId),
      readRecipes(householdId),
      readCostLog(householdId),
    ]);

    setGroceryList(grocery);
    setRecipes(recipes);
    setCostLog(costlog);

    setStatus({ syncing: false, lastSynced: new Date(), error: null });
  } catch (e) {
    setStatus({ syncing: false, error: "Sync failed. Check your connection." });
    console.error("Firebase pull error:", e);
  }
}

// ── Push to Firebase ──────────────────────────────────────────────────────────
// Writes current local state up to Firestore.
async function pushToFirebase(householdId, data) {
  const { writeGrocery, writeRecipes, writeCostLog } = window.APP.firebase;
  const { groceryList, recipes, costLog }            = data;

  setStatus({ syncing: true, error: null });

  try {
    await Promise.all([
      writeGrocery(householdId, groceryList),
      writeRecipes(householdId, recipes),
      writeCostLog(householdId, costLog),
    ]);
    setStatus({ syncing: false, lastSynced: new Date(), error: null });
  } catch (e) {
    setStatus({ syncing: false, error: "Sync failed. Check your connection." });
    console.error("Firebase push error:", e);
  }
}

// ── Sync manager ──────────────────────────────────────────────────────────────
// Call this once on app load. Returns a stop function to clean up the interval.
window.APP.startSync = function(householdId, callbacks, data) {
  if (!householdId) {
    setStatus({ enabled: false });
    return () => {};
  }

  setStatus({ enabled: true });

  // Pull immediately on start
  pullFromFirebase(householdId, callbacks);

  // Set up 2-minute polling interval
  const intervalId = setInterval(() => {
    pullFromFirebase(householdId, callbacks);
  }, SYNC_INTERVAL_MS);

  // Return cleanup function
  return () => clearInterval(intervalId);
};

// ── Manual push ───────────────────────────────────────────────────────────────
// Call this whenever local state changes that should be persisted to Firebase.
// Debounced to avoid hammering Firestore on rapid changes.
let pushTimer = null;
window.APP.schedulePush = function(householdId, data) {
  if (!householdId) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushToFirebase(householdId, data);
  }, 1500); // Wait 1.5s after last change before pushing
};

// ── Household setup ───────────────────────────────────────────────────────────
// Generates a new household ID.
window.APP.generateHouseholdId = function() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
};

// ── Sync status hook ──────────────────────────────────────────────────────────
// React hook that returns the current sync status and re-renders when it changes.
const { useState, useEffect } = React;

window.APP.useSyncStatus = function() {
  const [status, setStatus_] = useState({ ...window.APP.syncStatus });

  useEffect(() => {
    // Register as the sync status listener
    window.APP.onSyncStatusChange = s => setStatus_(s);
    return () => { window.APP.onSyncStatusChange = null; };
  }, []);

  return status;
};

// ── Sync indicator component ──────────────────────────────────────────────────
const { createElement: h } = React;

window.APP.SyncIndicator = function() {
  const status = window.APP.useSyncStatus();

  if (!status.enabled) return null;

  const timeStr = status.lastSynced
    ? status.lastSynced.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "never";

  return h("div", {
    style: {
      display:        "flex",
      alignItems:     "center",
      gap:            6,
      fontSize:       11,
      color:          status.error ? "#C0392B" : "#7A6A55",
      padding:        "6px 12px",
      background:     status.error ? "#FFF0EE" : "#FFF8F0",
      borderRadius:   8,
      marginBottom:   12,
      border:         `1px solid ${status.error ? "#F0C0BB" : "#F0E6D3"}`,
    },
  },
    // Spinner or checkmark
    status.syncing
      ? h("span", { style: { animation: "spin 1s linear infinite", display: "inline-block" } }, "⟳")
      : status.error
        ? h("span", null, "⚠️")
        : h("span", { style: { color: "#2A7D4F" } }, "✓"),

    status.error
      ? status.error
      : status.syncing
        ? "Syncing…"
        : `Synced at ${timeStr}`,
  );
};

// ── Spin animation ────────────────────────────────────────────────────────────
const style = document.createElement("style");
style.textContent = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
document.head.appendChild(style);
