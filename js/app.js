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

  // ── Mark meal as made (adds to cook history) ─────────────────────────────────
  const markAsMade = useCallback((meal, date) => {
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
    // Mark checked in meal plan
    setMealPlan(mp => mp.map(m => m.id === meal.id ? { ...m, checked: true, checkedAt: Date.now() } : m));
    showBanner(`✓ ${meal.name} marked as made`, "success");
  }, [setCookHistory, setMealPlan, showBanner]);

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
    }),

    plan: h(MealPlanScreen, {
      mealPlan,
      setMealPlan,
      recipes,
      setRecipes,
      cookHistory,
      onAddToGrocery: addToGrocery,
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
      addCost,
      showBanner,
      priceListResults,
      setPriceListResults,
    }),

    pantry: h(PantryScreen, {
      pantry,
      setPantry,
      addCost,
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
