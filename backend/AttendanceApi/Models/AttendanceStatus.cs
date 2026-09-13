namespace AttendanceApi.Models;

public enum AttendanceStatus
{
    Present = 0,
    Late = 1,
    Absent = 2,

    // Reserved. Nothing produces this yet - there is no leave data source. It exists
    // so adding one later does not renumber the stored values.
    Leave = 3,
}
