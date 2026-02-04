using Mobile.CSharp.ViewModels;

namespace Mobile.CSharp.Views;

public partial class TeamPage : ContentPage
{
    private readonly TeamViewModel _viewModel;

    public TeamPage(TeamViewModel viewModel)
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
            await _viewModel.LoadTeamsCommand.ExecuteAsync(leagueId);
        }
    }
}
