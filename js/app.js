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

  // ── Cross-cutting hooks ──────────────────────────────────────────────────────
  const { addCost, total30 }     = useCostLog();
  const { banner, showBanner }   = useBanner();
  const { pinModal, requestPin } = usePinGuard(settings.pin);

  // ── Settings save ────────────────────────────────────────────────────────────
  const saveSettings = useCallback(s => setSettings(s), [setSettings]);

  // ── Firebase sync ─────────────────────────────────────────────────────────────
  // Start sync when app loads. Restarts if householdId changes.
  useEffect(() => {
    const householdId = settings.householdId;
    if (!householdId || !window.APP.startSync) return;

    const stop = window.APP.startSync(
      householdId,
      // Callbacks — Firebase overwrites local state
      {
        setGroceryList,
        setRecipes,
        setCostLog,
      },
      // Current local data — used for initial push if Firebase is empty
      {
        groceryList,
        recipes,
        costLog,
      },
    );

    return stop; // Cleans up interval on unmount or householdId change
  }, [settings.householdId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Push to Firebase after local changes ──────────────────────────────────────
  // Debounced — waits 1.5s after last change before writing.
  useEffect(() => {
    if (!settings.householdId || !window.APP.schedulePush) return;
    window.APP.schedulePush(settings.householdId, { groceryList, recipes, costLog });
  }, [groceryList, recipes, costLog, settings.householdId]);

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

  // ── Screen map ───────────────────────────────────────────────────────────────
  const screens = {
    home: h(HomeScreen, {
      settings,
      mealPlan,
      groceryList,
      onNav:      setScreen,
      onQuickAdd: quickAddGrocery,
      addCost,
      showBanner,
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
      onAddToGrocery: addToGrocery,
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
      addCost,
      showBanner,
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
