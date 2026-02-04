using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace Mobile.CSharp.ViewModels;

public partial class CommissionerViewModel : BaseViewModel
{
    [ObservableProperty]
    private bool isCommissioner = false;

    public CommissionerViewModel()
    {
        Title = "Commissioner Tools";
    }

    [RelayCommand]
    private async Task NavigateToRosterManagementAsync()
    {
        await Shell.Current.DisplayAlert("Coming Soon", "Roster management feature coming soon", "OK");
    }

    [RelayCommand]
    private async Task NavigateToCapManagementAsync()
    {
        await Shell.Current.DisplayAlert("Coming Soon", "Cap management feature coming soon", "OK");
    }

    [RelayCommand]
    private async Task NavigateToTradeManagementAsync()
    {
        await Shell.Current.DisplayAlert("Coming Soon", "Trade management feature coming soon", "OK");
    }
}
