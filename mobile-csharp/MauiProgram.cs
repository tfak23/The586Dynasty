using Microsoft.Extensions.Logging;
using Mobile.CSharp.Services;
using Mobile.CSharp.ViewModels;
using Mobile.CSharp.Views;
using CommunityToolkit.Maui;

namespace Mobile.CSharp;

public static class MauiProgram
{
    public static MauiApp CreateMauiApp()
    {
        var builder = MauiApp.CreateBuilder();
        builder
            .UseMauiApp<App>()
            .UseMauiCommunityToolkit()
            .ConfigureFonts(fonts =>
            {
                fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
                fonts.AddFont("OpenSans-Semibold.ttf", "OpenSansSemibold");
            });

        // Register HttpClient with base address
        builder.Services.AddHttpClient("ApiClient", client =>
        {
            // Configure base address - update this to your backend URL
            client.BaseAddress = new Uri("https://api.the586dynasty.com/");
            client.Timeout = TimeSpan.FromSeconds(30);
        });

        // Register Services
        builder.Services.AddSingleton<ApiService>();
        builder.Services.AddSingleton<IConnectivity>(Connectivity.Current);
        builder.Services.AddSingleton<IPreferences>(Preferences.Default);

        // Register ViewModels
        builder.Services.AddTransient<LeagueHistoryViewModel>();
        builder.Services.AddTransient<RulesViewModel>();
        builder.Services.AddTransient<BuyInsViewModel>();
        builder.Services.AddTransient<TeamViewModel>();
        builder.Services.AddTransient<ContractViewModel>();
        builder.Services.AddTransient<FreeAgentViewModel>();
        builder.Services.AddTransient<TradeViewModel>();
        builder.Services.AddTransient<CommissionerViewModel>();

        // Register Views
        builder.Services.AddTransient<LeagueHistoryPage>();
        builder.Services.AddTransient<RulesPage>();
        builder.Services.AddTransient<BuyInsPage>();
        builder.Services.AddTransient<TeamPage>();
        builder.Services.AddTransient<ContractPage>();
        builder.Services.AddTransient<FreeAgentPage>();
        builder.Services.AddTransient<TradePage>();
        builder.Services.AddTransient<CommissionerPage>();

#if DEBUG
        builder.Logging.AddDebug();
#endif

        return builder.Build();
    }
}
