// ── js/app.js ─────────────────────────────────────────────────────────────────
// Root component. Owns all top-level state and wires screens together.

const { createElement: h, useState, useEffect, useCallback } = React;
const {
  usePersist, useCostLog, useBanner, usePinGuard,
  BottomNav, Banner,
  HomeScreen, RecipesScreen, MealPlanScreen,
  GroceryScreen, PantryScreen, SettingsScreen,
} = window.APP;
const { uid, scaleAmt } = window.APP.utils;
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
  const [costLog,      setCostLog]      = usePersist("hmp_costlog",      []);
  const [spending,     setSpending]     = usePersist("hmp_spending",     []);
  const [cookHistory,  setCookHistory]  = usePersist("hmp_cookhistory",  []);

  // ── In-memory search state (persists across navigation, cleared on app close) 
  const [priceSearchResults, setPriceSearchResults] = useState(null);
  const [priceListResults,   setPriceListResults]   = useState(null);

  // ── Cross-cutting hooks ──────────────────────────────────────────────────────
  const { addCost, total30 }     = useCostLog();
  const { banner, showBanner }   = useBanner();
  const { pinModal, requestPin } = usePinGuard(settings.pin);

  // ── Manual sync function (set after startSync called) ─────────────────────
  const [syncNow, setSyncNow] = useState(null);

  // ── Settings save ────────────────────────────────────────────────────────────
  const saveSettings = useCallback(s => setSettings(s), [setSettings]);

  // ── Firebase sync ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const householdId = settings.householdId;
    if (!householdId || !window.APP.startSync) return;

    const syncFn = window.APP.startSync(householdId, {
      setGroceryList,
      setRecipes,
      setCostLog,
      setSpending,
      setCookHistory,
      setMealPlan,
      setPantry,
      setStaples,
      setMyAppliances,
      setSettings,
    });

    if (syncFn) setSyncNow(() => syncFn);
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
    });
  }, [groceryList, recipes, costLog, spending, cookHistory, mealPlan, pantry, staples, myAppliances, settings, settings.householdId]);

  // ── Add recipe to meal plan ──────────────────────────────────────────────────
  const addToMealPlan = useCallback(recipe => {
    setMealPlan(mp => [
      ...mp,
      {
        id:            uid(),
        name:          recipe.name,
        mealType:      "Dinner",
        course:        recipe.course,
        proteins:      recipe.proteins || [],
        estimatedCost: recipe.estimatedCost || 0,
        checked:       false,
      },
    ]);
  }, [setMealPlan]);

  // ── Add recipe ingredients to grocery list ───────────────────────────────────
  const addToGrocery = useCallback((recipe, servings) => {
    const scaledItems = (recipe.ingredients || []).map(ing => ({
      id:      uid(),
      name:    ing.name,
      amount:  scaleAmt(ing.amount, recipe.servings, servings),
      unit:    ing.unit || "",
      section: ing.section || categorize(ing.name),
      checked: false,
    }));

    setGroceryList(l => {
      const merged = [...l];
      scaledItems.forEach(ni => {
        if (!merged.find(i => i.name.toLowerCase() === ni.name.toLowerCase())) {
          merged.push(ni);
        }
      });
      return merged;
    });

    showBanner("✓ Ingredients added to grocery list", "success");
    setScreen("grocery");
  }, [setGroceryList, showBanner]);

  // ── Quick add (home screen) ──────────────────────────────────────────────────
  const quickAddGrocery = useCallback(item => {
    setGroceryList(l => [...l, item]);
  }, [setGroceryList]);

  // ── Known ingredient names for autocomplete (recipes + pantry + grocery) ────
  const knownIngredientNames = React.useMemo(() => {
    const names = new Set();
    recipes.forEach(r => (r.ingredients || []).forEach(i => i.name && names.add(i.name)));
    pantry.forEach(i => i.name && names.add(i.name));
    groceryList.forEach(i => i.name && names.add(i.name));
    return [...names];
  }, [recipes, pantry, groceryList]);

  // ── Add all meal-plan ingredients to grocery list ─────────────────────────────
  // Combines quantities across recipes and subtracts what's already in the pantry.
  const addMealPlanToGrocery = useCallback(() => {
    const { combineIngredients, normalizeIngName, convertUnit } = window.APP.utils;

    const allIngredients = [];
    mealPlan.forEach(m => {
      const r = recipes.find(r => r.name === m.name);
      if (r) (r.ingredients || []).forEach(ing => allIngredients.push({ name: ing.name, amount: ing.amount, unit: ing.unit, section: ing.section }));
    });
    if (!allIngredients.length) {
      showBanner("No recipes with ingredients found in your meal plan.", "error");
      return;
    }

    const combined = combineIngredients(allIngredients);

    const finalItems = combined.map(item => {
      const key = pantry.find(p => normalizeIngName(p.name) === normalizeIngName(item.name));
      if (!key) return item; // not in pantry — need to buy full amount
      if (!item.hasAmount) return null; // non-quantifiable ingredient (e.g. "salt to taste") and pantry has it — skip
      if (!key.amount || !key.unit) return null; // pantry has it tracked with no quantity — treat as covered
      const pantryInItemUnit = convertUnit(key.amount, key.unit, item.unit);
      if (pantryInItemUnit === null) {
        // units don't convert between pantry and recipe — can't compute shortfall
        return { ...item, amount: "", unit: "", checkAmount: true };
      }
      const remaining = +(item.amount - pantryInItemUnit).toFixed(3);
      if (remaining <= 0) return null; // pantry fully covers it
      return { ...item, amount: remaining, checkAmount: !!item.mismatched };
    }).filter(Boolean);

    setGroceryList(l => {
      const merged = [...l];
      finalItems.forEach(ni => {
        const exists = merged.find(i => normalizeIngName(i.name) === normalizeIngName(ni.name));
        if (!exists) {
          merged.push({
            id: uid(), name: ni.name, section: ni.section || categorize(ni.name),
            amount: ni.hasAmount ? ni.amount : "", unit: ni.hasAmount ? ni.unit : "",
            checked: false, checkAmount: !!ni.checkAmount,
          });
        }
      });
      return merged;
    });

    showBanner("✓ Grocery list updated — pantry items excluded, duplicates combined", "success");
    setScreen("grocery");
  }, [mealPlan, recipes, pantry, setGroceryList, showBanner]);

  // ── Add completed grocery list items to pantry ────────────────────────────────
  const addGroceryToPantry = useCallback(items => {
    const { normalizeIngName, convertUnit } = window.APP.utils;
    setPantry(p => {
      const updated = [...p];
      items.forEach(item => {
        const idx = updated.findIndex(pi => normalizeIngName(pi.name) === normalizeIngName(item.name));
        const amt = parseFloat(item.amount);
        if (idx === -1) {
          updated.push({ id: uid(), name: item.name, section: item.section || categorize(item.name), amount: isNaN(amt) ? "" : amt, unit: item.unit || "" });
          return;
        }
        const existing = updated[idx];
        if (isNaN(amt) || !item.unit || !existing.amount || !existing.unit) return; // can't combine numerically — leave existing entry
        const converted = convertUnit(amt, item.unit, existing.unit);
        if (converted !== null) updated[idx] = { ...existing, amount: +(existing.amount + converted).toFixed(3) };
        // incompatible units — leave existing pantry entry untouched rather than guess
      });
      return updated;
    });
  }, [setPantry]);

  // ── Mark meal as made (adds to cook history, optionally decrements pantry) ──
  const markAsMade = useCallback((meal, date, removeFromPantry) => {
    const entry = {
      id:         uid(),
      recipeName: meal.name,
      recipeId:   meal.recipeId || null,
      proteins:   meal.proteins || [],
      mealType:   meal.mealType || "Dinner",
      date:       date || new Date().toISOString().split("T")[0],
      madeAt:     Date.now(),
    };
    setCookHistory(h => [...h, entry]);
    setRecipes(rs => rs.map(r => r.name === meal.name ? { ...r, lastMadeAt: Date.now() } : r));
    // Mark checked in meal plan
    setMealPlan(mp => mp.map(m => m.id === meal.id ? { ...m, checked: true, checkedAt: Date.now() } : m));

    if (removeFromPantry) {
      const { normalizeIngName, convertUnit } = window.APP.utils;
      const recipe = recipes.find(r => r.name === meal.name);
      if (recipe) {
        setPantry(p => p.map(pi => {
          const used = (recipe.ingredients || []).find(ing => normalizeIngName(ing.name) === normalizeIngName(pi.name));
          if (!used || !pi.amount || !pi.unit || !used.unit) return pi;
          const usedInPantryUnit = convertUnit(used.amount, used.unit, pi.unit);
          if (usedInPantryUnit === null) return pi; // incompatible units — leave pantry untouched
          return { ...pi, amount: Math.max(0, +(pi.amount - usedInPantryUnit).toFixed(3)) };
        }));
      }
    }

    showBanner(`✓ ${meal.name} marked as made`, "success");
  }, [setCookHistory, setMealPlan, setPantry, recipes, showBanner]);

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
      requestPin,
      settings,
      saveSettings,
      myAppliances,
      addCost,
      showBanner,
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
    }),

    pantry: h(PantryScreen, {
      pantry,
      setPantry,
      addCost,
      knownIngredientNames,
    }),

    settings: h(SettingsScreen, {
      settings,
      saveSettings,
      myAppliances,
      setMyAppliances,
      costTotal: total30,
      requestPin,
      showBanner,
    }),
  };

  // ── Root render ──────────────────────────────────────────────────────────────
  return h(React.Fragment, null,
    h(Banner, { banner }),
    h("div", { className: "app-container" },
      screens[screen] || screens.home,
    ),
    h(BottomNav, { active: screen, onNav: setScreen }),
    pinModal,
  );
}

// ── Mount ─────────────────────────────────────────────────────────────────────
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(h(App, null));
