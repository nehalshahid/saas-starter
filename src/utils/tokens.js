import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export async function hashPassword(plain) {
  // argon2id: resistant to both GPU-cracking and side-channel attacks.
  return argon2.hash(plain, { type: argon2.argon2id });
}

export async function verifyPassword(hash, plain) {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

export function signAccessToken(user) {
  // Access token is short-lived and stateless — no DB hit needed to verify it.
  return jwt.sign(
    { sub: user.id, email: user.email },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_TTL || '15m' }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

// Refresh tokens are opaque random strings, not JWTs — we store only their
// hash in the DB so a leaked database dump can't be replayed as live tokens.
// Rotation: every refresh issues a new token and revokes the old one, so a
// stolen-but-unused token becomes useless the moment the real owner refreshes.
export function generateRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateOpaqueToken() {
  // for email verification / password reset links
  return crypto.randomBytes(32).toString('hex');
}
