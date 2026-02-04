using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;

namespace Backend.CSharp.Models;

[Table("contracts")]
public class Contract
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

    [Column("salary")]
    public decimal Salary { get; set; }

    [Column("years_total")]
    public int YearsTotal { get; set; }

    [Column("years_remaining")]
    public int YearsRemaining { get; set; }

    [Column("start_season")]
    public int StartSeason { get; set; }

    [Column("end_season")]
    public int EndSeason { get; set; }

    [Column("contract_type")]
    [MaxLength(20)]
    public string ContractType { get; set; } = "standard";

    [Column("has_option")]
    public bool HasOption { get; set; } = false;

    [Column("option_year")]
    public int? OptionYear { get; set; }

    [Column("option_exercised")]
    public bool? OptionExercised { get; set; }

    [Column("is_franchise_tagged")]
    public bool IsFranchiseTagged { get; set; } = false;

    [Column("status")]
    [MaxLength(20)]
    public string Status { get; set; } = "active";

    [Column("roster_status")]
    [MaxLength(20)]
    public string? RosterStatus { get; set; } = "active";

    [Column("acquisition_type")]
    [MaxLength(20)]
    public string AcquisitionType { get; set; } = "import";

    [Column("acquisition_date")]
    public DateTime? AcquisitionDate { get; set; }

    [Column("acquisition_details", TypeName = "jsonb")]
    public string? AcquisitionDetailsJson { get; set; }

    [NotMapped]
    public Dictionary<string, object>? AcquisitionDetails
    {
        get => string.IsNullOrEmpty(AcquisitionDetailsJson) 
            ? null 
            : JsonSerializer.Deserialize<Dictionary<string, object>>(AcquisitionDetailsJson);
        set => AcquisitionDetailsJson = value == null 
            ? null 
            : JsonSerializer.Serialize(value);
    }

    [Column("released_at")]
    public DateTime? ReleasedAt { get; set; }

    [Column("release_reason")]
    [MaxLength(50)]
    public string? ReleaseReason { get; set; }

    [Column("dead_cap_hit")]
    public decimal? DeadCapHit { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("LeagueId")]
    public League League { get; set; } = null!;

    [ForeignKey("TeamId")]
    public Team? Team { get; set; }

    [ForeignKey("PlayerId")]
    public Player Player { get; set; } = null!;
}
