# Quick Reference: GitHub Pages Deployment

## 🚀 One-Time Setup

### 1. Supabase Setup (5 minutes)
```bash
# 1. Go to https://supabase.com and create a project
# 2. Copy Project URL and anon key
# 3. In Supabase SQL Editor, run: supabase/migrations/20260211_initial_schema.sql
```

### 2. Google Docs API Setup (5 minutes)
```bash
# 1. Go to https://console.cloud.google.com
# 2. Create new project
# 3. Enable Google Docs API
# 4. Create API Key
# 5. Make your Google Docs publicly readable (Anyone with link can view)
```

### 3. GitHub Configuration (2 minutes)
```bash
# Go to: Settings > Secrets and variables > Actions
# Add these secrets:
- EXPO_PUBLIC_SUPABASE_URL
- EXPO_PUBLIC_SUPABASE_ANON_KEY
- EXPO_PUBLIC_GOOGLE_DOCS_API_KEY
```

### 4. Enable GitHub Pages (1 minute)
```bash
# Go to: Settings > Pages
# Source: GitHub Actions
# Save
```

## 📦 Deployment

### Automatic Deployment
```bash
# Every push to main branch automatically deploys
git push origin main
```

### Manual Deployment
```bash
# Go to: Actions > Deploy to GitHub Pages > Run workflow
```

## 🧪 Local Testing

```bash
# Setup
cd mobile
cp .env.example .env.local
# Edit .env.local with your credentials

# Install
npm install

# Run
npm run web
# Open http://localhost:8081

# Build
npm run build:web
# Check mobile/dist/ folder
```

## 🔑 Environment Variables

```bash
# Required for Supabase
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...

# Required for Google Docs
EXPO_PUBLIC_GOOGLE_DOCS_API_KEY=AIzaSy...

# Optional (for backward compatibility)
EXPO_PUBLIC_API_URL=
```

## 📍 Your App URL

```
https://<username>.github.io/<repository-name>/
```

Example: `https://tfak23.github.io/The586Dynasty/`

## 🐛 Common Issues

### Build fails
```bash
# Check: Actions tab for error logs
# Fix: Verify all secrets are set correctly
```

### Supabase not connecting
```bash
# Check: Project URL and anon key
# Fix: Verify in Supabase dashboard Settings > API
```

### Google Docs API errors
```bash
# Check: Document is publicly accessible
# Fix: Share > Anyone with link can view
```

## 📊 Data Migration

If you have existing data in PostgreSQL:

```bash
# Export from PostgreSQL
psql $DATABASE_URL -c "COPY leagues TO STDOUT CSV HEADER" > leagues.csv

# Import to Supabase
# In Supabase: Table Editor > Import CSV
```

## 🎯 Next Steps

1. ✅ Deploy to GitHub Pages
2. ✅ Configure Supabase
3. ✅ Set up Google Docs API
4. 📱 Build mobile apps with `npx expo prebuild`
5. 🔐 Add authentication with Supabase Auth
6. 📊 Create Edge Functions for complex logic
7. 📡 Enable Realtime for live updates

## 📚 Documentation

- Full Setup Guide: `GITHUB_PAGES_SETUP.md`
- Supabase Setup: `supabase/README.md`
- Original Deployment: `DEPLOYMENT.md`

## 💬 Need Help?

1. Check documentation in repository
2. Review GitHub Issues
3. Check Supabase logs
4. Review GitHub Actions logs
