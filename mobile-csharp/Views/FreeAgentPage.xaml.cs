using Mobile.CSharp.ViewModels;

namespace Mobile.CSharp.Views;

public partial class FreeAgentPage : ContentPage
{
    private readonly FreeAgentViewModel _viewModel;

    public FreeAgentPage(FreeAgentViewModel viewModel)
    {
        InitializeComponent();
        _viewModel = viewModel;
        BindingContext = _viewModel;
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        await _viewModel.LoadFreeAgentsCommand.ExecuteAsync(null);
    }
}
