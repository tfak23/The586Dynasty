using Backend.CSharp.Data;
using Backend.CSharp.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.CSharp.Services;

/// <summary>
/// Service for evaluating existing contracts against market value
/// </summary>
public class ContractEvaluatorService
{
    private readonly AppDbContext _context;
    private readonly ContractEstimatorService _estimator;
    private readonly ILogger<ContractEvaluatorService> _logger;

    private const int LEGENDARY_MAX_RANK = 10;
    private const decimal LEGENDARY_MIN_PPG = 10m;
    private const int CORNERSTONE_MAX_POSITION_RANK = 5;
    private const decimal BUST_THRESHOLD = -25m;
    private const decimal STEAL_THRESHOLD = 25m;

    public ContractEvaluatorService(
        AppDbContext context,
        ContractEstimatorService estimator,
        ILogger<ContractEvaluatorService> logger)
    {
        _context = context;
        _estimator = estimator;
        _logger = logger;
    }

    public async Task<ContractEvaluation> EvaluateContractAsync(Guid contractId, Guid leagueId)
    {
        var contract = await _context.Contracts
            .Include(c => c.Player)
            .FirstOrDefaultAsync(c => c.Id == contractId);

        if (contract == null)
        {
            throw new InvalidOperationException("Contract not found");
        }

        if (contract.Salary <= 0)
        {
            throw new InvalidOperationException("Cannot evaluate $0 contracts - player is awaiting franchise tag or release");
        }

        // Get player stats
        var stats = await _context.PlayerSeasonStats
            .FirstOrDefaultAsync(ps => ps.PlayerId == contract.PlayerId && ps.Season == 2025);

        // Check if player is a true rookie (no stats in recent 3 seasons)
        var recentStatsCount = await _context.PlayerSeasonStats
            .Where(ps => ps.PlayerId == contract.PlayerId && ps.Season >= 2023)
            .CountAsync();

        var playerPpg = stats?.AvgPointsPerGame ?? 0;
        var isTrueRookie = recentStatsCount == 0 && playerPpg >= 2;

        if (isTrueRookie)
        {
            return new ContractEvaluation
            {
                ContractId = contractId,
                PlayerName = contract.Player.FullName,
                Position = contract.Player.Position,
                Salary = contract.Salary,
                AverageSalary = 0,
                PointsPerGame = playerPpg,
                ValueScore = 0,
                Rating = "ROOKIE",
                Rank = 0,
                Reasoning = $"Rookie contract - no stats history to evaluate yet. Check back after the season."
            };
        }

        // Get market estimate
        var estimate = await _estimator.EstimateContractAsync(
            leagueId,
            contract.PlayerId,
            contract.Player.Position,
            contract.Player.Age,
            null,
            2025);

        var actualSalary = contract.Salary;
        var estimatedSalary = estimate.EstimatedSalary;

        // Calculate value score
        var valueScore = estimatedSalary > 0
            ? ((estimatedSalary - actualSalary) / estimatedSalary) * 100
            : 0;

        // Get position rankings
        var positionRankings = await GetPositionRankingsAsync(leagueId, contract.Player.Position, 2025);
        var playerPositionRank = positionRankings.FirstOrDefault(r => r.PlayerId == contract.PlayerId);
        var positionRank = playerPositionRank?.Rank ?? 0;

        // Get league contract rankings
        var leagueRankings = await GetLeagueContractRankingsAsync(leagueId);
        var playerRank = leagueRankings.FirstOrDefault(r => r.ContractId == contractId);
        var leagueRank = playerRank?.Rank ?? 0;

        // Determine rating
        var rating = DetermineRating(valueScore, leagueRank, positionRank, playerPpg);

        // Generate reasoning
        var reasoning = GenerateReasoning(
            rating,
            valueScore,
            actualSalary,
            estimatedSalary,
            contract.Player.Position,
            leagueRank,
            positionRank);

        return new ContractEvaluation
        {
            ContractId = contractId,
            PlayerName = contract.Player.FullName,
            Position = contract.Player.Position,
            Salary = actualSalary,
            AverageSalary = estimatedSalary,
            PointsPerGame = playerPpg,
            ValueScore = Math.Round(valueScore, 0),
            Rating = rating,
            Rank = leagueRank,
            Reasoning = reasoning
        };
    }

