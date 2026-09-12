---
paths:
  - "frontend/**/*.ts"
  - "frontend/**/*.tsx"
  - "**/*.mts"
  - "*.config.*"
---

# TypeScript & Tooling Baseline

Concern: language, runtime, type safety. Applies to all TypeScript code.

## Runtime & tooling

- **Node: Active LTS only.** Baseline **Node 24** (LTS through Apr 2027). Pin in `.nvmrc` + `package.json` `engines`. Never build new work on Current/odd lines.
- **`pnpm` only.** Commit `pnpm-lock.yaml`. Never mix lockfiles. Set `"packageManager"`. CI uses `pnpm install --frozen-lockfile`.
- **ESM only** (`"type": "module"`). No `require()` in new code.
- **TypeScript for all app logic.** No untyped runtime `.js`.

## Type strictness (the type system is the first test)

Enable at minimum: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, `forceConsistentCasingInFileNames`.

- **`any` is banned.** Use `unknown` and narrow. Escape hatch only with `// eslint-disable-next-line` + a one-line reason.
- **No `!` non-null assertions to silence the compiler.** If it can be null, handle null.
- **Validate all external input at the boundary** with **Zod**. `as` casts are lies; parsed types are facts.
- **Avoid `enum`** — prefer `as const` objects or unions.

## Async & errors

- **No `async` without an `await`** inside.
- **No floating promises.** `await`, `void`, or `.catch()` every one. Enable `@typescript-eslint/no-floating-promises`.
- **`async/await` only** — no `.then()` chains in new code.
- **`catch (e: unknown)`** — narrow before touching `e.message`/`e.code`.
- **No empty catch blocks.** If you swallow, comment why.

## Hygiene

- ESLint (flat config) + Prettier. Formatting is the tool's job, not a review topic.
- `camelCase` vars/functions · `PascalCase` types/components · `SCREAMING_SNAKE` true constants · `kebab-case` filenames.
- No dead code, no commented-out blocks, no `TODO` without a reference.
- Path aliases (`@/*`), no `../../../` chains.

## Self-review (run before "done")

- [ ] No `async` without `await`; no floating promises.
- [ ] No `any`; external input parsed with Zod, not cast.
- [ ] No `!` used to silence the compiler.
- [ ] `catch (e: unknown)` narrowed before use.
- [ ] Return types match the signature (no leaked `undefined`/`Promise`).
- [ ] `pnpm lint && pnpm typecheck` clean.
