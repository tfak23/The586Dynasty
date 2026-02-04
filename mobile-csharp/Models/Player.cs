using System.Text.Json.Serialization;

namespace Mobile.CSharp.Models;

public class Player
{
    [JsonPropertyName("id")]
    public Guid Id { get; set; }

    [JsonPropertyName("sleeper_player_id")]
    public string SleeperPlayerId { get; set; } = string.Empty;

    [JsonPropertyName("full_name")]
    public string FullName { get; set; } = string.Empty;

    [JsonPropertyName("first_name")]
    public string? FirstName { get; set; }

    [JsonPropertyName("last_name")]
    public string? LastName { get; set; }

    [JsonPropertyName("position")]
    public string Position { get; set; } = string.Empty;

    [JsonPropertyName("team")]
    public string? Team { get; set; }

    [JsonPropertyName("age")]
    public int? Age { get; set; }

    [JsonPropertyName("years_exp")]
    public int? YearsExp { get; set; }

    [JsonPropertyName("college")]
    public string? College { get; set; }

    [JsonPropertyName("number")]
    public int? Number { get; set; }

    [JsonPropertyName("status")]
    public string? Status { get; set; }

    [JsonPropertyName("updated_at")]
    public DateTime UpdatedAt { get; set; }
}
