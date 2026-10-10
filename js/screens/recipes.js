// ── js/screens/recipes.js ─────────────────────────────────────────────────────
window.APP = window.APP || {};
const { createElement: h, useState, useRef, useEffect } = React;
const { Btn, Card, Tag, Input, Select, PillToggle, SectionHeader, EmptyState, CollapsibleSection } = window.APP;
const { uid, fmt$, scaleAmt, fmtIngredient, callClaude, extractText, parseJSON, toggleInArray } = window.APP.utils;
const { categorize } = window.APP;
const { COURSES, PROTEINS, APPLIANCES, SECTIONS, MEAL_TYPES, MEAL_ICONS } = window.APP;

// ── RecipesScreen ─────────────────────────────────────────────────────────────
window.APP.RecipesScreen = function({ recipes, setRecipes, onAddToMealPlan, onAddToGrocery, requestPin, addCost, showBanner, knownIngredientNames, ingredients, addNewIngredient, priceHistory }) {
  const [view,   setView]   = useState("list");
  const [active, setActive] = useState(null);
  const [search, setSearch] = useState("");
  const [filterCourses,    setFilterCourses]    = useState([]);
  const [filterProteins,   setFilterProteins]   = useState([]);
  const [filterAppliances, setFilterAppliances] = useState([]);
  const [filterMealTypes,  setFilterMealTypes]  = useState([]);
  const [filterTags,       setFilterTags]       = useState([]);
  const [sortBy,        setSortBy]        = useState("az");
  const [filterLetter, setFilterLetter] = useState("");
  const [showHidden,    setShowHidden]    = useState(false);
  const scrollPos = useRef(0);
  const [importing,     setImporting]     = useState(false);
  const [importUrl,     setImportUrl]     = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importError,   setImportError]   = useState("");
  const photoInputRef = useRef(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError,   setPhotoError]   = useState("");
  const [newTagPrompt,  setNewTagPrompt]  = useState(null); // tag just saved that's new to the whole library
  const [auditingTag,   setAuditingTag]   = useState(null); // tag currently being AI-checked
  const [addingMealType, setAddingMealType] = useState(null); // recipe pending meal-type selection before adding to plan

  const allTags = [...new Set(recipes.flatMap(r => r.tags || []))].sort();
  const activeFilterCount = filterCourses.length + filterProteins.length + filterAppliances.length + filterMealTypes.length + filterTags.length;

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = recipes
    .filter(r => {
      if (!showHidden && r.hidden) return false;
      if (showHidden && !r.hidden) return false;
      const q = search.toLowerCase();
      if (q) {
        const inName = r.name.toLowerCase().includes(q);
        const inTags = (r.tags || []).join(" ").toLowerCase().includes(q);
        const inProt = (r.proteins || []).join(" ").toLowerCase().includes(q);
        if (!inName && !inTags && !inProt) return false;
      }
      if (filterCourses.length    && !filterCourses.includes(r.course)) return false;
      if (filterProteins.length   && !filterProteins.some(p => (r.proteins || []).includes(p))) return false;
      if (filterAppliances.length && !filterAppliances.some(a => (r.appliances || []).includes(a))) return false;
      if (filterMealTypes.length  && !filterMealTypes.some(t => (r.mealTypes || []).includes(t))) return false;
      if (filterTags.length       && !filterTags.some(t => (r.tags || []).includes(t))) return false;
      if (filterLetter) {
        const first = r.name.trim().charAt(0).toUpperCase();
        if (filterLetter === "#" ? /[A-Z]/.test(first) : first !== filterLetter) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "az")      return a.name.localeCompare(b.name);
      if (sortBy === "recent")  return (b.createdAt || 0) - (a.createdAt || 0);
      if (sortBy === "lastMade" || sortBy === "lastMadeOldest") {
        const diff = (b.lastMadeAt || 0) - (a.lastMadeAt || 0);
        return (sortBy === "lastMade" ? diff : -diff) || a.name.localeCompare(b.name);
      }
      return 0;
    });

  // ── Navigation ─────────────────────────────────────────────────────────────
  const openRecipe  = r => { scrollPos.current = window.scrollY; setActive(r); setView("detail"); };
  const closeDetail = ()  => { setView("list"); setTimeout(() => window.scrollTo(0, scrollPos.current), 40); };

  const saveRecipe = recipe => {
    const newTags = (recipe.tags || []).filter(t => !allTags.includes(t));
    if (recipe.id && recipes.find(r => r.id === recipe.id)) {
      setRecipes(rs => rs.map(r => r.id === recipe.id ? recipe : r));
    } else {
      setRecipes(rs => [...rs, { ...recipe, id: uid(), createdAt: Date.now() }]);
    }
    setView("list");
    if (newTags.length) setNewTagPrompt(newTags[0]);
  };

  const requestAddToMealPlan = recipe => setAddingMealType(recipe);
  const confirmAddToMealPlan = mealType => {
    onAddToMealPlan(addingMealType, mealType);
    showBanner(`✓ ${addingMealType.name} added to meal plan`, "success");
    setAddingMealType(null);
  };

  const deleteRecipe = id => requestPin(() => {
    setRecipes(rs => rs.filter(r => r.id !== id));
    setView("list");
    showBanner("Recipe deleted.", "success");
  });

  const toggleHideRecipe = id => {
    setRecipes(rs => rs.map(r => r.id === id ? { ...r, hidden: !r.hidden } : r));
    const recipe = recipes.find(r => r.id === id);
    showBanner(recipe?.hidden ? "Recipe unhidden." : "Recipe hidden.", "success");
    setView("list");
  };

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
      parsed.ingredients = window.APP.utils.linkIngredients(parsed.ingredients || [], ingredients).map(ing => ({
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

  // ── Photo import ───────────────────────────────────────────────────────────
  const handleRecipePhotos = async e => {
    const all = Array.from(e.target.files || []);
    e.target.value = ""; // allow re-selecting the same photos later
    if (!all.length) return;
    if (all.length > 4) showBanner("Only the first 4 photos were used.", "error");
    const files = all.slice(0, 4);
    setPhotoLoading(true); setPhotoError("");
    try {
      const { resizeImageToBase64, scanRecipePhotos } = window.APP.utils;
      const { UNITS } = window.APP;
      const images = await Promise.all(files.map(f => resizeImageToBase64(f)));
      const p = await scanRecipePhotos(images, allTags);
      addCost("recipePhotoScan");

      // Clean up Claude's output so it can't put invalid values in the editor
      const rawIngs = (p.ingredients || []).filter(i => i && i.name).map(i => {
        const amt = parseFloat(i.amount);
        return {
          id: uid(), name: String(i.name).trim(), description: i.description || "",
          amount: isNaN(amt) ? "" : amt,
          unit: UNITS.includes(i.unit) ? i.unit : "",
          section: "Other",
        };
      });
      const linked = window.APP.utils.linkIngredients(rawIngs, ingredients)
        .map(ing => ({ ...ing, section: categorize(ing.name) }));

      setActive({
        id: uid(),
        name: p.name || "",
        course: COURSES.includes(p.course) ? p.course : "Main",
        proteins:   (p.proteins   || []).filter(x => PROTEINS.includes(x)),
        mealTypes:  (p.mealTypes  || []).filter(x => MEAL_TYPES.includes(x)),
        appliances: (p.appliances || []).filter(x => APPLIANCES.includes(x)),
        tags: [...new Set((p.tags || []).map(t => String(t).trim()).filter(Boolean))].slice(0, 4),
        servings: +p.servings || 4,
        prepTime: +p.prepTime || 0,
        cookTime: +p.cookTime || 0,
        estimatedCost: +p.estimatedCost || 0,
        ingredients: linked,
        steps: (p.steps || []).length ? p.steps : [""],
        notes: p.notes || "",
        photo: "", nutrition: {},
      });
      setView("edit");
    } catch (err) {
      console.error("Photo scan failed:", err);
      setPhotoError(`Could not read those photos (${err?.message || "unknown error"}). Try again, or add the recipe manually.`);
      void ("Could not read those photos. Try clearer, well-lit shots, or add the recipe manually.");
    }
    setPhotoLoading(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (view === "detail" && active) return h(RecipeDetail, { recipe: active, onBack: closeDetail, onEdit: () => setView("edit"), onDelete: () => deleteRecipe(active.id), onHide: () => toggleHideRecipe(active.id), onAddToMealPlan: requestAddToMealPlan, onAddToGrocery, showBanner, priceHistory });
  if (view === "edit"   && active) return h(RecipeForm,   { recipe: active, onSave: saveRecipe, onCancel: closeDetail, knownIngredientNames, ingredients, addNewIngredient, allTags });
  if (view === "new")              return h(RecipeForm,   { recipe: null,   onSave: saveRecipe, onCancel: () => setView("list"), knownIngredientNames, ingredients, addNewIngredient, allTags });

  return h("div", null,
    newTagPrompt && h(Card, { style: { marginBottom: 16, border: "1.5px solid #D4622A" } },
      h("div", { className: "text-sm", style: { marginBottom: 8 } }, `🏷️ New tag "${newTagPrompt}" — check your other recipes for it?`),
      h("div", { className: "flex gap-8" },
        h(Btn, { label: "Check Recipes", onClick: () => { setAuditingTag(newTagPrompt); setNewTagPrompt(null); }, className: "btn-sm" }),
        h(Btn, { label: "Not now", variant: "ghost", onClick: () => setNewTagPrompt(null), className: "btn-sm" }),
      ),
    ),
    auditingTag && h(window.APP.TagAuditModal, { tag: auditingTag, recipes, setRecipes, addCost, showBanner, onClose: () => setAuditingTag(null) }),
    addingMealType && h(MealTypePickerModal, { recipe: addingMealType, onPick: confirmAddToMealPlan, onClose: () => setAddingMealType(null) }),
    h(SectionHeader, {
      title: "Recipes",
      action: h("div", { className: "flex gap-8", style: { flexWrap: "wrap", justifyContent: "flex-end" } },
        h(Btn, { label: "URL", variant: "ghost", icon: "🔗", onClick: () => setImporting(v => !v), className: "btn-sm" }),
        h(Btn, { label: photoLoading ? "Reading…" : "Scan", variant: "ghost", icon: "📷", onClick: () => photoInputRef.current?.click(), disabled: photoLoading, className: "btn-sm" }),
        h(Btn, { label: "New", icon: "+", onClick: () => setView("new") }),
      ),
    }),

    // Photo import — hidden multi-select picker (no capture attribute, so iOS offers the photo library)
    h("input", { ref: photoInputRef, type: "file", accept: "image/*", multiple: true, style: { display: "none" }, onChange: handleRecipePhotos }),
    photoLoading && h("div", { className: "muted text-sm", style: { marginBottom: 12 } }, "📷 Reading recipe photos…"),
    photoError && h("div", { className: "warn text-sm", style: { marginBottom: 12 } }, photoError),

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
      h("select", {
        className: "form-input form-select",
        style: { width: "100%", marginBottom: 8 },
        value: filterLetter,
        onChange: e => setFilterLetter(e.target.value),
      },
        h("option", { value: "" }, "All letters"),
        ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => h("option", { key: l, value: l }, l)),
        h("option", { value: "#" }, "# (numbers / other)"),
      ),
      h(Card, { className: "card-compact", style: { marginBottom: 8 } },
        h(CollapsibleSection, { title: `🔎 Filters${activeFilterCount ? ` (${activeFilterCount})` : ""}` },
          h("div", { className: "form-group" },
            h("label", { className: "form-label" }, "Course"),
            h(PillToggle, { options: COURSES, selected: filterCourses, onToggle: c => setFilterCourses(fc => toggleInArray(fc, c)) }),
          ),
          h("div", { className: "form-group" },
            h("label", { className: "form-label" }, "Protein"),
            h(PillToggle, { options: PROTEINS, selected: filterProteins, onToggle: p => setFilterProteins(fp => toggleInArray(fp, p)) }),
          ),
          h("div", { className: "form-group" },
            h("label", { className: "form-label" }, "Meal Type"),
            h(PillToggle, { options: MEAL_TYPES, selected: filterMealTypes, onToggle: t => setFilterMealTypes(ft => toggleInArray(ft, t)) }),
          ),
          h("div", { className: "form-group" },
            h("label", { className: "form-label" }, "Appliance"),
            h(PillToggle, { options: APPLIANCES, selected: filterAppliances, onToggle: a => setFilterAppliances(fa => toggleInArray(fa, a)) }),
          ),
          allTags.length > 0 && h("div", { className: "form-group" },
            h("label", { className: "form-label" }, "Tags"),
            h(PillToggle, { options: allTags, selected: filterTags, onToggle: t => setFilterTags(ft => toggleInArray(ft, t)) }),
          ),
          activeFilterCount > 0 && h(Btn, {
            label: "Clear Filters", variant: "ghost", className: "btn-sm",
            onClick: () => { setFilterCourses([]); setFilterProteins([]); setFilterAppliances([]); setFilterMealTypes([]); setFilterTags([]); },
          }),
        ),
      ),
      h("div", { className: "flex gap-8" },
        h("select", { className: "form-input form-select", style: { flex: 1 }, value: sortBy, onChange: e => setSortBy(e.target.value) },
          h("option", { value: "az" }, "A–Z"),
          h("option", { value: "recent" }, "Recently Added"),
          h("option", { value: "lastMade" }, "Last Made (newest first)"),
          h("option", { value: "lastMadeOldest" }, "Last Made (oldest first)"),
        ),
        h("button", {
          onClick: () => setShowHidden(v => !v),
          style: { padding: "8px 14px", borderRadius: 8, border: "1.5px solid #F0E6D3", background: showHidden ? "#FDE8D8" : "#FFF8F0", color: showHidden ? "#D4622A" : "#7A6A55", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", whiteSpace: "nowrap" },
        }, showHidden ? "👁 Showing Hidden" : "👁 Show Hidden"),
      ),
    ),

    filtered.length === 0 && h(EmptyState, { icon: "📖", title: "No recipes yet", sub: "Add your first recipe or import from a URL" }),

    h("div", { style: { display: "grid", gap: 12, gridTemplateColumns: "minmax(0, 1fr)" } },
      filtered.map(r => h(RecipeCard, { key: r.id, recipe: r, onClick: () => openRecipe(r), onAddToMealPlan: requestAddToMealPlan, onAddToGrocery, showBanner })),
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
function RecipeDetail({ recipe, onBack, onEdit, onDelete, onHide, onAddToMealPlan, onAddToGrocery, showBanner, priceHistory }) {
  const [servings, setServings] = useState(recipe.servings || 2);
  const ratio = servings / (recipe.servings || 1);
  const realCost = window.APP.utils.estimateRecipeCost(recipe, priceHistory || []);
  const displayCost = realCost.coverage === "full" ? realCost.cost : recipe.estimatedCost;
  const costLabel = realCost.coverage === "full" ? `${fmt$(displayCost)} 📊` : fmt$(displayCost);

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
      ...[["⏱ Prep", `${recipe.prepTime || 0}m`], ["🔥 Cook", `${recipe.cookTime || 0}m`], ["💰 Cost", costLabel]].map(([l, v]) =>
        h(Card, { key: l, className: "meta-cell" },
          h("div", { className: "meta-label" }, l),
          h("div", { className: "meta-value" }, v),
        )
      ),
    ),
    realCost.coverage === "partial" && h("div", { className: "text-xs muted", style: { marginTop: -10, marginBottom: 16 } }, `📊 Tracked price data available for ${realCost.pricedCount} of ${realCost.quantifiableCount} ingredients — cost above is still Claude's estimate`),

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
        h("div", { key: ing.id, className: "ingredient-row" },
          h("span", null, ing.name, ing.description ? h("span", { className: "muted" }, ` (${ing.description})`) : null),
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
      recipe.sourceUrl && h("div", { style: { marginTop: 8, fontSize: 12, color: "#7A6A55" } },
        "📎 Source: ",
        h("a", { href: recipe.sourceUrl, target: "_blank", rel: "noopener noreferrer", style: { color: "#D4622A" } }, recipe.sourceLabel || recipe.sourceUrl),
      ),
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
        onClick: () => onAddToMealPlan(recipe),
      }),
      h(Btn, { label: "Add to Grocery", icon: "🛒", variant: "accent", style: { flex: 1 }, onClick: () => onAddToGrocery(recipe, servings) }),
    ),
    h(Btn, { label: recipe.hidden ? "Unhide Recipe" : "Hide Recipe", variant: "ghost", onClick: onHide, className: "btn-full", style: { marginBottom: 8 } }),
    h(Btn, { label: "Delete Recipe", variant: "danger", onClick: onDelete, className: "btn-full" }),
  );
}

// ── RecipeForm ────────────────────────────────────────────────────────────────
function RecipeForm({ recipe, onSave, onCancel, knownIngredientNames, ingredients, addNewIngredient, allTags }) {
  const blank = { name: "", course: "Main", proteins: [], mealTypes: [], tags: [], appliances: [], servings: 2, prepTime: 0, cookTime: 0, photo: "", estimatedCost: 0, ingredients: [], steps: [""], notes: "", nutrition: {} };
  const [form, setForm] = useState(recipe ? { ...blank, ...recipe } : blank);
  const [tagInput, setTagInput] = useState("");
  const { UNITS } = window.APP;

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addIng     = ()         => upd("ingredients", [...form.ingredients, { id: uid(), ingredientId: null, name: "", description: "", amount: 1, unit: "", section: "Other" }]);
  const updIngKey  = (id, k, v) => upd("ingredients", form.ingredients.map(i => i.id === id ? { ...i, [k]: v } : i));
  const selectIng  = (id, ing)  => upd("ingredients", form.ingredients.map(i => i.id === id ? { ...i, ingredientId: ing.id, name: ing.name, section: categorize(ing.name) } : i));
  const remIng     = id         => upd("ingredients", form.ingredients.filter(i => i.id !== id));
  const moveIng    = (idx, dir) => {
    const next = [...form.ingredients];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    upd("ingredients", next);
  };

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
      h("label", { className: "form-label" }, "Meal Types ",
        h("span", { className: "muted", style: { fontWeight: 400, fontSize: 11 } }, "(can be more than one)"),
      ),
      h(PillToggle, { options: MEAL_TYPES, selected: form.mealTypes || [], onToggle: t => upd("mealTypes", toggleInArray(form.mealTypes || [], t)) }),
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
        h("input", { className: "form-input", style: { flex: 1 }, list: "tag-suggestions", value: tagInput, onChange: e => setTagInput(e.target.value), onKeyDown: e => e.key === "Enter" && addTag(), placeholder: "Add tag (e.g. Italian, quick, spicy)…" }),
        h(Btn, { label: "Add", variant: "ghost", onClick: addTag }),
      ),
      h("datalist", { id: "tag-suggestions" }, (allTags || []).map(t => h("option", { key: t, value: t }))),
    ),

    h("div", { className: "form-group" },
      h("label", { className: "form-label" }, "Ingredients"),
      (form.ingredients || []).map((ing, idx) =>
        h("div", { key: ing.id },
          h("div", { className: "ing-row" },
            h("div", { style: { display: "flex", flexDirection: "column", gap: 2 } },
              h("button", { onClick: () => moveIng(idx, -1), disabled: idx === 0, style: { background: "none", border: "none", cursor: idx === 0 ? "default" : "pointer", opacity: idx === 0 ? 0.3 : 1, fontSize: 14, lineHeight: 1 } }, "▲"),
              h("button", { onClick: () => moveIng(idx, 1), disabled: idx === form.ingredients.length - 1, style: { background: "none", border: "none", cursor: idx === form.ingredients.length - 1 ? "default" : "pointer", opacity: idx === form.ingredients.length - 1 ? 0.3 : 1, fontSize: 14, lineHeight: 1 } }, "▼"),
            ),
            h(window.APP.IngredientSelect, {
              ingredients: ingredients || [],
              selectedId: ing.ingredientId,
              onSelect: sel => selectIng(ing.id, sel),
              onAddNew: name => addNewIngredient(name),
              flagged: !ing.ingredientId && !!ing.name,
              placeholder: "Search ingredient…",
            }),
            h("input", { className: "form-input-sm", style: { width: 56 }, value: ing.amount, onChange: e => updIngKey(ing.id, "amount", e.target.value), placeholder: "Amt", type: "number" }),
            h("select", {
              className: "form-input-sm", style: { width: 74 },
              value: ing.unit,
              onChange: e => updIngKey(ing.id, "unit", e.target.value),
            },
              h("option", { value: "" }, "unit"),
              UNITS.map(u => h("option", { key: u, value: u }, u)),
            ),
            h("button", { onClick: () => remIng(ing.id), style: { background: "none", border: "none", cursor: "pointer", color: "#C0392B", fontSize: 18 } }, "×"),
          ),
          !ing.ingredientId && ing.name && h("div", { className: "text-xs", style: { color: "#B8860B", marginTop: -2, marginBottom: 2 } }, `⚠ "${ing.name}${ing.amount ? ` ${ing.amount}${ing.unit ? " " + ing.unit : ""}` : ""}" isn't linked to your standard ingredient list yet — search above to link or add it`),
          h("input", {
            className: "form-input-sm",
            style: { width: "100%", marginBottom: 4, fontStyle: "italic" },
            value: ing.description || "",
            onChange: e => updIngKey(ing.id, "description", e.target.value),
            placeholder: "Description (optional) — e.g. hard boiled, room temperature",
          }),
          h("div", { className: "ing-section-hint" }, `📂 ${ing.section}`),
        )
      ),
      h(Btn, { label: "+ Add Ingredient", variant: "ghost", onClick: addIng, className: "btn-sm", style: { marginTop: 8 } }),
    ),

    h("div", { className: "form-group" },
      h("label", { className: "form-label" }, "Steps"),
      (form.steps || []).map((s, i) =>
        h("div", { key: i, className: "flex gap-8 mb-8", style: { alignItems: "flex-start" } },
          h("div", { className: "step-num", style: { marginTop: 8 } }, i + 1),
          h("textarea", { className: "form-input", style: { flex: 1 }, rows: 2, value: s, onChange: e => updStep(i, e.target.value) }),
          h("button", { onClick: () => remStep(i), style: { background: "none", border: "none", cursor: "pointer", color: "#C0392B", fontSize: 18, marginTop: 8 } }, "×"),
        )
      ),
      h(Btn, { label: "+ Step", variant: "ghost", onClick: addStep, className: "btn-sm", style: { marginTop: 8 } }),
    ),

    h(Input, { label: "Notes", value: form.notes || "", onChange: v => upd("notes", v), multiline: true, placeholder: "Tips, variations, substitutions…" }),
  );
}

