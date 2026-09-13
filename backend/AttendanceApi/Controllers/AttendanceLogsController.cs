using AttendanceApi.Data;
using AttendanceApi.Services;
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

        DateTime? toExclusive = null;

        // No date filter selected: default to today only, instead of scanning the whole table.
        if (from is null && to is null)
        {
            (from, toExclusive) = BusinessTime.UtcRange(BusinessTime.Today());
        }
        else
        {
            // Filter values come from <input type="date"> in the office timezone, so a
            // bare date means that Dhaka day - not the same instant in UTC.
            if (from is not null) from = ToBusinessDayStart(from.Value);
            if (to is not null) toExclusive = ToBusinessDayEndExclusive(to.Value);
        }

        var query = db.AttendanceLogs
            .Include(l => l.Employee)
            .Include(l => l.Device)
            .AsQueryable();

        if (deviceId is not null) query = query.Where(l => l.DeviceId == deviceId);
        if (employeeId is not null) query = query.Where(l => l.EmployeeId == employeeId);
        if (from is not null) query = query.Where(l => l.Timestamp >= from);
        if (toExclusive is not null) query = query.Where(l => l.Timestamp < toExclusive);

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

    private static DateTime ToBusinessDayStart(DateTime value) => BusinessTime.ToUtc(value);

    // A date-only "to" (a <input type="date"> value, midnight) means "through the end
    // of that day". Half-open, so a punch at the exact boundary belongs to one day only.
    private static DateTime ToBusinessDayEndExclusive(DateTime value) =>
        value.TimeOfDay == TimeSpan.Zero
            ? BusinessTime.ToUtc(value.AddDays(1))
            : BusinessTime.ToUtc(value);
}
