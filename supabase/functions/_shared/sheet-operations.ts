// High-level Google Sheet operations for The 586 Dynasty
// Composes raw read/write functions with sheet mapping constants

import {
  readRange,
  writeRange,
  batchUpdate,
  clearRange,
  findRowByValue,
  findNextEmptyRow,
} from './google-sheets.ts';

import {
  SLEEPER_TO_TAB,
  FULLNAME_TO_TAB,
  TAB_TO_FULLNAME,
  ALL_TABS,
  resolveTabName,
  TEAM_TAB,
  MASTER_ROSTER,
  TRADES_TAB,
} from './sheet-mapping.ts';

// ============================================================
// PLAYER DROP — Remove player from sheet and add dead cap
// ============================================================

export async function sheetRemovePlayer(params: {
  playerName: string;
  ownerName: string;   // Sleeper username or full name
  deadCapByYear: Record<number, number>; // { 2026: 37, 2027: 25, ... }
  reason?: string;     // e.g., "dropped", "released"
}): Promise<{ success: boolean; details: string[] }> {
  const details: string[] = [];
  const tab = resolveTabName(params.ownerName);

  if (!tab) {
    return { success: false, details: [`Could not resolve tab for owner "${params.ownerName}"`] };
  }

  const updates: { range: string; values: (string | number)[][] }[] = [];

  // 1. Find and clear the player row in the team tab
  const playerRow = await findRowByValue(tab, TEAM_TAB.PLAYER_NAME_COL, params.playerName);
  if (playerRow > 0) {
    // Clear columns B through H for this row
    updates.push({
      range: `'${tab}'!B${playerRow}:H${playerRow}`,
      values: [['', '', '', '', '', '', '']],
    });
    details.push(`Cleared ${params.playerName} from ${tab} tab row ${playerRow}`);
  } else {
    details.push(`Warning: ${params.playerName} not found in ${tab} tab column B`);
  }

  // 2. Add dead cap entry to the CAP HITS section
  const deadCapRow = await findNextEmptyRow(
    tab,
    TEAM_TAB.CAP_ADJ_LABEL_COL,
    TEAM_TAB.CAP_HITS_START_ROW,
    TEAM_TAB.CAP_HITS_END_ROW
  );

  if (deadCapRow > 0) {
    const label = params.playerName;
    const yearCols = TEAM_TAB.CAP_ADJ_YEAR_COLS;
    const row: (string | number)[] = [
      label,
      params.deadCapByYear[2026] || '',
      params.deadCapByYear[2027] || '',
      params.deadCapByYear[2028] || '',
      params.deadCapByYear[2029] || '',
      params.deadCapByYear[2030] || '',
    ];
    updates.push({
      range: `'${tab}'!R${deadCapRow}:W${deadCapRow}`,
      values: [row],
    });
    details.push(`Added dead cap entry at ${tab}!R${deadCapRow}`);
  } else {
    details.push(`Warning: No empty row in CAP HITS section for ${tab}`);
  }

  // 3. Update Master Roster — mark as Released
  const masterRow = await findRowByValue(
    MASTER_ROSTER.SHEET_NAME,
    MASTER_ROSTER.PLAYER_COL,
    params.playerName
  );

  if (masterRow > 0) {
    // Clear owner and set status to Released
    updates.push({
      range: `'${MASTER_ROSTER.SHEET_NAME}'!${MASTER_ROSTER.OWNER_COL}${masterRow}:${MASTER_ROSTER.STATUS_COL}${masterRow}`,
      values: [['', 'Released']],
    });
    details.push(`Updated Master Roster row ${masterRow}: status=Released`);
  } else {
    details.push(`Warning: ${params.playerName} not found in Master Roster`);
  }

  // Execute all updates in one batch
  if (updates.length > 0) {
    await batchUpdate(updates);
  }

  return { success: true, details };
}

// ============================================================
// PLAYER ADD — Add player to a team tab and Master Roster
// ============================================================

