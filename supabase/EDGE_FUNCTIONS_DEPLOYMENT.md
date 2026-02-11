# Edge Functions Deployment Guide

This guide explains how to deploy and manage Supabase Edge Functions for secure API key handling.

## Prerequisites

- Supabase account (free tier is fine)
- Node.js 16+ installed
- A Supabase project created

## Installation

### 1. Install Supabase CLI

```bash
# macOS / Linux
npm install -g supabase

# Verify installation
supabase --version
```

### 2. Login to Supabase

```bash
supabase login
```

This will open a browser window for authentication.

## Setup

### 3. Link Your Project

```bash
# From the project root directory
cd The586Dynasty

# Link to your Supabase project
supabase link --project-ref YOUR_PROJECT_REF
```

**Finding your project ref:**
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **General**
4. Copy the **Reference ID**

### 4. Set Environment Variables

Before deploying, set your API keys in the Supabase Dashboard:

1. Go to **Settings** → **Edge Functions**
2. Scroll to **Environment Variables** or **Secrets**
3. Click **Add secret** or **New secret**
4. Add the following:

| Name | Value | Description |
|------|-------|-------------|
| `GOOGLE_DOCS_API_KEY` | Your Google API key | For Google Docs integration |

**To get a Google Docs API key:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project (or select existing)
3. Enable Google Docs API
4. Create credentials → API Key
5. Restrict the key to Google Docs API only

## Deployment

### 5. Deploy All Functions

```bash
# Deploy all Edge Functions
supabase functions deploy
```

### 6. Deploy a Specific Function

```bash
# Deploy just the google-docs-read function
supabase functions deploy google-docs-read
```

**Expected output:**
```
Deploying google-docs-read (project ref: abc123...)
Bundled google-docs-read in 125ms
✓ Deployed google-docs-read function
Function URL: https://abc123.supabase.co/functions/v1/google-docs-read
```

## Testing

### Test Deployed Function

```bash
# Replace with your actual values
PROJECT_REF="your-project-ref"
ANON_KEY="your-anon-key"
DOC_ID="valid-google-doc-id"

curl -i --location --request POST \
  "https://${PROJECT_REF}.supabase.co/functions/v1/google-docs-read" \
  --header "Authorization: Bearer ${ANON_KEY}" \
  --header "Content-Type: application/json" \
  --data "{\"documentId\":\"${DOC_ID}\",\"operation\":\"read\"}"
```

## Local Development

### Run Functions Locally

```bash
# Start Supabase locally (includes Edge Functions)
supabase start

# In another terminal, serve functions
supabase functions serve google-docs-read

# Test locally
curl -i --location --request POST \
  'http://localhost:54321/functions/v1/google-docs-read' \
  --header 'Authorization: Bearer eyJ...' \
  --header 'Content-Type: application/json' \
  --data '{"documentId":"test-id","operation":"read"}'
```

### Local Environment Variables

For local testing, create `.env` file in `supabase/functions/google-docs-read/`:

```bash
GOOGLE_DOCS_API_KEY=your-key-here
```

**⚠️ Important:** Add `.env` to `.gitignore`!

## Monitoring

### View Function Logs

1. Go to Supabase Dashboard
2. Navigate to **Edge Functions**
3. Click on **google-docs-read**
4. View **Logs** tab for real-time logs

### Check Function Status

```bash
# List all functions
supabase functions list

# Check function details
supabase functions inspect google-docs-read
```

## Updating Functions

### After Code Changes

```bash
# Re-deploy the function
supabase functions deploy google-docs-read

# Or use --no-verify-jwt for faster deployment (dev only)
supabase functions deploy google-docs-read --no-verify-jwt
```

## Troubleshooting

### Function Returns 404

**Problem:** `Function not found`

**Solution:**
1. Check function is deployed: `supabase functions list`
2. Verify project is linked: `supabase projects list`
3. Re-deploy: `supabase functions deploy google-docs-read`

### Environment Variable Not Available

**Problem:** `GOOGLE_DOCS_API_KEY is not set`

**Solution:**
1. Set in Supabase Dashboard → Settings → Edge Functions
2. Wait 1-2 minutes for propagation
3. Re-deploy function: `supabase functions deploy google-docs-read`

### CORS Errors

**Problem:** Browser shows CORS errors

**Solution:**
1. Ensure Edge Function has correct CORS headers (already included)
2. Check you're using POST method (not GET)
3. Verify `Authorization` header is included

### API Key Invalid

**Problem:** `Failed to fetch document from Google Docs API`

**Solution:**
1. Verify API key in Google Cloud Console
2. Ensure Google Docs API is enabled
3. Check API key restrictions (IP, domain, API)
4. Update key in Supabase Dashboard

## CI/CD Integration

### GitHub Actions

Add to `.github/workflows/deploy-functions.yml`:

```yaml
name: Deploy Edge Functions

on:
  push:
    branches: [main]
    paths:
      - 'supabase/functions/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Supabase CLI
        run: npm install -g supabase
      
      - name: Deploy functions
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          PROJECT_REF: ${{ secrets.SUPABASE_PROJECT_REF }}
        run: |
          supabase link --project-ref $PROJECT_REF
          supabase functions deploy
```

**Setup secrets:**
1. Create a Supabase access token: Dashboard → Account → Access Tokens
2. Add to GitHub: Settings → Secrets → Actions
   - `SUPABASE_ACCESS_TOKEN`
   - `SUPABASE_PROJECT_REF`

## Best Practices

1. **Always test locally before deploying**
   ```bash
   supabase functions serve
   # Test thoroughly
   supabase functions deploy
   ```

2. **Use environment variables for all secrets**
   - Never hardcode API keys
   - Set in Supabase Dashboard only

3. **Monitor function usage**
   - Check logs regularly
   - Set up alerts for errors
   - Monitor quotas (Supabase and external APIs)

4. **Version control**
   - Commit function code to git
   - Never commit `.env` files
   - Document environment variables needed

5. **Security**
   - Validate all inputs
   - Implement rate limiting
   - Use RLS policies
   - Restrict CORS if possible

## Additional Resources

- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)
- [Deno Documentation](https://deno.land/manual)
- [Google Docs API Documentation](https://developers.google.com/docs/api)

## Support

If you encounter issues:

1. Check Supabase Edge Functions logs
2. Review this guide's troubleshooting section
3. Check [Supabase Discord](https://discord.supabase.com)
4. Open an issue in this repository
