# dakera-js

TypeScript/JavaScript SDK for the Dakera AI agent memory platform — CJS + ESM dual bundle
with full type declarations.

## Key Commands
```bash
npm install              # Install dependencies
npm run build            # Build CJS + ESM bundles + .d.ts → dist/
npm run dev              # Build in watch mode
npm test                 # Run vitest test suite
npm run lint             # ESLint
npm run typecheck        # tsc --noEmit (no emit, type-check only)
npm publish              # Publish to npm (runs build first via prepublishOnly)
```

## Architecture
- `src/index.ts` — Main entry; exports DakeraClient class + all types
- `src/` — Methods for memories, sessions, agents, knowledge, KPIs, events (SSE)
- `dist/` — Built output: `cjs/`, `esm/`, `index.d.ts`

## Conventions
- tsup bundler; CJS + ESM dual output required (Node + browser compatibility)
- Tests with vitest; do not mock HTTP — run against a test server
- CI matrix: default Node 22 only; `full-matrix` label adds Node 20
- Version matches server SDK version (e.g., 0.9.13)
- SDK batch: all 4 SDKs sync together after a server API change
