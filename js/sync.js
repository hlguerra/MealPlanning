// ── js/sync.js ────────────────────────────────────────────────────────────────
// Handles all Firebase sync logic.
// - Live listeners on every household doc, so changes from other devices show
//   up within a second or two
// - On first load Firebase wins; nothing is pushed until every doc has loaded,
//   so a fresh device can't overwrite the household with its empty/seed data
// - Debounced push after local changes, only for collections that changed
// - Conflicts are merged three ways (last synced → local vs. server), item by
//   item by `id`, inside a transaction — so two people editing the grocery list
//   at once both keep their changes

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

// ── What's synced ─────────────────────────────────────────────────────────────
// state key → [Firestore path under households/{id}, field holding the value]
const SYNCED = {
  groceryList:  [["grocery",      "items"],   "items"],
  recipes:      [["recipes",      "backup"],  "recipes"],
  costLog:      [["costlog",      "entries"], "entries"],
  spending:     [["spending",     "history"], "entries"],
  cookHistory:  [["cookhistory",  "log"],     "entries"],
  mealPlan:     [["mealplan",     "current"], "items"],
  pantry:       [["pantry",       "items"],   "items"],
  staples:      [["staples",      "items"],   "items"],
  myAppliances: [["appliances",   "list"],    "items"],
  settings:     [["settings",     "prefs"],   "settings"],
  ingredients:  [["ingredients",  "list"],    "items"],
  priceHistory: [["pricehistory", "log"],     "entries"],
};
const KEYS = Object.keys(SYNCED);

// householdId is per-device — never take it from the server copy
const fixup = (key, value, local) =>
  key === "settings" && value && local ? { ...value, householdId: local.householdId } : value;

// ── Three-way merge ───────────────────────────────────────────────────────────
// Stable stringify (sorted keys) so Firestore's key order doesn't look like a change
function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
  return JSON.stringify(v) ?? "null";
}
const same = (a, b) => a === b || stable(a) === stable(b);
const isObj = v => v && typeof v === "object" && !Array.isArray(v);
const itemKey = x => (isObj(x) && x.id != null) ? `id:${x.id}` : `v:${stable(x)}`;

// base = last value both sides agreed on. Local edits win where only local
// changed, server edits win where only the server changed; if both changed the
// same field, the server wins.
function merge3(base, local, remote) {
  if (same(local, remote)) return local;
  if (same(local, base))   return remote;
  if (same(remote, base))  return local;

  if (Array.isArray(local) && Array.isArray(remote)) {
    const toMap = arr => new Map((Array.isArray(arr) ? arr : []).map(x => [itemKey(x), x]));
    const b = toMap(base), l = toMap(local), r = toMap(remote);
    const out = [];
    l.forEach((li, k) => {
      if (r.has(k))       out.push(merge3(b.get(k), li, r.get(k)));
      else if (!b.has(k)) out.push(li);                    // added locally
      else if (!same(li, b.get(k))) out.push(li);          // deleted remotely, but edited here — keep
    });
    r.forEach((ri, k) => {
      if (l.has(k)) return;
      if (!b.has(k)) out.push(ri);                         // added remotely
      else if (!same(ri, b.get(k))) out.push(ri);          // deleted here, but edited remotely — keep
    });
    return out;
  }

  if (isObj(local) && isObj(remote)) {
    const bo = isObj(base) ? base : {};
    const out = {};
    new Set([...Object.keys(local), ...Object.keys(remote)]).forEach(k => {
      const inL = k in local, inR = k in remote;
      if (inL && inR)       out[k] = merge3(bo[k], local[k], remote[k]);
      else if (inL)         { if (!(k in bo) || !same(local[k], bo[k]))  out[k] = local[k]; }
      else                  { if (!(k in bo) || !same(remote[k], bo[k])) out[k] = remote[k]; }
    });
    return out;
  }

  return remote;
}
window.APP.merge3 = merge3;

// ── Session ───────────────────────────────────────────────────────────────────
let session = null;

