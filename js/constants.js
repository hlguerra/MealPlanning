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
  "Spices & Seasonings",
  "Condiments & Sauces",
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
  "Drink",
  "Sauce/Dressing",
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

// ── Ingredient quantity units ─────────────────────────────────────────────────
// Grouped by type so amounts can only be auto-combined/converted within the
// same type (volume with volume, weight with weight). "count" covers whole
// items (e.g. "3 onions") and has no conversion. Leave unit blank for
// non-quantifiable items like "salt to taste".
window.APP.UNITS = [
  "tsp", "tbsp", "fl oz", "cup", "pint", "quart", "gallon", "ml", "l",
  "oz", "lb", "g", "kg",
  "count", "can", "clove", "pinch",
];

// Conversion factor to a base unit within each type (ml for volume, g for weight).
// count has no base — same-unit only.
window.APP.UNIT_INFO = {
  tsp:      { type: "volume", toBase: 4.92892 },
  tbsp:     { type: "volume", toBase: 14.7868 },
  "fl oz":  { type: "volume", toBase: 29.5735 },
  cup:      { type: "volume", toBase: 236.588 },
  pint:     { type: "volume", toBase: 473.176 },
  quart:    { type: "volume", toBase: 946.353 },
  gallon:   { type: "volume", toBase: 3785.41 },
  ml:       { type: "volume", toBase: 1 },
  l:        { type: "volume", toBase: 1000 },
  oz:       { type: "weight", toBase: 28.3495 },
  lb:       { type: "weight", toBase: 453.592 },
  g:        { type: "weight", toBase: 1 },
  kg:       { type: "weight", toBase: 1000 },
  count:    { type: "count",  toBase: 1 },
  can:      { type: "can",    toBase: 1 }, // only matches other cans — lets "1 can" receipt prices price "1 can" in a recipe
};

// ── Weight of one cup (grams) ─────────────────────────────────────────────────
// Lets cups convert to and from oz/lb/g for a given ingredient (a 10 lb bag of
// flour vs. "2 cups flour"). Matched on the END of the ingredient name, longest
// first: "brown sugar" beats "sugar", "all-purpose flour" uses "flour", but
// "rice vinegar" doesn't use "rice". Your own entries in Settings → Ingredient
// weights win over these. Values are typical spooned/leveled US measures.
window.APP.WEIGHT_PER_CUP = {
  // Flours & starches
  "flour": 120, "all-purpose flour": 120, "bread flour": 127, "cake flour": 113, "pastry flour": 106,
  "whole wheat flour": 113, "self-rising flour": 113, "almond flour": 96, "coconut flour": 112,
  "oat flour": 92, "rice flour": 158, "cornmeal": 138, "cornstarch": 112, "masa harina": 116,
  // Sugars & syrups
  "sugar": 200, "granulated sugar": 200, "white sugar": 200, "cane sugar": 200, "brown sugar": 213,
  "light brown sugar": 213, "dark brown sugar": 213, "powdered sugar": 113, "confectioners sugar": 113,
  "honey": 336, "maple syrup": 312, "molasses": 337, "corn syrup": 328, "agave": 336,
  // Fats
  "butter": 227, "margarine": 227, "shortening": 184, "oil": 200, "olive oil": 200, "vegetable oil": 198,
  "canola oil": 198, "coconut oil": 200, "lard": 205,
  // Dairy & liquids
  "water": 236, "milk": 242, "buttermilk": 242, "heavy cream": 238, "whipping cream": 238, "half and half": 242,
  "sour cream": 227, "yogurt": 227, "greek yogurt": 227, "cream cheese": 227, "ricotta": 246,
  "cottage cheese": 225, "evaporated milk": 252, "sweetened condensed milk": 306, "coconut milk": 240,
  "broth": 236, "stock": 236, "juice": 236, "wine": 236,
  // Cheese
  "cheese": 113, "shredded cheese": 113, "cheddar": 113, "cheddar cheese": 113, "mozzarella": 113,
  "mozzarella cheese": 113, "parmesan": 100, "parmesan cheese": 100, "feta": 150, "feta cheese": 150,
  // Grains, pasta & dry goods
  "rice": 185, "white rice": 185, "brown rice": 190, "jasmine rice": 185, "basmati rice": 185,
  "quinoa": 170, "rolled oat": 89, "oat": 89, "old fashioned oat": 89, "quick oat": 80, "steel cut oat": 160,
  "lentil": 192, "dried lentil": 192, "dry bean": 180, "split pea": 200, "couscous": 173, "orzo": 170,
  "elbow macaroni": 105, "macaroni": 105, "breadcrumb": 112, "panko": 50, "granola": 113,
  // Baking add-ins
  "chocolate chip": 170, "cocoa powder": 84, "cocoa": 84, "shredded coconut": 85, "coconut flake": 85,
  "raisin": 149, "dried cranberry": 120, "walnut": 113, "pecan": 113, "almond": 142, "sliced almond": 86,
  "peanut": 142, "cashew": 128, "peanut butter": 270, "almond butter": 256,
  // Seasonings (bought by weight, measured by spoon)
  "salt": 288, "table salt": 288,
  // Condiments
  "mayonnaise": 220, "mayo": 220, "ketchup": 270, "salsa": 260, "tomato sauce": 245, "tomato paste": 262,
  "crushed tomato": 240, "diced tomato": 240, "marinara sauce": 250, "pasta sauce": 250, "soy sauce": 255,
  // Produce & frozen
  "onion": 160, "chopped onion": 160, "spinach": 30, "baby spinach": 30, "carrot": 128, "shredded carrot": 110,
  "celery": 101, "bell pepper": 150, "mushroom": 70, "broccoli": 91, "pea": 145, "frozen pea": 145, "corn": 145,
  "blueberry": 148, "strawberry": 166, "raspberry": 123, "cabbage": 89, "kale": 67,
  "black bean": 172, "kidney bean": 177, "chickpea": 164, "pinto bean": 171,
};