// ── TagAuditModal ─────────────────────────────────────────────────────────────
// Reviews recipes that don't have `tag` yet and asks Claude which ones plausibly
// fit. Shows a checklist for approval — nothing is applied until Apply is clicked.
// Shared between the inline "new tag" prompt (RecipesScreen) and the Settings picker.
window.APP.TagAuditModal = function({ tag, recipes, setRecipes, addCost, showBanner, onClose }) {
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [approved, setApproved] = useState({}); // recipeId -> bool
  const [checked,  setChecked]  = useState([]); // recipes Claude suggested

  useEffect(() => {
    let cancelled = false;
    const candidates = recipes.filter(r => !(r.tags || []).includes(tag));
    if (!candidates.length) { setLoading(false); return; }
    window.APP.utils.suggestRecipesForTag(tag, candidates)
      .then(ids => {
        if (cancelled) return;
        const matches = recipes.filter(r => ids.includes(r.id));
        setChecked(matches);
        setApproved(Object.fromEntries(matches.map(r => [r.id, true])));
        addCost("tagAudit");
        setLoading(false);
      })
      .catch(() => { if (!cancelled) { setError("Could not run tag audit. Try again."); setLoading(false); } });
    return () => { cancelled = true; };
  }, [tag]);

  const toggle = id => setApproved(a => ({ ...a, [id]: !a[id] }));

  const apply = () => {
    const idsToApply = Object.keys(approved).filter(id => approved[id]);
    if (idsToApply.length) {
      setRecipes(rs => rs.map(r => idsToApply.includes(r.id) ? { ...r, tags: [...(r.tags || []), tag] } : r));
      showBanner(`✓ Added "${tag}" to ${idsToApply.length} recipe${idsToApply.length === 1 ? "" : "s"}`, "success");
    }
    onClose();
  };

  return h("div", {
    style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "flex-end" },
    onClick: onClose,
  },
    h("div", {
      style: { background: "#FFF8F0", borderRadius: "20px 20px 0 0", width: "100%", maxHeight: "80vh", overflowY: "auto", padding: "20px 16px 32px" },
      onClick: e => e.stopPropagation(),
    },
      h("div", { className: "flex-between", style: { marginBottom: 16 } },
        h("div", { className: "font-bold font-serif", style: { fontSize: 17 } }, `🏷️ Tag audit: "${tag}"`),
        h("button", { onClick: onClose, style: { background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#7A6A55" } }, "×"),
      ),
      loading && h("div", { className: "muted text-sm", style: { textAlign: "center", padding: 24 } }, "✨ Checking your recipes…"),
      error   && h("div", { className: "warn text-sm" }, error),
      !loading && !error && checked.length === 0 && h("div", { className: "muted text-sm", style: { textAlign: "center", padding: 24 } }, "No recipes found that seem to fit this tag."),
      !loading && !error && checked.length > 0 && h(React.Fragment, null,
        h("div", { className: "muted text-sm", style: { marginBottom: 12 } }, "Uncheck any that don't fit, then apply:"),
        h(Card, { style: { marginBottom: 16 } },
          checked.map(r =>
            h("label", { key: r.id, className: "flex-center gap-10 divider", style: { padding: "8px 0", cursor: "pointer" } },
              h("input", { type: "checkbox", checked: !!approved[r.id], onChange: () => toggle(r.id), style: { width: 16, height: 16, accentColor: "#D4622A", cursor: "pointer" } }),
              h("span", { style: { fontSize: 14 } }, r.name),
            )
          ),
        ),
        h(Btn, { label: `Apply to ${Object.values(approved).filter(Boolean).length} recipe${Object.values(approved).filter(Boolean).length === 1 ? "" : "s"}`, onClick: apply, className: "btn-full" }),
      ),
    ),
  );
};

// ── MealTypePickerModal ───────────────────────────────────────────────────────
// Shown every time a recipe is added to the meal plan, so you always choose which
// slot (Breakfast/Lunch/Dinner) it goes into — recipes can carry more than one
// meal type, and the app has no reliable way to guess which one you mean.
function MealTypePickerModal({ recipe, onPick, onClose }) {
  const options = recipe.mealTypes?.length ? recipe.mealTypes : MEAL_TYPES;
  return h("div", {
    style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "flex-end" },
    onClick: onClose,
  },
    h("div", {
      style: { background: "#FFF8F0", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 16px 32px" },
      onClick: e => e.stopPropagation(),
    },
      h("div", { className: "flex-between", style: { marginBottom: 16 } },
        h("div", { className: "font-bold font-serif", style: { fontSize: 17 } }, `Add "${recipe.name}" as…`),
        h("button", { onClick: onClose, style: { background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#7A6A55" } }, "×"),
      ),
      h("div", { className: "flex gap-8" },
        options.map(t => h("button", {
          key: t,
          onClick: () => onPick(t),
          className: "meal-type-btn",
          style: { flex: 1 },
        },
          h("span", { className: "meal-type-icon" }, MEAL_ICONS[t]),
          t,
        )),
      ),
    ),
  );
}