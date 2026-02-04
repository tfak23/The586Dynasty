using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace Mobile.CSharp.Models;

public class League
{
    [JsonPropertyName("id")]
    public Guid Id { get; set; }

    [JsonPropertyName("sleeper_league_id")]
    public string SleeperLeagueId { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("salary_cap")]
    public decimal SalaryCap { get; set; } = 500.00m;

    [JsonPropertyName("min_contract_years")]
    public int MinContractYears { get; set; } = 45;

    [JsonPropertyName("max_contract_years")]
    public int MaxContractYears { get; set; } = 75;

    [JsonPropertyName("trade_approval_mode")]
    public string TradeApprovalMode { get; set; } = "auto";

    [JsonPropertyName("league_vote_window_hours")]
    public int? LeagueVoteWindowHours { get; set; } = 24;

    [JsonPropertyName("veto_threshold")]
    public decimal? VetoThreshold { get; set; } = 0.50m;

    [JsonPropertyName("current_season")]
    public int CurrentSeason { get; set; } = 2025;

    [JsonPropertyName("total_rosters")]
    public int? TotalRosters { get; set; } = 12;

    [JsonPropertyName("roster_positions")]
    public List<string>? RosterPositions { get; set; }

    [JsonPropertyName("scoring_settings")]
    public Dictionary<string, decimal>? ScoringSettings { get; set; }

    [JsonPropertyName("created_at")]
    public DateTime CreatedAt { get; set; }

    [JsonPropertyName("updated_at")]
    public DateTime UpdatedAt { get; set; }

    public List<Team>? Teams { get; set; }
}
