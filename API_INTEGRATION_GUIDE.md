# API Integration Guide

This document explains how the app's API layer works and how to switch between different backends.

## Architecture Overview

The app supports two backend options:

1. **Supabase** (Recommended for GitHub Pages) - Serverless PostgreSQL with REST API
2. **Express Backend** (Original) - Custom Node.js API with PostgreSQL

## API Modules

### 1. Core API (`mobile/lib/api.ts`)
- Original API client using axios
- REST endpoints for all operations
- Connects to Express.js backend
- Used with traditional deployment

### 2. Supabase API (`mobile/lib/supabaseApi.ts`)
- New API client using Supabase SDK
- Direct database queries
- Edge Functions for complex operations
- Used with GitHub Pages deployment

### 3. Supabase Client (`mobile/lib/supabase.ts`)
- Supabase initialization and configuration
- Database type definitions
- Authentication setup (for future use)

### 4. Google Docs API (`mobile/lib/googleDocs.ts`)
- Read Google Docs content
- Parse tables from documents
- Extract text and data
- Write support (requires OAuth 2.0)

## Using the APIs

### Default Configuration (Axios + Express)

```typescript
import { getLeagues, getTeams } from '@/lib/api';

// Use as normal
const leagues = await getLeagues();
const teams = await getTeams(leagueId);
```

### Switching to Supabase

**Option 1: Import from Supabase API directly**
```typescript
import { getLeagues, getTeams } from '@/lib/supabaseApi';

// Same interface, different implementation
const leagues = await getLeagues();
const teams = await getTeams(leagueId);
```

**Option 2: Create an API switcher**
```typescript
// mobile/lib/apiClient.ts
const USE_SUPABASE = process.env.EXPO_PUBLIC_USE_SUPABASE === 'true';

export * from USE_SUPABASE ? './supabaseApi' : './api';
```

Then use:
```typescript
import { getLeagues, getTeams } from '@/lib/apiClient';
```

### Using Google Docs

```typescript
import { readGoogleDoc, extractTextFromDoc, parseDocAsTable } from '@/lib/googleDocs';

// Read a Google Doc
const docId = '1a2b3c...'; // From URL
const result = await readGoogleDoc(docId);

if (result.success) {
  // Extract plain text
  const text = extractTextFromDoc(result.data);
  
  // Parse tables
  const tableData = parseDocAsTable(result.data);
  console.log(tableData); // Array of rows
}
```

## API Compatibility Matrix

| Feature | Axios API | Supabase API | Status |
|---------|-----------|--------------|--------|
| Leagues | ✅ | ✅ | Full parity |
| Teams | ✅ | ✅ | Full parity |
| Contracts | ✅ | ✅ | Full parity |
| Players | ✅ | ✅ | Full parity |
| Trades | ✅ | ✅ | Full parity |
| Stats Sync | ✅ | 🔄 | Needs Edge Function |
| Sleeper Sync | ✅ | 🔄 | Needs Edge Function |
| Cap Calculations | ✅ | 🔄 | Needs Edge Function |
| Trade Processing | ✅ | 🔄 | Needs Edge Function |

✅ = Fully implemented  
🔄 = Requires Edge Function (see below)

## Complex Operations with Edge Functions

Some operations require backend logic and should be moved to Supabase Edge Functions:

### 1. Sleeper Sync
**Current**: Backend API endpoint  
**Future**: Edge Function

```typescript
// supabase/functions/sync-sleeper/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const { leagueId } = await req.json()
  
  // Fetch from Sleeper API
  const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`)
  const data = await response.json()
  
  // Update Supabase tables
  // ... sync logic
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

Deploy:
```bash
supabase functions deploy sync-sleeper
```

Use in app:
```typescript
import { callEdgeFunction } from '@/lib/supabaseApi';

const result = await callEdgeFunction('sync-sleeper', { leagueId });
```

### 2. Cap Calculations
**Current**: Backend calculations  
**Future**: Edge Function or Database Function

```sql
-- Database function approach
CREATE OR REPLACE FUNCTION calculate_team_cap(team_uuid UUID)
RETURNS TABLE (
  total_salary DECIMAL,
  cap_room DECIMAL,
  active_contracts INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(salary), 0) as total_salary,
    500 - COALESCE(SUM(salary), 0) as cap_room,
    COUNT(*)::INT as active_contracts
  FROM contracts
  WHERE team_id = team_uuid
  AND status = 'active';
END;
$$ LANGUAGE plpgsql;
```

Use:
```typescript
const { data } = await supabase.rpc('calculate_team_cap', { team_uuid: teamId });
```

### 3. Trade Processing
**Current**: Backend validation and execution  
**Future**: Edge Function with transactions

```typescript
// supabase/functions/process-trade/index.ts
serve(async (req) => {
  const { tradeId, approve, teamId } = await req.json()
  
  // Use Supabase transaction
  const { data, error } = await supabase.rpc('process_trade', {
    trade_uuid: tradeId,
    approving_team: teamId,
    is_approved: approve
  })
  
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

## Environment Configuration

### For Express Backend
```bash
EXPO_PUBLIC_API_URL=https://your-api.run.app
```

### For Supabase
```bash
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
```

### For Google Docs
```bash
EXPO_PUBLIC_GOOGLE_DOCS_API_KEY=AIzaSy...
```

## Migration Strategy

### Phase 1: Dual Backend (Current)
- Keep both APIs available
- Use Express for complex operations
- Use Supabase for simple CRUD

### Phase 2: Transition
- Create Edge Functions for complex operations
- Update components to use Supabase API
- Test thoroughly

### Phase 3: Full Supabase
- Remove Express backend dependency
- Update all API calls to Supabase
- Deploy only to GitHub Pages

## Performance Considerations

### Axios API (Express)
- **Pros**: Full control, custom logic, batch operations
- **Cons**: Requires server, cold starts, costs

### Supabase API
- **Pros**: Serverless, auto-scaling, free tier, realtime
- **Cons**: Query complexity limits, needs Edge Functions for logic

### Best Practices

1. **Use Supabase for**:
   - Simple CRUD operations
   - Direct database queries
   - Real-time subscriptions

2. **Use Edge Functions for**:
   - Complex calculations
   - External API calls
   - Multi-step transactions
   - Validation logic

3. **Use Google Docs for**:
   - Data import from shared documents
   - League history archives
   - Commissioner reports

## Debugging

### Check which API is being used
```typescript
console.log('API URL:', process.env.EXPO_PUBLIC_API_URL);
console.log('Supabase URL:', process.env.EXPO_PUBLIC_SUPABASE_URL);
```

### Enable Supabase debugging
```typescript
import { supabase } from '@/lib/supabase';

// Log all queries
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth event:', event, session);
});
```

### Check Google Docs API
```typescript
import { isGoogleDocsConfigured } from '@/lib/googleDocs';

if (!isGoogleDocsConfigured()) {
  console.warn('Google Docs API key not configured');
}
```

## Testing

### Test Supabase Connection
```typescript
import { supabase } from '@/lib/supabase';

const testConnection = async () => {
  const { data, error } = await supabase.from('leagues').select('count');
  console.log('Supabase test:', data, error);
};
```

### Test API Parity
```typescript
// Test both APIs return same data structure
const axiosLeagues = await api.getLeagues();
const supabaseLeagues = await supabaseApi.getLeagues();

console.assert(
  JSON.stringify(axiosLeagues) === JSON.stringify(supabaseLeagues),
  'API parity check failed'
);
```

## Resources

- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Google Docs API](https://developers.google.com/docs/api)
- [Expo Environment Variables](https://docs.expo.dev/guides/environment-variables/)
