// Supabase Edge Function: Convert League to Salary Cap
// Converts a Sleeper league to a salary cap league and makes the user the commissioner

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface RequestBody {
  sleeper_league_id: string;
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Service role client for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      supabaseServiceKey
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request
    const { sleeper_league_id }: RequestBody = await req.json()

    if (!sleeper_league_id) {
      return new Response(
        JSON.stringify({ error: 'sleeper_league_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if league is already registered
    const { data: existingLeague, error: checkError } = await supabase
      .from('leagues')
      .select('id, name')
      .eq('sleeper_league_id', sleeper_league_id)
      .maybeSingle()

    if (checkError) {
      console.error('Error checking existing league:', checkError)
      return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (existingLeague) {
      return new Response(
        JSON.stringify({ 
          error: 'This league is already registered as a salary cap league',
          code: 'LEAGUE_ALREADY_REGISTERED',
          league_id: existingLeague.id
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch league data from Sleeper
    const leagueResponse = await fetch(
      `https://api.sleeper.app/v1/league/${sleeper_league_id}`
    )

    if (!leagueResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch league data from Sleeper' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const leagueData = await leagueResponse.json()

    // Fetch rosters for the league
    const rostersResponse = await fetch(
      `https://api.sleeper.app/v1/league/${sleeper_league_id}/rosters`
    )

    if (!rostersResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch roster data from Sleeper' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const rostersData = await rostersResponse.json()

    // Fetch users in the league
    const usersResponse = await fetch(
      `https://api.sleeper.app/v1/league/${sleeper_league_id}/users`
    )

    if (!usersResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch users data from Sleeper' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const usersData = await usersResponse.json()

    // Create league in our database using service role (bypasses RLS)
    const { data: newLeague, error: leagueError } = await supabaseAdmin
      .from('leagues')
      .insert({
        sleeper_league_id: sleeper_league_id,
        name: leagueData.name,
        total_rosters: leagueData.total_rosters,
        current_season: leagueData.season,
        roster_positions: leagueData.roster_positions,
        scoring_settings: leagueData.scoring_settings
      })
      .select()
      .single()

    if (leagueError) {
      console.error('Error creating league:', leagueError)
      return new Response(
        JSON.stringify({ error: 'Failed to create league' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create teams from rosters
    const teamsToInsert = rostersData.map((roster: any) => {
      const owner = usersData.find((u: any) => u.user_id === roster.owner_id)
      return {
        league_id: newLeague.id,
        sleeper_roster_id: roster.roster_id,
        sleeper_user_id: roster.owner_id,
        team_name: owner?.metadata?.team_name || owner?.display_name || `Team ${roster.roster_id}`,
        owner_name: owner?.display_name,
        avatar_url: owner?.avatar ? `https://sleepercdn.com/avatars/${owner.avatar}` : null
      }
    })

    const { data: teams, error: teamsError } = await supabaseAdmin
      .from('teams')
      .insert(teamsToInsert)
      .select()

    if (teamsError) {
      console.error('Error creating teams:', teamsError)
      // Rollback league creation
      await supabaseAdmin.from('leagues').delete().eq('id', newLeague.id)
      return new Response(
        JSON.stringify({ error: 'Failed to create teams' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Register the league
    const { error: regError } = await supabaseAdmin
      .from('league_registration')
      .insert({
        league_id: newLeague.id,
        registered_by: user.id,
        initial_commissioner_id: user.id,
        is_active: true
      })

    if (regError) {
      console.error('Error registering league:', regError)
    }

    // Add user as commissioner and member
    const { error: memberError } = await supabaseAdmin
      .from('league_members')
      .insert({
        league_id: newLeague.id,
        user_id: user.id,
        role: 'commissioner',
        can_manage_league: true,
        can_manage_trades: true,
        can_manage_contracts: true,
        status: 'active'
      })

    if (memberError) {
      console.error('Error adding commissioner:', memberError)
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        league: newLeague,
        message: 'League converted to salary cap league successfully. You are now the commissioner.',
        teams_created: teams.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in league-convert:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
