using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Mobile.CSharp.Models;
using Mobile.CSharp.Services;

namespace Mobile.CSharp.ViewModels;

public partial class TradeViewModel : BaseViewModel
{
    private readonly ApiService _apiService;

    [ObservableProperty]
    private ObservableCollection<Trade> trades = new();

    [ObservableProperty]
    private Trade? selectedTrade;

    public TradeViewModel(ApiService apiService)
    {
        _apiService = apiService;
        Title = "Trades";
    }

    [RelayCommand]
    private async Task LoadTradesAsync(Guid leagueId)
    {
        if (IsBusy) return;

        try
        {
            IsBusy = true;
            ClearError();

            var response = await _apiService.GetTradesAsync(leagueId);
            
            if (response.Success && response.Data != null)
            {
                Trades.Clear();
                foreach (var trade in response.Data)
                {
                    Trades.Add(trade);
                }
            }
            else
            {
                SetError(response.Message ?? "Failed to load trades");
            }
        }
        catch (Exception ex)
        {
            SetError($"Error loading trades: {ex.Message}");
        }
        finally
        {
            IsBusy = false;
        }
    }
}
