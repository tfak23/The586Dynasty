-- =============================================
-- THE 586 DYNASTY - DATABASE SCHEMA
-- PostgreSQL 15+
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- LEAGUES TABLE
-- =============================================
CREATE TABLE leagues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sleeper_league_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    
    -- Cap Settings
    salary_cap DECIMAL(10,2) NOT NULL DEFAULT 500.00,
    min_contract_years INT NOT NULL DEFAULT 45,
    max_contract_years INT NOT NULL DEFAULT 75,
    
    -- Trade Settings
    trade_approval_mode VARCHAR(20) NOT NULL DEFAULT 'auto' CHECK (trade_approval_mode IN ('auto', 'commissioner', 'league_vote')),
    league_vote_window_hours INT DEFAULT 24 CHECK (league_vote_window_hours IN (24, 48)),
    veto_threshold DECIMAL(3,2) DEFAULT 0.50,
    
    -- Season Info
    current_season INT NOT NULL DEFAULT 2025,
    
    -- Metadata from Sleeper
    total_rosters INT DEFAULT 12,
    roster_positions JSONB,
    scoring_settings JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TEAMS TABLE
-- =============================================
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    
    -- Sleeper Mapping
    sleeper_roster_id INT NOT NULL,
    sleeper_user_id VARCHAR(50),
    
    -- Team Info
    team_name VARCHAR(100),
    owner_name VARCHAR(100),
    avatar_url VARCHAR(255),
    
    -- Division (for 12-team leagues)
    division VARCHAR(50),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(league_id, sleeper_roster_id)
);

-- =============================================
-- LEAGUE COMMISSIONERS TABLE
-- =============================================
CREATE TABLE league_commissioners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    
    is_primary BOOLEAN DEFAULT FALSE,
    permissions JSONB DEFAULT '{"can_edit_contracts": true, "can_approve_trades": true, "can_manage_league": true}',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(league_id, team_id)
);

-- =============================================
-- PLAYERS TABLE (cached from Sleeper)
-- =============================================
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sleeper_player_id VARCHAR(20) UNIQUE NOT NULL,
    
    -- Player Info
    full_name VARCHAR(100) NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    position VARCHAR(10) NOT NULL,
    team VARCHAR(10), -- NFL team abbreviation
    
    -- Additional Info
    age INT,
    years_exp INT,
    college VARCHAR(100),
    number INT,
    status VARCHAR(20), -- Active, Inactive, IR, etc.
    
    -- Metadata
    search_full_name VARCHAR(100), -- Lowercase for searching
    search_last_name VARCHAR(50),
    
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- CONTRACTS TABLE
-- =============================================
CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    
    -- Contract Details
    salary DECIMAL(10,2) NOT NULL,
    years_total INT NOT NULL CHECK (years_total BETWEEN 1 AND 5),
    years_remaining INT NOT NULL CHECK (years_remaining >= 0),
    start_season INT NOT NULL,
    end_season INT NOT NULL,
    
    -- Contract Type
    contract_type VARCHAR(20) NOT NULL DEFAULT 'standard' CHECK (contract_type IN ('standard', 'rookie', 'extension', 'free_agent', 'tag')),
    
    -- Options
    has_option BOOLEAN DEFAULT FALSE,
    option_year INT,
    option_exercised BOOLEAN,
    
    -- Franchise Tag
    is_franchise_tagged BOOLEAN DEFAULT FALSE,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released', 'traded', 'expired', 'voided')),
    roster_status VARCHAR(20) DEFAULT 'active' CHECK (roster_status IN ('active', 'ir', 'taxi')),
    
    -- Acquisition Info
    acquisition_type VARCHAR(20) NOT NULL CHECK (acquisition_type IN ('draft', 'trade', 'free_agent', 'waivers', 'import', 'extension', 'tag')),
    acquisition_date DATE,
    acquisition_details JSONB,
    
    -- Release/Trade Info
    released_at TIMESTAMP,
    release_reason VARCHAR(50),
    dead_cap_hit DECIMAL(10,2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- EXPIRED CONTRACTS (Free Agents eligible for tag)
-- =============================================
CREATE TABLE expired_contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    
    previous_salary DECIMAL(10,2),
    previous_contract_id UUID REFERENCES contracts(id),
    roster_status VARCHAR(20) DEFAULT 'active',
    eligible_for_franchise_tag BOOLEAN DEFAULT TRUE,
    
    season INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(league_id, player_id, season)
);

-- =============================================
-- TRADES TABLE
-- =============================================
CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    
    -- Trade Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'approved', 'completed', 'rejected', 'expired', 'cancelled')),
    
    -- Approval Flow
    approval_mode VARCHAR(20) NOT NULL,
    requires_commissioner_approval BOOLEAN DEFAULT FALSE,
    requires_league_vote BOOLEAN DEFAULT FALSE,
    
    -- Voting (if league_vote mode)
    votes_for INT DEFAULT 0,
    votes_against INT DEFAULT 0,
    vote_deadline TIMESTAMP,
    
    -- Commissioner Approval
    commissioner_approved_by UUID REFERENCES teams(id),
    commissioner_approved_at TIMESTAMP,
    
    -- Expiration
    expires_at TIMESTAMP NOT NULL,
    
    -- Notes
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TRADE TEAMS (participants in trade)
-- =============================================
CREATE TABLE trade_teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    accepted_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(trade_id, team_id)
);

