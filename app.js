// ── js/app.js ─────────────────────────────────────────────────────────────────
// Root component. Owns all top-level state and wires screens together.

const { createElement: h, useState, useCallback } = React;
const {
  usePersist, useCostLog, useBanner, usePinGuard, useSettings,
  BottomNav, Banner,
  HomeScreen, RecipesScreen, MealPlanScreen,
  GroceryScreen, PantryScreen, SettingsScreen,
} = window.APP;
const { uid, scaleAmt, fmtIngredient } = window.APP.utils;
const { categorize } = window.APP;
const { SEED_RECIPES, SEED_STAPLES, DEFAULT_APPLIANCES } = window.APP;

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  // ── Screen ──────────────────────────────────────────────────────────────────
  const [screen, setScreen] = useState("home");

  // ── Persisted state ──────────────────────────────────────────────────────────
  const [recipes,      setRecipes]      = usePersist("hmp_recipes",      SEED_RECIPES);
  const [mealPlan,     setMealPlan]     = usePersist("hmp_mealplan",     []);
  const [groceryList,  setGroceryList]  = usePersist("hmp_grocery",      []);
  const [pantry,       setPantry]       = usePersist("hmp_pantry",       []);
  const [staples,      setStaples]      = usePersist("hmp_staples",      SEED_STAPLES);
  const [myAppliances, setMyAppliances] = usePersist("hmp_appliances",   DEFAULT_APPLIANCES);
  const [settings,     setSettings]     = usePersist("hmp_settings",     window.APP.DEFAULT_SETTINGS);

  // ── Cross-cutting hooks ──────────────────────────────────────────────────────
  const { addCost, total30 }  = useCostLog();
  const { banner, showBanner } = useBanner();
  const { pinModal, requestPin } = usePinGuard(settings.pin);

  // ── Settings save ────────────────────────────────────────────────────────────
  const saveSettings = useCallback(s => setSettings(s), [setSettings]);

  // ── Add recipe to meal plan ──────────────────────────────────────────────────
  // Does NOT navigate away — caller shows its own banner.
  const addToMealPlan = useCallback(recipe => {
    setMealPlan(mp => [
      ...mp,
      {
        id:           uid(),
        name:         recipe.name,
        mealType:     "Dinner",
        course:       recipe.course,
        proteins:     recipe.proteins || [],
        estimatedCost:recipe.estimatedCost || 0,
      },
    ]);
  }, [setMealPlan]);

  // ── Add recipe ingredients to grocery list ───────────────────────────────────
  // Merges intelligently — skips items already on the list (case-insensitive).
  // Stores amount and unit separately to avoid display doubling.
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

    showBanner(`✓ Ingredients added to grocery list`, "success");
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
      onNav:        setScreen,
      onQuickAdd:   quickAddGrocery,
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
    // Global banner (success / error)
    h(Banner, { banner }),

    // Screen content
    h("div", { className: "app-container" },
      screens[screen] || screens.home,
    ),

    // Bottom navigation
    h(BottomNav, { active: screen, onNav: setScreen }),

    // PIN modal (rendered at root so it overlays everything)
    pinModal,
  );
}

// ── Mount ─────────────────────────────────────────────────────────────────────
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(h(App, null));
