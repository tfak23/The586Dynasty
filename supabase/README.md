# Supabase Setup for The 586 Dynasty

This directory contains the database schema and configuration for deploying The 586 Dynasty to Supabase.

## Quick Start

1. **Create a Supabase Project**
   - Go to https://supabase.com
   - Sign in and create a new project
   - Save your database password securely

2. **Run the Migration**
   - In Supabase Dashboard, go to SQL Editor
   - Copy contents of `migrations/20260211_initial_schema.sql`
   - Paste and execute in SQL Editor

3. **Get API Credentials**
   - Go to Project Settings > API
   - Copy Project URL and anon/public key
   - Add these to your GitHub Secrets or .env.local

4. **Configure Row Level Security (Optional)**
   - See `rls-policies.sql` for security policies
   - For now, the app allows all operations

## Schema Overview

The database includes the following main tables:

- **leagues**: Fantasy league configurations
- **teams**: Team information linked to Sleeper rosters
- **players**: Player database cached from Sleeper
- **contracts**: Player contracts with salary and years
- **trades**: Trade proposals and history
- **draft_picks**: Draft pick tracking
- **trade_assets**: Items included in trades
- **player_stats**: Weekly fantasy scoring data
- **league_history**: Historical owner statistics
- **buy_ins**: League fee tracking

## Edge Functions (Optional)

For complex backend logic, you can create Supabase Edge Functions:

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Create an edge function
supabase functions new sync-league

# Deploy edge functions
supabase functions deploy
```

Example edge functions to create:
- `sync-league`: Sync data from Sleeper API
- `calculate-cap`: Calculate team salary cap
- `process-trade`: Handle trade approvals
- `advance-season`: End season and roll over contracts

## Realtime Subscriptions (Optional)

Enable realtime updates for live data:

```typescript
const subscription = supabase
  .channel('trades')
  .on('postgres_changes', 
    { event: 'INSERT', schema: 'public', table: 'trades' },
    (payload) => {
      console.log('New trade:', payload);
    }
  )
  .subscribe();
```

## Backup and Restore

### Backup
```bash
# Using Supabase CLI
supabase db dump -f backup.sql
```

### Restore
```bash
# In Supabase SQL Editor
# Paste contents of backup.sql and execute
```

## Cost Estimation

Supabase Free Tier includes:
- 500 MB database space
- 5 GB bandwidth per month
- 2 GB file storage
- Unlimited API requests

For a fantasy league app:
- Database: ~50-100 MB (enough for 10+ years of data)
- Bandwidth: ~1-2 GB/month (12 active users)
- **Cost: FREE**

Pro tier ($25/month) if you need:
- More database space
- Higher bandwidth
- Realtime with more concurrent connections

## Migration from PostgreSQL

If migrating from an existing PostgreSQL backend:

1. Export data:
   ```bash
   pg_dump -h <old-host> -U <user> -d <database> -t leagues --data-only > leagues.sql
   # Repeat for other tables
   ```

2. Import to Supabase:
   - In Supabase SQL Editor
   - Paste the SQL and execute
   - Or use CSV import in Table Editor

## Security Best Practices

1. **Never expose your service role key** - only use anon key in client
2. **Enable RLS** when you add authentication
3. **Use API key restrictions** in Google Cloud Console
4. **Rotate keys** periodically
5. **Monitor usage** in Supabase dashboard

## Troubleshooting

### Connection Issues
- Verify project URL is correct
- Check anon key is not expired
- Ensure database is not paused (free tier pauses after inactivity)

### Query Performance
- Add indexes on frequently queried columns
- Use `.select('*')` sparingly - only fetch needed columns
- Enable query explain in Supabase dashboard

### Data Issues
- Check RLS policies aren't blocking operations
- Verify foreign key relationships
- Look at Supabase logs for errors

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase JS Client](https://supabase.com/docs/reference/javascript/introduction)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
