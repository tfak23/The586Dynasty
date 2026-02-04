using Mobile.CSharp.ViewModels;

namespace Mobile.CSharp.Views;

public partial class CommissionerPage : ContentPage
{
    private readonly CommissionerViewModel _viewModel;

    public CommissionerPage(CommissionerViewModel viewModel)
    {
        InitializeComponent();
        _viewModel = viewModel;
        BindingContext = _viewModel;
    }
}