-- =============================================
-- TRADE ASSETS (contracts and picks in trade)
-- =============================================
CREATE TABLE trade_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
    
    -- From/To
    from_team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    to_team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    
    -- Asset Type
    asset_type VARCHAR(20) NOT NULL CHECK (asset_type IN ('contract', 'draft_pick', 'cap_space')),
    
    -- Contract (if asset_type = 'contract')
    contract_id UUID REFERENCES contracts(id),
    
    -- Draft Pick (if asset_type = 'draft_pick')
    draft_pick_id UUID,
    
    -- Cap Space (if asset_type = 'cap_space')
    cap_amount DECIMAL(10,2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TRADE VOTES (for league_vote mode)
-- =============================================
CREATE TABLE trade_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    
    vote VARCHAR(10) NOT NULL CHECK (vote IN ('approve', 'veto')),
    voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(trade_id, team_id)
);

-- =============================================
-- DRAFT PICKS TABLE
-- =============================================
CREATE TABLE draft_picks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    
    -- Pick Info
    season INT NOT NULL,
    round INT NOT NULL CHECK (round BETWEEN 1 AND 5),
    pick_number INT, -- Null until draft order is set
    
    -- Ownership
    original_team_id UUID REFERENCES teams(id),
    current_team_id UUID REFERENCES teams(id),
    
    -- Used Status
    is_used BOOLEAN DEFAULT FALSE,
    used_for_player_id UUID REFERENCES players(id),
    used_for_contract_id UUID REFERENCES contracts(id),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(league_id, season, original_team_id, round)
);

-- =============================================
-- FRANCHISE TAGS TABLE
-- =============================================
CREATE TABLE franchise_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    season INT NOT NULL,
    position VARCHAR(10) NOT NULL,
    
    -- Calculated Value
    tag_salary DECIMAL(10,2) NOT NULL,
    pool_size INT NOT NULL, -- 10 for QB/TE, 20 for RB/WR
    
    -- Players used for calculation
    top_players JSONB,
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(league_id, season, position)
);

-- =============================================
-- FRANCHISE TAG USAGE (1 per team per year)
-- =============================================
CREATE TABLE franchise_tag_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    season INT NOT NULL,
    
    contract_id UUID REFERENCES contracts(id),
    player_id UUID REFERENCES players(id),
    tag_salary DECIMAL(10,2) NOT NULL,
    
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Each team can only use ONE tag per season
    UNIQUE(league_id, team_id, season)
);

-- =============================================
-- CAP TRANSACTIONS (history)
-- =============================================
CREATE TABLE cap_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    season INT NOT NULL,
    
    -- Transaction Details
    transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN (
        'contract_signed', 'contract_released', 'contract_traded_in', 'contract_traded_out',
        'dead_money', 'tag_applied', 'option_exercised', 'option_declined', 'season_rollover'
    )),
    
    amount DECIMAL(10,2) NOT NULL, -- Positive = cap used, Negative = cap freed
    description TEXT,
    
    -- Related Records
    related_contract_id UUID REFERENCES contracts(id),
    related_trade_id UUID REFERENCES trades(id),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- SYNC LOG (Sleeper sync tracking)
-- =============================================
CREATE TABLE sync_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    
    sync_type VARCHAR(30) NOT NULL, -- 'rosters', 'transactions', 'users', 'full'
    status VARCHAR(20) NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'completed', 'failed')),
    
    records_processed INT DEFAULT 0,
    errors JSONB,
    
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX idx_contracts_team ON contracts(team_id, status);
CREATE INDEX idx_contracts_player ON contracts(player_id, status);
CREATE INDEX idx_contracts_league_season ON contracts(league_id, end_season);
CREATE INDEX idx_trades_league_status ON trades(league_id, status);
CREATE INDEX idx_trades_expires ON trades(expires_at) WHERE status = 'pending';
CREATE INDEX idx_draft_picks_owner ON draft_picks(current_team_id, season);
CREATE INDEX idx_cap_transactions_team_season ON cap_transactions(team_id, season);
CREATE INDEX idx_players_sleeper_id ON players(sleeper_player_id);
CREATE INDEX idx_players_search ON players(search_full_name);
CREATE INDEX idx_expired_contracts_team ON expired_contracts(team_id, season);

-- =============================================
-- VIEWS FOR COMMON QUERIES
-- =============================================

