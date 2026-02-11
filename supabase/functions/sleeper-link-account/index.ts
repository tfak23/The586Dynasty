// Supabase Edge Function: Link Sleeper Account
// Links a user's Sleeper username to their app account with one-to-one validation

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface RequestBody {
  sleeper_username: string;
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
    const { sleeper_username }: RequestBody = await req.json()

    if (!sleeper_username || sleeper_username.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'sleeper_username is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if sleeper username is already linked to another account
    const { data: existingProfile, error: checkError } = await supabase
      .from('user_profiles')
      .select('id, sleeper_username')
      .eq('sleeper_username', sleeper_username)
      .maybeSingle()

    if (checkError) {
      console.error('Error checking existing profile:', checkError)
      return new Response(
        JSON.stringify({ error: 'Database error checking username' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (existingProfile && existingProfile.id !== user.id) {
      return new Response(
        JSON.stringify({ 
          error: 'This Sleeper username is already linked to another account',
          code: 'SLEEPER_USERNAME_TAKEN'
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch Sleeper user data to validate username exists
    const sleeperResponse = await fetch(`https://api.sleeper.app/v1/user/${sleeper_username}`)
    
    if (!sleeperResponse.ok) {
      if (sleeperResponse.status === 404) {
        return new Response(
          JSON.stringify({ 
            error: 'Sleeper username not found',
            code: 'SLEEPER_USER_NOT_FOUND'
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to validate Sleeper username' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const sleeperUser = await sleeperResponse.json()

    // Update or create user profile with Sleeper data
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .upsert({
        id: user.id,
        sleeper_username: sleeperUser.username,
        sleeper_user_id: sleeperUser.user_id,
        sleeper_display_name: sleeperUser.display_name,
        sleeper_avatar: sleeperUser.avatar ? `https://sleepercdn.com/avatars/${sleeperUser.avatar}` : null,
        email: user.email,
        display_name: user.user_metadata?.full_name || sleeperUser.display_name,
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (profileError) {
      console.error('Error updating profile:', profileError)
      return new Response(
        JSON.stringify({ error: 'Failed to link Sleeper account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        profile: profile,
        message: 'Sleeper account linked successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in sleeper-link-account:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
