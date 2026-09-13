namespace AttendanceApi.Services;

// Single authority for "what day is it" in this system. Punches are stored as UTC
// timestamptz, but every business rule (office hours, late grace, daily rollups)
// is expressed in Dhaka wall-clock time, so all bucketing must go through here.
public static class BusinessTime
{
    public const string IanaTimeZoneId = "Asia/Dhaka";
    private const string WindowsTimeZoneId = "Bangladesh Standard Time";

    public static TimeZoneInfo Zone { get; } = Resolve();

    public static DateOnly ToBusinessDate(DateTime utc) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(EnsureUtc(utc), Zone));

    public static TimeOnly ToBusinessTime(DateTime utc) =>
        TimeOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(EnsureUtc(utc), Zone));

    public static DateTime ToLocal(DateTime utc) => TimeZoneInfo.ConvertTimeFromUtc(EnsureUtc(utc), Zone);

    public static DateTime ToUtc(DateOnly date, TimeOnly time) => ToUtc(date.ToDateTime(time));

    // Bangladesh ran DST for part of 2009 and both the IANA and Windows databases
    // still carry that rule, so an invalid local time is reachable when backfilling
    // historical device data.
    public static DateTime ToUtc(DateTime businessLocal)
    {
        var local = DateTime.SpecifyKind(businessLocal, DateTimeKind.Unspecified);
        if (Zone.IsInvalidTime(local)) local = local.AddHours(1);
        return TimeZoneInfo.ConvertTimeToUtc(local, Zone);
    }

    // Half-open [start, end). Never build closed intervals against timestamptz -
    // its microsecond resolution rounds 23:59:59.9999999 up to the next midnight.
    public static (DateTime StartUtc, DateTime EndUtc) UtcRange(DateOnly from, DateOnly toInclusive) =>
        (ToUtc(from, TimeOnly.MinValue), ToUtc(toInclusive.AddDays(1), TimeOnly.MinValue));

    public static (DateTime StartUtc, DateTime EndUtc) UtcRange(DateOnly date) => UtcRange(date, date);

    public static DateOnly Today() => ToBusinessDate(DateTime.UtcNow);

    public static DateTime NowLocal() => ToLocal(DateTime.UtcNow);

    private static TimeZoneInfo Resolve()
    {
        // .NET 6+ converts between IANA and Windows ids when ICU is available. It is
        // not available under globalization-invariant mode, and slim Linux images may
        // ship without tzdata - so fall back to the Windows id, then fail loudly.
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(IanaTimeZoneId);
        }
        catch (TimeZoneNotFoundException) { }
        catch (InvalidTimeZoneException) { }

        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(WindowsTimeZoneId);
        }
        catch (TimeZoneNotFoundException ex)
        {
            throw new InvalidOperationException(
                $"Neither '{IanaTimeZoneId}' nor '{WindowsTimeZoneId}' could be resolved on this host. " +
                "Install tzdata or disable InvariantGlobalization.", ex);
        }
    }

    private static DateTime EnsureUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Utc),
    };
}
