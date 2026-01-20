# The 586 Dynasty - Companion App Design Document

**Version:** 1.1  
**Date:** January 18, 2026  
**League ID:** 1315789488873553920  
**Current Season:** 2025  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Database Schema](#3-database-schema)
4. [Feature Specifications](#4-feature-specifications)
5. [Wireframes & UI Design](#5-wireframes--ui-design)
6. [User Flows](#6-user-flows)
7. [API Integration](#7-api-integration)
8. [Technical Implementation](#8-technical-implementation)
9. [Security & Permissions](#9-security--permissions)
10. [Development Roadmap](#10-development-roadmap)
11. [Deployment & Infrastructure](#11-deployment--infrastructure)

---

## 1. Executive Summary

### 1.1 Purpose
The 586 Dynasty Companion App is a mobile application (iOS & Android) that extends the Sleeper fantasy football platform with dynasty-specific features: salary cap management, multi-year contracts, franchise tags, trade management with expirations, and cap projections.

### 1.2 Key Differentiators from Sleeper
| Feature | Sleeper | The 586 App |
|---------|---------|-------------|
| Salary Cap Tracking | ❌ | ✅ $500 hard cap per team |
| Multi-Year Contracts | ❌ | ✅ 1-5 year contracts |
| Contract Year Limits | ❌ | ✅ Min 45 / Max 75 per team |
| Franchise Tags | ❌ | ✅ Position-based avg calculation |
| Trade Expirations | ❌ | ✅ 1hr, 24hr, 2d, 1wk options |
| Cap Projections | ❌ | ✅ 5-year forward view |
| Release Cap Hits | ❌ | ✅ Dead money tracking |
| Excel Import | ❌ | ✅ One-time historical import |

### 1.3 League Configuration (From Sleeper API)
```
League: The 586
Teams: 12
Divisions: 3 (East I Thought You Said Weast, King in the North, Wild Wild West)
Roster: QB, RB, RB, WR, WR, WR, TE, FLEX, FLEX + 14 BN + 2 IR
Scoring: PPR (1.0), Pass TD (5pts), Rush/Rec TD (6pts)
Commissioner: brcarnag (Brian Carnaghi)
```

### 1.4 Team Owners (Mapped from Sleeper)
| User ID | Display Name | Team Name |
|---------|--------------|-----------|
| 90228290740436992 | brcarnag | Trust the Process |
| 81534419936362496 | miket1326 | Bed, Bath & Bijan |
| 89807825165238272 | DomDuhBomb | Mazda Marv |
| 473695025016860672 | bigwily57 | Teta tots |
| 559691689101787136 | TonyFF | The Great Replacement |
| 751894053339193344 | Gazarato | CeeDeeC guidelines |
| 756702967083720704 | CanThePan | Lamborghini Love |
| 841054225579479040 | TrevorH42 | Davante's Inferno |
| 867150683533643776 | abhanot11 | Healthcare Hero |
| 869416371744894976 | NickDnof | Danny Dimes Era |
| 871892102001430528 | zachg1313 | J Jet2Holiday |
| 1129072685138542592 | Klucido08 | Jeanty juice🧃 |

---

## 2. System Architecture

### 2.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐     │
│   │   iOS App        │    │   Android App    │    │   Web App        │     │
│   │   (React Native) │    │   (React Native) │    │   (React/Next.js)│     │
│   └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘     │
│            │                       │                        │               │
│            └───────────────────────┼────────────────────────┘               │
│                                    │                                        │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │ HTTPS/WSS
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GOOGLE CLOUD PLATFORM                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                        Cloud Run (API Layer)                         │   │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │   │
│   │  │ Auth Service│  │Roster Svc   │  │ Trade Svc   │  │Contract Svc│  │   │
│   │  │ (Firebase)  │  │             │  │             │  │            │  │   │
│   │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘  │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│   ┌────────────────────────────────┼────────────────────────────────────┐   │
│   │                                ▼                                     │   │
│   │   ┌─────────────────┐    ┌─────────────────┐    ┌────────────────┐  │   │
│   │   │  Cloud SQL      │    │  Firestore      │    │ Cloud Storage  │  │   │
│   │   │  (PostgreSQL)   │    │  (Real-time)    │    │ (Excel Import) │  │   │
│   │   │  - Contracts    │    │  - Notifications│    │ - Backups      │  │   │
│   │   │  - Cap History  │    │  - Trade Chat   │    │ - Avatars      │  │   │
│   │   │  - Transactions │    │  - Live Updates │    │                │  │   │
│   │   └─────────────────┘    └─────────────────┘    └────────────────┘  │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                     Background Services                              │   │
│   │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │   │
│   │  │ Cloud Scheduler │  │ Pub/Sub         │  │ Cloud Functions     │  │   │
│   │  │ - Sleeper Sync  │  │ - Trade Events  │  │ - Trade Expiration  │  │   │
│   │  │ - Cap Rollover  │  │ - Notifications │  │ - Sleeper Webhook   │  │   │
│   │  └─────────────────┘  └─────────────────┘  └─────────────────────┘  │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SERVICES                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────┐     │
│   │  Sleeper API    │    │  Firebase Cloud │    │  Apple/Google       │     │
│   │  - Rosters      │    │  Messaging      │    │  Push Notification  │     │
│   │  - Transactions │    │  - Push Notifs  │    │  Services           │     │
│   │  - Players      │    │                 │    │                     │     │
│   └─────────────────┘    └─────────────────┘    └─────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack

| Layer | Technology | Justification |
|-------|------------|---------------|
| **Mobile App** | React Native + Expo | Single codebase for iOS & Android; good performance; large ecosystem |
| **Web App** | Next.js 14 | Optional admin dashboard; SSR for SEO; shares components with mobile |
| **API Backend** | Node.js + Express | Fast development; excellent Sleeper API integration; TypeScript support |
| **Primary Database** | Cloud SQL (PostgreSQL) | Relational data for contracts, transactions; ACID compliance |
| **Real-time Database** | Firestore | Live updates for trades, notifications; offline support |
| **Authentication** | Firebase Auth | Easy social login; integrates with Sleeper OAuth patterns |
| **Push Notifications** | Firebase Cloud Messaging | Cross-platform; integrates with Sleeper notification format |
| **File Storage** | Cloud Storage | Excel import processing; avatar storage |
| **Task Scheduling** | Cloud Scheduler + Functions | Trade expirations; Sleeper sync; season rollover |
| **Hosting** | Google Cloud Run | Serverless containers; auto-scaling; your existing GCP setup |

### 2.3 Why Google Cloud Platform Works

✅ **Your GCP server is fully capable** of hosting this application:

1. **Cloud Run**: Serverless containers for the API - scales to zero when not in use (cost-effective)
2. **Cloud SQL**: Managed PostgreSQL with automatic backups
3. **Firestore**: Real-time sync for mobile clients
4. **Cloud Functions**: Triggered events (trade expirations, notifications)
5. **Cloud Scheduler**: Cron jobs for Sleeper sync (every 5 minutes during season)

**Estimated Monthly Cost** (12 users, light usage):
- Cloud Run: ~$5-15/month
- Cloud SQL (db-f1-micro): ~$10/month
- Firestore: ~$1-5/month (free tier covers most)
- Cloud Functions: ~$0-2/month
- **Total: ~$20-35/month**

---

## 3. Database Schema

### 3.1 PostgreSQL Schema (Cloud SQL)

```sql
-- =============================================
-- LEAGUES TABLE
-- =============================================
CREATE TABLE leagues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sleeper_league_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    season INT NOT NULL,
    salary_cap DECIMAL(10,2) DEFAULT 500.00,
    min_contract_years INT DEFAULT 45,
    max_contract_years INT DEFAULT 75,
    
    -- Trade Approval Settings
    trade_approval_mode VARCHAR(20) DEFAULT 'auto', -- 'auto', 'commissioner', 'league_vote'
    league_vote_window_hours INT DEFAULT 24, -- 24 or 48 (only used if mode is 'league_vote')
    league_vote_threshold DECIMAL(3,2) DEFAULT 0.50, -- Majority = 0.50 (6 of 12)
    
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- LEAGUE COMMISSIONERS (Up to 3 per league)
-- =============================================
CREATE TABLE league_commissioners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE, -- The original/main commissioner
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    added_by UUID,
    UNIQUE(league_id, user_id)
);

-- Index to enforce max 3 commissioners per league (enforced in app logic)
CREATE INDEX idx_league_commissioners ON league_commissioners(league_id);

-- =============================================
-- TEAMS TABLE
-- =============================================
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    sleeper_user_id VARCHAR(50) NOT NULL,
    sleeper_roster_id INT NOT NULL,
    owner_name VARCHAR(100),
    team_name VARCHAR(100),
    avatar_url TEXT,
    division INT,
    is_commissioner BOOLEAN DEFAULT FALSE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(league_id, sleeper_user_id)
);

-- =============================================
-- PLAYERS TABLE (Synced from Sleeper)
-- =============================================
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sleeper_player_id VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    position VARCHAR(10),
    team VARCHAR(10),
    age INT,
    status VARCHAR(20),
    injury_status VARCHAR(20),
    metadata JSONB DEFAULT '{}',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- CONTRACTS TABLE (Core Dynasty Data)
-- =============================================
CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    
    -- Contract Details
    salary DECIMAL(10,2) NOT NULL,
    years_total INT NOT NULL CHECK (years_total BETWEEN 1 AND 5),
    years_remaining INT NOT NULL,
    start_season INT NOT NULL,
    end_season INT NOT NULL,
    
    -- Contract Source
    acquisition_type VARCHAR(20) NOT NULL, -- 'auction', 'rookie_draft', 'trade', 'free_agent', 'franchise_tag'
    acquisition_details JSONB DEFAULT '{}',
    
    -- Rookie Options
    has_option BOOLEAN DEFAULT FALSE,
    option_salary DECIMAL(10,2),
    option_exercised BOOLEAN DEFAULT FALSE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'ir', 'released', 'expired', 'traded'
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(league_id, player_id, status) -- One active contract per player per league
);

-- =============================================
-- CONTRACT HISTORY (Audit Trail)
-- =============================================
CREATE TABLE contract_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- 'created', 'extended', 'released', 'traded', 'option_exercised'
    old_values JSONB,
    new_values JSONB,
    performed_by UUID REFERENCES teams(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TRADES TABLE
-- =============================================
CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    
    -- Trade Parties (supports up to 3 teams)
    initiator_team_id UUID REFERENCES teams(id),
    
    -- Status & Timing
    -- 'pending' = waiting for trade partners to accept
    -- 'accepted' = all parties accepted, awaiting approval (if required)
    -- 'voting' = in league vote period
    -- 'approved' = passed all approvals, ready to execute
    -- 'completed' = executed successfully
    -- 'rejected', 'expired', 'cancelled', 'vetoed'
    status VARCHAR(20) DEFAULT 'pending',
    expiration_hours INT NOT NULL, -- 1, 24, 48, or 168 (1 week)
    expires_at TIMESTAMP NOT NULL,
    
    -- Approval tracking
    approval_mode VARCHAR(20) NOT NULL, -- Snapshot of league setting at trade creation
    commissioner_approved BOOLEAN,
    commissioner_approved_by UUID REFERENCES league_commissioners(id),
    commissioner_notes TEXT,
    
    -- League Vote tracking (if mode is 'league_vote')
    vote_deadline TIMESTAMP,
    votes_for INT DEFAULT 0,
    votes_against INT DEFAULT 0,
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- =============================================
-- TRADE VOTES (for league vote mode)
-- =============================================
CREATE TABLE trade_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id),
    vote VARCHAR(10) NOT NULL, -- 'approve' or 'veto'
    voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(trade_id, team_id) -- One vote per team per trade
);

-- =============================================
-- TRADE PARTICIPANTS
-- =============================================
CREATE TABLE trade_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id),
    role VARCHAR(20) NOT NULL, -- 'initiator', 'recipient', 'third_party'
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
    responded_at TIMESTAMP,
    UNIQUE(trade_id, team_id)
);

-- =============================================
-- TRADE ASSETS (What's being exchanged)
-- =============================================
CREATE TABLE trade_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
    from_team_id UUID REFERENCES teams(id),
    to_team_id UUID REFERENCES teams(id),
    
    asset_type VARCHAR(20) NOT NULL, -- 'player', 'draft_pick', 'cap_space'
    
    -- For Players
    contract_id UUID REFERENCES contracts(id),
    
    -- For Draft Picks
    pick_season INT,
    pick_round INT,
    pick_original_team_id UUID REFERENCES teams(id),
    
    -- For Cap Space
    cap_amount DECIMAL(10,2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- DRAFT PICKS TABLE
-- =============================================
CREATE TABLE draft_picks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    season INT NOT NULL,
    round INT NOT NULL,
    pick_number INT, -- NULL until draft order set
    
    -- Ownership
    original_team_id UUID REFERENCES teams(id),
    current_team_id UUID REFERENCES teams(id),
    
    -- If Used
    player_id UUID REFERENCES players(id),
    used_at TIMESTAMP,
    
    -- Value (for rookie draft salary)
    base_salary DECIMAL(10,2),
    years INT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(league_id, season, round, original_team_id)
);

-- =============================================
-- CAP TRANSACTIONS (Dead Money, Adjustments)
-- =============================================
CREATE TABLE cap_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id),
    season INT NOT NULL,
    
    transaction_type VARCHAR(30) NOT NULL, -- 'release_dead_money', 'trade_cap_send', 'trade_cap_receive', 'adjustment'
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    
    -- Related Records
    related_contract_id UUID REFERENCES contracts(id),
    related_trade_id UUID REFERENCES trades(id),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- FRANCHISE TAGS TABLE
-- =============================================
CREATE TABLE franchise_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    season INT NOT NULL,
    position VARCHAR(10) NOT NULL,
    tag_salary DECIMAL(10,2) NOT NULL,
    top_10_players JSONB, -- Store the players used for calculation
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(league_id, season, position)
);

-- =============================================
-- LEAGUE HISTORY (Win/Loss, Championships)
-- =============================================
CREATE TABLE team_seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id),
    season INT NOT NULL,
    
    wins INT DEFAULT 0,
    losses INT DEFAULT 0,
    ties INT DEFAULT 0,
    points_for DECIMAL(10,2) DEFAULT 0,
    points_against DECIMAL(10,2) DEFAULT 0,
    
    playoff_seed INT,
    playoff_finish VARCHAR(20), -- 'champion', 'runner_up', 'third', 'semifinal', 'quarterfinal', 'missed'
    
    final_cap_used DECIMAL(10,2),
    total_contract_years INT,
    
    UNIQUE(team_id, season)
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX idx_contracts_team ON contracts(team_id, status);
CREATE INDEX idx_contracts_league_season ON contracts(league_id, end_season);
CREATE INDEX idx_trades_league_status ON trades(league_id, status);
CREATE INDEX idx_trades_expires ON trades(expires_at) WHERE status = 'pending';
CREATE INDEX idx_draft_picks_owner ON draft_picks(current_team_id, season);
CREATE INDEX idx_cap_transactions_team_season ON cap_transactions(team_id, season);

-- =============================================
-- VIEWS FOR COMMON QUERIES
-- =============================================

-- Team Cap Summary View
CREATE VIEW team_cap_summary AS
SELECT 
    t.id as team_id,
    t.team_name,
    l.salary_cap,
    COALESCE(SUM(c.salary), 0) as total_salary,
    l.salary_cap - COALESCE(SUM(c.salary), 0) as cap_room,
    COUNT(c.id) as player_count,
    COALESCE(SUM(c.years_remaining), 0) as total_contract_years,
    COALESCE(SUM(CASE WHEN ct.amount < 0 THEN ct.amount ELSE 0 END), 0) as dead_money
FROM teams t
JOIN leagues l ON t.league_id = l.id
LEFT JOIN contracts c ON t.id = c.team_id AND c.status = 'active'
LEFT JOIN cap_transactions ct ON t.id = ct.team_id AND ct.season = l.season
GROUP BY t.id, t.team_name, l.salary_cap;
```

### 3.2 Firestore Schema (Real-time Data)

```javascript
// Collection: notifications
{
  id: "auto-generated",
  userId: "sleeper_user_id",
  leagueId: "league_uuid",
  type: "trade_offer" | "trade_accepted" | "trade_expired" | "trade_rejected" | "commissioner_message",
  title: "New Trade Offer from Trust the Process",
  body: "Brian wants to trade Josh Allen for your CeeDee Lamb",
  data: {
    tradeId: "trade_uuid",
    // type-specific data
  },
  read: false,
  createdAt: Timestamp,
  expiresAt: Timestamp // For auto-cleanup
}

// Collection: trade_chats/{tradeId}/messages
{
  id: "auto-generated",
  senderId: "team_uuid",
  senderName: "Brian Carnaghi",
  message: "Would you consider adding a 2nd round pick?",
  createdAt: Timestamp
}

// Collection: league_activity/{leagueId}/events
{
  id: "auto-generated",
  type: "trade_completed" | "player_released" | "contract_extended",
  summary: "Trade completed: Josh Allen to CeeDeeC guidelines",
  details: { ... },
  createdAt: Timestamp
}
```

---

## 4. Feature Specifications

### 4.1 Contract Rules Engine

#### Dead Cap Reference Table

| Contract Length | Year 1 | Year 2 | Year 3 | Year 4 | Year 5 |
|-----------------|--------|--------|--------|--------|--------|
| 5-year | 75% | 50% | 25% | 10% | 10% |
| 4-year | 75% | 50% | 25% | 10% | - |
| 3-year | 50% | 25% | 10% | - | - |
| 2-year | 50% | 25% | - | - | - |
| 1-year | 50% | - | - | - | - |

**Special Rules:**
- **$1 contracts**: Always retain $1 dead cap regardless of years remaining
- **Retirement (age 30+)**: 25% of salary × remaining years
- **Retirement (under 30)**: No penalty, full salary returned
- **Dropped players**: Cannot be re-added until clearing waivers
- **IR free agents**: Cannot be signed to long-term contracts

```typescript
// Contract Minimum Salaries
const MIN_SALARIES: Record<number, number> = {
  1: 1,   // 1-year = $1 minimum
  2: 4,   // 2-year = $4 minimum
  3: 8,   // 3-year = $8 minimum
  4: 12,  // 4-year = $12 minimum
  5: 15,  // 5-year = $15 minimum
};

// Dead Cap Percentages by Contract Length and Years Remaining
// Row = Total contract years, Column = Year being released
const DEAD_CAP_PERCENTAGES: Record<number, Record<number, number>> = {
  // 5-year contract: 75% in yr1, 50% in yr2, 25% in yr3, 10% in yr4, 10% in yr5
  5: { 1: 0.75, 2: 0.50, 3: 0.25, 4: 0.10, 5: 0.10 },
  // 4-year contract: 75% in yr1, 50% in yr2, 25% in yr3, 10% in yr4
  4: { 1: 0.75, 2: 0.50, 3: 0.25, 4: 0.10 },
  // 3-year contract: 50% in yr1, 25% in yr2, 10% in yr3
  3: { 1: 0.50, 2: 0.25, 3: 0.10 },
  // 2-year contract: 50% in yr1, 25% in yr2
  2: { 1: 0.50, 2: 0.25 },
  // 1-year contract: 50% in yr1
  1: { 1: 0.50 },
};

// Rookie Draft Values (by round and pick)
const ROOKIE_DRAFT_VALUES: RookieDraftValue[] = [
  // Round 1 (4-year contracts with 5th year option at 1.5x)
  { round: 1, pick: 1, salary: 45, years: 4, hasOption: true },
  { round: 1, pick: 2, salary: 38, years: 4, hasOption: true },
  { round: 1, pick: 3, salary: 32, years: 4, hasOption: true },
  { round: 1, pick: 4, salary: 27, years: 4, hasOption: true },
  { round: 1, pick: 5, salary: 23, years: 4, hasOption: true },
  { round: 1, pick: 6, salary: 19, years: 4, hasOption: true },
  { round: 1, pick: 7, salary: 16, years: 4, hasOption: true },
  { round: 1, pick: 8, salary: 14, years: 4, hasOption: true },
  { round: 1, pick: 9, salary: 13, years: 4, hasOption: true },
  { round: 1, pick: 10, salary: 12, years: 4, hasOption: true },
  { round: 1, pick: 11, salary: 11, years: 4, hasOption: true },
  { round: 1, pick: 12, salary: 10, years: 4, hasOption: true },
  // Round 2 (4-year contracts with 5th year option at 1.5x)
  { round: 2, pick: 1, salary: 9, years: 4, hasOption: true },
  { round: 2, pick: 2, salary: 9, years: 4, hasOption: true },
  { round: 2, pick: 3, salary: 9, years: 4, hasOption: true },
  { round: 2, pick: 4, salary: 8, years: 4, hasOption: true },
  { round: 2, pick: 5, salary: 8, years: 4, hasOption: true },
  { round: 2, pick: 6, salary: 8, years: 4, hasOption: true },
  { round: 2, pick: 7, salary: 7, years: 4, hasOption: true },
  { round: 2, pick: 8, salary: 7, years: 4, hasOption: true },
  { round: 2, pick: 9, salary: 6, years: 4, hasOption: true },
  { round: 2, pick: 10, salary: 6, years: 4, hasOption: true },
  { round: 2, pick: 11, salary: 5, years: 4, hasOption: true },
  { round: 2, pick: 12, salary: 5, years: 4, hasOption: true },
  // Round 3 (3-year contracts, no option)
  { round: 3, pick: 1, salary: 1, years: 3, hasOption: false },
  { round: 3, pick: 2, salary: 1, years: 3, hasOption: false },
  { round: 3, pick: 3, salary: 1, years: 3, hasOption: false },
  { round: 3, pick: 4, salary: 1, years: 3, hasOption: false },
  { round: 3, pick: 5, salary: 1, years: 3, hasOption: false },
  { round: 3, pick: 6, salary: 1, years: 3, hasOption: false },
  { round: 3, pick: 7, salary: 1, years: 3, hasOption: false },
  { round: 3, pick: 8, salary: 1, years: 3, hasOption: false },
  { round: 3, pick: 9, salary: 1, years: 3, hasOption: false },
  { round: 3, pick: 10, salary: 1, years: 3, hasOption: false },
  { round: 3, pick: 11, salary: 1, years: 3, hasOption: false },
  { round: 3, pick: 12, salary: 1, years: 3, hasOption: false },
];

// Calculate Rookie Option Salary (1.5x rounded up)
function calculateOptionSalary(baseSalary: number): number {
  return Math.ceil(baseSalary * 1.5);
}

// Example: $45 base → $68 option ($45 × 1.5 = $67.5, rounded up = $68)

// Calculate Release Dead Money
// Based on The 586 league rules - percentage varies by total contract length and current year
function calculateReleaseDeadMoney(contract: Contract): number {
  const salary = contract.salary;
  const totalYears = contract.yearsTotal;
  const yearsRemaining = contract.yearsRemaining;
  const currentYear = totalYears - yearsRemaining + 1; // Which year of contract we're in
  
  // Special case: $1 contracts always retain full cap hit
  if (salary === 1) {
    return 1;
  }
  
  // Get the dead cap percentage from the table
  const percentages = DEAD_CAP_PERCENTAGES[totalYears];
  if (!percentages || !percentages[currentYear]) {
    throw new Error(`Invalid contract configuration: ${totalYears} year contract in year ${currentYear}`);
  }
  
  const deadCapPercent = percentages[currentYear];
  
  // All percentages rounded UP per league rules
  return Math.ceil(salary * deadCapPercent);
}

// Calculate dead money for player retirement
function calculateRetirementDeadMoney(contract: Contract, playerAge: number): number {
  // If player retires after age 30: 25% of salary for duration of contract
  if (playerAge >= 30) {
    return Math.ceil(contract.salary * 0.25) * contract.yearsRemaining;
  }
  // If player retires before age 30: no penalty
  return 0;
}

// Example Dead Cap Calculations:
// 5-year $50 contract, released in year 1: $50 × 75% = $38 dead cap
// 5-year $50 contract, released in year 3: $50 × 25% = $13 dead cap
// 3-year $30 contract, released in year 1: $30 × 50% = $15 dead cap
// 2-year $20 contract, released in year 2: $20 × 25% = $5 dead cap
// 1-year $10 contract, released in year 1: $10 × 50% = $5 dead cap
// Any $1 contract released: $1 dead cap (always)

// Validate Team Contract Years
function validateContractYears(teamContracts: Contract[]): { valid: boolean; total: number; message?: string } {
  const total = teamContracts.reduce((sum, c) => sum + c.yearsRemaining, 0);
  
  if (total < 45) {
    return { valid: false, total, message: `Team has ${total} contract years. Minimum is 45.` };
  }
  if (total > 75) {
    return { valid: false, total, message: `Team has ${total} contract years. Maximum is 75.` };
  }
  return { valid: true, total };
}

// Calculate Franchise Tag Salary
// Pool sizes: Top 10 QB, Top 20 WR, Top 20 RB, Top 10 TE
const FRANCHISE_TAG_POOL_SIZE: Record<string, number> = {
  QB: 10,
  WR: 20,
  RB: 20,
  TE: 10
};

async function calculateFranchiseTag(
  leagueId: string, 
  position: 'QB' | 'RB' | 'WR' | 'TE'
): Promise<number> {
  const poolSize = FRANCHISE_TAG_POOL_SIZE[position];
  
  // Get top N salaries at position across league (N varies by position)
  const topSalaries = await db.query(`
    SELECT c.salary
    FROM contracts c
    JOIN players p ON c.player_id = p.id
    WHERE c.league_id = $1 
      AND p.position = $2
      AND c.status = 'active'
    ORDER BY c.salary DESC
    LIMIT $3
  `, [leagueId, position, poolSize]);
  
  const sum = topSalaries.reduce((acc, row) => acc + row.salary, 0);
  return Math.ceil(sum / poolSize); // Average of top N, rounded up
}

// Each team can only use ONE franchise tag per year
// Players with blank/expired contracts are eligible to be tagged
```

### 4.2 Trade System Specifications

#### Trade Approval Modes

The league can configure one of three trade approval modes:

| Mode | Description |
|------|-------------|
| **Auto-Approval** | Trades complete immediately when all parties accept |
| **Commissioner Approval** | Trades require commissioner sign-off after acceptance |
| **League Vote** | Trades require majority league approval within 24 or 48 hours |

```typescript
enum TradeApprovalMode {
  AUTO = 'auto',
  COMMISSIONER = 'commissioner',
  LEAGUE_VOTE = 'league_vote',
}

interface LeagueTradeSettings {
  approvalMode: TradeApprovalMode;
  leagueVoteWindow: 24 | 48; // hours (only used if mode is LEAGUE_VOTE)
  vetoThreshold: number; // e.g., 0.5 for majority (6 of 12 teams)
}

// Trade Approval Flow Logic
async function processTradeAfterAcceptance(trade: Trade): Promise<void> {
  const league = await getLeague(trade.leagueId);
  
  switch (league.tradeApprovalMode) {
    case 'auto':
      // Execute immediately
      await executeTrade(trade);
      break;
      
    case 'commissioner':
      // Move to commissioner review
      await updateTradeStatus(trade.id, 'awaiting_commissioner');
      await notifyCommissioners(trade);
      break;
      
    case 'league_vote':
      // Start voting period
      const voteDeadline = new Date();
      voteDeadline.setHours(voteDeadline.getHours() + league.leagueVoteWindowHours);
      
      await db.query(`
        UPDATE trades 
        SET status = 'voting', vote_deadline = $1 
        WHERE id = $2
      `, [voteDeadline, trade.id]);
      
      await notifyLeagueOfVote(trade);
      break;
  }
}

// League Vote Processing (runs on schedule)
async function processLeagueVotes(): Promise<void> {
  const tradesInVoting = await db.query(`
    SELECT t.*, l.league_vote_threshold, l.num_teams
    FROM trades t
    JOIN leagues l ON t.league_id = l.id
    WHERE t.status = 'voting' AND t.vote_deadline <= NOW()
  `);
  
  for (const trade of tradesInVoting) {
    const totalVotes = trade.votes_for + trade.votes_against;
    const nonParticipantTeams = trade.num_teams - trade.participant_count;
    
    // Majority of non-participant teams must approve
    const approvalsNeeded = Math.ceil(nonParticipantTeams * trade.league_vote_threshold);
    
    if (trade.votes_for >= approvalsNeeded) {
      await executeTrade(trade);
    } else if (trade.votes_against > nonParticipantTeams - approvalsNeeded) {
      // Impossible to reach approval threshold
      await updateTradeStatus(trade.id, 'vetoed');
      await notifyTradeVetoed(trade);
    } else {
      // Voting period ended without enough votes - auto-approve or reject based on league rules
      // Default: auto-approve if no majority veto
      await executeTrade(trade);
    }
  }
}
```

#### Trade Expiration Options
| Option | Hours | Use Case |
|--------|-------|----------|
| 1 Hour | 1 | Quick negotiations, live discussions |
| 24 Hours | 24 | Standard offers |
| 2 Days | 48 | Complex multi-player deals |
| 1 Week | 168 | Exploratory offers, busy schedules |

#### Trade Validation Rules

```typescript
interface TradeValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  capImpacts: Record<string, CapImpact>;
}

async function validateTrade(trade: TradeProposal): Promise<TradeValidation> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const capImpacts: Record<string, CapImpact> = {};

  for (const teamId of trade.participantTeamIds) {
    const team = await getTeam(teamId);
    const currentCap = await getTeamCapSummary(teamId);
    
    // Calculate net cap change
    const playersReceiving = trade.assets.filter(a => a.toTeamId === teamId && a.type === 'player');
    const playersSending = trade.assets.filter(a => a.fromTeamId === teamId && a.type === 'player');
    const capReceiving = trade.assets.filter(a => a.toTeamId === teamId && a.type === 'cap_space');
    const capSending = trade.assets.filter(a => a.fromTeamId === teamId && a.type === 'cap_space');

    const salaryIn = playersReceiving.reduce((sum, a) => sum + a.contract.salary, 0);
    const salaryOut = playersSending.reduce((sum, a) => sum + a.contract.salary, 0);
    const capIn = capReceiving.reduce((sum, a) => sum + a.amount, 0);
    const capOut = capSending.reduce((sum, a) => sum + a.amount, 0);

    const netCapChange = (salaryOut - salaryIn) + (capIn - capOut);
    const newCapRoom = currentCap.capRoom + netCapChange;

    capImpacts[teamId] = {
      currentCapRoom: currentCap.capRoom,
      netChange: netCapChange,
      newCapRoom,
      playersIn: playersReceiving.length,
      playersOut: playersSending.length,
    };

    // Validation Rules
    if (newCapRoom < 0) {
      errors.push(`${team.teamName} would be over cap by $${Math.abs(newCapRoom)}`);
    }

    // Contract years validation
    const yearsIn = playersReceiving.reduce((sum, a) => sum + a.contract.yearsRemaining, 0);
    const yearsOut = playersSending.reduce((sum, a) => sum + a.contract.yearsRemaining, 0);
    const newYears = currentCap.totalContractYears + yearsIn - yearsOut;

    if (newYears < 45) {
      errors.push(`${team.teamName} would have only ${newYears} contract years (min: 45)`);
    }
    if (newYears > 75) {
      errors.push(`${team.teamName} would have ${newYears} contract years (max: 75)`);
    }

    // Roster size validation
    const newRosterSize = currentCap.playerCount + playersReceiving.length - playersSending.length;
    if (newRosterSize > 25) {
      warnings.push(`${team.teamName} would have ${newRosterSize} players (max: 25)`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    capImpacts,
  };
}
```

#### Trade Expiration Handler (Cloud Function)

```typescript
// Scheduled to run every minute
export const checkTradeExpirations = functions.pubsub
  .schedule('every 1 minutes')
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    
    // Find expired pending trades
    const expiredTrades = await db.query(`
      UPDATE trades
      SET status = 'expired', updated_at = NOW()
      WHERE status = 'pending' AND expires_at <= $1
      RETURNING *
    `, [now.toDate()]);

    // Send notifications for each expired trade
    for (const trade of expiredTrades) {
      await sendTradeExpirationNotification(trade);
    }

    console.log(`Expired ${expiredTrades.length} trades`);
  });
```

### 4.3 Sleeper Integration

#### Notification Integration via Sleeper Bot

Since Sleeper doesn't have a public API for sending messages, we'll use a companion approach:

1. **In-App Notifications**: Primary notification channel (push + in-app)
2. **Sleeper Bot (Optional)**: If the commissioner grants bot access, we can post to league chat

```typescript
// Sleeper API Endpoints Used
const SLEEPER_API = {
  // User & League
  getUser: (username: string) => `https://api.sleeper.app/v1/user/${username}`,
  getUserLeagues: (userId: string, season: string) => 
    `https://api.sleeper.app/v1/user/${userId}/leagues/nfl/${season}`,
  
  // League Data
  getLeague: (leagueId: string) => `https://api.sleeper.app/v1/league/${leagueId}`,
  getLeagueRosters: (leagueId: string) => `https://api.sleeper.app/v1/league/${leagueId}/rosters`,
  getLeagueUsers: (leagueId: string) => `https://api.sleeper.app/v1/league/${leagueId}/users`,
  getLeagueMatchups: (leagueId: string, week: number) => 
    `https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`,
  
  // Transactions
  getTransactions: (leagueId: string, week: number) => 
    `https://api.sleeper.app/v1/league/${leagueId}/transactions/${week}`,
  
  // Drafts
  getLeagueDrafts: (leagueId: string) => `https://api.sleeper.app/v1/league/${leagueId}/drafts`,
  getDraft: (draftId: string) => `https://api.sleeper.app/v1/draft/${draftId}`,
  getDraftPicks: (draftId: string) => `https://api.sleeper.app/v1/draft/${draftId}/picks`,
  
  // Players (cache this - large response)
  getAllPlayers: () => `https://api.sleeper.app/v1/players/nfl`,
  
  // Traded Picks
  getTradedPicks: (leagueId: string) => `https://api.sleeper.app/v1/league/${leagueId}/traded_picks`,
};

// Sync Service
class SleeperSyncService {
  private leagueId: string;
  
  async syncRosters(): Promise<void> {
    const rosters = await fetch(SLEEPER_API.getLeagueRosters(this.leagueId)).then(r => r.json());
    
    for (const roster of rosters) {
      // Check for player additions/drops
      const currentPlayers = await this.getCurrentRosterPlayers(roster.roster_id);
      const sleeperPlayers = roster.players || [];
      
      const added = sleeperPlayers.filter(p => !currentPlayers.includes(p));
      const dropped = currentPlayers.filter(p => !sleeperPlayers.includes(p));
      
      // Handle additions (check if they need contracts)
      for (const playerId of added) {
        await this.handlePlayerAddition(roster.roster_id, playerId);
      }
      
      // Handle drops (update contract status)
      for (const playerId of dropped) {
        await this.handlePlayerDrop(roster.roster_id, playerId);
      }
    }
  }
  
  async syncTransactions(week: number): Promise<void> {
    const transactions = await fetch(SLEEPER_API.getTransactions(this.leagueId, week)).then(r => r.json());
    
    for (const tx of transactions) {
      if (tx.type === 'trade' && tx.status === 'complete') {
        // Check if this trade was done in Sleeper (not our app)
        const existingTrade = await this.findTradeBySleeperTx(tx.transaction_id);
        if (!existingTrade) {
          // Trade was done directly in Sleeper - prompt commissioner to add contract details
          await this.createPendingTradeFromSleeper(tx);
        }
      }
    }
  }
}
```

### 4.4 CSV Import Specification

**Source File:** `The 586 Dynasty - Master Roster.csv`  
**Current Season:** 2025  
**Import Section:** Columns R-AA ("Manually Update" section)

#### Column Mapping (R-AA)

| Column | Letter | Field Name | Description |
|--------|--------|------------|-------------|
| R | 17 | `Player` | Player name (may include ",RK," for rookies, ",TAG," for franchise tags) |
| S | 18 | `CON` | Current salary (blank = contract expired, eligible for tag) |
| T | 19 | `POS` | Position (QB, RB, WR, TE) |
| U | 20 | `2025` | 2025 salary or blank |
| V | 21 | `2026` | 2026 salary, "OPT" for team option, or blank |
| W | 22 | `2027` | 2027 salary, "OPT" for team option, or blank |
| X | 23 | `2028` | 2028 salary, "OPT" for team option, or blank |
| Y | 24 | `2029` | 2029 salary, "OPT" for team option, or blank |
| Z | 25 | `Owner` | Team owner name |
| AA | 26 | `Roster Status` | "Active" or "IR" |

#### Special Markers

| Marker | Meaning | Handling |
|--------|---------|----------|
| `,RK,` in Player name | Rookie contract | Set `contract_type = 'rookie'` |
| `,TAG,` in Player name | Franchise tagged | Set `is_franchise_tagged = true`, salary = tag value |
| `OPT` in year column | Team option year | Set `has_option = true`, store option year |
| Blank `CON` | Contract expired | Player is a free agent, eligible for franchise tag |

#### Import Logic

```typescript
const CURRENT_SEASON = 2025;

interface CSVRow {
  Player: string;
  CON: string;
  POS: string;
  '2025': string;
  '2026': string;
  '2027': string;
  '2028': string;
  '2029': string;
  Owner: string;
  'Roster Status': string;
}

interface ContractImport {
  playerName: string;
  position: string;
  owner: string;
  salary: number | null;
  yearsRemaining: number;
  endSeason: number;
  hasOption: boolean;
  optionYear: number | null;
  isRookie: boolean;
  isFranchiseTagged: boolean;
  rosterStatus: 'active' | 'ir';
  contractStatus: 'active' | 'expired';
}

function parseCSVRow(row: CSVRow): ContractImport {
  const playerName = row.Player
    .replace(',RK,', ' ')
    .replace(',TAG,', ' ')
    .trim();
  
  const isRookie = row.Player.includes(',RK,');
  const isFranchiseTagged = row.Player.includes(',TAG,');
  
  // Parse year columns - count active years (non-blank, non-OPT)
  const yearColumns = ['2025', '2026', '2027', '2028', '2029'] as const;
  const yearValues = yearColumns.map(y => row[y]?.trim() || '');
  
  // Find option year (if any)
  const optionIndex = yearValues.findIndex(v => v === 'OPT');
  const hasOption = optionIndex !== -1;
  const optionYear = hasOption ? 2025 + optionIndex : null;
  
  // Count active contract years (has salary value, not blank, not OPT)
  const activeYears = yearValues.filter(v => v && v !== '' && v !== 'OPT').length;
  
  // Calculate end season
  let endSeason = CURRENT_SEASON;
  for (let i = yearColumns.length - 1; i >= 0; i--) {
    if (yearValues[i] && yearValues[i] !== '' && yearValues[i] !== 'OPT') {
      endSeason = 2025 + i;
      break;
    }
  }
  
  // Parse salary
  const salary = row.CON ? parseFloat(row.CON.replace('$', '').trim()) : null;
  
  return {
    playerName,
    position: row.POS,
    owner: row.Owner,
    salary,
    yearsRemaining: activeYears,
    endSeason,
    hasOption,
    optionYear,
    isRookie,
    isFranchiseTagged,
    rosterStatus: row['Roster Status']?.toLowerCase() === 'ir' ? 'ir' : 'active',
    contractStatus: salary !== null ? 'active' : 'expired',
  };
}

async function importCSV(csvContent: string, leagueId: string): Promise<ImportResult> {
  const result: ImportResult = {
    playersImported: 0,
    contractsCreated: 0,
    expiredContracts: 0,
    errors: [],
    warnings: [],
  };

  // Parse CSV starting from header row (line 14 in original file)
  const rows = parseCSV(csvContent);
  
  for (const row of rows) {
    try {
      const contract = parseCSVRow(row);
      
      // Skip empty rows
      if (!contract.playerName || !contract.owner) continue;
      
      // Match player to Sleeper ID
      const player = await matchPlayerToSleeper(contract.playerName, contract.position);
      if (!player) {
        result.warnings.push(`Could not match player: ${contract.playerName}`);
        continue;
      }

      // Find team by owner name
      const team = await findTeamByOwnerName(leagueId, contract.owner);
      if (!team) {
        result.warnings.push(`Could not match owner: ${contract.owner}`);
        continue;
      }

      if (contract.contractStatus === 'active') {
        // Create active contract
        await createContract({
          leagueId,
          teamId: team.id,
          playerId: player.id,
          salary: contract.salary,
          yearsRemaining: contract.yearsRemaining,
          startSeason: CURRENT_SEASON,
          endSeason: contract.endSeason,
          hasOption: contract.hasOption,
          optionYear: contract.optionYear,
          contractType: contract.isRookie ? 'rookie' : 'standard',
          isFranchiseTagged: contract.isFranchiseTagged,
          rosterStatus: contract.rosterStatus,
          acquisitionType: 'import',
          acquisitionDetails: { source: 'csv_import', importedAt: new Date() },
        });
        result.contractsCreated++;
      } else {
        // Track expired contract (player on roster but no contract)
        await createExpiredContractRecord({
          leagueId,
          teamId: team.id,
          playerId: player.id,
          rosterStatus: contract.rosterStatus,
          eligibleForFranchiseTag: true,
        });
        result.expiredContracts++;
      }

      result.playersImported++;
    } catch (error) {
      result.errors.push(`Error importing ${row.Player}: ${error.message}`);
    }
  }

  return result;
}
```

#### Franchise Tag Calculation

```typescript
// Pool sizes by position for franchise tag calculation
const FRANCHISE_TAG_POOLS = {
  QB: 10,  // Average of top 10 QB salaries
  WR: 20,  // Average of top 20 WR salaries  
  RB: 20,  // Average of top 20 RB salaries
  TE: 10,  // Average of top 10 TE salaries
};

// Each team can only use ONE franchise tag per year
// Players with blank/expired contracts are eligible to be tagged
async function calculateFranchiseTagValues(leagueId: string): Promise<Record<string, number>> {
  const tagValues: Record<string, number> = {};
  
  for (const [position, poolSize] of Object.entries(FRANCHISE_TAG_POOLS)) {
    const topSalaries = await db.query(`
      SELECT c.salary
      FROM contracts c
      JOIN players p ON c.player_id = p.id
      WHERE c.league_id = $1 
        AND p.position = $2
        AND c.status = 'active'
      ORDER BY c.salary DESC
      LIMIT $3
    `, [leagueId, position, poolSize]);
    
    const sum = topSalaries.reduce((acc, row) => acc + row.salary, 0);
    tagValues[position] = Math.ceil(sum / poolSize);
  }
  
  return tagValues;
}
```

#### Owner Name Mapping

| CSV Owner Name | Sleeper Username | Team Name |
|----------------|------------------|-----------|
| Brian | brcarnag | Trust the Process |
| Mike | miket1326 | Bed, Bath & Bijan |
| Dom | DomDuhBomb | Mazda Marv |
| Willie | bigwily57 | Teta tots |
| Tony | TonyFF | The Great Replacement |
| Garett | Gazarato | CeeDeeC guidelines |
| Cang | CanThePan | Lamborghini Love |
| Trevor | TrevorH42 | Davante's Inferno |
| Abhi | abhanot11 | Healthcare Hero |
| Nick | NickDnof | Danny Dimes Era |
| Zach | zachg1313 | J Jet2Holiday |
| Kyle | Klucido08 | Jeanty juice🧃 |
```

---

## 5. Wireframes & UI Design

### 5.1 App Navigation Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    Bottom Tab Navigation                     │
├─────────────┬─────────────┬─────────────┬─────────────┬─────┤
│   🏠 Home   │  📋 Roster  │  🔄 Trades  │  📊 League  │ ⚙️  │
│  Dashboard  │  Management │   Center    │   Tools     │ More│
└─────────────┴─────────────┴─────────────┴─────────────┴─────┘
```

### 5.2 Screen Wireframes

#### 5.2.1 Dashboard (Home)

```
┌─────────────────────────────────────────────────────────────┐
│ ←  The 586 Dynasty                          🔔 (3)    👤    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Trust the Process          [Brian Carnaghi]        │   │
│  │  Division: King in the North                        │   │
│  │                                                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │   │
│  │  │ Cap Room    │  │ Contract    │  │ Record     │  │   │
│  │  │   $47.50    │  │ Years: 52   │  │ 8-6 (2025) │  │   │
│  │  │ of $500     │  │ (45-75)     │  │ Playoffs ✓ │  │   │
│  │  └─────────────┘  └─────────────┘  └────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  📈 Cap Projection (2026-2030)                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  $500 ─────────────────────────────── Cap Line      │   │
│  │       ┌───┐                                         │   │
│  │  $400 │   │ ┌───┐                                   │   │
│  │       │   │ │   │ ┌───┐                             │   │
│  │  $300 │   │ │   │ │   │ ┌───┐ ┌───┐                │   │
│  │       │452│ │389│ │312│ │245│ │178│                │   │
│  │  $200 │   │ │   │ │   │ │   │ │   │                │   │
│  │       └───┘ └───┘ └───┘ └───┘ └───┘                │   │
│  │       2026  2027  2028  2029  2030                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  🔄 Recent Activity                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📥 Trade Offer from Gazarato           2 hrs ago    │   │
│  │    CeeDee Lamb + 2027 1st for...       [View]       │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ ✅ Trade Completed                      Yesterday    │   │
│  │    Acquired: Josh Allen ($72/3yr)                   │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ 📝 Contract Extended                    2 days ago   │   │
│  │    Bijan Robinson: 3yr/$45 → 5yr/$55                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  🏈 Quick Actions                                          │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐             │
│  │ 📤 Propose │ │ 📋 View    │ │ 🔍 Free    │             │
│  │   Trade    │ │   Roster   │ │   Agents   │             │
│  └────────────┘ └────────────┘ └────────────┘             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 5.2.2 Roster Management

```
┌─────────────────────────────────────────────────────────────┐
│ ←  My Roster                                    🔍  ⋮      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Cap: $452.50 / $500    Contract Years: 52 / 45-75         │
│  ████████████████████░░░░ 90%                              │
│                                                             │
│  [All] [QB] [RB] [WR] [TE] [IR]           Sort: Salary ▼   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 👤 Josh Allen              QB | BUF        [Active] │   │
│  │    $72.00 / 3 years remaining (ends 2028)           │   │
│  │    ┌──────┬──────┬──────┐                           │   │
│  │    │ 2026 │ 2027 │ 2028 │  Acquired: Trade (2025)  │   │
│  │    │ $72  │ $72  │ $72  │                           │   │
│  │    └──────┴──────┴──────┘                           │   │
│  │    [Extend] [Release] [Trade]                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 👤 Bijan Robinson          RB | ATL        [Active] │   │
│  │    $45.00 / 2 years remaining (ends 2027)           │   │
│  │    ★ 5th Year Option Available: $68                 │   │
│  │    ┌──────┬──────┬────────────┐                     │   │
│  │    │ 2026 │ 2027 │ 2028 (Opt) │                     │   │
│  │    │ $45  │ $45  │ $68        │                     │   │
│  │    └──────┴──────┴────────────┘                     │   │
│  │    [Exercise Option] [Trade]                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 👤 Ja'Marr Chase           WR | CIN        [Active] │   │
│  │    $41.00 / 4 years remaining (ends 2029)           │   │
│  │    ┌──────┬──────┬──────┬──────┐                    │   │
│  │    │ 2026 │ 2027 │ 2028 │ 2029 │                    │   │
│  │    │ $41  │ $41  │ $41  │ $41  │                    │   │
│  │    └──────┴──────┴──────┴──────┘                    │   │
│  │    [Extend] [Release] [Trade]                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ... (scrollable list continues)                           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  💀 IR (2 slots)                                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 👤 Chris Olave (IR)        WR | NO         $18/2yr  │   │
│  │ 👤 [Empty Slot]                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 5.2.3 Trade Center

```
┌─────────────────────────────────────────────────────────────┐
│ ←  Trade Center                                 🔔  ⋮      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Inbox (2)] [Sent (1)] [History] [Create Trade]           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📥 PENDING OFFERS                                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  From: CeeDeeC guidelines (Gazarato)                │   │
│  │  ⏰ Expires in: 22 hours                            │   │
│  │                                                     │   │
│  │  YOU RECEIVE:              YOU SEND:                │   │
│  │  ┌──────────────────┐     ┌──────────────────┐     │   │
│  │  │ CeeDee Lamb      │     │ Bijan Robinson   │     │   │
│  │  │ WR | $52/3yr     │     │ RB | $45/2yr     │     │   │
│  │  ├──────────────────┤     ├──────────────────┤     │   │
│  │  │ 2027 1st Round   │     │ 2027 2nd Round   │     │   │
│  │  │ (Gazarato's)     │     │ (Yours)          │     │   │
│  │  └──────────────────┘     └──────────────────┘     │   │
│  │                                                     │   │
│  │  📊 CAP IMPACT:                                     │   │
│  │  Current Cap Room: $47.50                          │   │
│  │  After Trade: $40.50 (-$7.00)                      │   │
│  │  Contract Years: 52 → 53 ✓                         │   │
│  │                                                     │   │
│  │  [Accept ✓] [Reject ✗] [Counter ↩️] [Message 💬]   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  From: Danny Dimes Era (NickDnof)                   │   │
│  │  ⏰ Expires in: 5 days, 14 hours                    │   │
│  │                                                     │   │
│  │  YOU RECEIVE:              YOU SEND:                │   │
│  │  ┌──────────────────┐     ┌──────────────────┐     │   │
│  │  │ Ashton Jeanty    │     │ Josh Allen       │     │   │
│  │  │ RB | $45/4yr     │     │ QB | $72/3yr     │     │   │
│  │  │ (Rookie Option)  │     │                  │     │   │
│  │  ├──────────────────┤     ├──────────────────┤     │   │
│  │  │ Lamar Jackson    │     │ 2027 1st Round   │     │   │
│  │  │ QB | $38/2yr     │     │                  │     │   │
│  │  ├──────────────────┤     └──────────────────┘     │   │
│  │  │ $15 Cap Space    │                              │   │
│  │  └──────────────────┘                              │   │
│  │                                                     │   │
│  │  [View Details →]                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 5.2.4 Create Trade Screen

```
┌─────────────────────────────────────────────────────────────┐
│ ←  Create Trade                                    Preview  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  TRADE WITH:                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [Select Team ▼]                                     │   │
│  │  ○ CeeDeeC guidelines (Gazarato)                    │   │
│  │  ○ Danny Dimes Era (NickDnof)                       │   │
│  │  ○ Bed, Bath & Bijan (miket1326)                    │   │
│  │  ... (all 11 other teams)                           │   │
│  │                                                     │   │
│  │  [+ Add Third Team] (for 3-way trades)              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  TRADE EXPIRES IN:                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ○ 1 Hour    ○ 24 Hours    ● 2 Days    ○ 1 Week    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  YOU SEND:                        YOU RECEIVE:             │
│  ┌────────────────────┐          ┌────────────────────┐   │
│  │ + Add Player       │          │ + Add Player       │   │
│  │ + Add Draft Pick   │          │ + Add Draft Pick   │   │
│  │ + Add Cap Space    │          │ + Add Cap Space    │   │
│  └────────────────────┘          └────────────────────┘   │
│                                                             │
│  ─────────────────────────────────────────────────────     │
│                                                             │
│  SELECTED TO SEND:                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 👤 Bijan Robinson   RB | $45/2yr           [✗]     │   │
│  │ 📜 2027 2nd Round (Your pick)              [✗]     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  SELECTED TO RECEIVE:                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 👤 CeeDee Lamb      WR | $52/3yr           [✗]     │   │
│  │ 📜 2027 1st Round (Their pick)             [✗]     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  📊 TRADE ANALYSIS                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Your Cap Impact:                                   │   │
│  │    Current: $47.50  →  After: $40.50  (-$7.00)     │   │
│  │                                                     │   │
│  │  Contract Years:                                    │   │
│  │    Current: 52  →  After: 53  ✓ (within 45-75)     │   │
│  │                                                     │   │
│  │  ✓ Trade is valid                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  MESSAGE (optional):                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Let me know if you want to negotiate on the pick   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                      [Send Trade Offer]                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 5.2.5 League Tools (Commissioner View)

```
┌─────────────────────────────────────────────────────────────┐
│ ←  League Tools                           👑 Commissioner   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ⚙️ LEAGUE SETTINGS                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Salary Cap                    [$500    ]            │   │
│  │ Min Contract Years            [45      ]            │   │
│  │ Max Contract Years            [75      ]            │   │
│  │ Trade Review Days             [2       ]            │   │
│  │ Require Commissioner Approval [ OFF  ]              │   │
│  │                               [Save Changes]        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  📜 CONTRACT MANAGEMENT                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [Adjust Contract]  Edit any player's contract       │   │
│  │ [Franchise Tags]   View/set tag values by position  │   │
│  │ [Bulk Import]      Import contracts from Excel      │   │
│  │ [Cap Adjustments]  Add manual cap credits/debits    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  🔄 PENDING ACTIONS                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ⚠️ Trade needs review (Sleeper sync)               │   │
│  │    Gazarato traded Derrick Henry to NickDnof        │   │
│  │    [Assign Contract Details]                        │   │
│  │                                                     │   │
│  │ ⚠️ Player added without contract                   │   │
│  │    miket1326 added Rashid Shaheed (FA)              │   │
│  │    [Create Contract]                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  📊 LEAGUE OVERVIEW                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Team                  | Cap Used | Cap Room | Years │   │
│  │ ─────────────────────────────────────────────────── │   │
│  │ Trust the Process     | $452.50  | $47.50   | 52    │   │
│  │ CeeDeeC guidelines    | $478.00  | $22.00   | 61    │   │
│  │ Danny Dimes Era       | $445.00  | $55.00   | 48    │   │
│  │ Bed, Bath & Bijan     | $489.50  | $10.50   | 68    │   │
│  │ Mazda Marv            | $412.00  | $88.00   | 45    │   │
│  │ ... (all teams)                                     │   │
│  │                                         [Export CSV]│   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  🏷️ FRANCHISE TAG VALUES (2025)                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ QB: $44.20  |  RB: $51.30  |  WR: $48.70  |  TE: $29│   │
│  │                           [Recalculate]              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  📅 SEASON ACTIONS                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [Start New Season]      Roll over contracts         │   │
│  │ [Export All Data]       Full league backup          │   │
│  │ [Sync from Sleeper]     Force full sync             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 5.2.6 Player Contract Detail Modal

```
┌─────────────────────────────────────────────────────────────┐
│                           ✕                                 │
│                                                             │
│              [Player Photo]                                 │
│                                                             │
│           BIJAN ROBINSON                                    │
│            RB | Atlanta Falcons                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  CONTRACT DETAILS                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Current Salary:        $45.00                      │   │
│  │  Years Remaining:       2 (ends 2027)               │   │
│  │  Contract Type:         Rookie (1st Round)          │   │
│  │  Acquired:              2024 Rookie Draft (1.03)    │   │
│  │  Original Team:         Trust the Process           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  5TH YEAR OPTION                                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ★ Eligible for 5th year option                     │   │
│  │  Option Salary: $68.00 (1.5x of $45, rounded up)    │   │
│  │  Option Year: 2028                                  │   │
│  │  Deadline: Before 2027 season starts                │   │
│  │                                                     │   │
│  │              [Exercise Option]                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  SALARY SCHEDULE                                           │
│  ┌──────────┬──────────┬──────────┬──────────┐            │
│  │   2026   │   2027   │   2028   │   2029   │            │
│  │  $45.00  │  $45.00  │  $68.00* │    -     │            │
│  │ Current  │ Final Yr │ *Option  │          │            │
│  └──────────┴──────────┴──────────┴──────────┘            │
│                                                             │
│  RELEASE ANALYSIS                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  If released now:                                   │   │
│  │    Dead Money: $23.00 (2 yrs × 25% = 50% of $45)   │   │
│  │    Cap Savings: $22.00                              │   │
│  │                                                     │   │
│  │  If released after 2026:                            │   │
│  │    Dead Money: $12.00 (1 yr × 25% = 25% of $45)    │   │
│  │    Cap Savings: $33.00                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐             │
│  │  📤 Trade  │ │  📝 Extend │ │  🗑️ Release│             │
│  └────────────┘ └────────────┘ └────────────┘             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. User Flows

### 6.1 First-Time Setup Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Welcome       │     │   Connect       │     │   Select        │
│   Screen        │────▶│   Sleeper       │────▶│   League        │
│                 │     │   Account       │     │                 │
│ "Get Started"   │     │ Enter username  │     │ Show all NFL    │
│                 │     │ or OAuth        │     │ leagues user is │
│                 │     │                 │     │ part of         │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Dashboard     │     │   Import        │     │   League        │
│   Ready!        │◀────│   Complete      │◀────│   Setup         │
│                 │     │                 │     │                 │
│ All data synced │     │ Show import     │     │ Commissioner:   │
│ Contracts ready │     │ results/errors  │     │ Upload Excel    │
│                 │     │                 │     │ Others: Wait    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 6.2 Sending a Trade Flow

```
Step 1: Initiate Trade
┌────────────────────────────────────────────────────────────────┐
│ User taps "Propose Trade" from dashboard or opponent's roster  │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
Step 2: Select Trade Partner(s)
┌────────────────────────────────────────────────────────────────┐
│ • Choose primary trade partner from team list                   │
│ • Optionally add a third team for 3-way trade                   │
│ • System loads their roster and available assets               │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
Step 3: Build Trade Package
┌────────────────────────────────────────────────────────────────┐
│ • Select players to send (shows contract details)               │
│ • Select draft picks to send (shows which years/rounds)         │
│ • Add cap space to send (if applicable)                         │
│ • Repeat for assets to receive                                  │
│ • Real-time cap impact calculator updates as selections change │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
Step 4: Set Expiration
┌────────────────────────────────────────────────────────────────┐
│ • Choose expiration: 1 hour, 24 hours, 2 days, or 1 week       │
│ • Add optional message to trade partner                        │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
Step 5: Validate & Preview
┌────────────────────────────────────────────────────────────────┐
│ System validates:                                               │
│ • Both teams remain under $500 cap                             │
│ • Both teams remain within 45-75 contract years                │
│ • Roster limits not exceeded                                    │
│ If invalid → Show errors, prevent submission                    │
│ If valid → Show full preview with cap impacts                  │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
Step 6: Submit Trade
┌────────────────────────────────────────────────────────────────┐
│ • Trade saved to database with status "pending"                 │
│ • Expiration timestamp set                                      │
│ • Notifications sent to trade partner(s):                       │
│   - Push notification                                           │
│   - In-app notification                                         │
│   - (Optional) Sleeper DM via bot if configured                │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
Step 7: Await Response
┌────────────────────────────────────────────────────────────────┐
│ Trade partner can:                                              │
│ • Accept → Trade completes, contracts transfer                  │
│ • Reject → Trade cancelled, initiator notified                 │
│ • Counter → Creates new trade, original cancelled              │
│ • Ignore → Auto-expires at deadline                            │
│ • Message → Opens trade chat for negotiation                   │
└────────────────────────────────────────────────────────────────┘
```

### 6.3 Trade Acceptance Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Notification   │     │   Trade         │     │   Validate      │
│  Received       │────▶│   Details       │────▶│   Trade         │
│                 │     │   Screen        │     │                 │
│ "New trade      │     │ View full       │     │ Re-check caps   │
│  offer from..." │     │ package & caps  │     │ Re-check years  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                              ┌──────────────────────────┤
                              │                          │
                        [Still Valid]              [Invalid]
                              │                          │
                              ▼                          ▼
                ┌─────────────────┐     ┌─────────────────┐
                │   Confirm       │     │   Show Error    │
                │   Acceptance    │     │                 │
                │                 │     │ "Trade no longer│
                │ "Accept this    │     │  valid because  │
                │  trade?"        │     │  [reason]"      │
                └─────────────────┘     └─────────────────┘
                        │
                        ▼
                ┌─────────────────┐
                │   Execute       │
                │   Trade         │
                │                 │
                │ • Transfer      │
                │   contracts     │
                │ • Update picks  │
                │ • Log history   │
                │ • Notify all    │
                └─────────────────┘
```

### 6.4 Contract Extension Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  View Player    │     │  Extension      │     │  Preview        │
│  Contract       │────▶│  Options        │────▶│  New Contract   │
│                 │     │                 │     │                 │
│ Tap "Extend"    │     │ Select new:     │     │ Show full       │
│                 │     │ • Years (1-5)   │     │ salary schedule │
│                 │     │ • Salary        │     │ and cap impact  │
│                 │     │ (min enforced)  │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │  Confirm        │
                                                │  Extension      │
                                                │                 │
                                                │ • Update DB     │
                                                │ • Log history   │
                                                │ • Show success  │
                                                └─────────────────┘
```

---

## 7. API Integration

### 7.1 Sleeper API Usage

| Endpoint | Frequency | Purpose |
|----------|-----------|---------|
| `/league/{id}` | On app open, daily | League settings, status |
| `/league/{id}/rosters` | Every 5 min (in-season) | Current rosters, IR |
| `/league/{id}/users` | Daily | Owner info, team names |
| `/league/{id}/transactions/{week}` | Every 5 min (in-season) | Detect Sleeper trades/adds |
| `/league/{id}/matchups/{week}` | Hourly (gameday) | Scores, standings |
| `/league/{id}/traded_picks` | Daily | Draft pick ownership |
| `/draft/{id}/picks` | After draft | Rookie draft results |
| `/players/nfl` | Weekly | Player database (cache heavily) |

### 7.2 API Rate Limiting Strategy

Sleeper doesn't publish rate limits, but we'll be conservative:

```typescript
const SYNC_CONFIG = {
  // In-season (September - January)
  inSeason: {
    rosterSync: '*/5 * * * *',      // Every 5 minutes
    transactionSync: '*/5 * * * *', // Every 5 minutes
    matchupSync: '0 * * * *',       // Every hour
    playerSync: '0 0 * * 0',        // Weekly on Sunday midnight
  },
  // Off-season
  offSeason: {
    rosterSync: '0 */4 * * *',      // Every 4 hours
    transactionSync: '0 */4 * * *', // Every 4 hours
    playerSync: '0 0 * * 0',        // Weekly
  },
  // Draft period (August)
  draftPeriod: {
    rosterSync: '*/2 * * * *',      // Every 2 minutes
    draftSync: '*/1 * * * *',       // Every minute during active draft
  }
};
```

### 7.3 Backend API Endpoints

```typescript
// Authentication
POST   /api/auth/sleeper-connect     // Connect Sleeper account
GET    /api/auth/me                  // Get current user
POST   /api/auth/logout              // Logout

// Leagues
GET    /api/leagues                  // List user's leagues
POST   /api/leagues                  // Add new league (from Sleeper)
GET    /api/leagues/:id              // Get league details
PUT    /api/leagues/:id/settings     // Update league settings (commissioner)

// Teams
GET    /api/leagues/:id/teams        // List all teams in league
GET    /api/teams/:id                // Get team details
GET    /api/teams/:id/roster         // Get team roster with contracts
GET    /api/teams/:id/cap-summary    // Get cap summary & projections
GET    /api/teams/:id/draft-picks    // Get owned draft picks

// Contracts
GET    /api/contracts/:id            // Get contract details
POST   /api/contracts                // Create contract (commissioner)
PUT    /api/contracts/:id            // Update contract (commissioner)
POST   /api/contracts/:id/extend     // Extend contract
POST   /api/contracts/:id/release    // Release player
POST   /api/contracts/:id/option     // Exercise rookie option

// Trades
GET    /api/trades                   // List trades (with filters)
POST   /api/trades                   // Create trade offer
GET    /api/trades/:id               // Get trade details
PUT    /api/trades/:id/accept        // Accept trade
PUT    /api/trades/:id/reject        // Reject trade
PUT    /api/trades/:id/cancel        // Cancel trade (sender only)
POST   /api/trades/:id/counter       // Counter offer
POST   /api/trades/:id/messages      // Add trade chat message

// Draft Picks
GET    /api/leagues/:id/draft-picks  // All picks for league
PUT    /api/draft-picks/:id          // Update pick ownership

// Commissioner Tools
POST   /api/leagues/:id/import       // Import Excel
POST   /api/leagues/:id/sync         // Force Sleeper sync
PUT    /api/leagues/:id/cap-adjustment // Manual cap adjustment
GET    /api/leagues/:id/franchise-tags // Get tag values
POST   /api/leagues/:id/new-season   // Roll over to new season

// Notifications
GET    /api/notifications            // Get user notifications
PUT    /api/notifications/:id/read   // Mark as read
PUT    /api/notifications/read-all   // Mark all as read
```

---

## 8. Technical Implementation

### 8.1 React Native App Structure

```
the586-app/
├── app/                          # Expo Router (file-based routing)
│   ├── (auth)/                   # Auth group
│   │   ├── login.tsx
│   │   └── connect-sleeper.tsx
│   ├── (tabs)/                   # Main tab navigation
│   │   ├── _layout.tsx
│   │   ├── index.tsx             # Dashboard
│   │   ├── roster.tsx
│   │   ├── trades.tsx
│   │   ├── league.tsx
│   │   └── settings.tsx
│   ├── trade/
│   │   ├── [id].tsx              # Trade detail
│   │   └── create.tsx            # Create trade
│   ├── player/
│   │   └── [id].tsx              # Player contract detail
│   └── _layout.tsx
├── components/
│   ├── ui/                       # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   └── ...
│   ├── roster/
│   │   ├── RosterTable.tsx
│   │   ├── PlayerCard.tsx
│   │   └── ContractBadge.tsx
│   ├── trades/
│   │   ├── TradeCard.tsx
│   │   ├── TradeBuilder.tsx
│   │   └── CapImpactChart.tsx
│   └── charts/
│       ├── CapProjectionChart.tsx
│       └── ContractTimeline.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useLeague.ts
│   ├── useRoster.ts
│   ├── useTrades.ts
│   └── useNotifications.ts
├── services/
│   ├── api.ts                    # API client
│   ├── sleeper.ts                # Sleeper API helpers
│   └── notifications.ts          # Push notification setup
├── stores/                       # Zustand stores
│   ├── authStore.ts
│   ├── leagueStore.ts
│   └── tradeStore.ts
├── utils/
│   ├── contracts.ts              # Contract calculation helpers
│   ├── formatting.ts             # Currency, date formatting
│   └── validation.ts             # Trade validation
├── constants/
│   ├── colors.ts
│   ├── config.ts
│   └── salaries.ts               # Rookie draft values, minimums
└── types/
    ├── api.ts
    ├── contract.ts
    ├── trade.ts
    └── sleeper.ts
```

### 8.2 Key Implementation: Contract Calculations

```typescript
// utils/contracts.ts

export const MIN_SALARIES: Record<number, number> = {
  1: 1, 2: 4, 3: 8, 4: 12, 5: 15,
};

export const ROOKIE_DRAFT_VALUES: RookieDraftValue[] = [
  // Round 1 (4-year contracts with 5th year option at 1.5x)
  { round: 1, pick: 1, salary: 45, years: 4, hasOption: true },
  { round: 1, pick: 2, salary: 38, years: 4, hasOption: true },
  { round: 1, pick: 3, salary: 32, years: 4, hasOption: true },
  { round: 1, pick: 4, salary: 27, years: 4, hasOption: true },
  { round: 1, pick: 5, salary: 23, years: 4, hasOption: true },
  { round: 1, pick: 6, salary: 19, years: 4, hasOption: true },
  { round: 1, pick: 7, salary: 16, years: 4, hasOption: true },
  { round: 1, pick: 8, salary: 14, years: 4, hasOption: true },
  { round: 1, pick: 9, salary: 13, years: 4, hasOption: true },
  { round: 1, pick: 10, salary: 12, years: 4, hasOption: true },
  { round: 1, pick: 11, salary: 11, years: 4, hasOption: true },
  { round: 1, pick: 12, salary: 10, years: 4, hasOption: true },
  // Round 2 (4-year contracts with 5th year option at 1.5x)
  { round: 2, pick: 1, salary: 9, years: 4, hasOption: true },
  { round: 2, pick: 2, salary: 9, years: 4, hasOption: true },
  { round: 2, pick: 3, salary: 9, years: 4, hasOption: true },
  { round: 2, pick: 4, salary: 8, years: 4, hasOption: true },
  { round: 2, pick: 5, salary: 8, years: 4, hasOption: true },
  { round: 2, pick: 6, salary: 8, years: 4, hasOption: true },
  { round: 2, pick: 7, salary: 7, years: 4, hasOption: true },
  { round: 2, pick: 8, salary: 7, years: 4, hasOption: true },
  { round: 2, pick: 9, salary: 6, years: 4, hasOption: true },
  { round: 2, pick: 10, salary: 6, years: 4, hasOption: true },
  { round: 2, pick: 11, salary: 5, years: 4, hasOption: true },
  { round: 2, pick: 12, salary: 5, years: 4, hasOption: true },
  // Round 3 (3-year contracts, no option)
  { round: 3, pick: 1, salary: 1, years: 3, hasOption: false },
  { round: 3, pick: 2, salary: 1, years: 3, hasOption: false },
  { round: 3, pick: 3, salary: 1, years: 3, hasOption: false },
  { round: 3, pick: 4, salary: 1, years: 3, hasOption: false },
  { round: 3, pick: 5, salary: 1, years: 3, hasOption: false },
  { round: 3, pick: 6, salary: 1, years: 3, hasOption: false },
  { round: 3, pick: 7, salary: 1, years: 3, hasOption: false },
  { round: 3, pick: 8, salary: 1, years: 3, hasOption: false },
  { round: 3, pick: 9, salary: 1, years: 3, hasOption: false },
  { round: 3, pick: 10, salary: 1, years: 3, hasOption: false },
  { round: 3, pick: 11, salary: 1, years: 3, hasOption: false },
  { round: 3, pick: 12, salary: 1, years: 3, hasOption: false },
];

// Dead Cap Percentages by Contract Length
// Row = Total contract years, Column = Which year of contract player is released
export const DEAD_CAP_PERCENTAGES: Record<number, Record<number, number>> = {
  //        Year 1   Year 2   Year 3   Year 4   Year 5
  5: { 1: 0.75, 2: 0.50, 3: 0.25, 4: 0.10, 5: 0.10 },
  4: { 1: 0.75, 2: 0.50, 3: 0.25, 4: 0.10 },
  3: { 1: 0.50, 2: 0.25, 3: 0.10 },
  2: { 1: 0.50, 2: 0.25 },
  1: { 1: 0.50 },
};

/*
  DEAD CAP EXAMPLES:
  - 5-year $50 contract, released in year 1: $50 × 75% = $38 dead cap
  - 5-year $50 contract, released in year 3: $50 × 25% = $13 dead cap  
  - 3-year $30 contract, released in year 1: $30 × 50% = $15 dead cap
  - 2-year $20 contract, released in year 2: $20 × 25% = $5 dead cap
  - 1-year $10 contract, released in year 1: $10 × 50% = $5 dead cap
  - Any $1 contract released: $1 dead cap (always, regardless of years)

  ADDITIONAL RULES:
  - Players dropped cannot be re-added until they clear waivers
  - FA players on season-ending IR cannot be signed to long-term contracts
*/

export function calculateOptionSalary(baseSalary: number): number {
  return Math.ceil(baseSalary * 1.5);
}

export function validateSalary(salary: number, years: number): ValidationResult {
  const minSalary = MIN_SALARIES[years];
  if (salary < minSalary) {
    return {
      valid: false,
      message: `Minimum salary for ${years}-year contract is $${minSalary}`,
    };
  }
  return { valid: true };
}

export function calculateReleaseDeadMoney(
  contract: { salary: number; yearsTotal: number; yearsRemaining: number }
): number {
  const { salary, yearsTotal, yearsRemaining } = contract;
  const currentYear = yearsTotal - yearsRemaining + 1;
  
  // $1 contracts always retain full cap hit
  if (salary === 1) return 1;
  
  // Get percentage from dead cap table
  const percentages = DEAD_CAP_PERCENTAGES[yearsTotal];
  const deadCapPercent = percentages?.[currentYear] ?? 0.5;
  
  // All percentages rounded UP per league rules
  return Math.ceil(salary * deadCapPercent);
}

// Retirement dead money calculation
export function calculateRetirementDeadMoney(
  contract: { salary: number; yearsRemaining: number },
  playerAge: number
): number {
  // Player retires after age 30: 25% of salary for remaining years
  if (playerAge >= 30) {
    return Math.ceil(contract.salary * 0.25) * contract.yearsRemaining;
  }
  // Player retires before age 30: no penalty
  return 0;
}

export function projectCapSpace(
  contracts: Contract[],
  salaryCap: number,
  seasons: number[]
): CapProjection[] {
  return seasons.map(season => {
    const activeContracts = contracts.filter(
      c => c.startSeason <= season && c.endSeason >= season
    );
    const totalSalary = activeContracts.reduce((sum, c) => sum + c.salary, 0);
    
    return {
      season,
      totalSalary,
      capRoom: salaryCap - totalSalary,
      playerCount: activeContracts.length,
      contractYears: activeContracts.reduce((sum, c) => {
        const yearsInSeason = Math.min(c.endSeason, season) - season + 1;
        return sum + yearsInSeason;
      }, 0),
    };
  });
}

export function getRookieDraftValue(round: number, pick: number): RookieDraftValue {
  if (round >= 3) {
    return { round, pick, salary: 1, years: 3, hasOption: false };
  }
  
  const value = ROOKIE_DRAFT_VALUES.find(
    v => v.round === round && v.pick === pick
  );
  
  if (!value) {
    throw new Error(`Invalid draft pick: ${round}.${pick}`);
  }
  
  return value;
}
```

### 8.3 Trade Validation Implementation

```typescript
// utils/tradeValidation.ts

interface TradeValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  capImpacts: Record<string, TeamCapImpact>;
}

interface TeamCapImpact {
  teamId: string;
  teamName: string;
  currentCapRoom: number;
  salaryIn: number;
  salaryOut: number;
  capIn: number;
  capOut: number;
  netChange: number;
  newCapRoom: number;
  currentYears: number;
  yearsIn: number;
  yearsOut: number;
  newYears: number;
}

export async function validateTrade(
  trade: TradeProposal,
  leagueSettings: LeagueSettings
): Promise<TradeValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const capImpacts: Record<string, TeamCapImpact> = {};

  // Get unique team IDs
  const teamIds = [...new Set([
    ...trade.assets.map(a => a.fromTeamId),
    ...trade.assets.map(a => a.toTeamId),
  ])];

  for (const teamId of teamIds) {
    const team = await getTeam(teamId);
    const currentCap = await getTeamCapSummary(teamId);

    // Calculate incoming/outgoing
    const playersIn = trade.assets.filter(
      a => a.toTeamId === teamId && a.assetType === 'player'
    );
    const playersOut = trade.assets.filter(
      a => a.fromTeamId === teamId && a.assetType === 'player'
    );
    const capIn = trade.assets.filter(
      a => a.toTeamId === teamId && a.assetType === 'cap_space'
    );
    const capOut = trade.assets.filter(
      a => a.fromTeamId === teamId && a.assetType === 'cap_space'
    );

    const salaryIn = playersIn.reduce((sum, a) => sum + a.contract!.salary, 0);
    const salaryOut = playersOut.reduce((sum, a) => sum + a.contract!.salary, 0);
    const capSpaceIn = capIn.reduce((sum, a) => sum + a.capAmount!, 0);
    const capSpaceOut = capOut.reduce((sum, a) => sum + a.capAmount!, 0);

    const netChange = (salaryOut - salaryIn) + (capSpaceIn - capSpaceOut);
    const newCapRoom = currentCap.capRoom + netChange;

    const yearsIn = playersIn.reduce((sum, a) => sum + a.contract!.yearsRemaining, 0);
    const yearsOut = playersOut.reduce((sum, a) => sum + a.contract!.yearsRemaining, 0);
    const newYears = currentCap.totalContractYears + yearsIn - yearsOut;

    capImpacts[teamId] = {
      teamId,
      teamName: team.teamName,
      currentCapRoom: currentCap.capRoom,
      salaryIn,
      salaryOut,
      capIn: capSpaceIn,
      capOut: capSpaceOut,
      netChange,
      newCapRoom,
      currentYears: currentCap.totalContractYears,
      yearsIn,
      yearsOut,
      newYears,
    };

    // Validation checks
    if (newCapRoom < 0) {
      errors.push(
        `${team.teamName} would be $${Math.abs(newCapRoom).toFixed(2)} over the salary cap`
      );
    }

    if (newYears < leagueSettings.minContractYears) {
      errors.push(
        `${team.teamName} would have only ${newYears} contract years (minimum: ${leagueSettings.minContractYears})`
      );
    }

    if (newYears > leagueSettings.maxContractYears) {
      errors.push(
        `${team.teamName} would have ${newYears} contract years (maximum: ${leagueSettings.maxContractYears})`
      );
    }

    // Roster size check (warning, not error)
    const newRosterSize = currentCap.playerCount + playersIn.length - playersOut.length;
    if (newRosterSize > 25) {
      warnings.push(
        `${team.teamName} would have ${newRosterSize} players (roster limit: 25)`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    capImpacts,
  };
}
```

### 8.4 Trade Expiration Cloud Function

```typescript
// functions/src/tradeExpiration.ts

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const checkTradeExpirations = functions.pubsub
  .schedule('every 1 minutes')
  .timeZone('America/Detroit') // EST for The 586
  .onRun(async (context) => {
    const client = await pool.connect();
    
    try {
      // Find and update expired trades
      const result = await client.query(`
        UPDATE trades
        SET 
          status = 'expired',
          updated_at = NOW()
        WHERE 
          status = 'pending' 
          AND expires_at <= NOW()
        RETURNING 
          id, 
          initiator_team_id,
          (SELECT array_agg(team_id) FROM trade_participants WHERE trade_id = trades.id) as participant_ids
      `);

      const expiredTrades = result.rows;
      console.log(`Found ${expiredTrades.length} expired trades`);

      // Send notifications for each expired trade
      for (const trade of expiredTrades) {
        await sendExpirationNotifications(trade);
      }

      return null;
    } finally {
      client.release();
    }
  });

async function sendExpirationNotifications(trade: any) {
  const firestore = admin.firestore();
  const batch = firestore.batch();

  for (const teamId of trade.participant_ids) {
    // Get user ID for team
    const teamResult = await pool.query(
      'SELECT sleeper_user_id, team_name FROM teams WHERE id = $1',
      [teamId]
    );
    const team = teamResult.rows[0];

    // Create Firestore notification
    const notificationRef = firestore.collection('notifications').doc();
    batch.set(notificationRef, {
      userId: team.sleeper_user_id,
      type: 'trade_expired',
      title: 'Trade Expired',
      body: `Your trade offer has expired`,
      data: { tradeId: trade.id },
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();

  // Send push notifications via FCM
  // ... (FCM implementation)
}
```

---

## 9. Security & Permissions

### 9.1 Role-Based Access Control

```typescript
enum Role {
  COMMISSIONER = 'commissioner', // Up to 3 per league
  OWNER = 'owner',
}

// Commissioner management
interface LeagueCommissioners {
  leagueId: string;
  commissionerIds: string[]; // Max 3 user IDs
  primaryCommissionerId: string; // The original/main commissioner
}

interface Permission {
  action: string;
  resource: string;
  conditions?: Record<string, any>;
}

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.COMMISSIONER]: [
    { action: 'read', resource: '*' },
    { action: 'write', resource: '*' },
    { action: 'manage', resource: 'league_settings' },
    { action: 'manage', resource: 'contracts' },
    { action: 'manage', resource: 'cap_adjustments' },
    { action: 'import', resource: 'excel' },
    { action: 'approve', resource: 'trades' },
    { action: 'rollover', resource: 'season' },
  ],
  [Role.OWNER]: [
    { action: 'read', resource: 'league' },
    { action: 'read', resource: 'teams' },
    { action: 'read', resource: 'contracts' },
    { action: 'read', resource: 'trades' },
    { action: 'write', resource: 'own_team', conditions: { teamId: 'self' } },
    { action: 'create', resource: 'trades' },
    { action: 'respond', resource: 'trades', conditions: { isParticipant: true } },
    { action: 'extend', resource: 'contracts', conditions: { teamId: 'self' } },
    { action: 'release', resource: 'contracts', conditions: { teamId: 'self' } },
  ],
};
```

### 9.2 Data Access Rules

```typescript
// Middleware for API routes
function authorize(requiredPermission: Permission) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    const userRole = await getUserRole(user.id, req.params.leagueId);
    const permissions = ROLE_PERMISSIONS[userRole];

    const hasPermission = permissions.some(p => {
      if (p.action !== requiredPermission.action) return false;
      if (p.resource !== '*' && p.resource !== requiredPermission.resource) return false;
      
      // Check conditions
      if (p.conditions) {
        if (p.conditions.teamId === 'self') {
          return req.params.teamId === user.teamId;
        }
        if (p.conditions.isParticipant) {
          // Check if user is participant in trade
          return checkTradeParticipant(req.params.tradeId, user.teamId);
        }
      }
      
      return true;
    });

    if (!hasPermission) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  };
}

// Usage
app.put('/api/leagues/:leagueId/settings', 
  authorize({ action: 'manage', resource: 'league_settings' }),
  updateLeagueSettings
);

app.post('/api/contracts/:id/extend',
  authorize({ action: 'extend', resource: 'contracts' }),
  extendContract
);
```

---

## 10. Development Roadmap

### Phase 1: MVP (8 weeks)
**Goal**: Core functionality for roster viewing and trade management

| Week | Focus | Deliverables |
|------|-------|--------------|
| 1-2 | **Backend Setup** | GCP infrastructure, PostgreSQL schema, basic API |
| 3-4 | **Sleeper Integration** | Auth flow, roster sync, player data sync |
| 5-6 | **Mobile App Core** | React Native setup, navigation, dashboard, roster view |
| 7-8 | **Trade System** | Create/accept/reject trades, expiration logic, notifications |

**MVP Features**:
- ✅ Connect Sleeper account
- ✅ View league and all team rosters
- ✅ View contract details (after Excel import)
- ✅ Cap room and contract year tracking
- ✅ Send/receive/accept/reject trades
- ✅ Trade expiration (1hr/24hr/2d/1wk)
- ✅ Push notifications for trades
- ✅ Commissioner: Import Excel data

### Phase 2: Enhanced Features (4 weeks)
**Goal**: Full contract management and cap projections

| Week | Focus | Deliverables |
|------|-------|--------------|
| 9-10 | **Contract Management** | Extensions, releases, dead money, rookie options |
| 11-12 | **Cap Projections** | Multi-year projections, charts, scenario planning |

**Phase 2 Features**:
- ✅ Extend player contracts
- ✅ Release players with dead money
- ✅ Exercise rookie 5th year options
- ✅ 5-year cap projection charts
- ✅ "What-if" cap scenarios
- ✅ Trade chat/messaging

### Phase 3: League Tools (4 weeks)
**Goal**: Commissioner tools and league-wide features

| Week | Focus | Deliverables |
|------|-------|--------------|
| 13-14 | **Commissioner Dashboard** | Settings management, manual adjustments, franchise tags |
| 15-16 | **Polish & Multi-League** | Support multiple leagues, UI polish, performance |

**Phase 3 Features**:
- ✅ Full commissioner dashboard
- ✅ Franchise tag calculations
- ✅ Manual cap adjustments
- ✅ Season rollover automation
- ✅ Support multiple leagues per user
- ✅ League activity feed
- ✅ Historical data views

### Phase 4: Future Enhancements (Backlog)
- Public trade block
- Trade analyzer (value comparison)
- Sleeper bot integration for league chat
- Web admin dashboard
- Advanced analytics
- Custom notifications settings

---

## 11. Deployment & Infrastructure

### 11.1 Google Cloud Setup

```bash
# Project Setup
gcloud projects create the586-dynasty
gcloud config set project the586-dynasty

# Enable APIs
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  firestore.googleapis.com \
  cloudfunctions.googleapis.com \
  cloudscheduler.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com

# Cloud SQL (PostgreSQL)
gcloud sql instances create the586-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --storage-size=10GB

gcloud sql databases create the586 --instance=the586-db

# Create service account for Cloud Run
gcloud iam service-accounts create the586-api \
  --display-name="The 586 API Service Account"

# Deploy API to Cloud Run
gcloud run deploy the586-api \
  --source . \
  --region=us-central1 \
  --allow-unauthenticated \
  --set-env-vars="DATABASE_URL=postgresql://..." \
  --service-account=the586-api@the586-dynasty.iam.gserviceaccount.com

# Set up Cloud Scheduler for trade expirations
gcloud scheduler jobs create pubsub trade-expiration-check \
  --schedule="* * * * *" \
  --topic=trade-expirations \
  --message-body="{}" \
  --time-zone="America/Detroit"
```

### 11.2 Mobile App Deployment

**iOS (App Store)**:
1. Create Apple Developer account ($99/year)
2. Generate certificates and provisioning profiles
3. Build with `eas build --platform ios`
4. Submit via App Store Connect

**Android (Play Store)**:
1. Create Google Play Developer account ($25 one-time)
2. Generate signing keystore
3. Build with `eas build --platform android`
4. Submit via Google Play Console

**Using Expo EAS** (recommended for React Native):
```bash
# Install EAS CLI
npm install -g eas-cli

# Configure project
eas build:configure

# Build for both platforms
eas build --platform all

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

### 11.3 CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Auth to GCP
        uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      
      - name: Deploy to Cloud Run
        uses: google-github-actions/deploy-cloudrun@v1
        with:
          service: the586-api
          region: us-central1
          source: ./backend

  build-mobile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Install dependencies
        run: cd mobile && npm install
      
      - name: Build with EAS
        run: cd mobile && npx eas-cli build --platform all --non-interactive
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
```

### 11.4 Cost Estimate

| Service | Monthly Cost |
|---------|--------------|
| Cloud Run (API) | $5-15 |
| Cloud SQL (db-f1-micro) | $10 |
| Firestore | $1-5 |
| Cloud Functions | $0-2 |
| Cloud Storage | $1-2 |
| Cloud Scheduler | $0-1 |
| **Total** | **~$20-35/month** |

**One-time costs**:
- Apple Developer Account: $99/year
- Google Play Developer: $25 (one-time)
- Domain (optional): ~$12/year

---

## 12. Next Steps

### Immediate Actions (This Week)

1. ✅ **CSV Import Mapped** - Column mapping finalized (Section 4.4)
2. **Set up GCP project** and enable required APIs
3. **Create PostgreSQL database** with schema
4. **Initialize React Native project** with Expo
5. **Test Sleeper API integration** with your league ID
6. **Run CSV import** to populate initial data

### Questions for You

1. ~~**Excel File**~~: ✅ **ANSWERED** - CSV imported, column mapping finalized (see Section 4.4)

2. ~~**Rookie Draft Values**~~: ✅ **ANSWERED** - Corrected values implemented (1.01=$45, 1.02=$38, 1.03=$32, etc.)

3. ~~**Dead Money Formula**~~: ✅ **ANSWERED** - Detailed percentage table implemented based on contract length and current year

4. ~~**Commissioner Access**~~: ✅ **ANSWERED** - Up to 3 commissioners per league

5. ~~**Trade Approval**~~: ✅ **ANSWERED** - Configurable: Auto-approval, Commissioner approval, or League Vote (24/48hr window)

6. ~~**Historical Import Priority**~~: ✅ **ANSWERED** - Defer to later, focus on current state first

---

## Appendix A: Sleeper API Reference

Based on the PDF you provided and Sleeper's public documentation:

### Key Endpoints Used

```
GET /user/{username}                    - Get user by username
GET /user/{user_id}/leagues/nfl/{season} - Get user's leagues
GET /league/{league_id}                 - Get league info
GET /league/{league_id}/rosters         - Get all rosters
GET /league/{league_id}/users           - Get league users
GET /league/{league_id}/matchups/{week} - Get matchups
GET /league/{league_id}/transactions/{round} - Get transactions
GET /league/{league_id}/traded_picks    - Get traded draft picks
GET /draft/{draft_id}                   - Get draft info
GET /draft/{draft_id}/picks             - Get draft picks
GET /players/nfl                        - Get all NFL players
```

### Sleeper API Limitations

- **No OAuth**: Sleeper doesn't have public OAuth; we use username lookup
- **No Write API**: Cannot push roster changes back to Sleeper
- **No Webhooks**: Must poll for changes
- **Rate Limits**: Undocumented, but be conservative (1 req/sec max)

---

*Document generated for The 586 Dynasty League*  
*League ID: 1315789488873553920*  
*Commissioner: Brian Carnaghi (brcarnag)*
