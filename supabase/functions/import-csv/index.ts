// Supabase Edge Function for CSV Import
// Parses CSV contract data and creates contracts in the database

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3"
import { parse } from "https://deno.land/std@0.224.0/csv/parse.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CURRENT_SEASON = 2026

const OWNER_NAME_MAP: Record<string, string> = {
  'Brian': 'brcarnag', 'Mike': 'miket1326', 'Dom': 'DomDuhBomb',
  'Willie': 'bigwily57', 'Tony': 'TonyFF', 'Garett': 'Gazarato',
  'Cang': 'CanThePan', 'Trevor': 'TrevorH42', 'Abhi': 'abhanot11',
  'Nick': 'NickDnof', 'Zach': 'zachg1313', 'Kyle': 'Klucido08',
}

function parseCSVRow(row: Record<string, string>) {
  if (!row.Player || !row.Owner) return null

  let playerName = row.Player
  const isRookie = playerName.includes(',RK,')
  const isFranchiseTagged = playerName.includes(',TAG,')
  playerName = playerName.replace(',RK,', ' ').replace(',TAG,', ' ').replace(/\s+/g, ' ').trim()

  const yearColumns = ['2026', '2027', '2028', '2029', '2030']
  const yearValues = yearColumns.map(y => {
    const val = row[y]?.toString().trim()
    if (!val || val === '') return null
    if (val === 'OPT') return 'OPT'
    const num = parseFloat(val.replace('$', ''))
    return isNaN(num) ? null : num
  })

  const optionIndex = yearValues.findIndex(v => v === 'OPT')
  const hasOption = optionIndex !== -1
  const optionYear = hasOption ? 2026 + optionIndex : null
  const activeYears = yearValues.filter(v => v !== null && v !== 'OPT').length

  let endSeason = CURRENT_SEASON
  for (let i = yearColumns.length - 1; i >= 0; i--) {
    if (yearValues[i] !== null && yearValues[i] !== 'OPT') { endSeason = 2026 + i; break }
  }

  const salaryStr = row.CON?.toString().trim()
  const salary = salaryStr ? parseFloat(salaryStr.replace('$', '')) : null

  return {
    playerName, position: row.POS?.trim() || '', owner: row.Owner?.trim() || '',
    salary: isNaN(salary as number) ? null : salary,
    yearsRemaining: activeYears, endSeason, hasOption, optionYear,
    isRookie, isFranchiseTagged,
    rosterStatus: row['Roster Status']?.toLowerCase() === 'ir' ? 'ir' : 'active',
    contractStatus: salary !== null && salary > 0 ? 'active' : 'expired',
    yearValues,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { league_id, csvData, dryRun = false } = await req.json()
    if (!league_id || !csvData) throw new Error('league_id and csvData are required')

    const { data: league } = await supabase.from('leagues').select('*').eq('id', league_id).single()
    if (!league) throw new Error('League not found')

    const result = { playersImported: 0, contractsCreated: 0, expiredContracts: 0, errors: [] as string[], warnings: [] as string[] }

    // Parse CSV using Deno std
    const records = parse(csvData, { skipFirstRow: true, columns: undefined }) as Record<string, string>[]

    for (let i = 0; i < records.length; i++) {
      const rowNum = i + 2
      try {
        const parsed = parseCSVRow(records[i])
        if (!parsed) continue

        // Find player
        const { data: player } = await supabase
          .from('players')
          .select('*')
          .ilike('search_full_name', parsed.playerName.toLowerCase())
          .eq('position', parsed.position)
          .single()

        if (!player) {
          // Try last name match
          const lastName = parsed.playerName.split(' ').pop()?.toLowerCase()
          const { data: fuzzyPlayer } = await supabase
            .from('players')
            .select('*')
            .eq('search_last_name', lastName || '')
            .eq('position', parsed.position)
            .single()

          if (!fuzzyPlayer) {
            result.warnings.push(`Row ${rowNum}: Could not match player "${parsed.playerName}" (${parsed.position})`)
            continue
          }
        }

        const matchedPlayer = player

        // Find team
        const mappedName = OWNER_NAME_MAP[parsed.owner]
        let team: any = null
        if (mappedName) {
          const { data: t } = await supabase.from('teams').select('*')
            .eq('league_id', league_id).ilike('owner_name', mappedName).single()
          team = t
        }
        if (!team) {
          const { data: t } = await supabase.from('teams').select('*')
            .eq('league_id', league_id).ilike('owner_name', `%${parsed.owner}%`).single()
          team = t
        }
        if (!team) {
          result.warnings.push(`Row ${rowNum}: Could not match owner "${parsed.owner}"`)
          continue
        }

        if (!dryRun && matchedPlayer) {
          if (parsed.contractStatus === 'active' && parsed.salary !== null) {
            const yearsTotal = parsed.yearsRemaining > 0 ? parsed.yearsRemaining : 1
            const startSeason = parsed.endSeason - yearsTotal + 1

            await supabase.from('contracts').insert({
              league_id, team_id: team.id, player_id: matchedPlayer.id,
              salary: parsed.salary, years_total: yearsTotal, years_remaining: parsed.yearsRemaining,
              start_season: startSeason, end_season: parsed.endSeason,
              contract_type: parsed.isRookie ? 'rookie' : (parsed.isFranchiseTagged ? 'tag' : 'standard'),
              has_option: parsed.hasOption, option_year: parsed.optionYear,
              is_franchise_tagged: parsed.isFranchiseTagged, roster_status: parsed.rosterStatus,
              acquisition_type: 'import', acquisition_date: new Date().toISOString().split('T')[0],
              acquisition_details: { source: 'csv_import', yearValues: parsed.yearValues },
              status: 'active',
            })
            result.contractsCreated++
          } else {
            await supabase.from('expired_contracts').upsert({
              league_id, team_id: team.id, player_id: matchedPlayer.id,
              roster_status: parsed.rosterStatus, season: CURRENT_SEASON,
              eligible_for_franchise_tag: true,
            }, { onConflict: 'league_id,player_id,season' })
            result.expiredContracts++
          }
        }

        result.playersImported++
      } catch (error) {
        result.errors.push(`Row ${rowNum}: ${error.message}`)
      }
    }

    return new Response(
      JSON.stringify({
        status: 'success',
        data: { ...result, dryRun, message: dryRun ? 'Dry run completed.' : 'Import completed.' },
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
