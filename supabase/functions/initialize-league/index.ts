// Supabase Edge Function for League Initialization
// Creates a new league from Sleeper data (first-time setup)

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

    const { sleeper_league_id } = await req.json()
    if (!sleeper_league_id) throw new Error('sleeper_league_id is required')

    // Check if already exists
    const { data: existing } = await supabase
      .from('leagues')
      .select('id')
      .eq('sleeper_league_id', sleeper_league_id)
      .single()

    if (existing) throw new Error('League already initialized')

    // Fetch from Sleeper
    const [leagueResp, usersResp, rostersResp] = await Promise.all([
      fetch(`${SLEEPER_API_BASE}/league/${sleeper_league_id}`),
      fetch(`${SLEEPER_API_BASE}/league/${sleeper_league_id}/users`),
      fetch(`${SLEEPER_API_BASE}/league/${sleeper_league_id}/rosters`),
    ])

    const leagueData = await leagueResp.json()
    const users = await usersResp.json()
    const rosters = await rostersResp.json()

    // Create league
    const { data: league, error: leagueErr } = await supabase.from('leagues').insert({
      sleeper_league_id,
      name: leagueData.name,
      total_rosters: leagueData.total_rosters,
      roster_positions: leagueData.roster_positions,
      scoring_settings: leagueData.scoring_settings,
      current_season: 2025,
    }).select().single()

    if (leagueErr) throw leagueErr

    // Create teams
    const createdTeams: any[] = []
    for (const roster of rosters) {
      const user = users.find((u: any) => u.user_id === roster.owner_id)
      const { data: team } = await supabase.from('teams').insert({
        league_id: league.id,
        sleeper_roster_id: roster.roster_id,
        sleeper_user_id: roster.owner_id,
        team_name: user?.metadata?.team_name || user?.display_name || 'Team ' + roster.roster_id,
        owner_name: user?.display_name || 'Unknown',
        avatar_url: user?.avatar ? `https://sleepercdn.com/avatars/thumbs/${user.avatar}` : null,
      }).select().single()

      if (team) createdTeams.push(team)
    }

    // Set first team as primary commissioner
    if (createdTeams.length > 0) {
      await supabase.from('league_commissioners').insert({
        league_id: league.id,
        team_id: createdTeams[0].id,
        is_primary: true,
      })
    }

    return new Response(
      JSON.stringify({
        status: 'success',
        data: {
          league,
          teams_created: createdTeams.length,
          message: 'League initialized! Now import your CSV data to create contracts.',
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
