# Security

Concern: secrets, input trust, headers, dependencies. Assume hostile input.

## Secrets & config

- **IMPORTANT: never write secrets into any file.** No keys, tokens, passwords, connection strings.
- **`.env` is gitignored; `.env.example` is committed** with every key, no values.
- **Parse env once at startup** through a Zod schema into a typed, frozen `config`. Import `config`, never raw `process.env` downstream. Crash loudly at boot on missing/invalid env.
- **Client/server boundary:** only `NEXT_PUBLIC_*` reaches the browser. The Supabase `anon` key may be public; `service_role` and everything else must not be. Verify before shipping.

## Input & output

- **All user input is untrusted** until Zod-validated.
- **No secrets, tokens, or PII in logs or error responses.** Redact before logging.
- **No personal/sensitive data in URLs or query strings.**
- **Re-validate authorization on the server** for every protected operation — never trust the client.

## Dependencies

- **`pnpm audit` in CI.** No known criticals merged.
- **Verify a package before adding it** — current version, maintenance, weekly downloads. Pin direct deps, commit the lockfile.

## Headers & transport

- Security headers on responses (CSP, `X-Content-Type-Options`, etc.).
- CORS explicitly allowlisted — never `*` with credentials.
- HTTPS only; httpOnly + Secure + SameSite cookies for sessions.
