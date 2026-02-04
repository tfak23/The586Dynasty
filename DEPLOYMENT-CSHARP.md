# Deployment Guide - C# Stack

This guide covers deploying the ASP.NET Core backend and .NET MAUI mobile app to production.

---

## 📋 Table of Contents

1. [Backend Deployment (ASP.NET Core)](#backend-deployment)
2. [Frontend Deployment (.NET MAUI)](#frontend-deployment)
3. [Database Setup](#database-setup)
4. [Environment Configuration](#environment-configuration)
5. [Monitoring & Logging](#monitoring--logging)

---

## Backend Deployment

### Prerequisites

- .NET 8.0 SDK or runtime
- PostgreSQL 15+ database
- Docker (optional, but recommended)

### Option 1: Docker Deployment (Recommended)

#### 1. Build Docker Image

```bash
cd backend-csharp
docker build -t the586dynasty-api:latest .
```

#### 2. Run Container Locally

```bash
docker run -d \
  -p 8080:8080 \
  -e DATABASE_URL="Host=your-db-host;Database=the586dynasty;Username=your-user;Password=your-pass" \
  -e ASPNETCORE_ENVIRONMENT=Production \
  -e CURRENT_SEASON=2025 \
  --name the586-api \
  the586dynasty-api:latest
```

#### 3. Deploy to Google Cloud Run

```bash
# Tag for GCR
docker tag the586dynasty-api:latest gcr.io/YOUR-PROJECT-ID/the586dynasty-api

# Push to GCR
docker push gcr.io/YOUR-PROJECT-ID/the586dynasty-api

# Deploy to Cloud Run
gcloud run deploy the586dynasty-api \
  --image gcr.io/YOUR-PROJECT-ID/the586dynasty-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL="your-connection-string" \
  --set-env-vars CURRENT_SEASON=2025 \
  --min-instances 1 \
  --max-instances 10 \
  --memory 512Mi
```

### Option 2: Direct Deployment

#### 1. Publish Release Build

```bash
cd backend-csharp
dotnet publish -c Release -o ./publish
```

#### 2. Deploy to Server

```bash
# Copy to server
scp -r ./publish user@your-server:/var/www/the586dynasty

# On server, run with systemd
sudo systemctl start the586dynasty-api
```

#### 3. Configure as Service (systemd)

Create `/etc/systemd/system/the586dynasty-api.service`:

```ini
[Unit]
Description=The 586 Dynasty API
After=network.target

[Service]
Type=notify
WorkingDirectory=/var/www/the586dynasty
ExecStart=/usr/bin/dotnet /var/www/the586dynasty/Backend.CSharp.dll
Restart=always
RestartSec=10
KillSignal=SIGINT
SyslogIdentifier=the586dynasty-api
User=www-data
Environment=ASPNETCORE_ENVIRONMENT=Production
Environment=ASPNETCORE_URLS=http://0.0.0.0:5000

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable the586dynasty-api
sudo systemctl start the586dynasty-api
sudo systemctl status the586dynasty-api
```

### Option 3: Azure App Service

```bash
# Login to Azure
az login

# Create resource group
az group create --name The586Dynasty --location eastus

# Create App Service plan
az appservice plan create \
  --name the586dynasty-plan \
  --resource-group The586Dynasty \
  --sku B1 \
  --is-linux

# Create web app
az webapp create \
  --resource-group The586Dynasty \
  --plan the586dynasty-plan \
  --name the586dynasty-api \
  --runtime "DOTNET|8.0"

# Deploy
cd backend-csharp
dotnet publish -c Release -o ./publish
cd publish
zip -r ../deploy.zip .
az webapp deployment source config-zip \
  --resource-group The586Dynasty \
  --name the586dynasty-api \
  --src ../deploy.zip
```

---

## Frontend Deployment

### Prerequisites

- .NET 8.0 SDK with MAUI workload
- Xcode 15+ (for iOS)
- Android SDK 34+ (for Android)

### Android Deployment

#### 1. Configure Release Settings

Edit `mobile-csharp/Platforms/Android/AndroidManifest.xml`:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android" 
          package="com.the586dynasty.app"
          android:versionCode="1" 
          android:versionName="1.0.0">
```

#### 2. Create Keystore

```bash
keytool -genkey -v -keystore the586dynasty.keystore \
  -alias the586dynasty -keyalg RSA -keysize 2048 -validity 10000
```

#### 3. Build APK

```bash
cd mobile-csharp
dotnet build -f net8.0-android -c Release
```

#### 4. Build AAB for Google Play

```bash
dotnet publish -f net8.0-android -c Release \
  /p:AndroidPackageFormat=aab \
  /p:AndroidKeyStore=true \
  /p:AndroidSigningKeyStore=the586dynasty.keystore \
  /p:AndroidSigningKeyAlias=the586dynasty \
  /p:AndroidSigningKeyPass=your-password \
  /p:AndroidSigningStorePass=your-password
```

Output: `bin/Release/net8.0-android/publish/com.the586dynasty.app-Signed.aab`

#### 5. Upload to Google Play Console

1. Go to [Google Play Console](https://play.google.com/console)
2. Create new app
3. Upload AAB file
4. Complete store listing
5. Submit for review

### iOS Deployment

#### 1. Configure Bundle ID

Edit `mobile-csharp/Platforms/iOS/Info.plist`:

```xml
<key>CFBundleIdentifier</key>
<string>com.the586dynasty.app</string>
```

#### 2. Configure Signing

Open project in Visual Studio or Rider:
- Select iOS project
- Go to iOS Bundle Signing
- Select your provisioning profile

#### 3. Build Archive

```bash
cd mobile-csharp
dotnet publish -f net8.0-ios -c Release
```

#### 4. Upload to App Store

```bash
# Use Xcode or Transporter app to upload IPA
# Or use altool
xcrun altool --upload-app -f ./bin/Release/net8.0-ios/publish/*.ipa \
  -t ios -u your-apple-id@email.com \
  -p your-app-specific-password
```

### Windows Deployment

#### 1. Build MSIX Package

```bash
cd mobile-csharp
dotnet publish -f net8.0-windows10.0.19041.0 -c Release \
  /p:GenerateAppxPackageOnBuild=true
```

#### 2. Sign Package

```powershell
signtool sign /fd SHA256 /f your-certificate.pfx /p your-password \
  bin/Release/net8.0-windows10.0.19041.0/win10-x64/publish/Mobile.CSharp.msix
```

#### 3. Upload to Microsoft Store

1. Go to [Partner Center](https://partner.microsoft.com/dashboard)
2. Create new app
3. Upload MSIX package
4. Complete store listing
5. Submit for certification

---

## Database Setup

### PostgreSQL Configuration

#### 1. Create Database

```sql
CREATE DATABASE the586dynasty;
```

#### 2. Run Migrations

From the original TypeScript backend:

```bash
cd backend
psql $DATABASE_URL -f src/db/schema.sql
psql $DATABASE_URL -f src/db/migrations/001_initial_schema.sql
# Run all migrations...
```

Or use Entity Framework migrations (future):

```bash
cd backend-csharp
dotnet ef database update
```

#### 3. Seed Initial Data

```bash
cd backend
psql $DATABASE_URL -f src/db/seeds/initial_data.sql
```

### Connection String Format

**Development:**
```
Host=localhost;Port=5432;Database=the586dynasty;Username=postgres;Password=yourpass
```

**Production (Cloud SQL):**
```
Host=/cloudsql/your-project:region:instance;Database=the586dynasty;Username=user;Password=pass
```

---

## Environment Configuration

### Backend Environment Variables

#### Required Variables

```bash
# Database
DATABASE_URL="Host=your-host;Database=the586dynasty;Username=user;Password=pass"

# Environment
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://0.0.0.0:8080

# Application
CURRENT_SEASON=2025
```

#### Optional Variables

```bash
# Logging
Logging__LogLevel__Default=Information
Logging__LogLevel__Microsoft.AspNetCore=Warning

# CORS (if needed)
AllowedOrigins__0=https://your-domain.com

# Hangfire (if using)
Hangfire__DashboardEnabled=true
Hangfire__DashboardUsername=admin
Hangfire__DashboardPassword=your-secure-password
```

### Frontend Configuration

Update `mobile-csharp/appsettings.json` or `MauiProgram.cs`:

```csharp
builder.Services.AddScoped<ApiService>(sp => 
    new ApiService("https://your-api-domain.com"));
```

Or use environment-specific configs:

```csharp
#if DEBUG
    var apiUrl = "http://localhost:5000";
#else
    var apiUrl = "https://api.the586dynasty.com";
#endif
```

---

## Monitoring & Logging

### Application Insights (Azure)

#### 1. Add NuGet Package

```bash
dotnet add package Microsoft.ApplicationInsights.AspNetCore
```

#### 2. Configure in Program.cs

```csharp
builder.Services.AddApplicationInsightsTelemetry();
```

#### 3. Set Connection String

```bash
ApplicationInsights__ConnectionString="InstrumentationKey=your-key"
```

### Serilog (File/Seq Logging)

#### 1. Add NuGet Packages

```bash
dotnet add package Serilog.AspNetCore
dotnet add package Serilog.Sinks.File
dotnet add package Serilog.Sinks.Seq
```

#### 2. Configure in Program.cs

```csharp
Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.File("logs/the586dynasty-.log", rollingInterval: RollingInterval.Day)
    .WriteTo.Seq("http://localhost:5341")
    .CreateLogger();

builder.Host.UseSerilog();
```

### Health Checks

Already configured at:
- `GET /health` - Basic health check
- `GET /healthz` - Kubernetes-style health check

### Metrics Endpoints

Configure Prometheus metrics:

```bash
dotnet add package prometheus-net.AspNetCore
```

```csharp
app.UseMetricServer();  // /metrics endpoint
app.UseHttpMetrics();
```

---

## Production Checklist

### Backend

- [ ] Set `ASPNETCORE_ENVIRONMENT=Production`
- [ ] Use secure connection strings
- [ ] Enable HTTPS/TLS
- [ ] Configure CORS properly
- [ ] Set up logging (Serilog/App Insights)
- [ ] Enable health checks
- [ ] Configure firewall rules
- [ ] Set up backup for database
- [ ] Configure auto-scaling (if Cloud Run/Azure)
- [ ] Set up monitoring alerts

### Frontend

- [ ] Update API URLs to production
- [ ] Configure app signing (iOS/Android)
- [ ] Update version numbers
- [ ] Create store listings
- [ ] Add privacy policy URL
- [ ] Configure push notifications (if needed)
- [ ] Test on physical devices
- [ ] Submit for app store review

### Database

- [ ] Run all migrations
- [ ] Seed initial data
- [ ] Configure backups (daily recommended)
- [ ] Set up connection pooling
- [ ] Enable SSL connections
- [ ] Configure query logging (if needed)

---

## Troubleshooting

### Backend Issues

**Database connection fails:**
```bash
# Test connection
psql "your-connection-string"

# Check logs
docker logs the586-api
journalctl -u the586dynasty-api -f
```

**Port already in use:**
```bash
# Find process
lsof -i :8080
# Kill it
kill -9 <PID>
```

### Mobile Issues

**Build fails:**
```bash
# Clean
dotnet clean
rm -rf bin obj

# Rebuild
dotnet build
```

**MAUI workload missing:**
```bash
dotnet workload install maui
```

---

## Support

For deployment issues, contact the development team or refer to:
- [ASP.NET Core Deployment Docs](https://learn.microsoft.com/aspnet/core/host-and-deploy/)
- [.NET MAUI Deployment Docs](https://learn.microsoft.com/dotnet/maui/deployment/)

---

**Last Updated:** 2024
**Stack Version:** .NET 8.0 / ASP.NET Core 8.0 / MAUI 8.0
