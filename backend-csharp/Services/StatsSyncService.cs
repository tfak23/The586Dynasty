using System.Text.Json;
using Backend.CSharp.Data;
using Backend.CSharp.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.CSharp.Services;

/// <summary>
/// Service for syncing player stats from Sleeper API
/// </summary>
public class StatsSyncService
{
    private readonly AppDbContext _context;
    private readonly HttpClient _httpClient;
    private readonly ILogger<StatsSyncService> _logger;

    private const string SLEEPER_STATS_API = "https://api.sleeper.app/v1";

    private static readonly Dictionary<string, decimal> DefaultScoring = new()
    {
        { "pass_yd", 0.04m },
        { "pass_td", 4m },
        { "pass_int", -2m },
        { "rush_yd", 0.1m },
        { "rush_td", 6m },
        { "rec", 1m },
        { "rec_yd", 0.1m },
        { "rec_td", 6m },
        { "fum_lost", -2m }
    };

    public StatsSyncService(
        AppDbContext context,
        HttpClient httpClient,
        ILogger<StatsSyncService> logger)
    {
        _context = context;
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<StatsSyncResult> SyncPlayerStatsAsync(int season, Guid? leagueId = null)
    {
        var result = new StatsSyncResult
        {
            Synced = 0,
            Skipped = 0,
            Errors = new List<string>(),
            ScoringType = "PPR (default)"
        };

        try
        {
            // Get scoring settings
            var scoring = DefaultScoring;

            if (leagueId.HasValue)
            {
                var leagueScoring = await GetLeagueScoringSettingsAsync(leagueId.Value);
                if (leagueScoring != null && leagueScoring.Count > 0)
                {
                    scoring = leagueScoring;
                    var recPoints = scoring.GetValueOrDefault("rec", 1m);
                    result.ScoringType = recPoints switch
                    {
                        1m => "PPR (league)",
                        0.5m => "Half-PPR (league)",
                        0m => "Standard (league)",
                        _ => $"Custom ({recPoints} PPR)"
                    };
                    _logger.LogInformation("Using league scoring settings: {ScoringType}", result.ScoringType);
                }
                else
                {
                    _logger.LogInformation("League {LeagueId} has no scoring settings, using default PPR", leagueId);
                }
            }

            // Fetch stats from Sleeper
            var allStats = await FetchSeasonStatsAsync(season);

            // Get all players in our database
            var players = await _context.Players
                .Where(p => p.Position == "QB" || p.Position == "RB" || p.Position == "WR" || p.Position == "TE")
                .Select(p => new { p.Id, p.SleeperPlayerId })
                .ToListAsync();

            var playerMap = players.ToDictionary(p => p.SleeperPlayerId, p => p.Id);

            _logger.LogInformation("Syncing stats for {Count} players in database...", players.Count);

            foreach (var (sleeperId, stats) in allStats)
            {
                if (!playerMap.TryGetValue(sleeperId, out var playerId))
                {
                    result.Skipped++;
                    continue;
                }

                var gamesPlayed = stats.GetValueOrDefault("gp", 0);
                if (gamesPlayed == 0)
                {
                    result.Skipped++;
                    continue;
                }

                var totalPoints = CalculateFantasyPoints(stats, scoring);
                var ppg = gamesPlayed > 0 ? totalPoints / gamesPlayed : 0;

                try
                {
                    var existingStat = await _context.PlayerSeasonStats
                        .FirstOrDefaultAsync(ps => ps.PlayerId == playerId && ps.Season == season);

                    if (existingStat != null)
                    {
                        existingStat.GamesPlayed = gamesPlayed;
                        existingStat.GamesStarted = stats.GetValueOrDefault("gs", 0);
                        existingStat.TotalFantasyPoints = totalPoints;
                        existingStat.AvgPointsPerGame = Math.Round(ppg, 2);
                        existingStat.PassingYards = stats.GetValueOrDefault("pass_yd", 0);
                        existingStat.PassingTds = stats.GetValueOrDefault("pass_td", 0);
                        existingStat.Interceptions = stats.GetValueOrDefault("pass_int", 0);
                        existingStat.PassingAttempts = stats.GetValueOrDefault("pass_att", 0);
                        existingStat.Completions = stats.GetValueOrDefault("pass_cmp", 0);
                        existingStat.RushingYards = stats.GetValueOrDefault("rush_yd", 0);
                        existingStat.RushingTds = stats.GetValueOrDefault("rush_td", 0);
                        existingStat.RushingAttempts = stats.GetValueOrDefault("rush_att", 0);
                        existingStat.Receptions = stats.GetValueOrDefault("rec", 0);
                        existingStat.ReceivingYards = stats.GetValueOrDefault("rec_yd", 0);
                        existingStat.ReceivingTds = stats.GetValueOrDefault("rec_td", 0);
                        existingStat.Targets = stats.GetValueOrDefault("rec_tgt", 0);
                        existingStat.SyncedAt = DateTime.UtcNow;
                    }
                    else
                    {
                        var newStat = new PlayerSeasonStat
                        {
                            PlayerId = playerId,
                            Season = season,
                            GamesPlayed = gamesPlayed,
                            GamesStarted = stats.GetValueOrDefault("gs", 0),
                            TotalFantasyPoints = totalPoints,
                            AvgPointsPerGame = Math.Round(ppg, 2),
                            PassingYards = stats.GetValueOrDefault("pass_yd", 0),
                            PassingTds = stats.GetValueOrDefault("pass_td", 0),
                            Interceptions = stats.GetValueOrDefault("pass_int", 0),
                            PassingAttempts = stats.GetValueOrDefault("pass_att", 0),
                            Completions = stats.GetValueOrDefault("pass_cmp", 0),
                            RushingYards = stats.GetValueOrDefault("rush_yd", 0),
                            RushingTds = stats.GetValueOrDefault("rush_td", 0),
                            RushingAttempts = stats.GetValueOrDefault("rush_att", 0),
                            Receptions = stats.GetValueOrDefault("rec", 0),
                            ReceivingYards = stats.GetValueOrDefault("rec_yd", 0),
                            ReceivingTds = stats.GetValueOrDefault("rec_td", 0),
                            Targets = stats.GetValueOrDefault("rec_tgt", 0),
                            SyncedAt = DateTime.UtcNow
                        };
                        _context.PlayerSeasonStats.Add(newStat);
                    }

                    result.Synced++;
                }
                catch (Exception ex)
                {
                    result.Errors.Add($"Failed to sync {sleeperId}: {ex.Message}");
                }
            }

            await _context.SaveChangesAsync();

            _logger.LogInformation("Stats sync complete. Synced: {Synced}, Skipped: {Skipped}", 
                result.Synced, result.Skipped);

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Stats sync failed");
            result.Errors.Add($"Global error: {ex.Message}");
            return result;
        }
    }

    private async Task<Dictionary<string, Dictionary<string, int>>> FetchSeasonStatsAsync(int season)
    {
        var url = $"{SLEEPER_STATS_API}/stats/nfl/regular/{season}";

        _logger.LogInformation("Fetching {Season} stats from Sleeper...", season);

        var response = await _httpClient.GetAsync(url);

        if (!response.IsSuccessStatusCode)
        {
            throw new HttpRequestException($"Sleeper Stats API error: {response.StatusCode} {response.ReasonPhrase}");
        }

        var content = await response.Content.ReadAsStringAsync();
        var stats = JsonSerializer.Deserialize<Dictionary<string, Dictionary<string, int>>>(content,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
            ?? throw new InvalidOperationException("Failed to deserialize stats");

        _logger.LogInformation("Received stats for {Count} players", stats.Count);

        return stats;
    }

    private async Task<Dictionary<string, decimal>?> GetLeagueScoringSettingsAsync(Guid leagueId)
    {
        var league = await _context.Leagues
            .FirstOrDefaultAsync(l => l.Id == leagueId);

        if (league?.ScoringSettingsJson == null)
        {
            return null;
        }

        try
        {
            var settings = JsonSerializer.Deserialize<Dictionary<string, decimal>>(league.ScoringSettingsJson);
            return settings;
        }
        catch
        {
            return null;
        }
    }

    private decimal CalculateFantasyPoints(Dictionary<string, int> stats, Dictionary<string, decimal> scoring)
    {
        decimal points = 0;

        points += stats.GetValueOrDefault("pass_yd", 0) * scoring.GetValueOrDefault("pass_yd", DefaultScoring["pass_yd"]);
        points += stats.GetValueOrDefault("pass_td", 0) * scoring.GetValueOrDefault("pass_td", DefaultScoring["pass_td"]);
        points += stats.GetValueOrDefault("pass_int", 0) * scoring.GetValueOrDefault("pass_int", DefaultScoring["pass_int"]);
        points += stats.GetValueOrDefault("rush_yd", 0) * scoring.GetValueOrDefault("rush_yd", DefaultScoring["rush_yd"]);
        points += stats.GetValueOrDefault("rush_td", 0) * scoring.GetValueOrDefault("rush_td", DefaultScoring["rush_td"]);
        points += stats.GetValueOrDefault("rec", 0) * scoring.GetValueOrDefault("rec", DefaultScoring["rec"]);
        points += stats.GetValueOrDefault("rec_yd", 0) * scoring.GetValueOrDefault("rec_yd", DefaultScoring["rec_yd"]);
        points += stats.GetValueOrDefault("rec_td", 0) * scoring.GetValueOrDefault("rec_td", DefaultScoring["rec_td"]);
        points += stats.GetValueOrDefault("fum_lost", 0) * scoring.GetValueOrDefault("fum_lost", DefaultScoring["fum_lost"]);

        return Math.Round(points, 2);
    }
}

public class StatsSyncResult
{
    public int Synced { get; set; }
    public int Skipped { get; set; }
    public List<string> Errors { get; set; } = new();
    public string ScoringType { get; set; } = string.Empty;
}
