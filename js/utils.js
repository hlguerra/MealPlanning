// ── js/utils.js ───────────────────────────────────────────────────────────────
// Pure helper functions. No React, no DOM, no side effects.
// Import anywhere via window.APP.utils.*

window.APP = window.APP || {};

window.APP.utils = {

  // ── ID generation ───────────────────────────────────────────────────────────
  uid() {
    return Math.random().toString(36).slice(2, 9);
  },

  // ── Currency formatting ──────────────────────────────────────────────────────
  // fmt$(12.5)    → "$12.50"
  // fmt$(0.0123)  → "$0.01"
  fmt$(n) {
    return `$${Number(n || 0).toFixed(2)}`;
  },

  // More precise for API cost display
  // fmt$$(0.0123) → "$0.0123"
  fmt$$(n) {
    return `$${Number(n || 0).toFixed(4)}`;
  },

  // ── Ingredient scaling ───────────────────────────────────────────────────────
  // Scale an ingredient amount from original servings to new servings.
  // scaleAmt(1, 2, 4) → 2  (double the recipe)
  scaleAmt(amount, origServings, newServings) {
    if (!origServings || origServings <= 0) return amount;
    return +((amount * newServings) / origServings).toFixed(2);
  },

  // ── Format ingredient display ─────────────────────────────────────────────
  // Amount + unit, with kitchen fractions the way recipes are written.
  // fmtIngredient(1, "lb")    → "1 lb"
  // fmtIngredient(0.5, "tsp") → "1/2 tsp"
  // fmtIngredient(4, "")      → "4"
  fmtIngredient(amount, unit) {
    const u = unit && unit.trim() ? unit.trim() : "";
    const a = amount !== undefined && amount !== null && amount !== "" ? window.APP.utils.fmtAmount(amount, u) : "";
    if (!a && !u) return "";
    if (!u) return String(a);
    return `${a} ${u}`;
  },

  // ── Fractions ──────────────────────────────────────────────────────────────
  // fmtAmount(1.5, "cup") → "1 1/2", fmtAmount(0.333, "tsp") → "1/3".
  // Metric units (g, kg, ml, l) stay decimal. Amounts that aren't close to a
  // half, third, quarter or eighth stay decimal too (0.4 → "0.4").
  // Non-numbers (e.g. "to taste") come back unchanged.
  fmtAmount(amount, unit = "") {
    const n = typeof amount === "number" ? amount : parseFloat(amount);
    if (typeof amount === "string" && (isNaN(n) || !/^\s*-?[\d.]+\s*$/.test(amount))) return amount;
    if (isNaN(n)) return String(amount ?? "");
    const decimal = +n.toFixed(2);
    if (["g", "kg", "ml", "l"].includes(window.APP.utils.canonUnit(unit))) return String(n >= 10 ? Math.round(n) : decimal);
    if (n < 0) return String(decimal);
    const whole = Math.floor(n + 1e-9);
    const frac  = n - whole;
    if (frac < 0.02) return String(whole);
    if (frac > 0.98) return String(whole + 1);
    const FRACS = [[1, 8], [1, 4], [1, 3], [3, 8], [1, 2], [5, 8], [2, 3], [3, 4], [7, 8]];
    const hit = FRACS.find(([t, b]) => Math.abs(frac - t / b) < 0.02);
    if (!hit) return String(decimal);
    return `${whole ? whole + " " : ""}${hit[0]}/${hit[1]}`;
  },

  // Reads a typed amount: "1 1/2", "1-1/2", "1/2", "½", "1½", "1.5", ".5".
  // Returns a number, or null if it isn't one.
  parseAmount(text) {
    if (typeof text === "number") return isNaN(text) ? null : text;
    const VULGAR = { "½": "1/2", "⅓": "1/3", "⅔": "2/3", "¼": "1/4", "¾": "3/4", "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8", "⅕": "1/5", "⅙": "1/6" };
    let t = String(text ?? "").trim().replace(/[½⅓⅔¼¾⅛⅜⅝⅞⅕⅙]/g, m => " " + VULGAR[m]).replace(/⁄/g, "/").trim();
    if (!t) return null;
    let m;
    if ((m = t.match(/^(\d+)\s*[-\s]\s*(\d+)\s*\/\s*(\d+)$/))) return +m[3] ? +m[1] + m[2] / m[3] : null; // 1 1/2, 1-1/2
    if ((m = t.match(/^(\d+)\s*\/\s*(\d+)$/)))                    return +m[2] ? m[1] / m[2] : null;            // 1/2
    if (/^(\d+\.?\d*|\.\d+)$/.test(t)) return parseFloat(t);                                                    // 1.5, .5
    return null;
  },

// ── Ingredient name normalization ─────────────────────────────────────────────
  // Lowercases, trims, strips a small set of common adjectives, and de-pluralizes.
  // Used to match "chicken breasts, boneless" to "chicken breast" for
  // pantry/grocery/recipe combining. Intentionally simple — not a full NLP match.
  // normalizeIngName("Chicken Breasts, Boneless") → "chicken breast"
  // Names set up as an AKA (Settings → Ingredient AKAs) come back as the main
  // name, so "black pepper" → "pepper".
  normalizeIngName(name = "") {
    const n = window.APP.utils.baseIngName(name);
    return (window.APP.ingredientAliasMap || {})[n] || n;
  },

  // normalizeIngName without the AKA lookup
  baseIngName(name = "") {
    const STRIP_WORDS = [
      "fresh", "frozen", "boneless", "skinless", "chopped", "diced", "minced",
      "sliced", "shredded", "grated", "large", "small", "medium", "extra",
      "ground", "whole", "raw", "cooked", "ripe", "organic",
      "hard", "boiled", "hardboiled", "soft", "scrambled", "fried", "poached",
      "beaten", "melted", "softened", "room", "temperature", "peeled", "trimmed",
      "cubed", "crushed", "packed", "unsalted", "salted",
      // describe the same pantry item: sea salt = salt, mild chili powder = chili powder
      "mild", "sea", "kosher", "table", "coarse", "fine", "pure", "virgin", "extra-virgin",
    ];
    let n = name.toLowerCase().replace(/[,.]/g, " ").trim();
    n = n.split(/\s+/).filter(w => w && !STRIP_WORDS.includes(w)).join(" ");
    // naive de-pluralization: boxes→box, tomatoes→tomato, onions→onion, but not "peas"→"pea" over-eagerly
    n = n.replace(/\b(\w+)ies\b/g, "$1y")
         .replace(/\b(\w+)(ches|shes|xes|oes)\b/g, (_, stem, suf) => stem + suf.slice(0, -2))
         .replace(/\b(\w+[^s])s\b/g, "$1");
    return n.trim();
  },

  // Builds the AKA lookup normalizeIngName uses from settings.ingredientAliases
  // ([{ name: "pepper", aka: "black pepper, cracked pepper" }]).
  setIngredientAliases(aliases = []) {
    const { baseIngName } = window.APP.utils;
    const map = {};
    (aliases || []).forEach(({ name, aka }) => {
      const main = baseIngName(name);
      if (!main) return;
      String(aka || "").split(",").map(baseIngName).filter(a => a && a !== main).forEach(a => { map[a] = main; });
    });
    window.APP.ingredientAliasMap = map;
  },

  // ── Section overrides ─────────────────────────────────────────────────────────
  // Store sections you've picked yourself, from settings.sectionOverrides
  // ({ "olive oil": "Pantry & Dry Goods" }, keyed by normalizeIngName). They win
  // over the keyword categorizer and over the section saved on an item.
  setSectionOverrides(overrides = {}) {
    window.APP.sectionOverrideMap = overrides || {};
  },
  sectionOverride(name = "") {
    const key = window.APP.utils.normalizeIngName(name);
    return (key && (window.APP.sectionOverrideMap || {})[key]) || null;
  },

  // ── Ingredient weights ─────────────────────────────────────────────────────────
  // What one cup, one item, or one can of an ingredient weighs, so any of those
  // converts to oz/lb/g (and to each other). Built-in tables WEIGHT_PER_CUP /
  // WEIGHT_PER_EACH / WEIGHT_PER_CAN, with your own entries from
  // settings.weightPerCup ([{ name, per: "cup"|"each"|"can", amount, unit: "g"|"oz" }])
  // checked first. Entries saved before "per" existed are per cup.
  setWeightPerCup(list = []) {
    const { baseIngName, parseAmount } = window.APP.utils;
    const TABLES = { cup: window.APP.WEIGHT_PER_CUP, each: window.APP.WEIGHT_PER_EACH, can: window.APP.WEIGHT_PER_CAN };
    const maps = {};
    Object.entries(TABLES).forEach(([per, table]) => {
      const builtIn = {};
      Object.entries(table || {}).forEach(([k, g]) => { builtIn[baseIngName(k)] = g; });
      maps[per] = [{}, builtIn]; // [yours, built-in]
    });
    (list || []).forEach(({ name, amount, unit, per }) => {
      const key = baseIngName(name || ""), amt = parseAmount(amount);
      if (!key || !amt || amt <= 0) return;
      maps[maps[per] ? per : "cup"][0][key] = unit === "oz" ? amt * 28.3495 : amt;
    });
    window.APP.weightMaps = maps;
  },

  // Grams in one cup / one item / one can of this ingredient, or null if unknown.
  // Matches the end of the name, whole words, longest first ("light brown sugar"
  // → "brown sugar"). Your entries win over the built-in ones even when theirs is
  // more specific.
  gramsPer(per, name = "") {
    const { normalizeIngName, baseIngName } = window.APP.utils;
    if (!window.APP.weightMaps) window.APP.utils.setWeightPerCup([]);
    const names = [...new Set([normalizeIngName(name), baseIngName(name)])].filter(Boolean);
    for (const map of window.APP.weightMaps[per] || []) {
      for (const n of names) {
        const words = n.split(" ");
        for (let i = 0; i < words.length; i++) {
          const tail = words.slice(i).join(" ");
          if (map[tail]) return map[tail];
        }
      }
    }
    return null;
  },
  gramsPerCup(name) { return window.APP.utils.gramsPer("cup", name); },

  // The section an item is shown under: your override, else its saved section.
  // Unknown sections fall under "Other" so nothing goes missing.
  sectionFor(item) {
    const SECTIONS = window.APP.SECTIONS || [];
    let s = window.APP.utils.sectionOverride(item.name) || item.section;
    // Spices and condiments got their own sections later; items saved before
    // that (mostly under "Pantry & Dry Goods") move over without re-saving.
    const NEWER = ["Spices & Seasonings", "Condiments & Sauces"];
    if (!window.APP.utils.sectionOverride(item.name) && !NEWER.includes(s) && window.APP.categorize) {
      const guess = window.APP.categorize(item.name || "");
      if (NEWER.includes(guess)) s = guess;
    }
    return SECTIONS.includes(s) ? s : "Other";
  },

  // ── Unit normalization ─────────────────────────────────────────────────────
  // Maps the many ways a unit gets written ("Tablespoons", "lbs", "fl. oz") onto
  // the app's standard UNITS. Unknown units come back lowercased and trimmed so
  // exact matches still line up. "" stays "".
  // canonUnit("Tablespoons") → "tbsp"
  canonUnit(unit = "") {
    const UNITS = window.APP.UNITS || [];
    const ALIASES = {
      teaspoon: "tsp", teaspoons: "tsp", tsps: "tsp",
      tablespoon: "tbsp", tablespoons: "tbsp", tbsps: "tbsp", tbs: "tbsp", tbl: "tbsp", tbls: "tbsp",
      "fluid ounce": "fl oz", "fluid ounces": "fl oz", floz: "fl oz", "fl ounce": "fl oz", "fl ounces": "fl oz",
      cups: "cup", c: "cup",
      pints: "pint", pt: "pint", pts: "pint",
      quarts: "quart", qt: "quart", qts: "quart",
      gallons: "gallon", gal: "gallon", gals: "gallon",
      milliliter: "ml", milliliters: "ml", millilitre: "ml", millilitres: "ml", mls: "ml",
      liter: "l", liters: "l", litre: "l", litres: "l",
      ounce: "oz", ounces: "oz", ozs: "oz",
      pound: "lb", pounds: "lb", lbs: "lb",
      gram: "g", grams: "g", gr: "g",
      kilogram: "kg", kilograms: "kg", kgs: "kg", kilo: "kg", kilos: "kg",
      each: "count", ea: "count", whole: "count", piece: "count", pieces: "count", pc: "count", pcs: "count",
      large: "count", medium: "count", small: "count", item: "count", items: "count",
      cans: "can", tin: "can", tins: "can",
      cloves: "clove", pinches: "pinch",
    };
    const u = String(unit || "").toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
    if (!u || UNITS.includes(u)) return u;
    return ALIASES[u] || u;
  },

  // ── Unit conversion ────────────────────────────────────────────────────────
  // Converts an amount between two units. Same type (volume↔volume,
  // weight↔weight) always works. Anything else goes through the ingredient's
  // weight — cups, items and cans each need theirs known (see gramsPer), so
  // pass the ingredient name: convertUnit(2, "cup", "lb", "flour"),
  // convertUnit(1, "can", "oz", "black beans"), convertUnit(2, "count", "lb", "onion").
  // A blank unit counts as "count" (e.g. "2 eggs"), so blank and "count" match.
  // Returns null if the units can't be converted.
  convertUnit(amount, fromUnit, toUnit, name) {
    const { canonUnit, gramsPer } = window.APP.utils;
    const UNIT_INFO = window.APP.UNIT_INFO || {};
    const fromU = canonUnit(fromUnit) || "count", toU = canonUnit(toUnit) || "count";
    if (fromU === toU) return +amount;
    const from = UNIT_INFO[fromU], to = UNIT_INFO[toU];
    if (!from || !to) return null;
    if (from.type === to.type) {
      if (from.type === "count" || from.type === "can") return null;
      return +((amount * from.toBase) / to.toBase).toFixed(3);
    }
    if (!name) return null;
    // Grams in one unit of each side: weight units directly, the rest via the ingredient
    const gramsPerUnit = (u, info) => {
      if (info.type === "weight") return info.toBase;
      if (info.type === "volume") { const g = gramsPer("cup", name); return g ? g / UNIT_INFO.cup.toBase * info.toBase : null; }
      if (info.type === "count")  return gramsPer("each", name);
      if (info.type === "can")    return gramsPer("can", name);
      return null;
    };
    const gFrom = gramsPerUnit(fromU, from), gTo = gramsPerUnit(toU, to);
    if (!gFrom || !gTo) return null;
    return +((amount * gFrom) / gTo).toFixed(3);
  },

  // True when an item has a usable numeric amount (0 counts — it means "used up").
  hasQty(item) {
    return item && item.amount !== "" && item.amount != null && !isNaN(parseFloat(item.amount));
  },

  // Returns a valid grocery section — the given one if it's a known section
  // (other than "Other"), otherwise auto-categorized from the name.
  fixSection(section, name) {
    const SECTIONS = window.APP.SECTIONS || [];
    const override = window.APP.utils.sectionOverride(name);
    if (override) return override;
    if (section && section !== "Other" && SECTIONS.includes(section)) return section;
    return window.APP.categorize ? window.APP.categorize(name || "") : "Other";
  },

  // ── Combine ingredient lists ──────────────────────────────────────────────────
  // Takes a flat array of { name, amount, unit } (e.g. all ingredients across a
  // week's recipes) and combines entries with matching normalized names.
  // Same-unit or same-type amounts are summed (converted to the first-seen unit
  // for that name); incompatible units are combined by tacking on a separate
  // note rather than guessing. Non-numeric/blank amounts are left as notes.
  combineIngredients(items = []) {
    const { convertUnit, sameIngredient } = window.APP.utils;
    // Match against existing groups the same way the rest of the app decides
    // "is this the same ingredient" — same ingredientId, or matching normalized
    // name when either side isn't linked. Using a single shared rule here (instead
    // of a raw key lookup) is what fixes linked/unlinked duplicates silently
    // failing to combine.
    const groups = [];
    items.forEach(item => {
      if (!item.name) return;
      let g = groups.find(existing => sameIngredient(existing, item));
      if (!g) {
        g = { name: item.name, ingredientId: item.ingredientId || null, section: item.section, amount: 0, unit: item.unit || "", notes: [], hasAmount: false };
        groups.push(g);
      } else if (!g.ingredientId && item.ingredientId) {
        g.ingredientId = item.ingredientId; // upgrade group to linked as soon as we see a linked match
      }
      const amt = parseFloat(item.amount);
      if (isNaN(amt)) {
        // non-quantifiable (e.g. "salt to taste") — keep as a note, don't sum
        const note = item.amount ? window.APP.utils.fmtIngredient(item.amount, item.unit) : (item.unit || "");
        if (note) g.notes.push(note);
        return;
      }
      if (!g.hasAmount) {
        g.amount = amt;
        g.unit = item.unit;
        g.hasAmount = true;
        return;
      }
      const converted = convertUnit(amt, item.unit, g.unit, item.name);
      if (converted !== null) {
        g.amount = +(g.amount + converted).toFixed(3);
      } else {
        // incompatible units — can't sum, flag amount as unknown
        g.notes.push(`${window.APP.utils.fmtIngredient(amt, item.unit)} (check amount — unit mismatch)`);
        g.mismatched = true;
      }
    });
    return groups;
  },

  // ── Standard ingredient list matching ─────────────────────────────────────────
  // Finds a standard ingredient whose normalized name matches. Used to auto-link
  // AI-generated ingredients to your standard list on confident (exact normalized) matches.
  matchIngredientId(name, standardList = []) {
    const { normalizeIngName } = window.APP.utils;
    const key = normalizeIngName(name);
    if (!key) return null;
    const found = standardList.find(i => normalizeIngName(i.name) === key);
    return found ? found.id : null;
  },

  // Two ingredient-bearing items (recipe ingredient / pantry item / grocery item)
  // are "the same" if they share a linked standard ingredientId, or if their names
  // normalize to the same thing (which includes AKAs, even across linked items).
  sameIngredient(a, b) {
    const { normalizeIngName } = window.APP.utils;
    if (a.ingredientId && b.ingredientId && a.ingredientId === b.ingredientId) return true;
    return normalizeIngName(a.name) === normalizeIngName(b.name);
  },

  // Auto-links a freshly AI-generated ingredient list against your standard list.
  // Confident (exact normalized) matches get linked automatically; anything without
  // a match is left unlinked (ingredientId: null) so it shows up flagged for review.
  linkIngredients(rawIngredients = [], standardList = []) {
    const { matchIngredientId } = window.APP.utils;
    return rawIngredients.map(ing => {
      const id  = matchIngredientId(ing.name, standardList);
      const std = id ? standardList.find(s => s.id === id) : null;
      return { ...ing, ingredientId: id || null, name: std ? std.name : ing.name };
    });
  },

  // Cleans up an AI-produced ingredient list so it fits the rest of the app:
  // numeric amounts, standard units (an unrecognized unit like "jar" moves into
  // the description), linked to the standard list, and a valid grocery section.
  cleanIngredients(raw = [], standardList = []) {
    const { uid, canonUnit, linkIngredients, fixSection } = window.APP.utils;
    const UNITS = window.APP.UNITS || [];
    const ings = (raw || []).filter(i => i && i.name).map(i => {
      const amt   = parseFloat(i.amount);
      const unit  = canonUnit(i.unit);
      const known = !unit || UNITS.includes(unit);
      const printed = known ? "" : `${i.amount ?? ""} ${i.unit}`.trim();
      return {
        ...i,
        id: uid(),
        name: String(i.name).trim(),
        description: [printed, i.description].filter(Boolean).join(", "),
        amount: isNaN(amt) ? "" : amt,
        unit: known ? unit : "",
      };
    });
    return linkIngredients(ings, standardList).map(ing => ({ ...ing, section: fixSection(ing.section, ing.name) }));
  },

  // Prompt rules shared by every AI recipe request so units and sections come back usable.
  recipeFormatRules() {
    const { UNITS = [], SECTIONS = [] } = window.APP;
    return `Rules: "amount" is a number only (convert fractions to decimals, 1 1/2 = 1.5). "unit" is exactly one of [${UNITS.join(", ")}], or "" if none fits — for things counted whole (eggs, onions) use "count". "section" is one of [${SECTIONS.join(", ")}].`;
  },

  // Generates (but does not save) a full recipe for a meal plan entry. The
  // recipe takes the meal's name so the plan and recipe library stay in step.
  async generateRecipeFor(meal, standardList = []) {
    const { callClaude, extractText, parseJSON, cleanIngredients, recipeFormatRules, uid } = window.APP.utils;
    const data = await callClaude({
      maxTokens: 2000,
      messages: [{
        role: "user",
        content: `Generate a full recipe for "${meal.name}"${meal.proteins?.length ? ` using ${meal.proteins.join(", ")}` : ""}. Return ONLY valid JSON, no markdown:
{"name":"","course":"Main","proteins":[],"tags":[],"appliances":[],"servings":4,"prepTime":0,"cookTime":0,"ingredients":[{"name":"","amount":1,"unit":"","section":"Other"}],"steps":[],"notes":"","estimatedCost":0}
${recipeFormatRules()}`,
      }],
    });
    const parsed = parseJSON(extractText(data.content));
    return {
      ...parsed,
      id: uid(),
      name: meal.name,
      servings: +parsed.servings || 4,
      ingredients: cleanIngredients(parsed.ingredients, standardList),
      photo: "", nutrition: {}, sourceLabel: "AI Generated", createdAt: Date.now(),
    };
  },

  // ── Meal plan ↔ recipes ───────────────────────────────────────────────────────
  // The saved recipes behind a meal plan entry: its linked recipeIds, or (for
  // older/unlinked entries) a recipe with the same name.
  mealRecipes(meal, recipes = []) {
    if (meal.recipeIds && meal.recipeIds.length) {
      return meal.recipeIds.map(id => recipes.find(r => r.id === id)).filter(Boolean);
    }
    const name  = (meal.name || "").toLowerCase();
    const match = recipes.find(r => (r.name || "").toLowerCase() === name);
    return match ? [match] : [];
  },

  // A recipe's ingredients scaled to `servings` (unscaled if servings is blank).
  recipeIngredients(recipe, servings) {
    const { scaleAmt, hasQty } = window.APP.utils;
    return (recipe.ingredients || []).map(ing => ({
      name: ing.name, ingredientId: ing.ingredientId || null, unit: ing.unit || "", section: ing.section,
      amount: servings && recipe.servings && hasQty(ing) ? scaleAmt(parseFloat(ing.amount), recipe.servings, servings) : ing.amount,
    }));
  },

  // Every ingredient a meal plan entry needs, scaled to the meal's servings.
  mealIngredients(meal, recipes = []) {
    const { mealRecipes, recipeIngredients } = window.APP.utils;
    return mealRecipes(meal, recipes).flatMap(r => recipeIngredients(r, meal.servings));
  },

  // ── Grocery math ──────────────────────────────────────────────────────────────
  // Given what's needed (groups from combineIngredients) and what's on hand
  // (pantry, and optionally the grocery list), returns what still has to be bought.
  // - On hand with no quantity tracked (e.g. salt) → treated as covered.
  // - On hand in a unit that won't convert → still listed, flagged "check amount".
  shortfall(needed = [], onHand = []) {
    const { sameIngredient, convertUnit, hasQty } = window.APP.utils;
    return needed.map(item => {
      const matches = onHand.filter(o => sameIngredient(o, item));
      if (!matches.length) return item;
      if (matches.some(o => !hasQty(o))) return null; // tracked with no quantity — covered
      if (!item.hasAmount) return matches.some(o => parseFloat(o.amount) > 0) ? null : item;

      let have = 0;
      const unconverted = [];
      matches.forEach(o => {
        const c = convertUnit(parseFloat(o.amount), o.unit, item.unit, item.name);
        if (c === null) unconverted.push(`have ${window.APP.utils.fmtIngredient(o.amount, o.unit)}`);
        else have += c;
      });
      const remaining = +(item.amount - have).toFixed(3);
      if (remaining <= 0) return null;
      if (unconverted.length) return { ...item, amount: remaining, checkAmount: true, notes: [...(item.notes || []), ...unconverted] };
      return { ...item, amount: remaining, checkAmount: !!item.mismatched };
    }).filter(Boolean);
  },

  // Adds items to a grocery list. When the same ingredient is already on the
  // list (and not checked off yet), quantities are summed instead of skipped or
  // duplicated. Returns a new array.
  mergeIntoList(list = [], items = []) {
    const { uid, sameIngredient, convertUnit, hasQty, fixSection } = window.APP.utils;
    const merged = list.map(i => ({ ...i }));
    items.forEach(ni => {
      const qty   = hasQty(ni) ? +parseFloat(ni.amount).toFixed(3) : null;
      const notes = ni.notes && ni.notes.length ? ni.notes : [];
      const ex    = merged.find(i => !i.checked && sameIngredient(i, ni));
      if (!ex) {
        merged.push({
          id: uid(), name: ni.name, ingredientId: ni.ingredientId || null, section: fixSection(ni.section, ni.name),
          amount: qty ?? "", unit: qty !== null ? (ni.unit || "") : "",
          checked: false, checkAmount: !!ni.checkAmount,
          ...(notes.length ? { notes } : {}),
          ...(ni.staple ? { staple: true } : {}),
          ...(ni.misc ? { misc: true } : {}),
        });
        return;
      }
      const allNotes = [...(ex.notes || []), ...notes];
      if (!ex.ingredientId && ni.ingredientId) ex.ingredientId = ni.ingredientId;
      if (qty !== null) {
        if (!hasQty(ex)) { ex.amount = qty; ex.unit = ni.unit || ""; }
        else {
          const c = convertUnit(qty, ni.unit, ex.unit, ni.name);
          if (c !== null) ex.amount = +(parseFloat(ex.amount) + c).toFixed(3);
          else { allNotes.push(`+ ${window.APP.utils.fmtIngredient(qty, ni.unit)}`); ex.checkAmount = true; }
        }
      }
      if (ni.checkAmount) ex.checkAmount = true;
      if (allNotes.length) ex.notes = [...new Set(allNotes)];
    });
    return merged;
  },

  // ── Pantry deductions ─────────────────────────────────────────────────────────
  // Works out what cooking a meal takes out of the pantry, without changing
  // anything. One row per pantry item: { pantryId, name, unit, before, used, after, forIngs }
  // (forIngs = normalized names of the recipe ingredients it covers).
  // Ingredients not in the pantry, or tracked with no quantity (e.g. salt), are skipped.
  planDeductions(meal, recipes = [], pantry = []) {
    const { mealIngredients, sameIngredient, convertUnit, hasQty, normalizeIngName } = window.APP.utils;
    const rows = {};
    mealIngredients(meal, recipes).forEach(ing => {
      const amt = parseFloat(ing.amount);
      if (isNaN(amt) || amt <= 0) return;
      const matches = pantry.filter(pi => sameIngredient(pi, ing));
      if (!matches.length || matches.some(pi => !hasQty(pi))) return;
      // Prefer an entry that still has stock and a compatible unit
      const usable = matches
        .map(pi => ({ pi, used: convertUnit(amt, ing.unit, pi.unit, ing.name) }))
        .filter(x => x.used !== null);
      if (!usable.length) return;
      const left = x => parseFloat(x.pi.amount) - (rows[x.pi.id]?.used || 0);
      const pick = usable.find(x => left(x) > 0) || usable[0];
      const row  = rows[pick.pi.id] || (rows[pick.pi.id] = {
        pantryId: pick.pi.id, name: pick.pi.name, ingredientId: pick.pi.ingredientId || null,
        section: pick.pi.section, unit: pick.pi.unit || "", before: parseFloat(pick.pi.amount), used: 0,
        forIngs: [],
      });
      row.used = +(row.used + pick.used).toFixed(3);
      row.forIngs.push(normalizeIngName(ing.name));
    });
    return Object.values(rows).map(r => ({ ...r, after: Math.max(0, +(r.before - r.used).toFixed(3)) }));
  },

  // ── Linking pantry items by hand ──────────────────────────────────────────────
  // For "Mark as Made": when the recipe's ingredient didn't match on its own
  // (14 oz beans vs. a can of black beans, stewed vs. diced tomatoes) you can
  // point it at any pantry item. These help build that row.

  // How much of pantry item `pi` a linked recipe ingredient uses up, in the
  // pantry item's unit. Converts when it can; otherwise one can/count, else all
  // of it. null = the pantry item has no amount tracked (it just gets used up).
  linkedAmount(ing, pi) {
    const { hasQty, convertUnit, canonUnit } = window.APP.utils;
    if (!hasQty(pi)) return null;
    const have = parseFloat(pi.amount);
    const amt  = parseFloat(ing?.amount);
    if (ing && !isNaN(amt) && amt > 0) {
      const c = convertUnit(amt, ing.unit, pi.unit, ing.name || pi.name);
      if (c !== null) return Math.min(c, have);
    }
    const u = canonUnit(pi.unit) || "count";
    if ((u === "count" || u === "can") && have >= 1) return 1;
    return have;
  },

  // A deduction row (same shape as planDeductions) for a hand-picked pantry item.
  // `used` null means untracked: the item is marked used up.
  linkedRow(pi, used) {
    const untracked = used == null;
    const before = untracked ? null : parseFloat(pi.amount);
    return {
      pantryId: pi.id, name: pi.name, ingredientId: pi.ingredientId || null,
      section: pi.section, unit: pi.unit || "", before,
      used: untracked ? null : +(+used || 0).toFixed(3),
      after: untracked ? 0 : Math.max(0, +(before - (+used || 0)).toFixed(3)),
      untracked, linked: true,
    };
  },

  // Pantry items ordered for linking to `ingName`: the same ingredient first,
  // then ones sharing a word ("stewed tomatoes" → "diced tomatoes"), then the
  // rest. Returns { suggested, others }. Items that are out are left off.
  pantryLinkOptions(ingName, pantry = []) {
    const { normalizeIngName, hasQty } = window.APP.utils;
    const key   = normalizeIngName(ingName || "");
    const words = key.split(" ").filter(w => w.length > 2);
    const stocked = pantry.filter(pi => !(hasQty(pi) && parseFloat(pi.amount) <= 0));
    const score = pi => {
      const n = normalizeIngName(pi.name);
      if (key && n === key) return 2;
      return words.some(w => n.split(" ").includes(w)) ? 1 : 0;
    };
    const byName = (a, b) => a.name.localeCompare(b.name);
    const scored = stocked.map(pi => ({ pi, s: score(pi) }));
    return {
      suggested: scored.filter(x => x.s > 0).sort((a, b) => b.s - a.s || byName(a.pi, b.pi)).map(x => x.pi),
      others:    scored.filter(x => x.s === 0).map(x => x.pi).sort(byName),
    };
  },

  // ── Rolling 365-day price history ─────────────────────────────────────────────
  // Filters price history to the last year, so it never grows unbounded.
  rolling365(log = []) {
    const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
    return log.filter(e => e.ts > cutoff);
  },

  // ── Average unit price ────────────────────────────────────────────────────────
  // Price-per-base-unit for a standard ingredient, from receipt history. Converts
  // each purchase's unit to a base unit (ml for volume, g for weight, count/can
  // as-is) so different package sizes still average together. Food prices go up,
  // so newer receipts count more: a purchase loses half its weight every 60 days.
  // Returns null if there's no usable history. Only the most common unit type is
  // used, so one odd entry (a "count" among pounds) can't skew it.
  avgUnitPrice(ingredientId, priceHistory = []) {
    const { canonUnit } = window.APP.utils;
    const UNIT_INFO = window.APP.UNIT_INFO || {};
    const DAY = 24 * 60 * 60 * 1000, HALF_LIFE_DAYS = 60;
    const entries = priceHistory.filter(p => p.ingredientId === ingredientId && p.amount > 0 && p.unit && p.price >= 0);
    if (!entries.length) return null;

    const byType = {};
    entries.forEach(e => {
      const info = UNIT_INFO[canonUnit(e.unit)];
      if (!info) return;
      const baseAmt = e.amount * info.toBase;
      if (baseAmt <= 0) return;
      const when = Date.parse(e.date) || e.ts || Date.now();
      const ageDays = Math.max(0, (Date.now() - when) / DAY);
      (byType[info.type] = byType[info.type] || []).push({ price: e.price / baseAmt, w: Math.pow(0.5, ageDays / HALF_LIFE_DAYS) });
    });

    const types = Object.entries(byType);
    if (!types.length) return null;
    const [type, prices] = types.sort((a, b) => b[1].length - a[1].length)[0]; // most-common unit type
    const totalW = prices.reduce((s, p) => s + p.w, 0);
    const pricePerBase = prices.reduce((s, p) => s + p.price * p.w, 0) / totalW;
    return { type, pricePerBase, sampleSize: prices.length };
  },

  // ── Estimate recipe cost from receipt prices ──────────────────────────────────
  // Sums receipt-based prices for every quantifiable ingredient that has them.
  // Ingredients without an ingredientId are matched to the standard list by name.
  // Returns { cost, coverage: "full" | "partial" | "none", pricedCount, quantifiableCount }.
  estimateRecipeCost(recipe, priceHistory = [], ingredients = []) {
    const { avgUnitPrice, canonUnit, normalizeIngName } = window.APP.utils;
    const UNIT_INFO = window.APP.UNIT_INFO || {};
    const quantifiable = (recipe.ingredients || []).filter(ing => parseFloat(ing.amount) > 0 && ing.unit);
    if (!quantifiable.length) return { cost: null, coverage: "none", pricedCount: 0, quantifiableCount: 0 };

    const idFor = ing => ing.ingredientId
      || ingredients.find(i => normalizeIngName(i.name) === normalizeIngName(ing.name || ""))?.id
      || null;

    let total = 0, priced = 0;
    quantifiable.forEach(ing => {
      const id = idFor(ing);
      if (!id) return;
      const avg = avgUnitPrice(id, priceHistory);
      if (!avg) return;
      const info = UNIT_INFO[canonUnit(ing.unit)];
      if (!info) return;
      let baseAmt = parseFloat(ing.amount) * info.toBase;
      if (info.type !== avg.type) {
        // e.g. flour bought by the pound but used by the cup, or beans bought by the can but used by the ounce
        const baseUnit = { weight: "g", volume: "ml", count: "count", can: "can" }[avg.type];
        const c = baseUnit ? window.APP.utils.convertUnit(parseFloat(ing.amount), ing.unit, baseUnit, ing.name) : null;
        if (c === null) return; // can't convert — skip
        baseAmt = c;
      }
      total += baseAmt * avg.pricePerBase;
      priced++;
    });

    const coverage = priced === 0 ? "none" : priced === quantifiable.length ? "full" : "partial";
    return { cost: priced ? +total.toFixed(2) : null, coverage, pricedCount: priced, quantifiableCount: quantifiable.length };
  },

  // ── Refresh a recipe's stored cost from receipts ──────────────────────────────
  // Returns the recipe with an updated estimatedCost, or the same object if
  // nothing changed. Ingredients with receipt prices use them; the rest keep
  // their share of the original estimate (saved once as aiEstimatedCost so
  // repeated refreshes don't drift). With no receipt prices it's left alone.
  //   costSource: "receipts" (every ingredient priced) | "mixed" | undefined
  refreshRecipeCost(recipe, priceHistory = [], ingredients = []) {
    const r = window.APP.utils.estimateRecipeCost(recipe, priceHistory, ingredients);
    const base = recipe.aiEstimatedCost ?? recipe.estimatedCost ?? 0;
    let cost, costSource;
    if (r.coverage === "none") {
      if (!recipe.costSource) return recipe; // never priced from receipts — nothing to do
      cost = base; costSource = undefined;   // receipt data aged out: back to the original estimate
    } else {
      const unpricedShare = (r.quantifiableCount - r.pricedCount) / r.quantifiableCount;
      cost = +(r.cost + base * unpricedShare).toFixed(2);
      costSource = r.coverage === "full" ? "receipts" : "mixed";
    }
    if (Math.abs((recipe.estimatedCost || 0) - cost) < 0.01 && recipe.costSource === costSource
        && recipe.costPricedCount === (costSource ? r.pricedCount : undefined)) return recipe;
    const { costSource: _s, costPricedCount: _c, costIngCount: _q, ...rest } = recipe;
    return {
      ...rest,
      aiEstimatedCost: base,
      estimatedCost: cost,
      ...(costSource ? { costSource, costPricedCount: r.pricedCount, costIngCount: r.quantifiableCount } : {}),
    };
  },

  // ── Receipt photo → base64 (resized client-side to control cost) ─────────────
  resizeImageToBase64(file, maxDim = 1500, quality = 0.7) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read image file."));
      reader.onload = e => {
        const img = new Image();
        img.onerror = () => reject(new Error("Could not load image."));
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            const scale = maxDim / Math.max(width, height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement("canvas");
          canvas.width = width; canvas.height = height;
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality).split(",")[1]);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  },

  // ── Receipt name → lookup key ───────────────────────────────────────────────────
  // Receipts print the same item with small differences in case, spacing and
  // punctuation ("MEIJER 100% PURE PUMPKIN" vs "Meijer 100% Pure Pumpkin"), so
  // learned matches are keyed on a loosened form of the printed name.
  receiptKey(name) {
    return String(name || "").toLowerCase().replace(/[^a-z0-9% ]+/g, " ").replace(/\s+/g, " ").trim();
  },

  // ── Scan a receipt photo for line items ───────────────────────────────────────
  // One API call per receipt (not per item). Returns raw parsed items for review —
  // never auto-saved, since receipt item names rarely match your standard list cleanly.
  async scanReceipt(base64Images) {
    const { callClaude, extractText, parseJSON } = window.APP.utils;
    const images = Array.isArray(base64Images) ? base64Images : [base64Images];
    const data = await callClaude({
      maxTokens: 3000,
      messages: [{
        role: "user",
        content: [
          ...images.map(b64 => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } })),
          {
            type: "text",
            text: `${images.length > 1
              ? "These images are consecutive parts of ONE grocery receipt, in order. They may overlap, so list each purchased line item only once."
              : "This image is a grocery receipt."}
Extract every purchased grocery line item. Return ONLY valid JSON, no markdown:
{"store":"","date":"","items":[{"name":"","amount":1,"unit":"","price":0}]}
- "store": the store name printed on the receipt, or "" if not visible
- "date": the purchase date as YYYY-MM-DD, or "" if not visible or the year isn't shown
- "name": item name as printed on the receipt (abbreviated is fine)
- "amount"/"unit": your best guess at quantity purchased. Use one of: tsp, tbsp, fl oz, cup, pint, quart, gallon, ml, l, oz, lb, g, kg, count. If unclear, use amount:1, unit:"count".
- "price": the price paid for that line item (not a per-unit price)
Ignore tax, subtotal, total, coupons, and non-food lines.`,
          },
        ],
      }],
    });
    const parsed = parseJSON(extractText(data.content));
    // Accept the new object shape, or a bare array just in case
    return Array.isArray(parsed)
      ? { store: "", date: "", items: parsed }
      : { store: parsed.store || "", date: parsed.date || "", items: parsed.items || [] };
  },

  // ── Scan recipe photos (cookbook/magazine pages) ──────────────────────────────
  // One API call for all pages (up to 4) so Claude can merge ingredients and steps
  // that span pages. Returns a raw recipe object for the caller to clean up, link
  // to the standard ingredient list, and open in the editor. Nothing is saved here.
  async scanRecipePhotos(base64Images = [], existingTags = []) {
    const { callClaude, extractText, parseJSON } = window.APP.utils;
    const { COURSES, PROTEINS, APPLIANCES, MEAL_TYPES, UNITS } = window.APP;
    const data = await callClaude({
      maxTokens: 2500,
      messages: [{
        role: "user",
        content: [
          ...base64Images.map(b64 => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } })),
          {
            type: "text",
            text: `These photos are pages of ONE recipe, probably in order (use the content to piece them together if not). Combine them into a single recipe. Return ONLY valid JSON, no markdown:
{"name":"","course":"Main","proteins":[],"mealTypes":[],"tags":[],"appliances":[],"servings":4,"prepTime":0,"cookTime":0,"ingredients":[{"name":"","amount":1,"unit":"","description":""}],"steps":[],"notes":"","estimatedCost":0}
Rules:
- Copy what is printed. Do NOT invent ingredients, quantities, or steps. If a quantity is not visible, use amount:"".
- "amount": a number only. Convert fractions to decimals (1 1/2 = 1.5, 1/4 = 0.25).
- "unit": exactly one of [${UNITS.join(", ")}], or "" if none fits (e.g. "salt to taste", or a printed unit not in the list such as "can"). When the printed unit isn't in the list, put the printed quantity text in "description" (e.g. "1 (14 oz) can").
- "name": the ingredient itself without prep words. Put prep or state (e.g. "diced", "room temperature") in "description".
- "steps": one string per step, no step numbers.
- "course": one of [${COURSES.join(", ")}].
- "proteins": zero or more of [${PROTEINS.join(", ")}].
- "mealTypes": zero or more of [${MEAL_TYPES.join(", ")}].
- "appliances": zero or more of [${APPLIANCES.join(", ")}], only ones the recipe actually uses.
- "tags": 0-4 short descriptive tags (cuisine, "quick", etc). Prefer tags from this existing list when they fit: ${JSON.stringify(existingTags)}. Only add a new tag if none fit.
- "notes": any headnote or tips printed on the pages, otherwise "".
- "servings"/"prepTime"/"cookTime" (minutes): from the page if printed; otherwise servings 4 and times 0.
- "estimatedCost": rough USD estimate for the whole recipe at typical Ohio grocery prices.`,
          },
        ],
      }],
    });
    const text = extractText(data.content);
    return parseJSON(text);
  },

  // ── AI tag audit ──────────────────────────────────────────────────────────────
  // Given a tag and a list of candidate recipes (usually ones not already carrying
  // that tag), asks Claude which ones plausibly fit. Returns an array of recipe IDs —
  // suggestions only, never auto-applied. Caller shows a checklist for approval.
  async suggestRecipesForTag(tag, candidates = []) {
    const { callClaude, extractText, parseJSON } = window.APP.utils;
    if (!candidates.length) return [];
    const summary = candidates.map(r => ({
      id: r.id,
      name: r.name,
      course: r.course,
      proteins: r.proteins || [],
      tags: r.tags || [],
      ingredients: (r.ingredients || []).map(i => i.name),
    }));
    const data = await callClaude({
      maxTokens: 1000,
      messages: [{
        role: "user",
        content: `Given this tag: "${tag}", and this list of recipes, return the "id" of every recipe that plausibly fits this tag based on its name, ingredients, course, and proteins. Return ONLY a valid JSON array of id strings, no markdown. If none fit, return [].
Recipes: ${JSON.stringify(summary)}`,
      }],
    });
    const text = extractText(data.content);
    return parseJSON(text);
  },

  // ── Rolling 30-day cost log ──────────────────────────────────────────────────
  // Filters a cost log array to only entries within the last 30 days.
  rolling30(log = []) {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return log.filter(e => e.ts > cutoff);
  },

  // Sum the cost of a filtered log array.
  sumCost(log = []) {
    return log.reduce((s, e) => s + (e.cost || 0), 0);
  },

  // ── localStorage helpers ─────────────────────────────────────────────────────
  lsGet(key, fallback) {
    try {
      const s = localStorage.getItem(key);
      return s ? JSON.parse(s) : fallback;
    } catch {
      return fallback;
    }
  },

  lsSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or unavailable — fail silently
    }
  },

  // ── API call wrapper ─────────────────────────────────────────────────────────
  // Centralised fetch to the Anthropic messages endpoint.
  // Returns parsed JSON or throws.
  // Downloads a recipe page through our server (Claude can't open links itself).
  // Returns { url, title, jsonLd, text } — jsonLd is the page's schema.org Recipe if it has one.
  async fetchRecipePage(url) {
    const householdId = window.APP.currentHouseholdId;
    if (!householdId) throw new Error("AI features need a household — set one up under Settings → Sync & Household.");
    const token = await window.APP.firebase.getIdToken();
    const res = await fetch(window.APP.FETCH_PAGE_URL, {
      method:  "POST",
      headers: {
        "Content-Type":   "application/json",
        "Authorization":  `Bearer ${token}`,
        "X-Household-Id": householdId,
      },
      body: JSON.stringify({ url }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Page fetch error ${res.status}`);
    return data;
  },

  async callClaude({ messages, maxTokens = 1500, tools }) {
    const body = {
      model:      window.APP.API_MODEL,
      max_tokens: maxTokens,
      messages,
    };
    if (tools) body.tools = tools;

    // The proxy only serves signed-in members of a household
    const householdId = window.APP.currentHouseholdId;
    if (!householdId) throw new Error("AI features need a household — set one up under Settings → Sync & Household.");
    const token = await window.APP.firebase.getIdToken();

    const res = await fetch(window.APP.API_URL, {
      method:  "POST",
      headers: {
        "Content-Type":   "application/json",
        "Authorization":  `Bearer ${token}`,
        "X-Household-Id": householdId,
      },
      body:    JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`API error ${res.status}: ${err}`);
    }

    return res.json();
  },

  // Extract all text blocks from a Claude API response content array.
  // Handles both text blocks and tool_result blocks gracefully.
  extractText(content = []) {
    return content
      .filter(b => b.type === "text")
      .map(b => b.text || "")
      .join("");
  },

  // Parse JSON from a Claude response, stripping any accidental markdown fences.
  parseJSON(text) {
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  },

  // ── Date helpers ─────────────────────────────────────────────────────────────
  // Returns a short human-readable date string, e.g. "May 18"
  shortDate(ts) {
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  },

  // ── Array helpers ─────────────────────────────────────────────────────────────
  // Toggle a value in an array (add if absent, remove if present).
  toggleInArray(arr, val) {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
  },

  // Deduplicate an array of objects by a key.
  uniqueBy(arr, key) {
    const seen = new Set();
    return arr.filter(item => {
      const k = item[key];
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  },

  // ── String helpers ────────────────────────────────────────────────────────────
  // Capitalise first letter only.
  cap(str = "") {
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  // Simple plural helper.
  // plural(1, "meal") → "meal"
  // plural(3, "meal") → "meals"
  plural(n, word) {
    return n === 1 ? word : `${word}s`;
  },

  // ── Recipes → CSV ─────────────────────────────────────────────────────────────
  // One row per recipe. Ingredients and steps are kept in one cell each,
  // one per line, so the file opens cleanly in Excel / Google Sheets.
  recipesToCsv(recipes = []) {
    const cell = v => {
      const s = v === undefined || v === null ? "" : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const list = a => (a || []).join(", ");
    const date = ts => ts ? new Date(ts).toLocaleDateString("en-CA") : ""; // YYYY-MM-DD, local
    const ingLine = i => [window.APP.utils.fmtIngredient(i.amount, i.unit), i.name, i.description ? `(${i.description})` : ""].filter(Boolean).join(" ");
    const cols = [
      ["Name",           r => r.name],
      ["Course",         r => r.course],
      ["Meal Types",     r => list(r.mealTypes)],
      ["Proteins",       r => list(r.proteins)],
      ["Appliances",     r => list(r.appliances)],
      ["Tags",           r => list(r.tags)],
      ["Servings",       r => r.servings],
      ["Prep (min)",     r => r.prepTime || ""],
      ["Cook (min)",     r => r.cookTime || ""],
      ["Est. Cost",      r => r.estimatedCost ? Number(r.estimatedCost).toFixed(2) : ""],
      ["Ingredients",    r => (r.ingredients || []).map(ingLine).join("\n")],
      ["Steps",          r => (r.steps || []).filter(s => s && s.trim()).map((s, i) => `${i + 1}. ${s.trim()}`).join("\n")],
      ["Notes",          r => r.notes],
      ["Source",         r => r.sourceUrl || r.sourceLabel],
      ["Last Made",      r => date(r.lastMadeAt)],
      ["Hidden",         r => r.hidden ? "yes" : ""],
    ];
    const rows = [cols.map(c => c[0]), ...recipes.map(r => cols.map(c => c[1](r)))];
    // BOM so Excel reads emoji / accents as UTF-8
    return "\uFEFF" + rows.map(row => row.map(cell).join(",")).join("\r\n");
  },

};
