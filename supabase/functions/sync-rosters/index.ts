// Supabase Edge Function for Roster Sync
// Fetches rosters from Sleeper API, detects dropped players, applies dead cap
// Also updates Google Sheet when players are dropped

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3"
import { sheetRemovePlayer } from '../_shared/sheet-operations.ts'

const SLEEPER_API_BASE = 'https://api.sleeper.app/v1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEAD_CAP_PERCENTAGES: Record<number, number[]> = {
  5: [0.75, 0.50, 0.25, 0.10, 0.10],
  4: [0.75, 0.50, 0.25, 0.10],
  3: [0.50, 0.25, 0.10],
  2: [0.50, 0.25],
  1: [0.50],
}

function calculateDeadCap(contract: any, currentSeason: number): number {
  if (contract.salary <= 1) return parseFloat(contract.salary)
  const yearsIntoContract = currentSeason - contract.start_season
  const percentages = DEAD_CAP_PERCENTAGES[contract.years_total] || []
  const percentage = percentages[yearsIntoContract] || 0
  return Math.round(parseFloat(contract.salary) * percentage * 100) / 100
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { league_id, all_leagues } = await req.json()

    let leagues: any[] = []

    if (all_leagues) {
      const { data } = await supabase.from('leagues').select('*')
      leagues = data || []
    } else if (league_id) {
      const { data } = await supabase.from('leagues').select('*').eq('id', league_id).single()
      if (data) leagues = [data]
    } else {
      throw new Error('league_id or all_leagues is required')
    }

    const allResults: any[] = []

    for (const league of leagues) {
      const currentSeason = league.current_season || 2025

      // Fetch rosters from Sleeper
      const rostersResp = await fetch(`${SLEEPER_API_BASE}/league/${league.sleeper_league_id}/rosters`)
      if (!rostersResp.ok) throw new Error(`Sleeper API error: ${rostersResp.status}`)
      const rosters = await rostersResp.json()

      // Get teams
      const { data: teams } = await supabase.from('teams').select('*').eq('league_id', league.id)
      if (!teams) continue

      const releasedContracts: any[] = []
      const sheetDetails: string[] = []

      for (const roster of rosters) {
        const team = teams.find((t: any) => t.sleeper_roster_id === roster.roster_id)
        if (!team) continue

        // Get current contracts
        const { data: currentContracts } = await supabase
          .from('contracts')
          .select('*, players!inner(sleeper_player_id, full_name)')
          .eq('team_id', team.id)
          .eq('status', 'active')

        if (!currentContracts) continue

        const currentPlayerIds = new Set(currentContracts.map((c: any) => c.players.sleeper_player_id))
        const sleeperPlayerIds = new Set(roster.players || [])

        // Find removals (in DB but not on Sleeper) - AUTO RELEASE
        for (const contract of currentContracts) {
          if (!sleeperPlayerIds.has(contract.players.sleeper_player_id)) {
            const deadCap = calculateDeadCap(contract, currentSeason)

            // Release contract
            await supabase.from('contracts').update({
              status: 'released',
              released_at: new Date().toISOString(),
              release_reason: 'dropped',
              dead_cap_hit: deadCap,
            }).eq('id', contract.id)

            // Log dead cap
            if (deadCap > 0) {
              await supabase.from('cap_transactions').insert({
                league_id: league.id,
                team_id: team.id,
                season: currentSeason,
                transaction_type: 'dead_money',
                amount: deadCap,
                description: `Dead cap from drop: ${contract.players.full_name}`,
                related_contract_id: contract.id,
              })
            }

            // Update Google Sheet (non-blocking)
            try {
              const deadCapByYear: Record<number, number> = {}
              deadCapByYear[currentSeason] = deadCap
              const sheetResult = await sheetRemovePlayer({
                playerName: contract.players.full_name,
                ownerName: team.owner_name,
                deadCapByYear,
                reason: 'dropped',
              })
              sheetDetails.push(...sheetResult.details)
            } catch (sheetErr) {
              sheetDetails.push(`Sheet sync failed for ${contract.players.full_name}: ${(sheetErr as Error).message}`)
            }

            releasedContracts.push({
              team_name: team.team_name,
              player_name: contract.players.full_name,
              salary: contract.salary,
              dead_cap: deadCap,
            })
          }
        }
      }

      // Log sync
      if (releasedContracts.length > 0) {
        await supabase.from('sync_log').insert({
          league_id: league.id,
          sync_type: 'roster_releases',
          status: 'completed',
          records_processed: releasedContracts.length,
          completed_at: new Date().toISOString(),
        })
      }

      allResults.push({
        league_id: league.id,
        league_name: league.name,
        players_released: releasedContracts.length,
        released_contracts: releasedContracts,
        sheet_details: sheetDetails,
      })
    }

    return new Response(
      JSON.stringify({ status: 'success', data: allResults }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
