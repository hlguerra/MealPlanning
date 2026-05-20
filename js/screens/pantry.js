// ── js/screens/pantry.js ──────────────────────────────────────────────────────
window.APP = window.APP || {};
const { createElement: h, useState } = React;
const { Btn, Card, SectionHeader, EmptyState } = window.APP;
const { uid, callClaude, extractText, parseJSON } = window.APP.utils;
const { categorize } = window.APP;
const { SECTIONS } = window.APP;

// ── PantryScreen ──────────────────────────────────────────────────────────────
window.APP.PantryScreen = function({ pantry, setPantry, addCost }) {
  const [input,   setInput]   = useState("");
  const [suggest, setSuggest] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  // ── Item actions (no PIN required) ─────────────────────────────────────────
  const addItem = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const section = categorize(trimmed);
    setPantry(p => [...p, { id: uid(), name: trimmed, section }]);
    setInput("");
  };

  const removeItem = id => setPantry(p => p.filter(i => i.id !== id));

  // ── AI suggestions ──────────────────────────────────────────────────────────
  const getSuggestions = async () => {
    if (!pantry.length) return;
    setLoading(true); setSuggest([]); setError("");

    try {
      const data = await callClaude({
        maxTokens: 700,
        messages: [{
          role: "user",
          content: `I have these ingredients on hand: ${pantry.map(p => p.name).join(", ")}.
Suggest 4 practical meals I can make (or mostly make) with what I have.
Return ONLY a valid JSON array, no markdown fences:
[{"name":"","canMakeWith":[""],"missing":[""],"notes":""}]`,
        }],
      });

      const text   = extractText(data.content);
      const parsed = parseJSON(text);
      setSuggest(parsed);
      addCost("pantry");
    } catch {
      setError("Could not load suggestions. Check your connection and try again.");
    }
    setLoading(false);
  };

  // ── Grouping ────────────────────────────────────────────────────────────────
  const grouped = SECTIONS.reduce((acc, s) => {
    const items = pantry.filter(i => i.section === s);
    if (items.length) acc[s] = items;
    return acc;
  }, {});

  // ── Render ──────────────────────────────────────────────────────────────────
  return h("div", null,
    h(SectionHeader, { title: "Pantry & Fridge" }),

    // ── Add item ──────────────────────────────────────────────────────────────
    h(Card, { style: { marginBottom: 16 } },
      h("div", { className: "flex gap-8" },
        h("input", {
          className: "form-input",
          style: { flex: 1 },
          value: input,
          onChange: e => setInput(e.target.value),
          onKeyDown: e => e.key === "Enter" && addItem(),
          placeholder: "Add item… (e.g. chicken thighs, rice)",
        }),
        h(Btn, { label: "Add", onClick: addItem, style: { flexShrink: 0, marginRight: 4 } }),
      ),
    ),

    // ── What can I make button ────────────────────────────────────────────────
    h(Btn, {
      label: loading ? "Finding meals…" : "✨ What can I make?",
      variant: "sky",
      onClick: getSuggestions,
      disabled: loading || !pantry.length,
      className: "btn-full",
      style: { marginBottom: 16 },
    }),

    // ── Suggestions ───────────────────────────────────────────────────────────
    suggest.length > 0 && h("div", { style: { marginBottom: 20 } },
      suggest.map((s, i) =>
        h(Card, { key: i, style: { marginBottom: 10 } },
          h("div", { className: "font-bold", style: { fontSize: 15, marginBottom: 4 } }, s.name),
          h("div", { className: "accent text-sm", style: { marginBottom: 2 } },
            "✓ Have: ", s.canMakeWith?.join(", "),
          ),
          s.missing?.length > 0 && h("div", { className: "warn text-sm", style: { marginBottom: 2 } },
            "Still need: ", s.missing.join(", "),
          ),
          s.notes && h("div", { className: "muted text-sm italic" }, s.notes),
        )
      ),
    ),

    error && h("div", { className: "warn text-sm", style: { marginBottom: 16 } }, error),

    // ── Empty state ───────────────────────────────────────────────────────────
    !pantry.length && h(EmptyState, {
      icon: "🥫",
      title: "Pantry is empty",
      sub: "Add items to track what you have on hand",
    }),

    // ── Grouped inventory ─────────────────────────────────────────────────────
    Object.entries(grouped).map(([section, items]) =>
      h("div", { key: section, style: { marginBottom: 14 } },
        h("div", { className: "grocery-section-label" }, section),
        items.map(item =>
          h("div", { key: item.id, style: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #F0E6D3" } },
            h("span", { style: { flex: 1, fontSize: 14 } }, item.name),
            h("button", {
              onClick: () => removeItem(item.id),
              style: { background: "none", border: "none", cursor: "pointer", color: "#C0392B", fontSize: 18, opacity: 0.5 },
              title: "Remove item",
            }, "×"),
          )
        ),
      )
    ),
  );
};
