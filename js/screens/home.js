// ── js/screens/home.js ────────────────────────────────────────────────────────
window.APP = window.APP || {};
const { createElement: h, useState } = React;
const { Btn, Card, ModeToggle } = window.APP;
const { fmt$, callClaude, extractText, parseJSON } = window.APP.utils;
const { categorize } = window.APP;

// ── HomeScreen ────────────────────────────────────────────────────────────────
window.APP.HomeScreen = function({ settings, mealPlan, groceryList, onNav, onQuickAdd, addCost, showBanner }) {
  const pending = groceryList.filter(i => !i.checked).length;

  return h("div", null,
    // Hero
    h("div", { className: "hero" },
      h("div", { className: "hero-bg-icon" }, "🍽"),
      h("div", { className: "hero-title" }, settings.householdName || "Haley's Meal Planning"),
      h("div", { className: "hero-subtitle" }, "What are we cooking this week?"),
    ),

    // Stat cards
    h("div", { className: "stat-grid" },
      StatCard({ label: "Planned Meals", value: mealPlan.length, icon: "🗓", color: "#D4622A", onClick: () => onNav("plan") }),
      StatCard({ label: "To Buy",        value: pending,         icon: "🛒", color: "#2A7D4F", onClick: () => onNav("grocery") }),
    ),

    // Quick add
    h(Card, { style: { marginBottom: 20 } },
      h("div", { className: "font-bold font-serif mb-12", style: { fontSize: 16 } }, "🛒 Quick Add to Grocery List"),
      h(QuickAddRow, { onAdd: onQuickAdd, showBanner }),
    ),

    // Meal plan preview
    mealPlan.length > 0 && h(Card, { style: { marginBottom: 20 } },
      h("div", { className: "font-bold font-serif mb-12", style: { fontSize: 16 } }, "🗓 Current Meal Plan"),
      mealPlan.slice(0, 4).map(m =>
        h("div", { key: m.id, style: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #F0E6D3" } },
          h("span", { style: { fontSize: 18 } }, window.APP.MEAL_ICONS[m.mealType] || "🍴"),
          h("div", null,
            h("div", { className: "font-bold", style: { fontSize: 14 } }, m.name),
            h("div", { className: "muted text-sm" }, `${m.mealType || "Dinner"} · ${m.proteins?.join(", ") || ""}`),
          ),
        )
      ),
      mealPlan.length > 4 && h("div", { className: "muted text-sm text-center mt-8" }, `+${mealPlan.length - 4} more`),
    ),

    // Single item price search
    h(PriceSearchCard, { settings, addCost }),
  );
};

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color, onClick }) {
  return h("div", { className: "stat-card", onClick },
    h("span", { className: "stat-arrow", style: { position: "absolute", top: 10, right: 12, fontSize: 14, color: "#F0E6D3" } }, "›"),
    h("div", { className: "stat-icon" }, icon),
    h("div", { className: "stat-value", style: { color } }, value),
    h("div", { className: "stat-label" }, label),
  );
}

// ── QuickAddRow ───────────────────────────────────────────────────────────────
function QuickAddRow({ onAdd, showBanner }) {
  const [name, setName] = useState("");

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const section = categorize(trimmed);
    onAdd({ id: window.APP.utils.uid(), name: trimmed, section, checked: false, amount: "", unit: "", misc: true });
    showBanner(`✓ ${trimmed} added to grocery list`, "success");
    setName("");
  };

  return h("div", { style: { display: "flex", gap: 8 } },
    h("input", {
      className: "form-input",
      style: { flex: 1 },
      value: name,
      onChange: e => setName(e.target.value),
      onKeyDown: e => e.key === "Enter" && submit(),
      placeholder: "Add an item…",
    }),
    h(Btn, { label: "Add", onClick: submit, style: { flexShrink: 0, marginRight: 4 } }),
  );
}

// ── PriceSearchCard ───────────────────────────────────────────────────────────
function PriceSearchCard({ settings, addCost }) {
  const [query,   setQuery]   = useState("");
  const [mode,    setMode]    = useState("Both");
  const [zip,     setZip]     = useState(settings.zipCode || "");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error,   setError]   = useState("");

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true); setResults(null); setError("");

    const zipToUse  = zip.trim() || settings.zipCode || "";
    const modeStr   = mode === "Both"
      ? "both online and in-store"
      : mode === "Online" ? "online retailers only"
      : `in-store retailers${zipToUse ? " near " + zipToUse : ""}`;

    try {
      const data = await callClaude({
        maxTokens: 800,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{
          role: "user",
          content: `Find the top 3 best prices for: "${query.trim()}". Search ${modeStr}${zipToUse ? ", zip code " + zipToUse : ""}. For each result include the store name, whether it is online or in-store, the product size or variant, the total price, and the price per unit if available. Return ONLY valid JSON, no markdown fences:
{"results":[{"store":"","type":"Online or In-Store","size":"","price":0.00,"pricePerUnit":""}]}`,
        }],
      });

      const text = extractText(data.content);
      const parsed = parseJSON(text);
      setResults(parsed.results || []);
      addCost("priceSearch");
    } catch (e) {
      setError("Could not load results. Check your connection and try again.");
    }
    setLoading(false);
  };

  return h(Card, { style: { marginTop: 20 } },
    h("div", { className: "font-bold font-serif mb-12", style: { fontSize: 15 } }, "🔍 Single Item Price Search"),

    // Search input
    h("input", {
      className: "form-input",
      style: { marginBottom: 10 },
      value: query,
      onChange: e => setQuery(e.target.value),
      onKeyDown: e => e.key === "Enter" && search(),
      placeholder: "e.g. Purina Cat Chow Indoor 15lb",
    }),

    // Mode toggle + zip + button
    h("div", { className: "price-search-row" },
      h(ModeToggle, { value: mode, onChange: setMode, options: ["Online", "In-Store", "Both"] }),
    ),
    h("div", { className: "price-search-row" },
      h("input", {
        className: "price-zip-input",
        value: zip,
        onChange: e => setZip(e.target.value),
        placeholder: settings.zipCode || "Zip code",
      }),
      h(Btn, {
        label: loading ? "Searching…" : "Search",
        icon: "🔍",
        onClick: search,
        disabled: loading || !query.trim(),
        style: { flexShrink: 0, marginRight: 4 },
      }),
    ),

    // Results
    results && results.length > 0 && h("div", null,
      h("div", { className: "price-disclaimer" }, "* Prices are estimates and may vary. Verify before shopping."),
      results.map((r, i) =>
        h("div", { key: i, style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #F0E6D3" } },
          h("div", { className: `price-rank ${i === 0 ? "price-rank-1" : "price-rank-n"}` }, i + 1),
          h("div", { style: { flex: 1 } },
            h("div", { className: "font-bold", style: { fontSize: 14 } }, r.store),
            h("div", { className: "muted text-sm" }, `${r.type}${r.size ? " · " + r.size : ""}`),
            r.pricePerUnit && h("div", { className: "accent text-sm font-bold" }, r.pricePerUnit),
          ),
          h("div", { className: "primary font-bold", style: { fontSize: 16 } }, fmt$(r.price)),
        )
      ),
    ),

    results && results.length === 0 && h("div", { className: "muted text-sm mt-8" }, "No results found. Try a different search."),
    error && h("div", { className: "warn text-sm mt-8" }, error),
  );
}