export async function sheetAddPlayer(params: {
  playerName: string;
  ownerName: string;
  position: string;
  contractType?: string; // 'RK', 'TAG', ''
  salaryByYear: Record<number, number>; // { 2026: 50, 2027: 50, ... }
  rosterStatus?: string; // 'Active', 'IR'
}): Promise<{ success: boolean; details: string[] }> {
  const details: string[] = [];
  const tab = resolveTabName(params.ownerName);

  if (!tab) {
    return { success: false, details: [`Could not resolve tab for owner "${params.ownerName}"`] };
  }

  const updates: { range: string; values: (string | number)[][] }[] = [];

  // 1. Find empty slot in team tab roster
  const emptyRow = await findNextEmptyRow(
    tab,
    TEAM_TAB.PLAYER_NAME_COL,
    TEAM_TAB.ROSTER_START_ROW,
    TEAM_TAB.ROSTER_END_ROW
  );

  if (emptyRow > 0) {
    const row: (string | number)[] = [
      params.playerName,
      params.salaryByYear[2026] || '',
      params.salaryByYear[2027] || '',
      params.salaryByYear[2028] || '',
      params.salaryByYear[2029] || '',
      params.salaryByYear[2030] || '',
      params.contractType || '',
    ];
    updates.push({
      range: `'${tab}'!B${emptyRow}:H${emptyRow}`,
      values: [row],
    });
    details.push(`Added ${params.playerName} to ${tab} tab row ${emptyRow}`);
  } else {
    details.push(`Warning: No empty roster slot in ${tab} tab`);
  }

  // 2. Update Master Roster
  const masterRow = await findRowByValue(
    MASTER_ROSTER.SHEET_NAME,
    MASTER_ROSTER.PLAYER_COL,
    params.playerName
  );

  const fullName = TAB_TO_FULLNAME[tab] || params.ownerName;

  if (masterRow > 0) {
    // Update existing row
    updates.push({
      range: `'${MASTER_ROSTER.SHEET_NAME}'!${MASTER_ROSTER.OWNER_COL}${masterRow}:${MASTER_ROSTER.STATUS_COL}${masterRow}`,
      values: [[fullName, params.rosterStatus || 'Active']],
    });
    details.push(`Updated Master Roster row ${masterRow}: owner=${fullName}`);
  } else {
    details.push(`Warning: ${params.playerName} not found in Master Roster to update`);
  }

  if (updates.length > 0) {
    await batchUpdate(updates);
  }

  return { success: true, details };
}

// ============================================================
// TRADE — Move players, update Master Roster, add to Trades tab
// ============================================================

interface TradeAsset {
  type: 'player' | 'pick' | 'cap';
  name?: string;
  salary?: number;
  yearsLeft?: number;
  capAmount?: number;
  capYear?: number;
  pickYear?: number;
  pickRound?: number;
  position?: string;
  contractType?: string;
  salaryByYear?: Record<number, number>;
}

