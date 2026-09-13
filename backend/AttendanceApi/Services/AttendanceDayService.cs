using AttendanceApi.Data;
using AttendanceApi.Models;
using Microsoft.EntityFrameworkCore;

namespace AttendanceApi.Services;

public readonly record struct AttendanceDayKey(int EmployeeId, DateOnly WorkDate);

public record RecomputeOutcome(int DaysProcessed, int RowsWritten, int RowsDeleted, int AbsencesCreated)
{
    public static readonly RecomputeOutcome Empty = new(0, 0, 0, 0);

    public RecomputeOutcome Add(RecomputeOutcome other) => new(
        DaysProcessed + other.DaysProcessed,
        RowsWritten + other.RowsWritten,
        RowsDeleted + other.RowsDeleted,
        AbsencesCreated + other.AbsencesCreated);
}

// Derives DailyAttendance rows from raw punches. Every write is an idempotent upsert
// keyed on (EmployeeId, WorkDate), so running this twice over the same inputs is free
// and a stale result always heals on the next run.
public class AttendanceDayService(AttendanceDbContext db, ILogger<AttendanceDayService> logger)
{
    public const int MaxRecomputeDays = 366;

    // Two punches recorded within this window are the same event seen twice - most
    // often the same person picked up by two terminals on the same second, which the
    // (EmployeeId, DeviceId, Timestamp) unique index stores as two rows. Without this
    // a single punch would read as "checked out at check-in time, 0 minutes worked".
    private static readonly TimeSpan MinimumCheckOutGap = TimeSpan.FromMinutes(1);

    // Only the employee-days a punch batch actually touched. Never creates absences -
    // a key exists here precisely because a punch exists.
    public async Task<RecomputeOutcome> RecomputeAsync(
        IReadOnlyCollection<AttendanceDayKey> keys, CancellationToken ct)
    {
        if (keys.Count == 0) return RecomputeOutcome.Empty;

        var schedule = await GetScheduleAsync(ct);
        var employeeIds = keys.Select(k => k.EmployeeId).Distinct().ToList();
        var from = keys.Min(k => k.WorkDate);
        var to = keys.Max(k => k.WorkDate);

        var punchesByKey = await LoadPunchesAsync(from, to, employeeIds, ct);

        var outcome = RecomputeOutcome.Empty;
        foreach (var key in keys.Distinct())
        {
            outcome = outcome.Add(await WriteDayAsync(key, punchesByKey.GetValueOrDefault(key), schedule, ct));
        }
        return outcome;
    }

    // Backfill, nightly finalisation, and post-rule-change repair all go through here.
    // employeeIds null means everyone.
    public async Task<RecomputeOutcome> RecomputeRangeAsync(
        DateOnly from,
        DateOnly to,
        IReadOnlyCollection<int>? employeeIds,
        bool includeAbsences,
        CancellationToken ct)
    {
        if (to < from) throw new ArgumentException("End date must not precede start date.", nameof(to));

        var schedule = await GetScheduleAsync(ct);
        var outcome = RecomputeOutcome.Empty;

        // Chunk by month so a year-long backfill never materialises one huge punch list
        // (the API runs as a 32-bit process - see the x86 constraint in CLAUDE.md).
        foreach (var (chunkFrom, chunkTo) in MonthChunks(from, to))
        {
            outcome = outcome.Add(
                await RecomputeChunkAsync(chunkFrom, chunkTo, employeeIds, includeAbsences, schedule, ct));
        }

        logger.LogInformation(
            "Recomputed attendance {From}..{To}: {DaysProcessed} employee-days, {RowsWritten} written, {RowsDeleted} deleted, {AbsencesCreated} absences",
            from, to, outcome.DaysProcessed, outcome.RowsWritten, outcome.RowsDeleted, outcome.AbsencesCreated);

        return outcome;
    }

    public async Task<WorkSchedule> GetScheduleAsync(CancellationToken ct) =>
        await db.WorkSchedules.AsNoTracking().FirstOrDefaultAsync(s => s.Id == WorkSchedule.SingletonId, ct)
        ?? throw new InvalidOperationException(
            "Work schedule row is missing. It is seeded by migration - run 'dotnet ef database update'.");

