using Mobile.CSharp.ViewModels;

namespace Mobile.CSharp.Views;

public partial class TradePage : ContentPage
{
    private readonly TradeViewModel _viewModel;

    public TradePage(TradeViewModel viewModel)
    {
        InitializeComponent();
        _viewModel = viewModel;
        BindingContext = _viewModel;
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        // TODO: Get actual league ID from app state/preferences
        var leagueId = Guid.Empty; // Replace with actual league ID
        if (leagueId != Guid.Empty)
        {
            await _viewModel.LoadTradesCommand.ExecuteAsync(leagueId);
        }
    }
}
