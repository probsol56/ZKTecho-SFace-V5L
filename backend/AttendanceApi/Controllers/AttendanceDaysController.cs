using System.Globalization;
using AttendanceApi.Data;
using AttendanceApi.Models;
using AttendanceApi.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AttendanceApi.Controllers;

public record DailyAttendanceRow(
    int EmployeeId,
    string EmployeeName,
    string DeviceUserId,
    string Status,
    DateTime? CheckInAt,
    DateTime? CheckOutAt,
    string? CheckInLocal,
    string? CheckOutLocal,
    int WorkedMinutes,
    int LateMinutes,
    int PunchCount);

public record DailyAttendanceSummary(
    int TotalEmployees,
    int Present,
    int Late,
    int Absent,
    int Leave,
    int Pending,
    int TotalWorkedMinutes,
    int TotalLateMinutes);

public record DailyAttendanceListResponse(
    DateOnly Date,
    bool IsWeekend,
    bool IsFinalized,
    string TimeZoneId,
    DailyAttendanceSummary Summary,
    PagedResult<DailyAttendanceRow> Employees);

public record EmployeeMonthDay(
    DateOnly Date,
    string DayOfWeek,
    bool IsWeekend,
    string Status,
    string? CheckInLocal,
    string? CheckOutLocal,
    int WorkedMinutes,
    int LateMinutes);

public record EmployeeMonthTotals(
    int PresentDays,
    int LateDays,
    int AbsentDays,
    int LeaveDays,
    int WeekendDays,
    int WorkingDays,
    int TotalWorkedMinutes,
    int TotalLateMinutes);

public record EmployeeMonthResponse(
    int EmployeeId,
    string EmployeeName,
    string DeviceUserId,
    string Month,
    DateOnly FromDate,
    DateOnly ToDate,
    string TimeZoneId,
    EmployeeMonthTotals Totals,
    List<EmployeeMonthDay> Days);

public record RecomputeRequest(DateOnly From, DateOnly To, List<int>? EmployeeIds);

public record RecomputeResponse(int DaysProcessed, int RowsWritten, int RowsDeleted, int AbsencesCreated);

[ApiController]
[Route("api/attendance-days")]
public class AttendanceDaysController(AttendanceDbContext db, AttendanceDayService attendanceDays) : ControllerBase
{
    private const int MaxPageSize = 200;
    private const int DefaultPageSize = 50;
    private const string MonthFormat = "yyyy-MM";
    private const string TimeFormat = "HH:mm";

    // A day the finaliser has not closed out yet. Only ever a display value - the
    // stored enum stays Present/Late/Absent/Leave.
    private const string PendingStatus = "Pending";

    // Weekends are never stored - the monthly grid still needs a label for them.
    private const string WeekendStatus = "Weekend";

    [HttpGet]
    public async Task<ActionResult<DailyAttendanceListResponse>> GetDay(
        [FromQuery] DateOnly? date,
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = DefaultPageSize,
        CancellationToken ct = default)
    {
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);
        page = Math.Max(page, 1);

        var workDate = date ?? BusinessTime.Today();
        var schedule = await attendanceDays.GetScheduleAsync(ct);
        var isWeekend = schedule.IsWeekend(workDate.DayOfWeek);
        var isFinalized = workDate < BusinessTime.Today();

        var rows = isWeekend ? [] : await BuildDayRowsAsync(workDate, isFinalized, ct);
        var summary = Summarize(rows);

        var filtered = string.IsNullOrWhiteSpace(status)
            ? rows
            : rows.Where(r => string.Equals(r.Status, status, StringComparison.OrdinalIgnoreCase)).ToList();

        var totalPages = filtered.Count == 0 ? 0 : (int)Math.Ceiling(filtered.Count / (double)pageSize);
        var items = filtered.Skip((page - 1) * pageSize).Take(pageSize).ToList();

