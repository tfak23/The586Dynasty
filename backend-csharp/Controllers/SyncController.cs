using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.CSharp.Data;
using Backend.CSharp.Models;
using Backend.CSharp.Services;
using System.Text.Json;

namespace Backend.CSharp.Controllers;

/// <summary>
/// Controller for manual synchronization operations
/// </summary>
[ApiController]
[Route("api/sync")]
public class SyncController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly HttpClient _httpClient;
    private readonly StatsSyncService _statsSync;
    private readonly ILogger<SyncController> _logger;

    // Dead cap percentages by original contract length and year into contract
    private static readonly Dictionary<int, decimal[]> DeadCapPercentages = new()
    {
        { 5, new[] { 0.75m, 0.50m, 0.25m, 0.10m, 0.10m } },
        { 4, new[] { 0.75m, 0.50m, 0.25m, 0.10m } },
        { 3, new[] { 0.50m, 0.25m, 0.10m } },
        { 2, new[] { 0.50m, 0.25m } },
        { 1, new[] { 0.50m } }
    };

    public SyncController(
        AppDbContext context,
        HttpClient httpClient,
        StatsSyncService statsSync,
        ILogger<SyncController> logger)
    {
        _context = context;
        _httpClient = httpClient;
        _statsSync = statsSync;
        _logger = logger;
    }

    /// <summary>
    /// Sync all data from Sleeper for a league (full sync)
    /// </summary>
    [HttpPost("league/{leagueId}/full")]
    public async Task<ActionResult<ApiResponse<object>>> FullLeagueSync(Guid leagueId)
    {
        try
        {
            var league = await _context.Leagues.FindAsync(leagueId);
            if (league == null)
            {
                return NotFound(new ApiResponse<object>
                {
                    Status = "error",
                    Message = "League not found"
                });
            }

            // Log sync start
            var syncLog = new SyncLog
            {
                LeagueId = leagueId,
                SyncType = "full",
                Status = "started"
            };
            _context.SyncLogs.Add(syncLog);
            await _context.SaveChangesAsync();

            try
            {
                var sleeperService = new SleeperService(_httpClient, league.SleeperLeagueId);

                // Sync league info
                var leagueData = await sleeperService.GetLeagueAsync();
                league.Name = leagueData.Name;
                league.TotalRosters = leagueData.TotalRosters;
                league.RosterPositionsJson = JsonSerializer.Serialize(leagueData.RosterPositions);
                league.ScoringSettingsJson = JsonSerializer.Serialize(leagueData.ScoringSettings);

                // Sync users and teams
                var users = await sleeperService.GetUsersAsync();
                var rosters = await sleeperService.GetRostersAsync();

                foreach (var roster in rosters)
                {
                    var user = users.FirstOrDefault(u => u.UserId == roster.OwnerId);
                    var teamName = user?.DisplayName ?? $"Team {roster.RosterId}";
                    var avatarUrl = !string.IsNullOrEmpty(user?.Avatar)
                        ? $"https://sleepercdn.com/avatars/thumbs/{user.Avatar}"
                        : null;

                    var existingTeam = await _context.Teams
                        .FirstOrDefaultAsync(t =>
                            t.LeagueId == leagueId &&
                            t.SleeperRosterId == roster.RosterId);

                    if (existingTeam != null)
                    {
                        existingTeam.SleeperUserId = roster.OwnerId;
                        existingTeam.TeamName = teamName;
                        existingTeam.OwnerName = user?.DisplayName ?? "Unknown";
                        existingTeam.AvatarUrl = avatarUrl;
                        existingTeam.UpdatedAt = DateTime.UtcNow;
                    }
                    else
                    {
                        _context.Teams.Add(new Team
                        {
                            LeagueId = leagueId,
                            SleeperRosterId = roster.RosterId,
                            SleeperUserId = roster.OwnerId,
                            TeamName = teamName,
                            OwnerName = user?.DisplayName ?? "Unknown",
                            AvatarUrl = avatarUrl
                        });
                    }
                }

                // Sync players (only those on rosters)
                var allPlayers = await sleeperService.GetAllPlayersAsync();
                var rosterPlayerIds = rosters
                    .SelectMany(r => r.Players ?? new List<string>())
                    .Distinct()
                    .ToHashSet();

                var playersProcessed = 0;
                foreach (var playerId in rosterPlayerIds)
                {
                    if (!allPlayers.TryGetValue(playerId, out var playerData))
                        continue;

                    if (!new[] { "QB", "RB", "WR", "TE" }.Contains(playerData.Position))
                        continue;

                    var existingPlayer = await _context.Players
                        .FirstOrDefaultAsync(p => p.SleeperPlayerId == playerId);

                    if (existingPlayer != null)
                    {
                        existingPlayer.FullName = playerData.FullName;
                        existingPlayer.Position = playerData.Position;
                        existingPlayer.Team = playerData.Team;
                        existingPlayer.Age = playerData.Age;
                        existingPlayer.YearsExp = playerData.YearsExp;
                        existingPlayer.Status = playerData.Status;
                        existingPlayer.UpdatedAt = DateTime.UtcNow;
                    }
                    else
                    {
                        _context.Players.Add(new Player
                        {
                            SleeperPlayerId = playerId,
                            FullName = playerData.FullName,
                            FirstName = playerData.FirstName,
                            LastName = playerData.LastName,
                            Position = playerData.Position,
                            Team = playerData.Team,
                            Age = playerData.Age,
                            YearsExp = playerData.YearsExp,
                            College = playerData.College,
                            Number = playerData.Number,
                            Status = playerData.Status,
                            SearchFullName = playerData.FullName?.ToLower(),
                            SearchLastName = playerData.LastName?.ToLower()
                        });
                    }

                    playersProcessed++;
                }

                await _context.SaveChangesAsync();

                // Update sync log
                syncLog.Status = "completed";
                syncLog.RecordsProcessed = playersProcessed;
                syncLog.CompletedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                return Ok(new ApiResponse<object>
                {
                    Status = "success",
                    Data = new
                    {
                        league_updated = true,
                        teams_synced = rosters.Count,
                        players_synced = playersProcessed
                    }
                });
            }
            catch (Exception ex)
            {
                // Update sync log with error
                syncLog.Status = "failed";
                syncLog.ErrorsJson = JsonSerializer.Serialize(new { message = ex.Message });
                syncLog.CompletedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                throw;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error syncing league {LeagueId}", leagueId);
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to sync league"
            });
        }
    }

    /// <summary>
    /// Sync rosters only - automatically releases dropped players with dead cap
    /// </summary>
    [HttpPost("league/{leagueId}/rosters")]
    public async Task<ActionResult<ApiResponse<object>>> RosterSync(Guid leagueId)
    {
        try
        {
            var league = await _context.Leagues.FindAsync(leagueId);
            if (league == null)
            {
                return NotFound(new ApiResponse<object>
                {
                    Status = "error",
                    Message = "League not found"
                });
            }

            var currentSeason = league.CurrentSeason;
            var sleeperService = new SleeperService(_httpClient, league.SleeperLeagueId);
            var rosters = await sleeperService.GetRostersAsync();

            var teams = await _context.Teams
                .Where(t => t.LeagueId == leagueId)
                .ToListAsync();

            var changes = new
            {
                additions = new List<object>(),
                removals = new List<object>()
            };

            var releasedContracts = new List<object>();

            foreach (var roster in rosters)
            {
                var team = teams.FirstOrDefault(t => t.SleeperRosterId == roster.RosterId);
                if (team == null) continue;

                // Get current contracts for this team
                var currentContracts = await _context.Contracts
                    .Include(c => c.Player)
                    .Where(c => c.TeamId == team.Id && c.Status == "active")
                    .ToListAsync();

                var currentPlayerIds = currentContracts
                    .Select(c => c.Player.SleeperPlayerId)
                    .ToHashSet();

                var sleeperPlayerIds = (roster.Players ?? new List<string>()).ToHashSet();

                // Find additions
                foreach (var playerId in sleeperPlayerIds)
                {
                    if (!currentPlayerIds.Contains(playerId))
                    {
                        changes.additions.Add(new
                        {
                            team_id = team.Id,
                            team_name = team.TeamName,
                            sleeper_player_id = playerId
                        });
                    }
                }

                // Find removals - AUTO RELEASE WITH DEAD CAP
                foreach (var playerId in currentPlayerIds)
                {
                    if (!sleeperPlayerIds.Contains(playerId))
                    {
                        var contract = currentContracts.FirstOrDefault(c => c.Player.SleeperPlayerId == playerId);
                        if (contract != null)
                        {
                            var deadCap = CalculateDeadCap(contract, currentSeason);

                            contract.Status = "released";
                            contract.ReleasedAt = DateTime.UtcNow;
                            contract.ReleaseReason = "dropped";
                            contract.DeadCapHit = deadCap;

                            // Log dead cap transaction
                            if (deadCap > 0)
                            {
                                _context.CapTransactions.Add(new CapTransaction
                                {
                                    LeagueId = leagueId,
                                    TeamId = team.Id,
                                    Season = currentSeason,
                                    TransactionType = "dead_money",
                                    Amount = deadCap,
                                    Description = $"Dead cap from drop: {contract.Player.FullName}",
                                    RelatedContractId = contract.Id
                                });
                            }

                            var releaseInfo = new
                            {
                                team_id = team.Id,
                                team_name = team.TeamName,
                                sleeper_player_id = playerId,
                                contract_id = contract.Id,
                                player_name = contract.Player.FullName,
                                salary = contract.Salary,
                                dead_cap = deadCap,
                                cap_savings = contract.Salary - deadCap
                            };

                            changes.removals.Add(releaseInfo);
                            releasedContracts.Add(releaseInfo);
                        }
                    }
                }
            }

            await _context.SaveChangesAsync();

            // Log sync activity if there were releases
            if (releasedContracts.Count > 0)
            {
                _context.SyncLogs.Add(new SyncLog
                {
                    LeagueId = leagueId,
                    SyncType = "roster_releases",
                    Status = "completed",
                    RecordsProcessed = releasedContracts.Count,
                    CompletedAt = DateTime.UtcNow
                });
                await _context.SaveChangesAsync();
            }

            var totalDeadCap = releasedContracts
                .Sum(r => ((dynamic)r).dead_cap);

            return Ok(new ApiResponse<object>
            {
                Status = "success",
                Data = new
                {
                    synced_at = DateTime.UtcNow,
                    additions_detected = changes.additions.Count,
                    removals_detected = changes.removals.Count,
                    players_released = releasedContracts.Count,
                    total_dead_cap_applied = totalDeadCap,
                    changes,
                    released_contracts = releasedContracts
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error syncing rosters for league {LeagueId}", leagueId);
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to sync rosters"
            });
        }
    }

    /// <summary>
    /// Manually trigger player stats sync
    /// </summary>
    [HttpPost("stats/{season}")]
    public async Task<ActionResult<ApiResponse<object>>> StatsSync(
        int season,
        [FromBody] StatsSyncRequest? request = null)
    {
        try
        {
            if (season < 2020 || season > 2030)
            {
                return BadRequest(new ApiResponse<object>
                {
                    Status = "error",
                    Message = "Invalid season. Must be between 2020 and 2030."
                });
            }

            _logger.LogInformation("Manual stats sync triggered for {Season}", season);
            var result = await _statsSync.SyncPlayerStatsAsync(season, request?.LeagueId);

            return Ok(new ApiResponse<object>
            {
                Status = "success",
                Data = new
                {
                    season,
                    synced = result.Synced,
                    skipped = result.Skipped,
                    errors = result.Errors,
                    scoring_type = result.ScoringType
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error syncing stats for season {Season}", season);
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to sync stats"
            });
        }
    }

    /// <summary>
    /// Get sync history for a league
    /// </summary>
    [HttpGet("league/{leagueId}/history")]
    public async Task<ActionResult<ApiResponse<List<SyncLog>>>> GetSyncHistory(
        Guid leagueId,
        [FromQuery] int limit = 20)
    {
        try
        {
            var history = await _context.SyncLogs
                .Where(sl => sl.LeagueId == leagueId)
                .OrderByDescending(sl => sl.StartedAt)
                .Take(limit)
                .ToListAsync();

            return Ok(new ApiResponse<List<SyncLog>>
            {
                Status = "success",
                Data = history
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching sync history for league {LeagueId}", leagueId);
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to fetch sync history"
            });
        }
    }

    private decimal CalculateDeadCap(Contract contract, int currentSeason)
    {
        if (contract.Salary <= 1)
        {
            return contract.Salary;
        }

        var yearsIntoContract = currentSeason - contract.StartSeason;
        if (!DeadCapPercentages.TryGetValue(contract.YearsTotal, out var percentages))
        {
            return 0;
        }

        if (yearsIntoContract < 0 || yearsIntoContract >= percentages.Length)
        {
            return 0;
        }

        return Math.Round(contract.Salary * percentages[yearsIntoContract], 2);
    }
}

public class StatsSyncRequest
{
    public Guid? LeagueId { get; set; }
}
