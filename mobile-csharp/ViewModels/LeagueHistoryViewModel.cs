using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Mobile.CSharp.Models;
using Mobile.CSharp.Services;

namespace Mobile.CSharp.ViewModels;

public partial class LeagueHistoryViewModel : BaseViewModel
{
    private readonly ApiService _apiService;

    [ObservableProperty]
    private ObservableCollection<League> leagues = new();

    [ObservableProperty]
    private League? selectedLeague;

    public LeagueHistoryViewModel(ApiService apiService)
    {
        _apiService = apiService;
        Title = "League History";
    }

    [RelayCommand]
    private async Task LoadLeaguesAsync()
    {
        if (IsBusy) return;

        try
        {
            IsBusy = true;
            ClearError();

            var response = await _apiService.GetLeaguesAsync();
            
            if (response.Success && response.Data != null)
            {
                Leagues.Clear();
                foreach (var league in response.Data)
                {
                    Leagues.Add(league);
                }
            }
            else
            {
                SetError(response.Message ?? "Failed to load leagues");
            }
        }
        catch (Exception ex)
        {
            SetError($"Error loading leagues: {ex.Message}");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task SelectLeagueAsync(League league)
    {
        if (league == null) return;

        SelectedLeague = league;
        
        // Navigate to league details or perform other actions
        await Shell.Current.DisplayAlert("League Selected", $"You selected: {league.Name}", "OK");
    }
}
