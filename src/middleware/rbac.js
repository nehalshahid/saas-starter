import { query } from '../db.js';

const ROLE_RANK = { member: 1, admin: 2, owner: 3 };

/**
 * Org-scoping + RBAC middleware. This is the single chokepoint every
 * tenant-scoped route must pass through. It does two things that are easy
 * to get wrong if scattered ad-hoc across route handlers:
 *
 * 1. Confirms req.user actually has a membership in the org referenced by
 *    the route (:orgId param) — this is what prevents org A from reading
 *    org B's data just by changing an ID in the URL.
 * 2. Confirms that membership's role meets the minimum required for the
 *    route (e.g. only owner/admin can change roles or billing).
 *
 * Usage: router.patch('/orgs/:orgId/members/:userId', requireAuth, requireOrgRole('admin'), handler)
 *
 * Sets req.membership = { org_id, role } for handlers to use.
 */
export function requireOrgRole(minRole = 'member') {
  return async function (req, res, next) {
    const orgId = req.params.orgId;
    if (!orgId) return res.status(400).json({ error: 'Missing org Id in route' });

    const { rows } = await query(
      'SELECT role FROM memberships WHERE user_id = $1 AND org_id = $2',
      [req.user.id, orgId]
    );

    const membership = rows[0];
    if (!membership) {
      // Deliberately the same 403/404-style response whether the org exists
      // and the user just isn't a member, vs the org doesn't exist at all —
      // don't leak which orgs exist to unauthenticated probing.
      return res.status(403).json({ error: 'Not a member of this organization' });
    }

    if (ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
      return res.status(403).json({ error: 'Insufficient role for this action' });
    }

    req.membership = { org_id: orgId, role: membership.role };
    next();
  };
}
