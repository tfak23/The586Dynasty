using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.CSharp.Models;

[Table("draft_picks")]
public class DraftPick
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [Column("league_id")]
    public Guid LeagueId { get; set; }

    [Column("season")]
    public int Season { get; set; }

    [Column("round")]
    public int Round { get; set; }

    [Column("pick_number")]
    public int? PickNumber { get; set; }

    [Column("original_team_id")]
    public Guid? OriginalTeamId { get; set; }

    [Column("current_team_id")]
    public Guid? CurrentTeamId { get; set; }

    [Column("is_used")]
    public bool IsUsed { get; set; } = false;

    [Column("used_for_player_id")]
    public Guid? UsedForPlayerId { get; set; }

    [Column("used_for_contract_id")]
    public Guid? UsedForContractId { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("LeagueId")]
    public League League { get; set; } = null!;

    [ForeignKey("CurrentTeamId")]
    public Team? CurrentTeam { get; set; }
}

[Table("cap_adjustments")]
public class CapAdjustment
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [Column("team_id")]
    public Guid TeamId { get; set; }

    [Required]
    [Column("league_id")]
    public Guid LeagueId { get; set; }

    [Column("adjustment_type")]
    [MaxLength(50)]
    public string AdjustmentType { get; set; } = string.Empty;

    [Column("player_id")]
    public Guid? PlayerId { get; set; }

    [Column("contract_id")]
    public Guid? ContractId { get; set; }

    [Column("trade_id")]
    public Guid? TradeId { get; set; }

    [Column("description")]
    public string Description { get; set; } = string.Empty;

    [Column("player_name")]
    [MaxLength(255)]
    public string? PlayerName { get; set; }

    [Column("amount_2026")]
    public decimal Amount2026 { get; set; } = 0;

    [Column("amount_2027")]
    public decimal Amount2027 { get; set; } = 0;

    [Column("amount_2028")]
    public decimal Amount2028 { get; set; } = 0;

    [Column("amount_2029")]
    public decimal Amount2029 { get; set; } = 0;

    [Column("amount_2030")]
    public decimal Amount2030 { get; set; } = 0;

    [Column("effective_date")]
    public DateTime? EffectiveDate { get; set; }

    [Column("notes")]
    public string? Notes { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("TeamId")]
    public Team Team { get; set; } = null!;

    [ForeignKey("LeagueId")]
    public League League { get; set; } = null!;
}

[Table("trade_history")]
public class TradeHistory
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [Column("league_id")]
    public Guid LeagueId { get; set; }

    [Column("trade_number")]
    [MaxLength(20)]
    public string TradeNumber { get; set; } = string.Empty;

    [Column("trade_year")]
    public int TradeYear { get; set; }

    [Column("team1_id")]
    public Guid? Team1Id { get; set; }

    [Column("team1_name")]
    [MaxLength(255)]
    public string Team1Name { get; set; } = string.Empty;

    [Column("team2_id")]
    public Guid? Team2Id { get; set; }

    [Column("team2_name")]
    [MaxLength(255)]
    public string Team2Name { get; set; } = string.Empty;

    [Column("team1_received", TypeName = "jsonb")]
    public string Team1ReceivedJson { get; set; } = "[]";

    [Column("team2_received", TypeName = "jsonb")]
    public string Team2ReceivedJson { get; set; } = "[]";

    [Column("team1_cap_hit")]
    public decimal Team1CapHit { get; set; } = 0;

    [Column("team2_cap_hit")]
    public decimal Team2CapHit { get; set; } = 0;

    [Column("trade_date")]
    public DateTime? TradeDate { get; set; }

    [Column("notes")]
    public string? Notes { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("LeagueId")]
    public League League { get; set; } = null!;
}

[Table("cap_transactions")]
public class CapTransaction
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [Column("league_id")]
    public Guid LeagueId { get; set; }

    [Required]
    [Column("team_id")]
    public Guid TeamId { get; set; }

    [Column("season")]
    public int Season { get; set; }

    [Column("transaction_type")]
    [MaxLength(30)]
    public string TransactionType { get; set; } = string.Empty;

    [Column("amount")]
    public decimal Amount { get; set; }

    [Column("description")]
    public string? Description { get; set; }

    [Column("related_contract_id")]
    public Guid? RelatedContractId { get; set; }

    [Column("related_trade_id")]
    public Guid? RelatedTradeId { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("LeagueId")]
    public League League { get; set; } = null!;

    [ForeignKey("TeamId")]
    public Team Team { get; set; } = null!;
}

[Table("expired_contracts")]
public class ExpiredContract
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [Column("league_id")]
    public Guid LeagueId { get; set; }

    [Column("team_id")]
    public Guid? TeamId { get; set; }

    [Required]
    [Column("player_id")]
    public Guid PlayerId { get; set; }

    [Column("previous_salary")]
    public decimal? PreviousSalary { get; set; }

    [Column("previous_contract_id")]
    public Guid? PreviousContractId { get; set; }

    [Column("roster_status")]
    [MaxLength(20)]
    public string? RosterStatus { get; set; } = "active";

    [Column("eligible_for_franchise_tag")]
    public bool EligibleForFranchiseTag { get; set; } = true;

    [Column("season")]
    public int Season { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("LeagueId")]
    public League League { get; set; } = null!;

    [ForeignKey("PlayerId")]
    public Player Player { get; set; } = null!;
}

[Table("sync_log")]
public class SyncLog
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("league_id")]
    public Guid? LeagueId { get; set; }

    [Column("sync_type")]
    [MaxLength(30)]
    public string SyncType { get; set; } = string.Empty;

    [Column("status")]
    [MaxLength(20)]
    public string Status { get; set; } = "started";

    [Column("records_processed")]
    public int RecordsProcessed { get; set; } = 0;

    [Column("errors", TypeName = "jsonb")]
    public string? ErrorsJson { get; set; }

    [Column("started_at")]
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;

    [Column("completed_at")]
    public DateTime? CompletedAt { get; set; }
}