export async function sheetExecuteTrade(params: {
  tradeNumber: string;        // e.g., "26.03"
  team1OwnerName: string;     // Owner name or sleeper username
  team2OwnerName: string;
  team1Received: TradeAsset[];
  team2Received: TradeAsset[];
  capAdjustments?: {
    teamOwnerName: string;
    label: string;
    type: 'hit' | 'credit';
    amountByYear: Record<number, number>;
  }[];
}): Promise<{ success: boolean; details: string[] }> {
  const details: string[] = [];
  const tab1 = resolveTabName(params.team1OwnerName);
  const tab2 = resolveTabName(params.team2OwnerName);

  if (!tab1 || !tab2) {
    return {
      success: false,
      details: [`Could not resolve tabs: team1="${params.team1OwnerName}" -> ${tab1}, team2="${params.team2OwnerName}" -> ${tab2}`],
    };
  }

  // Process player movements
  // Team 1 received = players leaving team 2, going to team 1
  for (const asset of params.team1Received) {
    if (asset.type === 'player' && asset.name) {
      // Remove from team2 tab
      const removeResult = await sheetRemovePlayerFromTab(tab2, asset.name);
      details.push(...removeResult.details);

      // Add to team1 tab
      const addResult = await sheetAddPlayer({
        playerName: asset.name,
        ownerName: tab1,
        position: asset.position || '',
        contractType: asset.contractType,
        salaryByYear: asset.salaryByYear || {},
        rosterStatus: 'Active',
      });
      details.push(...addResult.details);
    }
  }

  // Team 2 received = players leaving team 1, going to team 2
  for (const asset of params.team2Received) {
    if (asset.type === 'player' && asset.name) {
      const removeResult = await sheetRemovePlayerFromTab(tab1, asset.name);
      details.push(...removeResult.details);

      const addResult = await sheetAddPlayer({
        playerName: asset.name,
        ownerName: tab2,
        position: asset.position || '',
        contractType: asset.contractType,
        salaryByYear: asset.salaryByYear || {},
        rosterStatus: 'Active',
      });
      details.push(...addResult.details);
    }
  }

  // Add cap adjustments to team tabs
  if (params.capAdjustments) {
    for (const adj of params.capAdjustments) {
      const adjTab = resolveTabName(adj.teamOwnerName);
      if (!adjTab) continue;

      const section = adj.type === 'hit'
        ? { start: TEAM_TAB.CAP_HITS_START_ROW, end: TEAM_TAB.CAP_HITS_END_ROW }
        : { start: TEAM_TAB.CAP_CREDITS_START_ROW, end: TEAM_TAB.CAP_CREDITS_END_ROW };

      const emptyRow = await findNextEmptyRow(adjTab, TEAM_TAB.CAP_ADJ_LABEL_COL, section.start, section.end);
      if (emptyRow > 0) {
        await writeRange(`'${adjTab}'!R${emptyRow}:W${emptyRow}`, [[
          adj.label,
          adj.amountByYear[2026] || '',
          adj.amountByYear[2027] || '',
          adj.amountByYear[2028] || '',
          adj.amountByYear[2029] || '',
          adj.amountByYear[2030] || '',
        ]]);
        details.push(`Added ${adj.type} to ${adjTab}!R${emptyRow}: ${adj.label}`);
      }
    }
  }

  // Add trade entry to Trades tab
  try {
    await addTradeToTradesTab({
      tradeNumber: params.tradeNumber,
      team1Tab: tab1,
      team2Tab: tab2,
      team1Received: params.team1Received,
      team2Received: params.team2Received,
    });
    details.push(`Added trade ${params.tradeNumber} to Trades tab`);
  } catch (err) {
    details.push(`Warning: Failed to add trade to Trades tab: ${(err as Error).message}`);
  }

  return { success: true, details };
}

// Helper: Remove a player row from a team tab (without dead cap)
async function sheetRemovePlayerFromTab(
  tabName: string,
  playerName: string
): Promise<{ details: string[] }> {
  const details: string[] = [];
  const row = await findRowByValue(tabName, TEAM_TAB.PLAYER_NAME_COL, playerName);
  if (row > 0) {
    await writeRange(`'${tabName}'!B${row}:H${row}`, [['', '', '', '', '', '', '']]);
    details.push(`Removed ${playerName} from ${tabName} tab row ${row}`);
  } else {
    details.push(`Warning: ${playerName} not found in ${tabName} tab`);
  }
  return { details };
}

// Helper: Add a trade to the Trades tab
async function addTradeToTradesTab(params: {
  tradeNumber: string;
  team1Tab: string;
  team2Tab: string;
  team1Received: TradeAsset[];
  team2Received: TradeAsset[];
}): Promise<void> {
  // Find next empty row in trades tab
  const emptyRow = await findNextEmptyRow(
    TRADES_TAB.SHEET_NAME,
    TRADES_TAB.TRADE_NUM_COL,
    TRADES_TAB.CURRENT_YEAR_START_ROW,
    50 // Check up to row 50
  );

  if (emptyRow < 0) return;

  // Format the trade rows - each asset gets a row, first row has trade# and team names
  const maxRows = Math.max(params.team1Received.length, params.team2Received.length, 1);
  const rows: (string | number)[][] = [];

  for (let i = 0; i < maxRows; i++) {
    const t1Asset = params.team1Received[i];
    const t2Asset = params.team2Received[i];

    rows.push([
      i === 0 ? params.tradeNumber : '',    // Trade #
      i === 0 ? params.team1Tab : '',        // Team 1
      t2Asset ? formatAssetName(t2Asset) : (i === 0 && params.team2Received.length === 0 ? 'Nothing' : ''),
      t2Asset?.salary || '',                  // Salary
      t2Asset?.yearsLeft || '',               // Yrs Left
      '',                                     // Gap column
      i === 0 ? params.team2Tab : '',        // Team 2
      t1Asset ? formatAssetName(t1Asset) : (i === 0 && params.team1Received.length === 0 ? 'Nothing' : ''),
      t1Asset?.salary || '',                  // Salary
      t1Asset?.yearsLeft || '',               // Yrs Left
    ]);
  }

  await writeRange(
    `'${TRADES_TAB.SHEET_NAME}'!B${emptyRow}:K${emptyRow + maxRows - 1}`,
    rows
  );
}

