# SFPL Attendance System

Attendance tracking for ZKTeco biometric terminals. Pulls users and attendance logs from devices, stores them in PostgreSQL, and surfaces devices/employees/attendance logs in a web UI.

## Stack

- **Backend:** .NET 10 Web API (`AttendanceApi`) — Controllers → Services → EF Core (Npgsql), no CQRS/MediatR.
- **Database:** PostgreSQL, plain EF Core — no RLS/multi-tenancy.
- **Device integration:** two independent paths.
  - **Pull** — `DevicesController`'s `/sync` endpoint uses the ZKTeco `zkemkeeper.dll` COM SDK to actively fetch users/logs from a device. This forces the API to run as a 32-bit (x86) process, and `zkemkeeper.dll` must be registered (`regsvr32`) on any machine that runs it.
  - **Push (ADMS)** — `AdmsController` (`/iclock/*`) receives data the terminal pushes on its own, over plain HTTP/text, when configured under the device's COMM > Cloud Server Setting. No COM interop and no x86 requirement for this path.
- **Frontend:** Next.js 16 (App Router) + React 19 + Tailwind 4, pnpm. Plain `fetch`-based API client talking to the backend over HTTP; Server Actions for mutations.

## Repository map

```
backend/AttendanceApi/    .NET 10 Web API
  Controllers/             Adms (ADMS push, no zkemkeeper), Devices (zkemkeeper pull), Employees, AttendanceLogs, Dashboard
  Services/                DeviceSyncService, ZkemkeeperDeviceClient (COM pull path only)
  Models/                  Device, Employee, AttendanceLog (EF entities)
  Data/                    AttendanceDbContext
  Migrations/              EF Core migrations (source of truth for schema)
  ComInterop/               Interop.zkemkeeper.dll (generated COM shim, do not hand-edit)
frontend/                  Next.js app (devices / employees / logs pages)
```

## Prerequisites

- .NET 10 SDK (x86/32-bit runtime available on Windows)
- PostgreSQL
- Node.js + [pnpm](https://pnpm.io/)
- Windows, with `zkemkeeper.dll` registered via `regsvr32` if you need real device I/O (not required to browse the UI against existing data)

## Getting started

### Backend

```bash
cd backend/AttendanceApi
dotnet user-secrets set "ConnectionStrings:Default" "Host=localhost;Port=5432;Database=attendance;Username=attendance;Password=attendance"
dotnet ef database update
dotnet run
```

The connection string is kept out of the repo via [.NET user-secrets](https://learn.microsoft.com/aspnet/core/security/app-secrets) rather than `appsettings.Development.json`. The API listens on `http://localhost:5098` by default.

### Frontend

```bash
cd frontend
cp env.example .env.local   # set API_BASE_URL if it differs
pnpm install --frozen-lockfile
pnpm dev
```

The app runs on port 5000.

## Commands

**Backend**

```bash
dotnet build
dotnet run --project backend/AttendanceApi
```

EF Core migrations need an AnyCPU build first — `dotnet ef` runs 64-bit and cannot
load the x86 output. See `CLAUDE.md` → "EF Core migrations need an AnyCPU build".

**Frontend**

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm build
```

## Daily attendance

Punches roll up into one `DailyAttendance` row per active employee per working day.
The rollup runs automatically after every ingest (ADMS push and device pull), and a
`BackgroundService` closes each day out at **23:45 Asia/Dhaka**, writing `Absent` rows
for anyone who never punched. On startup it also sweeps the previous 7 days, so a night
of downtime heals itself.

- **Business timezone is fixed to `Asia/Dhaka`** (`Services/BusinessTime.cs`). Timestamps
  stay UTC in the database; every day boundary and late check converts through that one class.
- **Check-in / check-out are `MIN` / `MAX` of the day's punches across all devices.** The
  device `InOutMode` flag is ignored — most deployments leave it at 0.
- **Office hours, grace period and weekend days** live in the single-row `WorkSchedule`
  table, editable via `PUT /api/work-schedule`. Late minutes are counted past
  `StartTime + GraceMinutes`, so they are always 0 for a `Present` day.
- **Changing the schedule does not rewrite history.** Follow it with
  `POST /api/attendance-days/recompute` (`{ "from": "...", "to": "..." }`) for the range
  that should be re-derived.
- **`Employee.IsActive` / `JoinDate`** decide who absence is generated for. Set them on
  the Employees page — they are not device-owned.

Deployment notes:

- The 23:45 job only fires while the process is alive. Under IIS, enable app-pool
  `startMode=AlwaysRunning` with Application Initialization and disable the idle timeout,
  or host the API as a Windows Service / console process.
- **Night shifts are not supported.** A shift crossing midnight splits into two business
  days: the first gets a check-in with no check-out, the second an unusually early
  check-in. Supporting them means adding a day-start hour to `WorkSchedule`, which
  `BusinessTime.ToBusinessDate` can absorb in one place.
- Device clocks are assumed to be set to the office timezone. Punches stored before this
  rollup shipped were converted using the *API host's* timezone; if that host was not on
  UTC+6, those historical timestamps are shifted and recomputing will not fix them.

## Non-negotiables

- Never commit secrets. `.env` files are gitignored; `env.example` is committed with keys but no values.
- The API must stay x86 — `zkemkeeper.dll` is a 32-bit-only COM server.
- `Migrations/` is the source of truth for schema; never hand-edit the database.
- No `any`, no `!` assertions in TypeScript.

## Workflow

Conventional Commits, imperative mood. Small, focused PRs off `main`. CI must be green before merge.

See [`CLAUDE.md`](./CLAUDE.md) for full contributor/agent guidance.
