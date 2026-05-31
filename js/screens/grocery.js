// ── js/screens/grocery.js ─────────────────────────────────────────────────────
window.APP = window.APP || {};
const { createElement: h, useState } = React;
const { Btn, Card, SectionHeader, EmptyState, CollapsibleSection, SyncIndicator } = window.APP;
const { uid, fmt$, callClaude, extractText, parseJSON } = window.APP.utils;
const { categorize } = window.APP;
const { SECTIONS, FLYER_LINKS } = window.APP;

// ── GroceryScreen ─────────────────────────────────────────────────────────────
window.APP.GroceryScreen = function({ groceryList, setGroceryList, staples, setStaples, settings, spending, onRecordPurchase, addCost, showBanner, priceListResults, setPriceListResults }) {
  const [input,       setInput]       = useState("");
  const [qty,         setQty]         = useState("");
  const [showStaples, setShowStaples] = useState(false);

  // Purchase recording state
  const [showPurchase,   setShowPurchase]   = useState(false);
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [purchaseNote,   setPurchaseNote]   = useState("");
  const [showHistory,    setShowHistory]    = useState(false);

  // ── Item actions ────────────────────────────────────────────────────────────
  const addItem = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const section = categorize(trimmed);
    setGroceryList(l => [...l, {
      id:      uid(),
      name:    trimmed,
      section,
      checked: false,
      amount:  qty.trim() || "",
      unit:    "",
      misc:    true,
    }]);
    setInput("");
    setQty("");
  };

  const toggleItem   = id => setGroceryList(l => l.map(i  => i.id === id ? { ...i, checked: !i.checked } : i));
  const deleteItem   = id => setGroceryList(l => l.filter(i => i.id !== id));
  const clearChecked = ()  => setGroceryList(l => l.filter(i => !i.checked));
  const clearAll     = ()  => setGroceryList([]);

  // ── Staple actions ──────────────────────────────────────────────────────────
  const toggleStaple = (staple, checked) => {
    if (checked) {
      setGroceryList(l => [...l, { id: uid(), name: staple.name, section: staple.section, checked: false, amount: "", unit: "", staple: true }]);
    } else {
      setGroceryList(l => l.filter(i => i.name !== staple.name));
    }
  };
  const addStaple    = name => { const t = name.trim(); if (!t) return; setStaples(s => [...s, { id: uid(), name: t, section: categorize(t) }]); };
  const removeStaple = id   => setStaples(s => s.filter(x => x.id !== id));

  // ── Purchase recording ──────────────────────────────────────────────────────
  const handleRecordPurchase = () => {
    const amt = parseFloat(purchaseAmount);
    if (!amt || amt <= 0) return;
    onRecordPurchase(amt, purchaseNote);
    setPurchaseAmount("");
    setPurchaseNote("");
    setShowPurchase(false);
    showBanner(`✓ Purchase of ${fmt$(amt)} recorded`, "success");
  };

  // Spending summary
  const currentMonth    = new Date().toISOString().slice(0, 7);
  const thisMonthSpend  = (spending || []).filter(e => e.month === currentMonth).reduce((s, e) => s + e.amount, 0);
  const allTimeSpend    = (spending || []).reduce((s, e) => s + e.amount, 0);

  // Group by month for history
  const spendByMonth = (spending || []).reduce((acc, e) => {
    if (!acc[e.month]) acc[e.month] = 0;
    acc[e.month] += e.amount;
    return acc;
  }, {});
  const sortedMonths = Object.keys(spendByMonth).sort().reverse();

  // ── Grouping ────────────────────────────────────────────────────────────────
  const grouped = SECTIONS.reduce((acc, s) => {
    const items = groceryList.filter(i => i.section === s);
    if (items.length) acc[s] = items;
    return acc;
  }, {});

  const checkedCount   = groceryList.filter(i => i.checked).length;
  const allChecked     = groceryList.length > 0 && checkedCount === groceryList.length;

  // ── Render ──────────────────────────────────────────────────────────────────
  return h("div", null,
    h(SectionHeader, {
      title: "Grocery List",
      action: checkedCount > 0
        ? h(Btn, { label: `Clear ${checkedCount} ✓`, variant: "ghost", onClick: clearChecked, className: "btn-sm" })
        : null,
    }),

    // Sync indicator
    h(SyncIndicator),

    // Add item — with optional quantity
    h(Card, { style: { marginBottom: 16 } },
      h("div", { className: "flex gap-8", style: { marginBottom: qty !== "" ? 0 : 0 } },
        h("input", {
          className: "form-input",
          style: { flex: 1 },
          value: input,
          onChange: e => setInput(e.target.value),
          onKeyDown: e => e.key === "Enter" && addItem(),
          placeholder: "Add item…",
        }),
        h("input", {
          className: "form-input",
          style: { width: 64, flexShrink: 0 },
          value: qty,
          onChange: e => setQty(e.target.value),
          onKeyDown: e => e.key === "Enter" && addItem(),
          placeholder: "Qty",
          type: "number",
          min: "0",
        }),
        h(Btn, { label: "Add", onClick: addItem, style: { flexShrink: 0, marginRight: 4 } }),
      ),
    ),

    // Staples
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
            h("button", { onClick: () => removeStaple(s.id), style: { background: "none", border: "none", cursor: "pointer", color: "#C0392B", fontSize: 16, opacity: 0.5 } }, "×"),
          )
        ),
        h("input", {
          className: "form-input",
          style: { marginTop: 10 },
          placeholder: "Add staple… (press Enter)",
          onKeyDown: e => { if (e.key === "Enter" && e.target.value.trim()) { addStaple(e.target.value); e.target.value = ""; } },
        }),
      ),
    ),

    // Empty state
    groceryList.length === 0 && h(EmptyState, {
      icon: "🛒",
      title: "Your list is empty",
      sub: "Add items above or generate from your meal plan",
    }),

    // Grouped items
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
            h("span", { className: `grocery-item-name ${item.checked ? "checked" : ""}` },
              item.name,
              item.amount ? ` — ${item.amount}${item.unit ? " " + item.unit : ""}` : "",
            ),
            h("button", { className: "grocery-item-delete", onClick: () => deleteItem(item.id) }, "×"),
          )
        ),
      )
    ),

    // Bottom actions
    groceryList.length > 0 && h("div", { className: "flex", style: { justifyContent: "space-between", marginTop: 8, marginBottom: 16 } },
      h(Btn, { label: "Clear All", variant: "danger", onClick: clearAll, className: "btn-sm" }),
      allChecked && h(Btn, {
        label: "Mark as Purchased",
        variant: "accent",
        icon: "🏷",
        onClick: () => setShowPurchase(true),
        className: "btn-sm",
      }),
    ),

    // Mark as purchased panel
    showPurchase && h(Card, { style: { marginBottom: 16, border: "2px solid #2A7D4F" } },
      h("div", { className: "font-bold font-serif mb-12", style: { fontSize: 15 } }, "🏷 Record Purchase"),
      h("div", { className: "flex gap-8", style: { marginBottom: 10 } },
        h("div", { style: { flex: 1 } },
          h("div", { className: "form-label" }, "Total Amount ($)"),
          h("input", {
            className: "form-input",
            type: "number", min: "0", step: "0.01",
            value: purchaseAmount,
            onChange: e => setPurchaseAmount(e.target.value),
            placeholder: "e.g. 87.42",
            autoFocus: true,
          }),
        ),
      ),
      h("div", { style: { marginBottom: 10 } },
        h("div", { className: "form-label" }, "Note (optional)"),
        h("input", {
          className: "form-input",
          value: purchaseNote,
          onChange: e => setPurchaseNote(e.target.value),
          placeholder: "e.g. Walmart weekly shop",
          onKeyDown: e => e.key === "Enter" && handleRecordPurchase(),
        }),
      ),
      h("div", { className: "flex gap-8" },
        h(Btn, { label: "Cancel", variant: "ghost", onClick: () => setShowPurchase(false), style: { flex: 1 } }),
        h(Btn, { label: "Save Purchase", variant: "accent", onClick: handleRecordPurchase, style: { flex: 1 } }),
      ),
    ),

    // Spending summary
    h(Card, { style: { marginBottom: 8 } },
      h(CollapsibleSection, { title: "💵 Spending History" },
        h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 } },
          h("div", { style: { background: "#FFF8F0", borderRadius: 10, padding: "10px 12px", textAlign: "center" } },
            h("div", { className: "muted text-xs font-bold" }, "This Month"),
            h("div", { className: "primary font-bold", style: { fontSize: 20 } }, fmt$(thisMonthSpend)),
          ),
          h("div", { style: { background: "#FFF8F0", borderRadius: 10, padding: "10px 12px", textAlign: "center" } },
            h("div", { className: "muted text-xs font-bold" }, "All Time"),
            h("div", { className: "primary font-bold", style: { fontSize: 20 } }, fmt$(allTimeSpend)),
          ),
        ),
        sortedMonths.length === 0 && h("div", { className: "muted text-sm text-center" }, "No purchases recorded yet."),
        sortedMonths.map(month =>
          h("div", { key: month, style: { display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #F0E6D3", fontSize: 14 } },
            h("span", { className: "muted" }, new Date(month + "-02").toLocaleDateString("en-US", { month: "long", year: "numeric" })),
            h("span", { className: "font-bold" }, fmt$(spendByMonth[month])),
          )
        ),
      ),
    ),

    // Price comparison
    h(PriceCompareSection, { groceryList, settings, addCost, priceListResults, setPriceListResults }),

    // Weekly flyers
    h(Card, { style: { marginTop: 8 } },
      h(CollapsibleSection, { title: "📰 Weekly Flyers" },
        h("div", { className: "muted text-xs", style: { marginBottom: 12 } }, "Tap to open this week's ad in your browser."),
        h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } },
          (FLYER_LINKS || []).map(f =>
            h("a", {
              key: f.name,
              href: f.url,
              target: "_blank",
              rel: "noopener noreferrer",
              style: { display: "block", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #F0E6D3", background: "#FFF8F0", fontSize: 13, fontWeight: 600, color: "#D4622A", textDecoration: "none", textAlign: "center", fontFamily: "'DM Sans',sans-serif" },
            }, f.name)
          ),
        ),
      ),
    ),
  );
};

