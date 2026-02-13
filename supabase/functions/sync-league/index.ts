// Supabase Edge Function for Full League Sync
// Syncs league info, users/teams, and roster players from Sleeper API

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3"

const SLEEPER_API_BASE = 'https://api.sleeper.app/v1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { league_id } = await req.json()
    if (!league_id) throw new Error('league_id is required')

    const { data: league } = await supabase.from('leagues').select('*').eq('id', league_id).single()
    if (!league) throw new Error('League not found')

    // Log sync start
    const { data: syncLog } = await supabase.from('sync_log').insert({
      league_id, sync_type: 'full', status: 'started',
    }).select().single()

    try {
      // Fetch from Sleeper
      const [leagueResp, usersResp, rostersResp, playersResp] = await Promise.all([
        fetch(`${SLEEPER_API_BASE}/league/${league.sleeper_league_id}`),
        fetch(`${SLEEPER_API_BASE}/league/${league.sleeper_league_id}/users`),
        fetch(`${SLEEPER_API_BASE}/league/${league.sleeper_league_id}/rosters`),
        fetch(`${SLEEPER_API_BASE}/players/nfl`),
      ])

      const leagueData = await leagueResp.json()
      const users = await usersResp.json()
      const rosters = await rostersResp.json()
      const allPlayers = await playersResp.json()

      // Update league info
      await supabase.from('leagues').update({
        name: leagueData.name,
        total_rosters: leagueData.total_rosters,
        roster_positions: leagueData.roster_positions,
        scoring_settings: leagueData.scoring_settings,
      }).eq('id', league_id)

      // Sync teams
      for (const roster of rosters) {
        const user = users.find((u: any) => u.user_id === roster.owner_id)
        await supabase.from('teams').upsert({
          league_id,
          sleeper_roster_id: roster.roster_id,
          sleeper_user_id: roster.owner_id,
          team_name: user?.metadata?.team_name || user?.display_name || 'Unknown',
          owner_name: user?.display_name || 'Unknown',
          avatar_url: user?.avatar ? `https://sleepercdn.com/avatars/thumbs/${user.avatar}` : null,
        }, { onConflict: 'league_id,sleeper_roster_id' })
      }

      // Sync rostered players
      const rosterPlayerIds = new Set<string>()
      for (const roster of rosters) {
        if (roster.players) {
          roster.players.forEach((id: string) => rosterPlayerIds.add(id))
        }
      }

      let playersProcessed = 0
      for (const playerId of rosterPlayerIds) {
        const p = allPlayers[playerId]
        if (p && ['QB', 'RB', 'WR', 'TE'].includes(p.position)) {
          await supabase.from('players').upsert({
            sleeper_player_id: playerId,
            full_name: p.full_name,
            first_name: p.first_name,
            last_name: p.last_name,
            position: p.position,
            team: p.team,
            age: p.age,
            years_exp: p.years_exp,
            college: p.college,
            number: p.number,
            status: p.status,
            search_full_name: p.full_name?.toLowerCase(),
            search_last_name: p.last_name?.toLowerCase(),
          }, { onConflict: 'sleeper_player_id' })
          playersProcessed++
        }
      }

      // Log completion
      await supabase.from('sync_log').update({
        status: 'completed',
        records_processed: playersProcessed,
        completed_at: new Date().toISOString(),
      }).eq('id', syncLog?.id)

      return new Response(
        JSON.stringify({
          status: 'success',
          data: { league_updated: true, teams_synced: rosters.length, players_synced: playersProcessed },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (error) {
      await supabase.from('sync_log').update({
        status: 'failed',
        errors: { message: error.message },
        completed_at: new Date().toISOString(),
      }).eq('id', syncLog?.id)
      throw error
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
