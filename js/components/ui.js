// ── js/components/ui.js ───────────────────────────────────────────────────────
// Reusable UI primitives used across all screens.
// All components are attached to window.APP for global access.

window.APP = window.APP || {};
const { createElement: h, useState } = React;

// ── Banner ────────────────────────────────────────────────────────────────────
window.APP.Banner = function({ banner }) {
  if (!banner) return null;
  return h("div", {
    key: banner.id,
    className: `banner banner-${banner.type}`,
  }, banner.message);
};

// ── PinModal ──────────────────────────────────────────────────────────────────
window.APP.PinModal = function({ pin, onSuccess, onCancel }) {
  const [val, setVal] = useState("");
  const [err, setErr] = useState(false);

  const submit = () => {
    if (val === pin) {
      onSuccess();
    } else {
      setErr(true);
      setVal("");
      setTimeout(() => setErr(false), 1200);
    }
  };

  return h("div", { className: "pin-overlay" },
    h("div", { className: "pin-modal" },
      h("div", { className: "font-serif", style: { fontSize: 22, fontWeight: 700, marginBottom: 6 } }, "Enter PIN"),
      h("div", { className: "muted text-sm", style: { marginBottom: 20 } }, "Required to complete this action."),
      h("input", {
        type: "password",
        value: val,
        onChange: e => setVal(e.target.value),
        onKeyDown: e => e.key === "Enter" && submit(),
        placeholder: "····",
        autoFocus: true,
        style: {
          width: "100%", padding: "12px 14px", borderRadius: 10,
          border: `2px solid ${err ? "#C0392B" : "#F0E6D3"}`,
          fontSize: 20, letterSpacing: 8, outline: "none", boxSizing: "border-box",
          fontFamily: "'DM Sans', sans-serif",
        },
      }),
      err && h("div", { className: "warn text-sm", style: { marginTop: 6 } }, "Incorrect PIN"),
      h("div", { className: "flex gap-10", style: { marginTop: 18 } },
        h(window.APP.Btn, { label: "Cancel", variant: "ghost", onClick: onCancel, style: { flex: 1 } }),
        h(window.APP.Btn, { label: "Confirm", onClick: submit, style: { flex: 1 } }),
      ),
    ),
  );
};

// ── Btn ───────────────────────────────────────────────────────────────────────
window.APP.Btn = function({ label, onClick, variant = "primary", style = {}, icon, disabled, className = "" }) {
  return h("button", {
    className: `btn btn-${variant} ${className}`,
    style,
    onClick: disabled ? undefined : onClick,
    disabled,
  },
    icon && h("span", null, icon),
    label,
  );
};

// ── Tag ───────────────────────────────────────────────────────────────────────
window.APP.Tag = function({ label, color, textColor, onRemove }) {
  const style = {};
  if (color)     style.background = color;
  if (textColor) style.color      = textColor;
  return h("span", { className: "tag", style },
    label,
    onRemove && h("button", { className: "tag-remove", onClick: onRemove, type: "button" }, "×"),
  );
};

// ── Card ──────────────────────────────────────────────────────────────────────
window.APP.Card = function({ children, style = {}, className = "", onClick }) {
  return h("div", { className: `card ${className}`, style, onClick }, children);
};

// ── SectionHeader ─────────────────────────────────────────────────────────────
window.APP.SectionHeader = function({ title, action }) {
  return h("div", { className: "section-header" },
    h("h2", { className: "section-title" }, title),
    action || null,
  );
};

// ── FormGroup / Input ─────────────────────────────────────────────────────────
window.APP.Input = function({ label, value, onChange, type = "text", placeholder = "", style = {}, multiline, rows = 3 }) {
  return h("div", { className: "form-group" },
    label && h("label", { className: "form-label" }, label),
    multiline
      ? h("textarea", { className: "form-input form-textarea", value, onChange: e => onChange(e.target.value), placeholder, rows, style })
      : h("input",    { className: "form-input", type, value, onChange: e => onChange(e.target.value), placeholder, style }),
  );
};

// ── AmountInput ───────────────────────────────────────────────────────────────
// An amount box that takes fractions the way recipes write them: "1/2", "1 1/2",
// "½" or "1.5". Shows stored amounts as fractions (0.5 → "1/2"). onChange gets a
// plain decimal string ("1.5"), or "" when cleared, so callers parse it as before;
// half-typed text like "1/" just waits until it's a number.
window.APP.AmountInput = function({ value, onChange, unit = "", className = "form-input-sm", style, placeholder = "Amt", onKeyDown, autoFocus, title }) {
  const { fmtAmount, parseAmount } = window.APP.utils;
  const shown = v => v === "" || v == null ? "" : fmtAmount(v, unit);
  const [text, setText] = React.useState(() => shown(value));
  // Follow changes made elsewhere (scaling, reset after Add) without fighting the typing
  React.useEffect(() => {
    const cur = parseAmount(text);
    const next = value === "" || value == null ? null : parseAmount(value);
    if (cur !== next && !(text.trim() && cur === null && next === null)) setText(shown(value));
  }, [value]); // eslint-disable-line
  return h("input", {
    className, style, placeholder, onKeyDown, autoFocus, title,
    type: "text", autoComplete: "off", value: text,
    onChange: e => {
      const t = e.target.value;
      setText(t);
      if (!t.trim()) return onChange("");
      const n = parseAmount(t);
      if (n !== null) onChange(String(+n.toFixed(4)));
    },
    onBlur: () => { const n = parseAmount(text); setText(n === null ? (text.trim() ? text : "") : fmtAmount(n, unit)); },
  });
};

