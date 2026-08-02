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
  // Combines scaled amount + unit cleanly, avoids doubling.
  // fmtIngredient(1, "lb")   → "1 lb"
  // fmtIngredient(0.5, "cup")→ "0.5 cup"
  // fmtIngredient(4, "")     → "4"
  fmtIngredient(amount, unit) {
    const a = amount !== undefined && amount !== "" ? amount : "";
    const u = unit && unit.trim() ? unit.trim() : "";
    if (!a && !u) return "";
    if (!u) return String(a);
    return `${a} ${u}`;
  },

// ── Ingredient name normalization ─────────────────────────────────────────────
  // Lowercases, trims, strips a small set of common adjectives, and de-pluralizes.
  // Used to match "chicken breasts, boneless" to "chicken breast" for
  // pantry/grocery/recipe combining. Intentionally simple — not a full NLP match.
  // normalizeIngName("Chicken Breasts, Boneless") → "chicken breast"
  normalizeIngName(name = "") {
    const STRIP_WORDS = [
      "fresh", "frozen", "boneless", "skinless", "chopped", "diced", "minced",
      "sliced", "shredded", "grated", "large", "small", "medium", "extra",
      "ground", "whole", "raw", "cooked", "ripe", "organic",
      "hard", "boiled", "hardboiled", "soft", "scrambled", "fried", "poached",
      "beaten", "melted", "softened", "room", "temperature", "peeled", "trimmed",
      "cubed", "crushed", "packed", "unsalted", "salted",
    ];
    let n = name.toLowerCase().replace(/[,.]/g, " ").trim();
    n = n.split(/\s+/).filter(w => w && !STRIP_WORDS.includes(w)).join(" ");
    // naive de-pluralization: boxes→box, tomatoes→tomato, onions→onion, but not "peas"→"pea" over-eagerly
    n = n.replace(/\b(\w+)ies\b/g, "$1y")
         .replace(/\b(\w+)(ches|shes|xes|oes)\b/g, (_, stem, suf) => stem + suf.slice(0, -2))
         .replace(/\b(\w+[^s])s\b/g, "$1");
    return n.trim();
  },

  // ── Unit conversion ────────────────────────────────────────────────────────
  // Converts an amount between two units of the same type (volume or weight).
  // Returns null if units are missing, unknown, "count", or different types.
  convertUnit(amount, fromUnit, toUnit) {
    const UNIT_INFO = window.APP.UNIT_INFO || {};
    if (!fromUnit || !toUnit) return null;
    if (fromUnit === toUnit) return amount;
    const from = UNIT_INFO[fromUnit], to = UNIT_INFO[toUnit];
    if (!from || !to) return null;
    if (from.type !== to.type || from.type === "count") return null;
    return +((amount * from.toBase) / to.toBase).toFixed(3);
  },

  // ── Combine ingredient lists ──────────────────────────────────────────────────
  // Takes a flat array of { name, amount, unit } (e.g. all ingredients across a
  // week's recipes) and combines entries with matching normalized names.
  // Same-unit or same-type amounts are summed (converted to the first-seen unit
  // for that name); incompatible units are combined by tacking on a separate
  // note rather than guessing. Non-numeric/blank amounts are left as notes.
  combineIngredients(items = []) {
    const { normalizeIngName, convertUnit } = window.APP.utils;
    const groups = {};
    items.forEach(item => {
      const key = item.ingredientId || normalizeIngName(item.name);
      if (!key) return;
      if (!groups[key]) {
        groups[key] = { name: item.name, ingredientId: item.ingredientId || null, section: item.section, amount: 0, unit: item.unit || "", notes: [], hasAmount: false };
      }
      const g = groups[key];
      const amt = parseFloat(item.amount);
      if (!item.unit || isNaN(amt)) {
        // non-quantifiable (e.g. "salt to taste") — keep as a note, don't sum
        g.notes.push(item.amount ? `${item.amount}${item.unit ? " " + item.unit : ""}` : (item.unit || ""));
        return;
      }
      if (!g.hasAmount) {
        g.amount = amt;
        g.unit = item.unit;
        g.hasAmount = true;
        return;
      }
      const converted = convertUnit(amt, item.unit, g.unit);
      if (converted !== null) {
        g.amount = +(g.amount + converted).toFixed(3);
      } else {
        // incompatible units — can't sum, flag amount as unknown
        g.notes.push(`${amt} ${item.unit} (check amount — unit mismatch)`);
        g.mismatched = true;
      }
    });
    return Object.values(groups);
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
  // are "the same" if they share a linked standard ingredientId, or — for anything
  // not yet linked — if their names normalize to the same thing (fallback).
  sameIngredient(a, b) {
    const { normalizeIngName } = window.APP.utils;
    if (a.ingredientId && b.ingredientId) return a.ingredientId === b.ingredientId;
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

  // ── Rolling 365-day price history ─────────────────────────────────────────────
  // Filters price history to the last year, so it never grows unbounded.
  rolling365(log = []) {
    const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
    return log.filter(e => e.ts > cutoff);
  },

  // ── Average unit price ────────────────────────────────────────────────────────
  // Blended average price-per-base-unit for a standard ingredient, from purchase
  // history. Converts each purchase's unit to a base unit (ml for volume, g for
  // weight, count as-is) so purchases in different-sized packages still average
  // together correctly (e.g. a gallon of milk and a quart of milk both count).
  // Returns null if there's no usable history. Ignores entries whose unit type
  // doesn't match the majority (rare, but keeps a mixed-up entry from skewing things).
  avgUnitPrice(ingredientId, priceHistory = []) {
    const UNIT_INFO = window.APP.UNIT_INFO || {};
    const entries = priceHistory.filter(p => p.ingredientId === ingredientId && p.amount > 0 && p.unit && p.price >= 0);
    if (!entries.length) return null;

    const byType = {};
    entries.forEach(e => {
      const info = UNIT_INFO[e.unit];
      if (!info) return;
      const baseAmt = e.amount * info.toBase;
      if (baseAmt <= 0) return;
      (byType[info.type] = byType[info.type] || []).push(e.price / baseAmt);
    });

    const types = Object.entries(byType);
    if (!types.length) return null;
    const [type, prices] = types.sort((a, b) => b[1].length - a[1].length)[0]; // most-common unit type
    const pricePerBase = prices.reduce((a, b) => a + b, 0) / prices.length;
    return { type, pricePerBase, sampleSize: prices.length };
  },

  // ── Estimate recipe cost from real price history ──────────────────────────────
  // Only swaps in real prices when EVERY quantifiable, linked ingredient has
  // price history — a partial sum would understate cost and be misleading.
  // Returns { cost, coverage: "full" | "partial" | "none", pricedCount, quantifiableCount }.
  estimateRecipeCost(recipe, priceHistory = []) {
    const { avgUnitPrice } = window.APP.utils;
    const UNIT_INFO = window.APP.UNIT_INFO || {};
    const quantifiable = (recipe.ingredients || []).filter(ing => ing.amount && ing.unit);
    if (!quantifiable.length) return { cost: null, coverage: "none", pricedCount: 0, quantifiableCount: 0 };

    let total = 0, priced = 0;
    quantifiable.forEach(ing => {
      if (!ing.ingredientId) return;
      const avg = avgUnitPrice(ing.ingredientId, priceHistory);
      if (!avg) return;
      const info = UNIT_INFO[ing.unit];
      if (!info || info.type !== avg.type) return; // can't convert — skip
      total += ing.amount * info.toBase * avg.pricePerBase;
      priced++;
    });

    const coverage = priced === 0 ? "none" : priced === quantifiable.length ? "full" : "partial";
    return { cost: priced ? +total.toFixed(2) : null, coverage, pricedCount: priced, quantifiableCount: quantifiable.length };
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

  // ── Scan a receipt photo for line items ───────────────────────────────────────
  // One API call per receipt (not per item). Returns raw parsed items for review —
  // never auto-saved, since receipt item names rarely match your standard list cleanly.
  async scanReceipt(base64Image) {
    const { callClaude, extractText, parseJSON } = window.APP.utils;
    const data = await callClaude({
      maxTokens: 1500,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64Image } },
          {
            type: "text",
            text: `Extract every purchased grocery line item from this receipt photo. Return ONLY valid JSON, no markdown:
[{"name":"","amount":1,"unit":"","price":0}]
- "name": item name as printed on the receipt (abbreviated is fine)
- "amount"/"unit": your best guess at quantity purchased. Use one of: tsp, tbsp, fl oz, cup, pint, quart, gallon, ml, l, oz, lb, g, kg, count. If unclear, use amount:1, unit:"count".
- "price": the price paid for that line item (not a per-unit price)
Ignore tax, subtotal, total, coupons, and non-food lines.`,
          },
        ],
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
  async callClaude({ messages, maxTokens = 1500, tools }) {
    const body = {
      model:      window.APP.API_MODEL,
      max_tokens: maxTokens,
      messages,
    };
    if (tools) body.tools = tools;

const res = await fetch("https://us-central1-meal-planner-5df26.cloudfunctions.net/anthropicProxy", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
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

};
