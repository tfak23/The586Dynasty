-- =============================================
-- LEAGUE HISTORY SEED DATA
-- The 586 Dynasty - Owner Statistics
-- =============================================

-- Note: Run this after the league and teams have been initialized
-- This will insert/update owner history records

-- Get the league ID for The 586 Dynasty
DO $$
DECLARE
    v_league_id UUID;
BEGIN
    SELECT id INTO v_league_id FROM leagues WHERE sleeper_league_id = '1048336270873059328';

    IF v_league_id IS NULL THEN
        RAISE NOTICE 'League not found. Please initialize the league first.';
        RETURN;
    END IF;

    -- Insert owner history records
    -- Format: (league_id, owner_name, titles, sb_appearances, division_titles, playoff_appearances, total_winnings, total_buy_ins, net_winnings, total_wins, total_losses, total_ties, total_points, season_records)

    INSERT INTO league_history (league_id, owner_name, titles, sb_appearances, division_titles, playoff_appearances, total_winnings, total_buy_ins, net_winnings, total_wins, total_losses, total_ties, total_points, season_records, is_active)
    VALUES
        -- Active owners with history
        (v_league_id, 'Travis Fakhoury', 1, 1, 2, 5, 1425, 1400, 25, 62, 42, 0, 9548.16, '[]', true),
        (v_league_id, 'Thomas Fakhoury', 0, 0, 0, 2, 0, 1400, -1400, 38, 66, 0, 7894.48, '[]', true),
        (v_league_id, 'Gio Purugganan', 0, 0, 0, 3, 300, 1400, -1100, 49, 55, 0, 9133.62, '[]', true),
        (v_league_id, 'Chris Vandale', 1, 1, 2, 3, 1200, 1400, -200, 50, 54, 0, 8890.00, '[]', true),
        (v_league_id, 'Cole Adams', 0, 0, 0, 1, 0, 800, -800, 29, 41, 0, 5658.16, '[]', true),
        (v_league_id, 'Amin Sorkhabi', 1, 1, 0, 3, 1650, 1400, 250, 53, 51, 0, 8816.24, '[]', true),
        (v_league_id, 'Joe Skender', 1, 2, 1, 5, 1875, 1400, 475, 61, 43, 0, 9179.54, '[]', true),
        (v_league_id, 'Zach Maloomian', 0, 0, 1, 4, 300, 1400, -1100, 50, 53, 1, 8579.44, '[]', true),
        (v_league_id, 'Robert Peters', 0, 0, 0, 0, 0, 200, -200, 2, 12, 0, 1191.74, '[]', true),
        (v_league_id, 'Landon Bender', 0, 0, 1, 1, 300, 200, 100, 7, 7, 0, 1295.80, '[]', true),
        (v_league_id, 'Brandon Frye', 0, 0, 0, 0, 0, 200, -200, 5, 9, 0, 1196.90, '[]', true),
        (v_league_id, 'Mike Fosdick', 0, 1, 0, 3, 225, 600, -375, 25, 24, 1, 3951.90, '[]', true),

        -- Inactive/former owners
        (v_league_id, 'Kyle Rennell', 0, 0, 0, 3, 0, 800, -800, 36, 34, 0, 5556.30, '[]', false),
        (v_league_id, 'Jeremy Carlson', 0, 0, 0, 0, 0, 400, -400, 8, 20, 0, 2256.10, '[]', false),
        (v_league_id, 'Ty Prush', 0, 0, 0, 0, 0, 200, -200, 1, 13, 0, 1178.48, '[]', false),
        (v_league_id, 'Robbie Jones', 0, 0, 0, 0, 0, 200, -200, 5, 9, 0, 1186.76, '[]', false),
        (v_league_id, 'Garrett Remes', 0, 0, 0, 0, 0, 200, -200, 5, 9, 0, 1125.72, '[]', false),
        (v_league_id, 'Zach Shaw', 0, 0, 1, 2, 600, 400, 200, 17, 11, 0, 2524.80, '[]', false),
        (v_league_id, 'Andrew Jones', 1, 1, 1, 3, 1050, 400, 650, 20, 8, 0, 2685.68, '[]', false)
    ON CONFLICT (league_id, owner_name)
    DO UPDATE SET
        titles = EXCLUDED.titles,
        sb_appearances = EXCLUDED.sb_appearances,
        division_titles = EXCLUDED.division_titles,
        playoff_appearances = EXCLUDED.playoff_appearances,
        total_winnings = EXCLUDED.total_winnings,
        total_buy_ins = EXCLUDED.total_buy_ins,
        net_winnings = EXCLUDED.net_winnings,
        total_wins = EXCLUDED.total_wins,
        total_losses = EXCLUDED.total_losses,
        total_ties = EXCLUDED.total_ties,
        total_points = EXCLUDED.total_points,
        season_records = EXCLUDED.season_records,
        is_active = EXCLUDED.is_active,
        updated_at = CURRENT_TIMESTAMP;

    -- Calculate win percentage for all records
    UPDATE league_history
    SET win_percentage = CASE
        WHEN (total_wins + total_losses + total_ties) > 0
        THEN total_wins::decimal / (total_wins + total_losses + total_ties)
        ELSE 0
    END
    WHERE league_id = v_league_id;

    -- Calculate legacy score (example formula: titles*100 + sb*50 + div*25 + playoffs*10 + win%*50)
    UPDATE league_history
    SET legacy_score = (titles * 100) + (sb_appearances * 50) + (division_titles * 25) + (playoff_appearances * 10) + (win_percentage * 50)
    WHERE league_id = v_league_id;

    RAISE NOTICE 'League history seeded successfully for league %', v_league_id;
END $$;