// ── Select ────────────────────────────────────────────────────────────────────
window.APP.Select = function({ label, value, onChange, options, style = {} }) {
  return h("div", { className: "form-group" },
    label && h("label", { className: "form-label" }, label),
    h("select", { className: "form-input form-select", value, onChange: e => onChange(e.target.value), style },
      h("option", { value: "" }, "— select —"),
      options.map(o => h("option", { key: o, value: o }, o)),
    ),
  );
};

// ── IngredientSelect ────────────────────────────────────────────────────────────
// Search-to-select against your standard ingredient list. Type to filter; tap a
// match to select it, or tap "+ Add '<x>' as new ingredient" to create one.
// Unlike IngredientAutocomplete, this always resolves to a real standard-list id
// (selectedId), so matching/combining downstream is exact, not fuzzy.
window.APP.IngredientSelect = function({ ingredients = [], selectedId, onSelect, onAddNew, placeholder = "Search ingredient…", flagged }) {
  const [query, setQuery] = useState("");
  const [open,  setOpen]  = useState(false);
  const selected = ingredients.find(i => i.id === selectedId);

  const q = query.trim().toLowerCase();
  const matches = q.length < 1 ? ingredients.slice(0, 8) : ingredients.filter(i => i.name.toLowerCase().includes(q)).slice(0, 8);
  const exactMatch = ingredients.some(i => i.name.toLowerCase() === q);

  const pick = ing => { onSelect(ing); setQuery(""); setOpen(false); };
  const addNew = () => {
    const name = query.trim();
    if (!name) return;
    const created = onAddNew(name);
    if (created) pick(created);
  };

  return h("div", { style: { position: "relative", flex: 1 } },
    (selected && !open)
      ? h("div", {
          className: "form-input-sm",
          style: {
            display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer",
            background: flagged ? "#FFF6E8" : "#fff", borderColor: flagged ? "#E8B84B" : undefined,
          },
          onClick: () => { setOpen(true); setQuery(""); },
        },
          h("span", null, selected.name),
          h("span", { style: { fontSize: 10, color: "#B0A48C" } }, "change"),
        )
      : h("input", {
          className: "form-input-sm",
          value: query,
          onChange: e => { setQuery(e.target.value); setOpen(true); },
          onFocus: () => setOpen(true),
          onBlur: () => setTimeout(() => setOpen(false), 150), // allow click on option
          placeholder,
          style: { width: "100%" },
        }),
    open && h("div", {
      style: {
        position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20,
        background: "#fff", border: "1.5px solid #F0E6D3", borderRadius: 8,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)", marginTop: 2, maxHeight: 200, overflowY: "auto",
      },
    },
      matches.map(ing =>
        h("div", {
          key: ing.id,
          onMouseDown: () => pick(ing),
          style: { padding: "8px 10px", fontSize: 13, cursor: "pointer", borderBottom: "1px solid #F5EEE0" },
        }, ing.name)
      ),
      query.trim() && !exactMatch && h("div", {
        onMouseDown: addNew,
        style: { padding: "8px 10px", fontSize: 13, cursor: "pointer", color: "#2A7D4F", fontWeight: 600 },
      }, `+ Add "${query.trim()}" as new ingredient`),
      !query.trim() && matches.length === 0 && h("div", { style: { padding: "8px 10px", fontSize: 12, color: "#B0A48C" } }, "Type to search…"),
    ),
  );
};

