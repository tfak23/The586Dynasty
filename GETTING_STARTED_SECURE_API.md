# Getting Started: Secure API Key Storage

This quick guide helps you get started with the secure API key implementation.

## 🚀 For Users Setting Up the App

### Step 1: Create Supabase Project
1. Go to [https://supabase.com](https://supabase.com)
2. Sign in and click "New Project"
3. Name your project (e.g., "The 586 Dynasty")
4. Save your database password securely
5. Wait ~2 minutes for project creation

### Step 2: Set API Key in Supabase
1. In Supabase Dashboard, go to **Settings** → **Edge Functions**
2. Click "Add secret" or "New secret"
3. Add:
   - **Name:** `GOOGLE_DOCS_API_KEY`
   - **Value:** Your Google Docs API key
4. Click "Save"

### Step 3: Deploy Edge Functions
```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link your project (get project-ref from Supabase Dashboard)
supabase link --project-ref your-project-ref

# Deploy the function
supabase functions deploy google-docs-read
```

### Step 4: Configure Frontend
1. Copy `mobile/.env.example` to `mobile/.env.local`
2. Add your Supabase credentials:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
3. **DO NOT** add `EXPO_PUBLIC_GOOGLE_DOCS_API_KEY` (it's now on the server!)

### Step 5: Test
```bash
cd mobile
npm install
npm run web
```

✅ **Done!** Your app now securely uses the Google Docs API.

---

## 📖 For Developers Learning the System

### Key Files to Understand

1. **Edge Function (Server-Side)**
   - `supabase/functions/google-docs-read/index.ts`
   - Handles API calls securely
   - Reads API key from environment variables

2. **Frontend Integration**
   - `mobile/lib/googleDocs.ts`
   - Updated to call Edge Functions
   - No API keys in client code

3. **API Helpers**
   - `mobile/lib/supabaseApi.ts`
   - Convenient wrapper functions

### Architecture Overview

```
Client App ─────► Supabase Edge Function ─────► Google Docs API
(no API key)      (has API key)                  (receives request)
```

### Documentation Guide

| Document | Purpose | When to Read |
|----------|---------|-------------|
| [README.md](README.md#-secure-api-key-management-guide) | Complete setup guide | First time setup |
| [SECURE_API_EXAMPLES.md](SECURE_API_EXAMPLES.md) | Code patterns | When coding |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design | Understanding architecture |
| [supabase/EDGE_FUNCTIONS_DEPLOYMENT.md](supabase/EDGE_FUNCTIONS_DEPLOYMENT.md) | Deployment details | Deploying functions |

---

## 🔧 Local Development

### Test Edge Functions Locally

```bash
# Start Supabase locally
supabase start

# In another terminal, serve functions
supabase functions serve google-docs-read

# Test with curl
curl -i --location --request POST \
  'http://localhost:54321/functions/v1/google-docs-read' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"documentId":"your-doc-id","operation":"read"}'
```

Or use the provided script:
```bash
./supabase/test-functions-local.sh
```

---

## 🐛 Troubleshooting

### Function Not Found
- Run: `supabase functions list`
- Deploy: `supabase functions deploy google-docs-read`

### API Key Not Working
- Check it's set in Supabase Dashboard → Settings → Edge Functions
- Re-deploy function after setting: `supabase functions deploy google-docs-read`

### CORS Errors
- Edge Function already has CORS headers
- Check you're using POST method
- Verify Authorization header is included

### Need More Help?
See the [Troubleshooting](README.md#troubleshooting-api-keys) section in README.md

---

## 🎓 Learn More

### Beginner Path
1. Read: [README.md Security Guide](README.md#-secure-api-key-management-guide)
2. Follow: Basic Setup steps
3. Deploy: Your first Edge Function
4. Test: Using provided examples

### Advanced Path
1. Study: [ARCHITECTURE.md](ARCHITECTURE.md)
2. Review: [SECURE_API_EXAMPLES.md](SECURE_API_EXAMPLES.md)
3. Implement: Custom Edge Functions
4. Optimize: Rate limiting, caching

### Reference Materials
- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Deno Documentation](https://deno.land/manual)
- [Google Docs API Docs](https://developers.google.com/docs/api)

---

## ✅ Success Checklist

Before going to production:

- [ ] Supabase project created
- [ ] API key set in Supabase environment variables
- [ ] Edge Functions deployed
- [ ] Frontend configured with Supabase credentials
- [ ] Local testing completed
- [ ] No API keys in client code
- [ ] Documentation reviewed
- [ ] Error handling tested

---

## 💡 Tips

1. **Never commit API keys** to git
2. **Use Edge Functions** for all sensitive operations
3. **Test locally first** before deploying to production
4. **Monitor logs** in Supabase Dashboard
5. **Rotate keys regularly** for security

---

## 🚀 Next Steps

After basic setup:

1. **Enable RLS** - Add Row Level Security policies
2. **Add Authentication** - Require user login
3. **Implement Rate Limiting** - Prevent abuse
4. **Set Up Monitoring** - Track usage and errors
5. **Create More Functions** - For other APIs

See [README.md](README.md) for detailed guides on all these topics!

---

**Questions?** Check the main [README.md](README.md) or [open an issue](https://github.com/tfak23/The586Dynasty/issues).
