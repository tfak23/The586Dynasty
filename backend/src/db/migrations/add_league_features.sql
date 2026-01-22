-- =============================================
-- LEAGUE FEATURES MIGRATION
-- Adds: league_history, league_buy_ins, rules_content
-- =============================================

-- Add rules content to leagues table
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS rules_content TEXT;

-- =============================================
-- LEAGUE HISTORY TABLE
-- Tracks owner statistics and season records
-- =============================================
CREATE TABLE IF NOT EXISTS league_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,

    -- Owner identification
    owner_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),

    -- Career statistics
    titles INT DEFAULT 0,
    sb_appearances INT DEFAULT 0,
    division_titles INT DEFAULT 0,
    playoff_appearances INT DEFAULT 0,

    -- Financial
    total_winnings DECIMAL(10,2) DEFAULT 0,
    total_buy_ins DECIMAL(10,2) DEFAULT 0,
    net_winnings DECIMAL(10,2) DEFAULT 0,

    -- Overall record
    total_wins INT DEFAULT 0,
    total_losses INT DEFAULT 0,
    total_ties INT DEFAULT 0,
    total_points DECIMAL(10,2) DEFAULT 0,
    win_percentage DECIMAL(5,4) DEFAULT 0,

    -- Legacy score (calculated)
    legacy_score DECIMAL(10,2) DEFAULT 0,

    -- Season-by-season records
    -- Array of { season, wins, losses, ties, points, placing, playoffs, title, division }
    season_records JSONB DEFAULT '[]',

    -- Current team link (if still active)
    current_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(league_id, owner_name)
);

-- =============================================
-- LEAGUE BUY-INS TABLE
-- Tracks annual buy-in payment status
-- =============================================
CREATE TABLE IF NOT EXISTS league_buy_ins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,

    -- Season and owner
    season INT NOT NULL,
    owner_name VARCHAR(255) NOT NULL,

    -- Payment details
    amount_due DECIMAL(10,2) DEFAULT 200,
    amount_paid DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'unpaid' CHECK (status IN ('paid', 'partial', 'unpaid')),

    -- Payment tracking
    paid_date TIMESTAMP,
    payment_method VARCHAR(50), -- 'cash', 'venmo', 'paypal', etc.

    -- Notes
    notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(league_id, team_id, season)
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_league_history_league ON league_history(league_id);
CREATE INDEX IF NOT EXISTS idx_league_history_owner ON league_history(owner_name);
CREATE INDEX IF NOT EXISTS idx_league_buy_ins_league ON league_buy_ins(league_id);
CREATE INDEX IF NOT EXISTS idx_league_buy_ins_season ON league_buy_ins(league_id, season);
CREATE INDEX IF NOT EXISTS idx_league_buy_ins_status ON league_buy_ins(status);

-- =============================================
-- TRIGGERS
-- =============================================
CREATE TRIGGER update_league_history_updated_at
    BEFORE UPDATE ON league_history
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_league_buy_ins_updated_at
    BEFORE UPDATE ON league_buy_ins
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
