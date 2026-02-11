# The586Dynasty

## Dynasty Fantasy Football Companion App

A comprehensive mobile application for managing dynasty fantasy football leagues with advanced features including salary cap tracking, multi-year contracts, franchise tags, and trade management.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Secure API Key Management with Supabase](#secure-api-key-management-with-supabase)
  - [Why Supabase for API Key Management](#why-supabase-for-api-key-management)
  - [Setup Guide](#setup-guide)
  - [Using Supabase Functions](#using-supabase-functions)
  - [Best Practices](#best-practices)
- [Development Setup](#development-setup)
- [Deployment](#deployment)
- [Contributing](#contributing)

## Overview

The 586 Dynasty app extends the Sleeper fantasy football platform with dynasty-specific features that aren't available in the base platform. Built with React Native (Expo) for mobile and Node.js/Express for the backend, it provides a comprehensive solution for managing dynasty league contracts and finances.

## Features

- **Salary Cap Management**: Track team budgets with a $500 hard cap
- **Multi-Year Contracts**: Sign players to 1-5 year deals
- **Franchise Tags**: Position-based average calculations
- **Trade Management**: Expiring trades with notifications
- **Cap Projections**: 5-year forward budget planning
- **Release Cap Hits**: Dead money tracking
- **Sleeper Integration**: Automatic roster syncing

## Architecture

### Technology Stack

- **Frontend**: React Native (Expo), TypeScript
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL (Cloud SQL)
- **API Integration**: Sleeper API, Supabase Edge Functions
- **Deployment**: Google Cloud Run, Supabase
- **Authentication**: Firebase (optional)

### System Design

```
┌──────────────┐      ┌──────────────────┐      ┌──────────────┐
│              │      │                  │      │              │
│  Mobile App  │◄────►│  Backend API     │◄────►│  PostgreSQL  │
│  (Expo)      │      │  (Express)       │      │  Database    │
│              │      │                  │      │              │
└──────┬───────┘      └────────┬─────────┘      └──────────────┘
       │                       │
       │                       │
       │              ┌────────▼─────────┐
       │              │                  │
       └─────────────►│  Supabase        │
                      │  Edge Functions  │
                      │  (API Keys)      │
                      └──────────────────┘
```

---

## Secure API Key Management with Supabase

### Why Supabase for API Key Management

**The Problem**: Storing API keys directly in frontend code or mobile apps exposes them to potential security risks. Anyone can decompile your app or inspect network requests to extract these keys.

**The Solution**: Use Supabase Edge Functions as a secure proxy layer. API keys are stored server-side in Supabase's secure environment variables, and your frontend only communicates with your own Supabase functions.

**Benefits**:
- ✅ API keys never exposed in frontend code
- ✅ Centralized key management in Supabase dashboard
- ✅ Row Level Security (RLS) for data protection
- ✅ Built-in authentication and authorization
- ✅ Easy key rotation without app updates
- ✅ Rate limiting and access controls
- ✅ Automatic HTTPS and CORS handling

### Setup Guide

#### Step 1: Create a Supabase Project

1. Go to [Supabase](https://supabase.com) and sign up/login
2. Click "New Project"
3. Fill in project details:
   - **Name**: The586Dynasty
   - **Database Password**: Choose a strong password
   - **Region**: Select closest to your users
4. Wait for project creation (~2 minutes)

#### Step 2: Get Your Supabase Credentials

From your Supabase project dashboard:

1. Go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (safe to use in frontend)
   - **service_role key** (keep secret, backend only)

#### Step 3: Configure Environment Variables

**Backend Configuration** (`backend/.env`):
```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Mobile App Configuration** (`mobile/.env`):
```bash
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

⚠️ **Important**: Never commit `.env` files to version control!

#### Step 4: Set Up API Keys in Supabase

API keys should be stored as **secrets** in Supabase, not in your app:

1. Go to **Edge Functions** in your Supabase dashboard
2. Click on **Secrets** tab
3. Add your API keys:

```bash
# Example: Google Docs API
GOOGLE_DOCS_API_KEY=your-google-docs-api-key
GOOGLE_DOCS_SERVICE_ACCOUNT={"type":"service_account",...}

# Example: Google Sheets API
GOOGLE_SHEETS_API_KEY=your-google-sheets-api-key

# Example: Any custom API
CUSTOM_API_KEY=your-custom-api-key
```

#### Step 5: Deploy Supabase Edge Functions

Install the Supabase CLI:
```bash
npm install -g supabase
```

Login to Supabase:
```bash
supabase login
```

Link your project:
```bash
supabase link --project-ref your-project-ref
```

Deploy the functions:
```bash
# Deploy Google Docs API function
supabase functions deploy google-docs-api

# Deploy secure API proxy function
supabase functions deploy secure-api-proxy
```

Set function secrets:
```bash
# Set Google Docs API key
supabase secrets set GOOGLE_DOCS_API_KEY=your-api-key

# Set service account (from JSON file)
supabase secrets set GOOGLE_DOCS_SERVICE_ACCOUNT="$(cat service-account.json)"
```

#### Step 6: Test Your Setup

Test the function locally:
```bash
# Start Supabase locally
supabase start

# Test the function
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/google-docs-api' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "action": "read",
    "documentId": "YOUR_DOCUMENT_ID"
  }'
```

Test in production:
```bash
curl -i --location --request POST 'https://your-project.supabase.co/functions/v1/google-docs-api' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "action": "read",
    "documentId": "YOUR_DOCUMENT_ID"
  }'
```

### Using Supabase Functions

#### From the Mobile App

**Example: Reading a Google Doc**
```typescript
import { readGoogleDoc } from '../lib/supabase';

async function loadDocument() {
  try {
    const doc = await readGoogleDoc('YOUR_DOCUMENT_ID');
    console.log('Document content:', doc);
  } catch (error) {
    console.error('Error reading document:', error);
  }
}
```

**Example: Creating a New Document**
```typescript
import { createGoogleDoc } from '../lib/supabase';

async function createNewDoc() {
  try {
    const doc = await createGoogleDoc('My New Document', {
      requests: [/* formatting requests */]
    });
    console.log('Created document:', doc.documentId);
  } catch (error) {
    console.error('Error creating document:', error);
  }
}
```

**Example: Generic API Proxy**
```typescript
import { callSecureApiProxy } from '../lib/supabase';

async function callExternalApi() {
  try {
    const result = await callSecureApiProxy({
      service: 'custom',
      endpoint: 'https://api.example.com/data',
      method: 'GET'
    });
    console.log('API response:', result);
  } catch (error) {
    console.error('Error calling API:', error);
  }
}
```

#### From the Backend

**Example: Using Supabase Service**
```typescript
import { callGoogleDocsApi } from './services/supabase';

async function syncToGoogleDoc(data: any) {
  try {
    const result = await callGoogleDocsApi({
      action: 'update',
      documentId: 'YOUR_DOCUMENT_ID',
      content: {
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: JSON.stringify(data, null, 2)
            }
          }
        ]
      }
    });
    return result;
  } catch (error) {
    console.error('Error syncing to Google Doc:', error);
    throw error;
  }
}
```

### Best Practices

#### Security Best Practices

1. **Never Expose API Keys in Frontend Code**
   - ❌ Don't: Store API keys in React components or mobile app code
   - ✅ Do: Store them in Supabase Edge Function secrets
   - ✅ Do: Access them only through Supabase functions

2. **Use Environment-Specific Keys**
   ```bash
   # Development
   GOOGLE_DOCS_API_KEY=dev-key-with-restrictions
   
   # Production
   GOOGLE_DOCS_API_KEY=prod-key-with-strict-restrictions
   ```

3. **Implement Rate Limiting**
   ```typescript
   // In your Edge Function
   const MAX_REQUESTS_PER_MINUTE = 10;
   // Add rate limiting logic
   ```

4. **Enable Row Level Security (RLS)**
   ```sql
   -- Example: Only allow authenticated users to access data
   ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;
   
   CREATE POLICY "Users can only access their own data"
   ON your_table
   FOR ALL
   USING (auth.uid() = user_id);
   ```

5. **Validate Input in Edge Functions**
   ```typescript
   // Validate and sanitize all inputs
   if (!documentId || typeof documentId !== 'string') {
     throw new Error('Invalid documentId');
   }
   ```

6. **Use Service-Specific API Keys**
   - Create separate API keys for each service (Google Docs, Sheets, etc.)
   - Restrict API keys to specific domains/IPs in the provider dashboard
   - Rotate keys regularly

7. **Monitor Usage**
   - Set up alerts in Supabase for unusual activity
   - Monitor Edge Function invocation logs
   - Track API usage in provider dashboards

#### Supabase Security Features

- **Built-in Authentication**: Use Supabase Auth for user management
- **Row Level Security (RLS)**: Fine-grained access control at database level
- **Realtime Subscriptions**: Secure WebSocket connections
- **Storage Security**: File upload restrictions and access controls
- **API Gateway**: Automatic request validation and CORS handling

#### Key Rotation Strategy

To rotate API keys without downtime:

1. Add new key as `GOOGLE_DOCS_API_KEY_NEW` in Supabase secrets
2. Update Edge Function to try new key first, fallback to old
3. Deploy updated function
4. Monitor for 24-48 hours
5. Remove old key from Supabase secrets
6. Update function to only use new key

#### Debugging

Enable detailed logging in Edge Functions:
```typescript
console.log('Function invoked with params:', params);
console.log('Environment check:', {
  hasApiKey: !!Deno.env.get('GOOGLE_DOCS_API_KEY')
});
```

View logs in Supabase:
1. Go to **Edge Functions**
2. Select your function
3. Click **Logs** tab

---

## Development Setup

### Prerequisites

- Node.js 18+ 
- PostgreSQL 15
- Expo CLI (`npm install -g @expo/cli`)
- Supabase CLI (`npm install -g supabase`)

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

### Mobile App Setup

```bash
cd mobile

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your configuration

# Start Expo development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

### Running with Supabase Locally

```bash
# Start Supabase local development
supabase start

# This will start:
# - PostgreSQL database
# - Auth server
# - Storage server
# - Edge Functions runtime

# Deploy functions locally
supabase functions serve

# Access Supabase Studio at:
# http://localhost:54323
```

---

## Deployment

### Backend Deployment (Google Cloud Run)

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

### Supabase Edge Functions Deployment

```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy google-docs-api
```

### Mobile App Deployment

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

---

## Project Structure

```
The586Dynasty/
├── backend/                  # Express.js API
│   ├── src/
│   │   ├── routes/          # API endpoints
│   │   ├── services/        # Business logic (including Supabase)
│   │   ├── db/              # Database queries
│   │   └── middleware/      # Express middleware
│   └── package.json
├── mobile/                   # React Native (Expo) app
│   ├── app/                 # Expo Router pages
│   ├── lib/                 # Utilities (including Supabase client)
│   └── package.json
├── supabase/                 # Supabase configuration
│   ├── functions/           # Edge Functions
│   │   ├── google-docs-api/ # Google Docs proxy
│   │   └── secure-api-proxy/# Generic API proxy
│   └── config.toml          # Supabase config
└── README.md
```

---

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is private and proprietary to The 586 Dynasty league.

---

## Support

For questions or issues:
- Open an issue on GitHub
- Contact the commissioner: brcarnag

---

## Security

If you discover a security vulnerability, please email security@the586dynasty.com (or contact the commissioner directly). Do not open a public issue.

---

**Built with ❤️ for The 586 Dynasty League**