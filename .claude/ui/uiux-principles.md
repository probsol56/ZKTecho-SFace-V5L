# UI/UX PRINCIPLES — uiux-principles.md

> This file defines **usability standards**. `frontend-design.md` (same directory) defines **aesthetics**;
> `../frontend/frontend-rules.md` defines engineering. **On conflict: usability > engineering > aesthetics.**
> A beautiful UI that fails these rules is a failed UI.
> Reusable across all projects. Stack-agnostic — works with any framework.

---

## 0. SURFACE TYPES (read this first)

Every screen is one of two surfaces. Decide before designing. Rules differ.

| | **Marketing surface** | **Product surface** |
|---|---|---|
| Examples | Landing, pricing, about, blog | Dashboard, forms, tables, settings, checkout, POS |
| Goal | Emotion → memorability → conversion | Speed → clarity → zero errors |
| Layout | Asymmetry, overlap, grid-breaking allowed | Strict grid. Predictable. Aligned. |
| Background | Texture / mesh / gradient allowed | Solid or near-solid. Content owns contrast. |
| Typography | Expressive display faces | Legibility first. Display face = headings only. |
| Motion | Orchestrated moments allowed | Functional feedback only |
| Signature element | Required (per `frontend-design.md`) | Optional, never at cost of task speed |

- The "no safe middle ground" rule applies to **marketing surfaces only**.
- On product surfaces: **boring and fast beats bold and slow. Every time.**
- Checkout, auth, and payment flows are ALWAYS product surfaces, even inside a marketing site.

---

## 1. CORE USABILITY LAWS (non-negotiable)

1. **Visibility of status** — system always shows what's happening. No silent actions. Every click gets a reaction within 100ms.
2. **Match the user's world** — labels use the user's vocabulary, never system internals. "Manage notifications", not "Webhook config".
3. **User control** — every destructive action is undoable OR confirmed. Prefer undo over confirm. Escape always closes modals.
4. **Consistency** — same action = same name = same position = same behavior everywhere. The button that says "Publish" produces a toast that says "Published".
5. **Error prevention > error messages** — disable invalid actions, constrain inputs, use sensible defaults, confirm irreversibles.
6. **Recognition over recall** — never force users to remember info across screens. Show context (selected items, current step, applied filters).
7. **Flexibility** — support both novice (guided) and expert (shortcuts, bulk actions) paths where scale justifies it.
8. **Aesthetic minimalism** — every element must earn its place. If removing it changes nothing, remove it.
9. **Help users recover** — errors say what happened + how to fix it, in plain language. Never show raw errors, codes, or stack traces.
10. **Fitts's Law** — frequent/primary actions are big and close; destructive actions are small and far from primary ones. Never place "Delete" adjacent to "Save".
11. **One control, one job** — never make the user perform the same lookup twice through two different controls (e.g. a filter box that narrows a list, feeding a second search inside the picker that filters again). If a control needs to search a remote source, it does the searching itself; don't bolt a second input in front of it "to help." Two controls are acceptable only when they do genuinely different jobs, and the relationship between them must be visually obvious, not inferred.

---

## 2. VISUAL HIERARCHY

- One primary action per screen. **One.** Strongest visual weight (filled, accent color). Secondary = outline/ghost, tertiary = text link.
- Hierarchy is built with **size + weight + color + spacing** — in that order. Never rely on color alone (colorblind users).
- Scanning follows F-pattern (text-heavy) or Z-pattern (marketing hero). Place critical info on the scan path.
- Group by proximity: whitespace IS the grouping tool — not boxes and borders. Reach for a border only when spacing has failed.
- Max 3 levels of visual hierarchy per view. If a screen needs more, split the screen.

---

## 3. LAYOUT, RESPONSIVE BREAKPOINTS & SPACING

### 8pt Grid
All spacing/sizing in multiples of 4px, prefer 8px: `4, 8, 12, 16, 24, 32, 48, 64, 96`. No arbitrary values (`p-[13px]` = bug).

