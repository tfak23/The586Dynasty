# The 586 Dynasty - Fantasy Football Companion App

A comprehensive fantasy football app for dynasty leagues with salary cap management, contract tracking, and Google Docs integration.

## 🔐 Secure API Key Storage with Supabase

This app uses **Supabase Edge Functions** to securely manage sensitive API keys like the Google Docs API key. API keys are stored server-side and never exposed to client code.

### Why Use Edge Functions for API Keys?

❌ **Don't Do This (Insecure):**
- Storing API keys in client-side environment variables
- Committing API keys to version control
- Exposing keys in browser network requests

✅ **Do This Instead (Secure):**
- Store API keys in Supabase environment variables
- Use Edge Functions to make API calls server-side
- Client only sends document IDs, never API keys

### Quick Setup

1. **Set Environment Variables in Supabase:**
   - Go to your Supabase Dashboard
   - Navigate to **Settings** → **Edge Functions**
   - Add environment variable:
     - Name: `GOOGLE_DOCS_API_KEY`
     - Value: Your Google Docs API key

2. **Deploy Edge Functions:**
   ```bash
   # Install Supabase CLI
   npm install -g supabase
   
   # Login to Supabase
   supabase login
   
   # Link your project
   supabase link --project-ref your-project-ref
   
   # Deploy functions
   supabase functions deploy google-docs-read
   ```

3. **Update Frontend Code:**
   The app automatically uses Edge Functions when available. No client-side API keys needed!

