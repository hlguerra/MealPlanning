// ── js/categorizer.js ─────────────────────────────────────────────────────────
// Keyword-based auto-categorization for grocery items.
// No API calls — instant, free, works offline.
// Returns one of the SECTIONS defined in constants.js.
//
// To improve accuracy, add keywords to any array below.
// More specific keywords should go in more specific sections.

window.APP = window.APP || {};

window.APP.categorize = function(name = "") {
  const s = name.toLowerCase().trim();
  if (!s) return "Other";

  // Check each section's keywords in priority order.
  // More specific sections (Meat, Frozen) are checked before general ones.
  for (const [section, keywords] of Object.entries(KEYWORD_MAP)) {
    if (keywords.some(k => s.includes(k))) return section;
  }

  return "Other";
};

// ── Keyword map ───────────────────────────────────────────────────────────────
// Keys must exactly match entries in window.APP.SECTIONS.
// Each value is an array of lowercase substrings to match against the item name.

const KEYWORD_MAP = {

  "Meat & Seafood": [
    // Beef
    "beef","ground beef","steak","brisket","chuck","ribeye","sirloin","flank",
    "skirt steak","short rib","roast","ground chuck","hamburger",
    // Poultry
    "chicken","turkey","duck","cornish hen",
    "breast","thigh","wing","drumstick","rotisserie",
    // Pork
    "pork","bacon","ham","sausage","bratwurst","hot dog","kielbasa",
    "pepperoni","salami","prosciutto","pancetta","chorizo","ribs","pork chop",
    "pork loin","pulled pork",
    // Lamb / other
    "lamb","veal","bison","venison","rabbit",
    // Deli
    "deli","cold cut","lunchmeat","lunch meat","bologna",
    // Seafood
    "salmon","tuna","tilapia","cod","halibut","mahi","bass","trout","catfish",
    "flounder","snapper","swordfish","grouper","anchovy","sardine",
    "shrimp","crab","lobster","scallop","oyster","clam","mussel","squid","octopus",
    "fish","seafood","shellfish",
    // Meat generics
    "meat","protein","filet","fillet","cutlet","tenderloin",
  ],

  "Dairy & Eggs": [
    "milk","whole milk","skim milk","2% milk","cream","heavy cream",
    "half and half","half-and-half","whipping cream","buttermilk",
    "butter","ghee","margarine",
    "cheese","cheddar","mozzarella","parmesan","parmigiano","brie","feta",
    "gouda","swiss","provolone","ricotta","cream cheese","cottage cheese",
    "colby","pepper jack","american cheese","string cheese","queso",
    "yogurt","greek yogurt","sour cream","whipped cream","cool whip",
    "egg","eggs","egg white","egg yolk",
    "dairy","lactose",
    "oat milk","almond milk","soy milk","coconut milk creamer","cashew milk",
  ],

  "Frozen": [
    "frozen","freeze","ice cream","gelato","sorbet","sherbet","popsicle",
    "frozen fries","tater tot","frozen pizza","frozen meal","tv dinner",
    "frozen vegetable","frozen fruit","frozen corn","frozen peas",
    "frozen broccoli","frozen spinach","frozen edamame",
    "frozen shrimp","frozen chicken","frozen beef","frozen fish",
    "frozen waffle","frozen pancake","frozen burrito","frozen lasagna",
    "ice cube","bag of ice",
  ],

  "Bakery & Bread": [
    "bread","sourdough","rye bread","white bread","wheat bread","multigrain",
    "whole wheat","baguette","ciabatta","focaccia","brioche",
    "bun","burger bun","hot dog bun","dinner roll","roll","slider bun",
    "bagel","english muffin","pita","naan","flatbread","lavash","tortilla",
    "wrap","flour tortilla","corn tortilla",
    "muffin","croissant","pastry","danish","scone","biscuit",
    "cake","cupcake","brownie","cookie","donut","doughnut","cinnamon roll",
    "pie crust","breadcrumb","panko","crouton","stuffing mix",
    "bakery","loaf",
  ],

  "Beverages": [
    "water","sparkling water","mineral water","seltzer","club soda",
    "juice","orange juice","apple juice","grape juice","cranberry juice",
    "lemonade","limeade","fruit punch","cider",
    "coffee","espresso","cold brew","iced coffee",
    "tea","green tea","black tea","herbal tea","iced tea","kombucha",
    "soda","cola","pepsi","coke","sprite","ginger ale","root beer",
    "energy drink","sports drink","gatorade","powerade",
    "wine","beer","ale","lager","cider","liquor","vodka","whiskey",
    "tequila","rum","gin","champagne","prosecco",
    "drink","beverage","bottle of","can of soda","sparkling",
  ],

  "Snacks": [
    "chip","potato chip","tortilla chip","pita chip","veggie chip",
    "pretzel","popcorn","rice cake","cracker","graham cracker",
    "granola bar","protein bar","energy bar","kind bar","clif bar",
    "trail mix","nut mix","mixed nuts","peanut","almond","cashew",
    "walnut","pecan","pistachio","macadamia","sunflower seed","pumpkin seed",
    "jerky","beef jerky","turkey jerky",
    "candy","chocolate","gummy","licorice","caramel","lollipop","mint",
    "fruit snack","applesauce pouch","raisin","dried fruit","fruit leather",
    "hummus","guacamole","dip","salsa cup","cheese stick","snack",
  ],

  "Canned Goods": [
    "canned","can of","cans of",
    "tomato sauce","marinara sauce","pasta sauce","tomato paste",
    "diced tomato","crushed tomato","whole tomato","stewed tomato",
    "canned bean","black bean","kidney bean","pinto bean","cannellini",
    "chickpea","garbanzo","canned corn","canned pea","canned carrot",
    "canned tuna","canned salmon","canned chicken","canned crab",
    "canned soup","condensed soup","cream of mushroom","chicken broth can",
    "beef broth can","vegetable broth can",
    "coconut milk","evaporated milk","sweetened condensed milk",
    "canned fruit","canned peach","canned pear","canned pineapple",
    "olives","artichoke heart","roasted pepper","sun-dried tomato",
    "chili","canned chili","refried bean","baked bean",
    "jar of","jarred",
  ],

  "Pantry & Dry Goods": [
    // Pasta & grains
    "pasta","spaghetti","penne","rigatoni","linguine","fettuccine","farfalle",
    "rotini","lasagna noodle","orzo","couscous","ramen","noodle",
    "rice","brown rice","white rice","jasmine rice","basmati","wild rice",
    "quinoa","farro","barley","bulgur","polenta","grits","cornmeal",
    "oat","oatmeal","rolled oat","steel cut oat","granola","cereal",
    // Baking
    "flour","all-purpose","bread flour","cake flour","almond flour",
    "sugar","brown sugar","powdered sugar","confectioner","honey","maple syrup",
    "agave","molasses","corn syrup",
    "baking soda","baking powder","yeast","cornstarch","arrowroot",
    "cocoa","cocoa powder","chocolate chip","baking chocolate","vanilla extract",
    // Oils & vinegars
    "oil","olive oil","vegetable oil","canola oil","coconut oil","sesame oil",
    "avocado oil","vinegar","apple cider vinegar","balsamic","red wine vinegar",
    // Sauces & condiments
    "ketchup","mustard","mayo","mayonnaise","relish","hot sauce","sriracha",
    "soy sauce","tamari","teriyaki","hoisin","fish sauce","oyster sauce",
    "worcestershire","tahini","peanut butter","almond butter","sunflower butter",
    "jelly","jam","preserve","peanut butter",
    "bbq sauce","buffalo sauce","ranch dressing","italian dressing",
    // Spices & seasonings
    "salt","pepper","garlic powder","onion powder","cumin","paprika","smoked paprika",
    "chili powder","cayenne","red pepper flake","oregano","basil","thyme",
    "rosemary","bay leaf","cinnamon","nutmeg","allspice","clove","ginger powder",
    "turmeric","curry powder","garam masala","italian seasoning","taco seasoning",
    "old bay","everything bagel","seasoning","spice","herb",
    // Dry beans & lentils
    "dry bean","dried lentil","split pea","dried chickpea","dried black bean",
    // Broths & stocks
    "broth","stock","chicken broth","beef broth","vegetable broth","bouillon",
    // Nuts & seeds (pantry-shelf)
    "flaxseed","chia seed","hemp seed","sesame seed","poppy seed",
    // Other dry
    "breadcrumb","panko","stuffing","crouton","dried cranberry","raisin",
    "coconut flake","shredded coconut",
  ],

  "Produce": [
    // Fruits
    "apple","banana","orange","grapefruit","grape","berry","berries",
    "strawberry","blueberry","raspberry","blackberry","cranberry",
    "lemon","lime","mango","papaya","pineapple","kiwi","watermelon","cantaloupe",
    "honeydew","peach","nectarine","plum","apricot","cherry","fig","date",
    "pomegranate","persimmon","passion fruit","dragonfruit",
    "pear","avocado",
    // Vegetables
    "lettuce","romaine","spinach","kale","arugula","chard","collard","cabbage",
    "broccoli","cauliflower","brussels sprout","broccolini",
    "carrot","celery","cucumber","zucchini","squash","butternut","acorn squash",
    "pepper","bell pepper","jalapeño","jalapeno","serrano","poblano","habanero",
    "tomato","cherry tomato","grape tomato","roma tomato",
    "onion","red onion","yellow onion","white onion","sweet onion","vidalia",
    "shallot","scallion","green onion","leek","chive",
    "garlic","ginger","turmeric root",
    "potato","sweet potato","yam","russet","yukon gold","red potato","fingerling",
    "corn","green bean","asparagus","artichoke","beet","radish","turnip","parsnip",
    "mushroom","cremini","portobello","shiitake","oyster mushroom",
    "eggplant","okra","fennel","bok choy","watercress","endive","radicchio",
    // Fresh herbs
    "basil","cilantro","parsley","mint","dill","tarragon","sage","oregano leaf",
    "thyme sprig","rosemary sprig","chive","lemongrass",
    // Produce generics
    "fresh","produce","vegetable","veggie","fruit","salad mix","coleslaw mix",
    "pre-washed","bag of salad","broccoli floret","stir fry mix",
  ],

  "Household": [
    "paper towel","toilet paper","tissue","facial tissue","kleenex",
    "napkin","paper plate","paper cup","plastic cup","plastic utensil",
    "dish soap","dish detergent","dishwasher pod","dishwasher tab",
    "laundry detergent","fabric softener","dryer sheet","bleach",
    "all-purpose cleaner","bathroom cleaner","toilet cleaner","glass cleaner",
    "windex","lysol","clorox","pine-sol","method","seventh generation",
    "trash bag","garbage bag","recycling bag","contractor bag",
    "ziploc","plastic bag","storage bag","freezer bag","sandwich bag",
    "aluminum foil","tin foil","plastic wrap","cling wrap","wax paper",
    "parchment paper","butcher paper","coffee filter",
    "sponge","scrub pad","steel wool","dish brush","mop","broom",
    "hand soap","body wash","shampoo","conditioner","toothpaste","deodorant",
    "razor","shaving cream","cotton ball","q-tip","bandage","first aid",
    "batteries","light bulb","candle","air freshener","dryer ball",
    "household","cleaning","sanitizer","disinfectant","wipe",
  ],

};
