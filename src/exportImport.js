export function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportAllAsJson(recipes) {
  const payload = {
    app: "thymebook",
    exportedAt: new Date().toISOString(),
    recipes,
  };
  const stamp = new Date().toISOString().slice(0, 10);
  downloadFile(`thymebook-backup-${stamp}.json`, JSON.stringify(payload, null, 2), "application/json");
}

export function parseImportedJson(text) {
  const data = JSON.parse(text);
  const recipes = Array.isArray(data) ? data : data.recipes;
  if (!Array.isArray(recipes)) throw new Error("File doesn't contain a recipes array.");
  return recipes.filter((r) => r && typeof r === "object" && typeof r.id === "string" && typeof r.title === "string");
}

export function recipeToMarkdown(recipe) {
  const lines = [];
  lines.push(`# ${recipe.title || "Untitled recipe"}`);
  lines.push("");

  const meta = [];
  if (recipe.prepTime) meta.push(`**Prep:** ${recipe.prepTime}`);
  if (recipe.cookTime) meta.push(`**Cook:** ${recipe.cookTime}`);
  if (recipe.servings) meta.push(`**Servings:** ${recipe.servings}`);
  if (meta.length) {
    lines.push(meta.join("  \n"));
    lines.push("");
  }

  if (recipe.tags?.length) {
    lines.push(recipe.tags.map((t) => `\`${t}\``).join(" "));
    lines.push("");
  }

  if (recipe.source) {
    lines.push(`Source: ${recipe.source}`);
    lines.push("");
  }

  if (recipe.ingredients) {
    lines.push("## Ingredients");
    lines.push("");
    recipe.ingredients
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((line) => lines.push(`- ${line}`));
    lines.push("");
  }

  if (recipe.instructions) {
    lines.push("## Instructions");
    lines.push("");
    recipe.instructions
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((line, i) => lines.push(`${i + 1}. ${line}`));
    lines.push("");
  }

  if (recipe.notes) {
    lines.push("## Notes");
    lines.push("");
    lines.push(recipe.notes);
    lines.push("");
  }

  return lines.join("\n");
}

export function exportRecipeAsMarkdown(recipe) {
  const safeName = (recipe.title || "recipe").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  downloadFile(`${safeName || "recipe"}.md`, recipeToMarkdown(recipe), "text/markdown");
}