For detailed setup instructions, see the [Secure API Key Management Guide](#-secure-api-key-management-guide) below.

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

- [Secure API Key Management Guide](#-secure-api-key-management-guide) - **NEW:** Secure API key storage with Supabase
- [GitHub Pages Setup Guide](GITHUB_PAGES_SETUP.md) - Deploy to GitHub Pages with Supabase
- [Traditional Deployment Guide](DEPLOYMENT.md) - Deploy to Google Cloud Platform
- [App Design Document](APP_DESIGN_DOCUMENT.md) - Detailed feature specifications
- [Supabase Setup](supabase/README.md) - Database configuration
- [Edge Functions](supabase/functions/README.md) - Serverless functions documentation

---

## 🔐 Secure API Key Management Guide

This comprehensive guide explains how to securely store and manage API keys using Supabase Edge Functions.

### Table of Contents
1. [Basic Setup](#basic-setup)
2. [Frontend Integration](#frontend-integration)
3. [Best Practices](#best-practices)
4. [Troubleshooting](#troubleshooting-api-keys)

---

### Basic Setup

#### Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign in with your GitHub account
3. Click **"New Project"**
4. Fill in the details:
   - **Name:** The 586 Dynasty (or your league name)
   - **Database Password:** Create a strong password (save it securely!)
   - **Region:** Choose closest to your users
   - **Pricing Plan:** Free tier is sufficient for most leagues
5. Click **"Create new project"** and wait ~2 minutes for setup

#### Step 2: Set Environment Variables for API Keys

🔒 **This is where you securely store your API keys** (never in client code!)

1. In your Supabase Dashboard, go to **Settings** → **Edge Functions**
2. Scroll to **"Function Secrets"** or **"Environment Variables"**
3. Click **"Add new secret"**
4. Add your Google Docs API key:
   - **Name:** `GOOGLE_DOCS_API_KEY`
   - **Value:** Your Google Docs API key (get from [Google Cloud Console](https://console.cloud.google.com/apis/credentials))
5. Click **"Save"**

**Pro Tip:** You can add multiple keys here:
- `GOOGLE_DOCS_API_KEY` - For Google Docs integration
- `SLEEPER_API_KEY` - If using authenticated Sleeper endpoints
- Any other sensitive credentials your app needs

#### Step 3: Deploy the Database Schema

1. In Supabase Dashboard, go to **SQL Editor**
2. Click **"New query"**
3. Copy the contents of `supabase/migrations/20260211_initial_schema.sql` from this repo
4. Paste into the SQL Editor
5. Click **"Run"** to execute the migration
6. Verify tables were created in the **Table Editor**

#### Step 4: Deploy Supabase Edge Functions

Edge Functions are serverless functions that run on Supabase's infrastructure. They securely access your API keys without exposing them to clients.

##### Install Supabase CLI

```bash
# Install globally via npm
npm install -g supabase

# Verify installation
supabase --version
```

##### Login and Link Project

```bash
# Login to Supabase (opens browser for authentication)
supabase login

# Navigate to your project directory
cd The586Dynasty

# Link to your Supabase project
supabase link --project-ref your-project-ref
```

**Finding your project ref:**
- Go to Supabase Dashboard → **Settings** → **General**
- Copy the **Reference ID** (looks like `abcdefghijklmnop`)

##### Deploy the Functions

```bash
# Deploy all Edge Functions
supabase functions deploy

# Or deploy a specific function
supabase functions deploy google-docs-read
```

**Expected output:**
```
Deploying google-docs-read (project ref: your-project-ref)
✓ Deployed google-docs-read function
Function URL: https://your-project-ref.supabase.co/functions/v1/google-docs-read
```

##### Verify Deployment

Test your function is working:

```bash
curl -i --location --request POST \
  'https://your-project-ref.supabase.co/functions/v1/google-docs-read' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"documentId":"test-id","operation":"read"}'
```

You should get a response (even if it's an error about the doc ID - that means the function is working!).

---

### Frontend Integration

#### Step 5: Configure the Frontend

The app is already configured to use Edge Functions! Here's how it works:

##### Old Way (Insecure - Don't Do This):
```typescript
// ❌ Client-side API key - INSECURE!
const GOOGLE_DOCS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_DOCS_API_KEY;
const response = await fetch(
  `https://docs.googleapis.com/v1/documents/${docId}?key=${GOOGLE_DOCS_API_KEY}`
);
```

##### New Way (Secure - Do This):
```typescript
// ✅ Uses Edge Function - SECURE!
import { supabase } from './lib/supabase';

const result = await supabase.functions.invoke('google-docs-read', {
  body: { 
    documentId: docId,
    operation: 'read'
  }
});
```

#### Example: Reading a Google Doc Securely

```typescript
import { readGoogleDoc, parseDocAsTable, extractTextFromDoc } from './lib/googleDocs';

// Read a full document
const doc = await readGoogleDoc('1abc123...');
if (doc.success) {
  console.log('Title:', doc.title);
  console.log('Content:', doc.body);
}

// Extract just the text
const text = await extractTextFromDoc('1abc123...');
console.log('Text:', text);

// Parse a table from the document
const table = await parseDocAsTable('1abc123...');
console.log('Table data:', table);
```

#### Using Edge Functions for Other APIs

You can create Edge Functions for any API that requires keys:

```typescript
// Example: Sleeper API wrapper
const result = await supabase.functions.invoke('sleeper-sync', {
  body: { 
    leagueId: '123456',
    season: 2024
  }
});

// Example: Custom API wrapper
const result = await supabase.functions.invoke('my-api-call', {
  body: { 
    action: 'getData',
    params: { id: 123 }
  }
});
```

#### Error Handling

Always handle errors gracefully:

```typescript
try {
  const { data, error } = await supabase.functions.invoke('google-docs-read', {
    body: { documentId: docId, operation: 'read' }
  });
  
  if (error) {
    console.error('Function error:', error);
    // Show user-friendly message
    alert('Failed to load document. Please try again.');
    return;
  }
  
  if (!data.success) {
    console.error('API error:', data.error);
    alert(data.error);
    return;
  }
  
  // Success - use the data
  console.log('Document loaded:', data.data);
  
} catch (err) {
  console.error('Unexpected error:', err);
  alert('An unexpected error occurred.');
}
```

---

### Best Practices

#### 🔒 Security Best Practices

1. **Never Expose API Keys in Client Code**
   - ❌ Don't use `EXPO_PUBLIC_*` environment variables for sensitive keys
   - ❌ Don't commit `.env` files with real keys
   - ✅ Use Supabase environment variables
   - ✅ Access keys only in Edge Functions

2. **Use Environment Variables Correctly**
   ```bash
   # ❌ DON'T - This is exposed to the client
   EXPO_PUBLIC_API_KEY=secret123
   
   # ✅ DO - This stays on the server
   # (Set in Supabase Dashboard → Settings → Edge Functions)
   API_KEY=secret123
   ```

3. **Implement Rate Limiting**
   ```typescript
   // In your Edge Function
   const rateLimitKey = `ratelimit:${userId}:google-docs`;
   const requestCount = await redis.incr(rateLimitKey);
   
   if (requestCount === 1) {
     await redis.expire(rateLimitKey, 60); // 1 minute window
   }
   
   if (requestCount > 10) {
     return new Response('Rate limit exceeded', { status: 429 });
   }
   ```

4. **Validate All Inputs**
   ```typescript
   // In your Edge Function
   const { documentId } = await req.json();
   
   // Validate document ID format
   if (!documentId || !/^[a-zA-Z0-9_-]+$/.test(documentId)) {
     return new Response('Invalid document ID', { status: 400 });
   }
   ```

5. **Use Row Level Security (RLS)**
   
   Supabase RLS adds an additional layer of protection:
   
   ```sql
   -- Example: Users can only read their own league data
   CREATE POLICY "Users can view own league data"
   ON leagues FOR SELECT
   USING (auth.uid() IN (
     SELECT user_id FROM league_members WHERE league_id = leagues.id
   ));
   
   -- Example: Only commissioners can modify league settings
   CREATE POLICY "Only commissioners can update leagues"
   ON leagues FOR UPDATE
   USING (auth.uid() IN (
     SELECT user_id FROM league_members 
     WHERE league_id = leagues.id AND role = 'commissioner'
   ));
   ```

6. **Monitor Function Usage**
   - Check Supabase Dashboard → **Edge Functions** → **Logs**
   - Set up alerts for unusual activity
   - Monitor API quota usage

7. **Rotate Keys Regularly**
   - Change API keys every 90 days
   - Update in Supabase Dashboard only (not in code)
   - Test after rotation

#### 🎯 Supabase Security Features

Supabase provides multiple layers of security:

1. **API Keys**
   - `anon` key: Public, safe to expose (has limited permissions)
   - `service_role` key: Secret, full admin access (never expose!)

2. **Row Level Security (RLS)**
   - Database-level access control
   - Works even if someone bypasses your Edge Functions
   - Policies are written in SQL

   Example RLS policy:
   ```sql
   -- Enable RLS on a table
   ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
   
   -- Only allow users to see contracts in their league
   CREATE POLICY "view_own_league_contracts" ON contracts
   FOR SELECT USING (
     league_id IN (
       SELECT league_id FROM team_members 
       WHERE user_id = auth.uid()
     )
   );
   ```

3. **Edge Function Authorization**
   ```typescript
   // In your Edge Function - require authentication
   import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
   
   const authHeader = req.headers.get('Authorization');
   const supabase = createClient(
     Deno.env.get('SUPABASE_URL')!,
     Deno.env.get('SUPABASE_ANON_KEY')!,
     { global: { headers: { Authorization: authHeader! } } }
   );
   
   // Get authenticated user
   const { data: { user }, error } = await supabase.auth.getUser();
   if (error || !user) {
     return new Response('Unauthorized', { status: 401 });
   }
   ```

4. **CORS Configuration**
   ```typescript
   // In your Edge Function - restrict origins
   const corsHeaders = {
     'Access-Control-Allow-Origin': 'https://yourdomain.com', // Specific domain
     'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   };
   ```

#### 💡 Development vs Production

**Local Development:**
```bash
# Use local Supabase instance
supabase start
supabase functions serve

# Test with local keys
curl -i --location --request POST \
  'http://localhost:54321/functions/v1/google-docs-read' \
  --header 'Authorization: Bearer eyJ...' \
  --header 'Content-Type: application/json' \
  --data '{"documentId":"test"}'
```

**Production:**
- Use Supabase Dashboard environment variables
- Deploy functions: `supabase functions deploy`
- Never use test/development keys in production

---

### Troubleshooting API Keys

#### Function Not Found (404)

**Problem:** `Function 'google-docs-read' not found`

**Solution:**
1. Verify function is deployed: `supabase functions list`
2. Re-deploy: `supabase functions deploy google-docs-read`
3. Check project is linked: `supabase projects list`

#### Environment Variable Not Set

**Problem:** `Google Docs API key not configured in Supabase environment variables`

**Solution:**
1. Go to Supabase Dashboard → Settings → Edge Functions
2. Add `GOOGLE_DOCS_API_KEY` in Environment Variables
3. Redeploy function: `supabase functions deploy google-docs-read`

#### CORS Errors

**Problem:** `Access-Control-Allow-Origin` errors in browser

**Solution:**
Edge Function already has CORS headers. If still seeing errors:
1. Check function is deployed correctly
2. Verify you're calling from the correct domain
3. Check browser console for specific CORS error

#### Rate Limiting / Quota Exceeded

**Problem:** `429 Too Many Requests` or `Quota exceeded`

**Solution:**
1. **Supabase Side:** Check Functions logs in Dashboard
2. **Google API Side:** 
   - Go to Google Cloud Console → APIs & Services → Dashboard
   - Check quota usage for Google Docs API
   - Request quota increase if needed

#### Authentication Errors

**Problem:** `Unauthorized` or `Invalid API key`

**Solution:**
1. Verify API key is correct in Supabase environment variables
2. Check API key restrictions in Google Cloud Console:
   - APIs & Services → Credentials → Your API Key
   - Ensure Docs API is enabled
   - Check IP/domain restrictions aren't blocking Supabase
3. Test API key directly:
   ```bash
   curl "https://docs.googleapis.com/v1/documents/VALID_DOC_ID?key=YOUR_KEY"
   ```

---

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