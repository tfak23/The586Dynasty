# Architecture: Secure API Key Storage

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                        CLIENT (Browser/App)                         │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  React Native / Expo App                                    │   │
│  │                                                              │   │
│  │  - No API keys stored                                       │   │
│  │  - Only Supabase URL & anon key (public, safe)            │   │
│  │  - Calls Edge Functions via Supabase client               │   │
│  └──────────────────────┬───────────────────────────────────────┘   │
│                         │                                           │
└─────────────────────────┼───────────────────────────────────────────┘
                          │
                          │ HTTPS Request
                          │ (documentId only, no API keys)
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                        SUPABASE PLATFORM                            │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Edge Functions (Serverless)                                │   │
│  │                                                              │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │  google-docs-read Function                           │  │   │
│  │  │                                                       │  │   │
│  │  │  • Receives: documentId, operation                   │  │   │
│  │  │  • Accesses: GOOGLE_DOCS_API_KEY (from env vars)    │  │   │
│  │  │  • Validates input                                   │  │   │
│  │  │  • Makes secure API call                             │  │   │
│  │  │  • Returns: processed data                           │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  │                                                              │   │
│  └──────────────────────┬───────────────────────────────────────┘   │
│                         │                                           │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Environment Variables (Secure Storage)                     │   │
│  │                                                              │   │
│  │  • GOOGLE_DOCS_API_KEY = "xxx..."                          │   │
│  │  • Other sensitive keys...                                  │   │
│  │                                                              │   │
│  │  ⚠️  Never exposed to client!                               │   │
│  └──────────────────────┬───────────────────────────────────────┘   │
│                         │                                           │
└─────────────────────────┼───────────────────────────────────────────┘
                          │
                          │ API Request with Key
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                     GOOGLE DOCS API                                 │
│                                                                     │
│  • Receives authenticated request from Supabase                    │
│  • Returns document data                                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow: Reading a Google Doc

### Old Way (Insecure) ❌

```
┌───────────┐
│  Browser  │
└─────┬─────┘
      │ Contains: EXPO_PUBLIC_GOOGLE_DOCS_API_KEY
      │ ⚠️ API key exposed in client code!
      │
      │ fetch('https://docs.googleapis.com/...?key=xxx')
      │
      ▼
┌──────────────────┐
│  Google Docs API │
└──────────────────┘
```

**Problems:**
- API key visible in browser DevTools
- Key exposed in network requests
- Can be extracted and misused
- No rate limiting control
- No input validation

### New Way (Secure) ✅

```
┌───────────┐
│  Browser  │
└─────┬─────┘
      │ Contains: Only Supabase URL & anon key (public, safe)
      │ No sensitive API keys!
      │
      │ supabase.functions.invoke('google-docs-read', {
      │   body: { documentId: 'abc123', operation: 'read' }
      │ })
      │
      ▼
┌─────────────────────┐
│  Supabase Platform  │
│                     │
│  Edge Function:     │
│  - Gets API key     │
│    from env vars    │
│  - Validates input  │
│  - Makes API call   │
│  - Returns data     │
└─────────┬───────────┘
          │
          │ fetch('https://docs.googleapis.com/...?key=SECRET_KEY')
          │ ✅ API key only on server!
          │
          ▼
┌──────────────────┐
│  Google Docs API │
└──────────────────┘
```

**Benefits:**
- API key never leaves server
- Client only sends document ID
- Server-side validation
- Rate limiting possible
- Centralized error handling
- Audit logging possible

## Security Comparison

| Aspect | Client-Side API Key ❌ | Edge Function ✅ |
|--------|----------------------|-----------------|
| **Key Storage** | Environment variable in client | Supabase environment variable |
| **Key Exposure** | Visible in browser/app | Hidden on server |
| **Network Visibility** | Key in URL/headers | Key only on server |
| **Developer Tools** | Key visible in DevTools | Key not accessible |
| **Decompilation Risk** | Key in compiled app | Key not in app |
| **Rate Limiting** | Hard to implement | Easy to implement |
| **Input Validation** | Client-side only | Server-side enforced |
| **Audit Logging** | Limited | Full logging possible |
| **Key Rotation** | Requires app redeployment | Update env var only |
| **Cost Control** | None | Can implement quotas |

## Component Interactions

### Setup Phase (One-time)

