using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;

namespace Backend.CSharp.Models;

[Table("leagues")]
public class League
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [Column("sleeper_league_id")]
    [MaxLength(50)]
    public string SleeperLeagueId { get; set; } = string.Empty;

    [Required]
    [Column("name")]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Column("salary_cap")]
    public decimal SalaryCap { get; set; } = 500.00m;

    [Column("min_contract_years")]
    public int MinContractYears { get; set; } = 45;

    [Column("max_contract_years")]
    public int MaxContractYears { get; set; } = 75;

    [Column("trade_approval_mode")]
    [MaxLength(20)]
    public string TradeApprovalMode { get; set; } = "auto";

    [Column("league_vote_window_hours")]
    public int? LeagueVoteWindowHours { get; set; } = 24;

    [Column("veto_threshold")]
    public decimal? VetoThreshold { get; set; } = 0.50m;

    [Column("current_season")]
    public int CurrentSeason { get; set; } = 2025;

    [Column("total_rosters")]
    public int? TotalRosters { get; set; } = 12;

    [Column("roster_positions", TypeName = "jsonb")]
    public string? RosterPositionsJson { get; set; }

    [NotMapped]
    public List<string>? RosterPositions
    {
        get => string.IsNullOrEmpty(RosterPositionsJson) 
            ? null 
            : JsonSerializer.Deserialize<List<string>>(RosterPositionsJson);
        set => RosterPositionsJson = value == null 
            ? null 
            : JsonSerializer.Serialize(value);
    }

    [Column("scoring_settings", TypeName = "jsonb")]
    public string? ScoringSettingsJson { get; set; }

    [NotMapped]
    public Dictionary<string, decimal>? ScoringSettings
    {
        get => string.IsNullOrEmpty(ScoringSettingsJson) 
            ? null 
            : JsonSerializer.Deserialize<Dictionary<string, decimal>>(ScoringSettingsJson);
        set => ScoringSettingsJson = value == null 
            ? null 
            : JsonSerializer.Serialize(value);
    }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Team> Teams { get; set; } = new List<Team>();
    public ICollection<Contract> Contracts { get; set; } = new List<Contract>();
    public ICollection<Trade> Trades { get; set; } = new List<Trade>();
}
