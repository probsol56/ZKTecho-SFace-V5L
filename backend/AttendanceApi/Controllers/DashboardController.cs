using AttendanceApi.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AttendanceApi.Controllers;

public record DeviceStatusResponse(
    int Id,
    string Name,
    string IpAddress,
    string? SerialNumber,
    DateTime? LastSyncedAt,
    string Status,
    int TodayLogCount);

public record DashboardSummaryResponse(
    int TotalDevices,
    int OnlineDevices,
    int OfflineDevices,
    int TotalEmployees,
    int TodayLogCount,
    List<DeviceStatusResponse> Devices);

// Aggregates device connectivity and sync activity for the landing dashboard.
// A device is considered "online" while its ADMS heartbeat/push traffic is
// recent - terminals poll getrequest and push cdata roughly every 30s
// (see AdmsController.Handshake's Delay=30 config), so anything older than
// OnlineThreshold has missed several cycles.
[ApiController]
[Route("api/[controller]")]
public class DashboardController(AttendanceDbContext db) : ControllerBase
{
    private static readonly TimeSpan OnlineThreshold = TimeSpan.FromMinutes(2);

    [HttpGet("summary")]
    public async Task<ActionResult<DashboardSummaryResponse>> GetSummary(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var todayStart = DateTime.SpecifyKind(DateTime.Today, DateTimeKind.Utc);
        var todayEnd = todayStart.AddDays(1);

        var devices = await db.Devices.OrderBy(d => d.Name).ToListAsync(ct);

        var todayLogCountsByDevice = await db.AttendanceLogs
            .Where(l => l.Timestamp >= todayStart && l.Timestamp < todayEnd)
            .GroupBy(l => l.DeviceId)
            .Select(g => new { DeviceId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.DeviceId, g => g.Count, ct);

        var deviceStatuses = devices
            .Select(d => new DeviceStatusResponse(
                d.Id,
                d.Name,
                d.IpAddress,
                d.SerialNumber,
                d.LastSyncedAt,
                ResolveStatus(d.LastSyncedAt, now),
                todayLogCountsByDevice.GetValueOrDefault(d.Id)))
            .ToList();

        var onlineDevices = deviceStatuses.Count(d => d.Status == "online");
        var totalEmployees = await db.Employees.CountAsync(ct);

        return new DashboardSummaryResponse(
            TotalDevices: deviceStatuses.Count,
            OnlineDevices: onlineDevices,
            OfflineDevices: deviceStatuses.Count - onlineDevices,
            TotalEmployees: totalEmployees,
            TodayLogCount: todayLogCountsByDevice.Values.Sum(),
            Devices: deviceStatuses);
    }

    private static string ResolveStatus(DateTime? lastSyncedAt, DateTime now)
    {
        if (lastSyncedAt is null) return "never";
        return now - lastSyncedAt.Value <= OnlineThreshold ? "online" : "offline";
    }
}
