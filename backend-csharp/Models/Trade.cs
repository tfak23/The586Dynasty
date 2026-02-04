using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.CSharp.Models;

[Table("trades")]
public class Trade
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [Column("league_id")]
    public Guid LeagueId { get; set; }

    [Column("status")]
    [MaxLength(20)]
    public string Status { get; set; } = "pending";

    [Column("approval_mode")]
    [MaxLength(20)]
    public string ApprovalMode { get; set; } = "auto";

    [Column("requires_commissioner_approval")]
    public bool RequiresCommissionerApproval { get; set; } = false;

    [Column("requires_league_vote")]
    public bool RequiresLeagueVote { get; set; } = false;

    [Column("votes_for")]
    public int VotesFor { get; set; } = 0;

    [Column("votes_against")]
    public int VotesAgainst { get; set; } = 0;

    [Column("vote_deadline")]
    public DateTime? VoteDeadline { get; set; }

    [Column("commissioner_approved_by")]
    public Guid? CommissionerApprovedBy { get; set; }

    [Column("commissioner_approved_at")]
    public DateTime? CommissionerApprovedAt { get; set; }

    [Column("expires_at")]
    public DateTime ExpiresAt { get; set; }

    [Column("proposer_team_id")]
    public Guid? ProposerTeamId { get; set; }

    [Column("notes")]
    public string? Notes { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("LeagueId")]
    public League League { get; set; } = null!;

    public ICollection<TradeTeam> TradeTeams { get; set; } = new List<TradeTeam>();
    public ICollection<TradeAsset> TradeAssets { get; set; } = new List<TradeAsset>();
    public ICollection<TradeVote> TradeVotes { get; set; } = new List<TradeVote>();
}

[Table("trade_teams")]
public class TradeTeam
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [Column("trade_id")]
    public Guid TradeId { get; set; }

    [Required]
    [Column("team_id")]
    public Guid TeamId { get; set; }

    [Column("status")]
    [MaxLength(20)]
    public string Status { get; set; } = "pending";

    [Column("accepted_at")]
    public DateTime? AcceptedAt { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("TradeId")]
    public Trade Trade { get; set; } = null!;

    [ForeignKey("TeamId")]
    public Team Team { get; set; } = null!;
}

[Table("trade_assets")]
public class TradeAsset
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [Column("trade_id")]
    public Guid TradeId { get; set; }

    [Required]
    [Column("from_team_id")]
    public Guid FromTeamId { get; set; }

    [Required]
    [Column("to_team_id")]
    public Guid ToTeamId { get; set; }

    [Column("asset_type")]
    [MaxLength(20)]
    public string AssetType { get; set; } = "contract";

    [Column("contract_id")]
    public Guid? ContractId { get; set; }

    [Column("draft_pick_id")]
    public Guid? DraftPickId { get; set; }

    [Column("cap_amount")]
    public decimal? CapAmount { get; set; }

    [Column("cap_year")]
    public int? CapYear { get; set; } = 2026;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("TradeId")]
    public Trade Trade { get; set; } = null!;

    [ForeignKey("ContractId")]
    public Contract? Contract { get; set; }

    [ForeignKey("DraftPickId")]
    public DraftPick? DraftPick { get; set; }
}

[Table("trade_votes")]
public class TradeVote
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [Column("trade_id")]
    public Guid TradeId { get; set; }

    [Required]
    [Column("team_id")]
    public Guid TeamId { get; set; }

    [Column("vote")]
    [MaxLength(10)]
    public string Vote { get; set; } = string.Empty;

    [Column("voted_at")]
    public DateTime VotedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("TradeId")]
    public Trade Trade { get; set; } = null!;

    [ForeignKey("TeamId")]
    public Team Team { get; set; } = null!;
}
