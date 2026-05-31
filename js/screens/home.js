// ── js/screens/home.js ────────────────────────────────────────────────────────
window.APP = window.APP || {};
const { createElement: h, useState } = React;
const { Btn, Card } = window.APP;
const { fmt$, callClaude, extractText, parseJSON, uid } = window.APP.utils;
const { categorize } = window.APP;

// ── HomeScreen ────────────────────────────────────────────────────────────────
window.APP.HomeScreen = function({ settings, mealPlan, groceryList, onNav, onQuickAdd, addCost, showBanner, onSync, priceSearchResults, setPriceSearchResults }) {
  const pending = groceryList.filter(i => !i.checked).length;

  return h("div", null,
    // Hero
    h("div", { className: "hero" },
      h("div", { className: "hero-bg-icon" }, "🍽"),
      h("div", { className: "hero-title" }, settings.householdName || "Haley's Meal Planning"),
      h("div", { className: "hero-subtitle" }, "What are we cooking this week?"),
    ),

    // Sync refresh button
    onSync && h("div", { style: { display: "flex", justifyContent: "flex-end", marginBottom: 12 } },
      h("button", {
        onClick: () => { onSync(); showBanner("✓ Synced with household", "success"); },
        style: { background: "none", border: "1.5px solid #F0E6D3", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, color: "#7A6A55", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" },
      }, "🔄 Refresh"),
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

    // Meal plan preview — up to 7
    mealPlan.length > 0 && h(Card, { style: { marginBottom: 20 } },
      h("div", { className: "font-bold font-serif mb-12", style: { fontSize: 16 } }, "🗓 Current Meal Plan"),
      mealPlan.slice(0, 7).map(m =>
        h("div", { key: m.id, style: { display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid #F0E6D3", opacity: m.checked ? 0.5 : 1 } },
          h("span", { style: { fontSize: 16 } }, window.APP.MEAL_ICONS[m.mealType] || "🍴"),
          h("div", { style: { flex: 1 } },
            h("div", {
              className: "font-bold",
              style: { fontSize: 14, textDecoration: m.checked ? "line-through" : "none", color: m.checked ? "#7A6A55" : "#1A1208" },
            }, m.name),
            h("div", { className: "muted text-xs" }, `${m.mealType || "Dinner"}${m.proteins?.length ? " · " + m.proteins.join(", ") : ""}`),
          ),
        )
      ),
      mealPlan.length > 7 && h("div", { className: "muted text-sm text-center mt-8" }, `+${mealPlan.length - 7} more`),
      h("div", { style: { marginTop: 10 } },
        h("button", {
          onClick: () => onNav("plan"),
          style: { background: "none", border: "none", cursor: "pointer", color: "#D4622A", fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans',sans-serif" },
        }, "View full plan →"),
      ),
    ),

    // Single item price search
    h(PriceSearchCard, { settings, addCost, priceSearchResults, setPriceSearchResults }),
  );
};

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color, onClick }) {
  return h("div", { className: "stat-card", onClick, style: { marginBottom: 20 } },
    h("span", { style: { position: "absolute", top: 10, right: 12, fontSize: 14, color: "#F0E6D3" } }, "›"),
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
    onAdd({ id: uid(), name: trimmed, section, checked: false, amount: "", unit: "", misc: true });
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
function PriceSearchCard({ settings, addCost, priceSearchResults, setPriceSearchResults }) {
  const [query,   setQuery]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const results = priceSearchResults;

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true); setError("");
    const zip = settings.zipCode || "44691";

    try {
      const data = await callClaude({
        maxTokens: 300,
        messages: [{
          role: "user",
          content: `Estimate price of "${query.trim()}" at grocery stores near Wooster OH (${zip}). Top 3 cheapest from: Walmart, Meijer, Aldi, Marc's, Buehler's. Include best size for value. Return ONLY JSON: {"results":[{"store":"","size":"","price":0.00,"pricePerUnit":"","note":""}]}`,
        }],
      });

      const text   = extractText(data.content);
      const parsed = parseJSON(text);
      setPriceSearchResults(parsed.results || []);
      addCost("priceSearch");
    } catch {
      setError("Could not load results. Try again.");
    }
    setLoading(false);
  };

  return h(Card, { style: { marginTop: 0 } },
    h("div", { className: "font-bold font-serif mb-8", style: { fontSize: 15 } }, "🔍 Single Item Price Search"),
    h("div", { className: "muted text-xs", style: { marginBottom: 10 } }, "Estimates based on typical Wooster-area prices."),

    h("div", { className: "flex gap-8", style: { marginBottom: 10 } },
      h("input", {
        className: "form-input",
        style: { flex: 1 },
        value: query,
        onChange: e => setQuery(e.target.value),
        onKeyDown: e => e.key === "Enter" && search(),
        placeholder: "e.g. Purina Cat Chow Indoor 15lb",
      }),
      h(Btn, {
        label: loading ? "…" : "Search",
        icon: loading ? "" : "🔍",
        onClick: search,
        disabled: loading || !query.trim(),
        style: { flexShrink: 0, marginRight: 4 },
      }),
    ),

    // Results with X to clear
    results && results.length > 0 && h("div", null,
      h("div", { className: "flex-between mb-8" },
        h("div", { className: "price-disclaimer", style: { margin: 0 } }, "* Estimates only — verify before shopping"),
        h("button", {
          onClick: () => setPriceSearchResults(null),
          style: { background: "none", border: "none", cursor: "pointer", color: "#7A6A55", fontSize: 18, lineHeight: 1 },
          title: "Clear results",
        }, "×"),
      ),
      results.map((r, i) =>
        h("div", { key: i, style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #F0E6D3" } },
          h("div", { className: `price-rank ${i === 0 ? "price-rank-1" : "price-rank-n"}` }, i + 1),
          h("div", { style: { flex: 1 } },
            h("div", { className: "font-bold", style: { fontSize: 14 } }, r.store),
            h("div", { className: "muted text-sm" }, r.size),
            r.pricePerUnit && h("div", { className: "accent text-sm font-bold" }, r.pricePerUnit),
            r.note && h("div", { className: "muted text-xs italic" }, r.note),
          ),
          h("div", { className: "primary font-bold", style: { fontSize: 16 } }, fmt$(r.price)),
        )
      ),
    ),

    results && results.length === 0 && h("div", { className: "muted text-sm mt-8" }, "No results found. Try a more specific search."),
    error && h("div", { className: "warn text-sm mt-8" }, error),
  );
}
