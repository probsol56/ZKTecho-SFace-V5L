using System.Globalization;
using AttendanceApi.Data;
using AttendanceApi.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AttendanceApi.Controllers;

// Receives ADMS pushes from terminals configured under COMM > Cloud Server Setting.
// Unlike DevicesController's /sync endpoint (server pulls via zkemkeeper), here the
// device initiates every call - it registers itself, uploads data, then polls for
// commands. Devices are matched to a Device row by SerialNumber, which must already
// exist (create it via the normal Devices UI/API) before pushes will be persisted.
//
// Protocol reference: ZKTeco ADMS push SDK. Bodies are plain text, not JSON - the
// device only understands a literal "OK" response body, so every action here
// returns Content(..., "text/plain") rather than the usual Ok()/ActionResult<T>.
[ApiController]
[Route("iclock")]
public class AdmsController(AttendanceDbContext db, DeviceSyncService syncService, ILogger<AdmsController> logger)
    : ControllerBase
{
    // Terminals send a fixed, culture-free layout; parsing with the host's current
    // culture would silently drop every line on a differently-configured machine.
    private static readonly string[] DeviceTimestampFormats =
    [
        "yyyy-MM-dd HH:mm:ss",
        "yyyy-MM-ddTHH:mm:ss",
        "yyyy-MM-dd HH:mm",
    ];

    // Device registration/heartbeat: GET /iclock/cdata?SN=...&options=all
    // Called on boot and periodically. No "table" query param distinguishes it
    // from the data-upload GET/POST below of the same path.
    [HttpGet("cdata")]
    public async Task<IActionResult> Handshake([FromQuery(Name = "SN")] string serialNumber, CancellationToken ct)
    {
        await TouchDeviceAsync(serialNumber, ct);

        var config = string.Join('\n',
            $"GET OPTION FROM: {serialNumber}",
            "Stamp=9999",
            "OpStamp=9999",
            "ErrorDelay=30",
            "Delay=30",
            "TransFlag=1111000000",
            "Realtime=1",
            "Encrypt=0");
        return Content(config + "\n", "text/plain");
    }

    // Data upload: POST /iclock/cdata?SN=...&table=ATTLOG|OPERLOG
    [HttpPost("cdata")]
    public async Task<IActionResult> PushData(
        [FromQuery(Name = "SN")] string serialNumber,
        [FromQuery] string? table,
        CancellationToken ct)
    {
        using var reader = new StreamReader(Request.Body);
        var body = await reader.ReadToEndAsync(ct);

        var device = await db.Devices.FirstOrDefaultAsync(d => d.SerialNumber == serialNumber, ct);
        if (device is null)
        {
            logger.LogWarning(
                "ADMS push from unregistered device SN={SerialNumber} (table={Table}) - add a Device with this SerialNumber first, data was not saved",
                serialNumber, table);
            return Content("OK", "text/plain");
        }

        switch (table)
        {
            case "ATTLOG":
                var logs = ParseAttendanceLogs(body);
                var insert = await syncService.InsertNewLogsAsync(device, logs, ct);
                device.LastSyncedAt = DateTime.UtcNow;
                await db.SaveChangesAsync(ct);
                logger.LogInformation(
                    "ADMS ATTLOG push from {DeviceName} ({SerialNumber}): {Inserted} new logs of {Total} received, {DayRowsWritten} attendance days updated",
                    device.Name, serialNumber, insert.InsertedCount, logs.Count, insert.DayRowsWritten);
                break;

            case "OPERLOG":
                var users = ParseUserRecords(body);
                var upserted = await syncService.UpsertEmployeesAsync(users, ct);
                logger.LogInformation(
                    "ADMS OPERLOG push from {DeviceName} ({SerialNumber}): {Upserted} users",
                    device.Name, serialNumber, upserted);
                break;

            default:
                logger.LogInformation(
                    "ADMS push from {DeviceName} ({SerialNumber}) with unhandled table={Table}, {Length} bytes",
                    device.Name, serialNumber, table, body.Length);
                break;
        }

        return Content("OK", "text/plain");
    }

    // Photo upload: POST /iclock/fdata?SN=...&table=ATTPHOTO&PhotoStamp=...
    // Devices with a camera push a snapshot taken at punch time here, separate
    // from the face template used for matching. We don't store photos yet, but
    // the body must still be drained and acknowledged with "OK" - otherwise the
    // device treats the upload as failed and retries it forever, blocking every
    // other queued upload (including ATTLOG) behind it.
    [HttpPost("fdata")]
    public async Task<IActionResult> PushPhoto(
        [FromQuery(Name = "SN")] string serialNumber,
        [FromQuery] string? table,
        CancellationToken ct)
    {
        using var reader = new StreamReader(Request.Body);
        var body = await reader.ReadToEndAsync(ct);

        logger.LogInformation(
            "ADMS fdata push from SN={SerialNumber} (table={Table}): {Length} bytes received, not stored",
            serialNumber, table, body.Length);

        return Content("OK", "text/plain");
    }

    // Command polling: device asks "do you have anything for me?" - we never
    // queue commands (no ClearGeneralLogData/remote-command support yet), so
    // always answer with no pending commands.
    [HttpGet("getrequest")]
    public IActionResult GetRequest([FromQuery(Name = "SN")] string serialNumber)
    {
        return Content("OK", "text/plain");
    }

    // Command result acknowledgement - accepted for protocol completeness even
    // though we never issue commands for the device to report back on.
    [HttpPost("devicecmd")]
    public IActionResult DeviceCmd([FromQuery(Name = "SN")] string serialNumber)
    {
        return Content("OK", "text/plain");
    }

    private async Task TouchDeviceAsync(string serialNumber, CancellationToken ct)
    {
        var device = await db.Devices.FirstOrDefaultAsync(d => d.SerialNumber == serialNumber, ct);
        if (device is null)
        {
            logger.LogWarning(
                "ADMS handshake from unregistered device SN={SerialNumber} - add a Device with this SerialNumber to receive its data",
                serialNumber);
            return;
        }

        device.LastSyncedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    // ATTLOG lines are tab-separated: PIN, DateTime, Status(in/out), Verify, WorkCode, ...
    private static List<DeviceAttendanceRecord> ParseAttendanceLogs(string body)
    {
        var records = new List<DeviceAttendanceRecord>();
        foreach (var rawLine in body.Split('\n', StringSplitOptions.RemoveEmptyEntries))
        {
            var fields = rawLine.Trim('\r').Split('\t');
            if (fields.Length < 4) continue;
            if (!TryParseDeviceTimestamp(fields[1], out var localTimestamp)) continue;
            if (!int.TryParse(fields[2], out var inOutMode)) inOutMode = 0;
            if (!int.TryParse(fields[3], out var verifyMode)) verifyMode = 0;

            // Terminals send their own wall clock, which is configured to the office
            // timezone - not the API host's, which may differ or be UTC.
            records.Add(new DeviceAttendanceRecord(
                fields[0], BusinessTime.ToUtc(localTimestamp), verifyMode, inOutMode));
        }
        return records;
    }

    private static bool TryParseDeviceTimestamp(string value, out DateTime timestamp) =>
        DateTime.TryParseExact(
            value.Trim(),
            DeviceTimestampFormats,
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out timestamp);

    // OPERLOG user lines look like: USER PIN=1\tName=John Doe\tPri=0\tCard=12345\t...
    private static List<DeviceUserRecord> ParseUserRecords(string body)
    {
        var records = new List<DeviceUserRecord>();
        foreach (var rawLine in body.Split('\n', StringSplitOptions.RemoveEmptyEntries))
        {
            var line = rawLine.Trim('\r');
            if (!line.StartsWith("USER", StringComparison.OrdinalIgnoreCase)) continue;

            var fields = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var field in line.Split('\t').Skip(1))
            {
                var parts = field.Split('=', 2);
                if (parts.Length == 2) fields[parts[0]] = parts[1];
            }

            if (!fields.TryGetValue("PIN", out var pin)) continue;
            fields.TryGetValue("Name", out var name);
            fields.TryGetValue("Card", out var card);
            int.TryParse(fields.GetValueOrDefault("Pri"), out var role);

            records.Add(new DeviceUserRecord(pin, string.IsNullOrWhiteSpace(name) ? pin : name, string.IsNullOrWhiteSpace(card) ? null : card, role));
        }
        return records;
    }
}
