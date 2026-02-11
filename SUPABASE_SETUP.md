# Supabase Setup Guide for The586Dynasty

This guide provides detailed, step-by-step instructions for setting up Supabase to securely manage API keys for The 586 Dynasty application.

## Table of Contents

1. [Why Supabase?](#why-supabase)
2. [Prerequisites](#prerequisites)
3. [Initial Setup](#initial-setup)
4. [Configuring API Keys](#configuring-api-keys)
5. [Deploying Edge Functions](#deploying-edge-functions)
6. [Frontend Integration](#frontend-integration)
7. [Backend Integration](#backend-integration)
8. [Testing](#testing)
9. [Production Deployment](#production-deployment)
10. [Troubleshooting](#troubleshooting)

---

## Why Supabase?

### The Security Problem

When building applications that integrate with third-party APIs (like Google Docs, external services, etc.), you need API keys. However:

- **❌ Problem**: Storing API keys in frontend/mobile code exposes them to anyone
- **❌ Problem**: Users can decompile your app and extract keys
- **❌ Problem**: Keys can be intercepted from network requests
- **❌ Problem**: Rotating keys requires app updates

### The Supabase Solution

Supabase Edge Functions act as a secure backend proxy:

- **✅ Solution**: API keys stored server-side only
- **✅ Solution**: Frontend calls your Supabase functions, not external APIs directly
- **✅ Solution**: Built-in authentication and authorization
- **✅ Solution**: Easy key rotation without client updates
- **✅ Solution**: Row Level Security (RLS) for fine-grained access control
- **✅ Solution**: Automatic HTTPS, CORS, and rate limiting

---

## Prerequisites

Before starting, ensure you have:

- [ ] A GitHub/Google account (for Supabase login)
- [ ] Node.js 18+ installed
- [ ] npm or yarn package manager
- [ ] Basic knowledge of JavaScript/TypeScript
- [ ] API keys you want to secure (e.g., Google Docs API key)

---

## Initial Setup

### Step 1: Create Supabase Account

1. Visit [https://supabase.com](https://supabase.com)
2. Click **"Start your project"**
3. Sign up with GitHub, Google, or email
4. Verify your email if required

### Step 2: Create a New Project

1. From the Supabase dashboard, click **"New Project"**
2. Fill in the project details:
   ```
   Organization: Choose existing or create new
   Project Name: The586Dynasty
   Database Password: [Generate a strong password - save this!]
   Region: [Choose closest to your users]
   Pricing Plan: Free (for development) or Pro (for production)
   ```
3. Click **"Create new project"**
4. Wait ~2 minutes for project provisioning

### Step 3: Access Project Credentials

Once your project is created:

1. Navigate to **Settings** (gear icon) → **API**
2. You'll see three important values:

   ```
   Project URL: https://xxxxxxxxxxxxx.supabase.co
   API Keys:
     - anon/public: eyJhbGc... (safe for frontend)
     - service_role: eyJhbGc... (KEEP SECRET!)
   ```

3. **Copy these values** - you'll need them shortly

### Step 4: Install Supabase CLI

The Supabase CLI lets you deploy Edge Functions and manage your project:

```bash
# Install globally
npm install -g supabase

# Verify installation
supabase --version
```

Expected output: `supabase 1.x.x`

### Step 5: Login to Supabase CLI

```bash
# Login (opens browser for authentication)
supabase login

# Verify login
supabase projects list
```

You should see your project listed.

### Step 6: Link Your Local Project

```bash
# Navigate to your project
cd /path/to/The586Dynasty

# Link to your Supabase project
supabase link --project-ref your-project-ref

# Your project-ref is found in Project Settings → General
```

---

## Configuring API Keys

### Understanding API Key Storage

API keys in Supabase are stored as **Edge Function Secrets**:

- Encrypted at rest
- Only accessible to Edge Functions at runtime
- Not visible in function code or logs
- Can be updated without redeploying functions

### Step 1: Obtain Your API Keys

Before adding keys to Supabase, you need to obtain them:

#### For Google Docs API:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable **Google Docs API**:
   - Navigate to **APIs & Services** → **Library**
   - Search for "Google Docs API"
   - Click **Enable**
4. Create credentials:
   - Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **API Key**
   - Copy the API key
   - Click **Restrict Key** and limit to Google Docs API only
5. For service account (optional but recommended):
   - Click **Create Credentials** → **Service Account**
   - Fill in details and click **Create**
   - Grant necessary roles
   - Go to **Keys** tab → **Add Key** → **Create new key** → **JSON**
   - Download the JSON file (keep it secret!)

#### For Google Sheets API:

Similar process - enable Google Sheets API and create API key.

### Step 2: Add Secrets to Supabase

#### Method 1: Using Supabase Dashboard (Recommended for beginners)

1. In Supabase dashboard, go to **Edge Functions**
2. Click **Settings** or **Secrets** tab
3. Click **Add secret**
4. Add each secret:
   ```
   Name: GOOGLE_DOCS_API_KEY
   Value: your-api-key-here
   ```
5. Click **Save**
6. Repeat for other secrets:
   - `GOOGLE_SHEETS_API_KEY`
   - `CUSTOM_API_KEY`
   - etc.

#### Method 2: Using Supabase CLI (Recommended for advanced users)

```bash
# Set a single secret
supabase secrets set GOOGLE_DOCS_API_KEY=your-api-key-here

# Set multiple secrets at once
supabase secrets set \
  GOOGLE_DOCS_API_KEY=your-docs-key \
  GOOGLE_SHEETS_API_KEY=your-sheets-key \
  CUSTOM_API_KEY=your-custom-key

# Set secret from file (for service accounts)
supabase secrets set GOOGLE_DOCS_SERVICE_ACCOUNT="$(cat service-account.json)"

# List all secrets (values hidden)
supabase secrets list
```

#### Method 3: Using .env File (Development Only)

For local development:

```bash
# Create supabase/.env.local
cd supabase
cat > .env.local << EOF
GOOGLE_DOCS_API_KEY=your-dev-api-key
GOOGLE_SHEETS_API_KEY=your-dev-sheets-key
EOF

# This file is automatically loaded by `supabase functions serve`
```

⚠️ **Never commit `.env.local` to version control!**

### Step 3: Verify Secrets

```bash
# List secrets (values are hidden for security)
supabase secrets list

# Expected output:
# NAME                          VALUE (HIDDEN)
# GOOGLE_DOCS_API_KEY          *************
# GOOGLE_SHEETS_API_KEY        *************
```

---

## Deploying Edge Functions

### Understanding Edge Functions

Edge Functions are serverless functions that run on Supabase's infrastructure:

- Written in TypeScript/JavaScript (Deno runtime)
- Run close to your users (edge network)
- Automatically scaled
- Access to secrets via environment variables

### Step 1: Review Function Code

The repository includes two Edge Functions:

1. **`google-docs-api`**: Specialized for Google Docs operations
   - Location: `supabase/functions/google-docs-api/index.ts`
   - Purpose: Read, write, create, update Google Docs

2. **`secure-api-proxy`**: Generic API proxy
   - Location: `supabase/functions/secure-api-proxy/index.ts`
   - Purpose: Proxy any HTTP API securely

### Step 2: Test Functions Locally

Before deploying, test locally:

```bash
# Start Supabase local environment
supabase start

# This starts:
# - PostgreSQL on localhost:54322
# - API Gateway on localhost:54321
# - Studio on localhost:54323
# - Edge Functions runtime

# In a new terminal, serve functions
supabase functions serve

# Test the google-docs-api function
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/google-docs-api' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "action": "read",
    "documentId": "YOUR_DOCUMENT_ID"
  }'
```

### Step 3: Deploy to Production

```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy google-docs-api

# Deploy with custom import map
supabase functions deploy google-docs-api --import-map supabase/functions/import_map.json
```

Expected output:
```
Deploying function google-docs-api...
Function URL: https://xxxxxxxxxxxxx.supabase.co/functions/v1/google-docs-api
Deployed successfully!
```

### Step 4: Verify Deployment

Test the deployed function:

```bash
curl -i --location --request POST 'https://your-project.supabase.co/functions/v1/google-docs-api' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "action": "read",
    "documentId": "YOUR_DOCUMENT_ID"
  }'
```

---

## Frontend Integration

### Step 1: Configure Environment Variables

Create `mobile/.env` (copy from `.env.example`):

```bash
cd mobile
cp .env.example .env
```

Edit `.env`:
```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Step 2: Install Supabase Client

Already done via `npm install @supabase/supabase-js`

### Step 3: Use in Your App

The repository includes `mobile/lib/supabase.ts` with helper functions:

```typescript
import { readGoogleDoc, createGoogleDoc } from '../lib/supabase';

// In your React component
async function handleLoadDocument() {
  try {
    const doc = await readGoogleDoc('your-document-id');
    console.log('Document loaded:', doc.title);
  } catch (error) {
    console.error('Error:', error);
    Alert.alert('Error', 'Failed to load document');
  }
}
```

### Example: Complete React Native Component

```typescript
import React, { useState } from 'react';
import { View, Button, Text, ActivityIndicator } from 'react-native';
import { readGoogleDoc } from '../lib/supabase';

export function DocumentViewer() {
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');

  const loadDocument = async () => {
    setLoading(true);
    try {
      const doc = await readGoogleDoc('YOUR_DOCUMENT_ID');
      setContent(doc.body.content);
    } catch (error) {
      console.error('Error loading document:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <Button title="Load Document" onPress={loadDocument} />
      {loading && <ActivityIndicator />}
      {content && <Text>{content}</Text>}
    </View>
  );
}
```

---

## Backend Integration

### Step 1: Configure Environment Variables

Create `backend/.env`:

```bash
cd backend
cp .env.example .env
```

Edit `.env`:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Step 2: Use Supabase Service

The repository includes `backend/src/services/supabase.ts`:

```typescript
import { callGoogleDocsApi } from './services/supabase';

// In your route handler
router.post('/sync-to-doc', async (req, res) => {
  try {
    const result = await callGoogleDocsApi({
      action: 'update',
      documentId: req.body.documentId,
      content: req.body.content
    });
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## Testing

### Unit Testing Edge Functions

Create a test file for your function:

```typescript
// supabase/functions/google-docs-api/test.ts
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

Deno.test("google-docs-api handles read action", async () => {
  const request = new Request("http://localhost:54321/functions/v1/google-docs-api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "read",
      documentId: "test-doc-id"
    })
  });

  // Test logic here
  assertEquals(true, true);
});
```

### Integration Testing

Test the complete flow:

```bash
# Test from mobile app
npm run test

# Test API endpoints
npm run test:integration
```

### Manual Testing Checklist

- [ ] Function deploys successfully
- [ ] Function accessible via URL
- [ ] API keys loaded correctly (check function logs)
- [ ] Frontend can call function
- [ ] Backend can call function
- [ ] Error handling works
- [ ] CORS configured correctly

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] All secrets configured in production
- [ ] Environment variables set correctly
- [ ] Functions tested locally
- [ ] Error handling implemented
- [ ] Rate limiting considered
- [ ] Monitoring/logging enabled
- [ ] API key restrictions set (IP, domain)
- [ ] Service account permissions minimal

### Deployment Steps

```bash
# 1. Deploy functions
supabase functions deploy

# 2. Set production secrets
supabase secrets set --project-ref prod-ref GOOGLE_DOCS_API_KEY=prod-key

# 3. Verify deployment
curl https://your-project.supabase.co/functions/v1/google-docs-api/health

# 4. Update mobile app environment
# Edit mobile/.env with production values

# 5. Build and deploy mobile app
cd mobile
eas build --platform all
```

### Post-Deployment Verification

1. Check function logs:
   - Supabase Dashboard → Edge Functions → Logs

2. Monitor usage:
   - Supabase Dashboard → Edge Functions → Metrics

3. Test in production:
   ```bash
   # Test with production URL
   curl -X POST https://your-project.supabase.co/functions/v1/google-docs-api \
     -H "Authorization: Bearer prod-anon-key" \
     -H "Content-Type: application/json" \
     -d '{"action":"read","documentId":"test"}'
   ```

---

## Troubleshooting

### Common Issues

#### Issue: "Supabase configuration missing"

**Cause**: Environment variables not set

**Solution**:
```bash
# Check if variables are set
echo $EXPO_PUBLIC_SUPABASE_URL

# If empty, create .env file
cd mobile
cat > .env << EOF
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EOF

# Restart Expo
npm start -- --reset-cache
```

#### Issue: "Function not found"

**Cause**: Function not deployed or wrong name

**Solution**:
```bash
# List deployed functions
supabase functions list

# Deploy function
supabase functions deploy google-docs-api
```

#### Issue: "API key not found" in function

**Cause**: Secret not set in Supabase

**Solution**:
```bash
# Set secret
supabase secrets set GOOGLE_DOCS_API_KEY=your-key

# Verify
supabase secrets list

# Redeploy function (not always needed, but helps)
supabase functions deploy google-docs-api
```

#### Issue: "CORS error" when calling function

**Cause**: Missing CORS headers in function

**Solution**: Already handled in provided function code. If custom function:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// In your function
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders })
}
```

#### Issue: "Unauthorized" error

**Cause**: Wrong or missing API key in request

**Solution**:
```bash
# Check you're using anon key (not service role) from frontend
# Verify in Supabase Dashboard → Settings → API

# In your request:
headers: {
  'Authorization': 'Bearer YOUR_ANON_KEY'
}
```

#### Issue: Function times out

**Cause**: Function takes too long (10s limit on free plan)

**Solution**:
- Optimize function code
- Upgrade to Pro plan (60s timeout)
- Use async patterns
- Cache responses

### Debugging Tips

1. **Check function logs**:
   ```bash
   # Stream logs
   supabase functions logs google-docs-api --tail
   ```

2. **Add console.log statements**:
   ```typescript
   console.log('API key present:', !!Deno.env.get('GOOGLE_DOCS_API_KEY'));
   console.log('Request params:', params);
   ```

3. **Test locally first**:
   ```bash
   supabase functions serve --debug
   ```

4. **Check Supabase status**:
   - Visit [status.supabase.com](https://status.supabase.com)

5. **Verify project limits**:
   - Supabase Dashboard → Settings → Billing

---

## Additional Resources

### Official Documentation

- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli/introduction)
- [Deno Deploy Docs](https://deno.com/deploy/docs)

### Tutorials

- [Building Serverless APIs with Supabase](https://supabase.com/docs/guides/functions/quickstart)
- [Securing API Keys](https://supabase.com/docs/guides/functions/secrets)

### Community

- [Supabase Discord](https://discord.supabase.com)
- [Supabase GitHub](https://github.com/supabase/supabase)

---

## Next Steps

After completing this setup:

1. ✅ Migrate existing API calls to use Supabase functions
2. ✅ Implement authentication with Supabase Auth
3. ✅ Set up Row Level Security (RLS) for database
4. ✅ Configure realtime subscriptions for live updates
5. ✅ Set up monitoring and alerting
6. ✅ Plan for API key rotation schedule

---

**Questions or issues?** Open an issue on GitHub or contact the maintainer.

**Security concerns?** Email security@the586dynasty.com

---

*Last updated: February 2026*
