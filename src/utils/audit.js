import { query } from '../db.js';

/**
 * Record a sensitive action. Call this from inside the same logical
 * operation (ideally same DB transaction) as the action it's logging,
 * so the audit trail can't silently drift from reality.
 *
 * action: dot-namespaced string, e.g. 'member.role_changed', 'billing.subscription_updated'
 * target: string identifying the affected resource, e.g. `user:${userId}`
 */
export async function recordAudit({ orgId, actorId = null, action, target = null, metadata = {} }) {
  await query(
    `INSERT INTO audit_logs (org_id, actor_id, action, target, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [orgId, actorId, action, target, JSON.stringify(metadata)]
  );
}
