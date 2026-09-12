using AttendanceApi.Data;
using AttendanceApi.Models;
using Microsoft.EntityFrameworkCore;

namespace AttendanceApi.Services;

public record TemplateTransferOutcome(int EmployeeId, string EmployeeName, bool Success, string? Error);

public record TemplateTransferResult(IReadOnlyList<TemplateTransferOutcome> Outcomes);

public class DeviceTemplateTransferService(
    AttendanceDbContext db, IZkDeviceClient deviceClient, ILogger<DeviceTemplateTransferService> logger)
{
    public async Task<TemplateTransferResult> TransferAsync(
        int sourceDeviceId, int targetDeviceId, IReadOnlyList<int> employeeIds, CancellationToken ct = default)
    {
        if (sourceDeviceId == targetDeviceId)
        {
            throw new ArgumentException("Source and target device must be different.");
        }

        var source = await db.Devices.FindAsync([sourceDeviceId], ct)
            ?? throw new KeyNotFoundException($"Device {sourceDeviceId} not found");
        var target = await db.Devices.FindAsync([targetDeviceId], ct)
            ?? throw new KeyNotFoundException($"Device {targetDeviceId} not found");

        var employees = await db.Employees
            .Where(e => employeeIds.Contains(e.Id))
            .ToListAsync(ct);

        var deviceUserIds = employees.Select(e => e.DeviceUserId).ToList();
        var templatesByUser = await deviceClient.GetTemplatesAsync(source.IpAddress, source.Port, deviceUserIds);

        var outcomes = new List<TemplateTransferOutcome>();
        var employeesWithTemplates = new List<(Employee Employee, DeviceUserTemplates Templates)>();

        foreach (var employee in employees)
        {
            if (templatesByUser.TryGetValue(employee.DeviceUserId, out var templates))
            {
                employeesWithTemplates.Add((employee, templates));
            }
            else
            {
                outcomes.Add(new TemplateTransferOutcome(
                    employee.Id, employee.Name, false, "No fingerprint or face templates found on the source device."));
            }
        }

        if (employeesWithTemplates.Count > 0)
        {
            var toWrite = employeesWithTemplates
                .Select(x => (
                    User: new DeviceUserRecord(x.Employee.DeviceUserId, x.Employee.Name, x.Employee.CardNumber, x.Employee.Role),
                    x.Templates))
                .ToList();

            var writeResults = await deviceClient.WriteTemplatesAsync(target.IpAddress, target.Port, toWrite);

            foreach (var (employee, _) in employeesWithTemplates)
            {
                var success = writeResults.TryGetValue(employee.DeviceUserId, out var ok) && ok;
                outcomes.Add(new TemplateTransferOutcome(
                    employee.Id, employee.Name, success, success ? null : "Failed to write templates to the target device."));
            }
        }

        logger.LogInformation(
            "Transferred templates for {SuccessCount}/{TotalCount} employees from device {Source} to {Target}",
            outcomes.Count(o => o.Success), employees.Count, source.Name, target.Name);

        return new TemplateTransferResult(outcomes);
    }
}
