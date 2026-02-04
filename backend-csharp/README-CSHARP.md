# The 586 Dynasty - C# Backend (ASP.NET Core)

This is the ASP.NET Core C# version of The 586 Dynasty backend API, migrated from TypeScript/Node.js.

## 🏗️ Architecture

### Technology Stack
- **Framework**: ASP.NET Core 8.0 (Web API)
- **Database**: PostgreSQL 15+ with Entity Framework Core
- **ORM**: Entity Framework Core 8.0 with Npgsql
- **Background Jobs**: IHostedService for scheduled tasks
- **API Documentation**: Swagger/OpenAPI
- **Logging**: Microsoft.Extensions.Logging

### Project Structure
```
backend-csharp/
├── Controllers/          # API endpoints (REST controllers)
│   ├── LeaguesController.cs
│   ├── TeamsController.cs
│   ├── ContractsController.cs
│   ├── PlayersController.cs
│   └── TradesController.cs
├── Models/              # Data entities and DTOs
│   ├── League.cs
│   ├── Team.cs
│   ├── Player.cs
│   ├── Contract.cs
│   ├── Trade.cs
│   └── DTOs.cs
├── Data/                # Database context
│   └── AppDbContext.cs
├── Services/            # Business logic services
│   └── SleeperService.cs
├── Middleware/          # Custom middleware
│   └── ErrorHandlingMiddleware.cs
├── Jobs/                # Background tasks
│   └── RosterSyncJob.cs
├── Program.cs           # Application entry point
└── appsettings.json     # Configuration
```

## 🚀 Getting Started

### Prerequisites
- .NET 8.0 SDK
- PostgreSQL 15+
- (Optional) Docker

### Local Development

1. **Clone the repository**
```bash
git clone <repo-url>
cd backend-csharp
```

2. **Configure database connection**

Edit `appsettings.json` or set environment variable:
```bash
export ConnectionStrings__DefaultConnection="Host=localhost;Port=5432;Database=the586;Username=postgres;Password=yourpassword"
```

3. **Run database migrations**

The schema already exists (created from `backend/src/db/schema.sql`). Entity Framework will connect to the existing schema.

4. **Run the application**
```bash
dotnet run
```

The API will start on `http://localhost:5000`

- Swagger UI: http://localhost:5000
- Health check: http://localhost:5000/health

### Build for Production

```bash
dotnet build -c Release
dotnet publish -c Release -o ./publish
```

### Docker Build

```bash
docker build -t the586-csharp-api .
docker run -p 8080:8080 \
  -e ConnectionStrings__DefaultConnection="Host=host.docker.internal;Port=5432;Database=the586;Username=postgres;Password=password" \
  the586-csharp-api
```

## 📡 API Endpoints

All endpoints maintain the same contracts as the TypeScript version:

### Leagues (`/api/leagues`)
- `GET /` - Get all leagues
- `GET /{id}` - Get league by ID
- `GET /sleeper/{sleeperId}` - Get league by Sleeper ID
- `POST /` - Create league
- `PATCH /{id}` - Update league

### Teams (`/api/teams`)
- `GET /league/{leagueId}` - Get teams for league
- `GET /{id}` - Get team by ID
- `GET /{id}/cap` - Get team cap summary
- `GET /league/{leagueId}/cap` - Get all team caps
- `GET /{id}/roster` - Get team roster with contracts
- `PATCH /{id}` - Update team

### Contracts (`/api/contracts`)
- `GET /league/{leagueId}` - Get contracts (with filters)
- `GET /{id}` - Get contract by ID
- `POST /` - Create contract
- `POST /{id}/release` - Release player (calculate dead cap)
- `GET /{id}/dead-cap-preview` - Preview dead cap

### Players (`/api/players`)
- `POST /sync` - Sync all players from Sleeper
- `GET /search` - Search players
- `GET /{id}` - Get player by ID
- `GET /sleeper/{sleeperId}` - Get player by Sleeper ID
- `GET /{id}/contracts` - Get player contract history
- `GET /position/{position}` - Get players by position
- `GET /league/{leagueId}/top-salaries` - Get top paid players

