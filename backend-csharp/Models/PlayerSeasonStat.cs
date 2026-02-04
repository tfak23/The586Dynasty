using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.CSharp.Models;

[Table("player_season_stats")]
public class PlayerSeasonStat
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [Column("player_id")]
    public Guid PlayerId { get; set; }

    [Required]
    [Column("season")]
    public int Season { get; set; }

    [Column("games_played")]
    public int GamesPlayed { get; set; } = 0;

    [Column("games_started")]
    public int GamesStarted { get; set; } = 0;

    [Column("total_fantasy_points")]
    public decimal TotalFantasyPoints { get; set; } = 0;

    [Column("avg_points_per_game")]
    public decimal AvgPointsPerGame { get; set; } = 0;

    [Column("passing_yards")]
    public int PassingYards { get; set; } = 0;

    [Column("passing_tds")]
    public int PassingTds { get; set; } = 0;

    [Column("interceptions")]
    public int Interceptions { get; set; } = 0;

    [Column("passing_attempts")]
    public int PassingAttempts { get; set; } = 0;

    [Column("completions")]
    public int Completions { get; set; } = 0;

    [Column("rushing_yards")]
    public int RushingYards { get; set; } = 0;

    [Column("rushing_tds")]
    public int RushingTds { get; set; } = 0;

    [Column("rushing_attempts")]
    public int RushingAttempts { get; set; } = 0;

    [Column("receptions")]
    public int Receptions { get; set; } = 0;

    [Column("receiving_yards")]
    public int ReceivingYards { get; set; } = 0;

    [Column("receiving_tds")]
    public int ReceivingTds { get; set; } = 0;

    [Column("targets")]
    public int Targets { get; set; } = 0;

    [Column("synced_at")]
    public DateTime SyncedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("PlayerId")]
    public Player Player { get; set; } = null!;
}
