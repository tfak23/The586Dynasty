using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Mobile.CSharp.Models;
using Mobile.CSharp.Services;

namespace Mobile.CSharp.ViewModels;

public partial class BuyInsViewModel : BaseViewModel
{
    private readonly ApiService _apiService;

    [ObservableProperty]
    private ObservableCollection<BuyIn> buyIns = new();

    public BuyInsViewModel(ApiService apiService)
    {
        _apiService = apiService;
        Title = "Buy-Ins";
    }

    [RelayCommand]
    private async Task LoadBuyInsAsync(Guid leagueId)
    {
        if (IsBusy) return;

        try
        {
            IsBusy = true;
            ClearError();

            var response = await _apiService.GetBuyInsAsync(leagueId);
            
            if (response.Success && response.Data != null)
            {
                BuyIns.Clear();
                foreach (var buyIn in response.Data)
                {
                    BuyIns.Add(buyIn);
                }
            }
            else
            {
                SetError(response.Message ?? "Failed to load buy-ins");
            }
        }
        catch (Exception ex)
        {
            SetError($"Error loading buy-ins: {ex.Message}");
        }
        finally
        {
            IsBusy = false;
        }
    }
}
