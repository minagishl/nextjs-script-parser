# Next.js Script Parser

A Preact + Vite web utility for extracting component data from the `self.__next_f.push(...)` payloads that Next.js embeds in streaming `<script>` tags. Paste the raw script contents and instantly inspect the component tree as readable JSON or JSX-like snippets.

## Features

- Parses one or more `self.__next_f.push` calls and aggregates every component payload it finds
- Offers formatted output in two styles: prettified JSON or JSX-style component markup
- Highlights parse success, failure, and module-only payloads with contextual status messaging
- Provides quick actions for loading sample input, copying results, or downloading them as a file
- Remembers the latest parse so switching between JSON/React tabs refreshes the output immediately

## Prerequisites

- Node.js 20 or later (recommended)
- [pnpm](https://pnpm.io/) for dependency management

## Getting Started

```bash
# Install dependencies
pnpm install

# Run the development server
pnpm run dev
```

The dev server prints a local URL (default: `http://localhost:5173`). Open it in a browser and interact with the UI.

## Usage

1. Paste the contents of one or more Next.js streaming `<script>` tags into the **Input** textarea.
2. Click **Parse**. The parser scans each `self.__next_f.push` call and extracts component payloads.
3. Use the **JSON** or **React** toggle buttons to switch between output formats. The output pane updates immediately.
4. Copy the results to the clipboard or download them as a `.json`/`.tsx` file.
5. Click **Clear** to reset the interface.

If the parser encounters payloads that resemble module metadata (e.g., chunk manifests), they are ignored and reported in the status card.

## Available Scripts

```bash
pnpm run dev      # Start Vite in development mode
pnpm run build    # Type-check and build for production
pnpm run preview  # Preview the production build locally
```

## Project Structure

- `src/app.tsx` – main UI component that orchestrates parsing and presentation
- `src/parser.ts` – parsing utilities that analyze Next.js script payloads and produce component data
- `src/main.tsx` – application bootstrap for Preact + Vite
- `src/index.css` – Tailwind-based styling

## Limitations & Notes

- Only the `self.__next_f.push` serialization format is supported. Other Next.js data scripts are ignored.
- Complex payloads that deviate from the standard structure may show up in the **Failures** section with a short diagnostic snippet.
- Clipboard and file-download actions require a browser that supports the respective Web APIs.

## License

This project is distributed under the terms of the [MIT License](LICENSE).
