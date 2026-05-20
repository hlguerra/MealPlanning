// ── js/components/nav.js ──────────────────────────────────────────────────────
window.APP = window.APP || {};
const { createElement: h } = React;

const NAV_ITEMS = [
  { id: "home",     label: "Home",      icon: "🏠" },
  { id: "recipes",  label: "Recipes",   icon: "📖" },
  { id: "plan",     label: "Meal Plan", icon: "🗓" },
  { id: "grocery",  label: "Grocery",   icon: "🛒" },
  { id: "pantry",   label: "Pantry",    icon: "🥫" },
  { id: "settings", label: "Settings",  icon: "⚙️" },
];

window.APP.BottomNav = function({ active, onNav }) {
  return h("nav", { className: "bottom-nav" },
    NAV_ITEMS.map(n =>
      h("button", {
        key: n.id,
        className: `nav-btn ${active === n.id ? "active" : ""}`,
        onClick: () => onNav(n.id),
        "aria-label": n.label,
      },
        h("span", { className: "nav-icon" }, n.icon),
        h("span", { className: "nav-label" }, n.label),
      )
    ),
  );
};
