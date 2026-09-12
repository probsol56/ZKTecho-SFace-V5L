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
dotnet ef migrations add <Name> --project backend/AttendanceApi
dotnet ef database update --project backend/AttendanceApi
```

**Frontend**

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm build
```

## Non-negotiables

- Never commit secrets. `.env` files are gitignored; `env.example` is committed with keys but no values.
- The API must stay x86 — `zkemkeeper.dll` is a 32-bit-only COM server.
- `Migrations/` is the source of truth for schema; never hand-edit the database.
- No `any`, no `!` assertions in TypeScript.

## Workflow

Conventional Commits, imperative mood. Small, focused PRs off `main`. CI must be green before merge.

See [`CLAUDE.md`](./CLAUDE.md) for full contributor/agent guidance.
