// ── js/screens/home.js ────────────────────────────────────────────────────────
window.APP = window.APP || {};
const { createElement: h, useState, useRef } = React;
const { Btn, Card, ModeToggle } = window.APP;
const { fmt$, callClaude, extractText, parseJSON } = window.APP.utils;
const { categorize } = window.APP;

// ── Weekly ad flyer links for Wooster, OH ─────────────────────────────────────
const FLYER_LINKS = [
  { name: "Walmart",   url: "https://www.walmart.com/store/1812-wooster-oh/weekly-ads" },
  { name: "Meijer",    url: "https://www.meijer.com/weeklyad" },
  { name: "Aldi",      url: "https://www.aldi.us/en/weekly-specials" },
  { name: "Marc's",    url: "https://www.marcs.com/weeklyad" },
  { name: "Buehler's", url: "https://buehlers.mycircular.info/weekly-ad" },
];

// ── HomeScreen ────────────────────────────────────────────────────────────────
window.APP.HomeScreen = function({ settings, mealPlan, groceryList, onNav, onQuickAdd, addCost, showBanner, onSync }) {
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
        style: { background: "none", border: "1.5px solid #F0E6D3", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, color: "#7A6A55", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
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

    // Meal plan preview
    mealPlan.length > 0 && h(Card, { style: { marginBottom: 20 } },
      h("div", { className: "font-bold font-serif mb-12", style: { fontSize: 16 } }, "🗓 Current Meal Plan"),
      mealPlan.slice(0, 4).map(m =>
        h("div", { key: m.id, style: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #F0E6D3" } },
          h("span", { style: { fontSize: 18 } }, window.APP.MEAL_ICONS[m.mealType] || "🍴"),
          h("div", null,
            h("div", { className: "font-bold", style: { fontSize: 14 } }, m.name),
            h("div", { className: "muted text-sm" }, `${m.mealType || "Dinner"} · ${(m.proteins || []).join(", ")}`),
          ),
        )
      ),
      mealPlan.length > 4 && h("div", { className: "muted text-sm text-center mt-8" }, `+${mealPlan.length - 4} more`),
    ),

    // Single item price search
    h(PriceSearchCard, { settings, addCost }),

    // Weekly flyer links
    h(Card, { style: { marginTop: 20 } },
      h("div", { className: "font-bold font-serif mb-12", style: { fontSize: 15 } }, "📰 Weekly Flyers"),
      h("div", { className: "muted text-xs", style: { marginBottom: 12 } }, "Tap to open this week's ad in your browser."),
      h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } },
        FLYER_LINKS.map(f =>
          h("a", {
            key: f.name,
            href: f.url,
            target: "_blank",
            rel: "noopener noreferrer",
            style: {
              display: "block",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1.5px solid #F0E6D3",
              background: "#FFF8F0",
              fontSize: 13,
              fontWeight: 600,
              color: "#D4622A",
              textDecoration: "none",
              textAlign: "center",
              fontFamily: "'DM Sans', sans-serif",
            },
          }, f.name)
        ),
      ),
    ),
  );
};

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color, onClick }) {
  return h("div", { className: "stat-card", onClick },
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
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error,   setError]   = useState("");
  const cacheRef              = useRef({});

  const search = async () => {
    if (!query.trim()) return;
    const cacheKey = query.trim().toLowerCase();
    if (cacheRef.current[cacheKey]) { setResults(cacheRef.current[cacheKey]); return; }

    setLoading(true); setResults(null); setError("");
    const zip = settings.zipCode || "44691";

    try {
      const data = await callClaude({
        maxTokens: 400,
        messages: [{
          role: "user",
          content: `Based on your knowledge of typical grocery prices near Wooster, Ohio (zip ${zip}), estimate the price of "${query.trim()}" at the top 3 cheapest local stores. Include Walmart, Meijer, Aldi, Marc's, and Buehler's where relevant. For each result include the best size/variant for value. Be specific about sizes and prices. Return ONLY valid JSON, no markdown:
{"results":[{"store":"","size":"","price":0.00,"pricePerUnit":"","note":""}]}`,
        }],
      });

      const text   = extractText(data.content);
      const parsed = parseJSON(text);
      const r      = parsed.results || [];
      cacheRef.current[cacheKey] = r;
      setResults(r);
      addCost("priceSearch");
    } catch {
      setError("Could not load results. Try again.");
    }
    setLoading(false);
  };

  return h(Card, { style: { marginTop: 20 } },
    h("div", { className: "font-bold font-serif mb-12", style: { fontSize: 15 } }, "🔍 Single Item Price Search"),
    h("div", { className: "muted text-xs", style: { marginBottom: 10 } }, "Estimates based on typical prices in the Wooster area. Verify before shopping."),

    h("input", {
      className: "form-input",
      style: { marginBottom: 10 },
      value: query,
      onChange: e => setQuery(e.target.value),
      onKeyDown: e => e.key === "Enter" && search(),
      placeholder: "e.g. Purina Cat Chow Indoor 15lb",
    }),

    h(Btn, {
      label: loading ? "Searching…" : "Search",
      icon: "🔍",
      onClick: search,
      disabled: loading || !query.trim(),
      className: "btn-full",
      style: { marginBottom: 10 },
    }),

    results && results.length > 0 && h("div", null,
      h("div", { className: "price-disclaimer" }, "* Price estimates only — not live prices. Always verify in store or app."),
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
