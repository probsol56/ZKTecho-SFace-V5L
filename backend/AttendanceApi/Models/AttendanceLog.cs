namespace AttendanceApi.Models;

public class AttendanceLog
{
    public int Id { get; set; }
    public int EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;
    public int DeviceId { get; set; }
    public Device Device { get; set; } = null!;
    public required DateTime Timestamp { get; set; }
    public int VerifyMode { get; set; }
    public int InOutMode { get; set; }
}
