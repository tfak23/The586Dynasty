// Supabase Edge Function for Google Sheets Sync
// Actions: full-reconciliation, differential-sync, sync-single-team

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3"
import { sheetFullReconciliation, sheetRemovePlayer } from '../_shared/sheet-operations.ts'
import { SLEEPER_TO_TAB, TAB_TO_FULLNAME, resolveTabName, calculateDeadCap } from '../_shared/sheet-mapping.ts'
import { readRange } from '../_shared/google-sheets.ts'

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

function calcDeadCap(contract: any, currentSeason: number): number {
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

    const { action, league_id: rawLeagueId, sleeper_league_id } = await req.json()

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'action is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Resolve league_id: accept UUID or sleeper_league_id
    let league_id = rawLeagueId
    if (!league_id && sleeper_league_id) {
      const { data: found } = await supabase.from('leagues').select('id').eq('sleeper_league_id', sleeper_league_id).single()
      if (found) league_id = found.id
    }
    // Default to The 586 Dynasty if no league specified
    if (!league_id) {
      const { data: found } = await supabase.from('leagues').select('id').eq('sleeper_league_id', '1315789488873553920').single()
      if (found) league_id = found.id
    }

    let result: any = {}

    switch (action) {
      // ============================================================
      // FULL RECONCILIATION — Rebuild entire sheet from DB
      // ============================================================
      case 'full-reconciliation': {
        if (!league_id) throw new Error('league_id is required for full-reconciliation')

        const { data: league } = await supabase.from('leagues').select('*').eq('id', league_id).single()
        if (!league) throw new Error('League not found')

        const { data: teams } = await supabase.from('teams').select('*').eq('league_id', league_id).order('team_name')
        if (!teams) throw new Error('No teams found')

        const teamData: any[] = []

        for (const team of teams) {
          const tab = resolveTabName(team.owner_name)
          if (!tab) continue

          // Get active contracts with player info
          const { data: contracts } = await supabase
            .from('contracts')
            .select('*, players!inner(full_name, position, team)')
            .eq('team_id', team.id)
            .eq('status', 'active')
            .order('salary', { ascending: false })

          // Build salary-by-year from contract data
          const contractData = (contracts || []).map((c: any) => {
            const salaryByYear: Record<number, number> = {}
            for (let yr = c.start_season; yr <= c.end_season; yr++) {
              if (c.has_option && c.option_year === yr) continue // Skip option year
              salaryByYear[yr] = c.salary
            }

            return {
              playerName: c.players.full_name,
              position: c.players.position,
              contractType: c.contract_type || 'standard',
              salary: c.salary,
              salaryByYear,
              rosterStatus: c.roster_status || 'active',
              ownerName: team.owner_name,
            }
          })

          // Get cap adjustments
          const { data: adjustments } = await supabase
            .from('cap_adjustments')
            .select('*')
            .eq('team_id', team.id)
            .order('created_at', { ascending: false })

          const capAdjData = (adjustments || []).map((a: any) => ({
            description: a.description || a.adjustment_type || 'Adjustment',
            adjustmentType: a.adjustment_type || 'dead_cap',
            amountByYear: {
              2026: a.amount_2026 || 0,
              2027: a.amount_2027 || 0,
              2028: a.amount_2028 || 0,
              2029: a.amount_2029 || 0,
              2030: a.amount_2030 || 0,
            },
          }))

          teamData.push({
            tabName: tab,
            fullName: TAB_TO_FULLNAME[tab] || team.owner_name,
            contracts: contractData,
            capAdjustments: capAdjData,
          })
        }

        const reconcileResult = await sheetFullReconciliation(teamData)

        // Log sync
        await supabase.from('sync_log').insert({
          league_id,
          sync_type: 'sheet_full_reconciliation',
          status: 'completed',
          records_processed: teamData.reduce((sum: number, t: any) => sum + t.contracts.length, 0),
          completed_at: new Date().toISOString(),
        })

        result = {
          success: true,
          teams_synced: teamData.length,
          total_contracts: teamData.reduce((sum: number, t: any) => sum + t.contracts.length, 0),
          details: reconcileResult.details,
        }
        break
      }

      // ============================================================
      // DIFFERENTIAL SYNC — Detect Sleeper drops, update DB + Sheet
      // ============================================================
      case 'differential-sync': {
        if (!league_id) throw new Error('league_id is required for differential-sync')

        const { data: league } = await supabase.from('leagues').select('*').eq('id', league_id).single()
        if (!league) throw new Error('League not found')

        const currentSeason = league.current_season || 2025

        // Fetch rosters from Sleeper
        const rostersResp = await fetch(`${SLEEPER_API_BASE}/league/${league.sleeper_league_id}/rosters`)
        if (!rostersResp.ok) throw new Error(`Sleeper API error: ${rostersResp.status}`)
        const rosters = await rostersResp.json()

        const { data: teams } = await supabase.from('teams').select('*').eq('league_id', league_id)
        if (!teams) throw new Error('No teams found')

        const releasedContracts: any[] = []
        const sheetDetails: string[] = []

        for (const roster of rosters) {
          const team = teams.find((t: any) => t.sleeper_roster_id === roster.roster_id)
          if (!team) continue

          const { data: currentContracts } = await supabase
            .from('contracts')
            .select('*, players!inner(sleeper_player_id, full_name, position)')
            .eq('team_id', team.id)
            .eq('status', 'active')

          if (!currentContracts) continue

          const sleeperPlayerIds = new Set(roster.players || [])

          for (const contract of currentContracts) {
            if (!sleeperPlayerIds.has(contract.players.sleeper_player_id)) {
              const deadCap = calcDeadCap(contract, currentSeason)
              const deadCapByYear: Record<number, number> = {}
              deadCapByYear[currentSeason] = deadCap

              // Update DB
              await supabase.from('contracts').update({
                status: 'released',
                released_at: new Date().toISOString(),
                release_reason: 'dropped',
                dead_cap_hit: deadCap,
              }).eq('id', contract.id)

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

              // Update Google Sheet
              try {
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
        await supabase.from('sync_log').insert({
          league_id,
          sync_type: 'differential_sheet_sync',
          status: 'completed',
          records_processed: releasedContracts.length,
          completed_at: new Date().toISOString(),
        })

        result = {
          success: true,
          players_released: releasedContracts.length,
          released_contracts: releasedContracts,
          sheet_details: sheetDetails,
        }
        break
      }

      // ============================================================
      // TEST CONNECTION — Verify Google Sheets access
      // ============================================================
      case 'test-connection': {
        // Try to read a single cell from the sheet
        const testData = await readRange("'Tony'!A1:A1")
        result = {
          success: true,
          message: 'Google Sheets connection successful',
          test_value: testData[0]?.[0] || '(empty)',
        }
        break
      }

      default:
        throw new Error(`Unknown action: ${action}`)
    }

    return new Response(
      JSON.stringify({ status: 'success', ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('sheet-sync error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
