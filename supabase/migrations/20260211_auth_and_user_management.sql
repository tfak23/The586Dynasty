-- =============================================
-- USER MANAGEMENT & AUTHENTICATION SCHEMA
-- Extends the base schema with user profiles and Sleeper account linking
-- =============================================

-- =============================================
-- USER PROFILES TABLE
-- Links Supabase Auth users to our app
-- =============================================
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Sleeper Account (one-to-one mapping)
    sleeper_username VARCHAR(100) UNIQUE,
    sleeper_user_id VARCHAR(50) UNIQUE,
    sleeper_display_name VARCHAR(100),
    sleeper_avatar VARCHAR(255),
    
    -- Profile Info
    display_name VARCHAR(100),
    email VARCHAR(255),
    
    -- Metadata
    onboarding_completed BOOLEAN DEFAULT FALSE,
    last_sleeper_sync TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can only read their own profile
CREATE POLICY "Users can read own profile"
ON user_profiles FOR SELECT
USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON user_profiles FOR UPDATE
USING (auth.uid() = id);

-- Users can insert their own profile (on signup)
CREATE POLICY "Users can insert own profile"
ON user_profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- =============================================
-- LEAGUE MEMBERS TABLE
-- Maps users to leagues they've joined
-- =============================================
CREATE TABLE league_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    
    -- Role in league
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('commissioner', 'co-commissioner', 'member')),
    
    -- Permissions
    can_manage_league BOOLEAN DEFAULT FALSE,
    can_manage_trades BOOLEAN DEFAULT FALSE,
    can_manage_contracts BOOLEAN DEFAULT FALSE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'removed')),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Each user can only join a league once
    UNIQUE(league_id, user_id)
);

-- Enable RLS on league_members
ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;

-- Users can read league memberships they're part of
CREATE POLICY "Users can read own league memberships"
ON league_members FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert themselves into leagues
CREATE POLICY "Users can join leagues"
ON league_members FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Only commissioners can update league memberships
CREATE POLICY "Commissioners can update league memberships"
ON league_members FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM league_members lm
        WHERE lm.league_id = league_members.league_id
        AND lm.user_id = auth.uid()
        AND lm.role IN ('commissioner', 'co-commissioner')
        AND lm.can_manage_league = TRUE
    )
);

-- =============================================
-- LEAGUE REGISTRATION STATUS
-- Tracks which leagues are registered in the salary cap system
-- =============================================
CREATE TABLE league_registration (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE UNIQUE,
    
    -- Registration Info
    registered_by UUID REFERENCES user_profiles(id),
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Initial Commissioner (who converted the league)
    initial_commissioner_id UUID REFERENCES user_profiles(id),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS on league_registration
ALTER TABLE league_registration ENABLE ROW LEVEL SECURITY;

-- Anyone can read league registration status (to see if league is registered)
CREATE POLICY "Anyone authenticated can read league registration"
ON league_registration FOR SELECT
TO authenticated
USING (TRUE);

-- Only authenticated users can register leagues
CREATE POLICY "Authenticated users can register leagues"
ON league_registration FOR INSERT
TO authenticated
WITH CHECK (registered_by = auth.uid());

-- =============================================
-- UPDATE EXISTING TABLES
-- =============================================

-- Add user_id to teams table to link teams to app users
ALTER TABLE teams ADD COLUMN user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX idx_teams_user_id ON teams(user_id);
CREATE INDEX idx_league_members_user_id ON league_members(user_id);
CREATE INDEX idx_league_members_league_id ON league_members(league_id);
CREATE INDEX idx_user_profiles_sleeper_username ON user_profiles(sleeper_username);
CREATE INDEX idx_user_profiles_sleeper_user_id ON user_profiles(sleeper_user_id);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Function to check if a sleeper username is already linked
CREATE OR REPLACE FUNCTION is_sleeper_username_available(p_sleeper_username VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE sleeper_username = p_sleeper_username
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's leagues
CREATE OR REPLACE FUNCTION get_user_leagues(p_user_id UUID)
RETURNS TABLE (
    league_id UUID,
    league_name VARCHAR,
    role VARCHAR,
    team_id UUID,
    team_name VARCHAR,
    is_registered BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.id,
        l.name,
        lm.role,
        lm.team_id,
        t.team_name,
        EXISTS (SELECT 1 FROM league_registration lr WHERE lr.league_id = l.id AND lr.is_active = TRUE) as is_registered
    FROM league_members lm
    JOIN leagues l ON l.id = lm.league_id
    LEFT JOIN teams t ON t.id = lm.team_id
    WHERE lm.user_id = p_user_id
    AND lm.status = 'active'
    ORDER BY lm.joined_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is commissioner of a league
CREATE OR REPLACE FUNCTION is_league_commissioner(p_user_id UUID, p_league_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM league_members
        WHERE user_id = p_user_id
        AND league_id = p_league_id
        AND role IN ('commissioner', 'co-commissioner')
        AND can_manage_league = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- TRIGGERS
-- =============================================

-- Update updated_at timestamp on user_profiles
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_profiles_updated_at
BEFORE UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION update_user_profiles_updated_at();

-- Update updated_at timestamp on league_members
CREATE OR REPLACE FUNCTION update_league_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER league_members_updated_at
BEFORE UPDATE ON league_members
FOR EACH ROW
EXECUTE FUNCTION update_league_members_updated_at();

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON TABLE user_profiles IS 'User profiles with Sleeper account linking (one-to-one)';
COMMENT ON TABLE league_members IS 'Maps users to leagues they have joined';
COMMENT ON TABLE league_registration IS 'Tracks which leagues are registered as salary cap leagues';
COMMENT ON COLUMN user_profiles.sleeper_username IS 'Unique Sleeper username - one per user';
COMMENT ON COLUMN user_profiles.sleeper_user_id IS 'Unique Sleeper user ID - one per user';
COMMENT ON COLUMN league_members.role IS 'User role in the league: commissioner, co-commissioner, or member';
