using System.Text.Json;
using Backend.CSharp.Models;

namespace Backend.CSharp.Services;

public class SleeperService
{
    private readonly HttpClient _httpClient;
    private readonly string _leagueId;
    private const string SLEEPER_API_BASE = "https://api.sleeper.app/v1";
    
    // Cache for players data (large response, cache for 24 hours)
    private static Dictionary<string, SleeperPlayer>? _playersCache;
    private static DateTime _playersCacheTime;
    private static readonly TimeSpan PLAYERS_CACHE_TTL = TimeSpan.FromHours(24);

    public SleeperService(HttpClient httpClient, string leagueId)
    {
        _httpClient = httpClient;
        _leagueId = leagueId;
    }

    private async Task<T> FetchAsync<T>(string endpoint)
    {
        var url = $"{SLEEPER_API_BASE}{endpoint}";
        var response = await _httpClient.GetAsync(url);
        
        if (!response.IsSuccessStatusCode)
        {
            throw new HttpRequestException($"Sleeper API error: {response.StatusCode} {response.ReasonPhrase}");
        }

        var content = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<T>(content, new JsonSerializerOptions 
        { 
            PropertyNameCaseInsensitive = true 
        }) ?? throw new InvalidOperationException("Failed to deserialize response");
    }

    public async Task<SleeperLeague> GetLeagueAsync()
    {
        return await FetchAsync<SleeperLeague>($"/league/{_leagueId}");
    }

    public async Task<List<SleeperUser>> GetUsersAsync()
    {
        return await FetchAsync<List<SleeperUser>>($"/league/{_leagueId}/users");
    }

    public async Task<List<SleeperRoster>> GetRostersAsync()
    {
        return await FetchAsync<List<SleeperRoster>>($"/league/{_leagueId}/rosters");
    }

    public async Task<Dictionary<string, SleeperPlayer>> GetAllPlayersAsync()
    {
        // Check cache
        if (_playersCache != null && (DateTime.UtcNow - _playersCacheTime) < PLAYERS_CACHE_TTL)
        {
            return _playersCache;
        }

        // Fetch fresh data
        Console.WriteLine("Fetching fresh players data from Sleeper...");
        var players = await FetchAsync<Dictionary<string, SleeperPlayer>>("/players/nfl");
        
        // Update cache
        _playersCache = players;
        _playersCacheTime = DateTime.UtcNow;
        
        Console.WriteLine($"Cached {players.Count} players");
        return players;
    }

    public static async Task<Dictionary<string, SleeperPlayer>> GetAllPlayersStaticAsync(HttpClient httpClient)
    {
        // Check cache
        if (_playersCache != null && (DateTime.UtcNow - _playersCacheTime) < PLAYERS_CACHE_TTL)
        {
            return _playersCache;
        }

        var url = $"{SLEEPER_API_BASE}/players/nfl";
        var response = await httpClient.GetAsync(url);
        
        if (!response.IsSuccessStatusCode)
        {
            throw new HttpRequestException($"Sleeper API error: {response.StatusCode}");
        }

        var content = await response.Content.ReadAsStringAsync();
        var players = JsonSerializer.Deserialize<Dictionary<string, SleeperPlayer>>(content, 
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
            ?? throw new InvalidOperationException("Failed to deserialize players");
        
        _playersCache = players;
        _playersCacheTime = DateTime.UtcNow;
        
        return players;
    }
}
