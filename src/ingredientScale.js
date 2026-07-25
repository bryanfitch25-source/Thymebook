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
