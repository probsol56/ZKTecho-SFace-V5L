namespace AttendanceApi.Models;

public enum AttendanceStatus
{
    Present = 1,
    Late = 2,
    Absent = 3,

    // Reserved. Nothing produces this yet - there is no leave data source. It exists
    // so adding one later does not renumber the stored values.
    Leave = 4,
}
