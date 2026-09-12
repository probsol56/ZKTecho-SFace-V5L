namespace AttendanceApi.Services;

public record DeviceUserRecord(string DeviceUserId, string Name, string? CardNumber, int Role);

public record DeviceAttendanceRecord(string DeviceUserId, DateTime Timestamp, int VerifyMode, int InOutMode);

// Talks to a single physical terminal over TCP:4370. Implementations connect
// for the duration of one sync call and must disconnect when done, even on error.
public interface IZkDeviceClient
{
    Task<IReadOnlyList<DeviceUserRecord>> GetUsersAsync(string ipAddress, int port);

    Task<IReadOnlyList<DeviceAttendanceRecord>> GetAttendanceLogsAsync(string ipAddress, int port);
}
