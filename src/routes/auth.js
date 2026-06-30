import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../db.js';
import {
  hashPassword, verifyPassword, signAccessToken,
  generateRefreshToken, hashToken, generateOpaqueToken
} from '../utils/tokens.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);

async function issueRefreshToken(userId) {
  const raw = generateRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 86400 * 1000);
  await query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, hashToken(raw), expiresAt]
  );
  return raw;
}

// --- Register ---------------------------------------------------------
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password } = parsed.data;

  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows[0]) {
    // Same response shape as success to avoid leaking which emails are registered.
    return res.status(202).json({ message: 'If that email is available, check your inbox to verify.' });
  }

  const passwordHash = await hashPassword(password);
  const { rows } = await query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
    [email, passwordHash]
  );
  const user = rows[0];

  const verifyToken = generateOpaqueToken();
  await query(
    'INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES ($1, $2, now() + interval \'24 hours\')',
    [user.id, verifyToken]
  );

  // TODO: send email via nodemailer/SES with link: `${APP_URL}/verify?token=${verifyToken}`
  console.log(`[dev] verification link: ${process.env.APP_URL}/verify?token=${verifyToken}`);

  res.status(201).json({ message: 'Account created. Check your email to verify.' });
});

router.post('/verify-email', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Missing token' });

  const { rows } = await query(
    `SELECT user_id FROM email_verification_tokens
     WHERE token = $1 AND used_at IS NULL AND expires_at > now()`,
    [token]
  );
  if (!rows[0]) return res.status(400).json({ error: 'Invalid or expired token' });

  await withTransaction(async (client) => {
    await client.query('UPDATE users SET email_verified = true WHERE id = $1', [rows[0].user_id]);
    await client.query('UPDATE email_verification_tokens SET used_at = now() WHERE token = $1', [token]);
  });

  res.json({ message: 'Email verified.' });
});

// --- Login --------------------------------------------------------------
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });

  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];

  // Constant-shape failure: don't reveal whether the email exists.
  if (!user || !(await verifyPassword(user.password_hash, password))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id);

  res.json({
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, emailVerified: user.email_verified },
  });
});

// --- Refresh (rotation) --------------------------------------------------
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Missing refresh token' });

  const tokenHash = hashToken(refreshToken);
  const { rows } = await query(
    `SELECT * FROM refresh_tokens
     WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()`,
    [tokenHash]
  );
  const stored = rows[0];
  if (!stored) return res.status(401).json({ error: 'Invalid or expired refresh token' });

  // Rotate: revoke the old token, issue a fresh one. If a revoked token is
  // ever presented again, that's a signal of token theft/replay — in a
  // production system you'd revoke the whole token family here.
  await query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [stored.id]);

  const { rows: userRows } = await query('SELECT * FROM users WHERE id = $1', [stored.user_id]);
  const user = userRows[0];
  if (!user) return res.status(401).json({ error: 'User not found' });

  const newRefreshToken = await issueRefreshToken(user.id);
  const accessToken = signAccessToken(user);

  res.json({ accessToken, refreshToken: newRefreshToken });
});

router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1', [hashToken(refreshToken)]);
  }
  res.json({ message: 'Logged out' });
});

// --- Password reset -------------------------------------------------------
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const { rows } = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (rows[0]) {
    const token = generateOpaqueToken();
    await query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, now() + interval \'1 hour\')',
      [rows[0].id, token]
    );
    console.log(`[dev] reset link: ${process.env.APP_URL}/reset-password?token=${token}`);
  }
  // Always return 202 regardless of whether the email exists.
  res.status(202).json({ message: 'If that email exists, a reset link has been sent.' });
});

router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const { rows } = await query(
    `SELECT user_id FROM password_reset_tokens
     WHERE token = $1 AND used_at IS NULL AND expires_at > now()`,
    [token]
  );
  if (!rows[0]) return res.status(400).json({ error: 'Invalid or expired token' });

  const newHash = await hashPassword(newPassword);
  await withTransaction(async (client) => {
    await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, rows[0].user_id]);
    await client.query('UPDATE password_reset_tokens SET used_at = now() WHERE token = $1', [token]);
    // Defensive: invalidate all existing sessions on password change.
    await client.query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [rows[0].user_id]);
  });

  res.json({ message: 'Password updated. Please log in again.' });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
