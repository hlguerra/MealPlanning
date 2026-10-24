// ── js/screens/pantry.js ──────────────────────────────────────────────────────
window.APP = window.APP || {};
const { createElement: h, useState } = React;
const { Btn, Card, SectionHeader, EmptyState } = window.APP;
const { uid, callClaude, extractText, parseJSON, sectionFor } = window.APP.utils;
const { categorize } = window.APP;
const { SECTIONS } = window.APP;

// ── PantryScreen ──────────────────────────────────────────────────────────────
window.APP.PantryScreen = function({ pantry, setPantry, addCost, knownIngredientNames, ingredients, addNewIngredient, recipes, setRecipes, onAddToMealPlan, showBanner, groceryList, onAddToGrocery, onAddToPantry, staples, setStaples, onSetSection }) {
  const [selectedIng, setSelectedIng] = useState(null); // { id, name }
  const [amount,  setAmount]  = useState("");
  const [unit,    setUnit]    = useState("");
  const [suggest, setSuggest] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const { UNITS } = window.APP;
  const { COURSES, PROTEINS, APPLIANCES, MEAL_TYPES, MEAL_ICONS } = window.APP;
  const [busyId,       setBusyId]       = useState(null); // suggestion currently being turned into a recipe
  const [savedRecipes, setSavedRecipes] = useState({});   // suggestion id -> saved recipe (a second tap reuses it)
  const [pickingId,    setPickingId]    = useState(null); // suggestion showing the meal-type buttons
  const [editingId, setEditingId] = useState(null);
  const [draft,     setDraft]     = useState(null);
  // Per-device view state: collapsed store sections, and sections whose stocked staples are expanded
  const [collapsed,   setCollapsed]   = window.APP.usePersist("hmp_pantryCollapsed",   []);
  const [staplesOpen, setStaplesOpen] = window.APP.usePersist("hmp_pantryStaplesOpen", []);
  const toggleIn = (setList, key) => setList(l => l.includes(key) ? l.filter(k => k !== key) : [...l, key]);

  // ── Item actions (no PIN required) ─────────────────────────────────────────
  const addItem = () => {
    if (!selectedIng) return;
    // Same restock rules as a grocery purchase: tops up a matching entry (or an
    // "out" one) instead of adding a duplicate line.
    onAddToPantry([{
      name: selectedIng.name, ingredientId: selectedIng.id, section: categorize(selectedIng.name),
      amount: amount.trim() ? +amount : "",
      unit,
    }]);
    setSelectedIng(null); setAmount(""); setUnit("");
  };

  const removeItem = id => setPantry(p => p.filter(i => i.id !== id));

  const startEdit = item => {
    setEditingId(item.id);
    setDraft({ name: item.name, ingredientId: item.ingredientId, amount: item.amount ?? "", unit: item.unit || "", section: sectionFor(item), pickedSection: false });
  };

  const saveEdit = () => {
    if (!draft?.name) return;
    const amt = parseFloat(draft.amount);
    // A section picked here is remembered for this ingredient everywhere
    if (draft.pickedSection) onSetSection(draft.name, draft.section);
    setPantry(p => p.map(i => i.id === editingId ? {
      ...i,
      name: draft.name,
      ingredientId: draft.ingredientId,
      section: draft.pickedSection ? draft.section : draft.name !== i.name ? categorize(draft.name) : i.section,
      amount: isNaN(amt) ? "" : amt,
      unit: draft.unit,
    } : i));
    setEditingId(null); setDraft(null);
  };

  // ── AI suggestions ──────────────────────────────────────────────────────────
  // Turn a suggestion into a full saved recipe (one API call). Reuses it if already made or already saved.
  const saveSuggestionAsRecipe = async s => {
    if (savedRecipes[s.id]) return savedRecipes[s.id];
    const existing = recipes.find(r => r.name.toLowerCase() === s.name.toLowerCase());
    if (existing) { setSavedRecipes(m => ({ ...m, [s.id]: existing })); return existing; }

    const data = await callClaude({
      maxTokens: 2000,
      messages: [{
        role: "user",
        content: `Write a full recipe for "${s.name}". Build it mainly from ingredients the person already has: ${(s.canMakeWith || []).join(", ")}${s.missing?.length ? `. They still need: ${s.missing.join(", ")}` : ""}.${s.notes ? ` Context: ${s.notes}` : ""}
Return ONLY valid JSON, no markdown:
{"name":"","course":"Main","proteins":[],"mealTypes":[],"tags":[],"appliances":[],"servings":4,"prepTime":0,"cookTime":0,"ingredients":[{"name":"","amount":1,"unit":"","description":""}],"steps":[],"notes":"","estimatedCost":0}
${window.APP.utils.recipeFormatRules()} "course" is one of [${COURSES.join(", ")}]. "proteins": zero or more of [${PROTEINS.join(", ")}]. "mealTypes": zero or more of [${MEAL_TYPES.join(", ")}]. "appliances": zero or more of [${APPLIANCES.join(", ")}]. "tags": 0-4 short tags. "steps": one string per step, no numbers.`,
      }],
    });
    addCost("recipeGen");
    const p = parseJSON(extractText(data.content));

    const linked = window.APP.utils.cleanIngredients(p.ingredients, ingredients || []);

    const recipe = {
      id: uid(), createdAt: Date.now(), name: s.name,
      course:     COURSES.includes(p.course) ? p.course : "Main",
      proteins:   (p.proteins   || []).filter(x => PROTEINS.includes(x)),
      mealTypes:  (p.mealTypes  || []).filter(x => MEAL_TYPES.includes(x)),
      appliances: (p.appliances || []).filter(x => APPLIANCES.includes(x)),
      tags: [...new Set((p.tags || []).map(t => String(t).trim()).filter(Boolean))].slice(0, 4),
      servings: +p.servings || 4, prepTime: +p.prepTime || 0, cookTime: +p.cookTime || 0,
      estimatedCost: +p.estimatedCost || 0,
      ingredients: linked,
      steps: (p.steps || []).length ? p.steps : [""],
      notes: p.notes || "",
      photo: "", nutrition: {}, sourceLabel: "AI Generated",
    };
    setRecipes(rs => [...rs, recipe]);
    setSavedRecipes(m => ({ ...m, [s.id]: recipe }));
    return recipe;
  };

  const addSuggestionToRecipes = async s => {
    setBusyId(s.id); setError("");
    try {
      const had = !!savedRecipes[s.id] || recipes.some(r => r.name.toLowerCase() === s.name.toLowerCase());
      const recipe = await saveSuggestionAsRecipe(s);
      showBanner(had ? "Already in your recipes." : `✓ ${recipe.name} saved to recipes`, "success");
    } catch (err) {
      console.error("Suggestion to recipe failed:", err);
      setError("Could not create that recipe. Try again.");
    }
    setBusyId(null);
  };

  const addSuggestionToPlan = async (s, mealType) => {
    setBusyId(s.id); setPickingId(null); setError("");
    try {
      const recipe = await saveSuggestionAsRecipe(s);
      onAddToMealPlan(recipe, mealType);
      showBanner(`✓ ${recipe.name} added to meal plan`, "success");
    } catch (err) {
      console.error("Suggestion to meal plan failed:", err);
      setError("Could not create that recipe. Try again.");
    }
    setBusyId(null);
  };

  const getSuggestions = async () => {
    if (!pantry.length) return;
    setLoading(true); setSuggest([]); setError(""); setSavedRecipes({}); setPickingId(null);

    try {
      const data = await callClaude({
        maxTokens: 700,
        messages: [{
          role: "user",
          content: `I have these ingredients on hand: ${pantry.map(p => p.name).join(", ")}.
${pantry.some(p => p.useSoon) ? `These need to be used up soon, so build as many of the meals as you can around them: ${pantry.filter(p => p.useSoon).map(p => p.name).join(", ")}.\n` : ""}Suggest 4 practical meals I can make (or mostly make) with what I have.
Return ONLY a valid JSON array, no markdown fences:
[{"name":"","canMakeWith":[""],"missing":[""],"notes":""}]`,
        }],
      });

      const text   = extractText(data.content);
      const parsed = parseJSON(text);
      setSuggest(parsed.map(s => ({ ...s, id: uid() })));
      addCost("pantry");
    } catch {
      setError("Could not load suggestions. Check your connection and try again.");
    }
    setLoading(false);
  };

  // ── Out of stock ────────────────────────────────────────────────────────────
  // amount 0 = used up (e.g. by "Mark as Made"). Blank = not tracked, which counts as on hand.
  // Only staples stay listed at 0 — everything else is removed when used up (see app.js)
  const isOut    = item => item.amount === 0 || item.amount === "0";
  const isStaple = item => (staples || []).some(s => window.APP.utils.sameIngredient(s, item));
  const toggleStaple = item => {
    if (isStaple(item)) {
      setStaples(st => st.filter(s => !window.APP.utils.sameIngredient(s, item)));
      showBanner(isOut(item) ? `${item.name} unpinned — removed since it's out` : `${item.name} unpinned`, "success");
    } else {
      setStaples(st => [...st, { id: uid(), name: item.name, section: item.section || categorize(item.name) }]);
      showBanner(`📌 ${item.name} pinned — it'll stay listed when it runs out`, "success");
    }
  };
  const onList   = item => (groceryList || []).some(g => !g.checked && window.APP.utils.sameIngredient(g, item));
  const addToList = item => {
    onAddToGrocery([{ name: item.name, ingredientId: item.ingredientId || null, section: item.section, amount: "", unit: "" }]);
    showBanner(`✓ ${item.name} added to grocery list`, "success");
  };
  const outItems = pantry.filter(isOut);
  const outNotOnList = outItems.filter(i => !onList(i));

  // ── Grouping ────────────────────────────────────────────────────────────────
  // sectionFor applies sections you've picked and puts unknown ones under "Other".
  // Within a section: use-soon first, out-of-stock last.
  const rank = i => (isOut(i) ? 2 : 0) - (i.useSoon ? 1 : 0);
  const grouped = SECTIONS.reduce((acc, s) => {
    const items = pantry
      .filter(i => sectionFor(i) === s)
      .sort((a, b) => rank(a) - rank(b));
    if (items.length) acc[s] = items;
    return acc;
  }, {});

  // Staples that are stocked and not flagged fold into a collapsed "📌 N staples" row;
  // out, use-soon, or mid-edit staples stay in the main list so they get noticed.
  const isFolded = item => isStaple(item) && !isOut(item) && !item.useSoon && editingId !== item.id;

  const renderItem = item =>
    h("div", { key: item.id, style: { display: "flex", flexWrap: editingId === item.id ? "wrap" : undefined, alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #F0E6D3" } },
      editingId === item.id && draft
        ? h(React.Fragment, null,
            h(window.APP.IngredientSelect, {
              ingredients: ingredients || [],
              selectedId: draft.ingredientId,
              onSelect: sel => setDraft(d => ({ ...d, name: sel.name, ingredientId: sel.id })),
              onAddNew: name => addNewIngredient(name),
              placeholder: "Search ingredient…",
            }),
            h("input", {
              className: "form-input-sm",
              style: { width: 56, flexShrink: 0 },
              value: draft.amount,
              onChange: e => setDraft(d => ({ ...d, amount: e.target.value })),
              placeholder: "Amt", type: "number", min: "0",
            }),
            h("select", {
              className: "form-input-sm",
              style: { width: 74, flexShrink: 0 },
              value: draft.unit,
              onChange: e => setDraft(d => ({ ...d, unit: e.target.value })),
            },
              h("option", { value: "" }, "unit"),
              UNITS.map(u => h("option", { key: u, value: u }, u)),
            ),
            h("button", {
              onClick: saveEdit,
              style: { background: "none", border: "none", cursor: "pointer", color: "#2A7D4F", fontSize: 18 },
              title: "Save",
            }, "✓"),
            h(window.APP.SectionSelect, {
              value: draft.section,
              onChange: section => setDraft(d => ({ ...d, section, pickedSection: true })),
            }),
          )
        : h("span", { onClick: () => startEdit(item), style: { flex: 1, fontSize: 14, cursor: "pointer", color: isOut(item) ? "#7A6A55" : undefined } },
            item.name,
            isOut(item)
              ? h("span", { className: "warn text-xs", style: { marginLeft: 6, fontWeight: 600 } }, "out")
              : item.amount ? ` — ${item.amount}${item.unit ? " " + item.unit : ""}` : "",
          ),
      editingId !== item.id && isOut(item) && (onList(item)
        ? h("span", { className: "muted text-xs", style: { flexShrink: 0 } }, "🛒 on list")
        : h("button", {
            onClick: () => addToList(item),
            title: "Add to grocery list",
            style: { background: "#E8F4EC", border: "1.5px solid #2A7D4F", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#2A7D4F", padding: "2px 8px", flexShrink: 0, fontFamily: "'DM Sans',sans-serif" },
          }, "+ 🛒")),
      h("button", {
        onClick: () => setPantry(p => p.map(i => i.id === item.id ? { ...i, useSoon: !i.useSoon } : i)),
        title: item.useSoon ? "Marked use soon — tap to clear" : "Mark as use soon",
        style: { background: item.useSoon ? "#FDE8D8" : "none", border: `1.5px solid ${item.useSoon ? "#D4622A" : "#F0E6D3"}`, borderRadius: 8, cursor: "pointer", fontSize: 14, padding: "2px 6px", opacity: item.useSoon ? 1 : 0.5 },
      }, "⏰"),
      h("button", {
        onClick: () => toggleStaple(item),
        title: isStaple(item) ? "Staple — stays listed when out. Tap to unpin." : "Pin as a staple so it stays listed when it runs out",
        style: { background: isStaple(item) ? "#FDE8D8" : "none", border: `1.5px solid ${isStaple(item) ? "#D4622A" : "#F0E6D3"}`, borderRadius: 8, cursor: "pointer", fontSize: 14, padding: "2px 6px", opacity: isStaple(item) ? 1 : 0.5 },
      }, "📌"),
      h("button", {
        onClick: () => removeItem(item.id),
        style: { background: "none", border: "none", cursor: "pointer", color: "#C0392B", fontSize: 18, opacity: 0.5 },
        title: "Remove item",
      }, "×"),
    );

  // ── Render ──────────────────────────────────────────────────────────────────
  return h("div", null,
    h(SectionHeader, { title: "Pantry & Fridge" }),

    // ── Add item ──────────────────────────────────────────────────────────────
    h(Card, { style: { marginBottom: 16 } },
      h("div", { className: "flex gap-8" },
        h(window.APP.IngredientSelect, {
          ingredients: ingredients || [],
          selectedId: selectedIng?.id,
          onSelect: sel => setSelectedIng(sel),
          onAddNew: name => addNewIngredient(name),
          placeholder: "Add item… (e.g. chicken thighs, rice)",
        }),
        h("input", {
          className: "form-input-sm",
          style: { width: 56, flexShrink: 0 },
          value: amount,
          onChange: e => setAmount(e.target.value),
          onKeyDown: e => e.key === "Enter" && addItem(),
          placeholder: "Amt",
          type: "number",
          min: "0",
        }),
        h("select", {
          className: "form-input-sm",
          style: { width: 74, flexShrink: 0 },
          value: unit,
          onChange: e => setUnit(e.target.value),
        },
          h("option", { value: "" }, "unit"),
          UNITS.map(u => h("option", { key: u, value: u }, u)),
        ),
        h(Btn, { label: "Add", onClick: addItem, style: { flexShrink: 0, marginRight: 4 } }),
      ),
    ),

    // ── What can I make button ────────────────────────────────────────────────
    h(Btn, {
      label: loading ? "Finding meals…" : "✨ What can I make?",
      variant: "sky",
      onClick: getSuggestions,
      disabled: loading || !pantry.length,
      className: "btn-full",
      style: { marginBottom: 16 },
    }),

    // ── Suggestions ───────────────────────────────────────────────────────────
    suggest.length > 0 && h("div", { style: { marginBottom: 20 } },
      suggest.map((s, i) =>
        h(Card, { key: i, style: { marginBottom: 10 } },
          h("div", { className: "flex-between", style: { marginBottom: 4 } },
            h("div", { className: "font-bold", style: { fontSize: 15 } }, s.name),
            h("button", {
              onClick: () => setSuggest(list => list.filter(x => x.id !== s.id)),
              style: { background: "none", border: "none", cursor: "pointer", color: "#7A6A55", fontSize: 20, lineHeight: 1 },
              title: "Dismiss",
            }, "×"),
          ),
          h("div", { className: "accent text-sm", style: { marginBottom: 2 } },
            "✓ Have: ", s.canMakeWith?.join(", "),
          ),
          s.missing?.length > 0 && h("div", { className: "warn text-sm", style: { marginBottom: 2 } },
            "Still need: ", s.missing.join(", "),
          ),
          s.notes && h("div", { className: "muted text-sm italic" }, s.notes),
          h("div", { className: "flex gap-8", style: { marginTop: 10 } },
            h("button", {
              onClick: () => addSuggestionToRecipes(s),
              disabled: busyId === s.id || !!savedRecipes[s.id],
              style: { flex: 1, padding: "7px 8px", borderRadius: 8, border: "1.5px solid #F0E6D3", background: "#FFF8F0", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#2A7D4F", fontFamily: "'DM Sans', sans-serif", opacity: busyId === s.id ? 0.6 : 1 },
            }, busyId === s.id ? "Writing recipe…" : savedRecipes[s.id] ? "✓ In Recipes" : "📖 Add to Recipes"),
            h("button", {
              onClick: () => setPickingId(id => id === s.id ? null : s.id),
              disabled: busyId === s.id,
              style: { flex: 1, padding: "7px 8px", borderRadius: 8, border: "1.5px solid #F0E6D3", background: "#FFF8F0", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#D4622A", fontFamily: "'DM Sans', sans-serif", opacity: busyId === s.id ? 0.6 : 1 },
            }, "📅 Add to Meal Plan"),
          ),
          pickingId === s.id && h("div", { className: "flex gap-8", style: { marginTop: 8 } },
            MEAL_TYPES.map(t => h("button", {
              key: t, className: "meal-type-btn", style: { flex: 1 },
              onClick: () => addSuggestionToPlan(s, t),
            },
              h("span", { className: "meal-type-icon" }, MEAL_ICONS[t]),
              t,
            )),
          ),
        )
      ),
    ),

    error && h("div", { className: "warn text-sm", style: { marginBottom: 16 } }, error),

    // ── Empty state ───────────────────────────────────────────────────────────
    !pantry.length && h(EmptyState, {
      icon: "🥫",
      title: "Pantry is empty",
      sub: "Add items to track what you have on hand",
    }),

    // ── Out of stock summary ─────────────────────────────────────────────────
    outNotOnList.length > 1 && h(Card, { style: { marginBottom: 14, background: "#FFF0EE", border: "1.5px solid #F0C0BB" } },
      h("div", { className: "flex-between" },
        h("div", { className: "text-sm" }, `${outNotOnList.length} items are out and not on your grocery list.`),
        h(Btn, {
          label: "Add all", variant: "accent", className: "btn-sm",
          onClick: () => {
            onAddToGrocery(outNotOnList.map(i => ({ name: i.name, ingredientId: i.ingredientId || null, section: i.section, amount: "", unit: "" })));
            showBanner(`✓ Added ${outNotOnList.length} items to grocery list`, "success");
          },
        }),
      ),
    ),

    // ── Grouped inventory ─────────────────────────────────────────────────────
    Object.entries(grouped).map(([section, items]) => {
      const isCollapsed = collapsed.includes(section);
      const shown  = items.filter(i => !isFolded(i));
      const folded = items.filter(isFolded);
      const outCount = items.filter(isOut).length;
      return h("div", { key: section, style: { marginBottom: 14 } },
        h("button", {
          className: "grocery-section-label pantry-section-toggle",
          onClick: () => toggleIn(setCollapsed, section),
          "aria-expanded": !isCollapsed,
        },
          h("span", { className: "pantry-chevron" }, isCollapsed ? "▸" : "▾"),
          section,
          h("span", { className: "pantry-section-count" },
            ` · ${items.length}`,
            outCount ? h("span", { className: "warn" }, ` · ${outCount} out`) : null,
          ),
        ),
        !isCollapsed && shown.map(renderItem),
        !isCollapsed && folded.length > 0 && h("button", {
          className: "pantry-staples-toggle",
          onClick: () => toggleIn(setStaplesOpen, section),
          "aria-expanded": staplesOpen.includes(section),
        }, `${staplesOpen.includes(section) ? "▾" : "▸"} 📌 ${folded.length} staple${folded.length === 1 ? "" : "s"}`),
        !isCollapsed && staplesOpen.includes(section) && folded.map(renderItem),
      );
    }),
  );
};
