# The 586 Dynasty - .NET MAUI Mobile App

This is a manually-created .NET MAUI 8.0 project for migrating the React Native/Expo mobile app to C#. The project structure has been created to be ready for compilation once the MAUI workload is properly installed.

## 📁 Project Structure

```
mobile-csharp/
├── Mobile.CSharp.csproj          # Main project file
├── MauiProgram.cs                # App initialization and DI configuration
├── App.xaml / App.xaml.cs        # Application entry point
├── AppShell.xaml / AppShell.xaml.cs  # Shell-based navigation
├── MainPage.xaml / MainPage.xaml.cs  # Main/Home page
│
├── Models/                        # Data models
│   ├── League.cs
│   ├── Team.cs
│   ├── Player.cs
│   ├── Contract.cs
│   ├── Trade.cs
│   └── AdditionalModels.cs
│
├── ViewModels/                    # MVVM ViewModels
│   ├── BaseViewModel.cs
│   ├── LeagueHistoryViewModel.cs
│   ├── RulesViewModel.cs
│   ├── BuyInsViewModel.cs
│   ├── TeamViewModel.cs
│   ├── ContractViewModel.cs
│   ├── FreeAgentViewModel.cs
│   ├── TradeViewModel.cs
│   └── CommissionerViewModel.cs
│
├── Views/                         # XAML UI pages
│   ├── LeagueHistoryPage.xaml / .cs
│   ├── RulesPage.xaml / .cs
│   ├── BuyInsPage.xaml / .cs
│   ├── TeamPage.xaml / .cs
│   ├── ContractPage.xaml / .cs
│   ├── FreeAgentPage.xaml / .cs
│   ├── TradePage.xaml / .cs
│   └── CommissionerPage.xaml / .cs
│
├── Services/                      # Business logic and API services
│   └── ApiService.cs
│
├── Resources/                     # App resources
│   ├── Fonts/                    # Custom fonts
│   ├── Images/                   # Images and icons
│   ├── Styles/                   # XAML styles
│   │   ├── Colors.xaml
│   │   └── Styles.xaml
│   └── Raw/                      # Raw assets
│
└── Platforms/                     # Platform-specific code
    ├── Android/
    │   ├── MainActivity.cs
    │   ├── MainApplication.cs
    │   └── AndroidManifest.xml
    ├── iOS/
    │   ├── AppDelegate.cs
    │   ├── Program.cs
    │   └── Info.plist
    ├── MacCatalyst/
    │   ├── AppDelegate.cs
    │   ├── Program.cs
    │   └── Info.plist
    └── Windows/
        ├── App.xaml / .cs
        └── Package.appxmanifest
```

## 🏗️ Architecture: MVVM Pattern

This app follows the **Model-View-ViewModel (MVVM)** pattern:

### **Model**
- Plain C# classes representing data structures
- Located in `Models/` folder
- Match the backend API data structures
- Use JSON serialization attributes for API communication

### **View**
- XAML files defining the UI
- Located in `Views/` folder
- Data-bound to ViewModels using `{Binding}` syntax
- No business logic in code-behind files

### **ViewModel**
- Located in `ViewModels/` folder
- Inherit from `BaseViewModel` which implements `ObservableObject`
- Use `CommunityToolkit.Mvvm` for:
  - `[ObservableProperty]` - Auto-generates properties with change notification
  - `[RelayCommand]` - Auto-generates ICommand implementations
- Handle UI logic and data transformation
- Communicate with Services for data operations

### **Service Layer**
- `ApiService.cs` - Centralized HTTP client for backend API calls
- Injected via Dependency Injection
- Returns `ApiResponse<T>` wrapper for consistent error handling

## 🧭 Navigation

The app uses **Shell-based navigation**, which provides:
- Tab bar navigation for main sections
- Flyout menu for additional pages
- URI-based routing
- Automatic back button handling