    private async Task<RecomputeOutcome> RecomputeChunkAsync(
        DateOnly from,
        DateOnly to,
        IReadOnlyCollection<int>? employeeIds,
        bool includeAbsences,
        WorkSchedule schedule,
        CancellationToken ct)
    {
        var punchesByKey = await LoadPunchesAsync(from, to, employeeIds, ct);

        var outcome = RecomputeOutcome.Empty;
        var expected = includeAbsences ? await LoadRosterAsync(employeeIds, ct) : [];

        for (var date = from; date <= to; date = date.AddDays(1))
        {
            if (schedule.IsWeekend(date.DayOfWeek))
            {
                outcome = outcome.Add(new RecomputeOutcome(1, 0, await DeleteDayAsync(date, employeeIds, ct), 0));
                continue;
            }

            var punched = new HashSet<int>();
            foreach (var (key, punches) in punchesByKey.Where(p => p.Key.WorkDate == date))
            {
                punched.Add(key.EmployeeId);
                outcome = outcome.Add(await WriteDayAsync(key, punches, schedule, ct));
            }

            foreach (var employee in expected.Where(e => !punched.Contains(e.Id) && HasJoined(e, date)))
            {
                await UpsertAsync(AbsentRow(employee.Id, date), ct);
                outcome = outcome.Add(new RecomputeOutcome(0, 1, 0, 1));
            }

            // An employee who left, or whose join date moved, leaves an absence row
            // behind that recompute must be able to clear.
            outcome = outcome.Add(new RecomputeOutcome(
                1, 0, await DeleteOrphanedAbsencesAsync(date, expected, punched, employeeIds, includeAbsences, ct), 0));
        }

        return outcome;
    }

    private async Task<RecomputeOutcome> WriteDayAsync(
        AttendanceDayKey key,
        List<DateTime>? punches,
        WorkSchedule schedule,
        CancellationToken ct)
    {
        if (schedule.IsWeekend(key.WorkDate.DayOfWeek))
        {
            return new RecomputeOutcome(1, 0, await DeleteDayAsync(key.WorkDate, [key.EmployeeId], ct), 0);
        }

        if (punches is null || punches.Count == 0)
        {
            await UpsertAsync(AbsentRow(key.EmployeeId, key.WorkDate), ct);
            return new RecomputeOutcome(1, 1, 0, 1);
        }

        var checkIn = punches.Min();
        var checkOut = punches.Max();
        var hasCheckOut = checkOut - checkIn >= MinimumCheckOutGap;

        // Late minutes are counted past the grace boundary, not past the official start,
        // so LateMinutes is always 0 when the status is Present.
        var checkInLocal = BusinessTime.ToBusinessTime(checkIn);
        var lateMinutes = checkInLocal > schedule.LateAfter
            ? (int)(checkInLocal - schedule.LateAfter).TotalMinutes
            : 0;

        await UpsertAsync(new DailyAttendance
        {
            EmployeeId = key.EmployeeId,
            WorkDate = key.WorkDate,
            Status = lateMinutes > 0 ? AttendanceStatus.Late : AttendanceStatus.Present,
            CheckInAt = checkIn,
            CheckOutAt = hasCheckOut ? checkOut : null,
            WorkedMinutes = hasCheckOut ? (int)Math.Round((checkOut - checkIn).TotalMinutes) : 0,
            LateMinutes = lateMinutes,
            PunchCount = punches.Count,
            ComputedAt = DateTime.UtcNow,
        }, ct);

        return new RecomputeOutcome(1, 1, 0, 0);
    }

    // Bucketing happens here rather than in SQL on purpose: any expression over
    // "Timestamp" (AT TIME ZONE, date_trunc) rules out the plain index on it, and
    // date_trunc against timestamptz silently resolves using the connection's session
    // TimeZone. Keeping one timezone authority in C# is worth the round trip.
    private async Task<Dictionary<AttendanceDayKey, List<DateTime>>> LoadPunchesAsync(
        DateOnly from, DateOnly to, IReadOnlyCollection<int>? employeeIds, CancellationToken ct)
    {
        var (startUtc, endUtc) = BusinessTime.UtcRange(from, to);

        var query = db.AttendanceLogs
            .AsNoTracking()
            .Where(l => l.Timestamp >= startUtc && l.Timestamp < endUtc);

        if (employeeIds is not null) query = query.Where(l => employeeIds.Contains(l.EmployeeId));

        var punches = await query
            .Select(l => new { l.EmployeeId, l.Timestamp })
            .ToListAsync(ct);

        return punches
            .GroupBy(p => new AttendanceDayKey(p.EmployeeId, BusinessTime.ToBusinessDate(p.Timestamp)))
            .ToDictionary(g => g.Key, g => g.Select(p => p.Timestamp).ToList());
    }

