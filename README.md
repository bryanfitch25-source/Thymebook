# Thymebook

A personal recipe holder. No accounts, no backend — everything lives in
your browser's localStorage.

## Features

- Add, edit, and delete recipes (title, ingredients, instructions, notes,
  tags, prep/cook time, servings, source)
- Search across title/ingredients/notes and filter by tag
- Export all recipes as a single JSON backup file
- Import a JSON backup (merges by recipe id — safe to re-import)
- Export a single recipe as a readable Markdown/text file

## Running locally

```bash
npm install
npm run dev
```

## Building

```bash
npm run build
```

Outputs a static site in `dist/` — you can also just open the built
`index.html` or serve it from anywhere, no server-side logic required.
