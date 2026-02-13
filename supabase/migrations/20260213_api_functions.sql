-- =============================================
-- API Database Functions for Supabase Migration
-- Replaces Express.js backend logic with PostgreSQL functions
-- =============================================

-- =============================================
-- 1. GET LEAGUE CAP DETAILED
-- Replaces: GET /api/teams/league/:leagueId/cap-detailed
-- Returns roster-based cap calculation for all teams
-- =============================================
CREATE OR REPLACE FUNCTION get_league_cap_detailed(p_league_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_league RECORD;
    v_result JSONB := '[]'::JSONB;
    v_team RECORD;
    v_roster_salary DECIMAL;
    v_dead_money_releases DECIMAL;
    v_dead_money_adjustments DECIMAL;
    v_contract_count INT;
    v_total_years INT;
    v_year_column TEXT;
BEGIN
    SELECT * INTO v_league FROM leagues WHERE id = p_league_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'League not found';
    END IF;

    v_year_column := 'amount_' || v_league.current_season;

    FOR v_team IN SELECT * FROM teams WHERE league_id = p_league_id
    LOOP
        -- Get roster salary (active contracts only)
        SELECT COALESCE(SUM(c.salary), 0), COUNT(c.id), COALESCE(SUM(c.years_remaining), 0)
        INTO v_roster_salary, v_contract_count, v_total_years
        FROM contracts c
        WHERE c.team_id = v_team.id AND c.status = 'active';

        -- Dead money from cap_transactions (player releases)
        SELECT COALESCE(SUM(amount), 0)
        INTO v_dead_money_releases
        FROM cap_transactions
        WHERE team_id = v_team.id
          AND season = v_league.current_season
          AND transaction_type = 'dead_money';

        -- Dead money from cap_adjustments (trades)
        EXECUTE format(
            'SELECT COALESCE(SUM(%I), 0) FROM cap_adjustments WHERE team_id = $1',
            v_year_column
        ) INTO v_dead_money_adjustments USING v_team.id;

        v_result := v_result || jsonb_build_object(
            'team_id', v_team.id,
            'team_name', v_team.team_name,
            'owner_name', v_team.owner_name,
            'salary_cap', v_league.salary_cap,
            'roster_salary', v_roster_salary,
            'dead_money', v_dead_money_releases + v_dead_money_adjustments,
            'cap_room', v_league.salary_cap - v_roster_salary - v_dead_money_releases - v_dead_money_adjustments,
            'contract_count', v_contract_count,
            'total_contract_years', v_total_years
        );
    END LOOP;

    -- Sort by cap_room descending
    SELECT jsonb_agg(elem ORDER BY (elem->>'cap_room')::DECIMAL DESC)
    INTO v_result
    FROM jsonb_array_elements(v_result) AS elem;

    RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 2. GET TEAM CAP PROJECTION
-- Replaces: GET /api/teams/:id/cap-projection
-- Returns 5-year cap projection for a team
-- =============================================
CREATE OR REPLACE FUNCTION get_team_cap_projection(p_team_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_team RECORD;
    v_league RECORD;
    v_current_season INT;
    v_projections JSONB := '[]'::JSONB;
    v_year INT;
    v_season INT;
    v_contract RECORD;
    v_total_salary DECIMAL;
    v_guaranteed_salary DECIMAL;
    v_dead_money_releases DECIMAL;
    v_dead_money_trades DECIMAL;
    v_contract_count INT;
    v_years_remaining INT;
    v_dead_cap_pct DECIMAL;
    v_year_column TEXT;
BEGIN
    SELECT * INTO v_team FROM teams WHERE id = p_team_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Team not found';
    END IF;

    SELECT * INTO v_league FROM leagues WHERE id = v_team.league_id;
    v_current_season := v_league.current_season;

    FOR v_year IN 0..4 LOOP
        v_season := v_current_season + v_year;
        v_total_salary := 0;
        v_guaranteed_salary := 0;
        v_contract_count := 0;

        -- Iterate contracts active in this future season
        FOR v_contract IN
            SELECT id, salary, start_season, end_season, years_remaining, years_total
            FROM contracts
            WHERE team_id = p_team_id
              AND status = 'active'
              AND start_season <= v_season
              AND end_season >= v_season
        LOOP
            v_contract_count := v_contract_count + 1;
            v_total_salary := v_total_salary + v_contract.salary;

            -- Calculate guaranteed (dead cap) salary
            IF v_contract.salary <= 1 THEN
                v_guaranteed_salary := v_guaranteed_salary + v_contract.salary;
            ELSE
                v_years_remaining := COALESCE(v_contract.years_remaining, v_contract.end_season - v_season + 1);

                v_dead_cap_pct := CASE v_years_remaining
                    WHEN 5 THEN CASE v_year WHEN 0 THEN 0.75 WHEN 1 THEN 0.50 WHEN 2 THEN 0.25 WHEN 3 THEN 0.10 WHEN 4 THEN 0.10 ELSE 0 END
                    WHEN 4 THEN CASE v_year WHEN 0 THEN 0.75 WHEN 1 THEN 0.50 WHEN 2 THEN 0.25 WHEN 3 THEN 0.10 ELSE 0 END
                    WHEN 3 THEN CASE v_year WHEN 0 THEN 0.50 WHEN 1 THEN 0.25 WHEN 2 THEN 0.10 ELSE 0 END
                    WHEN 2 THEN CASE v_year WHEN 0 THEN 0.50 WHEN 1 THEN 0.25 ELSE 0 END
                    WHEN 1 THEN CASE v_year WHEN 0 THEN 0.50 ELSE 0 END
                    ELSE 0.50
                END;

                v_guaranteed_salary := v_guaranteed_salary + CEIL(v_contract.salary * v_dead_cap_pct);
            END IF;
        END LOOP;

        -- Dead money from cap_transactions
        SELECT COALESCE(SUM(amount), 0) INTO v_dead_money_releases
        FROM cap_transactions
        WHERE team_id = p_team_id AND season = v_season AND transaction_type = 'dead_money';

        -- Dead money from cap_adjustments
        v_year_column := 'amount_' || v_season;
        BEGIN
            EXECUTE format(
                'SELECT COALESCE(SUM(%I), 0) FROM cap_adjustments WHERE team_id = $1',
                v_year_column
            ) INTO v_dead_money_trades USING p_team_id;
        EXCEPTION WHEN undefined_column THEN
            v_dead_money_trades := 0;
        END;

        v_projections := v_projections || jsonb_build_object(
            'season', v_season,
            'committed_salary', v_total_salary,
            'guaranteed_salary', v_guaranteed_salary + v_dead_money_releases + v_dead_money_trades,
            'dead_money_releases', v_dead_money_releases,
            'dead_money_trades', v_dead_money_trades,
            'dead_money', v_dead_money_releases + v_dead_money_trades,
            'total_cap_used', v_total_salary + v_dead_money_releases + v_dead_money_trades,
            'cap_room', v_league.salary_cap - v_total_salary - v_dead_money_releases - v_dead_money_trades,
            'contract_count', v_contract_count
        );
    END LOOP;

    RETURN jsonb_build_object(
        'team_id', v_team.id,
        'team_name', v_team.team_name,
        'salary_cap', v_league.salary_cap,
        'projections', v_projections
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 3. GET DEAD CAP BREAKDOWN
-- Replaces: GET /api/teams/:id/dead-cap-breakdown
-- Returns sources of dead money for a team
-- =============================================
CREATE OR REPLACE FUNCTION get_dead_cap_breakdown(p_team_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_team RECORD;
    v_league RECORD;
    v_current_season INT;
    v_year_column TEXT;
    v_releases JSONB;
    v_trades JSONB;
    v_release_total DECIMAL;
    v_trade_total DECIMAL;
BEGIN
    SELECT * INTO v_team FROM teams WHERE id = p_team_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Team not found';
    END IF;

    SELECT * INTO v_league FROM leagues WHERE id = v_team.league_id;
    v_current_season := v_league.current_season;
    v_year_column := 'amount_' || v_current_season;

    -- Get release dead money
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'type', 'release',
        'player_name', COALESCE(p.full_name, 'Unknown Player'),
        'position', p.position,
        'amount', ct.amount,
        'reason', ct.description,
        'date', ct.created_at
    ) ORDER BY ct.created_at DESC), '[]'::JSONB),
    COALESCE(SUM(ct.amount), 0)
    INTO v_releases, v_release_total
    FROM cap_transactions ct
    LEFT JOIN contracts c ON ct.related_contract_id = c.id
    LEFT JOIN players p ON c.player_id = p.id
    WHERE ct.team_id = p_team_id
      AND ct.season = v_current_season
      AND ct.transaction_type = 'dead_money';

    -- Get trade dead money
    EXECUTE format(
        'SELECT COALESCE(jsonb_agg(jsonb_build_object(
            ''type'', ''trade'',
            ''amount'', ca.%I,
            ''reason'', COALESCE(ca.description, ''Trade dead money''),
            ''trade_id'', ca.trade_id,
            ''date'', ca.created_at
        ) ORDER BY ca.created_at DESC), ''[]''::JSONB),
        COALESCE(SUM(ca.%I), 0)
        FROM cap_adjustments ca
        WHERE ca.team_id = $1 AND ca.%I > 0',
        v_year_column, v_year_column, v_year_column
    ) INTO v_trades, v_trade_total USING p_team_id;

    RETURN jsonb_build_object(
        'season', v_current_season,
        'total_dead_cap', v_release_total + v_trade_total,
        'releases', jsonb_build_object('total', v_release_total, 'items', v_releases),
        'trades', jsonb_build_object('total', v_trade_total, 'items', v_trades)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 4. RELEASE CONTRACT
-- Replaces: POST /api/contracts/:id/release
-- Releases a player and calculates dead cap (transactional)
-- =============================================
CREATE OR REPLACE FUNCTION release_contract(p_contract_id UUID, p_release_reason TEXT DEFAULT 'released')
RETURNS JSONB AS $$
DECLARE
    v_contract RECORD;
    v_league RECORD;
    v_dead_cap DECIMAL;
    v_years_into INT;
    v_pct DECIMAL;
    v_updated RECORD;
BEGIN
    SELECT * INTO v_contract FROM contracts WHERE id = p_contract_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Contract not found';
    END IF;
    IF v_contract.status != 'active' THEN
        RAISE EXCEPTION 'Contract is not active';
    END IF;

    SELECT * INTO v_league FROM leagues WHERE id = v_contract.league_id;

    -- Calculate dead cap
    IF v_contract.salary <= 1 THEN
        v_dead_cap := v_contract.salary;
    ELSE
        v_years_into := v_league.current_season - v_contract.start_season;
        v_pct := CASE v_contract.years_total
            WHEN 5 THEN CASE v_years_into WHEN 0 THEN 0.75 WHEN 1 THEN 0.50 WHEN 2 THEN 0.25 WHEN 3 THEN 0.10 WHEN 4 THEN 0.10 ELSE 0 END
            WHEN 4 THEN CASE v_years_into WHEN 0 THEN 0.75 WHEN 1 THEN 0.50 WHEN 2 THEN 0.25 WHEN 3 THEN 0.10 ELSE 0 END
            WHEN 3 THEN CASE v_years_into WHEN 0 THEN 0.50 WHEN 1 THEN 0.25 WHEN 2 THEN 0.10 ELSE 0 END
            WHEN 2 THEN CASE v_years_into WHEN 0 THEN 0.50 WHEN 1 THEN 0.25 ELSE 0 END
            WHEN 1 THEN CASE v_years_into WHEN 0 THEN 0.50 ELSE 0 END
            ELSE 0
        END;
        v_dead_cap := ROUND(v_contract.salary * v_pct, 2);
    END IF;

    -- Update contract
    UPDATE contracts
    SET status = 'released',
        released_at = CURRENT_TIMESTAMP,
        release_reason = p_release_reason,
        dead_cap_hit = v_dead_cap
    WHERE id = p_contract_id
    RETURNING * INTO v_updated;

    -- Log dead cap transaction
    IF v_contract.team_id IS NOT NULL AND v_dead_cap > 0 THEN
        INSERT INTO cap_transactions (league_id, team_id, season, transaction_type, amount, description, related_contract_id)
        VALUES (v_contract.league_id, v_contract.team_id, v_league.current_season, 'dead_money', v_dead_cap, 'Dead cap from release', p_contract_id);
    END IF;

    RETURN jsonb_build_object(
        'contract', row_to_json(v_updated),
        'dead_cap', v_dead_cap
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 5. CALCULATE FRANCHISE TAGS
-- Replaces: POST /api/leagues/:id/franchise-tags/:season/calculate
-- Calculates and stores tag values for all positions
-- =============================================
CREATE OR REPLACE FUNCTION calculate_franchise_tags(p_league_id UUID, p_season INT)
RETURNS JSONB AS $$
DECLARE
    v_position TEXT;
    v_pool_size INT;
    v_positions TEXT[] := ARRAY['QB', 'RB', 'WR', 'TE'];
    v_results JSONB := '[]'::JSONB;
    v_top_players JSONB;
    v_total_salary DECIMAL;
    v_tag_salary DECIMAL;
    v_tag RECORD;
BEGIN
    FOREACH v_position IN ARRAY v_positions LOOP
        v_pool_size := CASE v_position WHEN 'QB' THEN 10 WHEN 'TE' THEN 10 ELSE 20 END;

        -- Get top N salaries for position
        SELECT jsonb_agg(jsonb_build_object(
            'full_name', sub.full_name,
            'salary', sub.salary,
            'sleeper_player_id', sub.sleeper_player_id
        )), COALESCE(SUM(sub.salary), 0)
        INTO v_top_players, v_total_salary
        FROM (
            SELECT p.full_name, c.salary, p.sleeper_player_id
            FROM contracts c
            JOIN players p ON c.player_id = p.id
            WHERE c.league_id = p_league_id
              AND p.position = v_position
              AND c.status = 'active'
            ORDER BY c.salary DESC
            LIMIT v_pool_size
        ) sub;

        v_tag_salary := CEIL(v_total_salary / v_pool_size);

        -- Upsert franchise tag
        INSERT INTO franchise_tags (league_id, season, position, tag_salary, pool_size, top_players)
        VALUES (p_league_id, p_season, v_position, v_tag_salary, v_pool_size, COALESCE(v_top_players, '[]'::JSONB))
        ON CONFLICT (league_id, season, position)
        DO UPDATE SET tag_salary = v_tag_salary, pool_size = v_pool_size,
                      top_players = COALESCE(v_top_players, '[]'::JSONB), calculated_at = CURRENT_TIMESTAMP
        RETURNING * INTO v_tag;

        v_results := v_results || to_jsonb(v_tag);
    END LOOP;

    RETURN v_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 6. APPLY FRANCHISE TAG
-- Replaces: POST /api/contracts/franchise-tag
-- Applies franchise tag to a player (validates, creates contract, records usage)
-- =============================================
CREATE OR REPLACE FUNCTION apply_franchise_tag(
    p_league_id UUID,
    p_team_id UUID,
    p_player_id UUID,
    p_season INT
)
RETURNS JSONB AS $$
DECLARE
    v_existing RECORD;
    v_player RECORD;
    v_tag_value RECORD;
    v_tag_salary DECIMAL;
    v_cap RECORD;
    v_contract RECORD;
BEGIN
    -- Check if team already used a tag
    SELECT * INTO v_existing
    FROM franchise_tag_usage
    WHERE league_id = p_league_id AND team_id = p_team_id AND season = p_season;

    IF FOUND THEN
        RAISE EXCEPTION 'Team has already used their franchise tag this season';
    END IF;

    -- Get player
    SELECT * INTO v_player FROM players WHERE id = p_player_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Player not found';
    END IF;

    -- Get tag value
    SELECT * INTO v_tag_value
    FROM franchise_tags
    WHERE league_id = p_league_id AND season = p_season AND position = v_player.position;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Franchise tag value not calculated for %. Calculate tag values first.', v_player.position;
    END IF;

    v_tag_salary := v_tag_value.tag_salary;

    -- Check cap room
    SELECT * INTO v_cap FROM team_cap_summary WHERE team_id = p_team_id;
    IF v_cap IS NOT NULL AND v_cap.cap_room < v_tag_salary THEN
        RAISE EXCEPTION 'Insufficient cap room. Available: $%, Required: $%', v_cap.cap_room, v_tag_salary;
    END IF;

    -- Create 1-year contract
    INSERT INTO contracts (
        league_id, team_id, player_id, salary, years_total, years_remaining,
        start_season, end_season, contract_type, is_franchise_tagged,
        acquisition_type, acquisition_date
    ) VALUES (
        p_league_id, p_team_id, p_player_id, v_tag_salary, 1, 1,
        p_season, p_season, 'tag', true, 'tag', CURRENT_DATE
    ) RETURNING * INTO v_contract;

    -- Record usage
    INSERT INTO franchise_tag_usage (league_id, team_id, season, contract_id, player_id, tag_salary)
    VALUES (p_league_id, p_team_id, p_season, v_contract.id, p_player_id, v_tag_salary);

    -- Log cap transaction
    INSERT INTO cap_transactions (league_id, team_id, season, transaction_type, amount, description, related_contract_id)
    VALUES (p_league_id, p_team_id, p_season, 'tag_applied', v_tag_salary,
            'Franchise tag applied: ' || v_player.full_name, v_contract.id);

    RETURN jsonb_build_object(
        'contract', row_to_json(v_contract),
        'tag_salary', v_tag_salary,
        'position', v_player.position
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 7. EXECUTE TRADE
-- Replaces: executeTrade() in trades.ts
-- Transfers contracts, draft picks, cap space atomically
-- =============================================
CREATE OR REPLACE FUNCTION execute_trade(p_trade_id UUID)
RETURNS VOID AS $$
DECLARE
    v_trade RECORD;
    v_asset RECORD;
    v_contract RECORD;
    v_from_team RECORD;
    v_to_team RECORD;
    v_cap_amount DECIMAL;
    v_cap_year INT;
    v_team1 RECORD;
    v_team2 RECORD;
    v_trade_number TEXT;
    v_trade_count INT;
    v_current_year INT;
    v_team1_received JSONB := '[]'::JSONB;
    v_team2_received JSONB := '[]'::JSONB;
    v_item JSONB;
    v_pick RECORD;
    v_round_name TEXT;
    v_league_season INT;
BEGIN
    SELECT * INTO v_trade FROM trades WHERE id = p_trade_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Trade not found';
    END IF;

    -- Get league current season
    SELECT current_season INTO v_league_season FROM leagues WHERE id = v_trade.league_id;

    -- Get trade teams
    SELECT * INTO v_team1
    FROM trade_teams tt JOIN teams t ON tt.team_id = t.id
    WHERE tt.trade_id = p_trade_id ORDER BY tt.created_at LIMIT 1;

    SELECT * INTO v_team2
    FROM trade_teams tt JOIN teams t ON tt.team_id = t.id
    WHERE tt.trade_id = p_trade_id ORDER BY tt.created_at LIMIT 1 OFFSET 1;

    -- Process each asset
    FOR v_asset IN SELECT * FROM trade_assets WHERE trade_id = p_trade_id LOOP

        IF v_asset.asset_type = 'contract' AND v_asset.contract_id IS NOT NULL THEN
            -- Transfer contract
            UPDATE contracts SET team_id = v_asset.to_team_id, status = 'active'
            WHERE id = v_asset.contract_id;

            SELECT * INTO v_contract FROM contracts WHERE id = v_asset.contract_id;
            IF v_contract IS NOT NULL THEN
                -- Cap freed from sending team
                INSERT INTO cap_transactions (league_id, team_id, season, transaction_type, amount, description, related_contract_id, related_trade_id)
                VALUES (v_trade.league_id, v_asset.from_team_id, v_league_season, 'contract_traded_out', -v_contract.salary, 'Contract traded out', v_contract.id, p_trade_id);
                -- Cap used by receiving team
                INSERT INTO cap_transactions (league_id, team_id, season, transaction_type, amount, description, related_contract_id, related_trade_id)
                VALUES (v_trade.league_id, v_asset.to_team_id, v_league_season, 'contract_traded_in', v_contract.salary, 'Contract traded in', v_contract.id, p_trade_id);
            END IF;

            -- Build history item
            SELECT full_name INTO v_item FROM players WHERE id = v_contract.player_id;
            v_item := jsonb_build_object('type', 'player', 'name', v_item, 'salary', v_contract.salary, 'yearsLeft', v_contract.years_remaining);

        ELSIF v_asset.asset_type = 'draft_pick' AND v_asset.draft_pick_id IS NOT NULL THEN
            -- Transfer draft pick
            UPDATE draft_picks SET current_team_id = v_asset.to_team_id WHERE id = v_asset.draft_pick_id;

            SELECT dp.*, t.team_name as original_team_name, t.owner_name
            INTO v_pick
            FROM draft_picks dp
            LEFT JOIN teams t ON dp.original_team_id = t.id
            WHERE dp.id = v_asset.draft_pick_id;

            v_round_name := CASE v_pick.round WHEN 1 THEN '1st' WHEN 2 THEN '2nd' WHEN 3 THEN '3rd' ELSE v_pick.round || 'th' END;
            v_item := jsonb_build_object(
                'type', 'pick',
                'name', v_pick.season || ' ' || v_round_name || ' (' || COALESCE(v_pick.owner_name, v_pick.original_team_name) || ')',
                'pickYear', v_pick.season,
                'pickRound', v_pick.round,
                'originalOwner', COALESCE(v_pick.owner_name, v_pick.original_team_name)
            );

        ELSIF v_asset.asset_type = 'cap_space' AND v_asset.cap_amount IS NOT NULL THEN
            v_cap_amount := v_asset.cap_amount;
            v_cap_year := COALESCE(v_asset.cap_year, 2026);

            SELECT * INTO v_from_team FROM teams WHERE id = v_asset.from_team_id;
            SELECT * INTO v_to_team FROM teams WHERE id = v_asset.to_team_id;

            -- Cap hit for from_team
            INSERT INTO cap_adjustments (team_id, league_id, adjustment_type, description, trade_id,
                amount_2026, amount_2027, amount_2028, amount_2029, amount_2030)
            VALUES (v_asset.from_team_id, v_trade.league_id, 'trade_cap_hit',
                'Cap absorbed in trade with ' || COALESCE(v_to_team.owner_name, v_to_team.team_name), p_trade_id,
                CASE WHEN v_cap_year = 2026 THEN v_cap_amount ELSE 0 END,
                CASE WHEN v_cap_year = 2027 THEN v_cap_amount ELSE 0 END,
                CASE WHEN v_cap_year = 2028 THEN v_cap_amount ELSE 0 END,
                CASE WHEN v_cap_year = 2029 THEN v_cap_amount ELSE 0 END,
                CASE WHEN v_cap_year = 2030 THEN v_cap_amount ELSE 0 END);

            -- Cap credit for to_team
            INSERT INTO cap_adjustments (team_id, league_id, adjustment_type, description, trade_id,
                amount_2026, amount_2027, amount_2028, amount_2029, amount_2030)
            VALUES (v_asset.to_team_id, v_trade.league_id, 'trade_cap_credit',
                'Cap relief in trade from ' || COALESCE(v_from_team.owner_name, v_from_team.team_name), p_trade_id,
                CASE WHEN v_cap_year = 2026 THEN -v_cap_amount ELSE 0 END,
                CASE WHEN v_cap_year = 2027 THEN -v_cap_amount ELSE 0 END,
                CASE WHEN v_cap_year = 2028 THEN -v_cap_amount ELSE 0 END,
                CASE WHEN v_cap_year = 2029 THEN -v_cap_amount ELSE 0 END,
                CASE WHEN v_cap_year = 2030 THEN -v_cap_amount ELSE 0 END);

            v_item := jsonb_build_object('type', 'cap', 'capAmount', v_cap_amount, 'capYear', v_cap_year);
        ELSE
            CONTINUE;
        END IF;

        -- Assign to correct team's received list
        IF v_asset.to_team_id = v_team1.team_id THEN
            v_team1_received := v_team1_received || v_item;
        ELSIF v_asset.to_team_id = v_team2.team_id THEN
            v_team2_received := v_team2_received || v_item;
        END IF;
    END LOOP;

    -- Add to trade history
    v_current_year := EXTRACT(YEAR FROM CURRENT_DATE);
    SELECT COUNT(*)::INT INTO v_trade_count
    FROM trade_history WHERE league_id = v_trade.league_id AND trade_year = v_current_year;
    v_trade_number := RIGHT(v_current_year::TEXT, 2) || '.' || LPAD((v_trade_count + 1)::TEXT, 2, '0');

    INSERT INTO trade_history (
        league_id, trade_number, trade_year,
        team1_id, team1_name, team1_received,
        team2_id, team2_name, team2_received,
        trade_date, notes
    ) VALUES (
        v_trade.league_id, v_trade_number, v_current_year,
        v_team1.team_id, COALESCE(v_team1.owner_name, v_team1.team_name), v_team1_received,
        v_team2.team_id, COALESCE(v_team2.owner_name, v_team2.team_name), v_team2_received,
        CURRENT_DATE, v_trade.notes
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 8. ADVANCE SEASON
-- Replaces: POST /api/commissioner/advance-season
-- Decrements contract years, expires contracts, bumps season
-- =============================================
CREATE OR REPLACE FUNCTION advance_season(p_league_id UUID, p_commissioner_team_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_league RECORD;
    v_prev_season INT;
    v_new_season INT;
    v_expiring_count INT;
BEGIN
    SELECT * INTO v_league FROM leagues WHERE id = p_league_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'League not found';
    END IF;

    -- Verify commissioner
    IF NOT EXISTS (
        SELECT 1 FROM league_commissioners
        WHERE league_id = p_league_id AND team_id = p_commissioner_team_id
    ) THEN
        RAISE EXCEPTION 'Only commissioners can advance the season';
    END IF;

    v_prev_season := v_league.current_season;
    v_new_season := v_prev_season + 1;

    -- Decrement years_remaining on active contracts
    UPDATE contracts
    SET years_remaining = years_remaining - 1
    WHERE league_id = p_league_id AND status = 'active';

    -- Mark expired contracts (years_remaining <= 0) as pending_decision
    UPDATE contracts
    SET pending_decision = true
    WHERE league_id = p_league_id AND status = 'active' AND years_remaining <= 0;

    SELECT COUNT(*) INTO v_expiring_count
    FROM contracts
    WHERE league_id = p_league_id AND status = 'active' AND pending_decision = true;

    -- Update league season
    UPDATE leagues SET current_season = v_new_season, updated_at = CURRENT_TIMESTAMP
    WHERE id = p_league_id;

    RETURN jsonb_build_object(
        'previous_season', v_prev_season,
        'new_season', v_new_season,
        'expiring_contracts_count', v_expiring_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- GRANT EXECUTE to authenticated and anon roles
-- =============================================
GRANT EXECUTE ON FUNCTION get_league_cap_detailed(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_team_cap_projection(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_dead_cap_breakdown(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION release_contract(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_franchise_tags(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION apply_franchise_tag(UUID, UUID, UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION execute_trade(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION advance_season(UUID, UUID) TO authenticated;
