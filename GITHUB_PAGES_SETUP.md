# GitHub Pages + Supabase + Google Docs Setup Guide

This guide walks through converting The 586 Dynasty app to be hosted on GitHub Pages with Supabase backend and Google Docs API integration.

## 📋 Prerequisites

- GitHub account with repository access
- Supabase account (free tier available at https://supabase.com)
- Google Cloud Platform account for Google Docs API
- Node.js 20+ installed locally for testing

## 🚀 Part 1: Supabase Backend Setup

### 1.1 Create Supabase Project

1. Go to https://supabase.com and sign in
2. Click "New Project"
3. Fill in project details:
   - **Name**: The586Dynasty
   - **Database Password**: (save this securely)
   - **Region**: Choose closest to your users
4. Wait for project to be provisioned (~2 minutes)

### 1.2 Set Up Database Schema

1. In Supabase dashboard, go to "SQL Editor"
2. Click "New Query"
3. Copy the contents of `supabase/migrations/20260211_initial_schema.sql`
4. Paste into the SQL editor
5. Click "Run" to create all tables
6. Verify tables were created in the "Table Editor" tab

### 1.3 Configure API Keys

1. Go to Project Settings > API
2. Copy the following values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key
3. Save these for later configuration

### 1.4 Set Up Row Level Security (Optional but Recommended)

If you want to add authentication later, enable RLS:

```sql
-- Enable RLS on all tables
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- For now, allow all operations (you can restrict this later)
CREATE POLICY "Allow all operations" ON leagues FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON teams FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON contracts FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON players FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON trades FOR ALL USING (true);
```

## 🔑 Part 2: Google Docs API Setup

### 2.1 Create Google Cloud Project

1. Go to https://console.cloud.google.com
2. Click "Select a Project" > "New Project"
3. Name it "The586Dynasty"
4. Click "Create"

### 2.2 Enable Google Docs API

1. In the Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for "Google Docs API"
3. Click on it and press "Enable"

### 2.3 Create API Key

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "API Key"
3. Copy the API key
4. (Recommended) Click "Restrict Key":
   - Under "API restrictions", select "Restrict key"
   - Choose "Google Docs API"
   - Click "Save"

### 2.4 Make Your Google Doc Accessible

For the API to read your Google Doc:
1. Open your Google Doc
2. Click "Share"
3. Under "General access", select "Anyone with the link"
4. Set permission to "Viewer"
5. Click "Done"

**Note**: For write access, you'll need OAuth 2.0 setup (more complex). The current implementation supports read-only with API keys.

## 📦 Part 3: GitHub Pages Deployment

### 3.1 Configure GitHub Repository Secrets

1. Go to your repository on GitHub
2. Click "Settings" > "Secrets and variables" > "Actions"
3. Add the following secrets:
   - `EXPO_PUBLIC_SUPABASE_URL`: Your Supabase project URL
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key
   - `EXPO_PUBLIC_GOOGLE_DOCS_API_KEY`: Your Google Docs API key
   - `EXPO_PUBLIC_API_URL`: Set to your Supabase URL or leave empty

### 3.2 Enable GitHub Pages

1. Go to repository "Settings" > "Pages"
2. Under "Source", select "GitHub Actions"
3. Save the configuration

### 3.3 Deploy the Application

The GitHub Actions workflow will automatically deploy on push to main branch.

To manually trigger a deployment:
1. Go to "Actions" tab
2. Click "Deploy to GitHub Pages" workflow
3. Click "Run workflow"
4. Wait for deployment to complete (~2-5 minutes)

### 3.4 Access Your Application

Once deployed, your app will be available at:
```
https://<your-username>.github.io/<repository-name>/
```

For example: `https://tfak23.github.io/The586Dynasty/`

## 🧪 Part 4: Testing Locally

### 4.1 Set Up Environment Variables

Create `mobile/.env.local`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
EXPO_PUBLIC_GOOGLE_DOCS_API_KEY=your-google-api-key-here
```

### 4.2 Install Dependencies

```bash
cd mobile
npm install
```

### 4.3 Run Development Server

```bash
npm run web
```

Open http://localhost:8081 in your browser.

### 4.4 Test Google Docs Integration

1. Navigate to Settings tab
2. You should see "Google Docs Integration" section
3. Paste a Google Doc ID or URL
4. Click "Read Document"
5. Verify the document content is displayed

## 📊 Part 5: Migrating Data from PostgreSQL

If you have existing data in the PostgreSQL backend:

### 5.1 Export Data

```bash
# Export each table as CSV
psql $DATABASE_URL -c "COPY leagues TO STDOUT CSV HEADER" > leagues.csv
psql $DATABASE_URL -c "COPY teams TO STDOUT CSV HEADER" > teams.csv
psql $DATABASE_URL -c "COPY players TO STDOUT CSV HEADER" > players.csv
psql $DATABASE_URL -c "COPY contracts TO STDOUT CSV HEADER" > contracts.csv
psql $DATABASE_URL -c "COPY trades TO STDOUT CSV HEADER" > trades.csv
```

### 5.2 Import to Supabase

1. In Supabase dashboard, go to "Table Editor"
2. Select each table
3. Click "Import data from CSV"
4. Upload the corresponding CSV file
5. Verify data imported correctly

## 🔧 Configuration Options

### Switching Between Axios and Supabase API

The app now supports both the original axios-based API and the new Supabase API:

**To use Supabase** (default for GitHub Pages):
```typescript
import * as api from '@/lib/supabaseApi';
```

**To use original Express backend**:
```typescript
import * as api from '@/lib/api';
```

### Custom Domain (Optional)

To use a custom domain with GitHub Pages:

1. Go to repository Settings > Pages
2. Under "Custom domain", enter your domain
3. Add DNS records at your domain provider:
   - Type: CNAME
   - Name: www (or your subdomain)
   - Value: `<username>.github.io`
4. Wait for DNS propagation (~24 hours)
5. Enable "Enforce HTTPS"

## 📝 Using Google Docs Integration

### Reading League Data from Google Docs

1. Create a Google Doc with a table containing league data
2. Share the document (Anyone with link can view)
3. Copy the document ID from the URL
4. In the app, go to Settings > Google Docs Integration
5. Paste the document ID
6. Click "Read Document"
7. The table data will be parsed and available for import

### Document Format for Imports

For best results, structure your Google Doc with tables like:

```
| Team Name | Owner Name | Cap Space |
|-----------|------------|-----------|
| Team 1    | John Doe   | 125.50    |
| Team 2    | Jane Smith | 200.00    |
```

### Writing to Google Docs (Future Enhancement)

The current implementation supports read-only with API keys. For write access:

1. Set up OAuth 2.0 in Google Cloud Console
2. Implement OAuth flow in the app
3. Request write permissions from users
4. Use authenticated client for write operations

## 🐛 Troubleshooting

### GitHub Pages not deploying

- Check Actions tab for error logs
- Verify all secrets are set correctly
- Ensure main branch is set as source

### Supabase connection errors

- Verify project URL and anon key are correct
- Check if RLS policies are blocking access
- Look at Supabase logs in dashboard

### Google Docs API errors

- Verify API key is valid and not restricted incorrectly
- Check if document is publicly accessible
- Ensure Google Docs API is enabled in GCP

### Build errors

- Clear node_modules: `rm -rf node_modules && npm install`
- Clear Expo cache: `npx expo start --clear`
- Check that all dependencies are installed

## 🎯 Next Steps

1. **Authentication**: Add Supabase Auth for user login
2. **Edge Functions**: Move complex logic to Supabase Edge Functions
3. **Realtime**: Enable Supabase Realtime for live updates
4. **Google Sheets**: Add Google Sheets API for easier data management
5. **Offline Mode**: Implement offline-first with local storage
6. **Mobile Apps**: Build native iOS/Android apps with Expo EAS

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Expo Web Documentation](https://docs.expo.dev/workflow/web/)
- [Google Docs API Guide](https://developers.google.com/docs/api)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)

## 💬 Support

For issues or questions:
1. Check existing GitHub Issues
2. Create a new issue with detailed description
3. Include error logs and reproduction steps
