# The 586 Dynasty - Fantasy Football Salary Cap Manager

A web app for dynasty fantasy football leagues with full salary cap management, multi-year contracts, franchise tags, trades, and Sleeper integration. Built with React Native (Expo) and powered by Supabase.

**Live App:** [tfak23.github.io/The586Dynasty](https://tfak23.github.io/The586Dynasty/)

## How It Works

The 586 Dynasty helps dynasty league commissioners and owners manage a salary cap system on top of their Sleeper league. Here's what the app does:

### For League Owners

- **View your roster** with each player's contract details (salary, years remaining, dead cap)
- **See your cap situation** including roster salary, dead money, and available cap room
- **5-year cap projections** so you can plan ahead for expiring contracts and future cap space
- **Propose trades** that include players (with their contracts), draft picks, and cap space — the app handles all the cap math automatically
- **Vote on trades** if your league uses a voting system, or accept/reject trades directly
- **View contract evaluations** that rate each contract as LEGENDARY, STEAL, CORNERSTONE, GOOD, or BUST based on player performance vs. salary
- **Browse free agents** and see estimated market values before bidding
- **Track draft picks** you own across multiple future seasons
- **View league-wide standings** including buy-in tracking

### For Commissioners

- **Import contracts** from a CSV file when first setting up the league
- **Advance the season** which decrements all contract years, flags expiring contracts, and rolls the cap forward
- **Calculate franchise tag values** based on position-specific salary pools (top 10 QBs/TEs, top 20 RBs/WRs)
- **Apply franchise tags** to players with automatic cap validation
- **Approve or veto trades** with commissioner override controls
- **Make manual cap adjustments** for special situations
- **Sync rosters from Sleeper** to detect drops and automatically apply dead cap penalties
- **Manage league rules** (salary cap amount, trade deadlines, voting thresholds)

### Key Concepts

- **Salary Cap**: Each team has a cap (default $500). Roster salary + dead money must stay under the cap.
- **Dead Cap**: When you release or trade a player, you owe a percentage of their salary as dead money. The percentage decreases each year of the contract (75% in year 1, down to 10% by year 4-5).
- **Franchise Tags**: One per team per season. Tag salary = average of the top salaries at that position across the league.
- **Trades**: Can include any combination of player contracts, draft picks, and cap space. All cap implications are calculated and applied atomically.
- **Contract Evaluation**: The app compares each player's salary to their estimated market value (based on PPG, age, position, and comparable contracts) to generate a rating.

## Architecture

The app runs as a **static single-page application** hosted on GitHub Pages, with **Supabase** providing all backend services:

```
GitHub Pages (static SPA)
    |
    +-- Supabase Auth (login/signup)
    +-- Supabase Database (PostgreSQL)
    |     +-- Direct queries (CRUD operations)
    |     +-- RPC calls to database functions (cap calculations, trades, season advance)
    +-- Supabase Edge Functions (Deno)
    |     +-- Sleeper API sync (rosters, players, stats)
    |     +-- Trade actions (accept/reject/vote)
    |     +-- CSV import, league initialization
    +-- GitHub Actions (scheduled cron jobs)
          +-- Roster sync every 5 minutes
          +-- Stats sync weekly on Tuesdays
```

### Tech Stack

- **Frontend**: React Native (Expo) with web export, TypeScript, Expo Router
- **Database**: Supabase (PostgreSQL) with RLS policies
- **Backend Logic**: PostgreSQL functions (transactional operations) + Supabase Edge Functions (external API calls)
- **Hosting**: GitHub Pages (static site)
- **External API**: Sleeper (roster/player/stats data)
- **Auth**: Supabase Auth (email/password)

## Setup

### Prerequisites

- A [Supabase](https://supabase.com) project (free tier works)
- A [Sleeper](https://sleeper.com) fantasy football league
- Node.js 20+

### 1. Clone and Install

```bash
git clone https://github.com/tfak23/The586Dynasty.git
cd The586Dynasty/mobile
npm install
```

### 2. Configure Supabase

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run the database migrations in the SQL Editor:
   - `supabase/migrations/20260211_initial_schema.sql` (tables, views, RLS)
   - `supabase/migrations/20260213_api_functions.sql` (database functions)
3. Deploy edge functions:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase functions deploy
   ```
4. Set the service role key as a Supabase secret:
   ```bash
   npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   ```

### 3. Configure GitHub

Add these **repository secrets** (Settings > Secrets and variables > Actions):

| Secret | Where to find it |
|--------|-----------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase Dashboard > Project Settings > API > Project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard > Project Settings > API > anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard > Project Settings > API > service_role key |

### 4. Enable GitHub Pages

1. Go to your repo Settings > Pages
2. Set Source to **GitHub Actions**
3. Push to `main` — the deploy workflow runs automatically

### 5. Local Development

```bash
cd mobile

# Create a .env.local file
echo "EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co" > .env.local
echo "EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>" >> .env.local

# Start the dev server
npm run web
```

Open http://localhost:8081 in your browser.

## Project Structure

```
The586Dynasty/
  mobile/                    # Expo app (frontend)
    app/                     # Screen files (Expo Router)
      (tabs)/                # Tab navigation (Home, Players, Trades, etc.)
      team/[id].tsx          # Team detail screen
      contract/[id].tsx      # Contract detail with evaluation
      trade/                 # Trade creation and detail screens
      commissioner/          # Commissioner-only screens
    lib/
      api.ts                 # API layer (Supabase queries, RPC, edge functions)
      supabase.ts            # Supabase client initialization
      contractCalculations.ts # Client-side contract evaluation logic
      AuthContext.tsx         # Authentication context
  supabase/
    migrations/              # SQL migrations
    functions/               # Edge functions (Deno)
      trade-action/          # Trade accept/reject/vote
      sync-rosters/          # Sleeper roster sync
      sync-league/           # Full league sync from Sleeper
      sync-players/          # NFL player database sync
      sync-stats/            # Player stats sync
      initialize-league/     # First-time league setup
      import-csv/            # CSV contract import
      google-docs-read/      # Google Docs API proxy
  .github/workflows/
    deploy-github-pages.yml  # Build and deploy to GitHub Pages
    sync-rosters.yml         # Cron: roster sync every 5 minutes
    sync-stats.yml           # Cron: stats sync Tuesdays 6AM UTC
```

## License

This project is private and for The 586 Dynasty league members only.
