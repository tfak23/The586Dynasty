// Maps between DB entities and Google Sheet cell references
// Spreadsheet: The 586 Dynasty Salary Cap Sheet

// Owner mapping: Sleeper username (DB owner_name) → Sheet tab name
export const SLEEPER_TO_TAB: Record<string, string> = {
  'abhanot11': 'Akshay',
  'brcarnag': 'Brian',
  'CanThePan': 'Dan',
  'DomDuhBomb': 'Dom',
  'Gazarato': 'Jamie',
  'Klucido08': 'Karl',
  'NickDnof': 'Nick',
  'TonyFF': 'Tony',
  'TrevorH42': 'Trevor',
  'miket1326': 'Trudy',
  'bigwily57': 'Willy',
  'zachg1313': 'Zach',
};

// Full name (Master Roster Owner col) → Sheet tab name
export const FULLNAME_TO_TAB: Record<string, string> = {
  'Akshay Bhanot': 'Akshay',
  'Brian Carnaghi': 'Brian',
  'Dan Carnaghi': 'Dan',
  'Dominic Puzzuoli': 'Dom',
  'James Gazarato': 'Jamie',
  'Karl Lucido': 'Karl',
  "Nick D'Onofrio": 'Nick',
  'Tony Fakhouri': 'Tony',
  'Trevor Hurd': 'Trevor',
  'Mike Trudel': 'Trudy',
  'Jimmy Wilson': 'Willy',
  'Zach Gravatas': 'Zach',
};

// Sheet tab name → Full name (for Master Roster writes)
export const TAB_TO_FULLNAME: Record<string, string> = Object.fromEntries(
  Object.entries(FULLNAME_TO_TAB).map(([k, v]) => [v, k])
);

// All tab names in order
export const ALL_TABS = [
  'Akshay', 'Brian', 'Dan', 'Dom', 'Jamie', 'Karl',
  'Nick', 'Tony', 'Trevor', 'Trudy', 'Willy', 'Zach',
];

// Resolve any owner identifier to a tab name
export function resolveTabName(ownerName: string): string | null {
  // Try sleeper username first
  if (SLEEPER_TO_TAB[ownerName]) return SLEEPER_TO_TAB[ownerName];
  // Try full name
  if (FULLNAME_TO_TAB[ownerName]) return FULLNAME_TO_TAB[ownerName];
  // Try tab name directly
  if (ALL_TABS.includes(ownerName)) return ownerName;
  // Try partial match on full name
  const match = Object.entries(FULLNAME_TO_TAB).find(([name]) =>
    name.toLowerCase().includes(ownerName.toLowerCase()) ||
    ownerName.toLowerCase().includes(name.split(' ')[0].toLowerCase())
  );
  return match ? match[1] : null;
}

// ---- Team Tab Layout ----
// Each team tab has the roster in the left section and cap adjustments on the right

export const TEAM_TAB = {
  // Roster section
  ROSTER_START_ROW: 3,      // Row 3 is first player (rows 1-2 are headers)
  ROSTER_END_ROW: 37,       // Max roster rows
  PLAYER_NAME_COL: 'B',     // Player names
  SALARY_COLS: {
    '2026': 'C',
    '2027': 'D',
    '2028': 'E',
    '2029': 'F',
    '2030': 'G',
  },
  CONTRACT_TYPE_COL: 'H',   // RK, TAG, OPT markers

  // Cap adjustments section (right side)
  CAP_HITS_HEADER_ROW: 10,  // "CAP HITS" label row
  CAP_HITS_START_ROW: 11,   // First cap hit entry
  CAP_HITS_END_ROW: 25,     // Last possible cap hit row
  CAP_CREDITS_HEADER_ROW: 26, // "CAP CREDITS" label row
  CAP_CREDITS_START_ROW: 27,  // First cap credit entry
  CAP_CREDITS_END_ROW: 37,    // Last possible cap credit row
  CAP_ADJ_LABEL_COL: 'R',   // Adjustment description
  CAP_ADJ_YEAR_COLS: {
    '2026': 'S',
    '2027': 'T',
    '2028': 'U',
    '2029': 'V',
    '2030': 'W',
  },
};

// ---- Master Roster Layout (columns R-AB) ----
export const MASTER_ROSTER = {
  SHEET_NAME: 'Master Roster',
  DATA_START_ROW: 3,        // Row 3 is first data row (rows 1-2 are headers)
  PLAYER_COL: 'R',          // Column 18
  CON_COL: 'S',             // Contract type: RK, TAG
  POS_COL: 'T',             // Position
  SALARY_COLS: {
    '2026': 'U',
    '2027': 'V',
    '2028': 'W',
    '2029': 'X',
    '2030': 'Y',
  },
  OWNER_COL: 'Z',           // Full owner name
  STATUS_COL: 'AA',         // Active, IR, Released
  VALIDATION_COL: 'AB',
};

// ---- Trades Tab Layout ----
export const TRADES_TAB = {
  SHEET_NAME: 'Trades',
  // Current Year section (left side)
  CURRENT_YEAR_START_ROW: 2,
  TRADE_NUM_COL: 'B',       // Trade number (e.g., "26.01")
  TEAM1_COL: 'C',           // Team 1 name
  TEAM1_RECEIVED_COL: 'D',  // What Team 1 received
  TEAM1_SALARY_COL: 'E',    // Salary of received asset
  TEAM1_YRS_COL: 'F',       // Years left
  // Column G is gap
  TEAM2_COL: 'H',           // Team 2 name
  TEAM2_RECEIVED_COL: 'I',  // What Team 2 received
  TEAM2_SALARY_COL: 'J',    // Salary of received asset
  TEAM2_YRS_COL: 'K',       // Years left
};

// Dead cap percentages by year into contract (matches sync-rosters)
export const DEAD_CAP_PERCENTAGES: Record<number, number[]> = {
  1: [0.50],
  2: [0.50, 0.25],
  3: [0.50, 0.25, 0.10],
  4: [0.75, 0.50, 0.25, 0.10],
  5: [0.75, 0.50, 0.25, 0.10, 0.10],
};

// Calculate dead cap for a player drop
export function calculateDeadCap(
  salary: number,
  yearsTotal: number,
  startSeason: number,
  currentSeason: number
): Record<number, number> {
  const result: Record<number, number> = {};

  if (salary <= 1) {
    result[currentSeason] = salary;
    return result;
  }

  const yearsInto = currentSeason - startSeason;
  const pcts = DEAD_CAP_PERCENTAGES[yearsTotal] || [];
  const pct = pcts[yearsInto] ?? pcts[pcts.length - 1] ?? 0.10;

  result[currentSeason] = Math.round(salary * pct);
  return result;
}
