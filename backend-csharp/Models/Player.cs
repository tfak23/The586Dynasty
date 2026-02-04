using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.CSharp.Models;

[Table("players")]
public class Player
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [Column("sleeper_player_id")]
    [MaxLength(20)]
    public string SleeperPlayerId { get; set; } = string.Empty;

    [Required]
    [Column("full_name")]
    [MaxLength(100)]
    public string FullName { get; set; } = string.Empty;

    [Column("first_name")]
    [MaxLength(50)]
    public string? FirstName { get; set; }

    [Column("last_name")]
    [MaxLength(50)]
    public string? LastName { get; set; }

    [Required]
    [Column("position")]
    [MaxLength(10)]
    public string Position { get; set; } = string.Empty;

    [Column("team")]
    [MaxLength(10)]
    public string? Team { get; set; }

    [Column("age")]
    public int? Age { get; set; }

    [Column("years_exp")]
    public int? YearsExp { get; set; }

    [Column("college")]
    [MaxLength(100)]
    public string? College { get; set; }

    [Column("number")]
    public int? Number { get; set; }

    [Column("status")]
    [MaxLength(20)]
    public string? Status { get; set; }

    [Column("search_full_name")]
    [MaxLength(100)]
    public string? SearchFullName { get; set; }

    [Column("search_last_name")]
    [MaxLength(50)]
    public string? SearchLastName { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Contract> Contracts { get; set; } = new List<Contract>();
}
