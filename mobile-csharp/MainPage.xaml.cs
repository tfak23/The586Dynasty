namespace Mobile.CSharp;

public partial class MainPage : ContentPage
{
    public MainPage()
    {
        InitializeComponent();
    }

    private async void OnLeagueClicked(object sender, EventArgs e)
    {
        await Shell.Current.GoToAsync("//leaguehistory");
    }

    private async void OnTeamClicked(object sender, EventArgs e)
    {
        await Shell.Current.GoToAsync("//team");
    }
}
