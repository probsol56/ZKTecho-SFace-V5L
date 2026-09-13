namespace AttendanceApi.Models;

// Keyed by the device user ID (uid/userid on the terminal). Companies typically
// enroll each person with the same ID across every unit, so one row here can
// represent a person regardless of which of the 3 devices they punch on.
public class Employee
{
    public int Id { get; set; }
    public required string DeviceUserId { get; set; }
    public required string Name { get; set; }
    public string? CardNumber { get; set; }
    public int Role { get; set; }

    // Drive absence generation: a day with no punch only counts against someone who
    // is still employed and had already joined. Device sync never clears these.
    public bool IsActive { get; set; } = true;
    public DateOnly? JoinDate { get; set; }

    public List<AttendanceLog> AttendanceLogs { get; set; } = [];
}
