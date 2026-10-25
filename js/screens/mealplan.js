// ── js/screens/mealplan.js ────────────────────────────────────────────────────
window.APP = window.APP || {};
const { createElement: h, useState } = React;
const { Btn, Card, PillToggle, SectionHeader, EmptyState } = window.APP;
const { uid, fmt$, callClaude, extractText, parseJSON, toggleInArray, plural, scaleAmt, fmtIngredient } = window.APP.utils;
const { MEAL_TYPES, MEAL_ICONS, PROTEINS, usePersist } = window.APP;

const servingBtnStyle   = { background: "none", border: "1.5px solid #F0E6D3", borderRadius: 6, width: 22, height: 22, cursor: "pointer", color: "#7A6A55", fontSize: 14, lineHeight: 1, padding: 0 };
const deductionRowStyle = { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#7A6A55", cursor: "pointer", padding: "3px 0" };
const deductionBoxStyle = { width: 14, height: 14, accentColor: "#2A7D4F", cursor: "pointer", flexShrink: 0 };

// ── MealPlanScreen ────────────────────────────────────────────────────────────
window.APP.MealPlanScreen = function({ mealPlan, setMealPlan, recipes, setRecipes, cookHistory, onAddToGrocery, onAddMealPlanToGrocery, onMarkAsMade, onUndoMarkAsMade, onAddRecipeToMeal, onAddToMealPlan, requestPin, settings, saveSettings, myAppliances, addCost, showBanner, ingredients, pantry, weeklyVotes, onNav, autoGenerate, onAutoGenerateHandled }) {

  const [generating, setGenerating] = useState(false);
  const [genError,   setGenError]   = useState("");
  const [genMode,    setGenMode]    = useState("ai"); // "ai" | "recipes" — which source the generator pulls from
  const [proposed,   setProposed]   = usePersist("hmp_proposed", []);
  const [proposedAt, setProposedAt] = usePersist("hmp_proposed_at", null);
  const [locked,     setLocked]     = useState({});
  const [markingId,  setMarkingId]  = useState(null); // id of meal being marked as made
  const [markDate,   setMarkDate]   = useState(new Date().toISOString().split("T")[0]);
  const [skipDeductions, setSkipDeductions] = useState([]); // pantry ids unticked in the "mark as made" preview
  const [groceryLoading, setGroceryLoading] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [viewingRecipe, setViewingRecipe] = useState(null); // { meal, recipe, loading, error }
  const recipeCache = React.useRef({});
  const [addingToMealId, setAddingToMealId] = useState(null); // meal.id currently showing the "link a recipe" search
  const [addRecipeSearch, setAddRecipeSearch] = useState("");

  // Generator filters
  const [daysStr,         setDaysStr]         = useState(String(settings.days || 7));
  const [peopleStr,       setPeopleStr]        = useState(String(settings.people || 2));
  const [mealTypes,       setMealTypes]        = useState(settings.defaultMealTypes?.length ? settings.defaultMealTypes : ["Dinner"]);
  const [proteins,        setProteins]         = useState(settings.defaultProteins || []);
  const [activeKeywords,  setActiveKeywords]   = useState(
    (settings.keywords || []).filter(k => k.default).map(k => k.label)
  );

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
      .flatMap(e => (e.recipeName || "").split(" + "))
  );

  // Saved recipes not made recently — prioritize these in generation
  // Map meal types to relevant recipe courses
  const relevantCourses = new Set(
    mealTypes.map(t => t === "Breakfast" ? "Breakfast" : t === "Lunch" ? ["Main", "Side", "Appetizer"] : ["Main", "Side"]).flat()
  );

  // "Haven't made in a while": saved recipes you've cooked before, but not in the
  // last 30 days, longest-ago first. Last-made comes from the recipe or cook history.
  const lastMadeOf = r => Math.max(r.lastMadeAt || 0, ...(cookHistory || [])
    .filter(e => (e.recipeIds || []).includes(r.id) || (e.recipeName || "").toLowerCase().split(" + ").includes(r.name.toLowerCase()))
    .map(e => e.madeAt || 0));
  const plannedIds = new Set(mealPlan.filter(m => !m.checked).flatMap(m => m.recipeIds || []));
  const notMadeInAWhile = recipes
    .filter(r => !r.hidden && (r.course === "Main" || r.course === "Breakfast") && !plannedIds.has(r.id))
    .map(r => ({ recipe: r, lastMade: lastMadeOf(r) }))
    .filter(x => x.lastMade && Date.now() - x.lastMade >= 30 * 24 * 60 * 60 * 1000)
    .sort((a, b) => a.lastMade - b.lastMade)
    .slice(0, 5);

  // ── This Week's Picks ───────────────────────────────────────────────────────
  const { voting } = window.APP;
  const voters = voting.votersFrom(settings);
  const weekly = weeklyVotes?.weekKey === voting.weekKeyFor() && weeklyVotes.recipeIds?.length ? weeklyVotes : null;
  const voteProgress = voting.voteProgress(weekly, voters);
  const progressText = voteProgress.map(p => `${p.name} ${p.count === p.total ? "✓" : `${p.count}/${p.total}`}`).join(" · ");

  // ── Build proposed meals from saved recipes (no AI call — zero cost) ────────
  const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);

  // With picks this week: 👍👍 first, then at least one 👍, then ➖/unvoted picks
  // (varying proteins), then the rest of the library. Anything with a 👎 is out.
  // With no votes yet, all 20 picks count as ➖ — still used before the library.
  // usePicks=false (regenerating ❌ slots) draws from the whole library; 👎 is still out.
  const buildFromRecipes = (need, excludeNames = [], usePicks = true) => {
    const excluded = new Set(excludeNames.map(n => n.toLowerCase()));
    const tierOf = r => weekly ? voting.voteTier(weekly.votes?.[r.id], voters) : "neutral";
    const pool = recipes.filter(r =>
      !r.hidden &&
      !excluded.has(r.name.toLowerCase()) &&
      (r.mealTypes?.length ? r.mealTypes.some(t => mealTypes.includes(t)) : relevantCourses.has(r.course)) &&
      (!proteins.length || (r.proteins || []).some(p => proteins.includes(p))) &&
      tierOf(r) !== "veto"
    );

    // Favor recipes not made in the last 30 days; only dip into recently-made
    // ones if there aren't enough fresh matches to fill the request.
    const freshFirst = list => [
      ...shuffle(list.filter(r => !recentlyMade.has(r.name))),
      ...shuffle(list.filter(r => recentlyMade.has(r.name))),
    ];

    // Vary proteins — same "no more than 2 of the same protein" rule the AI prompt uses.
    let picked = [];
    let rest   = pool;
    if (weekly && usePicks) {
      const inPicks = new Set(weekly.recipeIds);
      const picks   = pool.filter(r => inPicks.has(r.id));
      picked = [
        ...shuffle(picks.filter(r => tierOf(r) === "both")),
        ...shuffle(picks.filter(r => tierOf(r) === "one")),
      ].slice(0, need);
      picked = voting.pickWithProteinCap(freshFirst(picks.filter(r => tierOf(r) === "neutral")), need, 2, picked);
      rest   = pool.filter(r => !inPicks.has(r.id));
    }
    picked = voting.pickWithProteinCap(freshFirst(rest), need, 2, picked);

    return picked.map(r => ({
      id:              uid(),
      name:            r.name,
      mealType:        r.mealTypes?.find(t => mealTypes.includes(t)) || mealTypes[0],
      proteins:        r.proteins || [],
      estimatedCost:   r.estimatedCost || 0,
      notes:           "",
      fromSavedRecipe: true,
      recipeIds:       [r.id], // pre-linked — "view recipe" skips the AI recipe-gen call entirely
    }));
  };

  // ── Prompt builder ──────────────────────────────────────────────────────────
  const buildPrompt = (need, excludeNames = []) => {
    const parts = [
      `Suggest ${need} meals for ${people} ${plural(people, "person")}.`,
      `Meal types needed: ${mealTypes.join(", ")}.`,
    ];

    if (proteins.length) parts.push(`Proteins: ${proteins.join(", ")}.`);

    if (myAppliances.length) parts.push(`Prefer appliances: ${myAppliances.slice(0, 4).join(", ")}.`);

    // (saved recipe prioritization removed — using variety/randomness instead)

    // Exclude already proposed/locked meals
    if (excludeNames.length) {
      parts.push(`Do NOT suggest any of these (already selected): ${excludeNames.join(", ")}.`);
    }

    if (activeKeywords.length) parts.push(`Apply these preferences to all meals: ${activeKeywords.join(", ")}.`);
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
  const generate = async (keepLocked = false, mode = genMode) => {
    if (!mealTypes.length) { setGenError("Select at least one meal type."); return; }
    setGenerating(true); setGenError("");

    const lockedMeals   = keepLocked ? proposed.filter(p => locked[p.id]) : [];
    const excludeNames  = proposed.map(p => p.name); // exclude ALL current proposed
    const need          = totalNeeded(keepLocked);
    if (need <= 0) { setGenerating(false); return; }

    if (mode === "recipes") {
      const newMeals = buildFromRecipes(need, keepLocked ? excludeNames : []);
      setProposed([...lockedMeals, ...newMeals]);
      setProposedAt(Date.now());
      if (newMeals.length < need) setGenError(`Only found ${newMeals.length} of ${need} matching saved recipes — fill the rest manually, or switch to AI and regenerate the ❌ slots.`);
      setGenerating(false);
      return;
    }

    try {
      const data     = await callClaude({ maxTokens: 600, messages: [{ role: "user", content: buildPrompt(need, keepLocked ? excludeNames : []) }] });
      const text     = extractText(data.content);
      const newMeals = parseJSON(text).map(m => ({ ...m, id: uid() }));
      setProposed([...lockedMeals, ...newMeals]);
      setProposedAt(Date.now());
      addCost("mealPlan");
    } catch {
      setGenError("Could not generate meal plan. Check your connection.");
    }
    setGenerating(false);
  };

  // "Generate Meal Plan from Picks" on the vote screen lands here
  React.useEffect(() => {
    if (!autoGenerate) return;
    onAutoGenerateHandled();
    setGenMode("recipes");
    generate(false, "recipes");
  }, [autoGenerate]); // eslint-disable-line

  const regenerateUnlocked = async () => {
    setGenerating(true); setGenError("");
    const lockedMeals  = proposed.filter(p => locked[p.id]);
    const need         = proposed.filter(p => !locked[p.id]).length;
    // Exclude ALL current proposed meals (locked + unlocked) so we get fresh suggestions
    const excludeNames = [...new Set([...proposed.map(p => p.name), ...mealPlan.map(m => m.name)])];

    if (genMode === "recipes") {
      const newMeals = buildFromRecipes(need, excludeNames, false);
      setProposed([...lockedMeals, ...newMeals]);
      setProposedAt(Date.now());
      if (newMeals.length < need) setGenError(`Only found ${newMeals.length} of ${need} matching saved recipes — fill the rest manually, or switch to AI and regenerate the ❌ slots.`);
      setGenerating(false);
      return;
    }

    try {
      const data     = await callClaude({ maxTokens: 600, messages: [{ role: "user", content: buildPrompt(need, excludeNames) }] });
      const text     = extractText(data.content);
      const newMeals = parseJSON(text).map(m => ({ ...m, id: uid() }));
      setProposed([...lockedMeals, ...newMeals]);
      setProposedAt(Date.now());
      addCost("mealPlan");
    } catch {
      setGenError("Could not regenerate. Try again.");
    }
    setGenerating(false);
  };

  const acceptPlan = () => {
    // Saved recipes keep their own serving count; AI meals use the people count
    const servingsFor = p => window.APP.utils.mealRecipes(p, recipes)[0]?.servings || people;
    setMealPlan(mp => [...mp, ...proposed.map(p => ({ ...p, id: uid(), checked: false, servings: servingsFor(p) }))]);
    setProposed([]);
    setProposedAt(null);
    setLocked({});
    showBanner("✓ Meal plan saved!", "success");
  };

  const generateRecipeForMeal = async (meal) => {
    // Combo meal — linked recipes are already saved, just show them (no AI call)
    if (meal.recipeIds && meal.recipeIds.length) {
      const linked = meal.recipeIds.map(id => recipes.find(r => r.id === id)).filter(Boolean);
      if (linked.length) { setViewingRecipe({ meal, recipes: linked, loading: false, error: "" }); return; }
    }

    // Check if a saved recipe matches first
    const saved = recipes.find(r => r.name.toLowerCase() === meal.name.toLowerCase());
    if (saved) { setViewingRecipe({ meal, recipes: [saved], loading: false, error: "" }); return; }

    // Check in-memory cache
    const cached = recipeCache.current[meal.name];
    if (cached) { setViewingRecipe({ meal, recipes: [cached], loading: false, error: "" }); return; }

    setViewingRecipe({ meal, recipes: [], loading: true, error: "" });
    try {
      const recipe = await window.APP.utils.generateRecipeFor(meal, ingredients);
      recipeCache.current[meal.name] = recipe;
      setViewingRecipe({ meal, recipes: [recipe], loading: false, error: "" });
      addCost("recipeGen");
    } catch {
      setViewingRecipe({ meal, recipes: [], loading: false, error: "Could not generate recipe. Try again." });
    }
  };

  // Saves the generated recipe and links it to the meal, so "→ Grocery" and
  // "Mark as Made" use it directly (no second generation, no name matching).
  const saveGeneratedRecipe = () => {
    const recipe = viewingRecipe?.recipes?.[0];
    const mealId = viewingRecipe?.meal?.id;
    if (!recipe) return;
    const exists = recipes.find(r => r.name.toLowerCase() === recipe.name.toLowerCase());
    const linkId = exists ? exists.id : recipe.id;
    if (!exists) setRecipes(rs => [...rs, recipe]);
    if (mealId) setMealPlan(mp => mp.map(m => m.id === mealId ? { ...m, recipeIds: [linkId] } : m));
    showBanner(exists ? "Recipe already saved — linked to this meal." : "✓ Recipe saved!", "success");
    setViewingRecipe(v => ({ ...v, saved: true }));
  };

  // Servings for a meal: its own count, or the linked recipe's for older entries.
  const mealServings = m => m.servings || window.APP.utils.mealRecipes(m, recipes)[0]?.servings || settings.people || 2;
  const setMealServings = (id, n) => setMealPlan(mp => mp.map(x => x.id === id ? { ...x, servings: Math.max(1, n) } : x));

  const toggleLock   = id => setLocked(l => ({ ...l, [id]: !l[id] }));
  const deleteMeal   = id => setMealPlan(mp => mp.filter(m => m.id !== id));
  const clearAll     = ()  => { setMealPlan([]); setClearConfirm(false); showBanner("Meal plan cleared.", "success"); };

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

    // ── Haven't Made in a While ──────────────────────────────────────────────
    notMadeInAWhile.length > 0 && h(Card, { style: { marginBottom: 16, background: "#FFF8F0" } },
      h("div", { className: "font-bold font-serif mb-8", style: { fontSize: 14 } }, "💡 Haven't Made in a While"),
      h("div", { className: "muted text-xs", style: { marginBottom: 4 } }, "Saved meals you haven’t cooked in 30+ days. Tap a meal slot to add one to the plan:"),
      notMadeInAWhile.map(({ recipe: r, lastMade }) =>
        h("div", { key: r.id, className: "flex-center gap-8 divider", style: { padding: "6px 0" } },
          h("div", { style: { flex: 1, minWidth: 0 } },
            h("div", { className: "font-bold", style: { fontSize: 13 } }, r.name),
            h("div", { className: "muted text-xs" }, `Last made ${new Date(lastMade).toLocaleDateString("en-US", { month: "short", day: "numeric", year: new Date(lastMade).getFullYear() === new Date().getFullYear() ? undefined : "numeric" })}`),
          ),
          MEAL_TYPES.map(t => h("button", {
            key: t,
            title: `Add as ${t}`,
            onClick: () => { onAddToMealPlan(r, t); showBanner(`✓ ${r.name} added to ${t}`, "success"); },
            style: { background: "none", border: `1.5px solid ${(r.mealTypes || []).includes(t) ? "#D4622A" : "#F0E6D3"}`, borderRadius: 8, padding: "3px 6px", fontSize: 14, cursor: "pointer", flexShrink: 0 },
          }, MEAL_ICONS[t])),
        )
      ),
    ),

    // ── This Week's Picks ────────────────────────────────────────────────────
    weekly && h(Card, { style: { marginBottom: 16, cursor: "pointer" }, onClick: () => onNav("vote") },
      h("div", { className: "flex-between" },
        h("div", null,
          h("div", { className: "font-bold font-serif", style: { fontSize: 15 } }, "🗳 This Week's Picks"),
          h("div", { className: "muted text-sm" }, `Vote on ${weekly.recipeIds.length} recipes · ${progressText}`),
        ),
        h("span", { style: { color: "#D4622A", fontSize: 20, fontWeight: 700 } }, "→"),
      ),
    ),

    // ── Generator ────────────────────────────────────────────────────────────
    h(Card, { style: { marginBottom: 20 } },
      h("div", { className: "font-bold font-serif mb-12", style: { fontSize: 15 } }, "✨ Meal Plan Generator"),

      h("div", { style: { marginBottom: 14 } },
        h("div", { className: "form-label" }, "Generate From"),
        h("div", { className: "mode-toggle" },
          h("button", { type: "button", className: `mode-btn ${genMode === "recipes" ? "active" : ""}`, onClick: () => setGenMode("recipes") }, "📖 My Recipes"),
          h("button", { type: "button", className: `mode-btn ${genMode === "ai" ? "active" : ""}`, onClick: () => setGenMode("ai") }, "✨ AI"),
        ),
        genMode === "recipes" && h("div", { className: "muted text-xs", style: { marginTop: 6 } },
          weekly
            ? `Uses this week's picks first (${progressText}), then the rest of your recipes.`
            : "No picks this week — choosing from all your saved recipes."),
      ),

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

      (settings.keywords || []).length > 0 && h("div", { style: { marginBottom: 14 } },
        h("div", { className: "form-label" }, "Keywords ",
          h("span", { className: "muted", style: { fontWeight: 400, fontSize: 11 } }, "(★ = your defaults)"),
        ),
        h("div", { className: "flex wrap gap-6" },
          (settings.keywords || []).map(k =>
            h("button", {
              key: k.label,
              onClick: () => setActiveKeywords(ks => ks.includes(k.label) ? ks.filter(x => x !== k.label) : [...ks, k.label]),
              style: {
                padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                fontFamily: "'DM Sans',sans-serif",
                border: `1.5px solid ${activeKeywords.includes(k.label) ? "#D4622A" : "#F0E6D3"}`,
                background: activeKeywords.includes(k.label) ? "#FDE8D8" : "#FFF8F0",
                color: activeKeywords.includes(k.label) ? "#D4622A" : "#7A6A55",
              },
            }, `${k.default ? "★ " : ""}${k.label}`)
          ),
        ),
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
      h("div", { className: "flex-between", style: { marginBottom: 4 } },
        h("div", { className: "primary font-bold font-serif", style: { fontSize: 15 } }, "Proposed Plan"),
        h("button", {
          onClick: () => { setProposed([]); setProposedAt(null); },
          style: { background: "none", border: "none", cursor: "pointer", color: "#7A6A55", fontSize: 20 },
          title: "Dismiss proposed plan",
        }, "×"),
      ),
      proposedAt && h("div", { className: "muted text-xs", style: { marginBottom: 8 } },
        `Proposed ${new Date(proposedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`,
      ),
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
        viewingRecipe.recipes && viewingRecipe.recipes.map((recipe, idx) => h(React.Fragment, { key: recipe.id || idx },
          viewingRecipe.recipes.length > 1 && h("div", { className: "font-bold font-serif mb-8", style: { fontSize: 15, color: "#D4622A" } }, recipe.name),
          h("div", { className: "flex wrap gap-6", style: { marginBottom: 12 } },
            recipe.sourceLabel && h("span", { style: { fontSize: 11, fontWeight: 600, color: recipe.sourceLabel === "AI Generated" ? "#D4622A" : "#2A6A9E", background: recipe.sourceLabel === "AI Generated" ? "#FDE8D8" : "#E8EEF8", padding: "2px 8px", borderRadius: 8 } },
              recipe.sourceLabel === "AI Generated" ? "✨ AI Generated" : `📎 ${recipe.sourceLabel}`
            ),
          ),
          h("div", { className: "font-bold font-serif mb-8", style: { fontSize: 14 } }, "Ingredients",
            recipe.servings && mealServings(viewingRecipe.meal) !== recipe.servings && h("span", { className: "muted", style: { fontWeight: 400, fontSize: 11, marginLeft: 6 } },
              `scaled to ${mealServings(viewingRecipe.meal)} servings (recipe makes ${recipe.servings})`),
          ),
          h(Card, { style: { marginBottom: 12 } },
            (recipe.ingredients || []).map((ing, i) =>
              h("div", { key: ing.id || i, className: "flex-between divider", style: { padding: "5px 0", fontSize: 13 } },
                h("span", null, ing.name),
                h("span", { className: "muted" }, fmtIngredient(
                  window.APP.utils.hasQty(ing) && recipe.servings ? scaleAmt(parseFloat(ing.amount), recipe.servings, mealServings(viewingRecipe.meal)) : ing.amount,
                  ing.unit)),
              )
            ),
          ),
          h("div", { className: "font-bold font-serif mb-8", style: { fontSize: 14 } }, "Instructions"),
          h(Card, { style: { marginBottom: 12 } },
            (recipe.steps || []).map((s, i) =>
              h("div", { key: i, className: "flex gap-12", style: { marginBottom: 10 } },
                h("div", { className: "step-num" }, i + 1),
                h("div", { style: { fontSize: 13, lineHeight: 1.6 } }, s),
              )
            ),
          ),
          recipe.notes && h("div", { className: "muted text-sm italic", style: { marginBottom: 12 } }, `📝 ${recipe.notes}`),
        )),
        viewingRecipe.recipes && viewingRecipe.recipes.length === 1 && !viewingRecipe.saved && viewingRecipe.recipes[0].sourceLabel === "AI Generated" && h(Btn, {
          label: "📥 Save to Recipes",
          onClick: saveGeneratedRecipe,
          className: "btn-full",
          style: { marginBottom: 8 },
        }),
        viewingRecipe.saved && h("div", { style: { textAlign: "center", fontSize: 13, color: "#2A7D4F", fontWeight: 600, marginBottom: 8 } }, "📖 Saved to recipes"),
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
      h("div", { className: "flex-between mb-12" },
        h("div", { className: "font-bold font-serif", style: { fontSize: 16 } }, "Current Plan"),
        h(Btn, {
          label: groceryLoading ? "Adding…" : "→ Grocery",
          variant: "accent",
          icon: "🛒",
          disabled: groceryLoading,
          onClick: async () => {
            setGroceryLoading(true);
            try { await onAddMealPlanToGrocery(); } finally { setGroceryLoading(false); }
          },
          className: "btn-sm",
        }),
      ),

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
                    m.checked && m.madeInfo && h("button", {
                      onClick: () => onUndoMarkAsMade(m),
                      title: "Un-mark as made and put pantry amounts back",
                      style: { background: "none", border: "none", cursor: "pointer", color: "#D4622A", fontSize: 12, fontWeight: 600, marginLeft: 6, padding: 0, fontFamily: "'DM Sans',sans-serif" },
                    }, "↺ Undo"),
                  ),
                  // Servings — groceries and pantry use are scaled to this
                  !m.checked && h("div", { className: "flex-center gap-6", style: { marginTop: 4, fontSize: 12, color: "#7A6A55" } },
                    "👥",
                    h("button", { onClick: () => setMealServings(m.id, mealServings(m) - 1), style: servingBtnStyle, title: "Fewer servings" }, "−"),
                    h("span", { style: { fontWeight: 600, minWidth: 16, textAlign: "center" } }, mealServings(m)),
                    h("button", { onClick: () => setMealServings(m.id, mealServings(m) + 1), style: servingBtnStyle, title: "More servings" }, "+"),
                    "servings",
                    // Move to another section — any slot works, whatever the recipe is tagged
                    h("select", {
                      value: m.mealType || "Dinner",
                      onChange: e => setMealPlan(mp => mp.map(x => x.id === m.id ? { ...x, mealType: e.target.value } : x)),
                      title: "Move to another meal",
                      style: { marginLeft: 6, padding: "2px 4px", borderRadius: 6, border: "1.5px solid #F0E6D3", background: "#FFF8F0", color: "#7A6A55", fontSize: 12, fontFamily: "'DM Sans',sans-serif" },
                    }, MEAL_TYPES.map(t => h("option", { key: t, value: t }, `${MEAL_ICONS[t]} ${t}`))),
                  ),
                ),
                h("button", {
                  onClick: () => { setAddingToMealId(id => id === m.id ? null : m.id); setAddRecipeSearch(""); },
                  title: "Link another recipe to this meal",
                  style: { background: "none", border: "1.5px solid #D4622A", borderRadius: "50%", width: 24, height: 24, cursor: "pointer", color: "#D4622A", fontSize: 15, fontWeight: 700, flexShrink: 0, marginLeft: 8, lineHeight: 1 },
                }, "+"),
                h("button", {
                  onClick: () => deleteMeal(m.id),
                  style: { background: "none", border: "none", cursor: "pointer", color: "#C0392B", fontSize: 20, flexShrink: 0, marginLeft: 4 },
                }, "×"),
              ),

              // Link another saved recipe (combo meal — main + sides)
              addingToMealId === m.id && h("div", { style: { marginTop: 8, padding: 10, background: "#FFF8F0", borderRadius: 8 } },
                h("input", {
                  className: "form-input-sm", style: { width: "100%", marginBottom: 6 },
                  value: addRecipeSearch, onChange: e => setAddRecipeSearch(e.target.value),
                  placeholder: "Search recipes to add…", autoFocus: true,
                }),
                h("div", { style: { maxHeight: 160, overflowY: "auto" } },
                  recipes
                    .filter(r => !r.hidden && !(m.recipeIds || []).includes(r.id))
                    .filter(r => r.name.toLowerCase().includes(addRecipeSearch.toLowerCase()))
                    .slice(0, 8)
                    .map(r => h("div", {
                      key: r.id,
                      onClick: () => { onAddRecipeToMeal(m.id, r); setAddingToMealId(null); },
                      style: { padding: "6px 4px", fontSize: 13, cursor: "pointer", borderBottom: "1px solid #F0E6D3" },
                    }, r.name)),
                  recipes.filter(r => !r.hidden && !(m.recipeIds || []).includes(r.id) && r.name.toLowerCase().includes(addRecipeSearch.toLowerCase())).length === 0 &&
                    h("div", { className: "muted text-xs", style: { padding: "6px 4px" } }, "No matching recipes."),
                ),
              ),

              // Grocery status. "Covered" = skip this meal in "→ Grocery" (you already have it
              // handled). Meals already sent stay counted, so adding another meal later
              // doesn't make the pantry look free for both.
              // Sits side by side with Mark as Made; the Mark as Made panel wraps to its own row.
              !m.checked && h("div", { style: { marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" } },
              h("button", {
                onClick: () => setMealPlan(mp => mp.map(x => x.id === m.id ? { ...x, groceriesAdded: !x.groceriesAdded } : x)),
                title: m.groceriesAdded
                  ? "Marked covered — skipped by → Grocery. Tap to include it again."
                  : "Tap if groceries for this are already handled — → Grocery will skip it",
                style: {
                  padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  fontFamily: "'DM Sans',sans-serif",
                  border: `1.5px solid ${m.groceriesAdded || m.sentToGrocery ? "#2A7D4F" : "#F0E6D3"}`,
                  background: m.groceriesAdded || m.sentToGrocery ? "#E8F4EC" : "#FFF8F0",
                  color: m.groceriesAdded || m.sentToGrocery ? "#2A7D4F" : "#7A6A55",
                },
              }, m.groceriesAdded ? "🛒 Covered — skipped ✓" : m.sentToGrocery ? "🛒 On grocery list ✓" : "🛒 Groceries not added"),

              // Mark as Made — preview exactly what comes out of the pantry, untick anything you didn't use
                markingId === m.id
                  ? (() => {
                      const rows = window.APP.utils.planDeductions({ ...m, servings: mealServings(m) }, recipes, pantry || []);
                      const chosen = rows.filter(r => !skipDeductions.includes(r.pantryId));
                      const allOn = chosen.length === rows.length;
                      return h("div", { style: { flex: "1 1 100%", display: "flex", flexDirection: "column", gap: 6 } },
                        h("div", { style: { display: "flex", gap: 8 } },
                          h("input", {
                            type: "date",
                            value: markDate,
                            onChange: e => setMarkDate(e.target.value),
                            style: { flex: 1, padding: "6px 10px", borderRadius: 8, border: "1.5px solid #F0E6D3", fontSize: 13, outline: "none", background: "#FFF8F0", fontFamily: "'DM Sans',sans-serif" },
                          }),
                          h(Btn, {
                            label: "Confirm",
                            onClick: () => { onMarkAsMade({ ...m, servings: mealServings(m) }, markDate, chosen); setMarkingId(null); },
                            style: { fontSize: 12, padding: "6px 12px" },
                          }),
                          h(Btn, {
                            label: "Cancel",
                            variant: "ghost",
                            onClick: () => setMarkingId(null),
                            style: { fontSize: 12, padding: "6px 10px" },
                          }),
                        ),
                        rows.length === 0
                          ? h("div", { className: "muted text-xs" }, "Nothing to take out of the pantry for this meal.")
                          : h("div", { style: { background: "#FFF8F0", borderRadius: 8, padding: "6px 10px" } },
                              h("label", { style: deductionRowStyle },
                                h("input", { type: "checkbox", checked: allOn, onChange: () => setSkipDeductions(allOn ? rows.map(r => r.pantryId) : []), style: deductionBoxStyle }),
                                h("span", { style: { fontWeight: 600 } }, "Remove from pantry:"),
                              ),
                              rows.map(r => {
                                const on = !skipDeductions.includes(r.pantryId);
                                return h("label", { key: r.pantryId, style: { ...deductionRowStyle, opacity: on ? 1 : 0.5 } },
                                  h("input", {
                                    type: "checkbox", checked: on, style: deductionBoxStyle,
                                    onChange: () => setSkipDeductions(ids => on ? [...ids, r.pantryId] : ids.filter(x => x !== r.pantryId)),
                                  }),
                                  h("span", { style: { flex: 1 } }, r.name),
                                  h("span", { className: "muted" },
                                    `${fmtIngredient(r.before, r.unit)} → `,
                                    r.after === 0 ? h("span", { className: "warn", style: { fontWeight: 600 } }, "out") : fmtIngredient(r.after, r.unit),
                                  ),
                                );
                              }),
                            ),
                      );
                    })()
                  : h("button", {
                      onClick: () => { setMarkingId(m.id); setMarkDate(new Date().toISOString().split("T")[0]); setSkipDeductions([]); },
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
