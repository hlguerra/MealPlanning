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
