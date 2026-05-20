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

// ── SmallDivider ──────────────────────────────────────────────────────────────
window.APP.Divider = function() {
  return h("div", { style: { borderBottom: "1px solid #F0E6D3", margin: "0" } });
};
