import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import cron from 'node-cron';

import { leagueRoutes } from './routes/leagues.js';
import { teamRoutes } from './routes/teams.js';
import { contractRoutes } from './routes/contracts.js';
import { tradeRoutes } from './routes/trades.js';
import { tradeHistoryRoutes } from './routes/tradeHistory.js';
import { playerRoutes } from './routes/players.js';
import { syncRoutes } from './routes/sync.js';
import { importRoutes } from './routes/import.js';
import { errorHandler } from './middleware/errorHandler.js';
import { syncAllLeagueRosters } from './jobs/syncRosters.js';
import { syncPlayerStats } from './services/statsSync.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check (used by Cloud Run and Docker)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Alternative health check path for GCP
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'the586-api', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/leagues', leagueRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/trades', tradeRoutes);
app.use('/api/trade-history', tradeHistoryRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/import', importRoutes);

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🏈 The 586 Dynasty API running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Current Season: ${process.env.CURRENT_SEASON || 2025}`);

  // =============================================
  // CRON JOBS - Background Tasks
  // =============================================

  // Sync rosters every 5 minutes
  // Detects dropped players and applies dead cap automatically
  cron.schedule('*/5 * * * *', async () => {
    console.log('\n🔄 [CRON] Automatic roster sync starting...');
    try {
      await syncAllLeagueRosters();
    } catch (error) {
      console.error('❌ [CRON] Roster sync failed:', error);
    }
  });
  console.log('   ⏰ Roster sync: every 5 minutes');

  // Sync player stats weekly on Tuesdays at 6 AM
  // This runs after Monday Night Football games are complete
  cron.schedule('0 6 * * 2', async () => {
    console.log('\n📊 [CRON] Weekly stats sync starting...');
    try {
      const currentSeason = parseInt(process.env.CURRENT_SEASON || '2025');
      await syncPlayerStats(currentSeason);
    } catch (error) {
      console.error('❌ [CRON] Stats sync failed:', error);
    }
  });
  console.log('   ⏰ Stats sync: Tuesdays at 6 AM');
});

export default app;
