import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

import { leagueRoutes } from './routes/leagues.js';
import { teamRoutes } from './routes/teams.js';
import { contractRoutes } from './routes/contracts.js';
import { tradeRoutes } from './routes/trades.js';
import { tradeHistoryRoutes } from './routes/tradeHistory.js';
import { playerRoutes } from './routes/players.js';
import { syncRoutes } from './routes/sync.js';
import { importRoutes } from './routes/import.js';
import { errorHandler } from './middleware/errorHandler.js';

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
});

export default app;
