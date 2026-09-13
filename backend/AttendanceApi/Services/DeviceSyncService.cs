using AttendanceApi.Data;
using AttendanceApi.Models;
using Microsoft.EntityFrameworkCore;

namespace AttendanceApi.Services;

public record SyncResult(int UsersUpserted, int LogsInserted);

public record InsertLogsResult(int InsertedCount, int DayRowsWritten);

public class DeviceSyncService(
    AttendanceDbContext db,
    IZkDeviceClient deviceClient,
    AttendanceDayService attendanceDays,
    ILogger<DeviceSyncService> logger)
{
    public async Task<SyncResult> SyncAsync(int deviceId, CancellationToken ct = default)
    {
        var device = await db.Devices.FirstOrDefaultAsync(d => d.Id == deviceId, ct)
            ?? throw new KeyNotFoundException($"Device {deviceId} not found");

        var users = await deviceClient.GetUsersAsync(device.IpAddress, device.Port);
        var usersUpserted = await UpsertEmployeesAsync(users, ct);

        var logs = await deviceClient.GetAttendanceLogsAsync(device.IpAddress, device.Port);
        var insert = await InsertNewLogsAsync(device, logs, ct);

        device.LastSyncedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        logger.LogInformation(
            "Synced device {DeviceName} ({DeviceId}): {UsersUpserted} users, {LogsInserted} new logs, {DayRowsWritten} attendance days updated",
            device.Name, device.Id, usersUpserted, insert.InsertedCount, insert.DayRowsWritten);

        return new SyncResult(usersUpserted, insert.InsertedCount);
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

    // Recomputes the affected days itself rather than leaving it to callers, so both
    // ingest paths (ADMS push and device pull) stay in sync by construction.
    public async Task<InsertLogsResult> InsertNewLogsAsync(
        Device device, IReadOnlyList<DeviceAttendanceRecord> logs, CancellationToken ct)
    {
        if (logs.Count == 0) return new InsertLogsResult(0, 0);

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
        var affectedDays = new HashSet<AttendanceDayKey>();
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
            affectedDays.Add(new AttendanceDayKey(employeeId, BusinessTime.ToBusinessDate(log.Timestamp)));
        }

        await db.SaveChangesAsync(ct);

        // Punches are already committed and irreplaceable; the summary is a derived,
        // idempotent projection that the nightly finaliser and the recompute endpoint
        // both heal. Never fail the ingest over it - on the ADMS path a non-"OK"
        // response makes the terminal retry the batch forever.
        try
        {
            var outcome = await attendanceDays.RecomputeAsync(affectedDays, ct);
            return new InsertLogsResult(inserted, outcome.RowsWritten);
        }
        catch (Exception ex)
        {
            logger.LogError(ex,
                "Stored {Inserted} punches from device {DeviceId} but failed to update {DayCount} attendance days; they will be rebuilt by the nightly finaliser",
                inserted, device.Id, affectedDays.Count);
            return new InsertLogsResult(inserted, 0);
        }
    }
}
