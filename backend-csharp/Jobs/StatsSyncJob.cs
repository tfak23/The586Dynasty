using Backend.CSharp.Services;
using NCrontab;

namespace Backend.CSharp.Jobs;

/// <summary>
/// Background job that syncs player stats every Tuesday at 6 AM
/// </summary>
public class StatsSyncJob : IHostedService, IDisposable
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<StatsSyncJob> _logger;
    private Timer? _timer;
    private readonly CrontabSchedule _schedule;
    private DateTime _nextRun;

    public StatsSyncJob(IServiceProvider serviceProvider, ILogger<StatsSyncJob> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        // Run every Tuesday at 6 AM: "0 6 * * 2"
        _schedule = CrontabSchedule.Parse("0 6 * * 2");
        _nextRun = _schedule.GetNextOccurrence(DateTime.UtcNow);
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Stats Sync Job is starting");
        _logger.LogInformation("Next stats sync scheduled for: {NextRun}", _nextRun);

        // Check every minute if it's time to run
        _timer = new Timer(CheckSchedule, null, TimeSpan.Zero, TimeSpan.FromMinutes(1));

        return Task.CompletedTask;
    }

    private async void CheckSchedule(object? state)
    {
        var now = DateTime.UtcNow;

        if (now >= _nextRun)
        {
            _logger.LogInformation("📊 [CRON] Automatic stats sync starting...");

            try
            {
                await DoWorkAsync();
                _logger.LogInformation("✅ [CRON] Stats sync completed");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ [CRON] Stats sync failed");
            }

            // Schedule next run
            _nextRun = _schedule.GetNextOccurrence(DateTime.UtcNow);
            _logger.LogInformation("Next stats sync scheduled for: {NextRun}", _nextRun);
        }
    }

    private async Task DoWorkAsync()
    {
        using var scope = _serviceProvider.CreateScope();
        var statsSync = scope.ServiceProvider.GetRequiredService<StatsSyncService>();
        var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();

        // Get current season from configuration, default to current year if not set
        var currentSeason = configuration.GetValue<int?>("LeagueConfiguration:CurrentSeason") 
            ?? DateTime.UtcNow.Year;

        var result = await statsSync.SyncPlayerStatsAsync(currentSeason);

        _logger.LogInformation(
            "Stats sync completed: {Synced} synced, {Skipped} skipped, {Errors} errors",
            result.Synced, result.Skipped, result.Errors.Count);

        if (result.Errors.Count > 0)
        {
            _logger.LogWarning("Stats sync errors: {Errors}", string.Join("; ", result.Errors.Take(5)));
        }
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Stats Sync Job is stopping");
        _timer?.Change(Timeout.Infinite, 0);
        return Task.CompletedTask;
    }

    public void Dispose()
    {
        _timer?.Dispose();
    }
}
