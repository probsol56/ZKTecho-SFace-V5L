using AttendanceApi.Data;
using AttendanceApi.Models;
using Microsoft.EntityFrameworkCore;

namespace AttendanceApi.Services;

public record SyncResult(int UsersUpserted, int LogsInserted);

public class DeviceSyncService(AttendanceDbContext db, IZkDeviceClient deviceClient, ILogger<DeviceSyncService> logger)
{
    public async Task<SyncResult> SyncAsync(int deviceId, CancellationToken ct = default)
    {
        var device = await db.Devices.FirstOrDefaultAsync(d => d.Id == deviceId, ct)
            ?? throw new KeyNotFoundException($"Device {deviceId} not found");

        var users = await deviceClient.GetUsersAsync(device.IpAddress, device.Port);
        var usersUpserted = await UpsertEmployeesAsync(users, ct);

        var logs = await deviceClient.GetAttendanceLogsAsync(device.IpAddress, device.Port);
        var logsInserted = await InsertNewLogsAsync(device, logs, ct);

        device.LastSyncedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        logger.LogInformation(
            "Synced device {DeviceName} ({DeviceId}): {UsersUpserted} users, {LogsInserted} new logs",
            device.Name, device.Id, usersUpserted, logsInserted);

        return new SyncResult(usersUpserted, logsInserted);
    }

    public async Task<int> UpsertEmployeesAsync(IReadOnlyList<DeviceUserRecord> users, CancellationToken ct)
    {
        if (users.Count == 0) return 0;

        var deviceUserIds = users.Select(u => u.DeviceUserId).ToList();
        var existing = await db.Employees
            .Where(e => deviceUserIds.Contains(e.DeviceUserId))
            .ToDictionaryAsync(e => e.DeviceUserId, ct);

        foreach (var user in users)
        {
            if (existing.TryGetValue(user.DeviceUserId, out var employee))
            {
                employee.Name = user.Name;
                employee.CardNumber = user.CardNumber;
                employee.Role = user.Role;
            }
            else
            {
                db.Employees.Add(new Employee
                {
                    DeviceUserId = user.DeviceUserId,
                    Name = user.Name,
                    CardNumber = user.CardNumber,
                    Role = user.Role,
                });
            }
        }

        await db.SaveChangesAsync(ct);
        return users.Count;
    }

    public async Task<int> InsertNewLogsAsync(Device device, IReadOnlyList<DeviceAttendanceRecord> logs, CancellationToken ct)
    {
        if (logs.Count == 0) return 0;

        var deviceUserIds = logs.Select(l => l.DeviceUserId).Distinct().ToList();
        var employeeIdsByDeviceUserId = await db.Employees
            .Where(e => deviceUserIds.Contains(e.DeviceUserId))
            .ToDictionaryAsync(e => e.DeviceUserId, e => e.Id, ct);

        var earliestTimestamp = logs.Min(l => l.Timestamp);
        var candidateEmployeeIds = employeeIdsByDeviceUserId.Values.ToList();
        var existingKeys = await db.AttendanceLogs
            .Where(l => l.DeviceId == device.Id
                && l.Timestamp >= earliestTimestamp
                && candidateEmployeeIds.Contains(l.EmployeeId))
            .Select(l => new { l.EmployeeId, l.Timestamp })
            .ToListAsync(ct);
        var existingKeySet = existingKeys.Select(k => (k.EmployeeId, k.Timestamp)).ToHashSet();

        var inserted = 0;
        foreach (var log in logs)
        {
            if (!employeeIdsByDeviceUserId.TryGetValue(log.DeviceUserId, out var employeeId))
            {
                logger.LogWarning(
                    "Skipping attendance log for unknown device user {DeviceUserId} on device {DeviceId}",
                    log.DeviceUserId, device.Id);
                continue;
            }

            if (existingKeySet.Contains((employeeId, log.Timestamp))) continue;

            db.AttendanceLogs.Add(new AttendanceLog
            {
                EmployeeId = employeeId,
                DeviceId = device.Id,
                Timestamp = log.Timestamp,
                VerifyMode = log.VerifyMode,
                InOutMode = log.InOutMode,
            });
            inserted++;
        }

        await db.SaveChangesAsync(ct);
        return inserted;
    }
}
