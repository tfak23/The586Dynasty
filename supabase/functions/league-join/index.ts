// Supabase Edge Function: Join League
// Allows a user to join an already-registered salary cap league

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

    // Parse request
    const { sleeper_league_id }: RequestBody = await req.json()

    if (!sleeper_league_id) {
      return new Response(
        JSON.stringify({ error: 'sleeper_league_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user's Sleeper info
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('sleeper_user_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || !profile.sleeper_user_id) {
      return new Response(
        JSON.stringify({ 
          error: 'Please link your Sleeper account first',
          code: 'NO_SLEEPER_ACCOUNT'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if league exists in our system
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id, name, sleeper_league_id')
      .eq('sleeper_league_id', sleeper_league_id)
      .single()

    if (leagueError || !league) {
      return new Response(
        JSON.stringify({ 
          error: 'League not found. It may not be registered yet.',
          code: 'LEAGUE_NOT_REGISTERED'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is already a member
    const { data: existingMembership, error: memberCheckError } = await supabase
      .from('league_members')
      .select('id, status, role')
      .eq('league_id', league.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (memberCheckError) {
      console.error('Error checking membership:', memberCheckError)
    }

    if (existingMembership) {
      if (existingMembership.status === 'active') {
        return new Response(
          JSON.stringify({ 
            error: 'You are already a member of this league',
            code: 'ALREADY_MEMBER',
            role: existingMembership.role
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else {
        // Reactivate membership
        const { error: updateError } = await supabase
          .from('league_members')
          .update({ status: 'active' })
          .eq('id', existingMembership.id)

        if (updateError) {
          return new Response(
            JSON.stringify({ error: 'Failed to reactivate membership' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'Successfully rejoined league',
            league_id: league.id
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Verify user is actually in this Sleeper league
    const rostersResponse = await fetch(
      `https://api.sleeper.app/v1/league/${sleeper_league_id}/rosters`
    )

    if (!rostersResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to verify league membership with Sleeper' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const rosters = await rostersResponse.json()
    const userRoster = rosters.find((r: any) => r.owner_id === profile.sleeper_user_id)

    if (!userRoster) {
      return new Response(
        JSON.stringify({ 
          error: 'You are not a member of this league on Sleeper',
          code: 'NOT_IN_SLEEPER_LEAGUE'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Find the user's team in our database
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id')
      .eq('league_id', league.id)
      .eq('sleeper_user_id', profile.sleeper_user_id)
      .single()

    if (teamError) {
      console.error('Error finding team:', teamError)
    }

    // Add user as league member
    const { data: membership, error: joinError } = await supabase
      .from('league_members')
      .insert({
        league_id: league.id,
        user_id: user.id,
        team_id: team?.id || null,
        role: 'member',
        status: 'active'
      })
      .select()
      .single()

    if (joinError) {
      console.error('Error joining league:', joinError)
      return new Response(
        JSON.stringify({ error: 'Failed to join league' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update team with user_id if found
    if (team) {
      await supabase
        .from('teams')
        .update({ user_id: user.id })
        .eq('id', team.id)
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Successfully joined league',
        league_id: league.id,
        team_id: team?.id || null,
        membership: membership
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in league-join:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
