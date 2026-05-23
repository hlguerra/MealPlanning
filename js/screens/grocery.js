// ── js/screens/grocery.js ─────────────────────────────────────────────────────
window.APP = window.APP || {};
const { createElement: h, useState } = React;
const { Btn, Card, SectionHeader, EmptyState, CollapsibleSection, ModeToggle, SyncIndicator } = window.APP;
const { uid, fmt$, callClaude, extractText, parseJSON } = window.APP.utils;
const { categorize } = window.APP;
const { SECTIONS } = window.APP;

// ── GroceryScreen ─────────────────────────────────────────────────────────────
window.APP.GroceryScreen = function({ groceryList, setGroceryList, staples, setStaples, settings, addCost, showBanner }) {
  const [input,       setInput]       = useState("");
  const [showStaples, setShowStaples] = useState(false);

  // ── Item actions (no PIN required) ─────────────────────────────────────────
  const addItem = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const section = categorize(trimmed);
    setGroceryList(l => [...l, { id: uid(), name: trimmed, section, checked: false, amount: "", unit: "", misc: true }]);
    setInput("");
  };

  const toggleItem   = id  => setGroceryList(l => l.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
  const deleteItem   = id  => setGroceryList(l => l.filter(i => i.id !== id));
  const clearChecked = ()  => setGroceryList(l => l.filter(i => !i.checked));
  const clearAll     = ()  => setGroceryList([]);

  // ── Staple actions (no PIN) ─────────────────────────────────────────────────
  const toggleStaple = (staple, checked) => {
    if (checked) {
      setGroceryList(l => [...l, { id: uid(), name: staple.name, section: staple.section, checked: false, amount: "", unit: "", staple: true }]);
    } else {
      setGroceryList(l => l.filter(i => i.name !== staple.name));
    }
  };

  const addStaple = name => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setStaples(s => [...s, { id: uid(), name: trimmed, section: categorize(trimmed) }]);
  };

  const removeStaple = id => setStaples(s => s.filter(x => x.id !== id));

  // ── Grouping ────────────────────────────────────────────────────────────────
  const grouped = SECTIONS.reduce((acc, s) => {
    const items = groceryList.filter(i => i.section === s);
    if (items.length) acc[s] = items;
    return acc;
  }, {});

  const checkedCount = groceryList.filter(i => i.checked).length;

  // ── Render ──────────────────────────────────────────────────────────────────
  return h("div", null,
    h(SectionHeader, {
      title: "Grocery List",
      action: checkedCount > 0
        ? h(Btn, { label: `Clear ${checkedCount} ✓`, variant: "ghost", onClick: clearChecked, className: "btn-sm" })
        : null,
    }),

    // ── Sync indicator ────────────────────────────────────────────────────────
    h(SyncIndicator),

    // ── Add item ──────────────────────────────────────────────────────────────
    h(Card, { style: { marginBottom: 16 } },
      h("div", { className: "flex gap-8" },
        h("input", {
          className: "form-input",
          style: { flex: 1 },
          value: input,
          onChange: e => setInput(e.target.value),
          onKeyDown: e => e.key === "Enter" && addItem(),
          placeholder: "Add item…",
        }),
        h(Btn, { label: "Add", onClick: addItem, style: { flexShrink: 0, marginRight: 4 } }),
      ),
    ),

    // ── Staples ───────────────────────────────────────────────────────────────
    h(Card, { style: { marginBottom: 16 } },
      h(CollapsibleSection, { title: "📌 Staples" },
        staples.map(s =>
          h("div", { key: s.id, style: { display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid #F0E6D3" } },
            h("input", {
              type: "checkbox",
              checked: !!groceryList.find(i => i.name === s.name),
              onChange: e => toggleStaple(s, e.target.checked),
              style: { width: 18, height: 18, accentColor: "#D4622A", cursor: "pointer" },
            }),
            h("span", { style: { flex: 1, fontSize: 14 } }, s.name),
            h("span", { className: "muted text-xs" }, s.section),
            h("button", {
              onClick: () => removeStaple(s.id),
              style: { background: "none", border: "none", cursor: "pointer", color: "#C0392B", fontSize: 16, opacity: 0.5, marginLeft: 4 },
              title: "Remove staple",
            }, "×"),
          )
        ),
        h("input", {
          className: "form-input",
          style: { marginTop: 10 },
          placeholder: "Add staple… (press Enter)",
          onKeyDown: e => {
            if (e.key === "Enter" && e.target.value.trim()) {
              addStaple(e.target.value);
              e.target.value = "";
            }
          },
        }),
      ),
    ),

    // ── Empty state ───────────────────────────────────────────────────────────
    groceryList.length === 0 && h(EmptyState, {
      icon: "🛒",
      title: "Your list is empty",
      sub: "Add items above or generate from your meal plan",
    }),

    // ── Grouped items ─────────────────────────────────────────────────────────
    Object.entries(grouped).map(([section, items]) =>
      h("div", { key: section, style: { marginBottom: 16 } },
        h("div", { className: "grocery-section-label" }, section),
        items.map(item =>
          h("div", { key: item.id, className: "grocery-item" },
            h("input", {
              type: "checkbox",
              checked: item.checked,
              onChange: () => toggleItem(item.id),
              style: { width: 18, height: 18, accentColor: "#2A7D4F", flexShrink: 0, cursor: "pointer" },
            }),
            h("span", {
              className: `grocery-item-name ${item.checked ? "checked" : ""}`,
            },
              item.name,
              item.amount ? ` — ${item.amount}${item.unit ? " " + item.unit : ""}` : "",
            ),
            h("button", {
              className: "grocery-item-delete",
              onClick: () => deleteItem(item.id),
              title: "Remove item",
            }, "×"),
          )
        ),
      )
    ),

    // ── Clear all ─────────────────────────────────────────────────────────────
    groceryList.length > 0 && h("div", { className: "flex", style: { justifyContent: "flex-end", marginTop: 8, marginBottom: 24 } },
      h(Btn, { label: "Clear All", variant: "danger", onClick: clearAll, className: "btn-sm" }),
    ),

    // ── Price comparison (bottom) ─────────────────────────────────────────────
    h(PriceCompareSection, { groceryList, settings, addCost }),
  );
};

// ── PriceCompareSection ───────────────────────────────────────────────────────
function PriceCompareSection({ groceryList, settings, addCost }) {
  const [open,    setOpen]    = useState(false);
  const [mode,    setMode]    = useState("Both");
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState("");

  const compare = async () => {
    if (!groceryList.length) return;
    setLoading(true); setResult(null); setError("");

    const items   = groceryList.map(i => i.name).join(", ");
    const zip     = settings.zipCode || "";
    const modeStr = mode === "Both"
      ? "both online and in-store"
      : mode === "Online" ? "online retailers only"
      : `in-store retailers${zip ? " near " + zip : ""}`;

    try {
      const data = await callClaude({
        maxTokens: 1000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{
          role: "user",
          content: `I need to buy these groceries: ${items}.${zip ? " Near zip code " + zip + "." : ""} Compare prices at ${modeStr}. Find the top 3 stores with the best total basket price. Also identify the 2–3 biggest individual savings (items where one store is notably cheaper than another). Return ONLY valid JSON, no markdown fences:
{"stores":[{"name":"","type":"In-Store or Online","estimatedTotal":0,"notes":""}],"biggestSavings":[{"item":"","bestStore":"","bestPrice":0,"vs":"","vsPrice":0}]}`,
        }],
      });

      const text   = extractText(data.content);
      const parsed = parseJSON(text);
      setResult(parsed);
      addCost("priceList");
    } catch {
      setError("Could not load price comparison. Check your connection and try again.");
    }
    setLoading(false);
  };

  return h(Card, { style: { marginTop: 8 } },
    h("button", {
      className: "collapsible-toggle",
      onClick: () => setOpen(v => !v),
      type: "button",
    },
      h("span", { className: "font-bold font-serif", style: { fontSize: 14 } }, "💰 Compare Prices"),
      h("span", { className: "muted", style: { fontSize: 18 } }, open ? "▲" : "▼"),
    ),

    open && h("div", { style: { marginTop: 12 } },
      h("div", { style: { marginBottom: 10 } },
        h("div", { className: "form-label" }, "Store Type"),
        h(ModeToggle, { value: mode, onChange: setMode, options: ["Online", "In-Store", "Both"] }),
      ),

      h(Btn, {
        label: loading ? "Searching…" : "Compare Full List",
        icon: "🔍",
        onClick: compare,
        disabled: loading || !groceryList.length,
        className: "btn-full",
        style: { marginBottom: 10 },
      }),

      result && !result.error && h("div", null,
        h("div", { className: "price-disclaimer" }, "* Prices are estimates and may vary. Verify before shopping."),
        (result.stores || []).map((s, i) =>
          h("div", { key: i, style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #F0E6D3" } },
            h("div", { className: `price-rank ${i === 0 ? "price-rank-1" : "price-rank-n"}` }, i + 1),
            h("div", { style: { flex: 1 } },
              h("div", { className: "font-bold", style: { fontSize: 14 } }, s.name),
              h("div", { className: "muted text-sm" }, s.type + (s.notes ? " · " + s.notes : "")),
            ),
            h("div", { className: "accent font-bold", style: { fontSize: 16 } }, fmt$(s.estimatedTotal)),
          )
        ),
        result.biggestSavings?.length > 0 && h("div", { style: { marginTop: 12 } },
          h("div", { className: "grocery-section-label", style: { marginBottom: 6 } }, "🏷 Biggest Savings"),
          result.biggestSavings.map((s, i) =>
            h("div", { key: i, style: { fontSize: 13, padding: "6px 0", borderBottom: "1px solid #F0E6D3" } },
              h("span", { className: "font-bold" }, s.item), ": ",
              s.bestStore, " ",
              h("span", { className: "accent font-bold" }, fmt$(s.bestPrice)),
              " vs ", s.vs, " ", fmt$(s.vsPrice),
            )
          ),
        ),
      ),

      error && h("div", { className: "warn text-sm mt-8" }, error),
    ),
  );
}