// ── Weight of one item (grams) ────────────────────────────────────────────────
// For things counted whole ("2 onions", "3 eggs") so they convert to and from
// weight (a 3 lb bag of onions). Typical medium sizes. Matched like WEIGHT_PER_CUP.
window.APP.WEIGHT_PER_EACH = {
  // Produce
  "onion": 150, "red onion": 150, "yellow onion": 150, "white onion": 150, "sweet onion": 200, "shallot": 40,
  "potato": 213, "russet potato": 213, "red potato": 150, "yukon gold potato": 150, "sweet potato": 130,
  "carrot": 61, "celery": 40, "celery stalk": 40, "bell pepper": 120, "jalapeno": 14, "jalapeño": 14, "poblano": 80,
  "tomato": 123, "roma tomato": 62, "zucchini": 196, "yellow squash": 196, "cucumber": 300, "eggplant": 450,
  "lemon": 84, "lime": 67, "orange": 131, "apple": 182, "banana": 118, "pear": 178, "peach": 150, "mango": 336,
  "avocado": 170, "head of lettuce": 600, "lettuce": 600, "romaine": 600, "romaine heart": 250,
  "cabbage": 900, "cauliflower": 575, "broccoli": 300, "broccoli crown": 225, "mushroom": 18, "corn": 100,
  "ear of corn": 100, "green onion": 15, "scallion": 15, "leek": 90, "garlic bulb": 50, "head of garlic": 50,
  // Proteins & dairy
  "egg": 50, "large egg": 50, "chicken breast": 225, "chicken thigh": 115, "chicken drumstick": 110,
  "pork chop": 200, "sausage": 85, "bratwurst": 85, "hot dog": 45, "salmon fillet": 170, "tilapia fillet": 115,
  // Bakery
  "tortilla": 45, "flour tortilla": 45, "corn tortilla": 26, "burger bun": 60, "hot dog bun": 45, "english muffin": 57,
  "bagel": 100, "pita": 60, "naan": 90,
};

// ── Contents of one can (grams, net weight) ───────────────────────────────────
// Standard US can sizes, so "1 can" converts to and from oz/lb/g (and cups,
// through WEIGHT_PER_CUP) — "14 oz black beans" against a can in the pantry.
window.APP.WEIGHT_PER_CAN = {
  "bean": 425, "black bean": 425, "kidney bean": 425, "pinto bean": 425, "cannellini bean": 425,
  "great northern bean": 425, "navy bean": 425, "chickpea": 425, "garbanzo bean": 425, "baked bean": 454,
  "refried bean": 454, "chili": 425,
  "tomato": 411, "diced tomato": 411, "crushed tomato": 411, "whole tomato": 411, "stewed tomato": 411,
  "tomato sauce": 425, "tomato paste": 170, "rotel": 283, "diced tomatoes and green chile": 283,
  "corn": 432, "green bean": 411, "pea": 425, "carrot": 411, "pumpkin": 425, "pumpkin puree": 425,
  "coconut milk": 400, "evaporated milk": 354, "sweetened condensed milk": 397,
  "tuna": 142, "chicken": 354, "salmon": 418,
  "broth": 411, "chicken broth": 411, "beef broth": 411, "vegetable broth": 411,
  "cream of mushroom soup": 298, "cream of chicken soup": 298, "condensed soup": 298, "soup": 298,
  "green chile": 113, "diced green chile": 113, "chipotle": 198, "chipotle in adobo": 198, "enchilada sauce": 283,
  "pineapple": 567, "peach": 432, "pear": 432, "mandarin orange": 312, "olive": 170, "artichoke heart": 397,
};

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
  recipeGen:   0.02,   // ~6K input tokens (generate recipe from meal name)
  receiptScan: 0.05,   // ~image tokens + prompt; varies with receipt length/photo size
  recipePhotoScan: 0.06, // up to 4 page images + prompt + full recipe JSON out; estimate, recalibrate after real use
  tagAudit:    0.03,   // ~10K input tokens at current recipe count — scales with library size, revisit if recipes grow well past 100
};

// ── Default app settings ──────────────────────────────────────────────────────
window.APP.DEFAULT_SETTINGS = {
  householdName:      "Haley's Meal Planning",
  pin:                "1234",
  people:             2,
  defaultMealTypes:   ["Dinner"],
  defaultProteins:    [],
  days:               7,
  keywords:           [],
  zipCode:            "44691",
  googleSheetsUrl:    "",
  householdId:        "",
  voters:             ["Haley", "Partner"], // who votes on This Week's Picks
  // Other names for the same ingredient, so they match and combine (aka is comma-separated)
  ingredientAliases:  [
    { name: "pepper", aka: "black pepper" },
    { name: "garlic", aka: "garlic clove, clove garlic, clove of garlic" },
  ],
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
      { id:"i12", name:"Taco seasoning",         amount:2,   unit:"tbsp", section:"Spices & Seasonings" },
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
  { id:"s5", name:"Salt & pepper", section:"Spices & Seasonings" },
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
window.APP.FETCH_PAGE_URL = "https://us-central1-meal-planner-5df26.cloudfunctions.net/fetchRecipePage";
window.APP.API_MODEL     = "claude-sonnet-4-6";
window.APP.API_MAX_TOKENS = 1500;