### Navigation Structure
```
AppShell (Shell)
├── TabBar
│   ├── Home (MainPage)
│   ├── League History
│   ├── Teams
│   └── Trades
│
└── FlyoutMenu
    ├── League Info
    │   ├── League History
    │   ├── Rules
    │   └── Buy-Ins
    ├── Team Management
    │   ├── My Team
    │   ├── Contracts
    │   └── Free Agents
    └── Commissioner
        └── Commissioner Tools
```

### Programmatic Navigation
```csharp
// Navigate to a route
await Shell.Current.GoToAsync("//leaguehistory");

// Navigate with parameters
await Shell.Current.GoToAsync($"team?id={teamId}");

// Go back
await Shell.Current.GoToAsync("..");
```

## 🔌 Dependency Injection

Services and ViewModels are registered in `MauiProgram.cs`:

```csharp
// Services
builder.Services.AddSingleton<ApiService>();
builder.Services.AddSingleton<IConnectivity>(Connectivity.Current);
builder.Services.AddSingleton<IPreferences>(Preferences.Default);

// ViewModels
builder.Services.AddTransient<LeagueHistoryViewModel>();
builder.Services.AddTransient<TeamViewModel>();
// ... etc

// Views
builder.Services.AddTransient<LeagueHistoryPage>();
builder.Services.AddTransient<TeamPage>();
// ... etc
```

Constructor injection is used throughout:
```csharp
public class TeamViewModel : BaseViewModel
{
    private readonly ApiService _apiService;

    public TeamViewModel(ApiService apiService)
    {
        _apiService = apiService;
    }
}
```

## 🌐 API Integration

### ApiService
The `ApiService` class provides methods for all backend endpoints:

```csharp
// Example usage in ViewModel
var response = await _apiService.GetTeamsAsync(leagueId);
if (response.Success && response.Data != null)
{
    // Handle success
    Teams.Clear();
    foreach (var team in response.Data)
    {
        Teams.Add(team);
    }
}
else
{
    // Handle error
    SetError(response.Message ?? "Failed to load teams");
}
```

### API Configuration
Update the base URL in `MauiProgram.cs`:
```csharp
builder.Services.AddHttpClient("ApiClient", client =>
{
    client.BaseAddress = new Uri("https://api.the586dynasty.com/");
    client.Timeout = TimeSpan.FromSeconds(30);
});
```

## 📦 NuGet Packages

The project includes these key packages:

- **Microsoft.Maui.Controls** (8.0.3) - Core MAUI framework
- **CommunityToolkit.Mvvm** (8.2.2) - MVVM helpers
- **CommunityToolkit.Maui** (7.0.1) - Additional MAUI controls
- **Microsoft.Extensions.Http** (8.0.0) - HttpClient factory
- **System.Text.Json** (8.0.3) - JSON serialization

## 🚀 How to Build and Run

### Prerequisites
1. **Visual Studio 2022 (17.8 or later)** with:
   - .NET MAUI workload installed
   - Android SDK (for Android development)
   - Xcode (for iOS/Mac development, macOS only)

2. **.NET 8 SDK** installed

### Installing .NET MAUI Workload
```bash
# Check if MAUI is installed
dotnet workload list

# Install MAUI workload
dotnet workload install maui

# Verify installation
dotnet workload list
```

### Building the Project
```bash
# Navigate to project directory
cd mobile-csharp

# Restore NuGet packages
dotnet restore

# Build for specific platform
dotnet build -t:Run -f net8.0-android
dotnet build -t:Run -f net8.0-ios
dotnet build -t:Run -f net8.0-maccatalyst
dotnet build -t:Run -f net8.0-windows10.0.19041.0
```

### Running on Emulator/Simulator
```bash
# Android
dotnet build -t:Run -f net8.0-android

# iOS Simulator (macOS only)
dotnet build -t:Run -f net8.0-ios

# Mac Catalyst (macOS only)
dotnet build -t:Run -f net8.0-maccatalyst
```

