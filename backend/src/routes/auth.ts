import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';
import { 
  hashPassword, 
  comparePassword, 
  generateResetToken, 
  verifyGoogleToken,
  isValidEmail,
  isValidPassword 
} from '../services/auth.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';
import { SleeperService } from '../services/sleeper.js';

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user with email and password
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, display_name } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters with uppercase, lowercase, and number' 
      });
    }

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, display_name, email_verified)
       VALUES ($1, $2, $3, false)
       RETURNING id, email, display_name, created_at`,
      [email.toLowerCase(), passwordHash, display_name || email.split('@')[0]]
    );

    const user = result.rows[0];

    // Generate JWT token
    const token = generateToken(user.id, user.email, user.display_name);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          created_at: user.created_at,
        },
        token,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Get user
    const result = await pool.query(
      `SELECT id, email, password_hash, display_name, is_active, avatar_url
       FROM users 
       WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is inactive' });
    }

    if (!user.password_hash) {
      return res.status(401).json({ 
        error: 'This account uses Google sign-in. Please login with Google.' 
      });
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login
    await pool.query(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Check if user has linked Sleeper account
    const sleeperResult = await pool.query(
      'SELECT sleeper_username, sleeper_user_id FROM sleeper_accounts WHERE user_id = $1',
      [user.id]
    );

    const hasSleeperAccount = sleeperResult.rows.length > 0;
    const sleeperAccount = hasSleeperAccount ? sleeperResult.rows[0] : null;

    // Generate JWT token
    const token = generateToken(user.id, user.email, user.display_name);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          has_sleeper_account: hasSleeperAccount,
          sleeper_username: sleeperAccount?.sleeper_username,
        },
        token,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/auth/google
 * Login or register with Google OAuth
 */
router.post('/google', async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'Google ID token is required' });
    }

    // Verify Google token
    const googleData = await verifyGoogleToken(idToken);

    if (!googleData) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }

    // Check if user exists with this Google ID
    let result = await pool.query(
      'SELECT id, email, display_name, is_active, avatar_url FROM users WHERE google_id = $1',
      [googleData.googleId]
    );

    let user;

    if (result.rows.length === 0) {
      // Check if email already exists (user might have registered with email/password)
      result = await pool.query(
        'SELECT id, email, display_name, is_active, avatar_url FROM users WHERE email = $1',
        [googleData.email.toLowerCase()]
      );

      if (result.rows.length > 0) {
        // Link Google account to existing user
        await pool.query(
          `UPDATE users 
           SET google_id = $1, google_email = $2, avatar_url = COALESCE(avatar_url, $3), email_verified = true
           WHERE id = $4`,
          [googleData.googleId, googleData.email, googleData.picture, result.rows[0].id]
        );
        user = result.rows[0];
      } else {
        // Create new user
        result = await pool.query(
          `INSERT INTO users (email, google_id, google_email, display_name, avatar_url, email_verified, is_active)
           VALUES ($1, $2, $3, $4, $5, true, true)
           RETURNING id, email, display_name, avatar_url`,
          [
            googleData.email.toLowerCase(),
            googleData.googleId,
            googleData.email,
            googleData.name,
            googleData.picture,
          ]
        );
        user = result.rows[0];
      }
    } else {
      user = result.rows[0];
      
      if (!user.is_active) {
        return res.status(401).json({ error: 'Account is inactive' });
      }
    }

    // Update last login
    await pool.query(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Check if user has linked Sleeper account
    const sleeperResult = await pool.query(
      'SELECT sleeper_username, sleeper_user_id FROM sleeper_accounts WHERE user_id = $1',
      [user.id]
    );

    const hasSleeperAccount = sleeperResult.rows.length > 0;
    const sleeperAccount = hasSleeperAccount ? sleeperResult.rows[0] : null;

    // Generate JWT token
    const token = generateToken(user.id, user.email, user.display_name);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          has_sleeper_account: hasSleeperAccount,
          sleeper_username: sleeperAccount?.sleeper_username,
        },
        token,
      },
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Google authentication failed' });
  }
});

