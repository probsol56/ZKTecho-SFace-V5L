namespace AttendanceApi.Models;

// Single-row table holding the office rules that turn punches into a day's status.
// Seeded by migration and editable via PUT /api/work-schedule; changing it does not
// rewrite history - run POST /api/attendance-days/recompute for that.
public class WorkSchedule
{
    public const int SingletonId = 1;

    public int Id { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public int GraceMinutes { get; set; }

    // One bit per DayOfWeek (Sunday = bit 0). A scalar keeps the schema stable when
    // the weekend changes; callers use IsWeekend/WeekendDays and never see the number.
    public int WeekendDaysMask { get; set; }

    public DateTime UpdatedAt { get; set; }

    public TimeOnly LateAfter => StartTime.AddMinutes(GraceMinutes);

    public bool IsWeekend(DayOfWeek day) => (WeekendDaysMask & MaskOf(day)) != 0;

    public IReadOnlyList<DayOfWeek> WeekendDays() => Enum.GetValues<DayOfWeek>().Where(IsWeekend).ToList();

    public void SetWeekendDays(IEnumerable<DayOfWeek> days) => WeekendDaysMask = MaskFor(days);

    public static int MaskFor(IEnumerable<DayOfWeek> days) => days.Aggregate(0, (mask, day) => mask | MaskOf(day));

    private static int MaskOf(DayOfWeek day) => 1 << (int)day;
}
