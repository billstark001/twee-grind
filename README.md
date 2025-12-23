# twee-grind

Twine narrative language toolchain with TypeScript.

## Workspace Structure

This project uses pnpm workspace with 4 packages:

- **harlowe-markup**: Lexer and parser for Harlowe markup (equivalent to harlowe's js/markup directory)
- **harlowe-lsp**: Language Server Protocol implementation for VSCode and other editors
- **twee-project**: Twee 3 parser with Passage and Story types (similar to klembot/twinejs)
- **twee-cli**: Command-line tool for various Twee/Twine operations

## Prerequisites

- Node.js 14+
- pnpm

## Installation

```bash
pnpm install
```

## Build

Build all packages:

```bash
pnpm build
```

Clean build artifacts:

```bash
pnpm clean
```

## CLI Usage

### Extract HTML to Twee

Extract tw-storydata and tw-passagedata from Twine HTML files:

```bash
cd packages/twee-cli
node dist/cli.js extract <html-file> -o <output-dir>
```

This will:
- Extract metadata to `<output-dir>/metadata.json`
- Extract passages to `<output-dir>/passages/<story-name>.twee`

## License

MIT
