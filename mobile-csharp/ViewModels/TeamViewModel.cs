using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Mobile.CSharp.Models;
using Mobile.CSharp.Services;

namespace Mobile.CSharp.ViewModels;

public partial class TeamViewModel : BaseViewModel
{
    private readonly ApiService _apiService;

    [ObservableProperty]
    private ObservableCollection<Team> teams = new();

    [ObservableProperty]
    private Team? selectedTeam;

    [ObservableProperty]
    private ObservableCollection<Contract> teamContracts = new();

    [ObservableProperty]
    private decimal totalSalary;

    [ObservableProperty]
    private decimal remainingCap;

    public TeamViewModel(ApiService apiService)
    {
        _apiService = apiService;
        Title = "My Team";
    }

    [RelayCommand]
    private async Task LoadTeamsAsync(Guid leagueId)
    {
        if (IsBusy) return;

        try
        {
            IsBusy = true;
            ClearError();

            var response = await _apiService.GetTeamsAsync(leagueId);
            
            if (response.Success && response.Data != null)
            {
                Teams.Clear();
                foreach (var team in response.Data)
                {
                    Teams.Add(team);
                }
            }
            else
            {
                SetError(response.Message ?? "Failed to load teams");
            }
        }
        catch (Exception ex)
        {
            SetError($"Error loading teams: {ex.Message}");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task LoadTeamContractsAsync(Guid leagueId, Guid teamId)
    {
        if (IsBusy) return;

        try
        {
            IsBusy = true;
            ClearError();

            var response = await _apiService.GetContractsAsync(leagueId, teamId);
            
            if (response.Success && response.Data != null)
            {
                TeamContracts.Clear();
                foreach (var contract in response.Data)
                {
                    TeamContracts.Add(contract);
                }

                CalculateSalaryCap();
            }
            else
            {
                SetError(response.Message ?? "Failed to load contracts");
            }
        }
        catch (Exception ex)
        {
            SetError($"Error loading contracts: {ex.Message}");
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void CalculateSalaryCap()
    {
        TotalSalary = TeamContracts.Sum(c => c.Salary);
        RemainingCap = 500.00m - TotalSalary; // Default salary cap
    }
}
