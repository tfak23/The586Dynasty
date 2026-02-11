// Supabase Edge Function: Get Sleeper Leagues
// Retrieves leagues for a user's linked Sleeper account and their registration status

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user profile with Sleeper info
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('sleeper_user_id, sleeper_username')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ 
          error: 'User profile not found. Please link your Sleeper account first.',
          code: 'NO_SLEEPER_ACCOUNT'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!profile.sleeper_user_id) {
      return new Response(
        JSON.stringify({ 
          error: 'No Sleeper account linked. Please link your Sleeper account.',
          code: 'NO_SLEEPER_ACCOUNT'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch leagues from Sleeper API
    // Use current season (2025) - you may want to make this dynamic
    const currentSeason = new Date().getFullYear()
    const sleeperResponse = await fetch(
      `https://api.sleeper.app/v1/user/${profile.sleeper_user_id}/leagues/nfl/${currentSeason}`
    )

    if (!sleeperResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch leagues from Sleeper' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const sleeperLeagues = await sleeperResponse.json()

    // Check which leagues are registered in our system
    const leagueIds = sleeperLeagues.map((l: any) => l.league_id)
    
    const { data: registeredLeagues, error: regError } = await supabase
      .from('leagues')
      .select(`
        sleeper_league_id,
        id,
        name,
        league_registration (
          is_active,
          initial_commissioner_id,
          registered_at
        ),
        league_members!inner (
          user_id,
          role,
          status
        )
      `)
      .in('sleeper_league_id', leagueIds)

    if (regError) {
      console.error('Error fetching registered leagues:', regError)
    }

    // Check which leagues user is already a member of
    const { data: userMemberships, error: memberError } = await supabase
      .from('league_members')
      .select('league_id, role, status')
      .eq('user_id', user.id)

    if (memberError) {
      console.error('Error fetching user memberships:', memberError)
    }

    const userLeagueIds = new Set(userMemberships?.map(m => m.league_id) || [])

    // Combine Sleeper data with our registration status
    const leaguesWithStatus = sleeperLeagues.map((league: any) => {
      const registeredLeague = registeredLeagues?.find(
        rl => rl.sleeper_league_id === league.league_id
      )
      
      const isRegistered = !!registeredLeague
      const isMember = isRegistered && userLeagueIds.has(registeredLeague.id)
      const userMembership = userMemberships?.find(m => m.league_id === registeredLeague?.id)

      return {
        sleeper_league_id: league.league_id,
        name: league.name,
        total_rosters: league.total_rosters,
        season: league.season,
        avatar: league.avatar,
        
        // Registration status
        is_registered: isRegistered,
        app_league_id: registeredLeague?.id || null,
        
        // User's membership status
        is_member: isMember,
        member_role: userMembership?.role || null,
        member_status: userMembership?.status || null,
        
        // Action button to show
        action: isRegistered 
          ? (isMember ? 'view' : 'join') 
          : 'convert'
      }
    })

    return new Response(
      JSON.stringify({ 
        success: true,
        leagues: leaguesWithStatus,
        sleeper_username: profile.sleeper_username
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in sleeper-get-leagues:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
