using Backend.CSharp.Data;
using Backend.CSharp.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.CSharp.Services;

/// <summary>
/// Service for estimating fair market value for player contracts
/// </summary>
public class ContractEstimatorService
{
    private readonly AppDbContext _context;
    private readonly ILogger<ContractEstimatorService> _logger;

    private static readonly Dictionary<string, PositionRange> PositionRanges = new()
    {
        { "QB", new PositionRange { Min = 1, Max = 100, Avg = 55 } },
        { "RB", new PositionRange { Min = 1, Max = 60, Avg = 25 } },
        { "WR", new PositionRange { Min = 1, Max = 70, Avg = 30 } },
        { "TE", new PositionRange { Min = 1, Max = 50, Avg = 22 } }
    };

    private const decimal MIN_SALARY = 1m;

    public ContractEstimatorService(AppDbContext context, ILogger<ContractEstimatorService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<ContractEstimate> EstimateContractAsync(
        Guid leagueId,
        Guid playerId,
        string position,
        int? age,
        decimal? previousSalary,
        int season = 2025)
    {
        // Get player stats
        var stats = await _context.PlayerSeasonStats
            .FirstOrDefaultAsync(ps => ps.PlayerId == playerId && ps.Season == season);

        var ppg = stats?.AvgPointsPerGame ?? 0;
        var gamesPlayed = stats?.GamesPlayed ?? 0;

        var positionRange = PositionRanges.GetValueOrDefault(position, PositionRanges["WR"]);

        // Find comparable players
        var comparables = await FindComparablePlayersAsync(leagueId, position, ppg, playerId, 5);

        decimal baseSalary;
        var adjustments = new List<Adjustment>();

        if (comparables.Count >= 2)
        {
            baseSalary = CalculateWeightedAverage(comparables, ppg);
        }
        else
        {
            // Fall back to position average
            baseSalary = await GetPositionAverageSalaryAsync(leagueId, position);

            // Adjust based on PPG relative to average
            var avgPpg = position switch
            {
                "QB" => 18m,
                "RB" => 12m,
                "WR" => 12m,
                "TE" => 10m,
                _ => 12m
            };

            var ppgDiff = ppg - avgPpg;
            var ppgMultiplier = position == "QB" ? 3m : 2m;
            var ppgAdjustment = ppgDiff * ppgMultiplier;
            baseSalary += ppgAdjustment;

            if (ppgAdjustment != 0)
            {
                adjustments.Add(new Adjustment
                {
                    Reason = ppgDiff > 0 ? "Above average PPG" : "Below average PPG",
                    Amount = ppgAdjustment
                });
            }
        }

        // Age adjustments
        var playerAge = age ?? 25;
        if (playerAge > 28)
        {
            var agePenalty = (playerAge - 28) * -2m;
            baseSalary += agePenalty;
            adjustments.Add(new Adjustment { Reason = $"Age {playerAge} (over 28)", Amount = agePenalty });
        }
        else if (playerAge >= 24 && playerAge <= 26)
        {
            var ageBonus = 3m;
            baseSalary += ageBonus;
            adjustments.Add(new Adjustment { Reason = $"Prime age ({playerAge})", Amount = ageBonus });
        }

        // Games played penalty
        if (gamesPlayed > 0 && gamesPlayed < 14)
        {
            var gamesAdjustment = Math.Round((14 - gamesPlayed) * -1.5m);
            baseSalary += gamesAdjustment;
            adjustments.Add(new Adjustment
            {
                Reason = $"Limited games ({gamesPlayed}/17)",
                Amount = gamesAdjustment
            });
        }

        // Previous salary influence
        if (previousSalary.HasValue && previousSalary > MIN_SALARY)
        {
            var prevInfluence = (previousSalary.Value - baseSalary) * 0.3m;
            if (Math.Abs(prevInfluence) > 2)
            {
                baseSalary += prevInfluence;
                adjustments.Add(new Adjustment
                {
                    Reason = "Previous contract influence",
                    Amount = prevInfluence
                });
            }
        }

        // Clamp to position range
        var estimatedSalary = Math.Max(positionRange.Min, Math.Min(positionRange.Max, baseSalary));
        estimatedSalary = Math.Round(estimatedSalary);

        // Calculate range (±10%)
        var rangeSpread = Math.Max(5, Math.Round(estimatedSalary * 0.1m));
        var salaryRangeMin = Math.Max(MIN_SALARY, estimatedSalary - rangeSpread);
        var salaryRangeMax = Math.Min(positionRange.Max, estimatedSalary + rangeSpread);

        // Determine confidence
        var confidence = (comparables.Count >= 3 && gamesPlayed >= 10) ? "high" :
                         (comparables.Count >= 1 || gamesPlayed >= 6) ? "medium" : "low";

        // Generate reasoning
        var reasoning = GenerateReasoning(position, ppg, age, comparables, baseSalary, adjustments);

        return new ContractEstimate
        {
            EstimatedSalary = estimatedSalary,
            SalaryRangeMin = salaryRangeMin,
            SalaryRangeMax = salaryRangeMax,
            Confidence = confidence,
            ComparablePlayers = comparables.Take(3).Select(c => new ComparablePlayer
            {
                PlayerName = c.FullName,
                Salary = c.Salary,
                PointsPerGame = c.Ppg,
                Age = c.Age
            }).ToList(),
            Reasoning = reasoning
        };
    }

    private async Task<List<ComparablePlayerData>> FindComparablePlayersAsync(
        Guid leagueId,
        string position,
        decimal ppg,
        Guid excludePlayerId,
        int limit)
    {
        var ppgRange = position == "QB" ? 3m : 2m;

        var comparables = await _context.Contracts
            .Include(c => c.Player)
            .Where(c => c.LeagueId == leagueId &&
                        c.Player.Position == position &&
                        c.Status == "active" &&
                        c.PlayerId != excludePlayerId)
            .Join(_context.PlayerSeasonStats,
                c => c.PlayerId,
                ps => ps.PlayerId,
                (c, ps) => new { Contract = c, Stats = ps })
            .Where(j => j.Stats.Season == 2025 &&
                        j.Stats.AvgPointsPerGame >= ppg - ppgRange &&
                        j.Stats.AvgPointsPerGame <= ppg + ppgRange)
            .Select(j => new ComparablePlayerData
            {
                PlayerId = j.Contract.PlayerId,
                FullName = j.Contract.Player.FullName,
                Position = j.Contract.Player.Position,
                Team = j.Contract.Player.Team,
                Age = j.Contract.Player.Age,
                Salary = j.Contract.Salary,
                Ppg = j.Stats.AvgPointsPerGame,
                TotalPoints = j.Stats.TotalFantasyPoints,
                GamesPlayed = j.Stats.GamesPlayed,
                YearsRemaining = j.Contract.YearsRemaining
            })
            .ToListAsync();

        return comparables
            .OrderBy(c => Math.Abs(c.Ppg - ppg))
            .Take(limit)
            .ToList();
    }

    private decimal CalculateWeightedAverage(List<ComparablePlayerData> comparables, decimal targetPpg)
    {
        if (comparables.Count == 0) return 0;

        decimal totalWeight = 0;
        decimal weightedSum = 0;

        foreach (var player in comparables)
        {
            var ppgDiff = Math.Abs(player.Ppg - targetPpg);
            var weight = 1m / (1m + ppgDiff);

            weightedSum += player.Salary * weight;
            totalWeight += weight;
        }

        return totalWeight > 0 ? weightedSum / totalWeight : 0;
    }

    private async Task<decimal> GetPositionAverageSalaryAsync(Guid leagueId, string position, int topN = 10)
    {
        var avgSalary = await _context.Contracts
            .Include(c => c.Player)
            .Where(c => c.LeagueId == leagueId &&
                        c.Player.Position == position &&
                        c.Status == "active")
            .OrderByDescending(c => c.Salary)
            .Take(topN)
            .Select(c => c.Salary)
            .AverageAsync();

        if (avgSalary == 0 && PositionRanges.TryGetValue(position, out var range))
        {
            return range.Avg;
        }

        return avgSalary;
    }

    private string GenerateReasoning(
        string position,
        decimal ppg,
        int? age,
        List<ComparablePlayerData> comparables,
        decimal baseSalary,
        List<Adjustment> adjustments)
    {
        var parts = new List<string>();

        if (comparables.Count >= 3)
        {
            var avgPpg = comparables.Average(c => c.Ppg);
            parts.Add($"Based on {comparables.Count} {position}s with similar PPG ({avgPpg:F1} avg)");
        }
        else if (comparables.Count > 0)
        {
            parts.Add($"Limited comparables found ({comparables.Count} {position}s)");
        }
        else
        {
            parts.Add("No direct comparables - using position averages");
        }

        foreach (var adj in adjustments.Where(a => a.Amount != 0))
        {
            var sign = adj.Amount > 0 ? "+" : "";
            parts.Add($"{adj.Reason}: {sign}${adj.Amount:F0}");
        }

        return string.Join(". ", parts);
    }
}

public class PositionRange
{
    public decimal Min { get; set; }
    public decimal Max { get; set; }
    public decimal Avg { get; set; }
}

public class ComparablePlayerData
{
    public Guid PlayerId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Position { get; set; } = string.Empty;
    public string? Team { get; set; }
    public int? Age { get; set; }
    public decimal Salary { get; set; }
    public decimal Ppg { get; set; }
    public decimal TotalPoints { get; set; }
    public int GamesPlayed { get; set; }
    public int YearsRemaining { get; set; }
}

public class Adjustment
{
    public string Reason { get; set; } = string.Empty;
    public decimal Amount { get; set; }
}
