import { Pool } from 'pg';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Owner name mapping to team names
const OWNER_TO_TEAM: Record<string, string> = {
  'Akshay': 'Lamborghini Love',
  'Tony': 'The Great Replacement',
  'Dan': 'Danny Dimes Era',
  'Dom': 'Teta tots',
  'Nick': 'Trust the Process',
  'Brian': 'Davante\'s Inferno',
  'Trudy': 'Bed, Bath & Bijan',
  'Jamie': 'J Jet2Holiday',
  'Trevor': 'Mazda Marv',
  'Willy': 'Healthcare Hero ',
  'Mike': 'CeeDeeC guidelines',
  'Elliot': 'Jeanty juice🧃',
  'Vinny': 'Jeanty juice🧃', // Vinny may have been previous owner
  'Zach': 'Jeanty juice🧃',  // Current owner
  'Karl': 'CeeDeeC guidelines', // Karl may be associated with Mike's team
};

interface TradeItem {
  type: 'player' | 'pick' | 'cap';
  name?: string;
  salary?: number;
  yearsLeft?: number;
  capAmount?: number;
  capYear?: number;
  pickYear?: number;
  pickRound?: number;
  originalOwner?: string;
}

interface ParsedTrade {
  tradeNumber: string;
  tradeYear: number;
  team1Name: string;
  team1Received: TradeItem[];
  team2Name: string;
  team2Received: TradeItem[];
}

function parseReceivedItems(items: string[], salaries: string[], years: string[]): TradeItem[] {
  const result: TradeItem[] = [];
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i]?.trim();
    if (!item) continue;
    
    const salary = salaries[i]?.trim();
    const yearsLeft = years[i]?.trim();
    
    // Check if it's a cap hit
    if (item.match(/^\$\d+\s*cap\s*\d{4}/i)) {
      const capMatch = item.match(/^\$(\d+)\s*cap\s*(\d{4})/i);
      if (capMatch) {
        result.push({
          type: 'cap',
          capAmount: parseInt(capMatch[1]),
          capYear: parseInt(capMatch[2]),
        });
      }
      continue;
    }
    
    // Check if it's a draft pick
    if (item.match(/\d{4}\s*(1st|2nd|3rd|4th|5th)/i) || item.match(/(1st|2nd|3rd|4th|5th)\s*\(/i)) {
      const pickMatch = item.match(/(\d{4})?\s*(1st|2nd|3rd|4th|5th)(?:\s*\(([^)]+)\))?/i);
      if (pickMatch) {
        const roundMap: Record<string, number> = { '1st': 1, '2nd': 2, '3rd': 3, '4th': 4, '5th': 5 };
        result.push({
          type: 'pick',
          pickYear: pickMatch[1] ? parseInt(pickMatch[1]) : undefined,
          pickRound: roundMap[pickMatch[2].toLowerCase()] || roundMap[pickMatch[2]],
          originalOwner: pickMatch[3]?.trim(),
          name: item,
        });
      }
      continue;
    }
    
    // It's a player
    if (item !== 'Nothing' && item.length > 0) {
      result.push({
        type: 'player',
        name: item,
        salary: salary ? parseFloat(salary) : undefined,
        yearsLeft: yearsLeft ? parseInt(yearsLeft) : undefined,
      });
    }
  }
  
  return result;
}

