using Backend.CSharp.Data;
using Backend.CSharp.Services;
using Microsoft.EntityFrameworkCore;

namespace Backend.CSharp.Jobs;

public class RosterSyncJob : IHostedService, IDisposable
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<RosterSyncJob> _logger;
    private Timer? _timer;

    public RosterSyncJob(IServiceProvider serviceProvider, ILogger<RosterSyncJob> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Roster Sync Job is starting");
        
        // Run every 5 minutes
        _timer = new Timer(DoWork, null, TimeSpan.Zero, TimeSpan.FromMinutes(5));
        
        return Task.CompletedTask;
    }

    private async void DoWork(object? state)
    {
        _logger.LogInformation("🔄 [CRON] Automatic roster sync starting...");
        
        try
        {
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var httpClient = scope.ServiceProvider.GetRequiredService<HttpClient>();

            var leagues = await context.Leagues.ToListAsync();

            foreach (var league in leagues)
            {
                try
                {
                    await SyncLeagueRosters(context, httpClient, league.SleeperLeagueId, league.Id);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error syncing league {LeagueId}", league.Id);
                }
            }

            _logger.LogInformation("✅ [CRON] Roster sync completed");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ [CRON] Roster sync failed");
        }
    }

    private async Task SyncLeagueRosters(AppDbContext context, HttpClient httpClient, string sleeperLeagueId, Guid leagueId)
    {
        var sleeperService = new SleeperService(httpClient, sleeperLeagueId);
        var rosters = await sleeperService.GetRostersAsync();

        // Get all active contracts for this league
        var activeContracts = await context.Contracts
            .Include(c => c.Player)
            .Where(c => c.LeagueId == leagueId && c.Status == "active")
            .ToListAsync();

        // Get current roster player IDs from Sleeper
        var currentPlayerIds = rosters
            .SelectMany(r => r.Players ?? new List<string>())
            .Concat(rosters.SelectMany(r => r.Taxi ?? new List<string>()))
            .Concat(rosters.SelectMany(r => r.Reserve ?? new List<string>()))
            .Distinct()
            .ToHashSet();

        var droppedCount = 0;

        // Find contracts for players not on any roster (dropped)
        foreach (var contract in activeContracts)
        {
            if (!currentPlayerIds.Contains(contract.Player.SleeperPlayerId))
            {
                // Player was dropped - calculate dead cap and release
                var league = await context.Leagues.FindAsync(leagueId);
                if (league != null && contract.TeamId.HasValue)
                {
                    var deadCap = CalculateDeadCap(contract, league.CurrentSeason);
                    
                    contract.Status = "released";
                    contract.ReleasedAt = DateTime.UtcNow;
                    contract.ReleaseReason = "dropped_from_roster";
                    contract.DeadCapHit = deadCap;
                    contract.UpdatedAt = DateTime.UtcNow;

                    // Log dead money transaction
                    if (deadCap > 0)
                    {
                        var capTransaction = new Models.CapTransaction
                        {
                            LeagueId = leagueId,
                            TeamId = contract.TeamId.Value,
                            Season = league.CurrentSeason,
                            TransactionType = "dead_money",
                            Amount = deadCap,
                            Description = $"Dead cap from roster drop: {contract.Player.FullName}",
                            RelatedContractId = contract.Id
                        };
                        context.CapTransactions.Add(capTransaction);
                    }

                    droppedCount++;
                    _logger.LogInformation("Dropped player: {PlayerName} (${DeadCap} dead cap)", 
                        contract.Player.FullName, deadCap);
                }
            }
        }

        if (droppedCount > 0)
        {
            await context.SaveChangesAsync();
            _logger.LogInformation("Released {Count} dropped contracts with dead cap", droppedCount);
        }
    }

    private decimal CalculateDeadCap(Models.Contract contract, int releaseSeason)
    {
        if (contract.Salary <= 1)
        {
            return contract.Salary;
        }

        var yearsIntoContract = releaseSeason - contract.StartSeason + 1;
        
        var deadCapPct = contract.YearsTotal switch
        {
            5 => yearsIntoContract switch
            {
                1 => 0.75m,
                2 => 0.50m,
                3 => 0.25m,
                4 => 0.10m,
                5 => 0.10m,
                _ => 0m
            },
            4 => yearsIntoContract switch
            {
                1 => 0.75m,
                2 => 0.50m,
                3 => 0.25m,
                4 => 0.10m,
                _ => 0m
            },
            3 => yearsIntoContract switch
            {
                1 => 0.50m,
                2 => 0.25m,
                3 => 0.10m,
                _ => 0m
            },
            2 => yearsIntoContract switch
            {
                1 => 0.50m,
                2 => 0.25m,
                _ => 0m
            },
            1 => yearsIntoContract switch
            {
                1 => 0.50m,
                _ => 0m
            },
            _ => 0m
        };

        return Math.Round(contract.Salary * deadCapPct, 2);
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Roster Sync Job is stopping");
        _timer?.Change(Timeout.Infinite, 0);
        return Task.CompletedTask;
    }

    public void Dispose()
    {
        _timer?.Dispose();
    }
}
