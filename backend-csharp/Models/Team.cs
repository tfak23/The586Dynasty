using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.CSharp.Models;

[Table("teams")]
public class Team
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [Column("league_id")]
    public Guid LeagueId { get; set; }

    [Column("sleeper_roster_id")]
    public int SleeperRosterId { get; set; }

    [Column("sleeper_user_id")]
    [MaxLength(50)]
    public string? SleeperUserId { get; set; }

    [Column("team_name")]
    [MaxLength(100)]
    public string? TeamName { get; set; }

    [Column("owner_name")]
    [MaxLength(100)]
    public string? OwnerName { get; set; }

    [Column("avatar_url")]
    [MaxLength(255)]
    public string? AvatarUrl { get; set; }

    [Column("division")]
    [MaxLength(50)]
    public string? Division { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("LeagueId")]
    public League League { get; set; } = null!;

    public ICollection<Contract> Contracts { get; set; } = new List<Contract>();
    public ICollection<DraftPick> OwnedDraftPicks { get; set; } = new List<DraftPick>();
}