    private string DetermineRating(decimal valueScore, int leagueRank, int positionRank, decimal playerPpg)
    {
        var isTop10Value = leagueRank > 0 && leagueRank <= LEGENDARY_MAX_RANK;
        var hasMinimumPPG = playerPpg > LEGENDARY_MIN_PPG;

        if (isTop10Value && hasMinimumPPG)
        {
            return "LEGENDARY";
        }

        if (positionRank > 0 && positionRank <= CORNERSTONE_MAX_POSITION_RANK)
        {
            return "CORNERSTONE";
        }

        if (valueScore < BUST_THRESHOLD)
        {
            return "BUST";
        }

        if (valueScore >= STEAL_THRESHOLD)
        {
            return "STEAL";
        }

        return "GOOD";
    }

    private string GenerateReasoning(
        string rating,
        decimal valueScore,
        decimal actualSalary,
        decimal estimatedSalary,
        string position,
        int leagueRank,
        int positionRank)
    {
        var diff = Math.Abs(estimatedSalary - actualSalary);
        var percentDiff = Math.Abs(valueScore);

        return rating switch
        {
            "LEGENDARY" => $"Elite value! #{leagueRank} best contract in the league. Saving ${diff:F0}/year ({percentDiff:F0}% below market) for this {position}.",
            "CORNERSTONE" => $"Elite producer! Top {positionRank} {position} in the league. Premium price justified by top-tier performance.",
            "STEAL" => $"Great deal! Paying ${diff:F0} less than market value ({percentDiff:F0}% savings) for this {position}.",
            "GOOD" when valueScore >= 0 => $"Fair contract. Slightly below market value for this {position}.",
            "GOOD" => $"Fair contract. Slightly above market value for this {position}.",
            "BUST" => $"Overpaying by ${diff:F0}/year ({percentDiff:F0}% above market) for this {position}.",
            "ROOKIE" => $"Rookie contract - no stats history to evaluate yet. Check back after the season.",
            _ => $"Contract evaluation for {position}."
        };
    }

    public async Task<List<PositionRanking>> GetPositionRankingsAsync(Guid leagueId, string position, int season)
    {
        var rankings = await _context.Contracts
            .Include(c => c.Player)
            .Where(c => c.LeagueId == leagueId &&
                        c.Player.Position == position &&
                        c.Status == "active" &&
                        c.Salary > 0)
            .Join(_context.PlayerSeasonStats,
                c => c.PlayerId,
                ps => ps.PlayerId,
                (c, ps) => new { Contract = c, Stats = ps })
            .Where(j => j.Stats.Season == season && j.Stats.AvgPointsPerGame > 0)
            .Select(j => new PositionRanking
            {
                PlayerId = j.Contract.PlayerId,
                PlayerName = j.Contract.Player.FullName,
                Ppg = j.Stats.AvgPointsPerGame,
                Rank = 0
            })
            .OrderByDescending(r => r.Ppg)
            .ToListAsync();

        for (int i = 0; i < rankings.Count; i++)
        {
            rankings[i].Rank = i + 1;
        }

        return rankings;
    }

    public async Task<List<ContractRanking>> GetLeagueContractRankingsAsync(Guid leagueId)
    {
        var contracts = await _context.Contracts
            .Include(c => c.Player)
            .Where(c => c.LeagueId == leagueId && c.Status == "active" && c.Salary > 0)
            .ToListAsync();

        var rankings = new List<ContractRanking>();

        foreach (var contract in contracts)
        {
            try
            {
                var estimate = await _estimator.EstimateContractAsync(
                    leagueId,
                    contract.PlayerId,
                    contract.Player.Position,
                    contract.Player.Age,
                    null,
                    2025);

                var valueScore = estimate.EstimatedSalary > 0
                    ? ((estimate.EstimatedSalary - contract.Salary) / estimate.EstimatedSalary) * 100
                    : 0;

                rankings.Add(new ContractRanking
                {
                    ContractId = contract.Id,
                    ValueScore = valueScore,
                    Rank = 0
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error evaluating contract {ContractId}", contract.Id);
            }
        }

        rankings = rankings.OrderByDescending(r => r.ValueScore).ToList();

        for (int i = 0; i < rankings.Count; i++)
        {
            rankings[i].Rank = i + 1;
        }

        return rankings;
    }
}

public class PositionRanking
{
    public Guid PlayerId { get; set; }
    public string PlayerName { get; set; } = string.Empty;
    public decimal Ppg { get; set; }
    public int Rank { get; set; }
}

public class ContractRanking
{
    public Guid ContractId { get; set; }
    public decimal ValueScore { get; set; }
    public int Rank { get; set; }
}
