# 🚀 Quick Start Guide - .NET MAUI Mobile App

This guide will help you get the .NET MAUI app running quickly.

## Prerequisites Check

Before starting, verify you have:

```bash
# Check .NET SDK version (need 8.0+)
dotnet --version

# List installed workloads
dotnet workload list
```

## Installation Steps

### 1️⃣ Install .NET MAUI Workload

```bash
# Install MAUI workload
dotnet workload install maui

# Verify installation
dotnet workload list
# Should show: maui, maui-android, maui-ios, etc.
```

### 2️⃣ Navigate to Project

```bash
cd mobile-csharp
```

### 3️⃣ Restore Dependencies

```bash
dotnet restore
```

### 4️⃣ Build Project

```bash
# Build for all platforms
dotnet build

# Or build for specific platform
dotnet build -f net8.0-android
dotnet build -f net8.0-ios
dotnet build -f net8.0-maccatalyst
```

## Running the App

### 🤖 Android

```bash
# Run on Android emulator
dotnet build -t:Run -f net8.0-android

# Or use Visual Studio:
# 1. Open Mobile.CSharp.csproj
# 2. Select Android emulator
# 3. Press F5
```

**Android Emulator Setup:**
- Open Android Studio → Virtual Device Manager
- Create a new device (Pixel 5, Android 13+)
- Start the emulator

### 🍎 iOS (macOS only)

```bash
# Run on iOS simulator
dotnet build -t:Run -f net8.0-ios

# Or use Visual Studio for Mac:
# 1. Open Mobile.CSharp.csproj
# 2. Select iOS simulator
# 3. Press F5
```

### 💻 Mac Catalyst (macOS only)

```bash
dotnet build -t:Run -f net8.0-maccatalyst
```

### 🪟 Windows

1. Open Mobile.CSharp.csproj in Visual Studio 2022
2. Select "Windows Machine" as target
3. Press F5

## Configuration

### Update API URL

Edit `MauiProgram.cs`, line ~20:

```csharp
builder.Services.AddHttpClient("ApiClient", client =>
{
    // Update this to your backend URL
    client.BaseAddress = new Uri("https://your-backend-url.com/");
    client.Timeout = TimeSpan.FromSeconds(30);
});
```

### Test API Connection

The app will try to connect to the API when loading data. If you see connection errors:

1. Check the API URL is correct
2. Verify the backend is running
3. Check CORS settings on backend
4. For Android emulator, use `10.0.2.2` for localhost
5. For iOS simulator, use `localhost`

## Common Issues

### ❌ "Workload 'maui' not found"

**Solution:**
```bash
dotnet workload install maui
```

### ❌ "Unable to find package Microsoft.Maui.Controls"

**Solution:**
```bash
dotnet restore --force
dotnet nuget locals all --clear
dotnet restore
```

### ❌ Android Emulator not detected

**Solution:**
1. Install Android Studio
2. Install Android SDK through Android Studio
3. Create and start an emulator
4. Run `adb devices` to verify

### ❌ iOS build fails with "Xcode not found"

**Solution (macOS only):**
1. Install Xcode from Mac App Store
2. Run: `sudo xcode-select --switch /Applications/Xcode.app`
3. Run: `xcodebuild -license accept`

### ❌ "No internet connection" alerts

**Solution:**
- Update API base URL in `MauiProgram.cs`
- Check network connectivity
- For emulators, check network settings

## Development Tips

### Hot Reload

MAUI supports XAML hot reload:
1. Run the app in debug mode
2. Make changes to XAML files
3. Save the file
4. Changes appear instantly (no rebuild needed)

### Debug Output

View debug logs:
- **Visual Studio**: View → Output → Show output from: Debug
- **VS Code**: Terminal window

### Data Binding Debugging

Add to XAML page root:
```xml
xmlns:d="http://schemas.microsoft.com/dotnet/2021/maui/design"
d:DataContext="{d:DesignInstance vm:YourViewModel}"
```

## Testing Checklist

- [ ] App builds successfully
- [ ] App launches on emulator/simulator
- [ ] Navigation works (tabs and flyout)
- [ ] Can navigate to all pages
- [ ] API connection configured
- [ ] Data loads from API (if backend running)
- [ ] Pull-to-refresh works
- [ ] Error messages display correctly

## Next Steps

Once the app is running:

1. **Connect to Backend**
   - Ensure backend C# API is running
   - Update API URL in MauiProgram.cs
   - Test API calls

2. **Add Authentication**
   - Implement login flow
   - Store auth tokens
   - Add protected routes

3. **Implement Features**
   - Complete commissioner tools
   - Add trade proposal UI
   - Implement detail views

4. **Test on Physical Devices**
   - Enable developer mode on device
   - Deploy to test real-world performance

## Visual Studio Setup

### Recommended Extensions
- .NET MAUI Extension (built-in)
- C# Dev Kit
- XAML Styler

### Useful Settings
```json
{
  "maui.hotReload.enabled": true,
  "maui.debugging.showDebugOutput": true
}
```

## Project Structure Overview

```
mobile-csharp/
├── Models/              # Data models
├── ViewModels/          # MVVM ViewModels
├── Views/               # XAML pages
├── Services/            # API and business logic
├── Resources/           # Images, fonts, styles
└── Platforms/           # Platform-specific code
```

## Key Files

- **Mobile.CSharp.csproj** - Project configuration
- **MauiProgram.cs** - App startup and DI
- **AppShell.xaml** - Navigation structure
- **App.xaml** - App resources and theme
- **README-MAUI.md** - Full documentation

## Quick Commands Reference

```bash
# Restore packages
dotnet restore

# Clean build
dotnet clean && dotnet build

# Run Android
dotnet build -t:Run -f net8.0-android

# Run iOS
dotnet build -t:Run -f net8.0-ios

# List available targets
dotnet build /t:targets

# Check MAUI installation
dotnet workload list
```

## Help & Resources

- **Documentation**: See README-MAUI.md for complete guide
- **Migration Info**: See MIGRATION-SUMMARY.md for migration details
- **Official Docs**: https://learn.microsoft.com/dotnet/maui/
- **Sample Apps**: https://github.com/dotnet/maui-samples

## 🎉 Success!

If you can run the app and navigate between pages, you're all set!

The app is ready for feature development. Start by:
1. Reviewing ViewModels in `ViewModels/`
2. Updating Views in `Views/`
3. Extending ApiService in `Services/`
4. Adding new Models in `Models/`

Happy coding! 🚀
