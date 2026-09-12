namespace AttendanceApi.Models;

public class Device
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public required string IpAddress { get; set; }
    public int Port { get; set; } = 4370;
    public string? SerialNumber { get; set; }
    public DateTime? LastSyncedAt { get; set; }

    public List<AttendanceLog> AttendanceLogs { get; set; } = [];
}
