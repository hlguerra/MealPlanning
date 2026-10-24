// ── js/app.js ─────────────────────────────────────────────────────────────────
// Root component. Owns all top-level state and wires screens together.

const { createElement: h, useState, useEffect, useCallback } = React;
const {
  usePersist, useCostLog, useBanner, usePinGuard,
  BottomNav, Banner,
  HomeScreen, RecipesScreen, MealPlanScreen, VoteScreen,
  GroceryScreen, PantryScreen, SettingsScreen,
} = window.APP;
const { uid, scaleAmt, callClaude, extractText, parseJSON } = window.APP.utils;
const { categorize }    = window.APP;
const { SEED_RECIPES, SEED_STAPLES, DEFAULT_APPLIANCES } = window.APP;

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  const [screen, setScreen] = useState("home");

  // ── Persisted state ──────────────────────────────────────────────────────────
  const [recipes,      setRecipes]      = usePersist("hmp_recipes",      SEED_RECIPES);
  const [mealPlan,     setMealPlan]     = usePersist("hmp_mealplan",     []);
  const [groceryList,  setGroceryList]  = usePersist("hmp_grocery",      []);
  const [pantry,       setPantry]       = usePersist("hmp_pantry",       []);
  const [staples,      setStaples]      = usePersist("hmp_staples",      SEED_STAPLES);
  const [myAppliances, setMyAppliances] = usePersist("hmp_appliances",   DEFAULT_APPLIANCES);
  const [settings,     setSettings]     = usePersist("hmp_settings",     window.APP.DEFAULT_SETTINGS);
  // Ingredient AKAs feed every name match, so set them before anything renders
  window.APP.utils.setIngredientAliases(settings.ingredientAliases ?? window.APP.DEFAULT_SETTINGS.ingredientAliases);
  window.APP.utils.setSectionOverrides(settings.sectionOverrides);
  const [costLog,      setCostLog]      = usePersist("hmp_costlog",      []);
  const [spending,     setSpending]     = usePersist("hmp_spending",     []);
  const [cookHistory,  setCookHistory]  = usePersist("hmp_cookhistory",  []);
  const [ingredients,  setIngredients]  = usePersist("hmp_ingredients",  []); // standard ingredient list
  const [priceHistory, setPriceHistory] = usePersist("hmp_pricehistory", []); // receipt-derived price history, rolling 365 days
  const [weeklyVotes,  setWeeklyVotes]  = usePersist("hmp_weeklyVotes",  null); // This Week's Picks — batch + everyone's votes
  const [voterName,    setVoterName]    = usePersist("hmp_voterName",    null); // who's voting on THIS device (not synced)
  const [autoGenerate, setAutoGenerate] = useState(false); // "Generate from Picks" on the vote screen → run the generator on arrival

  // ── In-memory search state (persists across navigation, cleared on app close) 
  const [priceSearchResults, setPriceSearchResults] = useState(null);
  const [priceListResults,   setPriceListResults]   = useState(null);

  // ── Cross-cutting hooks ──────────────────────────────────────────────────────
  const { addCost, total30 }     = useCostLog(costLog, setCostLog);
  const { banner, showBanner }   = useBanner();
  const { pinModal, requestPin } = usePinGuard(settings.pin);

  // ── Manual sync function (set after startSync called) ─────────────────────
  const [syncNow, setSyncNow] = useState(null);
  // lastSynced is only set once every doc has loaded — until then local data may be stale
  const [syncLoaded, setSyncLoaded] = useState(!!window.APP.syncStatus?.lastSynced);
  useEffect(() => {
    window.APP.onSyncStatusChange = st => setSyncLoaded(!!st.lastSynced);
    return () => { window.APP.onSyncStatusChange = null; };
  }, []);

  // ── Settings save ────────────────────────────────────────────────────────────
  const saveSettings = useCallback(s => setSettings(s), [setSettings]);

  // ── Firebase sync ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const householdId = settings.householdId;
    if (!householdId || !window.APP.startSync) return;

    const sync = window.APP.startSync(householdId, settings.pin, {
      groceryList:  setGroceryList,
      recipes:      setRecipes,
      costLog:      setCostLog,
      spending:     setSpending,
      cookHistory:  setCookHistory,
      mealPlan:     setMealPlan,
      pantry:       setPantry,
      staples:      setStaples,
      myAppliances: setMyAppliances,
      settings:     setSettings,
      ingredients:  setIngredients,
      priceHistory: setPriceHistory,
      weeklyVotes:  setWeeklyVotes,
    });

    if (!sync) return;
    setSyncNow(() => sync.syncNow);
    return () => { sync.stop(); setSyncNow(null); };
  }, [settings.householdId]); // eslint-disable-line

  // ── Push to Firebase after local changes ──────────────────────────────────────
  useEffect(() => {
    if (!settings.householdId || !window.APP.schedulePush) return;
    window.APP.schedulePush(settings.householdId, {
      groceryList,
      recipes,
      costLog,
      spending,
      cookHistory,
      mealPlan,
      pantry,
      staples,
      myAppliances,
      settings,
      ingredients,
      priceHistory,
      weeklyVotes,
    });
  }, [groceryList, recipes, costLog, spending, cookHistory, mealPlan, pantry, staples, myAppliances, settings, ingredients, priceHistory, weeklyVotes, settings.householdId]);

  // ── This Week's Picks ────────────────────────────────────────────────────────
  // First open in a new week picks a fresh batch of 20. The pick is seeded by
  // household + week, so if both devices do it at once they pick the same 20.
  // Waits for sync to load so a device with stale data doesn't roll the week.
  const weekKey = window.APP.voting.weekKeyFor();
  useEffect(() => {
    if (weeklyVotes?.weekKey === weekKey || !recipes.length) return;
    if (settings.householdId && !syncLoaded) return;
    setWeeklyVotes(cur => cur?.weekKey === weekKey ? cur : window.APP.voting.newWeek(cur, weekKey, recipes, cookHistory, settings.householdId));
  }, [weekKey, weeklyVotes?.weekKey, recipes.length, syncLoaded]); // eslint-disable-line

  // Swap any non-main-course recipes out of this week's batch (e.g. a recipe's
  // course was changed to Side after it was picked). Votes on mains are kept.
  useEffect(() => {
    if (weeklyVotes?.weekKey !== weekKey || !recipes.length) return;
    if (settings.householdId && !syncLoaded) return;
    const cleaned = window.APP.voting.cleanWeek(weeklyVotes, recipes, cookHistory, settings.householdId);
    if (cleaned) setWeeklyVotes(cleaned);
  }, [weekKey, weeklyVotes, recipes, syncLoaded]); // eslint-disable-line

  // ── Used-up pantry items ─────────────────────────────────────────────────────
  // When something hits 0 it disappears from the pantry — unless it's a staple
  // (📌), which stays visible as "out" so you know to restock it. Runs on every
  // pantry/staples change, so it covers Mark as Made, manual edits, and sync.
  useEffect(() => {
    const { sameIngredient, hasQty } = window.APP.utils;
    const isOut    = pi => hasQty(pi) && parseFloat(pi.amount) === 0;
    const isStaple = pi => staples.some(s => sameIngredient(s, pi));
    if (pantry.some(pi => isOut(pi) && !isStaple(pi))) {
      setPantry(p => p.filter(pi => !(isOut(pi) && !isStaple(pi))));
    }
  }, [pantry, staples, setPantry]);

  // ── Add recipe to meal plan ──────────────────────────────────────────────────
  // servings defaults to the recipe as written; groceries and pantry use are scaled to it.
  const addToMealPlan = useCallback((recipe, mealType, servings) => {
    setMealPlan(mp => [
      ...mp,
      {
        id:            uid(),
        name:          recipe.name,
        mealType:      mealType || "Dinner",
        course:        recipe.course,
        proteins:      recipe.proteins || [],
        estimatedCost: recipe.estimatedCost || 0,
        checked:       false,
        recipeIds:     recipe.id ? [recipe.id] : [],
        servings:      servings || recipe.servings || settings.people || 2,
      },
    ]);
  }, [setMealPlan, settings.people]);

  // ── Link an additional saved recipe to an existing meal plan entry (combo meals) ──
  const addRecipeToMeal = useCallback((mealId, recipe) => {
    setMealPlan(mp => mp.map(m => {
      if (m.id !== mealId) return m;
      if ((m.recipeIds || []).includes(recipe.id)) return m; // already linked
      const recipeIds = [...(m.recipeIds || []), recipe.id];
      const names      = [...(m.name ? m.name.split(" + ") : []), recipe.name];
      return {
        ...m,
        recipeIds,
        name:          names.join(" + "),
        estimatedCost: +((m.estimatedCost || 0) + (recipe.estimatedCost || 0)).toFixed(2),
      };
    }));
    showBanner(`✓ Added ${recipe.name}`, "success");
  }, [setMealPlan, showBanner]);

  // ── Add one recipe's ingredients to grocery list (Recipes screen) ────────────
  // Subtracts what's in the pantry, then sums into matching list items. Only the
  // pantry is checked here (not the list) — the list may already hold the same
  // ingredient for other meals, and this is an extra batch on top of those.
  // Stays on the current screen so several recipes can be added in a row.
  const addToGrocery = useCallback((recipe, servings) => {
    const { combineIngredients, shortfall, mergeIntoList, recipeIngredients } = window.APP.utils;
    const needed = combineIngredients(recipeIngredients(recipe, servings));
    const toBuy  = shortfall(needed, pantry);
    if (!toBuy.length) { showBanner(`Everything for ${recipe.name} is already in your pantry`, "success"); return; }
    setGroceryList(l => mergeIntoList(l, toBuy));
    const covered = needed.length - toBuy.length;
    showBanner(`✓ Added ${toBuy.length} item${toBuy.length === 1 ? "" : "s"} to grocery list${covered ? ` — ${covered} already in pantry` : ""}`, "success");
  }, [pantry, setGroceryList, showBanner]);

  // ── Add plain items to grocery list (Pantry "out of stock" button) ───────────
  const addItemsToGrocery = useCallback(items => {
    setGroceryList(l => window.APP.utils.mergeIntoList(l, items));
  }, [setGroceryList]);

  // ── Save reviewed receipt items to price history ─────────────────────────────
  // Only called after the person confirms/links each item — never auto-saved.
  const savePriceHistory = useCallback((items, store, date) => {
    const { rolling365 } = window.APP.utils;
    const entries = items.map(it => ({
      id: uid(), ingredientId: it.ingredientId, amount: +it.amount, unit: it.unit,
      price: +it.price, store: store || "", date: date || new Date().toISOString().split("T")[0],
      ts: Date.now(),
    }));
    setPriceHistory(log => rolling365([...log, ...entries]));
    showBanner(`✓ Saved prices for ${entries.length} item${entries.length === 1 ? "" : "s"}`, "success");
  }, [setPriceHistory, showBanner]);

  // ── Standard ingredient list ─────────────────────────────────────────────────
  const addNewIngredient = useCallback(name => {
    const trimmed = (name || "").trim();
    if (!trimmed) return null;
    const created = { id: uid(), name: trimmed };
    setIngredients(list => [...list, created]);
    return created;
  }, [setIngredients]);

  // ── Section picker ─────────────────────────────────────────────────────────────
  // Remembers a store section for an ingredient household-wide, so the pantry,
  // grocery list, and anything added later all put it in the same place.
  const setItemSection = useCallback((name, section) => {
    const key = window.APP.utils.normalizeIngName(name);
    if (!key) return;
    setSettings(s => ({ ...s, sectionOverrides: { ...(s.sectionOverrides || {}), [key]: section } }));
  }, [setSettings]);

  // ── Quick add (home screen) ──────────────────────────────────────────────────
  const quickAddGrocery = useCallback(item => {
    setGroceryList(l => window.APP.utils.mergeIntoList(l, [item]));
  }, [setGroceryList]);

  // ── Known ingredient names for autocomplete (recipes + pantry + grocery) ────
  const knownIngredientNames = React.useMemo(() => {
    const names = new Set();
    recipes.forEach(r => (r.ingredients || []).forEach(i => i.name && names.add(i.name)));
    pantry.forEach(i => i.name && names.add(i.name));
    groceryList.forEach(i => i.name && names.add(i.name));
    return [...names];
  }, [recipes, pantry, groceryList]);

  // ── Add meal-plan ingredients to grocery list ────────────────────────────────
  // Works out the total needed for every meal that's still to be cooked (skipping
  // made meals and ones marked "covered"), subtracts what's in the pantry AND
  // already on the list, and adds only the difference. Because it compares against
  // everything on hand, pressing it again (or after adding another meal) never
  // double-adds — it just tops up what a new meal needs.
  // Meals without a saved recipe get one generated, saved, and linked first.
  const addMealPlanToGrocery = useCallback(async () => {
    const { combineIngredients, shortfall, mergeIntoList, mealRecipes, mealIngredients, generateRecipeFor } = window.APP.utils;

    let pending = mealPlan.filter(m => !m.checked && !m.groceriesAdded);
    if (!pending.length) {
      showBanner("Nothing to add — every meal is made or marked covered.", "error");
      return;
    }

    const missing = pending.filter(m => mealRecipes(m, recipes).length === 0);
    let allRecipes = recipes;
    const links  = {}; // meal id → generated recipe id
    const failed = [];
    if (missing.length) {
      showBanner(`Generating recipes for ${missing.length} meal${missing.length > 1 ? "s" : ""}…`, "success", 0);
      const generated = [];
      for (const m of missing) {
        try {
          const r = await generateRecipeFor(m, ingredients);
          generated.push(r);
          links[m.id] = r.id;
          addCost("recipeGen");
        } catch {
          failed.push(m.name);
        }
      }
      if (generated.length) {
        setRecipes(rs => [...rs, ...generated]);
        allRecipes = [...recipes, ...generated];
        pending = pending.map(m => links[m.id] ? { ...m, recipeIds: [links[m.id]] } : m);
      }
    }

    const included = pending.filter(m => mealRecipes(m, allRecipes).length > 0);
    const needed   = combineIngredients(included.flatMap(m => mealIngredients(m, allRecipes)));
    if (!needed.length) {
      showBanner("No recipes with ingredients found in your meal plan.", "error");
      return;
    }

    // Link generated recipes to their meals, and note which meals are on the list
    const includedIds = new Set(included.map(m => m.id));
    const sentAt = Date.now();
    setMealPlan(mp => mp.map(m => {
      if (!includedIds.has(m.id)) return m;
      return { ...m, ...(links[m.id] ? { recipeIds: [links[m.id]] } : {}), sentToGrocery: sentAt };
    }));

    const toBuy = shortfall(needed, [...pantry, ...groceryList]);
    setGroceryList(l => mergeIntoList(l, shortfall(needed, [...pantry, ...l])));

    const covered = needed.length - toBuy.length;
    const msg = toBuy.length
      ? `✓ Added ${toBuy.length} item${toBuy.length === 1 ? "" : "s"}${covered ? ` — ${covered} already covered by pantry/list` : ""}`
      : "✓ Everything's already covered by your pantry and list";
    showBanner(failed.length ? `${msg}. Couldn't generate: ${failed.join(", ")}` : msg, failed.length ? "error" : "success", failed.length ? 5000 : 2200);
    setScreen("grocery");
  }, [mealPlan, recipes, pantry, groceryList, ingredients, setGroceryList, setRecipes, setMealPlan, addCost, showBanner]);

  // ── Add purchased grocery items to pantry ─────────────────────────────────────
  const addGroceryToPantry = useCallback(items => {
    const { sameIngredient, convertUnit, hasQty, fixSection } = window.APP.utils;
    setPantry(p => {
      const updated = [...p];
      items.forEach(item => {
        const amt = parseFloat(item.amount);
        const bought = hasQty(item);
        const newEntry = () => ({ id: uid(), name: item.name, ingredientId: item.ingredientId || null, section: fixSection(item.section, item.name), amount: bought ? amt : "", unit: bought ? (item.unit || "") : "" });

        const matchIdxs = updated.map((pi, i) => sameIngredient(pi, item) ? i : -1).filter(i => i !== -1);
        if (!matchIdxs.length) { updated.push(newEntry()); return; }
        if (!bought) return; // bought with no quantity — the existing entry already says you have it

        // Prefer an entry whose unit converts; otherwise an empty/untracked one we can take over
        const idx = matchIdxs.find(i => hasQty(updated[i]) && convertUnit(amt, item.unit, updated[i].unit) !== null)
          ?? matchIdxs.find(i => !hasQty(updated[i]) || parseFloat(updated[i].amount) === 0);
        if (idx === undefined) { updated.push(newEntry()); return; } // different unit than what's stocked — track separately rather than guess

        const ex = updated[idx];
        const exAmt = parseFloat(ex.amount);
        if (!hasQty(ex) || exAmt === 0) {
          // untracked or used up — restock with what was just bought
          updated[idx] = { ...ex, amount: amt, unit: item.unit || "" };
        } else {
          updated[idx] = { ...ex, amount: +(exAmt + convertUnit(amt, item.unit, ex.unit)).toFixed(3) };
        }
      });
      return updated;
    });
  }, [setPantry]);

  // ── Mark meal as made ─────────────────────────────────────────────────────────
  // `deductions` are the rows (from utils.planDeductions) the person confirmed.
  // Everything needed to undo it is stored on the meal as `madeInfo`.
  const markAsMade = useCallback((meal, date, deductions = []) => {
    const linked  = window.APP.utils.mealRecipes(meal, recipes);
    const linkedIds = linked.map(r => r.id);
    const historyId = uid();
    const now = Date.now();

    setCookHistory(h => [...h, {
      id:         historyId,
      recipeName: meal.name,
      recipeId:   linkedIds[0] || null,
      recipeIds:  linkedIds,
      proteins:   meal.proteins || [],
      mealType:   meal.mealType || "Dinner",
      date:       date || new Date().toISOString().split("T")[0],
      madeAt:     now,
    }]);

    const prevLastMadeAt = {};
    linked.forEach(r => { prevLastMadeAt[r.id] = r.lastMadeAt || null; });
    setRecipes(rs => rs.map(r => linkedIds.includes(r.id) ? { ...r, lastMadeAt: now } : r));

    // Record what was actually removed (can't remove more than was there) so undo is exact
    const removed = deductions.map(d => {
      const pi = pantry.find(x => x.id === d.pantryId);
      const cur = pi ? parseFloat(pi.amount) : NaN;
      return { ...d, removed: isNaN(cur) ? 0 : Math.min(cur, d.used) };
    }).filter(d => d.removed > 0);

    if (removed.length) {
      setPantry(p => p.map(pi => {
        const d = removed.find(x => x.pantryId === pi.id);
        const cur = parseFloat(pi.amount);
        if (!d || isNaN(cur)) return pi;
        return { ...pi, amount: Math.max(0, +(cur - d.removed).toFixed(3)) };
      }));
    }

    setMealPlan(mp => mp.map(m => m.id === meal.id ? {
      ...m, checked: true, checkedAt: now,
      madeInfo: {
        historyId, prevLastMadeAt,
        deductions: removed.map(d => ({ pantryId: d.pantryId, name: d.name, ingredientId: d.ingredientId, section: d.section, unit: d.unit, amount: d.removed })),
      },
    } : m));

    const outCount = removed.filter(d => d.after === 0).length;
    showBanner(`✓ ${meal.name} marked as made${removed.length ? ` — ${removed.length} pantry item${removed.length === 1 ? "" : "s"} updated` : ""}${outCount ? `, ${outCount} used up` : ""}`, "success", 3000);
  }, [setCookHistory, setMealPlan, setPantry, setRecipes, recipes, pantry, showBanner]);

  // ── Undo "mark as made" ───────────────────────────────────────────────────────
  // Puts pantry amounts back (re-adding an entry if it was deleted since), removes
  // the cook history entry, and restores each recipe's previous lastMadeAt.
  const undoMarkAsMade = useCallback(meal => {
    const info = meal.madeInfo;
    if (!info) return;
    const deds = info.deductions || [];
    if (deds.length) {
      setPantry(p => {
        const updated = p.map(pi => {
          const d = deds.find(x => x.pantryId === pi.id);
          const cur = parseFloat(pi.amount);
          return d && !isNaN(cur) ? { ...pi, amount: +(cur + d.amount).toFixed(3) } : pi;
        });
        deds.filter(d => !p.some(pi => pi.id === d.pantryId)).forEach(d => {
          updated.push({ id: d.pantryId, name: d.name, ingredientId: d.ingredientId || null, section: d.section, amount: d.amount, unit: d.unit || "" });
        });
        return updated;
      });
    }
    setCookHistory(h => h.filter(e => e.id !== info.historyId));
    setRecipes(rs => rs.map(r => r.id in (info.prevLastMadeAt || {}) ? { ...r, lastMadeAt: info.prevLastMadeAt[r.id] || undefined } : r));
    setMealPlan(mp => mp.map(m => {
      if (m.id !== meal.id) return m;
      const { madeInfo, checkedAt, ...rest } = m;
      return { ...rest, checked: false };
    }));
    showBanner(`↺ ${meal.name} un-marked${deds.length ? " — pantry restored" : ""}`, "success");
  }, [setPantry, setCookHistory, setRecipes, setMealPlan, showBanner]);

  // ── Record grocery purchase ───────────────────────────────────────────────────
  const recordPurchase = useCallback((amount, note) => {
    const entry = {
      id:        uid(),
      amount:    +amount,
      note:      note || "",
      date:      new Date().toISOString().split("T")[0],
      month:     new Date().toISOString().slice(0, 7), // "YYYY-MM"
      createdAt: Date.now(),
    };
    setSpending(s => [...s, entry]);
  }, [setSpending]);

  // ── Screen map ───────────────────────────────────────────────────────────────
  const screens = {
    home: h(HomeScreen, {
      settings,
      mealPlan,
      groceryList,
      onNav:             setScreen,
      onQuickAdd:        quickAddGrocery,
      addCost,
      showBanner,
      onSync:            syncNow,
      priceSearchResults,
      setPriceSearchResults,
    }),

    recipes: h(RecipesScreen, {
      recipes,
      setRecipes,
      onAddToMealPlan: addToMealPlan,
      onAddToGrocery:  addToGrocery,
      requestPin,
      addCost,
      showBanner,
      knownIngredientNames,
      ingredients,
      addNewIngredient,
      priceHistory,
    }),

    plan: h(MealPlanScreen, {
      mealPlan,
      setMealPlan,
      recipes,
      setRecipes,
      cookHistory,
      onAddToGrocery: addToGrocery,
      onAddMealPlanToGrocery: addMealPlanToGrocery,
      onMarkAsMade:   markAsMade,
      onUndoMarkAsMade: undoMarkAsMade,
      onAddRecipeToMeal: addRecipeToMeal,
      pantry,
      requestPin,
      settings,
      saveSettings,
      myAppliances,
      addCost,
      showBanner,
      ingredients,
      weeklyVotes,
      onNav: setScreen,
      autoGenerate,
      onAutoGenerateHandled: () => setAutoGenerate(false),
    }),

    vote: h(VoteScreen, {
      weeklyVotes,
      setWeeklyVotes,
      recipes,
      settings,
      voterName,
      setVoterName,
      onNav: setScreen,
      onGenerate: () => { setAutoGenerate(true); setScreen("plan"); },
    }),

    grocery: h(GroceryScreen, {
      groceryList,
      setGroceryList,
      staples,
      setStaples,
      settings,
      spending,
      onRecordPurchase:  recordPurchase,
      onCompleteList:    addGroceryToPantry,
      addCost,
      showBanner,
      priceListResults,
      setPriceListResults,
      knownIngredientNames,
      ingredients,
      addNewIngredient,
      priceHistory,
      onSavePriceHistory: savePriceHistory,
      onSetSection: setItemSection,
    }),

    pantry: h(PantryScreen, {
      recipes,
      setRecipes,
      onAddToMealPlan: addToMealPlan,
      showBanner,
      pantry,
      setPantry,
      groceryList,
      onAddToGrocery:  addItemsToGrocery,
      onAddToPantry:   addGroceryToPantry,
      staples,
      setStaples,
      addCost,
      knownIngredientNames,
      ingredients,
      addNewIngredient,
      onSetSection: setItemSection,
    }),

    settings: h(SettingsScreen, {
      settings,
      saveSettings,
      myAppliances,
      setMyAppliances,
      costTotal: total30,
      requestPin,
      showBanner,
      recipes,
      setRecipes,
      addCost,
    }),
  };

  // ── Root render ──────────────────────────────────────────────────────────────
  return h(React.Fragment, null,
    h(Banner, { banner }),
    h("div", { className: "app-container" },
      screens[screen] || screens.home,
    ),
    h(BottomNav, { active: screen === "vote" ? "plan" : screen, onNav: setScreen }),
    pinModal,
  );
}

// ── Mount ─────────────────────────────────────────────────────────────────────
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(h(App, null));