### Trades (`/api/trades`)
- `GET /league/{leagueId}` - Get trades (with filters)
- `GET /{id}` - Get trade by ID
- `POST /` - Create trade proposal
- `POST /{id}/accept` - Accept trade
- (Additional endpoints to be completed)

## 🔄 Background Jobs

### Roster Sync Job
- **Schedule**: Every 5 minutes
- **Purpose**: Sync rosters from Sleeper and auto-release dropped players with dead cap
- **Implementation**: `RosterSyncJob.cs` using `IHostedService`

### Stats Sync Job
- **Schedule**: Tuesdays at 6 AM UTC (to be implemented)
- **Purpose**: Sync player season stats from Sleeper
- **Implementation**: Planned

## 🛠️ Configuration

### Environment Variables

The application can be configured via environment variables:

```bash
# Database
ConnectionStrings__DefaultConnection="Host=...;Database=..."

# League Settings
LeagueConfiguration__DefaultLeagueId="1315789488873553920"
LeagueConfiguration__CurrentSeason=2025

# Sleeper API
SleeperApi__BaseUrl="https://api.sleeper.app/v1"

# Logging
Logging__LogLevel__Default="Information"
```

### appsettings.json

See `appsettings.json` for full configuration options.

## 🔒 Security

- **CORS**: Configured to allow all origins (configure for production)
- **Security Headers**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
- **Error Handling**: Custom middleware with PostgreSQL error code handling
- **Validation**: Data Annotations on models

## 📊 Database

This application uses **Entity Framework Core** with an existing PostgreSQL schema. The database schema is defined in `/backend/src/db/schema.sql` and includes:

- 15+ tables for leagues, teams, players, contracts, trades, etc.
- Views for team cap summaries and contract years
- Stored procedures for dead cap calculation and franchise tags
- Indexes for performance optimization

**Note**: Entity Framework is configured to use the existing schema (no automatic migrations).

## 🧪 Testing

Build the project to verify everything compiles:

```bash
dotnet build
```

Run with verbose logging:

```bash
export Logging__LogLevel__Default="Debug"
dotnet run
```

## 📝 Migration Notes

### Key Differences from TypeScript Version

1. **ORM**: Direct SQL queries (pg driver) → Entity Framework Core
2. **Background Jobs**: node-cron → IHostedService
3. **Error Handling**: Express middleware → ASP.NET Core middleware
4. **Routing**: Express Router → ASP.NET Core Controllers with attributes
5. **Validation**: Manual checks → Data Annotations + FluentValidation (optional)
6. **Configuration**: dotenv → appsettings.json + environment variables

### Compatible Features

- ✅ Same REST API endpoints and contracts
- ✅ Same PostgreSQL schema (no changes)
- ✅ Same business logic for cap calculations
- ✅ Same dead cap percentage formulas
- ✅ Same Sleeper API integration
- ✅ Background roster sync (every 5 minutes)

### Not Yet Implemented

- ⏳ Stats sync job (Tuesdays at 6 AM)
- ⏳ Contract evaluation service (ratings: LEGENDARY, STEAL, BUST, etc.)
- ⏳ Contract estimation service (free agent salary estimates)
- ⏳ Some advanced trade endpoints (commissioner approval, league voting)
- ⏳ Import/CSV endpoints
- ⏳ Sync endpoints (full league sync from Sleeper)
- ⏳ Trade history controller
- ⏳ Firebase push notifications

## 🐛 Troubleshooting

### Database Connection Issues

```bash
# Test PostgreSQL connection
psql -h localhost -U postgres -d the586

# Verify connection string in appsettings.json
```

### Port Already in Use

```bash
# Change port in appsettings.json under Kestrel:Endpoints:Http:Url
# Or use environment variable
export ASPNETCORE_URLS="http://localhost:5001"
```

## 📚 Resources

- [ASP.NET Core Documentation](https://docs.microsoft.com/aspnet/core)
- [Entity Framework Core](https://docs.microsoft.com/ef/core)
- [Npgsql Documentation](https://www.npgsql.org/efcore)
- [Original TypeScript Backend](/backend)

## 📄 License

Same as main project.
