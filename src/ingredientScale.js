// Parses a leading numeric quantity (integer, decimal, simple fraction, or
// mixed fraction) at the start of an ingredient line, so it can be scaled
// for display when the user adjusts servings. Returns null if there's no
// parseable leading quantity, in which case callers should leave it as-is.
const LEADING_QTY_RE = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+\.\d+|\d+)(?=(\s|$))/;

function parseQtyToken(token) {
  if (token.includes(" ") && token.includes("/")) {
    const [whole, frac] = token.split(" ");
    const [n, d] = frac.split("/").map(Number);
    return Number(whole) + n / d;
  }
  if (token.includes("/")) {
    const [n, d] = token.split("/").map(Number);
    return n / d;
  }
  return Number(token);
}

export function parseLeadingQuantity(line) {
  const match = line.match(LEADING_QTY_RE);
  if (!match) return null;
  const value = parseQtyToken(match[1]);
  if (!Number.isFinite(value)) return null;
  return { value, matchLength: match[1].length };
}

const NICE_FRACTIONS = [
  [1 / 8, "1/8"],
  [1 / 4, "1/4"],
  [1 / 3, "1/3"],
  [3 / 8, "3/8"],
  [1 / 2, "1/2"],
  [5 / 8, "5/8"],
  [2 / 3, "2/3"],
  [3 / 4, "3/4"],
  [7 / 8, "7/8"],
];

export function formatQuantity(num) {
  const whole = Math.floor(num);
  const frac = num - whole;

  if (frac < 0.02) return String(whole || 0);

  for (const [val, label] of NICE_FRACTIONS) {
    if (Math.abs(frac - val) < 0.03) {
      return whole > 0 ? `${whole} ${label}` : label;
    }
  }

  const rounded = Math.round(num * 100) / 100;
  return String(rounded);
}

// Scales the leading quantity of a single ingredient line by `factor`,
// leaving the rest of the text untouched. Lines with no parseable leading
// quantity are returned unchanged.
export function scaleIngredientLine(line, factor) {
  const parsed = parseLeadingQuantity(line);
  if (!parsed) return line;
  const scaled = parsed.value * factor;
  return formatQuantity(scaled) + line.slice(parsed.matchLength);
}

// --- unit-aware parsing, for shopping-list ingredient consolidation ---

// Canonical unit -> [aliases...] (all lowercase). The canonical key doubles
// as the singular display label; UNIT_PLURAL supplies the plural label.
const UNIT_ALIASES = {
  tsp: ["tsp", "tsps", "teaspoon", "teaspoons"],
  tbsp: ["tbsp", "tbsps", "tablespoon", "tablespoons"],
  cup: ["cup", "cups"],
  oz: ["oz", "ozs", "ounce", "ounces"],
  lb: ["lb", "lbs", "pound", "pounds"],
  g: ["g", "gram", "grams"],
  kg: ["kg", "kilogram", "kilograms"],
  ml: ["ml", "milliliter", "milliliters", "millilitre", "millilitres"],
  l: ["l", "liter", "liters", "litre", "litres"],
  pinch: ["pinch", "pinches"],
  clove: ["clove", "cloves"],
  can: ["can", "cans"],
  slice: ["slice", "slices"],
  stick: ["stick", "sticks"],
  quart: ["quart", "quarts"],
  pint: ["pint", "pints"],
  gallon: ["gallon", "gallons"],
  bunch: ["bunch", "bunches"],
  head: ["head", "heads"],
  package: ["package", "packages", "pkg", "pkgs"],
  box: ["box", "boxes"],
  piece: ["piece", "pieces"],
};

const UNIT_PLURAL = {
  tsp: "tsp",
  tbsp: "tbsp",
  cup: "cups",
  oz: "oz",
  lb: "lbs",
  g: "g",
  kg: "kg",
  ml: "ml",
  l: "l",
  pinch: "pinches",
  clove: "cloves",
  can: "cans",
  slice: "slices",
  stick: "sticks",
  quart: "quarts",
  pint: "pints",
  gallon: "gallons",
  bunch: "bunches",
  head: "heads",
  package: "packages",
  box: "boxes",
  piece: "pieces",
};

const ALIAS_TO_UNIT = new Map();
Object.entries(UNIT_ALIASES).forEach(([unit, aliases]) => {
  aliases.forEach((alias) => ALIAS_TO_UNIT.set(alias, unit));
});

export function unitLabel(unit, quantity) {
  if (!unit) return "";
  if (quantity != null && Math.abs(quantity - 1) < 0.001) return unit;
  return UNIT_PLURAL[unit] || unit;
}

// Naive singularization used only for loose name-matching (never for
// display) - strips a trailing "s" unless it looks like it belongs
// (e.g. "hummus", "asparagus", or short words).
function singularizeForMatch(word) {
  if (word.length > 3 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && /[^aeiou]us$/.test(word) === false && word.endsWith("es") && /(x|ch|sh|ss)es$/.test(word)) {
    return word.slice(0, -2);
  }
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss") && !word.endsWith("us")) {
    return word.slice(0, -1);
  }
  return word;
}

// Normalizes an ingredient's descriptive name for loose matching across
// recipes: lowercase, drop parenthetical asides and anything after a comma
// (prep notes like ", diced"), collapse whitespace, singularize lightly.
export function normalizeIngredientName(name) {
  let n = name.toLowerCase();
  n = n.replace(/\([^)]*\)/g, " ");
  n = n.split(",")[0];
  n = n.replace(/\b(fresh|chopped|diced|minced|sliced|to taste|optional|large|small|medium|ripe)\b/g, " ");
  n = n.replace(/[^a-z0-9\s/-]/g, " ");
  n = n.replace(/\s+/g, " ").trim();
  if (!n) return n;
  const words = n.split(" ");
  const last = singularizeForMatch(words[words.length - 1]);
  return [...words.slice(0, -1), last].join(" ");
}

// Parses a full ingredient line into { quantity, unit, name, raw }.
// `quantity` is null when there's no parseable leading number.
// `unit` is a canonical unit key (see UNIT_ALIASES) or null when the
// remaining text has no recognized unit token (e.g. "2 onions").
// `name` is the remaining descriptive text, unnormalized (for display).
export function parseIngredientLine(line) {
  const raw = line.trim();
  const parsedQty = parseLeadingQuantity(raw);
  if (!parsedQty) {
    return { quantity: null, unit: null, name: raw, raw };
  }
  let rest = raw.slice(parsedQty.matchLength).trim();
  let unit = null;
  const wordMatch = rest.match(/^([a-zA-Z]+)\b/);
  if (wordMatch) {
    const candidate = ALIAS_TO_UNIT.get(wordMatch[1].toLowerCase());
    if (candidate) {
      unit = candidate;
      rest = rest.slice(wordMatch[0].length).trim();
    }
  }
  rest = rest.replace(/^of\s+/i, "");
  return { quantity: parsedQty.value, unit, name: rest, raw };
}
