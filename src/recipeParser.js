// Heuristic parser that turns loose raw text (from OCR of a handwritten/
// printed recipe card, or a voice-dictation transcript) into a draft recipe
// object. Pure function, no DOM/browser dependencies, so it's easy to
// unit-test with a plain Node script.
//
// Philosophy: never guess badly. When a field can't be confidently detected,
// leave it blank rather than mixing a wrong guess into the wrong section —
// the chef reviews and edits the draft before saving anyway.

const SECTION_HEADERS = {
  ingredients: "ingredients",
  instructions: "instructions",
  directions: "instructions",
  method: "instructions",
  steps: "instructions",
  notes: "notes",
};

const HEADER_LINE_RE = new RegExp(`^(${Object.keys(SECTION_HEADERS).join("|")})\\s*:?\\s*$`, "i");

const FRACTION_CHARS = "½¼¾⅓⅔⅕⅙⅐⅛⅑⅒";
const INGREDIENT_LINE_RE = new RegExp(`^(\\d|[${FRACTION_CHARS}])`);

const TITLE_LABEL_RE = /^title\s*:\s*/i;

const SERVINGS_RE = /\bserv(?:es|ings?)\b\s*:?\s*(\d+)/i;
const PREP_RE = /\bprep(?:\s*time)?\s*:?\s*([\d/½¼¾⅓⅔]+\s*(?:hours?|hrs?|hr|minutes?|mins?|min)?)/i;
const COOK_RE = /\bcook(?:\s*time)?\s*:?\s*([\d/½¼¾⅓⅔]+\s*(?:hours?|hrs?|hr|minutes?|mins?|min)?)/i;

function emptyResult() {
  return {
    title: "",
    ingredients: "",
    instructions: "",
    notes: "",
    prepTime: "",
    cookTime: "",
    servings: "",
  };
}

function isHeaderLine(line) {
  return HEADER_LINE_RE.test(line.trim());
}

function headerSection(line) {
  const match = line.trim().match(HEADER_LINE_RE);
  if (!match) return null;
  return SECTION_HEADERS[match[1].toLowerCase()];
}

// Lines that are *entirely* metadata (servings/prep/cook) so they can be
// excluded from whichever section they'd otherwise fall into.
function isMetadataLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return SERVINGS_RE.test(trimmed) || PREP_RE.test(trimmed) || COOK_RE.test(trimmed);
}

function extractMetadata(rawText) {
  const servingsMatch = rawText.match(SERVINGS_RE);
  const prepMatch = rawText.match(PREP_RE);
  const cookMatch = rawText.match(COOK_RE);
  return {
    servings: servingsMatch ? servingsMatch[1].trim() : "",
    prepTime: prepMatch ? prepMatch[1].trim() : "",
    cookTime: cookMatch ? cookMatch[1].trim() : "",
  };
}

export function parseRecipeText(rawText) {
  const result = emptyResult();
  if (typeof rawText !== "string" || !rawText.trim()) {
    return result;
  }

  const metadata = extractMetadata(rawText);
  result.servings = metadata.servings;
  result.prepTime = metadata.prepTime;
  result.cookTime = metadata.cookTime;

  const allLines = rawText.split("\n").map((l) => l.trim());
  const nonBlankIndices = [];
  allLines.forEach((line, i) => {
    if (line) nonBlankIndices.push(i);
  });
  if (nonBlankIndices.length === 0) return result;

  // Title: first non-blank line, unless it's itself a section header.
  const firstIdx = nonBlankIndices[0];
  const firstLine = allLines[firstIdx];
  let titleConsumed = false;
  if (!isHeaderLine(firstLine)) {
    result.title = firstLine.replace(TITLE_LABEL_RE, "").trim();
    titleConsumed = true;
  }

  // Body = every non-blank line except the consumed title line and any
  // pure-metadata lines.
  const bodyLines = [];
  allLines.forEach((line, i) => {
    if (!line) return;
    if (titleConsumed && i === firstIdx) return;
    if (isMetadataLine(line)) return;
    bodyLines.push(line);
  });

  if (bodyLines.length === 0) return result;

  const hasHeaders = bodyLines.some(isHeaderLine);

  const buckets = { ingredients: [], instructions: [], notes: [] };

  if (hasHeaders) {
    let current = null;
    for (const line of bodyLines) {
      const section = headerSection(line);
      if (section) {
        current = section;
        continue;
      }
      if (current) buckets[current].push(line);
      // Lines before the first header (with headers present elsewhere) are
      // dropped rather than guessed at — safer to leave blank.
    }
  } else {
    // No headers: coarse per-line classification. Number/fraction-led
    // lines are probably ingredients; everything else is an instruction.
    for (const line of bodyLines) {
      if (INGREDIENT_LINE_RE.test(line)) {
        buckets.ingredients.push(line);
      } else {
        buckets.instructions.push(line);
      }
    }
  }

  result.ingredients = buckets.ingredients.join("\n");
  result.instructions = buckets.instructions.join("\n");
  result.notes = buckets.notes.join("\n");

  return result;
}
