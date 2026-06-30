import { verifyAccessToken } from '../utils/tokens.js';
import { query } from '../db.js';

/**
 * Verifies the access token and attaches req.user.
 * Does NOT check org membership or role — that's requireOrgRole's job.
 * Keeping these separate means routes that don't need an org (e.g. /me,
 * /orgs - list mine) aren't forced through org-scoping logic.
 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing access token' });

  try {
    const payload = verifyAccessToken(token);
    const { rows } = await query(
      'SELECT id, email, email_verified FROM users WHERE id = $1',
      [payload.sub]
    );
    if (!rows[0]) return res.status(401).json({ error: 'User not found' });
    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
