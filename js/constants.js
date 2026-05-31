// ── js/constants.js ───────────────────────────────────────────────────────────
// All static lists, seed data, and default config live here.
// Edit this file to add cuisines, proteins, appliances, or change defaults.

window.APP = window.APP || {};

// ── Store sections (grocery list categories) ──────────────────────────────────
window.APP.SECTIONS = [
  "Produce",
  "Meat & Seafood",
  "Dairy & Eggs",
  "Bakery & Bread",
  "Frozen",
  "Pantry & Dry Goods",
  "Canned Goods",
  "Beverages",
  "Snacks",
  "Household",
  "Other",
];

// ── Recipe course types ───────────────────────────────────────────────────────
window.APP.COURSES = [
  "Breakfast",
  "Appetizer",
  "Main",
  "Side",
  "Dessert",
  "Snack",
];

// ── Protein types ─────────────────────────────────────────────────────────────
window.APP.PROTEINS = [
  "Beef",
  "Chicken",
  "Pork",
  "Turkey",
  "Fish",
  "Seafood",
  "Tofu",
  "Legumes",
  "Vegetarian",
  "Vegan",
  "Other",
];

// ── Meal types ────────────────────────────────────────────────────────────────
window.APP.MEAL_TYPES = ["Breakfast", "Lunch", "Dinner"];

window.APP.MEAL_ICONS = {
  Breakfast: "🌅",
  Lunch:     "☀️",
  Dinner:    "🌙",
};

// ── Kitchen appliances ────────────────────────────────────────────────────────
window.APP.APPLIANCES = [
  "Flat Top Grill",
  "Outdoor Grill / BBQ",
  "Griddle",
  "Air Fryer",
  "Panini Press",
  "Waffle Iron",
  "Toaster Oven",
  "Rice Cooker",
  "Pressure Cooker",
  "Slow Cooker",
  "Oven",
  "Stovetop",
  "Microwave",
];

// ── Estimated API cost per feature call (USD) ─────────────────────────────────
// Based on real-world observed usage — recalibrated May 2026.
// claude-sonnet-4-6 pricing: $3/MTok input, $15/MTok output.
// These are conservative estimates — actual cost may be slightly lower.
window.APP.COST_PER_CALL = {
  mealPlan:    0.05,   // ~15K input tokens with recipes + prompt
  recipeImport:0.02,   // ~6K input tokens
  pantry:      0.01,   // ~3K input tokens
  priceSearch: 0.02,   // ~6K input tokens (no web search)
  priceList:   0.03,   // ~10K input tokens (no web search)
};

// ── Default app settings ──────────────────────────────────────────────────────
window.APP.DEFAULT_SETTINGS = {
  householdName:      "Haley's Meal Planning",
  pin:                "1234",
  people:             2,
  defaultMealTypes:   ["Dinner"],
  defaultProteins:    [],
  zipCode:            "44691",
  googleSheetsUrl:    "",
  householdId:        "",
};

// ── Default appliances ────────────────────────────────────────────────────────
window.APP.DEFAULT_APPLIANCES = [
  "Flat Top Grill",
  "Air Fryer",
  "Panini Press",
];

