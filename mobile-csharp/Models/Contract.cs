using System.Text.Json.Serialization;

namespace Mobile.CSharp.Models;

public class Contract
{
    [JsonPropertyName("id")]
    public Guid Id { get; set; }

    [JsonPropertyName("league_id")]
    public Guid LeagueId { get; set; }

    [JsonPropertyName("team_id")]
    public Guid? TeamId { get; set; }

    [JsonPropertyName("player_id")]
    public Guid PlayerId { get; set; }

    [JsonPropertyName("salary")]
    public decimal Salary { get; set; }

    [JsonPropertyName("years_total")]
    public int YearsTotal { get; set; }

    [JsonPropertyName("years_remaining")]
    public int YearsRemaining { get; set; }

    [JsonPropertyName("start_season")]
    public int StartSeason { get; set; }

    [JsonPropertyName("end_season")]
    public int EndSeason { get; set; }

    [JsonPropertyName("contract_type")]
    public string ContractType { get; set; } = "standard";

    [JsonPropertyName("has_option")]
    public bool HasOption { get; set; } = false;

    [JsonPropertyName("option_year")]
    public int? OptionYear { get; set; }

    [JsonPropertyName("option_exercised")]
    public bool? OptionExercised { get; set; }

    [JsonPropertyName("is_franchise_tagged")]
    public bool IsFranchiseTagged { get; set; } = false;

    [JsonPropertyName("status")]
    public string Status { get; set; } = "active";

    [JsonPropertyName("roster_status")]
    public string? RosterStatus { get; set; } = "active";

    [JsonPropertyName("acquisition_type")]
    public string AcquisitionType { get; set; } = "import";

    [JsonPropertyName("acquisition_date")]
    public DateTime? AcquisitionDate { get; set; }

    [JsonPropertyName("acquisition_details")]
    public Dictionary<string, object>? AcquisitionDetails { get; set; }

    [JsonPropertyName("released_at")]
    public DateTime? ReleasedAt { get; set; }

    [JsonPropertyName("release_reason")]
    public string? ReleaseReason { get; set; }

    [JsonPropertyName("dead_cap_hit")]
    public decimal? DeadCapHit { get; set; }

    [JsonPropertyName("created_at")]
    public DateTime CreatedAt { get; set; }

    [JsonPropertyName("updated_at")]
    public DateTime UpdatedAt { get; set; }

    public League? League { get; set; }
    public Team? Team { get; set; }
    public Player? Player { get; set; }
}