    private async Task<List<RosterEntry>> LoadRosterAsync(
        IReadOnlyCollection<int>? employeeIds, CancellationToken ct)
    {
        var query = db.Employees.AsNoTracking().Where(e => e.IsActive);
        if (employeeIds is not null) query = query.Where(e => employeeIds.Contains(e.Id));

        return await query.Select(e => new RosterEntry(e.Id, e.JoinDate)).ToListAsync(ct);
    }

    private Task<int> DeleteDayAsync(DateOnly date, IReadOnlyCollection<int>? employeeIds, CancellationToken ct)
    {
        var query = db.DailyAttendance.Where(d => d.WorkDate == date);
        if (employeeIds is not null) query = query.Where(d => employeeIds.Contains(d.EmployeeId));

        return query.ExecuteDeleteAsync(ct);
    }

    private Task<int> DeleteOrphanedAbsencesAsync(
        DateOnly date,
        List<RosterEntry> expected,
        HashSet<int> punched,
        IReadOnlyCollection<int>? employeeIds,
        bool includeAbsences,
        CancellationToken ct)
    {
        if (!includeAbsences) return Task.FromResult(0);

        var stillExpected = expected.Where(e => HasJoined(e, date)).Select(e => e.Id).ToList();
        var keep = punched.Concat(stillExpected).Distinct().ToList();

        var query = db.DailyAttendance.Where(d => d.WorkDate == date && !keep.Contains(d.EmployeeId));
        if (employeeIds is not null) query = query.Where(d => employeeIds.Contains(d.EmployeeId));

        return query.ExecuteDeleteAsync(ct);
    }

    // EF has no upsert. ExecuteUpdate-then-insert-if-zero races (two writers both see
    // zero rows) and retrying a failed SaveChanges leaves the change tracker dirty, so
    // use the database primitive against the (EmployeeId, WorkDate) unique index.
    private Task<int> UpsertAsync(DailyAttendance row, CancellationToken ct) =>
        db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "DailyAttendance"
                ("EmployeeId", "WorkDate", "Status", "CheckInAt", "CheckOutAt",
                 "WorkedMinutes", "LateMinutes", "PunchCount", "ComputedAt")
            VALUES ({row.EmployeeId}, {row.WorkDate}, {(int)row.Status}, {row.CheckInAt}, {row.CheckOutAt},
                    {row.WorkedMinutes}, {row.LateMinutes}, {row.PunchCount}, {row.ComputedAt})
            ON CONFLICT ("EmployeeId", "WorkDate") DO UPDATE SET
                "Status"        = EXCLUDED."Status",
                "CheckInAt"     = EXCLUDED."CheckInAt",
                "CheckOutAt"    = EXCLUDED."CheckOutAt",
                "WorkedMinutes" = EXCLUDED."WorkedMinutes",
                "LateMinutes"   = EXCLUDED."LateMinutes",
                "PunchCount"    = EXCLUDED."PunchCount",
                "ComputedAt"    = EXCLUDED."ComputedAt"
            """, ct);

    private static DailyAttendance AbsentRow(int employeeId, DateOnly date) => new()
    {
        EmployeeId = employeeId,
        WorkDate = date,
        Status = AttendanceStatus.Absent,
        ComputedAt = DateTime.UtcNow,
    };

    private static bool HasJoined(RosterEntry employee, DateOnly date) =>
        employee.JoinDate is null || employee.JoinDate <= date;

    private static IEnumerable<(DateOnly From, DateOnly To)> MonthChunks(DateOnly from, DateOnly to)
    {
        var cursor = from;
        while (cursor <= to)
        {
            var monthEnd = new DateOnly(cursor.Year, cursor.Month, DateTime.DaysInMonth(cursor.Year, cursor.Month));
            var chunkEnd = monthEnd < to ? monthEnd : to;
            yield return (cursor, chunkEnd);
            cursor = chunkEnd.AddDays(1);
        }
    }

    private readonly record struct RosterEntry(int Id, DateOnly? JoinDate);
}
