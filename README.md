# The 586 Dynasty

## 🏈 Dynasty Fantasy Football League Management Application

A complete fantasy football dynasty league management system with salary cap tracking, contract management, trade processing, and player synchronization from Sleeper API.

## 🎯 Available Implementations

This repository contains **TWO complete implementations** of the same application:

### 1. **TypeScript/Node.js Stack** (Original)
- **Backend**: Node.js + Express + PostgreSQL
- **Frontend**: React Native + Expo
- **Location**: `/backend` and `/mobile`

### 2. **C#/.NET Stack** (New Migration)
- **Backend**: ASP.NET Core 8.0 + Entity Framework Core + PostgreSQL
- **Frontend**: .NET MAUI 8.0
- **Location**: `/backend-csharp` and `/mobile-csharp`

---

## 📚 Documentation

### TypeScript Stack
- [Backend Documentation](./backend/README.md)
- [Mobile App Documentation](./mobile/README.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Design Document](./APP_DESIGN_DOCUMENT.md)

### C# Stack
- [Backend Documentation](./backend-csharp/README-CSHARP.md)
- [Mobile App Documentation](./mobile-csharp/README-MAUI.md)
- [Mobile Quick Start](./mobile-csharp/QUICK-START.md)
- [Migration Summary](./SUMMARY.md)

---

## 🚀 Quick Start

### Option 1: TypeScript Stack

```bash
# Backend
cd backend
npm install
cp .env.example .env
# Configure DATABASE_URL in .env
npm run dev

# Mobile
cd mobile
npm install
npx expo start
```

### Option 2: C# Stack

```bash
# Backend
cd backend-csharp
dotnet restore
# Configure ConnectionStrings in appsettings.json
dotnet run

# Mobile (requires MAUI workload)
cd mobile-csharp
dotnet build -t:Run -f net8.0-android
```

---

## ✨ Features

- **Salary Cap Management**: Track team cap space with dead cap calculations
- **Contract System**: Multi-year contracts with options and franchise tags
- **Trade Engine**: Multi-team trades with approval workflows
- **Player Sync**: Automatic synchronization from Sleeper API
- **Stats Tracking**: Weekly player stats and fantasy point calculations
- **Background Jobs**: Automatic roster sync and stats updates
- **Mobile App**: Full-featured mobile experience

---

## 🏗️ Architecture Comparison

| Feature | TypeScript Stack | C# Stack |
|---------|-----------------|----------|
| **Backend Framework** | Express.js | ASP.NET Core 8.0 |
| **Database ORM** | Raw SQL (pg) | Entity Framework Core |
| **Background Jobs** | node-cron | IHostedService + NCrontab |
| **API Documentation** | None | Swagger/OpenAPI |
| **Validation** | Zod | Data Annotations |
| **Frontend** | React Native + Expo | .NET MAUI |
| **State Management** | Zustand | MVVM + CommunityToolkit |
| **Navigation** | Expo Router | Shell Navigation |
| **HTTP Client** | Axios | HttpClient |

---

## 📊 Migration Statistics

- **Total Lines Migrated**: ~25,000+ lines TypeScript → ~10,000+ lines C#
- **Backend Completion**: 100% (8 controllers, 4 services, 2 background jobs)
- **Frontend Completion**: 100% structure (8 screens, 9 ViewModels)
- **API Endpoints**: 37+ RESTful endpoints
- **Database Models**: 16+ entities
- **Build Status**: ✅ Zero errors, zero warnings

---

## 🛠️ Tech Stack

### TypeScript Version
- Node.js 20+
- Express 4.x
- PostgreSQL 15+
- React Native 0.74
- Expo 51

### C# Version
- .NET 8.0
- ASP.NET Core 8.0
- Entity Framework Core 8.0
- .NET MAUI 8.0
- PostgreSQL 15+

---

## 📝 License

This project is proprietary software for The 586 Dynasty fantasy football league.

---

## 👥 Contributors

Created and maintained by the 586 Dynasty league management team.

---

## 🔗 Related Documentation

- [Complete Migration Guide](./SUMMARY.md)
- [MAUI Migration Details](./MAUI-MIGRATION-COMPLETE.md)
- [API Design Document](./APP_DESIGN_DOCUMENT.md)