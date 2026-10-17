// ── js/voting.js ──────────────────────────────────────────────────────────────
// Weekly recipe voting ("This Week's Picks"). Pure helpers, no UI.
// weeklyVotes (synced) looks like:
//   { weekKey: "2026-10-12", recipeIds: [...], prevRecipeIds: [...],
//     votes: { [recipeId]: { [voterName]: "up" | "neutral" | "down" } } }

window.APP = window.APP || {};

const WEEKLY_COUNT = 20;
const WEEKLY_PROTEIN_CAP = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

// Monday of the week containing `date`, as local YYYY-MM-DD
const weekKeyFor = (date = new Date()) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Deterministic shuffle — both partners' devices get the same order from the same seed
const seededShuffle = (arr, seedStr) => {
  let seed = 0;
  for (const c of String(seedStr)) seed = (Math.imul(seed, 31) + c.charCodeAt(0)) | 0;
  const rand = () => { // mulberry32
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

// Only main courses go up for a vote — no sides, desserts, etc.
const isMainCourse = r => !r.hidden && r.course === "Main";

// Take from `ordered` until `need` are picked, no more than `cap` of the same main
// protein (counting what's already in `picked`). If the cap leaves gaps, top up ignoring it.
const pickWithProteinCap = (ordered, need, cap, picked = []) => {
  const out = [...picked];
  const counts = {};
  out.forEach(r => { const p = (r.proteins || [])[0]; if (p) counts[p] = (counts[p] || 0) + 1; });
  ordered.forEach(r => {
    if (out.length >= need || out.includes(r)) return;
    const p = (r.proteins || [])[0];
    if (p && (counts[p] || 0) >= cap) return;
    out.push(r);
    if (p) counts[p] = (counts[p] || 0) + 1;
  });
  ordered.forEach(r => {
    if (out.length >= need || out.includes(r)) return;
    out.push(r);
  });
  return out;
};

// This week's batch: recipes not made in 30 days and not in last week's batch first
// `keep` are recipes already in the batch that stay put (see cleanWeek)
const pickWeeklyRecipes = (recipes, cookHistory, prevIds, seed, keep = []) => {
  const recentNames = new Set((cookHistory || [])
    .filter(e => Date.now() - e.madeAt < 30 * DAY_MS)
    .flatMap(e => (e.recipeName || "").split(" + ")));
  const prev = new Set(prevIds || []);
  const isStale = r => recentNames.has(r.name) || prev.has(r.id);
  const pool = recipes.filter(isMainCourse);
  const ordered = [
    ...seededShuffle(pool.filter(r => !isStale(r)), seed),
    ...seededShuffle(pool.filter(isStale), seed),
  ];
  return pickWithProteinCap(ordered, WEEKLY_COUNT, WEEKLY_PROTEIN_CAP, keep).map(r => r.id);
};

// A fresh weeklyVotes object for `weekKey`, rolling the current batch into prevRecipeIds
const newWeek = (current, weekKey, recipes, cookHistory, householdId) => {
  const prevRecipeIds = current?.recipeIds || [];
  return {
    weekKey,
    recipeIds: pickWeeklyRecipes(recipes, cookHistory, prevRecipeIds, `${householdId || ""}:${weekKey}`),
    prevRecipeIds,
    votes: {},
  };
};

// A batch picked before the main-courses-only rule may hold sides etc. Drop
// those and top up with mains, keeping the mains already there and their votes.
// Returns null if the batch is already clean.
const cleanWeek = (current, recipes, cookHistory, householdId) => {
  const batch = (current?.recipeIds || []).map(id => recipes.find(r => r.id === id)).filter(Boolean);
  const keep = batch.filter(isMainCourse);
  if (keep.length === batch.length) return null;
  const recipeIds = pickWeeklyRecipes(recipes, cookHistory, current.prevRecipeIds,
    `${householdId || ""}:${current.weekKey}`, keep);
  const votes = Object.fromEntries(Object.entries(current.votes || {}).filter(([id]) => recipeIds.includes(id)));
  return { ...current, recipeIds, votes };
};

// "veto" (anyone 👎) | "both" (every voter 👍) | "one" (at least one 👍) | "neutral"
const voteTier = (recipeVotes, voters) => {
  const vals = Object.values(recipeVotes || {});
  if (vals.includes("down")) return "veto";
  if (voters.length && voters.every(v => recipeVotes?.[v] === "up")) return "both";
  if (vals.includes("up")) return "one";
  return "neutral";
};

// How many of the batch each voter has voted on
const voteProgress = (weekly, voters) => {
  const ids = weekly?.recipeIds || [];
  return voters.map(name => ({
    name,
    count: ids.filter(id => weekly.votes?.[id]?.[name]).length,
    total: ids.length,
  }));
};

const votersFrom = settings => {
  const v = (settings?.voters || []).filter(Boolean);
  return v.length ? v : window.APP.DEFAULT_SETTINGS.voters;
};

window.APP.voting = { weekKeyFor, seededShuffle, isMainCourse, pickWithProteinCap, pickWeeklyRecipes, newWeek, cleanWeek, voteTier, voteProgress, votersFrom };
