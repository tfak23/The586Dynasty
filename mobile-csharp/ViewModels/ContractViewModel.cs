using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Mobile.CSharp.Models;
using Mobile.CSharp.Services;

namespace Mobile.CSharp.ViewModels;

public partial class ContractViewModel : BaseViewModel
{
    private readonly ApiService _apiService;

    [ObservableProperty]
    private ObservableCollection<Contract> contracts = new();

    [ObservableProperty]
    private Contract? selectedContract;

    public ContractViewModel(ApiService apiService)
    {
        _apiService = apiService;
        Title = "Contracts";
    }

    [RelayCommand]
    private async Task LoadContractsAsync(Guid leagueId)
    {
        if (IsBusy) return;

        try
        {
            IsBusy = true;
            ClearError();

            var response = await _apiService.GetContractsAsync(leagueId);
            
            if (response.Success && response.Data != null)
            {
                Contracts.Clear();
                foreach (var contract in response.Data)
                {
                    Contracts.Add(contract);
                }
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
}