// ── PriceCompareSection ───────────────────────────────────────────────────────
function PriceCompareSection({ groceryList, settings, addCost, priceListResults, setPriceListResults }) {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const result = priceListResults;

  const compare = async () => {
    if (!groceryList.length) return;
    setLoading(true); setError("");

    const items = groceryList.map(i => i.name).join(", ");
    const zip   = settings.zipCode || "44691";

    try {
      const data = await callClaude({
        maxTokens: 400,
        messages: [{
          role: "user",
          content: `Based on typical grocery prices near Wooster OH (zip ${zip}), estimate total basket cost for: ${items}. Compare Walmart, Meijer, Aldi, Marc's, Buehler's. Top 3 by lowest total. Flag 2-3 biggest savings. Return ONLY JSON: {"stores":[{"name":"","estimatedTotal":0,"note":""}],"biggestSavings":[{"item":"","bestStore":"","bestPrice":0,"vs":"","vsPrice":0}]}`,
        }],
      });

      const text   = extractText(data.content);
      const parsed = parseJSON(text);
      setPriceListResults(parsed);
      addCost("priceList");
    } catch {
      setError("Could not load price comparison. Try again.");
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
      h("div", { className: "muted text-xs", style: { marginBottom: 10 } },
        "Estimates based on typical Wooster-area prices. Not live data — verify before shopping.",
      ),

      // Show results with X to clear
      result
        ? h("div", null,
            h("div", { className: "flex-between mb-8" },
              h("div", { className: "price-disclaimer", style: { margin: 0 } }, "* Estimates only"),
              h("button", {
                onClick: () => setPriceListResults(null),
                style: { background: "none", border: "none", cursor: "pointer", color: "#7A6A55", fontSize: 18, lineHeight: 1 },
                title: "Clear results",
              }, "×"),
            ),
            (result.stores || []).map((s, i) =>
              h("div", { key: i, style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #F0E6D3" } },
                h("div", { className: `price-rank ${i === 0 ? "price-rank-1" : "price-rank-n"}` }, i + 1),
                h("div", { style: { flex: 1 } },
                  h("div", { className: "font-bold", style: { fontSize: 14 } }, s.name),
                  s.note && h("div", { className: "muted text-sm" }, s.note),
                ),
                h("div", { className: "accent font-bold", style: { fontSize: 16 } }, fmt$(s.estimatedTotal)),
              )
            ),
            result.biggestSavings?.length > 0 && h("div", { style: { marginTop: 12 } },
              h("div", { className: "grocery-section-label mb-6" }, "🏷 Biggest Savings"),
              result.biggestSavings.map((s, i) =>
                h("div", { key: i, style: { fontSize: 13, padding: "6px 0", borderBottom: "1px solid #F0E6D3" } },
                  h("span", { className: "font-bold" }, s.item), ": ",
                  s.bestStore, " ",
                  h("span", { className: "accent font-bold" }, fmt$(s.bestPrice)),
                  " vs ", s.vs, " ", fmt$(s.vsPrice),
                )
              ),
            ),
          )
        : h(Btn, {
            label: loading ? "Comparing…" : "Compare Full List",
            icon: "🔍",
            onClick: compare,
            disabled: loading || !groceryList.length,
            className: "btn-full",
          }),

      error && h("div", { className: "warn text-sm mt-8" }, error),
    ),
  );
}
