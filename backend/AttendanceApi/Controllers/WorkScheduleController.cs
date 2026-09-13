using System.Globalization;
using AttendanceApi.Data;
using AttendanceApi.Models;
using AttendanceApi.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AttendanceApi.Controllers;

public record WorkScheduleResponse(
    TimeOnly StartTime,
    TimeOnly EndTime,
    int GraceMinutes,
    List<string> WeekendDays,
    string TimeZoneId,
    DateTime UpdatedAt);

public record UpdateWorkScheduleRequest(
    string StartTime,
    string EndTime,
    int GraceMinutes,
    List<string> WeekendDays);

[ApiController]
[Route("api/work-schedule")]
public class WorkScheduleController(AttendanceDbContext db) : ControllerBase
{
    private const int MaxGraceMinutes = 240;
    private const string TimeFormat = "HH:mm";

    [HttpGet]
    public async Task<ActionResult<WorkScheduleResponse>> Get(CancellationToken ct)
    {
        var schedule = await LoadAsync(ct);
        return ToResponse(schedule);
    }

    // Deliberately does not rewrite history: a rule change over a year of data would
    // turn this into a surprise multi-minute request. Follow up with
    // POST /api/attendance-days/recompute for the range that should be re-derived.
    [HttpPut]
    public async Task<ActionResult<WorkScheduleResponse>> Update(
        [FromBody] UpdateWorkScheduleRequest request,
        CancellationToken ct)
    {
        if (!TryParseTime(request.StartTime, out var startTime)) return BadRequest($"StartTime must be {TimeFormat}.");
        if (!TryParseTime(request.EndTime, out var endTime)) return BadRequest($"EndTime must be {TimeFormat}.");
        if (endTime <= startTime) return BadRequest("EndTime must be after StartTime.");

        if (request.GraceMinutes < 0 || request.GraceMinutes > MaxGraceMinutes)
        {
            return BadRequest($"GraceMinutes must be between 0 and {MaxGraceMinutes}.");
        }

        var weekendDays = new List<DayOfWeek>();
        foreach (var name in request.WeekendDays ?? [])
        {
            if (!Enum.TryParse<DayOfWeek>(name, ignoreCase: true, out var day))
            {
                return BadRequest($"'{name}' is not a day of the week.");
            }
            if (!weekendDays.Contains(day)) weekendDays.Add(day);
        }

        if (weekendDays.Count >= 7) return BadRequest("At least one working day is required.");

        var schedule = await LoadAsync(ct);
        schedule.StartTime = startTime;
        schedule.EndTime = endTime;
        schedule.GraceMinutes = request.GraceMinutes;
        schedule.SetWeekendDays(weekendDays);
        schedule.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);

        return ToResponse(schedule);
    }

    private async Task<WorkSchedule> LoadAsync(CancellationToken ct) =>
        await db.WorkSchedules.FirstOrDefaultAsync(s => s.Id == WorkSchedule.SingletonId, ct)
        ?? throw new InvalidOperationException(
            "Work schedule row is missing. It is seeded by migration - run 'dotnet ef database update'.");

    private static WorkScheduleResponse ToResponse(WorkSchedule schedule) => new(
        schedule.StartTime,
        schedule.EndTime,
        schedule.GraceMinutes,
        schedule.WeekendDays().Select(d => d.ToString()).ToList(),
        BusinessTime.IanaTimeZoneId,
        schedule.UpdatedAt);

    private static bool TryParseTime(string value, out TimeOnly time) =>
        TimeOnly.TryParseExact(value, TimeFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out time);
}
