# Frontend Engineering Rules — frontend-rules.md

> This file defines **architecture and clean-code standards** for any web frontend. Portable across projects.
> Companions: `../ui/uiux-principles.md` (usability), `../ui/frontend-design.md` (aesthetics).
> **On conflict: usability > engineering > aesthetics.** Project-specific rules (in the repo's `.claude/rules/`) override all three.

---

## 1. COMPONENT ARCHITECTURE

- **One component per file.** `PascalCase` component name, `kebab-case.tsx` file.
- **Small and single-purpose.** If describing it needs "and", split it.
- **Composition over configuration.** Prefer `children`/slots over boolean-prop explosions (`isCompact`, `hideIcon`, `withBorder` ×10 = redesign the API).
- **No prop drilling past 2 levels** — compose, lift, or use context deliberately.
- **Co-locate** component, styles, tests, and sub-components used nowhere else. Promote to shared only on the Rule of Three.
- **No business logic in components.** Components render state and dispatch intents; calculations, validation, and orchestration live in plain functions/hooks that are testable without a DOM.
- **Never call the database or third-party APIs directly from a component.** All I/O goes through a typed data layer (API client, server action, query function).

## 2. STATE — CLASSIFY BEFORE YOU STORE

Four kinds of state; each has one home. Storing state in the wrong tier is a bug.

| Kind | Examples | Home |
|---|---|---|
| Server state | fetched entities, lists, mutations | Query library (TanStack Query / SWR) — never mirrored into `useState` |
| URL state | filters, tabs, pagination, selected id | The URL (`searchParams` / route params) |
| Local UI state | open/closed, hover, draft input | `useState` / `useReducer` in the owning component |
| Shared client state | cart, session context, theme | One small store (Zustand/context) — only when ≥2 distant components need it |

- **Derive, don't duplicate.** Compute from existing state; every redundant copy is a future desync.
- **Server state is not client state.** Cache invalidation belongs to the query library, not manual `useEffect` refetching.
- **Nothing sensitive in `localStorage`/`sessionStorage`** — no tokens, no PII. Sessions live in httpOnly cookies.

## 3. DATA FLOW & BOUNDARIES

- **Validate at every external boundary with a schema (Zod or equivalent):** API responses, form input, URL params, env vars, `postMessage`. Parsed types are facts; `as` casts are lies.
- **Env config parsed once at startup** into a typed, frozen `config` object. No raw `process.env` reads downstream.
- **Server/client secret boundary:** only explicitly public env vars reach the browser. Verify before shipping.
- **Re-validate authorization on the server** for every protected operation. The client is a rendering hint, never a security boundary.
- **Handle the unhappy path first.** Every fetch has explicit loading, error, and empty handling wired to the UI states in `uiux-principles.md` §7/§16. No silent failures.

## 4. LANGUAGE BASELINE (TypeScript)

Headline rules — a fuller per-project baseline may extend these:

- `strict` on, plus `noUncheckedIndexedAccess`. **`any` is banned**; use `unknown` and narrow. No `!` non-null assertions to silence the compiler.
- **No floating promises.** `await`, `void`, or `.catch()` every one.
- `catch (e: unknown)` — narrow before touching `e.message`. **No empty catch blocks.**
- Explicit over magic: no magic strings/numbers — constants, unions, or `as const` objects.
- Readable in 6 months without comments. If a comment is needed to explain *what*, the code is too clever.

## 5. RENDERING (server-first frameworks: Next.js App Router, etc.)

- **Default to Server Components.** Add `"use client"` only for state, effects, event handlers, or browser APIs.
- **Push `"use client"` to the leaves.** One interactive button never makes a whole page a client component.
- **Fetch on the server** (async Server Components / loaders) — not in `useEffect`.
- **Never pass functions or non-serializable values** across the server→client boundary.
- Route-level `loading.tsx` / `error.tsx` (or framework equivalent) for every data-bearing route.

## 6. STYLING DISCIPLINE

- **Design tokens only** — spacing, color, radius, shadows, z-index come from the token scales in `uiux-principles.md` (§3, §14, §17). Arbitrary one-off values (`p-[13px]`, `z-[999]`, raw hex in a component) are bugs.
- Mobile-first, fluid by default: `clamp()` for type/spacing; container queries when a component adapts to its container, not the viewport.
- Prefer CSS logical properties (`margin-inline-start`) over physical directions.
- Dead styles are dead code — delete, don't comment out.

## 7. PERFORMANCE

- **Images:** framework image component (`next/image` or equivalent) for all content images — sizing, lazy-load, modern formats. No raw `<img>` for content.
- **Fonts:** self-hosted / `next/font`, preloaded, `font-display: swap`. No render-blocking font CSS.
- **Code-split heavy or below-the-fold client components** (dynamic import). Every `"use client"` ships bytes — justify it.
- **Lists:** paginate or virtualize; never render unbounded arrays.
- Budgets: no layout shift from loading states (CLS), interaction feedback <100ms, route-level JS kept deliberately small. Measure before and after when touching anything hot.

## 8. ACCESSIBILITY ENGINEERING

Standards live in `uiux-principles.md` §6 — this is the implementation contract:

- Semantic elements first: `<button>` for actions, `<a>` for navigation. **Never `<div onClick>`.** ARIA is a last resort, not a substitute.
- Every image has `alt` (`alt=""` when decorative); every input has an associated `<label>`.
- Errors are announced (`aria-live` / `role="alert"`), not just colored.
- Keyboard operability and visible focus are acceptance criteria, not polish.

## 9. TESTING

- Test behavior through the user's interface (Testing Library idiom: roles, labels, text) — not implementation details or snapshots-by-default.
- Priority order: pure logic functions → critical flows (auth, checkout/submit) → edge states (empty, error, extreme data from `uiux-principles.md` §16).
- Every bug fix lands with the test that would have caught it.
- Type-checking and linting are the first test suite: CI runs typecheck + lint + test + build; red never merges.
