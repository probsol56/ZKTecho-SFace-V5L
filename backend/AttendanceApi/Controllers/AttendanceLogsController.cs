using AttendanceApi.Data;
using AttendanceApi.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AttendanceApi.Controllers;

public record AttendanceLogResponse(
    int Id,
    string EmployeeName,
    string DeviceUserId,
    string DeviceName,
    DateTime Timestamp,
    int VerifyMode,
    int InOutMode);

[ApiController]
[Route("api/[controller]")]
public class AttendanceLogsController(AttendanceDbContext db) : ControllerBase
{
    private const int MaxPageSize = 200;
    private const int DefaultPageSize = 20;

    [HttpGet]
    public async Task<ActionResult<PagedResult<AttendanceLogResponse>>> GetAll(
        [FromQuery] int? deviceId,
        [FromQuery] int? employeeId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = DefaultPageSize)
    {
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);
        page = Math.Max(page, 1);

        // No date filter selected: default to today only, instead of scanning the whole table.
        if (from is null && to is null)
        {
            var today = DateTime.SpecifyKind(DateTime.Today, DateTimeKind.Utc);
            from = today;
            to = today.AddDays(1).AddTicks(-1);
        }
        else
        {
            // Npgsql only accepts Kind=Utc for timestamptz; query-bound DateTimes can
            // arrive as Unspecified or Local depending on the input format.
            if (from is not null) from = ToUtc(from.Value);
            if (to is not null)
            {
                to = ToUtc(to.Value);
                // A date-only "to" (e.g. from a <input type="date">, midnight) means
                // "through the end of that day", not the exact instant of midnight.
                if (to.Value.TimeOfDay == TimeSpan.Zero) to = to.Value.AddDays(1).AddTicks(-1);
            }
        }

        var query = db.AttendanceLogs
            .Include(l => l.Employee)
            .Include(l => l.Device)
            .AsQueryable();

        if (deviceId is not null) query = query.Where(l => l.DeviceId == deviceId);
        if (employeeId is not null) query = query.Where(l => l.EmployeeId == employeeId);
        if (from is not null) query = query.Where(l => l.Timestamp >= from);
        if (to is not null) query = query.Where(l => l.Timestamp <= to);

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(l => l.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(l => new AttendanceLogResponse(
                l.Id, l.Employee.Name, l.Employee.DeviceUserId, l.Device.Name,
                l.Timestamp, l.VerifyMode, l.InOutMode))
            .ToListAsync();

        var totalPages = totalCount == 0 ? 0 : (int)Math.Ceiling(totalCount / (double)pageSize);

        return new PagedResult<AttendanceLogResponse>(items, page, pageSize, totalCount, totalPages);
    }

    private static DateTime ToUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Utc),
    };
}
