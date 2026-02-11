import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { pool } from '../db/index.js';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        display_name: string;
      };
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

export interface JWTPayload {
  userId: string;
  email: string;
  display_name: string;
}

/**
 * Middleware to verify JWT token and attach user to request
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    // Verify user still exists and is active
    const result = await pool.query(
      'SELECT id, email, display_name, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ error: 'User account is inactive' });
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(403).json({ error: 'Token expired' });
    }
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * Optional authentication - attaches user if token is valid, but doesn't require it
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    const result = await pool.query(
      'SELECT id, email, display_name, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length > 0 && result.rows[0].is_active) {
      req.user = {
        id: result.rows[0].id,
        email: result.rows[0].email,
        display_name: result.rows[0].display_name,
      };
    }

    next();
  } catch (error) {
    // Ignore errors for optional auth
    next();
  }
};

/**
 * Generate JWT token for a user
 */
export const generateToken = (userId: string, email: string, display_name: string): string => {
  const payload: JWTPayload = {
    userId,
    email,
    display_name,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '30d', // Token expires in 30 days
  });
};

/**
 * Verify if user has access to a specific league
 */
export const verifyLeagueAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const leagueId = req.params.leagueId || req.params.id;

    if (!leagueId) {
      return res.status(400).json({ error: 'League ID required' });
    }

    // Check if user has access to this league
    const result = await pool.query(
      `SELECT id FROM user_league_associations 
       WHERE user_id = $1 AND league_id = $2 AND status = 'active'`,
      [req.user.id, leagueId]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied to this league' });
    }

    next();
  } catch (error) {
    console.error('League access verification error:', error);
    return res.status(500).json({ error: 'Access verification failed' });
  }
};

/**
 * Verify if user is a commissioner of a specific league
 */
export const verifyCommissioner = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const leagueId = req.params.leagueId || req.params.id;

    if (!leagueId) {
      return res.status(400).json({ error: 'League ID required' });
    }

    // Check if user is a commissioner of this league
    const result = await pool.query(
      `SELECT id FROM user_league_associations 
       WHERE user_id = $1 AND league_id = $2 AND is_commissioner = true AND status = 'active'`,
      [req.user.id, leagueId]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Commissioner access required' });
    }

    next();
  } catch (error) {
    console.error('Commissioner verification error:', error);
    return res.status(500).json({ error: 'Access verification failed' });
  }
};