/**
 * POST /api/auth/forgot-password
 * Request password reset
 */
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user exists
    const result = await pool.query(
      'SELECT id, display_name FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    // Don't reveal if email exists or not (security best practice)
    if (result.rows.length === 0) {
      return res.json({ 
        success: true, 
        message: 'If the email exists, a reset link has been sent' 
      });
    }

    const user = result.rows[0];

    // Generate reset token
    const resetToken = generateResetToken();
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    // Save reset token
    await pool.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [resetToken, resetExpires, user.id]
    );

    // TODO: Send email with reset link
    // In production, you would send an email here with:
    // const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    console.log(`Password reset requested for ${email}`);
    console.log(`Reset token: ${resetToken}`);

    res.json({ 
      success: true, 
      message: 'If the email exists, a reset link has been sent',
      // Remove this in production:
      dev_reset_token: process.env.NODE_ENV === 'development' ? resetToken : undefined,
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Password reset request failed' });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (!isValidPassword(newPassword)) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters with uppercase, lowercase, and number' 
      });
    }

    // Find user with valid reset token
    const result = await pool.query(
      `SELECT id FROM users 
       WHERE reset_token = $1 AND reset_token_expires > CURRENT_TIMESTAMP`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const userId = result.rows[0].id;

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update password and clear reset token
    await pool.query(
      `UPDATE users 
       SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL
       WHERE id = $2`,
      [passwordHash, userId]
    );

    res.json({ success: true, message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

/**
 * GET /api/auth/me
 * Get current user info (requires authentication)
 */
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get full user info
    const result = await pool.query(
      `SELECT u.id, u.email, u.display_name, u.avatar_url, u.created_at,
              s.sleeper_username, s.sleeper_user_id
       FROM users u
       LEFT JOIN sleeper_accounts s ON u.id = s.user_id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Get user's leagues
    const leaguesResult = await pool.query(
      `SELECT l.id, l.name, l.sleeper_league_id, ula.is_commissioner, t.team_name
       FROM user_league_associations ula
       JOIN leagues l ON ula.league_id = l.id
       LEFT JOIN teams t ON ula.team_id = t.id
       WHERE ula.user_id = $1 AND ula.status = 'active'
       ORDER BY l.name`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
        has_sleeper_account: !!user.sleeper_username,
        sleeper_username: user.sleeper_username,
        sleeper_user_id: user.sleeper_user_id,
        leagues: leaguesResult.rows,
      },
    });
  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

/**
 * POST /api/auth/link-sleeper
 * Link Sleeper account to user
 */
router.post('/link-sleeper', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Sleeper username is required' });
    }

    // Check if user already has a Sleeper account linked
    const existing = await pool.query(
      'SELECT id FROM sleeper_accounts WHERE user_id = $1',
      [req.user.id]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'User already has a Sleeper account linked' });
    }

    // Verify Sleeper username exists
    let sleeperUser;
    try {
      sleeperUser = await SleeperService.getUserByUsername(username);
    } catch (error) {
      return res.status(404).json({ error: 'Sleeper username not found' });
    }

    // Check if this Sleeper account is already linked to another user
    const sleeperExists = await pool.query(
      'SELECT user_id FROM sleeper_accounts WHERE sleeper_user_id = $1',
      [sleeperUser.user_id]
    );

    if (sleeperExists.rows.length > 0) {
      return res.status(409).json({ 
        error: 'This Sleeper account is already linked to another user' 
      });
    }

    // Link Sleeper account
    await pool.query(
      `INSERT INTO sleeper_accounts (user_id, sleeper_username, sleeper_user_id, sleeper_display_name, sleeper_avatar)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        sleeperUser.username,
        sleeperUser.user_id,
        sleeperUser.display_name,
        sleeperUser.avatar,
      ]
    );

    res.json({
      success: true,
      data: {
        sleeper_username: sleeperUser.username,
        sleeper_user_id: sleeperUser.user_id,
        sleeper_display_name: sleeperUser.display_name,
      },
    });
  } catch (error) {
    console.error('Link Sleeper error:', error);
    res.status(500).json({ error: 'Failed to link Sleeper account' });
  }
});

export const authRoutes = router;
