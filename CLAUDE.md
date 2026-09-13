# SFPL Attendance System

Attendance tracking for ZKTeco biometric terminals: pulls users/logs from devices, stores them, and surfaces devices/employees/attendance logs in a web UI.

## Stack

- **Database:** PostgreSQL, plain EF Core (Npgsql) — no RLS/multi-tenancy, no Supabase.
- **Backend:** .NET 10 Web API (`AttendanceApi`) — Controllers → Services → EF Core, no CQRS/MediatR layering.
- **Device integration:** ZKTeco `zkemkeeper.dll` COM SDK (`Services/ZkemkeeperDeviceClient.cs`, `ComInterop/`). This forces `<PlatformTarget>x86</PlatformTarget>` in the csproj — the API must run as a 32-bit process, and `zkemkeeper.dll` must be registered (`regsvr32`) on any machine that runs it.
- **Frontend:** Next.js 16 App Router + React 19 + Tailwind 4. Plain `fetch`-based API client (`frontend/src/lib/api.ts`) talking to the backend over HTTP; Server Actions for mutations (see `frontend/src/app/devices/actions.ts`). No client-side state library — the app is small enough not to need one.
- **Package manager:** pnpm (`frontend/pnpm-lock.yaml`).

## Repository map

```
backend/AttendanceApi/    .NET 10 Web API
  Controllers/             Adms (device-initiated push over plain HTTP, no zkemkeeper), Devices (server-initiated pull via zkemkeeper), Employees, AttendanceLogs
  Services/                DeviceSyncService, ZkemkeeperDeviceClient (COM pull path only)
  Models/                  Device, Employee, AttendanceLog (EF entities)
  Data/                    AttendanceDbContext
  Migrations/              EF Core migrations (source of truth for schema)
  ComInterop/               Interop.zkemkeeper.dll (generated COM shim, do not hand-edit)
frontend/                  Next.js app (devices / employees / logs pages)
```

### Frontend & UI governance

Three layered, portable rule files. **On conflict: usability > engineering > aesthetics.**
1. [`uiux-principles.md`](./.claude/ui/uiux-principles.md) — usability, accessibility, layout grid, component states. Hard floor.
2. [`frontend-rules.md`](./.claude/frontend/frontend-rules.md) — architecture, state, data flow, clean code, performance.
3. [`frontend-design.md`](./.claude/ui/frontend-design.md) — visual direction, typography.

Project-specific frontend/backend/git conventions live in `.claude/rules/` and override the portable files above.

## Commands (frontend)

```
pnpm install --frozen-lockfile
pnpm lint
pnpm build
```

Runs on port 5000 (`pnpm dev` / `pnpm start`).

## Commands (backend)

```
dotnet build
dotnet run --project backend/AttendanceApi
```

API runs on `http://localhost:5098` by default (see `frontend/env.example` → `API_BASE_URL`).

### EF Core migrations need an AnyCPU build

`dotnet ef` runs 64-bit and cannot load the x86 output, failing with
`Could not load assembly 'AttendanceApi'`. Build AnyCPU first, then run the tool
against that build — and rebuild normally afterwards so the runtime output is x86 again:

```
cd backend/AttendanceApi
dotnet build -p:PlatformTarget=AnyCPU --no-incremental
dotnet ef migrations add <Name> --no-build
dotnet build -p:PlatformTarget=AnyCPU --no-incremental   # recompile so the snapshot is current
dotnet ef database update --no-build
dotnet build --no-incremental                            # back to x86
```

`--no-build` reads the *compiled* model snapshot, so skipping the second rebuild makes
EF diff against a stale model and report phantom pending changes.

## Non-negotiable rules (IMPORTANT)

1. **Never commit secrets.** `.env`/connection strings gitignored; `env.example` committed with keys, no values.
2. **The API must stay x86.** `zkemkeeper.dll` is a 32-bit-only COM server — do not change `PlatformTarget` or add code that assumes a 64-bit process.
3. **`Migrations/` is the source of truth for schema.** Never hand-edit the database; add an EF Core migration.
4. **No `any`, no `!` assertions.** (Details: `.claude/rules/typescript-base.md`)

## Workflow

- Conventional Commits, imperative mood. Small focused PRs off `main`. Red CI never merges. (`.claude/rules/git.md`)
