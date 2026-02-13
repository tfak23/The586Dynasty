// Supabase Edge Function for Player Stats Sync
// Fetches season stats from Sleeper API, calculates fantasy points, upserts to DB

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3"

const SLEEPER_API_BASE = 'https://api.sleeper.app/v1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Default PPR scoring
const DEFAULT_SCORING: Record<string, number> = {
  pass_yd: 0.04, pass_td: 4, pass_int: -2,
  rush_yd: 0.1, rush_td: 6,
  rec: 1, rec_yd: 0.1, rec_td: 6,
  fum_lost: -2,
}

function calculateFantasyPoints(stats: any, scoring: Record<string, number>): number {
  let points = 0
  points += (stats.pass_yd || 0) * (scoring.pass_yd ?? 0.04)
  points += (stats.pass_td || 0) * (scoring.pass_td ?? 4)
  points += (stats.pass_int || 0) * (scoring.pass_int ?? -2)
  points += (stats.rush_yd || 0) * (scoring.rush_yd ?? 0.1)
  points += (stats.rush_td || 0) * (scoring.rush_td ?? 6)
  points += (stats.rec || 0) * (scoring.rec ?? 1)
  points += (stats.rec_yd || 0) * (scoring.rec_yd ?? 0.1)
  points += (stats.rec_td || 0) * (scoring.rec_td ?? 6)
  points += (stats.fum_lost || 0) * (scoring.fum_lost ?? -2)
  return Math.round(points * 100) / 100
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { season, league_id } = await req.json()
    if (!season) throw new Error('season is required')

    // Get scoring settings
    let scoring = DEFAULT_SCORING
    if (league_id) {
      const { data: league } = await supabase.from('leagues').select('scoring_settings').eq('id', league_id).single()
      if (league?.scoring_settings) {
        scoring = typeof league.scoring_settings === 'string'
          ? JSON.parse(league.scoring_settings)
          : league.scoring_settings
      }
    }

    // Fetch stats from Sleeper
    const resp = await fetch(`${SLEEPER_API_BASE}/stats/nfl/regular/${season}`)
    if (!resp.ok) throw new Error(`Sleeper Stats API error: ${resp.status}`)
    const allStats = await resp.json()

    // Get players in our DB
    const { data: players } = await supabase
      .from('players')
      .select('id, sleeper_player_id')
      .in('position', ['QB', 'RB', 'WR', 'TE'])

    const playerMap = new Map((players || []).map((p: any) => [p.sleeper_player_id, p.id]))

    let synced = 0
    let skipped = 0
    const errors: string[] = []

    for (const [sleeperId, stats] of Object.entries(allStats) as [string, any][]) {
      const playerId = playerMap.get(sleeperId)
      if (!playerId) { skipped++; continue }

      const gamesPlayed = stats.gp || 0
      if (gamesPlayed === 0) { skipped++; continue }

      const totalPoints = calculateFantasyPoints(stats, scoring)
      const ppg = Math.round((totalPoints / gamesPlayed) * 100) / 100

      const { error } = await supabase.from('player_season_stats').upsert({
        player_id: playerId,
        season,
        games_played: gamesPlayed,
        games_started: stats.gs || 0,
        total_fantasy_points: totalPoints,
        avg_points_per_game: ppg,
        passing_yards: stats.pass_yd || 0,
        passing_tds: stats.pass_td || 0,
        interceptions: stats.pass_int || 0,
        passing_attempts: stats.pass_att || 0,
        completions: stats.pass_cmp || 0,
        rushing_yards: stats.rush_yd || 0,
        rushing_tds: stats.rush_td || 0,
        rushing_attempts: stats.rush_att || 0,
        receptions: stats.rec || 0,
        receiving_yards: stats.rec_yd || 0,
        receiving_tds: stats.rec_td || 0,
        targets: stats.rec_tgt || 0,
      }, { onConflict: 'player_id,season' })

      if (error) {
        errors.push(`${sleeperId}: ${error.message}`)
      } else {
        synced++
      }
    }

    return new Response(
      JSON.stringify({ status: 'success', data: { season, synced, skipped, errors: errors.slice(0, 10) } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