```
Developer                Supabase Dashboard           Edge Function
    │                          │                           │
    │─────(1) Create Project───▶                          │
    │                          │                           │
    │──(2) Set API Key Env Var─▶                          │
    │     (GOOGLE_DOCS_API_KEY)│                           │
    │                          │                           │
    │─────(3) Deploy Function──────────────────────────────▶
    │                          │      (reads env var)      │
    │                          │                           │
    │◀────(4) Function URL─────┴───────────────────────────┘
    │     (auto-configured in SDK)
    │
```

### Runtime Phase (Every Request)

```
User Action              Frontend                  Edge Function            Google API
    │                       │                           │                       │
    │──(1) Click Import────▶│                           │                       │
    │                       │                           │                       │
    │                       │──(2) Invoke Function──────▶                       │
    │                       │   { documentId: 'abc' }   │                       │
    │                       │                           │                       │
    │                       │                           │──(3) Get API Key──────│
    │                       │                           │   from env vars       │
    │                       │                           │                       │
    │                       │                           │──(4) API Request──────▶
    │                       │                           │   with key            │
    │                       │                           │                       │
    │                       │                           │◀─(5) Document Data────┤
    │                       │                           │                       │
    │                       │◀─(6) Processed Data───────┤                       │
    │                       │   { success: true, ... }  │                       │
    │                       │                           │                       │
    │◀─(7) Display Data─────┤                           │                       │
    │                       │                           │                       │
```

## File Organization

```
The586Dynasty/
│
├── mobile/
│   ├── lib/
│   │   ├── supabase.ts          # Supabase client config
│   │   ├── supabaseApi.ts       # API helpers (includes Edge Function calls)
│   │   └── googleDocs.ts        # Google Docs functions (uses Edge Functions)
│   │
│   └── .env.example             # Environment variables guide
│
├── supabase/
│   ├── functions/
│   │   └── google-docs-read/
│   │       └── index.ts         # ✅ Edge Function (handles API key)
│   │
│   ├── config.toml              # Supabase configuration
│   ├── README.md                # Supabase setup guide
│   ├── EDGE_FUNCTIONS_DEPLOYMENT.md  # Deployment guide
│   └── test-functions-local.sh  # Local testing script
│
├── README.md                    # Main documentation (with security guide)
├── SECURE_API_EXAMPLES.md       # Code examples
└── IMPLEMENTATION_SUMMARY_SECURE_API.md  # This implementation

```

## Key Principles

### 1. Separation of Concerns
- **Frontend**: User interface, data display
- **Edge Function**: Business logic, API integration
- **Supabase**: Secure storage, execution environment

### 2. Principle of Least Privilege
- Client has minimal permissions (anon key)
- Edge Function has full permissions (env vars)
- User never sees sensitive data

### 3. Defense in Depth
- Multiple security layers:
  1. Environment variables (not in code)
  2. Server-side execution (not client)
  3. Input validation (reject bad data)
  4. Error handling (don't leak info)
  5. CORS headers (restrict origins)
  6. RLS policies (optional, additional layer)

### 4. Zero Trust Architecture
- Never trust client input
- Always validate on server
- Assume client can be compromised
- Keep secrets on server only

## Future Enhancements

### Potential Additions

1. **Authentication**
   - Require user login via Supabase Auth
   - Tie API usage to user accounts
   - Implement per-user rate limits

2. **Advanced Rate Limiting**
   ```typescript
   // In Edge Function
   const userId = auth.user.id;
   const key = `ratelimit:${userId}`;
   const requests = await redis.incr(key);
   if (requests > 10) throw new Error('Rate limit exceeded');
   ```

3. **Caching Layer**
   - Cache frequently accessed documents
   - Reduce API calls to Google
   - Save costs and improve performance

4. **Monitoring & Alerts**
   - Track API usage
   - Alert on unusual patterns
   - Monitor costs

5. **Additional Edge Functions**
   - `sleeper-api` - Sleeper API integration
   - `calculate-cap` - Complex calculations
   - `process-trade` - Trade workflows
   - `advance-season` - Season management

## Conclusion

This architecture provides:
- ✅ **Security**: API keys never exposed
- ✅ **Scalability**: Serverless functions auto-scale
- ✅ **Maintainability**: Centralized API logic
- ✅ **Cost-effective**: Runs on free tier
- ✅ **Developer-friendly**: Clear patterns and examples
- ✅ **Future-proof**: Easy to extend

The implementation follows industry best practices and provides a solid foundation for secure API key management in modern web applications.
