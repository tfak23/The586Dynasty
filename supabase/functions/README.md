# Supabase Edge Functions Configuration

This directory contains serverless Edge Functions that handle sensitive operations securely on the server side.

## Functions

### google-docs-read

Securely reads from Google Docs API without exposing the API key to the client.

**Environment Variables Required:**
- `GOOGLE_DOCS_API_KEY` - Google Docs API key (set in Supabase dashboard)

**Request:**
```json
{
  "documentId": "your-document-id",
  "operation": "read" | "extractText" | "parseTable"
}
```

**Response:**
```json
{
  "success": true,
  "data": { ... }
}
```

## Deployment

To deploy these functions to your Supabase project:

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Deploy all functions
supabase functions deploy

# Or deploy a specific function
supabase functions deploy google-docs-read
```

## Setting Environment Variables

1. Go to your Supabase project dashboard
2. Navigate to **Settings** > **Edge Functions**
3. Add your environment variables:
   - `GOOGLE_DOCS_API_KEY` = Your Google Docs API key

## Local Development

To test functions locally:

```bash
# Start local Supabase
supabase start

# Serve functions locally
supabase functions serve

# Test with curl
curl -i --location --request POST 'http://localhost:54321/functions/v1/google-docs-read' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"documentId":"your-doc-id","operation":"read"}'
```

## Security Notes

- API keys are stored securely in Supabase environment variables
- Never commit API keys to version control
- Use Row Level Security (RLS) policies to restrict function access if needed
- Monitor function usage in the Supabase dashboard
