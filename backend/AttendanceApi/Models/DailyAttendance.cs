namespace AttendanceApi.Models;

// One row per employee per working day, derived from AttendanceLogs. Rewritten
// whenever punches for that day arrive, and by the nightly finaliser for employees
// who never punched. Weekends get no row at all.
public class DailyAttendance
{
    public int Id { get; set; }
    public int EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;

    public DateOnly WorkDate { get; set; }
    public AttendanceStatus Status { get; set; }

    // Exact punch instants, not times of day: lossless, joinable back to the raw log,
    // and unaffected by a future cross-midnight shift rule. Display formatting in the
    // office timezone happens in the DTO layer.
    public DateTime? CheckInAt { get; set; }
    public DateTime? CheckOutAt { get; set; }

    public int WorkedMinutes { get; set; }
    public int LateMinutes { get; set; }
    public int PunchCount { get; set; }
    public DateTime ComputedAt { get; set; }
}
