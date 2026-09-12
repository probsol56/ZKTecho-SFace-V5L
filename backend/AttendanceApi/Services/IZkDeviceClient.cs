namespace AttendanceApi.Services;

public record DeviceUserRecord(string DeviceUserId, string Name, string? CardNumber, int Role);

public record DeviceAttendanceRecord(string DeviceUserId, DateTime Timestamp, int VerifyMode, int InOutMode);

public enum TemplateKind
{
    Fingerprint,
    Face,
}

// Flag is the SDK's per-template validity/algorithm-version marker returned by
// GetUserTmpExStr. It must be replayed unchanged into SetUserTmpExStr on the
// target device, or the terminal treats the template as corrupt.
public record DeviceTemplateRecord(TemplateKind Kind, int Index, int Flag, string Data);

public record DeviceUserTemplates(
    IReadOnlyList<DeviceTemplateRecord> Fingerprints,
    IReadOnlyList<DeviceTemplateRecord> Faces)
{
    public bool IsEmpty => Fingerprints.Count == 0 && Faces.Count == 0;
}

// Talks to a single physical terminal over TCP:4370. Implementations connect
// for the duration of one sync call and must disconnect when done, even on error.
public interface IZkDeviceClient
{
    Task<IReadOnlyList<DeviceUserRecord>> GetUsersAsync(string ipAddress, int port);

    Task<IReadOnlyList<DeviceAttendanceRecord>> GetAttendanceLogsAsync(string ipAddress, int port);

    // Reads fingerprint + face templates for each requested device user ID. Users
    // with no enrolled templates (or absent on the device) are omitted from the
    // result rather than represented with an empty entry.
    Task<IReadOnlyDictionary<string, DeviceUserTemplates>> GetTemplatesAsync(
        string ipAddress, int port, IReadOnlyList<string> deviceUserIds);

    // Writes each user's info (creating the enrollment on this device if it
    // doesn't exist yet) followed by their templates. Returns per-user success so
    // one employee's failure doesn't hide the rest of the batch's results.
    Task<IReadOnlyDictionary<string, bool>> WriteTemplatesAsync(
        string ipAddress, int port,
        IReadOnlyList<(DeviceUserRecord User, DeviceUserTemplates Templates)> users);
}
