// ── js/screens/mealplan.js ────────────────────────────────────────────────────
window.APP = window.APP || {};
const { createElement: h, useState } = React;
const { Btn, Card, PillToggle, SectionHeader, EmptyState } = window.APP;
const { uid, fmt$, callClaude, extractText, parseJSON, toggleInArray, plural } = window.APP.utils;
const { MEAL_TYPES, MEAL_ICONS, PROTEINS } = window.APP;

// ── MealPlanScreen ────────────────────────────────────────────────────────────
window.APP.MealPlanScreen = function({ mealPlan, setMealPlan, recipes, setRecipes, cookHistory, onAddToGrocery, onMarkAsMade, requestPin, settings, saveSettings, myAppliances, addCost, showBanner }) {

  const [generating, setGenerating] = useState(false);
  const [genError,   setGenError]   = useState("");
  const [proposed,   setProposed]   = useState([]);
  const [locked,     setLocked]     = useState({});
  const [markingId,  setMarkingId]  = useState(null); // id of meal being marked as made
  const [markDate,   setMarkDate]   = useState(new Date().toISOString().split("T")[0]);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [viewingRecipe, setViewingRecipe] = useState(null); // { meal, recipe, loading, error }

  // Generator filters
  const [daysStr,   setDaysStr]   = useState(String(settings.days || 7));
  const [peopleStr, setPeopleStr] = useState(String(settings.people || 2));
  const [mealTypes, setMealTypes] = useState(settings.defaultMealTypes?.length ? settings.defaultMealTypes : ["Dinner"]);
  const [proteins,  setProteins]  = useState(settings.defaultProteins || []);

  const days   = parseInt(daysStr)   || 1;
  const people = parseInt(peopleStr) || 1;

  // Persist people count to settings
  const handlePeopleBlur = () => {
    const n = Math.max(1, parseInt(peopleStr) || 1);
    setPeopleStr(String(n));
  };

  const toggleMealType = t => setMealTypes(mt => toggleInArray(mt, t));
  const toggleProtein  = p => setProteins(ps  => toggleInArray(ps, p));

  // ── Cook history helpers ────────────────────────────────────────────────────
  // Recipes not made recently (last 30 days)
  const recentlyMade = new Set(
    (cookHistory || [])
      .filter(e => Date.now() - e.madeAt < 30 * 24 * 60 * 60 * 1000)
      .map(e => e.recipeName)
  );

  // Saved recipes not made recently — prioritize these in generation
  // Map meal types to relevant recipe courses
  const relevantCourses = new Set(
    mealTypes.map(t => t === "Breakfast" ? "Breakfast" : t === "Lunch" ? ["Main", "Side", "Appetizer"] : ["Main", "Side"]).flat()
  );

  const savedRecipesNotRecent = recipes
    .filter(r => !recentlyMade.has(r.name) && relevantCourses.has(r.course))
    .slice(0, 6)
    .map(r => r.name);

  const savedRecipesRecent = recipes
    .filter(r => recentlyMade.has(r.name) && relevantCourses.has(r.course))
    .slice(0, 3)
    .map(r => r.name);

  // Cuisines/proteins not had recently
  const recentProteins = new Set(
    (cookHistory || [])
      .filter(e => Date.now() - e.madeAt < 14 * 24 * 60 * 60 * 1000)
      .flatMap(e => e.proteins || [])
  );

  const suggestedProteins = PROTEINS.filter(p => !recentProteins.has(p) && p !== "Other").slice(0, 3);

  // ── Prompt builder ──────────────────────────────────────────────────────────
  const buildPrompt = (need, excludeNames = []) => {
    const parts = [
      `Suggest ${need} meals for ${people} ${plural(people, "person")}.`,
      `Meal types needed: ${mealTypes.join(", ")}.`,
    ];

    if (proteins.length) parts.push(`Proteins: ${proteins.join(", ")}.`);

    if (myAppliances.length) parts.push(`Prefer appliances: ${myAppliances.slice(0, 4).join(", ")}.`);

    // Prioritize saved recipes not made recently
    if (savedRecipesNotRecent.length) {
      parts.push(`PRIORITIZE these saved recipes first (not made recently): ${savedRecipesNotRecent.join(", ")}.`);
    }
    if (savedRecipesRecent.length) {
      parts.push(`These saved recipes were made recently, avoid repeating: ${savedRecipesRecent.join(", ")}.`);
    }

    // Exclude already proposed/locked meals
    if (excludeNames.length) {
      parts.push(`Do NOT suggest any of these (already selected): ${excludeNames.join(", ")}.`);
    }

    parts.push(`Vary proteins across meals — do not suggest more than 2 meals with the same protein unless explicitly requested. Mix cuisines and cooking methods (e.g. don't suggest all grilled or all stovetop meals).`);
    parts.push(`Randomness seed: ${Math.random().toString(36).slice(2, 8)}. Use this to vary your suggestions from previous responses.`);
    parts.push(`Return ONLY a JSON array, no markdown: [{"name":"","mealType":"Dinner","proteins":["Chicken"],"estimatedCost":12,"notes":"","fromSavedRecipe":false}]`);

    return parts.join(" ");
  };

  const totalNeeded = (keepLocked = false) => {
    const lc = keepLocked ? proposed.filter(p => locked[p.id]).length : 0;
    return Math.max(days, 1) * mealTypes.length - lc;
  };

  // ── Generate ────────────────────────────────────────────────────────────────
  const generate = async (keepLocked = false) => {
    if (!mealTypes.length) { setGenError("Select at least one meal type."); return; }
    setGenerating(true); setGenError("");

    const lockedMeals   = keepLocked ? proposed.filter(p => locked[p.id]) : [];
    const excludeNames  = proposed.map(p => p.name); // exclude ALL current proposed
    const need          = totalNeeded(keepLocked);
    if (need <= 0) { setGenerating(false); return; }

    try {
      const data     = await callClaude({ maxTokens: 600, messages: [{ role: "user", content: buildPrompt(need, keepLocked ? excludeNames : []) }] });
      const text     = extractText(data.content);
      const newMeals = parseJSON(text).map(m => ({ ...m, id: uid() }));
      setProposed([...lockedMeals, ...newMeals]);
      addCost("mealPlan");
    } catch {
      setGenError("Could not generate meal plan. Check your connection.");
    }
    setGenerating(false);
  };

  const regenerateUnlocked = async () => {
    setGenerating(true);
    const lockedMeals  = proposed.filter(p => locked[p.id]);
    const need         = proposed.filter(p => !locked[p.id]).length;
    // Exclude ALL current proposed meals (locked + unlocked) so we get fresh suggestions
    const excludeNames = [...new Set([...proposed.map(p => p.name), ...mealPlan.map(m => m.name)])];

    try {
      const data     = await callClaude({ maxTokens: 600, messages: [{ role: "user", content: buildPrompt(need, excludeNames) }] });
      const text     = extractText(data.content);
      const newMeals = parseJSON(text).map(m => ({ ...m, id: uid() }));
      setProposed([...lockedMeals, ...newMeals]);
      addCost("mealPlan");
    } catch {
      setGenError("Could not regenerate. Try again.");
    }
    setGenerating(false);
  };

  const acceptPlan = () => {
    setMealPlan(proposed.map(p => ({ ...p, id: uid(), checked: false })));
    setProposed([]);
    setLocked({});
    showBanner("✓ Meal plan saved!", "success");
  };

  const generateRecipeForMeal = async (meal) => {
    // Check if a saved recipe matches first
    const saved = recipes.find(r => r.name.toLowerCase() === meal.name.toLowerCase());
    if (saved) { setViewingRecipe({ meal, recipe: saved, loading: false, error: "" }); return; }

    setViewingRecipe({ meal, recipe: null, loading: true, error: "" });
    try {
      const data = await callClaude({
        maxTokens: 1000,
        messages: [{
          role: "user",
          content: `Generate a full recipe for "${meal.name}"${meal.proteins?.length ? ` using ${meal.proteins.join(", ")}` : ""}. Return ONLY valid JSON, no markdown:
{"name":"","course":"Main","proteins":[],"tags":[],"appliances":[],"servings":4,"prepTime":0,"cookTime":0,"ingredients":[{"id":"i1","name":"","amount":1,"unit":"","section":"Other"}],"steps":[],"notes":"","estimatedCost":0}`,
        }],
      });
      const text   = extractText(data.content);
      const parsed = parseJSON(text);
      parsed.ingredients = (parsed.ingredients || []).map(ing => ({
        ...ing,
        section: ing.section && ing.section !== "Other" ? ing.section : categorize(ing.name),
      }));
      const recipe = { ...parsed, id: uid(), photo: "", nutrition: {}, sourceLabel: "AI Generated" };
      setViewingRecipe({ meal, recipe, loading: false, error: "" });
      addCost("recipeGen");
    } catch {
      setViewingRecipe({ meal, recipe: null, loading: false, error: "Could not generate recipe. Try again." });
    }
  };

  const saveGeneratedRecipe = () => {
    if (!viewingRecipe?.recipe) return;
    const exists = recipes.find(r => r.name.toLowerCase() === viewingRecipe.recipe.name.toLowerCase());
    if (exists) { showBanner("Recipe already saved.", "success"); return; }
    const toSave = { ...viewingRecipe.recipe, id: uid() };
    // setRecipes is not available here — handled via prop below
    setRecipes(rs => [...rs, toSave]);
    showBanner("✓ Recipe saved!", "success");
    setViewingRecipe(v => ({ ...v, saved: true }));
  };

  const toggleLock   = id => setLocked(l => ({ ...l, [id]: !l[id] }));
  const deleteMeal   = id => setMealPlan(mp => mp.filter(m => m.id !== id));
  const clearAll     = ()  => { setMealPlan([]); setClearConfirm(false); showBanner("Meal plan cleared.", "success"); };

  const addAllToGrocery = () => {
    mealPlan.forEach(m => {
      const r = recipes.find(r => r.name === m.name);
      if (r) onAddToGrocery(r, r.servings);
    });
    showBanner("✓ Ingredients added to grocery list", "success");
  };

  const groupByType = list => MEAL_TYPES.reduce((acc, t) => {
    const items = list.filter(m => m.mealType === t || (t === "Dinner" && !m.mealType));
    if (items.length) acc[t] = items;
    return acc;
  }, {});

  const totalMealsCount = Math.max(days, 1) * mealTypes.length;

  // ── Render ──────────────────────────────────────────────────────────────────
  return h("div", null,
    h(SectionHeader, {
      title: "Meal Plan",
      action: h("div", { className: "flex gap-8" },
        mealPlan.length > 0 && h(Btn, { label: "→ Grocery", variant: "accent", icon: "🛒", onClick: addAllToGrocery, className: "btn-sm" }),
        mealPlan.length > 0 && h(Btn, { label: "Clear All", variant: "danger", onClick: () => setClearConfirm(true), className: "btn-sm" }),
      ),
    }),

    // Clear all confirm
    clearConfirm && h(Card, { style: { marginBottom: 16, border: "2px solid #C0392B" } },
      h("div", { className: "font-bold mb-8", style: { fontSize: 14 } }, "Clear the entire meal plan?"),
      h("div", { className: "muted text-sm", style: { marginBottom: 8 } }, "⚠️ This will clear the meal plan for everyone in your household."),
      h("div", { className: "flex gap-8" },
        h(Btn, { label: "Cancel", variant: "ghost", onClick: () => setClearConfirm(false), style: { flex: 1 } }),
        h(Btn, { label: "Yes, Clear All", variant: "danger", onClick: clearAll, style: { flex: 1 } }),
      ),
    ),

    // ── Suggested for You ────────────────────────────────────────────────────
    cookHistory?.length > 0 && suggestedProteins.length > 0 && h(Card, { style: { marginBottom: 16, background: "#FFF8F0" } },
      h("div", { className: "font-bold font-serif mb-8", style: { fontSize: 14 } }, "💡 Suggested for You"),
      h("div", { className: "muted text-xs", style: { marginBottom: 8 } }, "Based on your cooking history — proteins you haven't had recently:"),
      h("div", { className: "flex wrap gap-6" },
        suggestedProteins.map(p =>
          h("button", {
            key: p,
            onClick: () => setProteins(ps => ps.includes(p) ? ps : [...ps, p]),
            style: { padding: "5px 14px", borderRadius: 20, border: "1.5px solid #D4622A", background: "#FDE8D8", color: "#D4622A", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" },
          }, `+ ${p}`)
        ),
      ),
    ),

    // ── Generator ────────────────────────────────────────────────────────────
    h(Card, { style: { marginBottom: 20 } },
      h("div", { className: "font-bold font-serif mb-12", style: { fontSize: 15 } }, "✨ AI Meal Planner"),

      h("div", { className: "flex gap-10", style: { marginBottom: 14 } },
        h("div", { style: { flex: 1 } },
          h("div", { className: "form-label" }, "# of Days"),
          h("input", {
            className: "form-input", type: "number", min: 1, max: 14,
            value: daysStr,
            onChange:  e => setDaysStr(e.target.value),
            onBlur:    e => setDaysStr(String(Math.max(1, parseInt(e.target.value) || 1))),
          }),
        ),
        h("div", { style: { flex: 1 } },
          h("div", { className: "form-label" }, "# of People"),
          h("input", {
            className: "form-input", type: "number", min: 1, max: 20,
            value: peopleStr,
            onChange:  e => setPeopleStr(e.target.value),
            onBlur:    handlePeopleBlur,
          }),
        ),
      ),

      h("div", { style: { marginBottom: 14 } },
        h("div", { className: "form-label" }, "Meal Types"),
        h("div", { className: "flex gap-8" },
          MEAL_TYPES.map(t => {
            const on = mealTypes.includes(t);
            return h("button", {
              key: t, type: "button",
              className: `meal-type-btn ${on ? "active" : ""}`,
              onClick: () => toggleMealType(t),
            },
              h("span", { className: "meal-type-icon" }, MEAL_ICONS[t]),
              t,
            );
          }),
        ),
      ),

      h("div", { style: { marginBottom: 14 } },
        h("div", { className: "form-label" }, "Protein ",
          h("span", { className: "muted", style: { fontWeight: 400, fontSize: 11 } }, "(blank = any)"),
        ),
        h(PillToggle, { options: PROTEINS, selected: proteins, onToggle: toggleProtein }),
      ),

      mealTypes.length > 0 && h("div", { style: { fontSize: 12, color: "#7A6A55", marginBottom: 10, textAlign: "center", padding: "8px", background: "#FFF8F0", borderRadius: 8 } },
        h("strong", { style: { color: "#D4622A" } }, `${totalMealsCount} ${plural(totalMealsCount, "meal")}`),
        ` · ${days} ${plural(days, "day")} × ${mealTypes.length} meal${mealTypes.length > 1 ? "s" : ""}/day · ${people} ${plural(people, "person")}`,
      ),

      h(Btn, {
        label: generating ? "Generating…" : "Generate Meal Plan",
        icon: "✨",
        onClick: () => generate(false),
        disabled: generating || !mealTypes.length,
        className: "btn-full",
      }),
      genError && h("div", { className: "warn text-sm mt-8" }, genError),
    ),

    // ── Proposed plan ─────────────────────────────────────────────────────────
    proposed.length > 0 && h(Card, { className: "proposed-card", style: { marginBottom: 20 } },
      h("div", { className: "primary font-bold font-serif", style: { fontSize: 15, marginBottom: 4 } }, "Proposed Plan"),
      h("div", { style: { display: "flex", alignItems: "center", gap: 16, marginBottom: 12 } },
        h("div", { className: "muted text-sm" },
          h("span", { style: { color: "#2A7D4F", fontWeight: 700 } }, "✅ = keep  "),
          h("span", { style: { color: "#C0392B", fontWeight: 700 } }, "❌ = regenerate"),
        ),
      ),

      Object.entries(groupByType(proposed)).map(([type, meals]) =>
        h("div", { key: type, style: { marginBottom: 12 } },
          h("div", { className: "grocery-section-label" }, `${MEAL_ICONS[type]} ${type}`),
          meals.map(m =>
            h("div", { key: m.id, className: "flex-center gap-10 divider", style: { padding: "10px 0" } },
              h("button", {
                type: "button",
                onClick: () => toggleLock(m.id),
                title: locked[m.id] ? "Click to mark for regeneration" : "Click to keep this meal",
                style: { fontSize: 22, background: "none", border: "none", cursor: "pointer", flexShrink: 0, lineHeight: 1 },
              }, locked[m.id] ? "✅" : "❌"),
              h("div", { style: { flex: 1 } },
                h("div", { className: "font-bold", style: { fontSize: 14 } },
                  m.name,
                  m.fromSavedRecipe && h("span", { style: { fontSize: 10, color: "#2A7D4F", fontWeight: 600, marginLeft: 6, background: "#E8F4EC", padding: "2px 6px", borderRadius: 8 } }, "saved"),
                ),
                h("div", { className: "muted text-sm" },
                  (m.proteins || []).join(", "),
                  m.estimatedCost ? ` · ${fmt$(m.estimatedCost)}` : "",
                ),
                m.notes && h("div", { className: "muted text-sm italic" }, m.notes),
              ),
            )
          ),
        )
      ),

      h("div", { className: "flex gap-10", style: { marginTop: 14 } },
        h(Btn, { label: "Regenerate ❌ Meals", variant: "ghost", onClick: regenerateUnlocked, disabled: generating, style: { flex: 1, fontSize: 12 } }),
        h(Btn, { label: "Accept Plan", onClick: acceptPlan, style: { flex: 1 } }),
      ),
    ),

    // ── Recipe viewer modal ───────────────────────────────────────────────────
    viewingRecipe && h("div", {
      style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "flex-end" },
      onClick: () => setViewingRecipe(null),
    },
      h("div", {
        style: { background: "#FFF8F0", borderRadius: "20px 20px 0 0", width: "100%", maxHeight: "85vh", overflowY: "auto", padding: "20px 16px 32px" },
        onClick: e => e.stopPropagation(),
      },
        h("div", { className: "flex-between", style: { marginBottom: 16 } },
          h("div", { className: "font-bold font-serif", style: { fontSize: 18 } }, viewingRecipe.meal.name),
          h("button", { onClick: () => setViewingRecipe(null), style: { background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#7A6A55" } }, "×"),
        ),
        viewingRecipe.loading && h("div", { className: "muted text-sm", style: { textAlign: "center", padding: 24 } }, "✨ Generating recipe…"),
        viewingRecipe.error && h("div", { className: "warn text-sm" }, viewingRecipe.error),
        viewingRecipe.recipe && h(React.Fragment, null,
          h("div", { className: "flex wrap gap-6", style: { marginBottom: 12 } },
            viewingRecipe.recipe.sourceLabel && h("span", { style: { fontSize: 11, fontWeight: 600, color: viewingRecipe.recipe.sourceLabel === "AI Generated" ? "#D4622A" : "#2A6A9E", background: viewingRecipe.recipe.sourceLabel === "AI Generated" ? "#FDE8D8" : "#E8EEF8", padding: "2px 8px", borderRadius: 8 } },
              viewingRecipe.recipe.sourceLabel === "AI Generated" ? "✨ AI Generated" : `📎 ${viewingRecipe.recipe.sourceLabel}`
            ),
          ),
          h("div", { className: "font-bold font-serif mb-8", style: { fontSize: 14 } }, "Ingredients"),
          h(Card, { style: { marginBottom: 12 } },
            (viewingRecipe.recipe.ingredients || []).map(ing =>
              h("div", { key: ing.id, className: "flex-between divider", style: { padding: "5px 0", fontSize: 13 } },
                h("span", null, ing.name),
                h("span", { className: "muted" }, `${ing.amount} ${ing.unit}`),
              )
            ),
          ),
          h("div", { className: "font-bold font-serif mb-8", style: { fontSize: 14 } }, "Instructions"),
          h(Card, { style: { marginBottom: 12 } },
            (viewingRecipe.recipe.steps || []).map((s, i) =>
              h("div", { key: i, className: "flex gap-12", style: { marginBottom: 10 } },
                h("div", { className: "step-num" }, i + 1),
                h("div", { style: { fontSize: 13, lineHeight: 1.6 } }, s),
              )
            ),
          ),
          viewingRecipe.recipe.notes && h("div", { className: "muted text-sm italic", style: { marginBottom: 12 } }, `📝 ${viewingRecipe.recipe.notes}`),
          !viewingRecipe.saved && viewingRecipe.recipe.sourceLabel === "AI Generated" && h(Btn, {
            label: "📥 Save to Recipes",
            onClick: saveGeneratedRecipe,
            className: "btn-full",
            style: { marginBottom: 8 },
          }),
          viewingRecipe.saved && h("div", { style: { textAlign: "center", fontSize: 13, color: "#2A7D4F", fontWeight: 600, marginBottom: 8 } }, "📖 Saved to recipes"),
        ),
      ),
    ),

    // ── Recipe viewer modal ───────────────────────────────────────────────────
    viewingRecipe && h("div", {
      style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "flex-end" },
      onClick: () => setViewingRecipe(null),
    },
      h("div", {
        style: { background: "#FFF8F0", borderRadius: "20px 20px 0 0", width: "100%", maxHeight: "85vh", overflowY: "auto", padding: "20px 16px 32px" },
        onClick: e => e.stopPropagation(),
      },
        h("div", { className: "flex-between", style: { marginBottom: 16 } },
          h("div", { className: "font-bold font-serif", style: { fontSize: 18 } }, viewingRecipe.meal.name),
          h("button", { onClick: () => setViewingRecipe(null), style: { background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#7A6A55" } }, "×"),
        ),
        viewingRecipe.loading && h("div", { className: "muted text-sm", style: { textAlign: "center", padding: 24 } }, "✨ Generating recipe…"),
        viewingRecipe.error && h("div", { className: "warn text-sm" }, viewingRecipe.error),
        viewingRecipe.recipe && h(React.Fragment, null,
          h("div", { className: "flex wrap gap-6", style: { marginBottom: 12 } },
            viewingRecipe.recipe.sourceLabel && h("span", { style: { fontSize: 11, fontWeight: 600, color: viewingRecipe.recipe.sourceLabel === "AI Generated" ? "#D4622A" : "#2A6A9E", background: viewingRecipe.recipe.sourceLabel === "AI Generated" ? "#FDE8D8" : "#E8EEF8", padding: "2px 8px", borderRadius: 8 } },
              viewingRecipe.recipe.sourceLabel === "AI Generated" ? "✨ AI Generated" : `📎 ${viewingRecipe.recipe.sourceLabel}`
            ),
          ),
          h("div", { className: "font-bold font-serif mb-8", style: { fontSize: 14 } }, "Ingredients"),
          h(Card, { style: { marginBottom: 12 } },
            (viewingRecipe.recipe.ingredients || []).map(ing =>
              h("div", { key: ing.id, className: "flex-between divider", style: { padding: "5px 0", fontSize: 13 } },
                h("span", null, ing.name),
                h("span", { className: "muted" }, `${ing.amount} ${ing.unit}`),
              )
            ),
          ),
          h("div", { className: "font-bold font-serif mb-8", style: { fontSize: 14 } }, "Instructions"),
          h(Card, { style: { marginBottom: 12 } },
            (viewingRecipe.recipe.steps || []).map((s, i) =>
              h("div", { key: i, className: "flex gap-12", style: { marginBottom: 10 } },
                h("div", { className: "step-num" }, i + 1),
                h("div", { style: { fontSize: 13, lineHeight: 1.6 } }, s),
              )
            ),
          ),
          viewingRecipe.recipe.notes && h("div", { className: "muted text-sm italic", style: { marginBottom: 12 } }, `📝 ${viewingRecipe.recipe.notes}`),
          !viewingRecipe.saved && viewingRecipe.recipe.sourceLabel === "AI Generated" && h(Btn, {
            label: "📥 Save to Recipes",
            onClick: saveGeneratedRecipe,
            className: "btn-full",
            style: { marginBottom: 8 },
          }),
          viewingRecipe.saved && h("div", { style: { textAlign: "center", fontSize: 13, color: "#2A7D4F", fontWeight: 600, marginBottom: 8 } }, "📖 Saved to recipes"),
        ),
      ),
    ),

    // ── Recipe viewer modal ───────────────────────────────────────────────────
    viewingRecipe && h("div", {
      style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "flex-end" },
      onClick: () => setViewingRecipe(null),
    },
      h("div", {
        style: { background: "#FFF8F0", borderRadius: "20px 20px 0 0", width: "100%", maxHeight: "85vh", overflowY: "auto", padding: "20px 16px 32px" },
        onClick: e => e.stopPropagation(),
      },
        h("div", { className: "flex-between", style: { marginBottom: 16 } },
          h("div", { className: "font-bold font-serif", style: { fontSize: 18 } }, viewingRecipe.meal.name),
          h("button", { onClick: () => setViewingRecipe(null), style: { background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#7A6A55" } }, "×"),
        ),
        viewingRecipe.loading && h("div", { className: "muted text-sm", style: { textAlign: "center", padding: 24 } }, "✨ Generating recipe…"),
        viewingRecipe.error && h("div", { className: "warn text-sm" }, viewingRecipe.error),
        viewingRecipe.recipe && h(React.Fragment, null,
          h("div", { className: "flex wrap gap-6", style: { marginBottom: 12 } },
            viewingRecipe.recipe.sourceLabel && h("span", { style: { fontSize: 11, fontWeight: 600, color: viewingRecipe.recipe.sourceLabel === "AI Generated" ? "#D4622A" : "#2A6A9E", background: viewingRecipe.recipe.sourceLabel === "AI Generated" ? "#FDE8D8" : "#E8EEF8", padding: "2px 8px", borderRadius: 8 } },
              viewingRecipe.recipe.sourceLabel === "AI Generated" ? "✨ AI Generated" : `📎 ${viewingRecipe.recipe.sourceLabel}`
            ),
          ),
          h("div", { className: "font-bold font-serif mb-8", style: { fontSize: 14 } }, "Ingredients"),
          h(Card, { style: { marginBottom: 12 } },
            (viewingRecipe.recipe.ingredients || []).map(ing =>
              h("div", { key: ing.id, className: "flex-between divider", style: { padding: "5px 0", fontSize: 13 } },
                h("span", null, ing.name),
                h("span", { className: "muted" }, `${ing.amount} ${ing.unit}`),
              )
            ),
          ),
          h("div", { className: "font-bold font-serif mb-8", style: { fontSize: 14 } }, "Instructions"),
          h(Card, { style: { marginBottom: 12 } },
            (viewingRecipe.recipe.steps || []).map((s, i) =>
              h("div", { key: i, className: "flex gap-12", style: { marginBottom: 10 } },
                h("div", { className: "step-num" }, i + 1),
                h("div", { style: { fontSize: 13, lineHeight: 1.6 } }, s),
              )
            ),
          ),
          viewingRecipe.recipe.notes && h("div", { className: "muted text-sm italic", style: { marginBottom: 12 } }, `📝 ${viewingRecipe.recipe.notes}`),
          !viewingRecipe.saved && viewingRecipe.recipe.sourceLabel === "AI Generated" && h(Btn, {
            label: "📥 Save to Recipes",
            onClick: saveGeneratedRecipe,
            className: "btn-full",
            style: { marginBottom: 8 },
          }),
          viewingRecipe.saved && h("div", { style: { textAlign: "center", fontSize: 13, color: "#2A7D4F", fontWeight: 600, marginBottom: 8 } }, "📖 Saved to recipes"),
        ),
      ),
    ),

    // ── Empty state ───────────────────────────────────────────────────────────
    mealPlan.length === 0 && proposed.length === 0 && h(EmptyState, {
      icon: "🗓",
      title: "No meals planned yet",
      sub: "Generate a plan above or add meals from your recipes",
    }),

    // ── Current plan ──────────────────────────────────────────────────────────
    mealPlan.length > 0 && h("div", null,
      h("div", { className: "font-bold font-serif mb-12", style: { fontSize: 16 } }, "Current Plan"),

      Object.entries(groupByType(mealPlan)).map(([type, meals]) =>
        h("div", { key: type, style: { marginBottom: 14 } },
          h("div", { className: "grocery-section-label" }, `${MEAL_ICONS[type]} ${type}`),
          meals.map(m =>
            h(Card, { key: m.id, className: "card-compact", style: { marginBottom: 8, opacity: m.checked ? 0.6 : 1 } },
              h("div", { className: "flex-between" },
                h("div", { style: { flex: 1 } },
                  h("div", {
                    className: "font-bold",
                    style: { fontSize: 15, textDecoration: m.checked ? "line-through" : "none", color: m.checked ? "#7A6A55" : "#D4622A", cursor: "pointer" },
                    onClick: () => generateRecipeForMeal(m),
                  }, m.name, h("span", { style: { fontSize: 11, color: "#7A6A55", fontWeight: 400, marginLeft: 6 } }, "view recipe →")),
                  h("div", { className: "muted text-sm" },
                    (m.proteins || []).join(", "),
                    m.estimatedCost ? ` · ${fmt$(m.estimatedCost)}` : "",
                    m.checked && m.checkedAt && ` · Made ${new Date(m.checkedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
                  ),
                ),
                h("button", {
                  onClick: () => deleteMeal(m.id),
                  style: { background: "none", border: "none", cursor: "pointer", color: "#C0392B", fontSize: 20, flexShrink: 0, marginLeft: 8 },
                }, "×"),
              ),

              // Mark as Made button (only if not already checked)
              !m.checked && h("div", { style: { marginTop: 8, display: "flex", gap: 8, alignItems: "center" } },
                // Show date input inline when marking
                markingId === m.id
                  ? h(React.Fragment, null,
                      h("input", {
                        type: "date",
                        value: markDate,
                        onChange: e => setMarkDate(e.target.value),
                        style: { flex: 1, padding: "6px 10px", borderRadius: 8, border: "1.5px solid #F0E6D3", fontSize: 13, outline: "none", background: "#FFF8F0", fontFamily: "'DM Sans',sans-serif" },
                      }),
                      h(Btn, {
                        label: "Confirm",
                        onClick: () => { onMarkAsMade(m, markDate); setMarkingId(null); },
                        style: { fontSize: 12, padding: "6px 12px" },
                      }),
                      h(Btn, {
                        label: "Cancel",
                        variant: "ghost",
                        onClick: () => setMarkingId(null),
                        style: { fontSize: 12, padding: "6px 10px" },
                      }),
                    )
                  : h("button", {
                      onClick: () => { setMarkingId(m.id); setMarkDate(new Date().toISOString().split("T")[0]); },
                      style: { background: "none", border: "1.5px solid #2A7D4F", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, color: "#2A7D4F", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" },
                    }, "✓ Mark as Made"),
              ),
            )
          ),
        )
      ),

      h("div", { className: "text-right muted text-sm", style: { paddingTop: 4 } },
        `Est. total: ${fmt$(mealPlan.reduce((s, m) => s + (m.estimatedCost || 0), 0))}`,
      ),
    ),
  );
};
