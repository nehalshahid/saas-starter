import { Router } from 'express';
import crypto from 'crypto';
import { query, withTransaction } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOrgRole } from '../middleware/rbac.js';
import { recordAudit } from '../utils/audit.js';

const router = Router();
router.use(requireAuth);

function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    + '-' + crypto.randomBytes(3).toString('hex');
}

// List orgs the current user belongs to.
router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT o.id, o.name, o.slug, m.role
     FROM organizations o
     JOIN memberships m ON m.org_id = o.id
     WHERE m.user_id = $1
     ORDER BY o.created_at`,
    [req.user.id]
  );
  res.json({ organizations: rows });
});

// Create an org. Creator becomes owner.
router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const org = await withTransaction(async (client) => {
    const { rows } = await client.query(
      'INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id, name, slug',
      [name, slugify(name)]
    );
    const org = rows[0];
    await client.query(
      'INSERT INTO memberships (user_id, org_id, role) VALUES ($1, $2, $3)',
      [req.user.id, org.id, 'owner']
    );
    await client.query(
      'INSERT INTO subscriptions (org_id, plan, status) VALUES ($1, $2, $3)',
      [org.id, 'free', 'active']
    );
    return org;
  });

  await recordAudit({ orgId: org.id, actorId: req.user.id, action: 'org.created', target: org.id });
  res.status(201).json({ organization: org });
});

// --- Everything below this line is org-scoped and goes through RBAC ----

// Get org details (any member).
router.get('/:orgId', requireOrgRole('member'), async (req, res) => {
  const { rows } = await query('SELECT id, name, slug, created_at FROM organizations WHERE id = $1', [req.params.orgId]);
  if (!rows[0]) return res.status(404).json({ error: 'Org not found' });
  res.json({ organization: rows[0] });
});

// List members (any member can see the roster).
router.get('/:orgId/members', requireOrgRole('member'), async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.email, m.role, m.created_at
     FROM memberships m JOIN users u ON u.id = m.user_id
     WHERE m.org_id = $1 ORDER BY m.created_at`,
    [req.params.orgId]
  );
  res.json({ members: rows });
});

// Change a member's role — admin+ only.
router.patch('/:orgId/members/:userId', requireOrgRole('admin'), async (req, res) => {
  const { role } = req.body;
  if (!['member', 'admin', 'owner'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  // Only owners can promote/demote to/from owner.
  if (role === 'owner' && req.membership.role !== 'owner') {
    return res.status(403).json({ error: 'Only an owner can grant owner role' });
  }

  const { rows } = await query(
    'UPDATE memberships SET role = $1 WHERE org_id = $2 AND user_id = $3 RETURNING user_id, role',
    [role, req.params.orgId, req.params.userId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Member not found in this org' });

  await recordAudit({
    orgId: req.params.orgId, actorId: req.user.id, action: 'member.role_changed',
    target: `user:${req.params.userId}`, metadata: { newRole: role },
  });

  res.json({ member: rows[0] });
});

// Remove a member — admin+ only; can't remove the last owner.
router.delete('/:orgId/members/:userId', requireOrgRole('admin'), async (req, res) => {
  const { rows: ownerCount } = await query(
    `SELECT count(*) FROM memberships WHERE org_id = $1 AND role = 'owner'`,
    [req.params.orgId]
  );
  const { rows: target } = await query(
    'SELECT role FROM memberships WHERE org_id = $1 AND user_id = $2',
    [req.params.orgId, req.params.userId]
  );
  if (target[0]?.role === 'owner' && Number(ownerCount[0].count) <= 1) {
    return res.status(400).json({ error: 'Cannot remove the only owner' });
  }

  await query('DELETE FROM memberships WHERE org_id = $1 AND user_id = $2', [req.params.orgId, req.params.userId]);
  await recordAudit({ orgId: req.params.orgId, actorId: req.user.id, action: 'member.removed', target: `user:${req.params.userId}` });
  res.json({ message: 'Member removed' });
});

// --- Invitations ---------------------------------------------------------

router.post('/:orgId/invitations', requireOrgRole('admin'), async (req, res) => {
  const { email, role = 'member' } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const token = crypto.randomBytes(24).toString('hex');
  const { rows } = await query(
    `INSERT INTO invitations (org_id, email, role, token, invited_by, expires_at)
     VALUES ($1, $2, $3, $4, $5, now() + interval '7 days')
     RETURNING id, email, role, expires_at`,
    [req.params.orgId, email, role, token, req.user.id]
  );

  // TODO: email the invite link `${APP_URL}/invitations/accept?token=${token}`
  console.log(`[dev] invite link: ${process.env.APP_URL}/invitations/accept?token=${token}`);

  await recordAudit({ orgId: req.params.orgId, actorId: req.user.id, action: 'invitation.created', target: email });
  res.status(201).json({ invitation: rows[0] });
});

// Accept invite — separate from org RBAC since the user isn't a member yet.
router.post('/invitations/accept', requireAuth, async (req, res) => {
  const { token } = req.body;
  const { rows } = await query(
    `SELECT * FROM invitations WHERE token = $1 AND accepted_at IS NULL AND expires_at > now()`,
    [token]
  );
  const invite = rows[0];
  if (!invite) return res.status(400).json({ error: 'Invalid or expired invitation' });
  if (invite.email.toLowerCase() !== req.user.email.toLowerCase()) {
    return res.status(403).json({ error: 'This invitation was sent to a different email' });
  }

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO memberships (user_id, org_id, role) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, org_id) DO UPDATE SET role = EXCLUDED.role`,
      [req.user.id, invite.org_id, invite.role]
    );
    await client.query('UPDATE invitations SET accepted_at = now() WHERE id = $1', [invite.id]);
  });

  await recordAudit({ orgId: invite.org_id, actorId: req.user.id, action: 'invitation.accepted', target: `user:${req.user.id}` });
  res.json({ message: 'Joined organization', orgId: invite.org_id });
});

// --- Audit log viewer — admin+ only ---------------------------------------
router.get('/:orgId/audit-logs', requireOrgRole('admin'), async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const { rows } = await query(
    `SELECT al.id, al.action, al.target, al.metadata, al.created_at, u.email as actor_email
     FROM audit_logs al LEFT JOIN users u ON u.id = al.actor_id
     WHERE al.org_id = $1
     ORDER BY al.created_at DESC
     LIMIT $2`,
    [req.params.orgId, limit]
  );
  res.json({ auditLogs: rows });
});

export default router;