### Standard Breakpoints & Layout Margins
- **Mobile (`xs` / `sm`):** `< 768px` | Container Margin: `16px` | Columns: `4`
- **Tablet (`md`):** `768px – 1023px` | Container Margin: `24px` | Columns: `8`
- **Desktop (`lg` / `xl`):** `1024px – 1439px` | Container Margin: `32px` | Columns: `12`
- **Ultra-wide (`2xl`):** `≥ 1440px` | Max-width content container: `1280px` or `1440px` centered.

### Rules
- **Alignment:** left-align text content (LTR). Never center-align paragraphs longer than 2 lines. Numbers in tables = right-aligned. Table headers align with column data.
- Content max-width: readable containers, not full-bleed text. `max-w-*` + `w-full`, no fixed px widths.
- Cards: consistent internal padding on all cards in a view. Consistent corner radius across product (e.g., 8/12/16px).

---

## 4. TYPOGRAPHY

- **Type scale ratio:** 1.2 (minor third) for product surfaces, 1.25–1.333 for marketing surfaces.
- Body text: **16px minimum** on all devices. Never below 14px for readable content. 12px only for uppercase micro-labels with letter-spacing.
- **Line height:** body 1.5–1.7; headings 1.1–1.3; buttons/labels 1.
- **Measure (line length): 45–75 characters** per line for body text (`max-w-prose`).
- Weights: max 3 per project (e.g., 400 / 500 / 700).
- Letter-spacing: negative tracking on display text (−1% to −3%); positive tracking (+5–10%) on small uppercase labels; never on body.
- Line breaks: no orphan words in headings (`text-balance` / `text-wrap: balance`).
- Font loading: `font-display: swap` + preload display face. Text must never be invisible while fonts load.

---

## 5. COLOR & CONTRAST (WCAG 2.2 AA — hard floor)

- **Normal text vs background:** ≥ 4.5:1. Large text (≥24px, or ≥19px bold): ≥ 3:1. UI components & focus indicators: ≥ 3:1.
- Never communicate meaning by color alone. Error = red + icon + text. Status dot = dot + label.
- Semantic colors: red = destructive/error, green = success, amber = warning, blue/accent = info/primary. Never use red decoratively in an app using red for errors.
- 60-30-10 Rule: ~60% neutral base, ~30% secondary/surface, ~10% accent.
- Neutrals with temperature: tint grays toward accent hue. Pure `#808080` reads lifeless.
- Placeholder text: formatting hint only, not a primary label.

---

## 6. ACCESSIBILITY & TOUCH TARGETS

- **Semantic HTML:** `button` for actions, `a` for links, landmarks (`nav/main/header/footer`), single `h1`, no skipped heading levels.
- **Keyboard navigation:** interactive elements reachable/operable via Tab / Enter / Space / Esc / Arrows. Logical tab order. Skip-to-content link present.
- **Focus visible:** clear focus ring (`:focus-visible`, ≥2px, ≥3:1 contrast against background). Never `outline: none` without a replacement.
- **Focus trapping:** modals trap focus while open and restore focus to trigger upon close.
- **Touch Targets:** Minimum **44×44px** (24px absolute visual size with surrounding padding). Interactive targets separated by ≥8px to avoid mis-taps.
- **Gestures:** All touch actions (swipe, pinch) must have a single-pointer button alternative (e.g., clear buttons alongside swipe-to-delete).
- Never disable zoom (`user-scalable=no` is forbidden).

---

## 7. COMPONENT STATES & DATA VIEWS

Every component MUST implement all applicable states:

| State | Requirement |
|---|---|
| Default | Resting appearance |
| Hover | Visible change ≤150ms (desktop only) |
| Focus | High-contrast focus ring (§6) |
| Active/Pressed | Immediate physical response (scale 0.98 or darker shade) |
| Disabled | Visually inert, `cursor-not-allowed`, tooltip explaining WHY if non-obvious |
| Loading | In-place spinner/skeleton. Button preserves dimensions (zero layout shift) |
| Error | Red border + warning icon + actionable inline message |
| Empty | Informative empty state (§16) |
| Selected | Unambiguous without relying strictly on color |