// ── IngredientAutocomplete ─────────────────────────────────────────────────────
// Text input with a dropdown of matching known ingredient names, built from
// whatever names you've already used across recipes/pantry/grocery (passed in
// via `knownNames`). No external ingredient database — it grows as you use the app.
window.APP.IngredientAutocomplete = function({ value, onChange, knownNames = [], placeholder = "Ingredient name", style = {}, onEnter }) {
  const [open, setOpen] = useState(false);
  const { normalizeIngName } = window.APP.utils;

  const q = value.trim().toLowerCase();
  const matches = q.length < 2 ? [] : [...new Set(knownNames)]
    .filter(n => n.toLowerCase() !== q && n.toLowerCase().includes(q))
    .slice(0, 6);

  const pick = name => { onChange(name); setOpen(false); };

  return h("div", { style: { position: "relative", flex: 1, ...style } },
    h("input", {
      className: "form-input-sm",
      value,
      onChange: e => { onChange(e.target.value); setOpen(true); },
      onFocus: () => setOpen(true),
      onBlur: () => setTimeout(() => setOpen(false), 150), // allow click on option
      onKeyDown: e => e.key === "Enter" && onEnter && onEnter(),
      placeholder,
      style: { width: "100%" },
    }),
    open && matches.length > 0 && h("div", {
      style: {
        position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20,
        background: "#fff", border: "1.5px solid #F0E6D3", borderRadius: 8,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)", marginTop: 2, maxHeight: 180, overflowY: "auto",
      },
    },
      matches.map(n =>
        h("div", {
          key: n,
          onMouseDown: () => pick(n), // mousedown fires before input's onBlur
          style: { padding: "8px 10px", fontSize: 13, cursor: "pointer", borderBottom: "1px solid #F5EEE0" },
        }, n)
      ),
    ),
  );
};

// ── PillToggle ────────────────────────────────────────────────────────────────
// Multi-select pill group.
window.APP.PillToggle = function({ options, selected, onToggle }) {
  return h("div", { className: "pill-toggle" },
    options.map(o =>
      h("button", {
        key: o,
        type: "button",
        className: `pill ${selected.includes(o) ? "active" : ""}`,
        onClick: () => onToggle(o),
      }, o)
    ),
  );
};

// ── ModeToggle ────────────────────────────────────────────────────────────────
// Single-select segmented control (e.g. Online / In-Store / Both).
window.APP.ModeToggle = function({ value, onChange, options }) {
  return h("div", { className: "mode-toggle" },
    options.map(o =>
      h("button", {
        key: o,
        type: "button",
        className: `mode-btn ${value === o ? "active" : ""}`,
        onClick: () => onChange(o),
      }, o)
    ),
  );
};

// ── MealIcon ──────────────────────────────────────────────────────────────────
// Outline icons for meal types (sunrise / sun / moon). Drawn in currentColor,
// so they pick up the surrounding text color (e.g. orange on an active button).
const MEAL_ICON_PATHS = {
  Breakfast: ["M3 18h18", "M7 18a5 5 0 0 1 10 0", "M12 6v3", "M5.6 10.6 7 12", "M18.4 10.6 17 12", "M2 14.5h2", "M20 14.5h2", "M9 21h6"],
  Lunch:     ["M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z", "M12 2v2", "M12 20v2", "M2 12h2", "M20 12h2", "M4.9 4.9l1.4 1.4", "M17.7 17.7l1.4 1.4", "M4.9 19.1l1.4-1.4", "M17.7 6.3l1.4-1.4"],
  Dinner:    ["M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"],
};
window.APP.MealIcon = function({ type, size = 18, style = {} }) {
  const paths = MEAL_ICON_PATHS[type] || MEAL_ICON_PATHS.Dinner;
  return h("svg", {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
    strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", "aria-label": type, role: "img",
    style: { display: "inline-block", verticalAlign: "-0.2em", flexShrink: 0, ...style },
  }, paths.map((d, i) => h("path", { key: i, d })));
};

// ── CollapsibleSection ────────────────────────────────────────────────────────
window.APP.CollapsibleSection = function({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return h("div", null,
    h("button", { className: "collapsible-toggle", onClick: () => setOpen(v => !v), type: "button" },
      h("span", { className: "font-bold font-serif", style: { fontSize: 14 } }, title),
      h("span", { className: "muted", style: { fontSize: 18 } }, open ? "▲" : "▼"),
    ),
    open && h("div", { style: { marginTop: 12 } }, children),
  );
};

// ── EmptyState ────────────────────────────────────────────────────────────────
window.APP.EmptyState = function({ icon, title, sub }) {
  return h("div", { className: "empty-state" },
    h("div", { className: "empty-icon" }, icon),
    h("div", { className: "empty-title" }, title),
    sub && h("div", { className: "empty-sub" }, sub),
  );
};

// ── SectionSelect ─────────────────────────────────────────────────────────────
// Store-section dropdown for an item's edit row. Takes a full line so it wraps
// under the name/amount inputs on a phone.
window.APP.SectionSelect = function({ value, onChange }) {
  return h("label", { className: "flex gap-6 text-xs muted", style: { flexBasis: "100%", alignItems: "center" } },
    "Section",
    h("select", {
      className: "form-input-sm",
      style: { flex: 1 },
      value: value || "Other",
      onChange: e => onChange(e.target.value),
    }, window.APP.SECTIONS.map(s => h("option", { key: s, value: s }, s))),
  );
};

// ── SmallDivider ──────────────────────────────────────────────────────────────
window.APP.Divider = function() {
  return h("div", { style: { borderBottom: "1px solid #F0E6D3", margin: "0" } });
};