function formatAssetName(asset: TradeAsset): string {
  if (asset.type === 'player') return asset.name || '';
  if (asset.type === 'pick') return `${asset.pickYear} ${ordinal(asset.pickRound || 1)}`;
  if (asset.type === 'cap') return `$${asset.capAmount} cap ${asset.capYear}`;
  return '';
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ============================================================
// FULL RECONCILIATION — Rebuild entire sheet from DB state
// ============================================================

interface ContractData {
  playerName: string;
  position: string;
  contractType: string; // 'standard', 'rookie', 'tag'
  salary: number;
  salaryByYear: Record<number, number>;
  rosterStatus: string;
  ownerName: string;
}

interface CapAdjData {
  description: string;
  adjustmentType: string;
  amountByYear: Record<number, number>;
}

export async function sheetFullReconciliation(
  teamData: {
    tabName: string;
    fullName: string;
    contracts: ContractData[];
    capAdjustments: CapAdjData[];
  }[]
): Promise<{ success: boolean; details: string[] }> {
  const details: string[] = [];
  const updates: { range: string; values: (string | number)[][] }[] = [];

  // Master Roster: collect all players across all teams
  const masterRosterRows: (string | number)[][] = [];

  for (const team of teamData) {
    const tab = team.tabName;

    // 1. Clear existing roster area
    const clearRows: (string | number)[][] = [];
    for (let r = TEAM_TAB.ROSTER_START_ROW; r <= TEAM_TAB.ROSTER_END_ROW; r++) {
      clearRows.push(['', '', '', '', '', '', '']);
    }
    updates.push({
      range: `'${tab}'!B${TEAM_TAB.ROSTER_START_ROW}:H${TEAM_TAB.ROSTER_END_ROW}`,
      values: clearRows,
    });

    // 2. Write contracts to roster
    const rosterRows: (string | number)[][] = [];

    // Group by position: QB, RB, WR, TE
    const posOrder = ['QB', 'RB', 'WR', 'TE'];
    const sorted = [...team.contracts].sort((a, b) => {
      const posA = posOrder.indexOf(a.position);
      const posB = posOrder.indexOf(b.position);
      if (posA !== posB) return posA - posB;
      return b.salary - a.salary;
    });

    for (const contract of sorted) {
      const conType = contract.contractType === 'rookie' ? 'RK'
        : contract.contractType === 'tag' ? 'TAG'
        : '';

      rosterRows.push([
        contract.playerName,
        contract.salaryByYear[2026] || '',
        contract.salaryByYear[2027] || '',
        contract.salaryByYear[2028] || '',
        contract.salaryByYear[2029] || '',
        contract.salaryByYear[2030] || '',
        conType,
      ]);

      // Add to master roster collection
      masterRosterRows.push([
        contract.playerName,
        conType,
        contract.position,
        contract.salaryByYear[2026] || '',
        contract.salaryByYear[2027] || '',
        contract.salaryByYear[2028] || '',
        contract.salaryByYear[2029] || '',
        contract.salaryByYear[2030] || '',
        team.fullName,
        contract.rosterStatus === 'ir' ? 'IR' : 'Active',
        '', // Validation
      ]);
    }

    if (rosterRows.length > 0) {
      updates.push({
        range: `'${tab}'!B${TEAM_TAB.ROSTER_START_ROW}:H${TEAM_TAB.ROSTER_START_ROW + rosterRows.length - 1}`,
        values: rosterRows,
      });
    }

    // 3. Clear and rewrite cap adjustments
    const capClearRows: (string | number)[][] = [];
    for (let r = TEAM_TAB.CAP_HITS_START_ROW; r <= TEAM_TAB.CAP_CREDITS_END_ROW; r++) {
      capClearRows.push(['', '', '', '', '', '']);
    }
    updates.push({
      range: `'${tab}'!R${TEAM_TAB.CAP_HITS_START_ROW}:W${TEAM_TAB.CAP_CREDITS_END_ROW}`,
      values: capClearRows,
    });

    // Separate hits and credits
    const hits = team.capAdjustments.filter(a =>
      a.adjustmentType === 'player_cut' || a.adjustmentType === 'trade_outgoing' || a.adjustmentType === 'dead_cap'
    );
    const credits = team.capAdjustments.filter(a =>
      a.adjustmentType === 'trade_incoming' || a.adjustmentType === 'cap_credit'
    );

    // Write hits
    if (hits.length > 0) {
      const hitRows = hits.map(h => [
        h.description,
        h.amountByYear[2026] || '',
        h.amountByYear[2027] || '',
        h.amountByYear[2028] || '',
        h.amountByYear[2029] || '',
        h.amountByYear[2030] || '',
      ]);
      updates.push({
        range: `'${tab}'!R${TEAM_TAB.CAP_HITS_START_ROW}:W${TEAM_TAB.CAP_HITS_START_ROW + hitRows.length - 1}`,
        values: hitRows,
      });
    }

    // Write credits
    if (credits.length > 0) {
      const creditRows = credits.map(c => [
        c.description,
        c.amountByYear[2026] || '',
        c.amountByYear[2027] || '',
        c.amountByYear[2028] || '',
        c.amountByYear[2029] || '',
        c.amountByYear[2030] || '',
      ]);
      updates.push({
        range: `'${tab}'!R${TEAM_TAB.CAP_CREDITS_START_ROW}:W${TEAM_TAB.CAP_CREDITS_START_ROW + creditRows.length - 1}`,
        values: creditRows,
      });
    }

    details.push(`Rebuilt ${tab}: ${team.contracts.length} contracts, ${team.capAdjustments.length} adjustments`);
  }

  // 4. Rebuild Master Roster
  if (masterRosterRows.length > 0) {
    // Sort master roster by owner, then position, then name
    const posOrder = ['QB', 'RB', 'WR', 'TE'];
    masterRosterRows.sort((a, b) => {
      const ownerA = String(a[8]);
      const ownerB = String(b[8]);
      if (ownerA !== ownerB) return ownerA.localeCompare(ownerB);
      const posA = posOrder.indexOf(String(a[2]));
      const posB = posOrder.indexOf(String(b[2]));
      if (posA !== posB) return posA - posB;
      return String(a[0]).localeCompare(String(b[0]));
    });

    // Clear existing master roster data area
    const clearMasterRows: (string | number)[][] = [];
    for (let r = 0; r < 300; r++) {
      clearMasterRows.push(['', '', '', '', '', '', '', '', '', '', '']);
    }
    updates.push({
      range: `'${MASTER_ROSTER.SHEET_NAME}'!R${MASTER_ROSTER.DATA_START_ROW}:AB${MASTER_ROSTER.DATA_START_ROW + 299}`,
      values: clearMasterRows,
    });

    // Write new master roster
    updates.push({
      range: `'${MASTER_ROSTER.SHEET_NAME}'!R${MASTER_ROSTER.DATA_START_ROW}:AB${MASTER_ROSTER.DATA_START_ROW + masterRosterRows.length - 1}`,
      values: masterRosterRows,
    });

    details.push(`Rebuilt Master Roster: ${masterRosterRows.length} players`);
  }

  // Execute all updates in batch
  await batchUpdate(updates);

  return { success: true, details };
}
