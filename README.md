# The 586 Dynasty - Fantasy Football Companion App

A comprehensive fantasy football app for dynasty leagues with salary cap management, contract tracking, and Google Docs integration.

## 🚀 Deployment Options

This app supports multiple deployment options:

### 1. GitHub Pages (Recommended for Web)
- **Free hosting** on GitHub Pages
- **Supabase backend** for database and API
- **Google Docs API** for data import/export
- **See**: [GITHUB_PAGES_SETUP.md](GITHUB_PAGES_SETUP.md)

### 2. Traditional Deployment
- **Google Cloud Run** for backend API
- **PostgreSQL** database
- **Expo** for mobile apps (iOS/Android)
- **See**: [DEPLOYMENT.md](DEPLOYMENT.md)

## ✨ Features

- 💰 **Salary Cap Management**: Track team salary caps with $500 hard cap
- 📝 **Multi-Year Contracts**: 1-5 year contracts with dead cap penalties
- 🏷️ **Franchise Tags**: Position-based franchise tag calculations
- 📊 **Trade Management**: Create and approve trades with expiration dates
- 📈 **Cap Projections**: 5-year forward salary cap projections
- 🔄 **Sleeper Integration**: Sync rosters and player data from Sleeper
- 📑 **Google Docs Integration**: Import/export league data via Google Docs
- 📱 **Mobile & Web**: Works on iOS, Android, and web browsers

## 🛠️ Quick Start (GitHub Pages)

1. **Fork this repository**

2. **Set up Supabase**:
   ```bash
   # Create a Supabase project at https://supabase.com
   # Run the migration in supabase/migrations/20260211_initial_schema.sql
   ```

3. **Configure GitHub Secrets**:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_GOOGLE_DOCS_API_KEY`

4. **Enable GitHub Pages**:
   - Settings > Pages > Source: GitHub Actions

5. **Deploy**: Push to main branch

See [GITHUB_PAGES_SETUP.md](GITHUB_PAGES_SETUP.md) for detailed instructions.

## 🧪 Local Development

```bash
# Clone the repository
git clone https://github.com/tfak23/The586Dynasty.git
cd The586Dynasty/mobile

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local
# Edit .env.local with your credentials

# Start development server
npm run web
```

Open http://localhost:8081 in your browser.

## 📚 Documentation

- [GitHub Pages Setup Guide](GITHUB_PAGES_SETUP.md) - Deploy to GitHub Pages with Supabase
- [Traditional Deployment Guide](DEPLOYMENT.md) - Deploy to Google Cloud Platform
- [App Design Document](APP_DESIGN_DOCUMENT.md) - Detailed feature specifications
- [Supabase Setup](supabase/README.md) - Database configuration

## 🔧 Technology Stack

- **Frontend**: React Native (Expo) + TypeScript
- **Backend**: Supabase or Express.js + PostgreSQL
- **API**: Supabase Client or REST API
- **Deployment**: GitHub Pages or Google Cloud Run
- **External APIs**: Sleeper API, Google Docs API

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is private and for The 586 Dynasty league members only.