### Running on Physical Device
1. Enable Developer Mode on device
2. Connect device via USB
3. Select device in Visual Studio
4. Press F5 to debug

## 🎨 Styling and Theming

Styles are defined in `Resources/Styles/`:
- **Colors.xaml** - Color palette
- **Styles.xaml** - Default styles for controls

### Using Styles
```xml
<!-- Apply color -->
<Label TextColor="{StaticResource Primary}" />

<!-- Styles are applied automatically to all controls -->
<Button Text="Click Me" />
```

## 📱 Platform-Specific Code

### Android
- **MainActivity.cs** - Main Android activity
- **MainApplication.cs** - Application class
- **AndroidManifest.xml** - Permissions and configuration

### iOS
- **AppDelegate.cs** - iOS app delegate
- **Info.plist** - iOS configuration
- Target iOS 11.0+

### Mac Catalyst
- Similar to iOS but for macOS
- Target macOS 13.1+

### Windows
- **App.xaml** - Windows-specific app initialization
- Target Windows 10, version 1809+

## 🔧 Configuration

### App Settings
Use `IPreferences` for storing user preferences:
```csharp
// Save
Preferences.Set("league_id", leagueId.ToString());

// Retrieve
var leagueId = Preferences.Get("league_id", string.Empty);
```

### Connectivity Check
The `ApiService` automatically checks connectivity:
```csharp
private async Task<bool> CheckConnectivity()
{
    if (_connectivity.NetworkAccess != NetworkAccess.Internet)
    {
        await Shell.Current.DisplayAlert("No Internet", 
            "Please check your internet connection.", "OK");
        return false;
    }
    return true;
}
```

## 🔍 Debugging

### Enable Debug Logging
In `MauiProgram.cs`:
```csharp
#if DEBUG
    builder.Logging.AddDebug();
#endif
```

### View Debug Output
- **Visual Studio**: Debug → Windows → Output
- **VS Code**: Terminal output when debugging

## 📝 Common Tasks

### Adding a New Page
1. Create ViewModel in `ViewModels/`
2. Create XAML page in `Views/`
3. Register both in `MauiProgram.cs`
4. Add route in `AppShell.xaml.cs`

### Adding a New API Endpoint
1. Add method to `ApiService.cs`
2. Call from ViewModel
3. Update Model if needed

### Updating Models
Models should match backend DTOs. Update as backend changes.

## 🚧 Known Limitations

1. **No MAUI Workload** - Project won't compile until MAUI workload is installed
2. **Missing Assets** - App icons, splash screens, and images need to be added
3. **State Management** - League/Team selection state needs persistent storage
4. **Authentication** - No auth implementation yet
5. **Offline Support** - No caching or offline mode
6. **Push Notifications** - Not implemented

## 📋 Next Steps

### Immediate Tasks
1. Install .NET MAUI workload
2. Add app icons and splash screens
3. Test build on all platforms
4. Configure backend API URL

### Feature Implementation
1. Add user authentication
2. Implement state management (current league/team)
3. Add offline caching
4. Implement push notifications
5. Add pull-to-refresh on all list views
6. Implement detailed views for teams/players/contracts
7. Add trade proposal creation UI
8. Implement commissioner tools

### UI/UX Enhancements
1. Add loading indicators
2. Implement error boundaries
3. Add empty state illustrations
4. Improve navigation UX
5. Add animations and transitions
6. Implement dark mode
7. Add accessibility features

## 🔗 Related Resources

- [.NET MAUI Documentation](https://learn.microsoft.com/dotnet/maui/)
- [MVVM Toolkit Documentation](https://learn.microsoft.com/dotnet/communitytoolkit/mvvm/)
- [MAUI Community Toolkit](https://learn.microsoft.com/dotnet/communitytoolkit/maui/)

## 📄 License

Same license as the main project.