async function importTrades() {
  try {
    // Read CSV file
    const csvPath = path.join(__dirname, '../../', 'The 586 Dynasty - Trades.csv');
    
    // Try different paths
    let csvContent: string;
    const possiblePaths = [
      csvPath,
      'C:\\Users\\tfak2\\Downloads\\The 586 Dynasty - Trades.csv',
      path.join(__dirname, 'The 586 Dynasty - Trades.csv'),
    ];
    
    for (const p of possiblePaths) {
      try {
        csvContent = fs.readFileSync(p, 'utf-8');
        console.log('Found CSV at:', p);
        break;
      } catch {
        continue;
      }
    }
    
    if (!csvContent!) {
      console.error('Could not find trades CSV file');
      return;
    }
    
    // Get league ID
    const leagueResult = await pool.query(`SELECT id FROM leagues WHERE name = 'The 586'`);
    const leagueId = leagueResult.rows[0]?.id;
    if (!leagueId) {
      console.error('Could not find league');
      return;
    }
    
    // Get team IDs
    const teamsResult = await pool.query(`SELECT id, team_name FROM teams WHERE league_id = $1`, [leagueId]);
    const teamNameToId: Record<string, string> = {};
    teamsResult.rows.forEach(t => {
      teamNameToId[t.team_name] = t.id;
    });
    
    // Parse CSV
    const lines = csvContent.split('\n');
    const trades: ParsedTrade[] = [];
    
    let currentYear: number | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const cols = line.split(',').map(c => c.trim());
      
      // Check for "Current Year" or "Past Years" section headers
      if (cols[1] === 'Current Year') {
        currentYear = 2026;
        continue;
      }
      if (cols[16] === 'Past Years') {
        // Past years trades are in different columns
        continue;
      }
      
      // Parse current year trades (columns 1-10)
      const tradeNum = cols[1];
      if (tradeNum && tradeNum.match(/^\d+\.\d+$/)) {
        const yearPrefix = parseInt(tradeNum.split('.')[0]);
        const tradeYear = 2000 + yearPrefix;
        
        const team1 = cols[2];
        const team1Received: string[] = [];
        const team1Salaries: string[] = [];
        const team1Years: string[] = [];
        
        // Collect team 1 received items (can span multiple rows)
        if (cols[3]) team1Received.push(cols[3]);
        if (cols[4]) team1Salaries.push(cols[4]);
        if (cols[5]) team1Years.push(cols[5]);
        
        const team2 = cols[7];
        const team2Received: string[] = [];
        const team2Salaries: string[] = [];
        const team2Years: string[] = [];
        
        if (cols[8]) team2Received.push(cols[8]);
        if (cols[9]) team2Salaries.push(cols[9]);
        if (cols[10]) team2Years.push(cols[10]);
        
        // Look ahead for additional items in subsequent rows
        let j = i + 1;
        while (j < lines.length) {
          const nextLine = lines[j];
          const nextCols = nextLine.split(',').map(c => c.trim());
          
          // If next row has a trade number or is empty, stop
          if (nextCols[1] && nextCols[1].match(/^\d+\.\d+$/)) break;
          if (!nextCols[3] && !nextCols[8]) break;
          
          if (nextCols[3]) team1Received.push(nextCols[3]);
          if (nextCols[4]) team1Salaries.push(nextCols[4]);
          if (nextCols[5]) team1Years.push(nextCols[5]);
          
          if (nextCols[8]) team2Received.push(nextCols[8]);
          if (nextCols[9]) team2Salaries.push(nextCols[9]);
          if (nextCols[10]) team2Years.push(nextCols[10]);
          
          j++;
        }
        
        if (team1 && team2) {
          trades.push({
            tradeNumber: tradeNum,
            tradeYear,
            team1Name: team1,
            team1Received: parseReceivedItems(team1Received, team1Salaries, team1Years),
            team2Name: team2,
            team2Received: parseReceivedItems(team2Received, team2Salaries, team2Years),
          });
        }
      }
      
      // Parse past year trades (columns 16-26)
      const pastTradeNum = cols[16];
      if (pastTradeNum && pastTradeNum.match(/^\d+\.\d+$/)) {
        const yearPrefix = parseInt(pastTradeNum.split('.')[0]);
        const tradeYear = 2000 + yearPrefix;
        
        const team1 = cols[17];
        const team1Received: string[] = [];
        const team1Salaries: string[] = [];
        const team1Years: string[] = [];
        
        if (cols[18]) team1Received.push(cols[18]);
        if (cols[19]) team1Salaries.push(cols[19]);
        if (cols[20]) team1Years.push(cols[20]);
        
        const team2 = cols[22];
        const team2Received: string[] = [];
        const team2Salaries: string[] = [];
        const team2Years: string[] = [];
        
        if (cols[23]) team2Received.push(cols[23]);
        if (cols[24]) team2Salaries.push(cols[24]);
        if (cols[25]) team2Years.push(cols[25]);
        
        // Look ahead for additional items in subsequent rows
        let j = i + 1;
        while (j < lines.length) {
          const nextLine = lines[j];
          const nextCols = nextLine.split(',').map(c => c.trim());
          
          // If next row has a trade number, stop
          if (nextCols[16] && nextCols[16].match(/^\d+\.\d+$/)) break;
          if (!nextCols[18] && !nextCols[23]) break;
          
          if (nextCols[18]) team1Received.push(nextCols[18]);
          if (nextCols[19]) team1Salaries.push(nextCols[19]);
          if (nextCols[20]) team1Years.push(nextCols[20]);
          
          if (nextCols[23]) team2Received.push(nextCols[23]);
          if (nextCols[24]) team2Salaries.push(nextCols[24]);
          if (nextCols[25]) team2Years.push(nextCols[25]);
          
          j++;
        }
        
        if (team1 && team2) {
          trades.push({
            tradeNumber: pastTradeNum,
            tradeYear,
            team1Name: team1,
            team1Received: parseReceivedItems(team1Received, team1Salaries, team1Years),
            team2Name: team2,
            team2Received: parseReceivedItems(team2Received, team2Salaries, team2Years),
          });
        }
      }
    }
    
    console.log(`Parsed ${trades.length} trades`);
    
    // Clear existing trades for this league
    await pool.query(`DELETE FROM trade_history WHERE league_id = $1`, [leagueId]);
    
    // Insert trades
    let inserted = 0;
    for (const trade of trades) {
      const team1Id = teamNameToId[OWNER_TO_TEAM[trade.team1Name]] || null;
      const team2Id = teamNameToId[OWNER_TO_TEAM[trade.team2Name]] || null;
      
      await pool.query(`
        INSERT INTO trade_history (
          league_id, trade_number, trade_year,
          team1_id, team1_name, team1_received,
          team2_id, team2_name, team2_received
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        leagueId,
        trade.tradeNumber,
        trade.tradeYear,
        team1Id,
        trade.team1Name,
        JSON.stringify(trade.team1Received),
        team2Id,
        trade.team2Name,
        JSON.stringify(trade.team2Received),
      ]);
      inserted++;
    }
    
    console.log(`✅ Inserted ${inserted} trades`);
    
    // Show summary by year
    const summaryResult = await pool.query(`
      SELECT trade_year, COUNT(*) as count 
      FROM trade_history 
      WHERE league_id = $1 
      GROUP BY trade_year 
      ORDER BY trade_year
    `, [leagueId]);
    
    console.log('\nTrades by year:');
    summaryResult.rows.forEach(r => {
      console.log(`  ${r.trade_year}: ${r.count} trades`);
    });
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

importTrades();