// ── Seed recipes ──────────────────────────────────────────────────────────────
window.APP.SEED_RECIPES = [
  {
    id:            "r1",
    name:          "Flat Top Smash Burgers",
    course:        "Main",
    proteins:      ["Beef"],
    tags:          ["quick", "family favorite"],
    appliances:    ["Flat Top Grill", "Air Fryer"],
    servings:      2,
    prepTime:      10,
    cookTime:      15,
    photo:         "",
    estimatedCost: 14.50,
    nutrition:     { calories: 680, protein: 38, carbs: 42, fat: 36 },
    ingredients: [
      { id:"i1", name:"Ground beef (80/20)", amount:1,   unit:"lb",     section:"Meat & Seafood"     },
      { id:"i2", name:"Burger buns",         amount:4,   unit:"ct",     section:"Bakery & Bread"     },
      { id:"i3", name:"American cheese",     amount:4,   unit:"slices", section:"Dairy & Eggs"       },
      { id:"i4", name:"Frozen fries",        amount:1,   unit:"bag",    section:"Frozen"             },
      { id:"i5", name:"Lettuce",             amount:1,   unit:"head",   section:"Produce"            },
      { id:"i6", name:"Tomato",              amount:1,   unit:"ct",     section:"Produce"            },
    ],
    steps: [
      "Divide beef into 4 equal balls.",
      "Heat flat top to high. Place beef balls and smash flat with a spatula.",
      "Season with salt and pepper. Cook 2 min, flip, add cheese.",
      "Toast buns on the flat top. Air fry fries at 400°F for 15 min.",
      "Assemble and serve.",
    ],
    notes: "Best with a thin smear of mayo on the bottom bun.",
  },
  {
    id:            "r2",
    name:          "Air Fryer Shrimp Tacos",
    course:        "Main",
    proteins:      ["Seafood"],
    tags:          ["quick"],
    appliances:    ["Air Fryer"],
    servings:      2,
    prepTime:      10,
    cookTime:      12,
    photo:         "",
    estimatedCost: 12.00,
    nutrition:     { calories: 520, protein: 32, carbs: 48, fat: 14 },
    ingredients: [
      { id:"i7",  name:"Frozen shrimp (peeled)", amount:1,   unit:"lb",   section:"Frozen"             },
      { id:"i8",  name:"Flour tortillas",        amount:8,   unit:"ct",   section:"Bakery & Bread"     },
      { id:"i9",  name:"Shredded cabbage",       amount:2,   unit:"cups", section:"Produce"            },
      { id:"i10", name:"Lime",                   amount:2,   unit:"ct",   section:"Produce"            },
      { id:"i11", name:"Sour cream",             amount:0.5, unit:"cup",  section:"Dairy & Eggs"       },
      { id:"i12", name:"Taco seasoning",         amount:2,   unit:"tbsp", section:"Pantry & Dry Goods" },
    ],
    steps: [
      "Toss thawed shrimp with taco seasoning and a drizzle of oil.",
      "Air fry at 400°F for 8–10 min, shaking halfway.",
      "Warm tortillas in air fryer for 1 min.",
      "Assemble tacos with shrimp, cabbage, sour cream, and a squeeze of lime.",
    ],
    notes: "Add hot sauce or avocado if you have it.",
  },
];

// ── Seed staples ──────────────────────────────────────────────────────────────
window.APP.SEED_STAPLES = [
  { id:"s1", name:"Olive oil",     section:"Pantry & Dry Goods" },
  { id:"s2", name:"Butter",        section:"Dairy & Eggs"       },
  { id:"s3", name:"Eggs (dozen)",  section:"Dairy & Eggs"       },
  { id:"s4", name:"Whole milk",    section:"Dairy & Eggs"       },
  { id:"s5", name:"Salt & pepper", section:"Pantry & Dry Goods" },
];

// ── Weekly flyer links (Wooster, OH) ──────────────────────────────────────────
window.APP.FLYER_LINKS = [
  { name: "Walmart",   url: "https://www.walmart.com/store/1812-wooster-oh/weekly-ads" },
  { name: "Meijer",    url: "https://www.meijer.com/weeklyad" },
  { name: "Aldi",      url: "https://www.aldi.us/en/weekly-specials" },
  { name: "Marc's",    url: "https://www.marcs.com/weeklyad" },
  { name: "Buehler's", url: "https://buehlers.mycircular.info/weekly-ad" },
];

// ── Anthropic API ─────────────────────────────────────────────────────────────
window.APP.API_URL       = "https://us-central1-meal-planner-5df26.cloudfunctions.net/anthropicProxy";
window.APP.API_MODEL     = "claude-sonnet-4-6";
window.APP.API_MAX_TOKENS = 1500;
