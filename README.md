# 🍽 Haley's Meal Planning

A personal meal planning and grocery management web app built with React. Runs entirely in the browser — no server, no build step, no subscription.

**Live app:** `https://hlguerra.github.io/MealPlanning`

---

## Features

- 📖 **Recipe library** — save recipes with ingredients, steps, photos, proteins, appliances, cost, and nutrition
- 🔗 **Recipe import** — paste a URL (e.g. Budget Bytes) and AI extracts the full recipe automatically
- 🗓 **AI meal planner** — generate a week of meals by day count, people, meal type, and protein. Lock meals you like and regenerate the rest
- 🛒 **Grocery list** — auto-generated from meal plans, organized by store section. No category selection needed — items are categorized automatically by keyword
- 🥫 **Pantry tracker** — track what you have on hand. Ask AI what you can make with it
- 💰 **Price comparison** — compare full grocery list or single items across stores (online, in-store, or both)
- ⚙️ **Settings** — household name, default people count, default zip code, appliance checklist, API cost tracker, PIN protection

---

## File Structure

```
haleys-meal-planner/
├── index.html              # Entry point — loads React and all modules
├── styles.css              # All styles in one file
└── js/
    ├── constants.js        # ← Edit this to change proteins, appliances, seed data, defaults
    ├── utils.js            # Pure helper functions (no UI)
    ├── categorizer.js      # ← Edit this to improve grocery auto-categorization
    ├── hooks.js            # Shared React hooks (persistence, banner, PIN, cost)
    ├── app.js              # Root component — wires everything together
    └── components/
        ├── ui.js           # Shared UI primitives (Btn, Card, Input, Tag, etc.)
        └── nav.js          # Bottom navigation bar
    └── screens/
        ├── home.js         # Home screen + quick add + price search
        ├── recipes.js      # Recipe list, detail view, edit form, URL import
        ├── mealplan.js     # AI meal planner + current plan
        ├── grocery.js      # Grocery list + staples + price comparison
        ├── pantry.js       # Pantry inventory + what-can-I-make
        └── settings.js     # All settings
```

---

## Common Edits

### Change the default household name or PIN
Open `js/constants.js` and edit `DEFAULT_SETTINGS`:
```js
window.APP.DEFAULT_SETTINGS = {
  householdName: "Haley's Meal Planning",  // ← change this
  pin:           "1234",                   // ← change this before deploying
  people:        2,
  zipCode:       "44691",                  // ← set your zip code
  ...
};
```

### Add or remove appliances
In `js/constants.js`, edit the `APPLIANCES` array:
```js
window.APP.APPLIANCES = [
  "Flat Top Grill",
  "Air Fryer",
  // add or remove items here
];
```

### Add or remove proteins
In `js/constants.js`, edit the `PROTEINS` array:
```js
window.APP.PROTEINS = [
  "Beef", "Chicken", "Pork", "Turkey",
  "Fish", "Seafood", "Tofu", "Legumes",
  "Vegetarian", "Vegan", "Other",
];
```

### Improve grocery auto-categorization
If an item lands in the wrong section, open `js/categorizer.js` and add the keyword to the right section's array. No other files need changing.

Example — if "oat creamer" is going to the wrong place, add `"oat creamer"` to the `"Dairy & Eggs"` array.

### Change the orange color
All colors are defined at the top of `styles.css`. The primary orange is `#D4622A`. Change it there and it updates everywhere.

---

## PIN Protection

The PIN is required for:
- Deleting a recipe
- Changing the PIN (requires confirming the current PIN first)

Everything else (grocery adds, deletes, clearing lists, meal plan edits, staple management, pantry) requires no PIN.

**Default PIN: `1234` — change this in `js/constants.js` before deploying.**

---

## API Usage & Cost

The app uses the [Anthropic Claude API](https://console.anthropic.com) for:

| Feature | Est. cost per use |
|---|---|
| Meal plan generation | ~$0.015 |
| Recipe URL import | ~$0.008 |
| Pantry suggestions | ~$0.005 |
| Single item price search | ~$0.010 |
| Full grocery list price compare | ~$0.015 |

Typical usage for one household: **under $2/month.**

The app tracks estimated rolling 30-day usage in Settings. Set a hard monthly spending cap in your [Anthropic dashboard](https://console.anthropic.com) under **Billing → Usage Limits** to prevent unexpected charges.

---

## Deploying Updates

After editing any file in VS Code:

```bash
git add .
git commit -m "describe what you changed"
git push
```

GitHub Pages updates automatically within ~30 seconds.

---

## Phase 2 Roadmap

These features are planned but not yet built:

- **Google Sheets sync** — shared grocery list between household members (husband can add items, you see them before shopping). API cost log stored in a private Sheet tab
- **Multi-household support** — separate household links with optional PIN. Sister gets her own household with her own recipes and lists
- **Recipe export/import** — share a recipe between households via a JSON file or link
- **Backup to GitHub** — export all recipes as a JSON file for safekeeping
- **Nutrition info lookup** — AI-powered nutrition estimates per recipe

---

## Tech Stack

- **React 18** (via CDN, no build step)
- **Babel Standalone** (transpiles JSX in the browser)
- **Anthropic Claude API** (AI features)
- **localStorage** (all data stored locally in the browser)
- **GitHub Pages** (free hosting)

No npm, no webpack, no dependencies to install. Open the folder and go.

---

## Local Development

1. Open the `haleys-meal-planner` folder in VS Code
2. Install the **Live Server** extension (by Ritwick Dey)
3. Right-click `index.html` → **Open with Live Server**
4. App opens at `http://127.0.0.1:5500`

Changes to any file are reflected immediately on save.
