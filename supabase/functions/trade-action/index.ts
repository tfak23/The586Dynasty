// Supabase Edge Function for Trade Actions
// Handles: accept, reject, vote, commissioner-approve, cancel, withdraw
// Also syncs completed trades to Google Sheet

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3"
import { sheetExecuteTrade } from '../_shared/sheet-operations.ts'
import { resolveTabName } from '../_shared/sheet-mapping.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Sync a completed trade to the Google Sheet
async function syncTradeToSheet(supabase: any, tradeId: string) {
  try {
    // Fetch trade with full details
    const { data: trade } = await supabase
      .from('trades')
      .select('*, trade_teams(*, teams(team_name, owner_name)), trade_assets(*, contracts(salary, start_season, end_season, years_remaining, contract_type, players(full_name, position)))')
      .eq('id', tradeId)
      .single()

    if (!trade || !trade.trade_teams || trade.trade_teams.length < 2) return []

    const team1 = trade.trade_teams[0]
    const team2 = trade.trade_teams[1]

    // Get trade history for trade number
    const { data: history } = await supabase
      .from('trade_history')
      .select('trade_number')
      .eq('league_id', trade.league_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Generate trade number if no history exists
    const currentYear = new Date().getFullYear()
    const shortYear = currentYear - 2000 // e.g., 26
    let tradeNumber = `${shortYear}.01`
    if (history?.trade_number) {
      const parts = history.trade_number.split('.')
      const num = parseInt(parts[1] || '0') + 1
      tradeNumber = `${parts[0]}.${num.toString().padStart(2, '0')}`
    }

    // Separate assets by team
    const team1Received = (trade.trade_assets || [])
      .filter((a: any) => a.receiving_team_id === team1.team_id)
      .map((a: any) => ({
        type: a.asset_type,
        name: a.contracts?.players?.full_name || a.description,
        salary: a.contracts?.salary,
        yearsLeft: a.contracts?.years_remaining,
        position: a.contracts?.players?.position,
        capAmount: a.cap_amount,
        capYear: a.cap_year,
        pickYear: a.pick_season,
        pickRound: a.pick_round,
        salaryByYear: buildSalaryByYear(a.contracts),
      }))

    const team2Received = (trade.trade_assets || [])
      .filter((a: any) => a.receiving_team_id === team2.team_id)
      .map((a: any) => ({
        type: a.asset_type,
        name: a.contracts?.players?.full_name || a.description,
        salary: a.contracts?.salary,
        yearsLeft: a.contracts?.years_remaining,
        position: a.contracts?.players?.position,
        capAmount: a.cap_amount,
        capYear: a.cap_year,
        pickYear: a.pick_season,
        pickRound: a.pick_round,
        salaryByYear: buildSalaryByYear(a.contracts),
      }))

    const sheetResult = await sheetExecuteTrade({
      tradeNumber,
      team1OwnerName: team1.teams.owner_name,
      team2OwnerName: team2.teams.owner_name,
      team1Received,
      team2Received,
    })

    return sheetResult.details
  } catch (err) {
    console.error('Sheet trade sync error:', err)
    return [`Sheet sync failed: ${(err as Error).message}`]
  }
}

function buildSalaryByYear(contract: any): Record<number, number> {
  if (!contract) return {}
  const result: Record<number, number> = {}
  for (let yr = contract.start_season; yr <= contract.end_season; yr++) {
    result[yr] = contract.salary
  }
  return result
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { trade_id, action, team_id, commissioner_team_id, vote } = await req.json()

    if (!trade_id || !action) {
      return new Response(
        JSON.stringify({ error: 'trade_id and action are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let result: any = {}

    switch (action) {
      case 'accept': {
        if (!team_id) throw new Error('team_id is required')

        // Update team's acceptance
        const { error: updateErr } = await supabase
          .from('trade_teams')
          .update({ status: 'accepted', accepted_at: new Date().toISOString() })
          .eq('trade_id', trade_id)
          .eq('team_id', team_id)
          .eq('status', 'pending')

        if (updateErr) throw updateErr

        // Check if all teams have accepted
        const { data: pending } = await supabase
          .from('trade_teams')
          .select('*')
          .eq('trade_id', trade_id)
          .eq('status', 'pending')

        if (pending && pending.length === 0) {
          const { data: trade } = await supabase
            .from('trades')
            .select('*')
            .eq('id', trade_id)
            .single()

          if (trade?.approval_mode === 'auto') {
            // Execute trade via DB function
            const { error: execErr } = await supabase.rpc('execute_trade', { p_trade_id: trade_id })
            if (execErr) throw execErr
            await supabase.from('trades').update({ status: 'completed' }).eq('id', trade_id)

            // Sync to Google Sheet
            const sheetDetails = await syncTradeToSheet(supabase, trade_id)
            result.sheet_details = sheetDetails
          } else {
            await supabase.from('trades').update({ status: 'accepted' }).eq('id', trade_id)
          }
        }

        const { data: updatedTrade } = await supabase.from('trades').select('*').eq('id', trade_id).single()
        result = {
          ...result,
          data: updatedTrade,
          message: pending && pending.length === 0 ? 'All teams accepted' : `Waiting for ${pending?.length} more team(s)`,
        }
        break
      }

      case 'reject': {
        if (!team_id) throw new Error('team_id is required')
        await supabase.from('trade_teams').update({ status: 'rejected' }).eq('trade_id', trade_id).eq('team_id', team_id)
        await supabase.from('trades').update({ status: 'rejected' }).eq('id', trade_id)
        result = { message: 'Trade rejected' }
        break
      }

      case 'commissioner-approve': {
        if (!commissioner_team_id) throw new Error('commissioner_team_id is required')

        const { data: trade } = await supabase.from('trades').select('*').eq('id', trade_id).single()
        if (!trade) throw new Error('Trade not found')

        // Verify commissioner
        const { data: isComm } = await supabase
          .from('league_commissioners')
          .select('*')
          .eq('league_id', trade.league_id)
          .eq('team_id', commissioner_team_id)
          .single()

        if (!isComm) throw new Error('Only commissioners can approve trades')

        // Execute trade
        const { error: execErr } = await supabase.rpc('execute_trade', { p_trade_id: trade_id })
        if (execErr) throw execErr

        await supabase.from('trades').update({
          status: 'completed',
          commissioner_approved_by: commissioner_team_id,
          commissioner_approved_at: new Date().toISOString(),
        }).eq('id', trade_id)

        // Sync to Google Sheet
        const sheetDetails = await syncTradeToSheet(supabase, trade_id)

        result = { message: 'Trade approved and completed', sheet_details: sheetDetails }
        break
      }

      case 'vote': {
        if (!team_id || !vote) throw new Error('team_id and vote are required')
        if (!['approve', 'veto'].includes(vote)) throw new Error('vote must be "approve" or "veto"')

        const { data: trade } = await supabase.from('trades').select('*').eq('id', trade_id).single()
        if (!trade) throw new Error('Trade not found')
        if (trade.status !== 'accepted') throw new Error('Trade is not in voting phase')

        // Check if team is involved
        const { data: involved } = await supabase
          .from('trade_teams')
          .select('*')
          .eq('trade_id', trade_id)
          .eq('team_id', team_id)
          .single()

        if (involved) throw new Error('Teams involved in the trade cannot vote')

        // Record vote
        await supabase.from('trade_votes').upsert(
          { trade_id, team_id, vote, voted_at: new Date().toISOString() },
          { onConflict: 'trade_id,team_id' }
        )

        // Update vote counts
        if (vote === 'approve') {
          await supabase.rpc('increment_votes_for', { p_trade_id: trade_id })
        } else {
          await supabase.rpc('increment_votes_against', { p_trade_id: trade_id })
        }

        // Check veto threshold
        const { data: league } = await supabase.from('leagues').select('*').eq('id', trade.league_id).single()
        const { data: involvedTeams } = await supabase.from('trade_teams').select('id').eq('trade_id', trade_id)
        const eligibleVoters = (league?.total_rosters || 12) - (involvedTeams?.length || 2)
        const vetoThreshold = Math.ceil(eligibleVoters * (league?.veto_threshold || 0.5))

        const { data: updatedTrade } = await supabase.from('trades').select('*').eq('id', trade_id).single()

        if (updatedTrade && updatedTrade.votes_against >= vetoThreshold) {
          await supabase.from('trades').update({ status: 'rejected' }).eq('id', trade_id)
        }

        result = {
          votes_for: updatedTrade?.votes_for || 0,
          votes_against: updatedTrade?.votes_against || 0,
          veto_threshold: vetoThreshold,
          eligible_voters: eligibleVoters,
        }
        break
      }

      case 'cancel': {
        const { data: trade } = await supabase.from('trades').select('*').eq('id', trade_id).single()
        if (!trade) throw new Error('Trade not found')
        if (trade.status !== 'pending') throw new Error('Can only cancel pending trades')
        await supabase.from('trades').update({ status: 'cancelled' }).eq('id', trade_id)
        result = { message: 'Trade cancelled' }
        break
      }

      case 'withdraw': {
        if (!team_id) throw new Error('team_id is required')
        const { data: trade } = await supabase.from('trades').select('*').eq('id', trade_id).single()
        if (!trade) throw new Error('Trade not found')
        if (trade.status !== 'pending') throw new Error('Can only withdraw pending trades')
        if (trade.proposer_team_id !== team_id) throw new Error('Only the proposer can withdraw this trade')
        await supabase.from('trades').update({ status: 'cancelled' }).eq('id', trade_id)
        result = { message: 'Trade withdrawn' }
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
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
