using Mobile.CSharp.Views;

namespace Mobile.CSharp;

public partial class AppShell : Shell
{
    public AppShell()
    {
        InitializeComponent();

        // Register routes for navigation
        Routing.RegisterRoute(nameof(LeagueHistoryPage), typeof(LeagueHistoryPage));
        Routing.RegisterRoute(nameof(RulesPage), typeof(RulesPage));
        Routing.RegisterRoute(nameof(BuyInsPage), typeof(BuyInsPage));
        Routing.RegisterRoute(nameof(TeamPage), typeof(TeamPage));
        Routing.RegisterRoute(nameof(ContractPage), typeof(ContractPage));
        Routing.RegisterRoute(nameof(FreeAgentPage), typeof(FreeAgentPage));
        Routing.RegisterRoute(nameof(TradePage), typeof(TradePage));
        Routing.RegisterRoute(nameof(CommissionerPage), typeof(CommissionerPage));
    }
}
