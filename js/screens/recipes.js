// ── js/screens/recipes.js ─────────────────────────────────────────────────────
window.APP = window.APP || {};
const { createElement: h, useState, useRef } = React;
const { Btn, Card, Tag, Input, Select, PillToggle, SectionHeader, EmptyState } = window.APP;
const { uid, fmt$, scaleAmt, fmtIngredient, callClaude, extractText, parseJSON, toggleInArray } = window.APP.utils;
const { categorize } = window.APP;
const { COURSES, PROTEINS, APPLIANCES, SECTIONS } = window.APP;

// ── RecipesScreen ─────────────────────────────────────────────────────────────
window.APP.RecipesScreen = function({ recipes, setRecipes, onAddToMealPlan, onAddToGrocery, requestPin, addCost, showBanner }) {
  const [view,   setView]   = useState("list");
  const [active, setActive] = useState(null);
  const [search, setSearch] = useState("");
  const [filterCourse,  setFilterCourse]  = useState("");
  const [filterProtein, setFilterProtein] = useState("");
  const scrollPos = useRef(0);
  const [importing,     setImporting]     = useState(false);
  const [importUrl,     setImportUrl]     = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importError,   setImportError]   = useState("");

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = recipes.filter(r => {
    const q = search.toLowerCase();
    if (q) {
      const inName = r.name.toLowerCase().includes(q);
      const inTags = (r.tags || []).join(" ").toLowerCase().includes(q);
      const inProt = (r.proteins || []).join(" ").toLowerCase().includes(q);
      if (!inName && !inTags && !inProt) return false;
    }
    if (filterCourse  && r.course !== filterCourse) return false;
    if (filterProtein && !(r.proteins || []).includes(filterProtein)) return false;
    return true;
  });

  // ── Navigation ─────────────────────────────────────────────────────────────
  const openRecipe  = r => { scrollPos.current = window.scrollY; setActive(r); setView("detail"); };
  const closeDetail = ()  => { setView("list"); setTimeout(() => window.scrollTo(0, scrollPos.current), 40); };

  const saveRecipe = recipe => {
    if (recipe.id && recipes.find(r => r.id === recipe.id)) {
      setRecipes(rs => rs.map(r => r.id === recipe.id ? recipe : r));
    } else {
      setRecipes(rs => [...rs, { ...recipe, id: uid() }]);
    }
    setView("list");
  };

  const deleteRecipe = id => requestPin(() => {
    setRecipes(rs => rs.filter(r => r.id !== id));
    setView("list");
    showBanner("Recipe deleted.", "success");
  });

  // ── URL import ─────────────────────────────────────────────────────────────
  const importFromUrl = async () => {
    if (!importUrl.trim()) return;
    setImportLoading(true); setImportError("");
    try {
      const data = await callClaude({
        maxTokens: 1000,
        messages: [{
          role: "user",
          content: `Extract the recipe from this URL. Return ONLY valid JSON, no markdown:
{"name":"","course":"Main","proteins":[],"tags":[],"appliances":[],"servings":4,"prepTime":0,"cookTime":0,"ingredients":[{"id":"i1","name":"","amount":1,"unit":"","section":"Other"}],"steps":[],"notes":"","estimatedCost":0}
URL: ${importUrl.trim()}`,
        }],
      });
      const text   = extractText(data.content);
      const parsed = parseJSON(text);
      parsed.ingredients = (parsed.ingredients || []).map(ing => ({
        ...ing,
        section: ing.section && ing.section !== "Other" ? ing.section : categorize(ing.name),
      }));
      setActive({ ...parsed, id: uid(), photo: "", nutrition: {} });
      addCost("recipeImport");
      setImporting(false);
      setImportUrl("");
      setView("edit");
    } catch {
      setImportError("Could not extract recipe. Try a different URL or add manually.");
    }
    setImportLoading(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (view === "detail" && active) return h(RecipeDetail, { recipe: active, onBack: closeDetail, onEdit: () => setView("edit"), onDelete: () => deleteRecipe(active.id), onAddToMealPlan, onAddToGrocery, showBanner });
  if (view === "edit"   && active) return h(RecipeForm,   { recipe: active, onSave: saveRecipe, onCancel: closeDetail });
  if (view === "new")              return h(RecipeForm,   { recipe: null,   onSave: saveRecipe, onCancel: () => setView("list") });

  return h("div", null,
    h(SectionHeader, {
      title: "Recipes",
      action: h("div", { className: "flex gap-8" },
        h(Btn, { label: "Import URL", variant: "ghost", icon: "🔗", onClick: () => setImporting(v => !v), className: "btn-sm" }),
        h(Btn, { label: "New", icon: "+", onClick: () => setView("new") }),
      ),
    }),

    // URL import panel
    importing && h(Card, { style: { marginBottom: 16 } },
      h("div", { className: "font-bold mb-8", style: { fontSize: 14 } }, "Import recipe from URL"),
      h("div", { className: "flex gap-8", style: { marginBottom: 8 } },
        h("input", { className: "form-input", style: { flex: 1 }, value: importUrl, onChange: e => setImportUrl(e.target.value), placeholder: "https://www.budgetbytes.com/…" }),
        h(Btn, { label: importLoading ? "…" : "Import", onClick: importFromUrl, disabled: importLoading }),
      ),
      importError && h("div", { className: "warn text-sm" }, importError),
    ),

    // Search + filters
    h("div", { style: { marginBottom: 16 } },
      h("input", { className: "search-bar", value: search, onChange: e => setSearch(e.target.value), placeholder: "🔍 Search recipes, tags, proteins…" }),
      h("div", { className: "flex gap-8" },
        h("select", { className: "form-input form-select", style: { flex: 1 }, value: filterCourse, onChange: e => setFilterCourse(e.target.value) },
          h("option", { value: "" }, "All courses"),
          COURSES.map(c => h("option", { key: c, value: c }, c)),
        ),
        h("select", { className: "form-input form-select", style: { flex: 1 }, value: filterProtein, onChange: e => setFilterProtein(e.target.value) },
          h("option", { value: "" }, "All proteins"),
          PROTEINS.map(p => h("option", { key: p, value: p }, p)),
        ),
      ),
    ),

    filtered.length === 0 && h(EmptyState, { icon: "📖", title: "No recipes yet", sub: "Add your first recipe or import from a URL" }),

    h("div", { style: { display: "grid", gap: 12 } },
      filtered.map(r => h(RecipeCard, { key: r.id, recipe: r, onClick: () => openRecipe(r), onAddToMealPlan, onAddToGrocery, showBanner })),
    ),
  );
};

// ── RecipeCard ────────────────────────────────────────────────────────────────
function RecipeCard({ recipe: r, onClick, onAddToMealPlan, onAddToGrocery, showBanner }) {
  return h(Card, { style: { padding: "14px 16px" } },
    // Top row — thumbnail + info (tappable to open detail)
    h("div", { className: "recipe-card", onClick, style: { marginBottom: 10 } },
      h("div", { className: "recipe-thumb" },
        r.photo ? h("img", { src: r.photo, alt: r.name }) : "🍴",
      ),
      h("div", { className: "recipe-info" },
        h("div", { className: "recipe-name" }, r.name),
        h("div", { className: "recipe-meta" }, `${r.course} · ${r.servings} srv · ${fmt$(r.estimatedCost)}`),
        h("div", { className: "recipe-tags" },
          (r.proteins || []).slice(0, 2).map(p => h(Tag, { key: p, label: p, color: "#E8F4EC", textColor: "#2A7D4F" })),
          (r.tags    || []).slice(0, 2).map(t => h(Tag, { key: t, label: t })),
        ),
      ),
      h("div", { className: "recipe-chevron" }, "›"),
    ),

    // Quick add buttons
    h("div", { className: "flex gap-8" },
      h("button", {
        onClick: e => {
          e.stopPropagation();
          onAddToMealPlan(r);
          showBanner(`✓ ${r.name} added to meal plan`, "success");
        },
        style: {
          flex: 1,
          padding: "7px 8px",
          borderRadius: 8,
          border: "1.5px solid #F0E6D3",
          background: "#FFF8F0",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          color: "#D4622A",
          fontFamily: "'DM Sans', sans-serif",
        },
      }, "📅 Add to Plan"),
      h("button", {
        onClick: e => {
          e.stopPropagation();
          onAddToGrocery(r, r.servings);
        },
        style: {
          flex: 1,
          padding: "7px 8px",
          borderRadius: 8,
          border: "1.5px solid #F0E6D3",
          background: "#FFF8F0",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          color: "#2A7D4F",
          fontFamily: "'DM Sans', sans-serif",
        },
      }, "🛒 Add to Grocery"),
    ),
  );
}

// ── RecipeDetail ──────────────────────────────────────────────────────────────
function RecipeDetail({ recipe, onBack, onEdit, onDelete, onAddToMealPlan, onAddToGrocery, showBanner }) {
  const [servings, setServings] = useState(recipe.servings || 2);
  const ratio = servings / (recipe.servings || 1);

  return h("div", null,
    h("div", { className: "flex-center gap-12", style: { marginBottom: 20 } },
      h("button", { onClick: onBack, style: { background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#7A6A55" } }, "←"),
      h("h2", { className: "font-serif", style: { flex: 1, fontSize: 20, margin: 0 } }, recipe.name),
      h(Btn, { label: "Edit", variant: "ghost", onClick: onEdit, className: "btn-sm" }),
    ),

    h("div", { style: { width: "100%", height: 160, borderRadius: 16, background: "linear-gradient(135deg,#FDE8D8,#F0E6D3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 60, marginBottom: 16, overflow: "hidden" } },
      recipe.photo ? h("img", { src: recipe.photo, alt: recipe.name, style: { width: "100%", height: "100%", objectFit: "cover" } }) : "🍴",
    ),

    h("div", { className: "meta-grid" },
      ...[["⏱ Prep", `${recipe.prepTime || 0}m`], ["🔥 Cook", `${recipe.cookTime || 0}m`], ["💰 Cost", fmt$(recipe.estimatedCost)]].map(([l, v]) =>
        h(Card, { key: l, className: "meta-cell" },
          h("div", { className: "meta-label" }, l),
          h("div", { className: "meta-value" }, v),
        )
      ),
    ),

    h("div", { className: "flex wrap gap-6", style: { marginBottom: 16 } },
      recipe.course && h(Tag, { label: recipe.course, color: "#E8EEF8", textColor: "#2A6A9E" }),
      (recipe.proteins || []).map(p => h(Tag, { key: p, label: p, color: "#E8F4EC", textColor: "#2A7D4F" })),
      (recipe.tags    || []).map(t => h(Tag, { key: t, label: t })),
      (recipe.appliances || []).map(a => h(Tag, { key: a, label: a, color: "#F0E8F8", textColor: "#6A3D9A" })),
    ),

    h(Card, { style: { marginBottom: 16 } },
      h("div", { className: "flex-between mb-12" },
        h("div", { className: "font-bold font-serif", style: { fontSize: 15 } }, "Ingredients"),
        h("div", { className: "flex-center gap-10" },
          h("button", { className: "scaler-btn", onClick: () => setServings(s => Math.max(1, s - 1)) }, "−"),
          h("span", { className: "font-bold", style: { fontSize: 14 } }, `${servings} serv.`),
          h("button", { className: "scaler-btn", onClick: () => setServings(s => s + 1) }, "+"),
        ),
      ),
      (recipe.ingredients || []).map(ing =>
        h("div", { key: ing.id, className: "flex-between divider", style: { padding: "6px 0", fontSize: 14 } },
          h("span", null, ing.name),
          h("span", { className: "muted font-bold" }, fmtIngredient(scaleAmt(ing.amount, recipe.servings, servings), ing.unit)),
        )
      ),
    ),

    h(Card, { style: { marginBottom: 16 } },
      h("div", { className: "font-bold font-serif mb-12", style: { fontSize: 15 } }, "Instructions"),
      (recipe.steps || []).map((s, i) =>
        h("div", { key: i, className: "flex gap-12", style: { marginBottom: 12 } },
          h("div", { className: "step-num" }, i + 1),
          h("div", { style: { fontSize: 14, lineHeight: 1.6 } }, s),
        )
      ),
    ),

    recipe.notes && h(Card, { style: { marginBottom: 16, background: "#FDE8D8" } },
      h("div", { className: "font-bold text-sm", style: { color: "#A0420A", marginBottom: 4 } }, "📝 Notes"),
      h("div", { style: { fontSize: 14 } }, recipe.notes),
    ),

    recipe.nutrition?.calories && h(Card, { style: { marginBottom: 16 } },
      h("div", { className: "font-bold font-serif mb-12", style: { fontSize: 15 } }, "Nutrition (per serving)"),
      h("div", { className: "nutrition-grid" },
        ...[["Calories", recipe.nutrition.calories, "kcal"], ["Protein", recipe.nutrition.protein, "g"], ["Carbs", recipe.nutrition.carbs, "g"], ["Fat", recipe.nutrition.fat, "g"]].map(([l, v, u]) =>
          h("div", { key: l },
            h("div", { className: "nutrition-val" }, Math.round((v || 0) * ratio)),
            h("div", { className: "nutrition-label" }, `${l} ${u}`),
          )
        ),
      ),
    ),

    h("div", { className: "flex gap-10 wrap", style: { marginBottom: 8 } },
      h(Btn, {
        label: "Add to Meal Plan", icon: "🗓", style: { flex: 1 },
        onClick: () => { onAddToMealPlan(recipe); showBanner(`✓ ${recipe.name} added to meal plan`, "success"); },
      }),
      h(Btn, { label: "Add to Grocery", icon: "🛒", variant: "accent", style: { flex: 1 }, onClick: () => onAddToGrocery(recipe, servings) }),
    ),
    h(Btn, { label: "Delete Recipe", variant: "danger", onClick: onDelete, className: "btn-full" }),
  );
}

// ── RecipeForm ────────────────────────────────────────────────────────────────
function RecipeForm({ recipe, onSave, onCancel }) {
  const blank = { name: "", course: "Main", proteins: [], tags: [], appliances: [], servings: 2, prepTime: 0, cookTime: 0, photo: "", estimatedCost: 0, ingredients: [], steps: [""], notes: "", nutrition: {} };
  const [form, setForm] = useState(recipe ? { ...blank, ...recipe } : blank);
  const [tagInput, setTagInput] = useState("");

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addIng     = ()         => upd("ingredients", [...form.ingredients, { id: uid(), name: "", amount: 1, unit: "", section: "Other" }]);
  const updIngKey  = (id, k, v) => upd("ingredients", form.ingredients.map(i => i.id === id ? { ...i, [k]: v } : i));
  const updIngName = (id, v)    => upd("ingredients", form.ingredients.map(i => i.id === id ? { ...i, name: v, section: categorize(v) } : i));
  const remIng     = id         => upd("ingredients", form.ingredients.filter(i => i.id !== id));

  const addStep  = ()       => upd("steps", [...form.steps, ""]);
  const updStep  = (idx, v) => upd("steps", form.steps.map((s, i) => i === idx ? v : s));
  const remStep  = idx      => upd("steps", form.steps.filter((_, i) => i !== idx));

  const addTag = () => { if (tagInput.trim() && !form.tags.includes(tagInput.trim())) { upd("tags", [...form.tags, tagInput.trim()]); setTagInput(""); } };
  const remTag = t => upd("tags", form.tags.filter(x => x !== t));

  return h("div", null,
    h("div", { className: "flex-center gap-12", style: { marginBottom: 20 } },
      h("button", { onClick: onCancel, style: { background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#7A6A55" } }, "←"),
      h("h2", { className: "font-serif", style: { flex: 1, fontSize: 20, margin: 0 } }, recipe?.id ? "Edit Recipe" : "New Recipe"),
      h(Btn, { label: "Save", onClick: () => onSave(form) }),
    ),

    h(Input, { label: "Recipe Name",         value: form.name,        onChange: v => upd("name", v),         placeholder: "e.g. Smash Burgers" }),
    h(Input, { label: "Photo URL (optional)", value: form.photo || "", onChange: v => upd("photo", v),        placeholder: "https://…" }),

    h("div", { style: { flex: 1 } }, h(Select, { label: "Course", value: form.course, onChange: v => upd("course", v), options: COURSES })),

    h("div", { className: "flex gap-10" },
      h("div", { style: { flex: 1 } }, h(Input, { label: "Servings",   type: "number", value: form.servings,     onChange: v => upd("servings",     +v) })),
      h("div", { style: { flex: 1 } }, h(Input, { label: "Prep (min)", type: "number", value: form.prepTime,     onChange: v => upd("prepTime",     +v) })),
      h("div", { style: { flex: 1 } }, h(Input, { label: "Cook (min)", type: "number", value: form.cookTime,     onChange: v => upd("cookTime",     +v) })),
    ),

    h(Input, { label: "Est. Cost ($)", type: "number", value: form.estimatedCost, onChange: v => upd("estimatedCost", +v) }),

    h("div", { className: "form-group" },
      h("label", { className: "form-label" }, "Protein Type"),
      h(PillToggle, { options: PROTEINS, selected: form.proteins || [], onToggle: p => upd("proteins", toggleInArray(form.proteins || [], p)) }),
    ),

    h("div", { className: "form-group" },
      h("label", { className: "form-label" }, "Appliances Used"),
      h(PillToggle, { options: APPLIANCES, selected: form.appliances || [], onToggle: a => upd("appliances", toggleInArray(form.appliances || [], a)) }),
    ),

    h("div", { className: "form-group" },
      h("label", { className: "form-label" }, "Tags"),
      h("div", { className: "flex wrap gap-6", style: { marginBottom: 6 } },
        (form.tags || []).map(t => h(Tag, { key: t, label: t, onRemove: () => remTag(t) })),
      ),
      h("div", { className: "flex gap-8" },
        h("input", { className: "form-input", style: { flex: 1 }, value: tagInput, onChange: e => setTagInput(e.target.value), onKeyDown: e => e.key === "Enter" && addTag(), placeholder: "Add tag (e.g. Italian, quick, spicy)…" }),
        h(Btn, { label: "Add", variant: "ghost", onClick: addTag }),
      ),
    ),

    h("div", { className: "form-group" },
      h("div", { className: "flex-between mb-8" },
        h("label", { className: "form-label", style: { marginBottom: 0 } }, "Ingredients"),
        h(Btn, { label: "+ Add", variant: "ghost", onClick: addIng, className: "btn-sm" }),
      ),
      (form.ingredients || []).map(ing =>
        h("div", { key: ing.id },
          h("div", { className: "ing-row" },
            h("input", { className: "form-input-sm", value: ing.name,   onChange: e => updIngName(ing.id, e.target.value), placeholder: "Name" }),
            h("input", { className: "form-input-sm", value: ing.amount, onChange: e => updIngKey(ing.id, "amount", e.target.value), placeholder: "Amt", type: "number" }),
            h("input", { className: "form-input-sm", value: ing.unit,   onChange: e => updIngKey(ing.id, "unit",   e.target.value), placeholder: "Unit" }),
            h("button", { onClick: () => remIng(ing.id), style: { background: "none", border: "none", cursor: "pointer", color: "#C0392B", fontSize: 18 } }, "×"),
          ),
          h("div", { className: "ing-section-hint" }, `📂 ${ing.section}`),
        )
      ),
    ),

    h("div", { className: "form-group" },
      h("div", { className: "flex-between mb-8" },
        h("label", { className: "form-label", style: { marginBottom: 0 } }, "Steps"),
        h(Btn, { label: "+ Step", variant: "ghost", onClick: addStep, className: "btn-sm" }),
      ),
      (form.steps || []).map((s, i) =>
        h("div", { key: i, className: "flex gap-8 mb-8", style: { alignItems: "flex-start" } },
          h("div", { className: "step-num", style: { marginTop: 8 } }, i + 1),
          h("textarea", { className: "form-input", style: { flex: 1 }, rows: 2, value: s, onChange: e => updStep(i, e.target.value) }),
          h("button", { onClick: () => remStep(i), style: { background: "none", border: "none", cursor: "pointer", color: "#C0392B", fontSize: 18, marginTop: 8 } }, "×"),
        )
      ),
    ),

    h(Input, { label: "Notes", value: form.notes || "", onChange: v => upd("notes", v), multiline: true, placeholder: "Tips, variations, substitutions…" }),
  );
}
