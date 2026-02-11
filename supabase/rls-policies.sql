-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================
-- These policies can be applied when you add authentication
-- For now, the app works without authentication (public access)

-- =============================================
-- ENABLE RLS ON ALL TABLES
-- =============================================

ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_commissioners ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE franchise_tag_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cap_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE buy_ins ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PUBLIC ACCESS POLICIES (Current Setup)
-- =============================================
-- These policies allow anyone to read and write
-- Remove these when you implement authentication

CREATE POLICY "Allow all operations" ON leagues FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON teams FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON league_commissioners FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON players FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON contracts FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON trades FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON trade_participants FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON trade_assets FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON trade_votes FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON draft_picks FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON player_stats FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON franchise_tag_costs FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON cap_adjustments FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON trade_history FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON league_history FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON buy_ins FOR ALL USING (true);

-- =============================================
-- AUTHENTICATED POLICIES (Future Enhancement)
-- =============================================
-- Uncomment and customize these when you add Supabase Auth

/*
-- Drop public policies first
DROP POLICY IF EXISTS "Allow all operations" ON leagues;
DROP POLICY IF EXISTS "Allow all operations" ON teams;
-- ... drop all other public policies

-- Leagues: Anyone can read, only commissioners can edit
CREATE POLICY "Anyone can view leagues" 
  ON leagues FOR SELECT 
  USING (true);

CREATE POLICY "Commissioners can update leagues" 
  ON leagues FOR UPDATE 
  USING (
    id IN (
      SELECT league_id 
      FROM league_commissioners 
      WHERE team_id IN (
        SELECT id FROM teams WHERE sleeper_user_id = auth.uid()
      )
    )
  );

-- Teams: Anyone can read, only team owners can update their team
CREATE POLICY "Anyone can view teams" 
  ON teams FOR SELECT 
  USING (true);

CREATE POLICY "Team owners can update their team" 
  ON teams FOR UPDATE 
  USING (sleeper_user_id = auth.uid());

-- Contracts: Anyone can read, only commissioners and team owners can create/edit
CREATE POLICY "Anyone can view contracts" 
  ON contracts FOR SELECT 
  USING (true);

CREATE POLICY "Team owners can manage their contracts" 
  ON contracts FOR ALL 
  USING (
    team_id IN (
      SELECT id FROM teams WHERE sleeper_user_id = auth.uid()
    )
  );

CREATE POLICY "Commissioners can manage all contracts" 
  ON contracts FOR ALL 
  USING (
    league_id IN (
      SELECT league_id 
      FROM league_commissioners 
      WHERE team_id IN (
        SELECT id FROM teams WHERE sleeper_user_id = auth.uid()
      )
    )
  );

-- Trades: Anyone can read, team owners can create/respond
CREATE POLICY "Anyone can view trades" 
  ON trades FOR SELECT 
  USING (true);

CREATE POLICY "Team owners can create trades" 
  ON trades FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trade_participants 
      WHERE trade_id = trades.id 
      AND team_id IN (
        SELECT id FROM teams WHERE sleeper_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Team owners can update their trades" 
  ON trades FOR UPDATE 
  USING (
    id IN (
      SELECT trade_id FROM trade_participants 
      WHERE team_id IN (
        SELECT id FROM teams WHERE sleeper_user_id = auth.uid()
      )
    )
  );

-- Players: Anyone can read, system updates only
CREATE POLICY "Anyone can view players" 
  ON players FOR SELECT 
  USING (true);

-- Stats: Anyone can read, system updates only
CREATE POLICY "Anyone can view stats" 
  ON player_stats FOR SELECT 
  USING (true);

-- Buy-ins: League members can view, commissioners can edit
CREATE POLICY "League members can view buy-ins" 
  ON buy_ins FOR SELECT 
  USING (
    league_id IN (
      SELECT league_id FROM teams WHERE sleeper_user_id = auth.uid()
    )
  );

CREATE POLICY "Commissioners can manage buy-ins" 
  ON buy_ins FOR ALL 
  USING (
    league_id IN (
      SELECT league_id 
      FROM league_commissioners 
      WHERE team_id IN (
        SELECT id FROM teams WHERE sleeper_user_id = auth.uid()
      )
    )
  );
*/

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Check if user is commissioner of a league
CREATE OR REPLACE FUNCTION is_league_commissioner(league_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM league_commissioners lc
    JOIN teams t ON lc.team_id = t.id
    WHERE lc.league_id = league_uuid
    AND t.sleeper_user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user owns a team
CREATE OR REPLACE FUNCTION is_team_owner(team_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM teams 
    WHERE id = team_uuid 
    AND sleeper_user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's team in a league
CREATE OR REPLACE FUNCTION get_user_team(league_uuid UUID)
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT id 
    FROM teams 
    WHERE league_id = league_uuid 
    AND sleeper_user_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