### Data Views (Tables, Lists, Cards)
- Must gracefully render: Loading (skeleton), Empty, Partial/Degraded, and Long Content Overflow (truncation + tooltip, or line wrapping).
- Always test extremes: 0 items, 1 item, 10,000 items, 200-character string, missing avatar.

---

## 8. FORMS & INPUT HANDLING

- **Labels above inputs.** Always visible. Placeholders show examples (`e.g. name@company.com`), never required instructions.
- Single-column layout for forms (except tightly coupled fields like City/State or Expiry/CVC).
- **Validation timing:** validate on blur (first exit), then live while editing. Never validate untouched fields during initial entry.
- Errors: inline, specific, actionable ("Password must contain at least 8 characters"). On submit failure, scroll and focus the first error.
- Input types: explicit `type="email|tel|number"`, `inputmode`, and standard `autocomplete` attributes.
- Preserve form state: never wipe input values on failed submission or unexpected reload.
- Action buttons: reflect specific action ("Create account", not "Submit"). Unsaved changes warning trigger on exit navigation.

---

## 9. FEEDBACK, SYSTEM STATUS & TOASTS

- **Response Times:**
  - `<100ms`: Instant response (no spinner).
  - `100ms–1s`: Subtle inline indicator.
  - `>1s`: Skeleton loaders or spinners.
  - `>3s`: Progress bar with context ("Processing 2 of 5...").
- **Skeletons over Spinners:** Match skeleton geometry to incoming content to avoid Cumulative Layout Shift (CLS).
- **Toasts:**
  - Non-blocking confirmations only. Auto-dismiss in 4–6s.
  - Max 1 toast visible at a time (queue additional toasts).
  - Include "Undo" option for non-destructive actions where applicable.
- **Modals:** Reserved for high-priority interruptions requiring user decision. Esc key and backdrop click close modal.

---

## 10. COMPLEX DATA TABLES & ENTERPRISE INTERFACES

- **Sticky Elements:** Sticky table headers on scroll; sticky primary column (e.g., ID or Name) on horizontal overflow.
- **Pagination vs. Virtualization:** Use explicit pagination for record management (e.g., 25, 50, 100 per page). Use virtualized lists for continuous logs or infinite streams.
- **Bulk Actions:** Selecting table items triggers a floating action bar showing total selected count and available actions.
- **Density Toggles:** High-density enterprise tables offer compact/comfortable views without breaking text alignment.

---

## 11. INTERNATIONALIZATION (i18n) & LOCALIZATION (l10n)

- **Layout Expansion:** Design layout containers with up to +40% buffer width to prevent overflow in localized translations (e.g., German, French).
- **RTL Support:** Use CSS Logical Properties (`margin-inline-start`, `padding-block`, `text-align: start`) instead of left/right directionals.
- **Formatting:** Format currencies, dates, and units using browser native `Intl` APIs.

---

## 12. NAVIGATION & INFORMATION ARCHITECTURE

- Breadcrumbs required for navigation depths ≥ 3 levels.
- Max navigation depth: ≤ 3 levels.
- Top/Side Nav limits: 5±2 primary navigation items.
- Mobile Nav: Core actions placed within thumb zone (bottom bar). Secondary items inside drawer.
- Deep linking: Every filter set, search query, tab selection, and detail page must reflect in URL state.

---

## 13. MICROCOPY & WRITING RULES

- **Sentence case everywhere** ("Save settings", not "Save Settings").
- **Buttons:** Active verb + noun ("Delete repository", "Send invitation"). Avoid "OK", "Yes", "No" on dialogs.
- Banned words: "simply", "easy", "just", "please", "unlock", "seamless", "supercharge", "revolutionize".
- Relative time ("2 hours ago") for recent updates; absolute timestamp ("Oct 12, 2026, 14:32") for historical/audit records. Use tabular numbers (`font-variant-numeric: tabular-nums`).

---

## 14. ELEVATION, Z-INDEX & SHADOWS

