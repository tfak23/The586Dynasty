using System.Net.Http.Json;
using System.Text.Json;
using Mobile.CSharp.Models;

namespace Mobile.CSharp.Services;

public class ApiService
{
    private readonly HttpClient _httpClient;
    private readonly IConnectivity _connectivity;
    private readonly JsonSerializerOptions _jsonOptions;

    public ApiService(IHttpClientFactory httpClientFactory, IConnectivity connectivity)
    {
        _httpClient = httpClientFactory.CreateClient("ApiClient");
        _connectivity = connectivity;
        
        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };
    }

    private async Task<bool> CheckConnectivity()
    {
        if (_connectivity.NetworkAccess != NetworkAccess.Internet)
        {
            await Shell.Current.DisplayAlert("No Internet", "Please check your internet connection.", "OK");
            return false;
        }
        return true;
    }

    // League endpoints
    public async Task<ApiResponse<League>> GetLeagueAsync(Guid leagueId)
    {
        if (!await CheckConnectivity()) 
            return new ApiResponse<League> { Success = false, Message = "No internet connection" };

        try
        {
            var response = await _httpClient.GetFromJsonAsync<League>($"api/leagues/{leagueId}", _jsonOptions);
            return new ApiResponse<League> { Success = true, Data = response };
        }
        catch (Exception ex)
        {
            return new ApiResponse<League> { Success = false, Message = ex.Message };
        }
    }

    public async Task<ApiResponse<List<League>>> GetLeaguesAsync()
    {
        if (!await CheckConnectivity())
            return new ApiResponse<List<League>> { Success = false, Message = "No internet connection" };

        try
        {
            var response = await _httpClient.GetFromJsonAsync<List<League>>("api/leagues", _jsonOptions);
            return new ApiResponse<List<League>> { Success = true, Data = response };
        }
        catch (Exception ex)
        {
            return new ApiResponse<List<League>> { Success = false, Message = ex.Message };
        }
    }

    // Team endpoints
    public async Task<ApiResponse<List<Team>>> GetTeamsAsync(Guid leagueId)
    {
        if (!await CheckConnectivity())
            return new ApiResponse<List<Team>> { Success = false, Message = "No internet connection" };

        try
        {
            var response = await _httpClient.GetFromJsonAsync<List<Team>>($"api/leagues/{leagueId}/teams", _jsonOptions);
            return new ApiResponse<List<Team>> { Success = true, Data = response };
        }
        catch (Exception ex)
        {
            return new ApiResponse<List<Team>> { Success = false, Message = ex.Message };
        }
    }

    public async Task<ApiResponse<Team>> GetTeamAsync(Guid teamId)
    {
        if (!await CheckConnectivity())
            return new ApiResponse<Team> { Success = false, Message = "No internet connection" };

        try
        {
            var response = await _httpClient.GetFromJsonAsync<Team>($"api/teams/{teamId}", _jsonOptions);
            return new ApiResponse<Team> { Success = true, Data = response };
        }
        catch (Exception ex)
        {
            return new ApiResponse<Team> { Success = false, Message = ex.Message };
        }
    }

    // Contract endpoints
    public async Task<ApiResponse<List<Contract>>> GetContractsAsync(Guid leagueId, Guid? teamId = null)
    {
        if (!await CheckConnectivity())
            return new ApiResponse<List<Contract>> { Success = false, Message = "No internet connection" };

        try
        {
            var url = teamId.HasValue 
                ? $"api/leagues/{leagueId}/contracts?teamId={teamId}" 
                : $"api/leagues/{leagueId}/contracts";
            
            var response = await _httpClient.GetFromJsonAsync<List<Contract>>(url, _jsonOptions);
            return new ApiResponse<List<Contract>> { Success = true, Data = response };
        }
        catch (Exception ex)
        {
            return new ApiResponse<List<Contract>> { Success = false, Message = ex.Message };
        }
    }

    public async Task<ApiResponse<Contract>> CreateContractAsync(Guid leagueId, Contract contract)
    {
        if (!await CheckConnectivity())
            return new ApiResponse<Contract> { Success = false, Message = "No internet connection" };

        try
        {
            var response = await _httpClient.PostAsJsonAsync($"api/leagues/{leagueId}/contracts", contract, _jsonOptions);
            response.EnsureSuccessStatusCode();
            
            var result = await response.Content.ReadFromJsonAsync<Contract>(_jsonOptions);
            return new ApiResponse<Contract> { Success = true, Data = result };
        }
        catch (Exception ex)
        {
            return new ApiResponse<Contract> { Success = false, Message = ex.Message };
        }
    }

    // Player endpoints
    public async Task<ApiResponse<List<Player>>> GetPlayersAsync()
    {
        if (!await CheckConnectivity())
            return new ApiResponse<List<Player>> { Success = false, Message = "No internet connection" };

        try
        {
            var response = await _httpClient.GetFromJsonAsync<List<Player>>("api/players", _jsonOptions);
            return new ApiResponse<List<Player>> { Success = true, Data = response };
        }
        catch (Exception ex)
        {
            return new ApiResponse<List<Player>> { Success = false, Message = ex.Message };
        }
    }

    public async Task<ApiResponse<Player>> SearchPlayerAsync(string searchTerm)
    {
        if (!await CheckConnectivity())
            return new ApiResponse<Player> { Success = false, Message = "No internet connection" };

        try
        {
            var response = await _httpClient.GetFromJsonAsync<Player>($"api/players/search?q={Uri.EscapeDataString(searchTerm)}", _jsonOptions);
            return new ApiResponse<Player> { Success = true, Data = response };
        }
        catch (Exception ex)
        {
            return new ApiResponse<Player> { Success = false, Message = ex.Message };
        }
    }

    // Trade endpoints
    public async Task<ApiResponse<List<Trade>>> GetTradesAsync(Guid leagueId)
    {
        if (!await CheckConnectivity())
            return new ApiResponse<List<Trade>> { Success = false, Message = "No internet connection" };

        try
        {
            var response = await _httpClient.GetFromJsonAsync<List<Trade>>($"api/leagues/{leagueId}/trades", _jsonOptions);
            return new ApiResponse<List<Trade>> { Success = true, Data = response };
        }
        catch (Exception ex)
        {
            return new ApiResponse<List<Trade>> { Success = false, Message = ex.Message };
        }
    }

    public async Task<ApiResponse<Trade>> CreateTradeAsync(Guid leagueId, Trade trade)
    {
        if (!await CheckConnectivity())
            return new ApiResponse<Trade> { Success = false, Message = "No internet connection" };

        try
        {
            var response = await _httpClient.PostAsJsonAsync($"api/leagues/{leagueId}/trades", trade, _jsonOptions);
            response.EnsureSuccessStatusCode();
            
            var result = await response.Content.ReadFromJsonAsync<Trade>(_jsonOptions);
            return new ApiResponse<Trade> { Success = true, Data = result };
        }
        catch (Exception ex)
        {
            return new ApiResponse<Trade> { Success = false, Message = ex.Message };
        }
    }

    // Buy-Ins endpoints
    public async Task<ApiResponse<List<BuyIn>>> GetBuyInsAsync(Guid leagueId)
    {
        if (!await CheckConnectivity())
            return new ApiResponse<List<BuyIn>> { Success = false, Message = "No internet connection" };

        try
        {
            var response = await _httpClient.GetFromJsonAsync<List<BuyIn>>($"api/leagues/{leagueId}/buyins", _jsonOptions);
            return new ApiResponse<List<BuyIn>> { Success = true, Data = response };
        }
        catch (Exception ex)
        {
            return new ApiResponse<List<BuyIn>> { Success = false, Message = ex.Message };
        }
    }

    // Rules endpoints
    public async Task<ApiResponse<List<Rule>>> GetRulesAsync()
    {
        if (!await CheckConnectivity())
            return new ApiResponse<List<Rule>> { Success = false, Message = "No internet connection" };

        try
        {
            var response = await _httpClient.GetFromJsonAsync<List<Rule>>("api/rules", _jsonOptions);
            return new ApiResponse<List<Rule>> { Success = true, Data = response };
        }
        catch (Exception ex)
        {
            return new ApiResponse<List<Rule>> { Success = false, Message = ex.Message };
        }
    }
}
