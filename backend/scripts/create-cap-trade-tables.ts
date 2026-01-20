import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createTables() {
  try {
    // Create cap_adjustments table for tracking dead money from trades, cuts, etc.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cap_adjustments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID NOT NULL REFERENCES teams(id),
        league_id UUID NOT NULL REFERENCES leagues(id),
        
        -- Type of adjustment
        adjustment_type VARCHAR(50) NOT NULL, -- 'trade_cap_hit', 'player_cut', 'player_retirement', 'trade_cap_relief'
        
        -- Reference to related entities (optional)
        player_id UUID REFERENCES players(id),
        contract_id UUID REFERENCES contracts(id),
        trade_id UUID, -- Will reference trades table once created
        
        -- Description
        description TEXT NOT NULL, -- e.g., "Amari Cooper trade cap hit", "Tyler Lockett cut"
        player_name VARCHAR(255), -- Store name for easier display
        
        -- Cap hit amounts by year
        amount_2026 NUMERIC(10,2) DEFAULT 0,
        amount_2027 NUMERIC(10,2) DEFAULT 0,
        amount_2028 NUMERIC(10,2) DEFAULT 0,
        amount_2029 NUMERIC(10,2) DEFAULT 0,
        amount_2030 NUMERIC(10,2) DEFAULT 0,
        
        -- Metadata
        effective_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Created cap_adjustments table');

    // Create trade_history table for storing historical trades
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trade_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        league_id UUID NOT NULL REFERENCES leagues(id),
        
        -- Trade identification
        trade_number VARCHAR(20) NOT NULL, -- e.g., "26.01", "25.15"
        trade_year INT NOT NULL, -- 2023, 2024, 2025, 2026
        
        -- Teams involved
        team1_id UUID REFERENCES teams(id),
        team1_name VARCHAR(255) NOT NULL, -- Store name in case team changes
        team2_id UUID REFERENCES teams(id),
        team2_name VARCHAR(255) NOT NULL,
        
        -- What team 1 received (JSON array of items)
        team1_received JSONB NOT NULL DEFAULT '[]',
        -- What team 2 received (JSON array of items)
        team2_received JSONB NOT NULL DEFAULT '[]',
        
        -- Cap implications
        team1_cap_hit NUMERIC(10,2) DEFAULT 0,
        team2_cap_hit NUMERIC(10,2) DEFAULT 0,
        
        -- Metadata
        trade_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Created trade_history table');

    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_cap_adjustments_team ON cap_adjustments(team_id);
      CREATE INDEX IF NOT EXISTS idx_cap_adjustments_league ON cap_adjustments(league_id);
      CREATE INDEX IF NOT EXISTS idx_trade_history_league ON trade_history(league_id);
      CREATE INDEX IF NOT EXISTS idx_trade_history_year ON trade_history(trade_year);
      CREATE INDEX IF NOT EXISTS idx_trade_history_teams ON trade_history(team1_id, team2_id);
    `);
    console.log('✅ Created indexes');

  } catch (err) {
    console.error('Error creating tables:', err);
  } finally {
    await pool.end();
  }
}

createTables();
