using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Mobile.CSharp.Models;
using Mobile.CSharp.Services;

namespace Mobile.CSharp.ViewModels;

public partial class RulesViewModel : BaseViewModel
{
    private readonly ApiService _apiService;

    [ObservableProperty]
    private ObservableCollection<Rule> rules = new();

    public RulesViewModel(ApiService apiService)
    {
        _apiService = apiService;
        Title = "League Rules";
    }

    [RelayCommand]
    private async Task LoadRulesAsync()
    {
        if (IsBusy) return;

        try
        {
            IsBusy = true;
            ClearError();

            var response = await _apiService.GetRulesAsync();
            
            if (response.Success && response.Data != null)
            {
                Rules.Clear();
                foreach (var rule in response.Data)
                {
                    Rules.Add(rule);
                }
            }
            else
            {
                SetError(response.Message ?? "Failed to load rules");
            }
        }
        catch (Exception ex)
        {
            SetError($"Error loading rules: {ex.Message}");
        }
        finally
        {
            IsBusy = false;
        }
    }
}
