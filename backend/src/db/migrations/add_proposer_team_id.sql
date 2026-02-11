-- Migration: Add proposer_team_id column to trades table
-- Run this SQL against your database to add the column

ALTER TABLE trades ADD COLUMN IF NOT EXISTS proposer_team_id UUID REFERENCES teams(id);

-- Optional: Update existing trades to set proposer_team_id from trade_teams
-- This sets the first team in the trade as the proposer for historical trades
UPDATE trades t
SET proposer_team_id = (
  SELECT tt.team_id
  FROM trade_teams tt
  WHERE tt.trade_id = t.id
  ORDER BY tt.created_at ASC
  LIMIT 1
)
WHERE t.proposer_team_id IS NULL;
