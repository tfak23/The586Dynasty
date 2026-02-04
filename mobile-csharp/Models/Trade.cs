using System.Text.Json.Serialization;

namespace Mobile.CSharp.Models;

public class Trade
{
    [JsonPropertyName("id")]
    public Guid Id { get; set; }

    [JsonPropertyName("league_id")]
    public Guid LeagueId { get; set; }

    [JsonPropertyName("status")]
    public string Status { get; set; } = "pending";

    [JsonPropertyName("approval_mode")]
    public string ApprovalMode { get; set; } = "auto";

    [JsonPropertyName("requires_commissioner_approval")]
    public bool RequiresCommissionerApproval { get; set; } = false;

    [JsonPropertyName("requires_league_vote")]
    public bool RequiresLeagueVote { get; set; } = false;

    [JsonPropertyName("votes_for")]
    public int VotesFor { get; set; } = 0;

    [JsonPropertyName("votes_against")]
    public int VotesAgainst { get; set; } = 0;

    [JsonPropertyName("vote_deadline")]
    public DateTime? VoteDeadline { get; set; }

    [JsonPropertyName("commissioner_approved_by")]
    public Guid? CommissionerApprovedBy { get; set; }

    [JsonPropertyName("commissioner_approved_at")]
    public DateTime? CommissionerApprovedAt { get; set; }

    [JsonPropertyName("expires_at")]
    public DateTime ExpiresAt { get; set; }

    [JsonPropertyName("proposer_team_id")]
    public Guid? ProposerTeamId { get; set; }

    [JsonPropertyName("notes")]
    public string? Notes { get; set; }

    [JsonPropertyName("created_at")]
    public DateTime CreatedAt { get; set; }

    [JsonPropertyName("updated_at")]
    public DateTime UpdatedAt { get; set; }

    public League? League { get; set; }
    public List<TradeTeam>? TradeTeams { get; set; }
    public List<TradeAsset>? TradeAssets { get; set; }
}

public class TradeTeam
{
    [JsonPropertyName("id")]
    public Guid Id { get; set; }

    [JsonPropertyName("trade_id")]
    public Guid TradeId { get; set; }

    [JsonPropertyName("team_id")]
    public Guid TeamId { get; set; }

    [JsonPropertyName("status")]
    public string Status { get; set; } = "pending";

    [JsonPropertyName("accepted_at")]
    public DateTime? AcceptedAt { get; set; }

    [JsonPropertyName("created_at")]
    public DateTime CreatedAt { get; set; }

    public Team? Team { get; set; }
}

public class TradeAsset
{
    [JsonPropertyName("id")]
    public Guid Id { get; set; }

    [JsonPropertyName("trade_id")]
    public Guid TradeId { get; set; }

    [JsonPropertyName("from_team_id")]
    public Guid FromTeamId { get; set; }

    [JsonPropertyName("to_team_id")]
    public Guid ToTeamId { get; set; }

    [JsonPropertyName("asset_type")]
    public string AssetType { get; set; } = "contract";

    [JsonPropertyName("contract_id")]
    public Guid? ContractId { get; set; }

    [JsonPropertyName("draft_pick_id")]
    public Guid? DraftPickId { get; set; }

    [JsonPropertyName("cap_amount")]
    public decimal? CapAmount { get; set; }

    [JsonPropertyName("cap_year")]
    public int? CapYear { get; set; }

    [JsonPropertyName("created_at")]
    public DateTime CreatedAt { get; set; }

    public Contract? Contract { get; set; }
}
