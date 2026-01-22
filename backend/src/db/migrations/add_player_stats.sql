-- =============================================
-- PLAYER SEASON STATS TABLE
-- Used for contract estimation and comparison
-- =============================================

-- Season stats summary (aggregated from weekly data)
CREATE TABLE IF NOT EXISTS player_season_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    season INT NOT NULL,

    -- Games
    games_played INT DEFAULT 0,
    games_started INT DEFAULT 0,

    -- Fantasy Points (PPR scoring)
    total_fantasy_points DECIMAL(10,2) DEFAULT 0,
    avg_points_per_game DECIMAL(8,2) DEFAULT 0,

    -- Passing Stats
    passing_yards INT DEFAULT 0,
    passing_tds INT DEFAULT 0,
    interceptions INT DEFAULT 0,
    passing_attempts INT DEFAULT 0,
    completions INT DEFAULT 0,

    -- Rushing Stats
    rushing_yards INT DEFAULT 0,
    rushing_tds INT DEFAULT 0,
    rushing_attempts INT DEFAULT 0,

    -- Receiving Stats
    receptions INT DEFAULT 0,
    receiving_yards INT DEFAULT 0,
    receiving_tds INT DEFAULT 0,
    targets INT DEFAULT 0,

    -- Sync metadata
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(player_id, season)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_player_season_stats_lookup ON player_season_stats(player_id, season);
CREATE INDEX IF NOT EXISTS idx_player_season_stats_points ON player_season_stats(season, total_fantasy_points DESC);
CREATE INDEX IF NOT EXISTS idx_player_season_stats_ppg ON player_season_stats(season, avg_points_per_game DESC);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_player_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.synced_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_player_season_stats_synced_at ON player_season_stats;
CREATE TRIGGER update_player_season_stats_synced_at
    BEFORE UPDATE ON player_season_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_player_stats_updated_at();
