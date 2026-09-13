namespace AttendanceApi.Services;

// Closes out each business day: every active employee who never punched gets an
// Absent row, so a month's report has a row for every working day rather than only
// the days someone showed up.
public class DailyAttendanceFinalizerService(
    IServiceScopeFactory scopeFactory,
    ILogger<DailyAttendanceFinalizerService> logger) : BackgroundService
{
    private static readonly TimeOnly FinalizeAt = new(23, 45);

    // A short tick that re-reads the clock each time, rather than one long delay until
    // 23:45: a single Task.Delay does not survive machine sleep or a wall-clock change
    // and can overshoot by hours.
    private static readonly TimeSpan TickInterval = TimeSpan.FromMinutes(5);

    // Bounded catch-up after downtime. Longer gaps are an operator event - use
    // POST /api/attendance-days/recompute.
    private const int CatchUpDays = 7;

    private DateOnly? _lastFinalizedDate;
    private DateOnly? _lastCatchUpDate;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        using var timer = new PeriodicTimer(TickInterval);

        await RunTickAsync(ct);
        while (await timer.WaitForNextTickAsync(ct))
        {
            await RunTickAsync(ct);
        }
    }

    private async Task RunTickAsync(CancellationToken ct)
    {
        // BackgroundServiceExceptionBehavior defaults to StopHost - one escaped
        // exception here would take the whole API down.
        try
        {
            var today = BusinessTime.Today();

            if (_lastCatchUpDate != today)
            {
                await FinalizeAsync(today.AddDays(-CatchUpDays), today.AddDays(-1), isCatchUp: true, ct);
                _lastCatchUpDate = today;
            }

            if (TimeOnly.FromDateTime(BusinessTime.NowLocal()) >= FinalizeAt && _lastFinalizedDate != today)
            {
                await FinalizeAsync(today, today, isCatchUp: false, ct);
                _lastFinalizedDate = today;
            }
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Daily attendance finalisation tick failed; retrying in {TickInterval}", TickInterval);
        }
    }

    private async Task FinalizeAsync(DateOnly from, DateOnly to, bool isCatchUp, CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<AttendanceDayService>();

        var outcome = await service.RecomputeRangeAsync(from, to, employeeIds: null, includeAbsences: true, ct);

        if (isCatchUp && outcome.AbsencesCreated > 0)
        {
            logger.LogWarning(
                "Catch-up sweep {From}..{To} created {AbsencesCreated} absence rows - the finaliser did not run on those days",
                from, to, outcome.AbsencesCreated);
        }
    }
}
