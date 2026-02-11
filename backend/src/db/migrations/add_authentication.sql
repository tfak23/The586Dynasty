-- =============================================
-- AUTHENTICATION & USER MANAGEMENT TABLES
-- =============================================

-- =============================================
-- USERS TABLE
-- Stores app users with authentication credentials
-- =============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Authentication
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- NULL for Google OAuth users
    
    -- Google OAuth
    google_id VARCHAR(255) UNIQUE,
    google_email VARCHAR(255),
    
    -- Profile
    display_name VARCHAR(100),
    avatar_url VARCHAR(255),
    
    -- Status
    email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Password Reset
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP
);

-- =============================================
-- SLEEPER_ACCOUNTS TABLE
-- Links app users to their Sleeper.com accounts
-- One Sleeper account per user (enforced by unique constraint)
-- =============================================
CREATE TABLE IF NOT EXISTS sleeper_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Sleeper Info
    sleeper_username VARCHAR(100) NOT NULL,
    sleeper_user_id VARCHAR(50) UNIQUE NOT NULL, -- Enforces one Sleeper account per app user
    
    -- Sleeper Profile (cached from API)
    sleeper_display_name VARCHAR(100),
    sleeper_avatar VARCHAR(255),
    
    -- Verification
    verified BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id) -- One Sleeper account per user
);

-- =============================================
-- USER_LEAGUE_ASSOCIATIONS TABLE
-- Tracks which leagues a user has joined
-- =============================================
CREATE TABLE IF NOT EXISTS user_league_associations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    
    -- Role
    is_commissioner BOOLEAN DEFAULT FALSE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'removed')),
    
    -- Timestamps
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, league_id)
);

-- =============================================
-- Add league registration tracking to leagues table
-- =============================================
ALTER TABLE leagues 
    ADD COLUMN IF NOT EXISTS is_salary_cap_league BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS sleeper_league_owner_id VARCHAR(50);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_sleeper_accounts_user_id ON sleeper_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_sleeper_accounts_sleeper_user_id ON sleeper_accounts(sleeper_user_id);
CREATE INDEX IF NOT EXISTS idx_user_league_associations_user_id ON user_league_associations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_league_associations_league_id ON user_league_associations(league_id);
CREATE INDEX IF NOT EXISTS idx_leagues_sleeper_league_id ON leagues(sleeper_league_id);
CREATE INDEX IF NOT EXISTS idx_leagues_is_salary_cap_league ON leagues(is_salary_cap_league);

-- =============================================
-- TRIGGER: Update updated_at timestamp
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sleeper_accounts_updated_at ON sleeper_accounts;
CREATE TRIGGER update_sleeper_accounts_updated_at BEFORE UPDATE ON sleeper_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_league_associations_updated_at ON user_league_associations;
CREATE TRIGGER update_user_league_associations_updated_at BEFORE UPDATE ON user_league_associations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
