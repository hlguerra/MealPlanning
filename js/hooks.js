// ── js/hooks.js ───────────────────────────────────────────────────────────────
// Custom React hooks shared across all screens.

window.APP = window.APP || {};
const { useState, useEffect, useCallback } = React;
const { lsGet, lsSet, rolling30, sumCost } = window.APP.utils;
const { COST_PER_CALL } = window.APP;

// ── usePersist ────────────────────────────────────────────────────────────────
// Like useState but syncs to localStorage automatically.
// Usage: const [recipes, setRecipes] = usePersist("hmp_recipes", []);
window.APP.usePersist = function(key, init) {
  const [val, setVal] = useState(() => lsGet(key, init));
  useEffect(() => { lsSet(key, val); }, [key, val]);
  return [val, setVal];
};

// ── useCostLog ────────────────────────────────────────────────────────────────
// Tracks estimated API usage over a rolling 30-day window.
// Call addCost("mealPlan") after each AI feature call.
window.APP.useCostLog = function() {
  const [log, setLog] = window.APP.usePersist("hmp_costlog", []);

  const addCost = useCallback((type) => {
    const cost = COST_PER_CALL[type] || 0.005;
    setLog(l => [...rolling30(l), { ts: Date.now(), type, cost }]);
  }, [setLog]);

  const trimmed  = rolling30(log);
  const total30  = sumCost(trimmed);

  return { addCost, total30, log: trimmed };
};

// ── useBanner ─────────────────────────────────────────────────────────────────
// Shows a temporary success or error banner.
// Returns { banner, showBanner }
// banner: { message, type } | null
// showBanner("Milk added to grocery list", "success")  — auto-hides after 2s
// showBanner("Something went wrong", "error")
window.APP.useBanner = function() {
  const [banner, setBanner] = useState(null);

  const showBanner = useCallback((message, type = "success") => {
    setBanner({ message, type, id: Date.now() });
    setTimeout(() => setBanner(null), 2200);
  }, []);

  return { banner, showBanner };
};

// ── usePinGuard ───────────────────────────────────────────────────────────────
// Wraps an action behind a PIN confirmation modal.
// Usage:
//   const { pinModal, requestPin } = usePinGuard(settings.pin);
//   requestPin(() => deleteRecipe(id));   ← opens PIN modal; runs cb on success
//   render: {pinModal}                    ← drop into JSX
window.APP.usePinGuard = function(pin) {
  const [pending, setPending] = useState(null); // the callback waiting for PIN

  const requestPin = useCallback((cb) => {
    setPending(() => cb);
  }, []);

  const onSuccess = useCallback(() => {
    if (pending) pending();
    setPending(null);
  }, [pending]);

  const onCancel = useCallback(() => setPending(null), []);

  // The modal element to render in JSX (null when no PIN needed)
  const pinModal = pending
    ? React.createElement(window.APP.PinModal, { pin, onSuccess, onCancel })
    : null;

  return { pinModal, requestPin };
};

// ── useSettings ───────────────────────────────────────────────────────────────
// Convenience hook that loads/saves the full settings object.
window.APP.useSettings = function() {
  return window.APP.usePersist("hmp_settings", window.APP.DEFAULT_SETTINGS);
};
