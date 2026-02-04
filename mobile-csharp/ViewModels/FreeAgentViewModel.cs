using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Mobile.CSharp.Models;
using Mobile.CSharp.Services;

namespace Mobile.CSharp.ViewModels;

public partial class FreeAgentViewModel : BaseViewModel
{
    private readonly ApiService _apiService;

    [ObservableProperty]
    private ObservableCollection<Player> freeAgents = new();

    [ObservableProperty]
    private string searchText = string.Empty;

    public FreeAgentViewModel(ApiService apiService)
    {
        _apiService = apiService;
        Title = "Free Agents";
    }

    [RelayCommand]
    private async Task LoadFreeAgentsAsync()
    {
        if (IsBusy) return;

        try
        {
            IsBusy = true;
            ClearError();

            var response = await _apiService.GetPlayersAsync();
            
            if (response.Success && response.Data != null)
            {
                FreeAgents.Clear();
                foreach (var player in response.Data)
                {
                    FreeAgents.Add(player);
                }
            }
            else
            {
                SetError(response.Message ?? "Failed to load free agents");
            }
        }
        catch (Exception ex)
        {
            SetError($"Error loading free agents: {ex.Message}");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task SearchPlayersAsync()
    {
        if (string.IsNullOrWhiteSpace(SearchText)) return;

        if (IsBusy) return;

        try
        {
            IsBusy = true;
            ClearError();

            var response = await _apiService.SearchPlayerAsync(SearchText);
            
            if (response.Success && response.Data != null)
            {
                // Handle search result
            }
            else
            {
                SetError(response.Message ?? "No player found");
            }
        }
        catch (Exception ex)
        {
            SetError($"Error searching players: {ex.Message}");
        }
        finally
        {
            IsBusy = false;
        }
    }
}