        return new DailyAttendanceListResponse(
            workDate,
            isWeekend,
            isFinalized,
            BusinessTime.IanaTimeZoneId,
            summary,
            new PagedResult<DailyAttendanceRow>(items, page, pageSize, filtered.Count, totalPages));
    }

    [HttpGet("employees/{employeeId:int}")]
    public async Task<ActionResult<EmployeeMonthResponse>> GetEmployeeMonth(
        int employeeId,
        [FromQuery] string? month,
        CancellationToken ct = default)
    {
        if (!TryResolveMonth(month, out var firstDay))
        {
            return BadRequest($"Month must be in {MonthFormat} format.");
        }

        var employee = await db.Employees
            .AsNoTracking()
            .Where(e => e.Id == employeeId)
            .Select(e => new { e.Id, e.Name, e.DeviceUserId, e.JoinDate })
            .FirstOrDefaultAsync(ct);

        if (employee is null) return NotFound();

        var lastDay = firstDay.AddMonths(1).AddDays(-1);
        var schedule = await attendanceDays.GetScheduleAsync(ct);
        var today = BusinessTime.Today();

        var stored = await db.DailyAttendance
            .AsNoTracking()
            .Where(d => d.EmployeeId == employeeId && d.WorkDate >= firstDay && d.WorkDate <= lastDay)
            .ToDictionaryAsync(d => d.WorkDate, ct);

        var days = new List<EmployeeMonthDay>();
        for (var date = firstDay; date <= lastDay; date = date.AddDays(1))
        {
            var isWeekend = schedule.IsWeekend(date.DayOfWeek);
            stored.TryGetValue(date, out var row);

            days.Add(new EmployeeMonthDay(
                date,
                date.DayOfWeek.ToString(),
                isWeekend,
                isWeekend ? WeekendStatus : ResolveStatus(row, date < today, HasJoined(employee.JoinDate, date)),
                row?.CheckInAt is { } checkIn ? FormatLocalTime(checkIn) : null,
                row?.CheckOutAt is { } checkOut ? FormatLocalTime(checkOut) : null,
                row?.WorkedMinutes ?? 0,
                row?.LateMinutes ?? 0));
        }

        return new EmployeeMonthResponse(
            employee.Id,
            employee.Name,
            employee.DeviceUserId,
            firstDay.ToString(MonthFormat, CultureInfo.InvariantCulture),
            firstDay,
            lastDay,
            BusinessTime.IanaTimeZoneId,
            Totalize(days),
            days);
    }

    [HttpPost("recompute")]
    public async Task<ActionResult<RecomputeResponse>> Recompute(
        [FromBody] RecomputeRequest request,
        CancellationToken ct)
    {
        if (request.To < request.From)
        {
            return BadRequest("End date must not precede start date.");
        }

        if (request.To > BusinessTime.Today())
        {
            return BadRequest("End date must not be in the future.");
        }

        var days = request.To.DayNumber - request.From.DayNumber + 1;
        if (days > AttendanceDayService.MaxRecomputeDays)
        {
            return BadRequest($"Range must not exceed {AttendanceDayService.MaxRecomputeDays} days.");
        }

        var outcome = await attendanceDays.RecomputeRangeAsync(
            request.From, request.To, request.EmployeeIds, includeAbsences: true, ct);

        return new RecomputeResponse(
            outcome.DaysProcessed, outcome.RowsWritten, outcome.RowsDeleted, outcome.AbsencesCreated);
    }

    // Status is derived from the roster on read rather than trusted from the table, so
    // a day the finaliser never closed still reports correctly, and an in-progress day
    // reads Pending instead of showing everyone Absent at 09:00.
    private async Task<List<DailyAttendanceRow>> BuildDayRowsAsync(
        DateOnly workDate, bool isFinalized, CancellationToken ct)
    {
        var stored = await db.DailyAttendance
            .AsNoTracking()
            .Where(d => d.WorkDate == workDate)
            .ToDictionaryAsync(d => d.EmployeeId, ct);

        // Someone who has left still appears for a day they actually worked.
        var employees = await db.Employees
            .AsNoTracking()
            .Where(e => e.IsActive || stored.Keys.Contains(e.Id))
            .Where(e => e.JoinDate == null || e.JoinDate <= workDate)
            .OrderBy(e => e.Name)
            .Select(e => new { e.Id, e.Name, e.DeviceUserId })
            .ToListAsync(ct);

        return employees
            .Select(e =>
            {
                stored.TryGetValue(e.Id, out var row);
                return new DailyAttendanceRow(
                    e.Id,
                    e.Name,
                    e.DeviceUserId,
                    ResolveStatus(row, isFinalized, hasJoined: true),
                    row?.CheckInAt,
                    row?.CheckOutAt,
                    row?.CheckInAt is { } checkIn ? FormatLocalTime(checkIn) : null,
                    row?.CheckOutAt is { } checkOut ? FormatLocalTime(checkOut) : null,
                    row?.WorkedMinutes ?? 0,
                    row?.LateMinutes ?? 0,
                    row?.PunchCount ?? 0);
            })
            .ToList();
    }

    private static string ResolveStatus(DailyAttendance? row, bool isFinalized, bool hasJoined)
    {
        if (row is not null) return row.Status.ToString();
        if (!hasJoined) return PendingStatus;
        return isFinalized ? nameof(AttendanceStatus.Absent) : PendingStatus;
    }

    private static DailyAttendanceSummary Summarize(List<DailyAttendanceRow> rows) => new(
        TotalEmployees: rows.Count,
        Present: rows.Count(r => r.Status == nameof(AttendanceStatus.Present)),
        Late: rows.Count(r => r.Status == nameof(AttendanceStatus.Late)),
        Absent: rows.Count(r => r.Status == nameof(AttendanceStatus.Absent)),
        Leave: rows.Count(r => r.Status == nameof(AttendanceStatus.Leave)),
        Pending: rows.Count(r => r.Status == PendingStatus),
        TotalWorkedMinutes: rows.Sum(r => r.WorkedMinutes),
        TotalLateMinutes: rows.Sum(r => r.LateMinutes));

    private static EmployeeMonthTotals Totalize(List<EmployeeMonthDay> days) => new(
        PresentDays: days.Count(d => d.Status == nameof(AttendanceStatus.Present)),
        LateDays: days.Count(d => d.Status == nameof(AttendanceStatus.Late)),
        AbsentDays: days.Count(d => d.Status == nameof(AttendanceStatus.Absent)),
        LeaveDays: days.Count(d => d.Status == nameof(AttendanceStatus.Leave)),
        WeekendDays: days.Count(d => d.IsWeekend),
        WorkingDays: days.Count(d => !d.IsWeekend),
        TotalWorkedMinutes: days.Sum(d => d.WorkedMinutes),
        TotalLateMinutes: days.Sum(d => d.LateMinutes));

    private static bool HasJoined(DateOnly? joinDate, DateOnly date) => joinDate is null || joinDate <= date;

    private static string FormatLocalTime(DateTime utc) =>
        BusinessTime.ToBusinessTime(utc).ToString(TimeFormat, CultureInfo.InvariantCulture);

    private static bool TryResolveMonth(string? month, out DateOnly firstDay)
    {
        if (string.IsNullOrWhiteSpace(month))
        {
            var today = BusinessTime.Today();
            firstDay = new DateOnly(today.Year, today.Month, 1);
            return true;
        }

        return DateOnly.TryParseExact(
            $"{month}-01", $"{MonthFormat}-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out firstDay);
    }
}
