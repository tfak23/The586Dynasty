using System.Text.Json.Serialization;

namespace Mobile.CSharp.Models;

public class Team
{
    [JsonPropertyName("id")]
    public Guid Id { get; set; }

    [JsonPropertyName("league_id")]
    public Guid LeagueId { get; set; }

    [JsonPropertyName("sleeper_roster_id")]
    public int SleeperRosterId { get; set; }

    [JsonPropertyName("sleeper_user_id")]
    public string? SleeperUserId { get; set; }

    [JsonPropertyName("team_name")]
    public string? TeamName { get; set; }

    [JsonPropertyName("owner_name")]
    public string? OwnerName { get; set; }

    [JsonPropertyName("avatar_url")]
    public string? AvatarUrl { get; set; }

    [JsonPropertyName("division")]
    public string? Division { get; set; }

    [JsonPropertyName("created_at")]
    public DateTime CreatedAt { get; set; }

    [JsonPropertyName("updated_at")]
    public DateTime UpdatedAt { get; set; }

    public League? League { get; set; }
    public List<Contract>? Contracts { get; set; }
}