### Tokenized Z-Index Scale (No arbitrary values)
```css
--z-base: 0;
--z-card: 1;
--z-sticky: 100;
--z-dropdown: 200;
--z-overlay: 300;
--z-modal: 400;
--z-popover: 500;
--z-toast: 600;
```

### Shadow Scale (elevation and z-index move together)
```css
--shadow-1: 0 1px 2px rgb(0 0 0 / 0.05);   /* resting card */
--shadow-2: 0 2px 8px rgb(0 0 0 / 0.08);   /* dropdown, popover, sticky bar */
--shadow-3: 0 8px 24px rgb(0 0 0 / 0.14);  /* modal, drawer */
```

- Shadows communicate **elevation and interactivity** — never decoration. A flat element gets no shadow.
- Max 3 shadow levels per product. An element's shadow level matches its z-index tier (a modal has modal z AND modal shadow).
- Tint shadows toward the surface hue; never pure black at high opacity.
- **Dark mode:** shadows are nearly invisible — express elevation with lighter surface color + 1px border instead (see §17).

---

## 15. MOTION & ANIMATION

- **Durations:** micro-feedback (hover, press) `100–150ms`; small transitions (dropdown, tooltip, toast) `150–250ms`; large transitions (modal, drawer, page) `250–400ms`. Longer than 400ms only in orchestrated marketing moments.
- **Easing:** `ease-out` for entrances, `ease-in` for exits, `ease-in-out` for movement. `linear` only for progress indicators and continuous spinners.
- **Animate `transform` and `opacity` only.** Never animate `top/left/width/height/margin` (layout thrash) or `box-shadow` directly.
- **`prefers-reduced-motion: reduce` is mandatory:** replace movement with opacity fades or disable the animation entirely. No exceptions.
- Product surfaces: no ambient or looping animation. Nothing moves while the user is reading data or typing.
- Every animation is interruptible — a second click never waits for the first animation to finish.

---

## 16. EMPTY, ERROR & EDGE STATES

- **Empty ≠ blank.** Every empty state answers: what is this area, why is it empty, what action creates content. One-line explanation + primary CTA.
- Distinguish three empties — they need different copy and actions:
  - **First use:** invite the first action ("Add your first product").
  - **Filtered to zero:** show active filters + "Clear filters". Never imply the data doesn't exist.
  - **Error:** say what failed + "Retry". Never render an error as an empty list.
- **Offline / degraded:** show a persistent, non-blocking indicator; queue or disable mutations explicitly — never fail silently.
- Design against extremes before "done": 0/1/10,000 items, 200-char strings, missing images, slow network, permission-denied.

---

## 17. THEMING & DARK MODE

- **All color through semantic tokens** (`--surface`, `--surface-raised`, `--text-primary`, `--border`, `--accent`). Components never reference raw hex values.
- Dark mode is a **re-mapped palette, not an inversion.** Avoid pure `#000` backgrounds; slightly desaturate accents; express elevation with lighter surfaces + borders instead of shadows.
- Re-verify every §5 contrast ratio **in both themes** — passing light mode proves nothing about dark.
- Respect the OS preference (`prefers-color-scheme`) by default; persist an explicit user override.

---

## 18. DEFINITION OF DONE (ship checklist)

- [ ] Surface type decided (§0) and rules applied accordingly.
- [ ] Full keyboard pass: Tab order logical, focus visible, Esc closes overlays.
- [ ] Contrast verified (§5) in every supported theme.
- [ ] All applicable component states implemented (§7), including loading, error, and empty (§16).
- [ ] No layout shift from loading states; skeleton geometry matches content.
- [ ] Renders correctly at 360px wide — no horizontal scroll, no clipped content.
- [ ] `prefers-reduced-motion` respected (§15).
- [ ] Spacing on the 8pt grid — zero arbitrary values (§3).
- [ ] Filters, tabs, and detail views reflected in URL state (§12).
- [ ] Copy is sentence case, verb-first buttons, no banned words (§13).
- [ ] No two controls make the user do the same lookup twice (§1.11).