-- Team Cap Summary View
CREATE VIEW team_cap_summary AS
SELECT 
    t.id as team_id,
    t.team_name,
    t.owner_name,
    l.salary_cap,
    l.current_season,
    COALESCE(SUM(c.salary), 0) as total_salary,
    l.salary_cap - COALESCE(SUM(c.salary), 0) as cap_room,
    COUNT(c.id) as active_contracts,
    COALESCE(SUM(c.years_remaining), 0) as total_contract_years,
    COALESCE(dm.dead_money, 0) as dead_money
FROM teams t
JOIN leagues l ON t.league_id = l.id
LEFT JOIN contracts c ON c.team_id = t.id AND c.status = 'active'
LEFT JOIN (
    SELECT team_id, season, SUM(amount) as dead_money
    FROM cap_transactions
    WHERE transaction_type = 'dead_money'
    GROUP BY team_id, season
) dm ON dm.team_id = t.id AND dm.season = l.current_season
GROUP BY t.id, t.team_name, t.owner_name, l.salary_cap, l.current_season, dm.dead_money;

-- Team Contract Years View
CREATE VIEW team_contract_years AS
SELECT 
    t.id as team_id,
    t.team_name,
    l.min_contract_years,
    l.max_contract_years,
    COALESCE(SUM(c.years_remaining), 0) as total_years,
    CASE 
        WHEN COALESCE(SUM(c.years_remaining), 0) < l.min_contract_years THEN 'below_minimum'
        WHEN COALESCE(SUM(c.years_remaining), 0) > l.max_contract_years THEN 'above_maximum'
        ELSE 'valid'
    END as status
FROM teams t
JOIN leagues l ON t.league_id = l.id
LEFT JOIN contracts c ON c.team_id = t.id AND c.status = 'active'
GROUP BY t.id, t.team_name, l.min_contract_years, l.max_contract_years;

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function to calculate dead cap for a release
CREATE OR REPLACE FUNCTION calculate_dead_cap(
    p_contract_id UUID,
    p_release_season INT
) RETURNS DECIMAL(10,2) AS $$
DECLARE
    v_contract RECORD;
    v_years_into_contract INT;
    v_dead_cap_pct DECIMAL(5,2);
BEGIN
    SELECT * INTO v_contract FROM contracts WHERE id = p_contract_id;
    
    IF NOT FOUND THEN
        RETURN 0;
    END IF;
    
    -- $1 contracts always retain full cap hit
    IF v_contract.salary <= 1 THEN
        RETURN v_contract.salary;
    END IF;
    
    v_years_into_contract := p_release_season - v_contract.start_season + 1;
    
    -- Dead cap percentage based on original contract length and current year
    v_dead_cap_pct := CASE v_contract.years_total
        WHEN 5 THEN
            CASE v_years_into_contract
                WHEN 1 THEN 0.75
                WHEN 2 THEN 0.50
                WHEN 3 THEN 0.25
                WHEN 4 THEN 0.10
                WHEN 5 THEN 0.10
                ELSE 0
            END
        WHEN 4 THEN
            CASE v_years_into_contract
                WHEN 1 THEN 0.75
                WHEN 2 THEN 0.50
                WHEN 3 THEN 0.25
                WHEN 4 THEN 0.10
                ELSE 0
            END
        WHEN 3 THEN
            CASE v_years_into_contract
                WHEN 1 THEN 0.50
                WHEN 2 THEN 0.25
                WHEN 3 THEN 0.10
                ELSE 0
            END
        WHEN 2 THEN
            CASE v_years_into_contract
                WHEN 1 THEN 0.50
                WHEN 2 THEN 0.25
                ELSE 0
            END
        WHEN 1 THEN
            CASE v_years_into_contract
                WHEN 1 THEN 0.50
                ELSE 0
            END
        ELSE 0
    END;
    
    RETURN ROUND(v_contract.salary * v_dead_cap_pct, 2);
END;
$$ LANGUAGE plpgsql;

-- Function to get franchise tag salary by position
CREATE OR REPLACE FUNCTION get_franchise_tag_salary(
    p_league_id UUID,
    p_position VARCHAR(10),
    p_season INT
) RETURNS DECIMAL(10,2) AS $$
DECLARE
    v_pool_size INT;
    v_avg_salary DECIMAL(10,2);
BEGIN
    -- Pool sizes: QB=10, WR=20, RB=20, TE=10
    v_pool_size := CASE p_position
        WHEN 'QB' THEN 10
        WHEN 'WR' THEN 20
        WHEN 'RB' THEN 20
        WHEN 'TE' THEN 10
        ELSE 10
    END;
    
    SELECT CEIL(AVG(c.salary)) INTO v_avg_salary
    FROM (
        SELECT c.salary
        FROM contracts c
        JOIN players p ON c.player_id = p.id
        WHERE c.league_id = p_league_id
          AND p.position = p_position
          AND c.status = 'active'
        ORDER BY c.salary DESC
        LIMIT v_pool_size
    ) c;
    
    RETURN COALESCE(v_avg_salary, 0);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_leagues_updated_at BEFORE UPDATE ON leagues FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON trades FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_draft_picks_updated_at BEFORE UPDATE ON draft_picks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
