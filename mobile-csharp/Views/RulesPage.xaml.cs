using Mobile.CSharp.ViewModels;

namespace Mobile.CSharp.Views;

public partial class RulesPage : ContentPage
{
    private readonly RulesViewModel _viewModel;

    public RulesPage(RulesViewModel viewModel)
    {
        InitializeComponent();
        _viewModel = viewModel;
        BindingContext = _viewModel;
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        await _viewModel.LoadRulesCommand.ExecuteAsync(null);
    }
}
