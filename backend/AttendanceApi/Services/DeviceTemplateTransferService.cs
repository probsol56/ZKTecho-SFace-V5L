using AttendanceApi.Data;
using Microsoft.EntityFrameworkCore;

namespace AttendanceApi.Services;

public record TemplateTransferOutcome(string DeviceUserId, string EmployeeName, bool Success, string? Error);

// Transfers fingerprint/face templates directly between two terminals, keyed by
// device user ID. This deliberately never reads or writes the Employees table -
// the employee list shown for a transfer always comes from a live query of the
// source device (see DevicesController.GetLiveUsers), so what the user picks
// from is guaranteed to match what actually exists on that terminal.
public class DeviceTemplateTransferService(
    AttendanceDbContext db, IZkDeviceClient deviceClient, ILogger<DeviceTemplateTransferService> logger)
{
    // onProgress is invoked once per employee, in the order their outcome becomes
    // known, so a caller can stream live status to a client instead of waiting for
    // the whole batch to finish.
    public async Task TransferAsync(
        int sourceDeviceId, int targetDeviceId, IReadOnlyList<DeviceUserRecord> employees,
        Action<TemplateTransferOutcome> onProgress, CancellationToken ct = default)
    {
        if (sourceDeviceId == targetDeviceId)
        {
            throw new ArgumentException("Source and target device must be different.");
        }

        var source = await db.Devices.FindAsync([sourceDeviceId], ct)
            ?? throw new KeyNotFoundException($"Device {sourceDeviceId} not found");
        var target = await db.Devices.FindAsync([targetDeviceId], ct)
            ?? throw new KeyNotFoundException($"Device {targetDeviceId} not found");

        var deviceUserIds = employees.Select(e => e.DeviceUserId).ToList();
        var templatesByUser = await deviceClient.GetTemplatesAsync(source.IpAddress, source.Port, deviceUserIds);

        var toWrite = new List<(DeviceUserRecord User, DeviceUserTemplates Templates)>();
        var successCount = 0;

        foreach (var employee in employees)
        {
            if (templatesByUser.TryGetValue(employee.DeviceUserId, out var templates))
            {
                toWrite.Add((employee, templates));
            }
            else
            {
                onProgress(new TemplateTransferOutcome(
                    employee.DeviceUserId, employee.Name, false, "No fingerprint or face templates found on the source device."));
            }
        }

        if (toWrite.Count > 0)
        {
            var namesByDeviceUserId = toWrite.ToDictionary(x => x.User.DeviceUserId, x => x.User.Name);

            await deviceClient.WriteTemplatesAsync(target.IpAddress, target.Port, toWrite, (deviceUserId, success) =>
            {
                if (success) successCount++;
                onProgress(new TemplateTransferOutcome(
                    deviceUserId, namesByDeviceUserId[deviceUserId], success,
                    success ? null : "Failed to write templates to the target device."));
            });
        }

        logger.LogInformation(
            "Transferred templates for {SuccessCount}/{TotalCount} employees from device {Source} to {Target}",
            successCount, employees.Count, source.Name, target.Name);
    }
}