// Call when the household changes. Returns { syncNow, stop } (or null).
window.APP.startSync = function(householdId, pin, setters) {
  if (!householdId) {
    setStatus({ enabled: false, error: null });
    return null;
  }

  const fb = window.APP.firebase;
  const s = session = {
    householdId, setters,
    base:     {},              // key → last value agreed with the server (or MISSING)
    replaced: {},              // key → WeakSet of local values a server update replaced
    loaded:   new Set(),
    ready:    false,
    stopped:  false,
    unsubs:   [],
    pending:  null,            // latest data passed to schedulePush
    timer:    null,
    retry:    null,
    flushing: false,
    again:    false,
  };
  KEYS.forEach(k => { s.replaced[k] = new WeakSet(); });
  window.APP.currentHouseholdId = householdId;

  setStatus({ enabled: true, syncing: true, error: null });

  const onError = e => {
    console.error("Firebase listener error:", e);
    setStatus({ syncing: false, error: e?.code === "permission-denied"
      ? "This device isn't in the household anymore. Re-join in Settings."
      : "Sync failed. Check your connection." });
  };

  const apply = (key, remote) => {
    if (s.stopped) return;
    const { MISSING } = fb;
    const first = !s.loaded.has(key);
    const prevBase = s.base[key];
    s.base[key] = remote;
    s.loaded.add(key);

    if (remote !== MISSING) {
      setters[key](local => {
        let next;
        if (first) next = key === "settings" ? { ...local, ...(remote || {}) } : remote; // Firebase wins on load
        else       next = merge3(prevBase === MISSING ? undefined : prevBase, local, remote);
        next = fixup(key, next, local);
        if (local && typeof local === "object" && next !== local) s.replaced[key].add(local);
        return next;
      });
    }

    if (!s.ready && s.loaded.size === KEYS.length) {
      s.ready = true;
      setStatus({ syncing: false, lastSynced: new Date(), error: null });
      flush(); // pushes anything missing on the server (e.g. a brand-new household)
    } else if (s.ready) {
      setStatus({ lastSynced: new Date() });
    }
  };

  (async () => {
    try {
      const ok = await fb.ensureMember(householdId, pin);
      if (s.stopped) return;
      if (!ok) {
        setStatus({ syncing: false, error: `This device isn't a member of household ${householdId}. Re-join in Settings with the household PIN.` });
        return;
      }
      KEYS.forEach(key => {
        const [path, field] = SYNCED[key];
        s.unsubs.push(fb.subscribe(householdId, path, field, v => apply(key, v), onError));
      });
    } catch (e) {
      onError(e);
    }
  })();

  return {
    syncNow: () => flush(),
    stop: () => {
      s.stopped = true;
      s.unsubs.forEach(u => u());
      clearTimeout(s.timer); clearTimeout(s.retry);
      if (session === s) { session = null; window.APP.currentHouseholdId = null; }
    },
  };
};

// ── Push ──────────────────────────────────────────────────────────────────────
async function flush() {
  const s = session;
  if (!s || s.stopped || !s.ready || !s.pending) return;
  if (s.flushing) { s.again = true; return; }
  s.flushing = true;
  clearTimeout(s.retry);

  const fb = window.APP.firebase;
  const { MISSING } = fb;
  const data = s.pending;

  // Skip values that haven't changed since the last sync, and stale values that a
  // server update has already replaced (those would undo the other device's edit).
  const changed = KEYS.filter(k =>
    k in data && data[k] !== undefined &&
    !(data[k] && typeof data[k] === "object" && s.replaced[k].has(data[k])) &&
    (s.base[k] === MISSING || !same(data[k], s.base[k]))
  );

  if (changed.length) {
    setStatus({ syncing: true });
    try {
      await Promise.all(changed.map(async key => {
        const [path, field] = SYNCED[key];
        const local = data[key];
        const base  = s.base[key];
        const written = await fb.mergeWrite(s.householdId, path, field, server => {
          if (server === MISSING) return local;
          return fixup(key, merge3(base === MISSING ? undefined : base, local, server), local);
        });
        if (s.stopped) return;
        s.base[key] = written;
        // The server had changes we didn't — fold them into local state
        if (!same(written, local)) {
          s.setters[key](cur => {
            const next = fixup(key, merge3(local, cur, written), cur);
            if (cur && typeof cur === "object" && next !== cur) s.replaced[key].add(cur);
            return next;
          });
        }
      }));
      setStatus({ syncing: false, lastSynced: new Date(), error: null });
    } catch (e) {
      console.error("Firebase push error:", e);
      setStatus({ syncing: false, error: "Sync failed. Will retry." });
      s.retry = setTimeout(flush, 15000);
    }
  }

  s.flushing = false;
  if (s.again) { s.again = false; flush(); }
}

// ── Debounced push ────────────────────────────────────────────────────────────
// Call after any local state change that should persist to Firebase.
// Waits 1.5s after last change before writing.
window.APP.schedulePush = function(householdId, data) {
  const s = session;
  if (!householdId || !s || s.householdId !== householdId) return;
  s.pending = data;
  clearTimeout(s.timer);
  s.timer = setTimeout(flush, 1500);
};

// Don't lose the last edit when the tab is closed or backgrounded / comes back online
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
window.addEventListener("online", () => flush());

// ── Household ID generator ────────────────────────────────────────────────────
window.APP.generateHouseholdId = function() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, b => chars[b % chars.length]).join("");
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
