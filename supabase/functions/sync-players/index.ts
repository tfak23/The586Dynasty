// Supabase Edge Function for Player Sync
// Fetches all NFL players from Sleeper API and upserts into players table

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

    // Fetch all players from Sleeper
    const resp = await fetch(`${SLEEPER_API_BASE}/players/nfl`)
    if (!resp.ok) throw new Error(`Sleeper API error: ${resp.status}`)
    const allPlayers = await resp.json()

    let synced = 0
    const validPositions = ['QB', 'RB', 'WR', 'TE']

    // Process in batches
    const entries = Object.entries(allPlayers).filter(
      ([_, p]: any) => p && validPositions.includes(p.position)
    )

    // Batch upsert in chunks of 100
    const batchSize = 100
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize).map(([playerId, p]: any) => ({
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
      }))

      const { error } = await supabase.from('players').upsert(batch, {
        onConflict: 'sleeper_player_id',
      })

      if (error) console.error('Batch upsert error:', error)
      synced += batch.length
    }

    return new Response(
      JSON.stringify({
        status: 'success',
        data: { players_synced: synced, total_eligible: entries.length },
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
