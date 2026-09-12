# Git & Delivery

Concern: commits, branches, PRs, CI.

## Commits

- **Conventional Commits:** `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `style:`, `test:`, `perf:`.
- **Imperative, present tense.** "add auth middleware", not "added" / "adds".
- **One logical change per commit.** No "wip" / "fix stuff" in history.
- **Never commit:** secrets, `.env`, `node_modules`, build output, generated Supabase types if you prefer regenerating in CI (decide once, be consistent).

## Branches & PRs

- **Short-lived feature branches** off `main`. Name mirrors the work: `feat/user-onboarding`.
- **Small, focused PRs.** One concern per PR — easier to review, safer to revert.
- **PR description states what changed and why**, not just what.

## CI (must be green before merge)

1. `pnpm install --frozen-lockfile`
2. `pnpm typecheck`
3. `pnpm lint`
4. `pnpm test` (when tests exist)
5. `pnpm build`

- **Never let CI silently update the lockfile** — frozen install always.
- **A red pipeline is never merged.**

## Deploy

- `main` is always deployable. Preview deploys per PR.
- DB changes ship as committed Supabase migrations (see supabase.md) — never manual dashboard edits.
- No manual edits to deployed state — everything flows through git.
