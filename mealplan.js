// ── js/screens/mealplan.js ────────────────────────────────────────────────────
window.APP = window.APP || {};
const { createElement: h, useState } = React;
const { Btn, Card, PillToggle, SectionHeader, EmptyState } = window.APP;
const { uid, fmt$, callClaude, extractText, parseJSON, toggleInArray, plural } = window.APP.utils;
const { MEAL_TYPES, MEAL_ICONS, PROTEINS } = window.APP;

// ── MealPlanScreen ────────────────────────────────────────────────────────────
window.APP.MealPlanScreen = function({ mealPlan, setMealPlan, recipes, onAddToGrocery, requestPin, settings, saveSettings, myAppliances, addCost, showBanner }) {

  const [generating, setGenerating] = useState(false);
  const [genError,   setGenError]   = useState("");
  const [proposed,   setProposed]   = useState([]);
  const [locked,     setLocked]     = useState({});

  // Generator filters — initialise from settings defaults
  const [days,       setDays]       = useState(7);
  const [people,     setPeopleVal]  = useState(settings.people || 2);
  const [mealTypes,  setMealTypes]  = useState(settings.defaultMealTypes?.length ? settings.defaultMealTypes : ["Dinner"]);
  const [proteins,   setProteins]   = useState(settings.defaultProteins || []);

  // Persist people count back to settings whenever it changes
  const setPeople = n => {
    setPeopleVal(n);
    saveSettings({ ...settings, people: n });
  };

  const toggleMealType = t => setMealTypes(mt => toggleInArray(mt, t));
  const toggleProtein  = p => setProteins(ps => toggleInArray(ps, p));

  const totalNeeded = (keepLocked = false) => {
    const lockedCount = keepLocked ? proposed.filter(p => locked[p.id]).length : 0;
    return days * mealTypes.length - lockedCount;
  };

  // ── Prompt builder ──────────────────────────────────────────────────────────
  const buildPrompt = (need, lockedMeals, isRegen = false) => {
    const appStr     = myAppliances.length
      ? `Preferred appliances (soft preference — exceptions OK for great meals): ${myAppliances.join(", ")}.`
      : "";
    const proteinStr = proteins.length
      ? `Rotate through these protein types: ${proteins.join(", ")}.`
      : "Any protein type.";
    const typeStr    = mealTypes.join(", ");
    const excludeStr = isRegen && lockedMeals.length
      ? `Do NOT repeat these already selected meals: ${lockedMeals.map(m => m.name).join(", ")}.`
      : "";
    const savedStr   = recipes.length
      ? `You may suggest these saved recipes if they fit: ${recipes.map(r => r.name).join(", ")}.`
      : "";

    return `Suggest ${need} meals for ${people} ${plural(people, "person")}. Cover these meal types each day: ${typeStr}.
${proteinStr}
${appStr}
${excludeStr}
${savedStr}
Prefer practical, home-cook friendly meals.
Each meal MUST include its mealType field (one of: Breakfast, Lunch, Dinner).
Return ONLY a valid JSON array, no markdown fences:
[{"name":"","mealType":"Dinner","proteins":["Chicken"],"estimatedCost":14,"notes":"Brief description"}]`;
  };

  // ── Generate ────────────────────────────────────────────────────────────────
  const generate = async (keepLocked = false) => {
    if (!mealTypes.length) { setGenError("Select at least one meal type."); return; }
    setGenerating(true); setGenError("");

    const lockedMeals = keepLocked ? proposed.filter(p => locked[p.id]) : [];
    const need        = totalNeeded(keepLocked);
    if (need <= 0) { setGenerating(false); return; }

    try {
      const data     = await callClaude({ maxTokens: 1500, messages: [{ role: "user", content: buildPrompt(need, lockedMeals) }] });
      const text     = extractText(data.content);
      const newMeals = parseJSON(text).map(m => ({ ...m, id: uid() }));
      setProposed([...lockedMeals, ...newMeals]);
      addCost("mealPlan");
    } catch {
      setGenError("Could not generate meal plan. Check your API connection.");
    }
    setGenerating(false);
  };

  const regenerateUnlocked = async () => {
    setGenerating(true);
    const lockedMeals = proposed.filter(p => locked[p.id]);
    const need        = proposed.filter(p => !locked[p.id]).length;
    try {
      const data     = await callClaude({ maxTokens: 1000, messages: [{ role: "user", content: buildPrompt(need, lockedMeals, true) }] });
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
    setMealPlan(proposed.map(p => ({ ...p, id: uid() })));
    setProposed([]);
    setLocked({});
    showBanner("✓ Meal plan saved!", "success");
  };

  const toggleLock = id => setLocked(l => ({ ...l, [id]: !l[id] }));

  const deleteMeal = id => requestPin(() => {
    setMealPlan(mp => mp.filter(m => m.id !== id));
  });

  const addAllToGrocery = () => {
    mealPlan.forEach(m => {
      const r = recipes.find(r => r.name === m.name);
      if (r) onAddToGrocery(r, r.servings);
    });
    showBanner("✓ Ingredients added to grocery list", "success");
  };

  // Group a meal list by meal type for display
  const groupByType = list => MEAL_TYPES.reduce((acc, t) => {
    const items = list.filter(m => m.mealType === t || (t === "Dinner" && !m.mealType));
    if (items.length) acc[t] = items;
    return acc;
  }, {});

  const totalMealsCount = days * mealTypes.length;

  // ── Render ──────────────────────────────────────────────────────────────────
  return h("div", null,
    h(SectionHeader, {
      title: "Meal Plan",
      action: mealPlan.length > 0
        ? h(Btn, { label: "→ Grocery", variant: "accent", icon: "🛒", onClick: addAllToGrocery, className: "btn-sm" })
        : null,
    }),

    // ── AI Generator card ────────────────────────────────────────────────────
    h(Card, { style: { marginBottom: 20 } },
      h("div", { className: "font-bold font-serif mb-12", style: { fontSize: 15 } }, "✨ AI Meal Planner"),

      // Days + People
      h("div", { className: "flex gap-10", style: { marginBottom: 14 } },
        h("div", { style: { flex: 1 } },
          h("div", { className: "form-label" }, "# of Days"),
          h("input", { className: "form-input", type: "number", min: 1, max: 14, value: days, onChange: e => setDays(Math.max(1, +e.target.value)) }),
        ),
        h("div", { style: { flex: 1 } },
          h("div", { className: "form-label" }, "# of People"),
          h("input", { className: "form-input", type: "number", min: 1, max: 20, value: people, onChange: e => setPeople(Math.max(1, +e.target.value)) }),
        ),
      ),

      // Meal types
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

      // Proteins
      h("div", { style: { marginBottom: 14 } },
        h("div", { className: "form-label" }, "Protein  ",
          h("span", { className: "muted", style: { fontWeight: 400, fontSize: 11 } }, "(leave blank for any)"),
        ),
        h(PillToggle, { options: PROTEINS, selected: proteins, onToggle: toggleProtein }),
      ),

      // Summary line
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

    // ── Proposed plan ────────────────────────────────────────────────────────
    proposed.length > 0 && h(Card, { className: "proposed-card", style: { marginBottom: 20 } },
      h("div", { className: "primary font-bold font-serif", style: { fontSize: 15, marginBottom: 4 } }, "Proposed Plan"),
      h("div", { className: "muted text-sm mb-12" }, "🔒 Lock meals you like, then regenerate the rest."),

      Object.entries(groupByType(proposed)).map(([type, meals]) =>
        h("div", { key: type, style: { marginBottom: 12 } },
          h("div", { className: "grocery-section-label" }, `${MEAL_ICONS[type]} ${type}`),
          meals.map(m =>
            h("div", { key: m.id, className: "flex-center gap-10 divider", style: { padding: "8px 0" } },
              h("button", {
                type: "button",
                style: { fontSize: 20, background: "none", border: "none", cursor: "pointer", flexShrink: 0 },
                onClick: () => toggleLock(m.id),
                title: locked[m.id] ? "Unlock this meal" : "Lock this meal",
              }, locked[m.id] ? "🔒" : "🔓"),
              h("div", { style: { flex: 1 } },
                h("div", { className: "font-bold", style: { fontSize: 14 } }, m.name),
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
        h(Btn, { label: "Regenerate Unlocked", variant: "ghost", onClick: regenerateUnlocked, disabled: generating, style: { flex: 1, fontSize: 12 } }),
        h(Btn, { label: "Accept Plan", onClick: acceptPlan, style: { flex: 1 } }),
      ),
    ),

    // ── Empty state ──────────────────────────────────────────────────────────
    mealPlan.length === 0 && proposed.length === 0 && h(EmptyState, {
      icon: "🗓",
      title: "No meals planned yet",
      sub: "Generate a plan above or add meals from your recipes",
    }),

    // ── Current plan ─────────────────────────────────────────────────────────
    mealPlan.length > 0 && h("div", null,
      h("div", { className: "font-bold font-serif mb-12", style: { fontSize: 16 } }, "Current Plan"),

      Object.entries(groupByType(mealPlan)).map(([type, meals]) =>
        h("div", { key: type, style: { marginBottom: 14 } },
          h("div", { className: "grocery-section-label" }, `${MEAL_ICONS[type]} ${type}`),
          meals.map(m =>
            h(Card, { key: m.id, className: "card-compact flex-between", style: { marginBottom: 8 } },
              h("div", { style: { flex: 1 } },
                h("div", { className: "font-bold", style: { fontSize: 15 } }, m.name),
                h("div", { className: "muted text-sm" },
                  (m.proteins || []).join(", "),
                  m.estimatedCost ? ` · ${fmt$(m.estimatedCost)}` : "",
                ),
              ),
              h("button", {
                onClick: () => deleteMeal(m.id),
                style: { background: "none", border: "none", cursor: "pointer", color: "#C0392B", fontSize: 20, flexShrink: 0 },
              }, "×"),
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
