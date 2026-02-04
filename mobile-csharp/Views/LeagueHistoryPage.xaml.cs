using Mobile.CSharp.ViewModels;

namespace Mobile.CSharp.Views;

public partial class LeagueHistoryPage : ContentPage
{
    private readonly LeagueHistoryViewModel _viewModel;

    public LeagueHistoryPage(LeagueHistoryViewModel viewModel)
    {
        InitializeComponent();
        _viewModel = viewModel;
        BindingContext = _viewModel;
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        await _viewModel.LoadLeaguesCommand.ExecuteAsync(null);
    }
}
