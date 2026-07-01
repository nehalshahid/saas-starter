import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOrgRole } from '../middleware/rbac.js';
import { recordAudit } from '../utils/audit.js';

const router = Router();
router.use(requireAuth);
// NOTE: requireOrgRole is NOT applied here with router.use() because that
// runs before Express has matched the route pattern and extracted :orgId —
// req.params.orgId would be undefined at that point. Instead, requireOrgRole
// is applied individually to each route below, after :orgId is available.

// Helper: is req.user an assignee of this task, or admin+?
async function canAccessTask(req, taskId) {
  if (['admin', 'owner'].includes(req.membership.role)) return true;
  const { rows } = await query(
    'SELECT 1 FROM task_assignees WHERE task_id = $1 AND user_id = $2',
    [taskId, req.user.id]
  );
  return !!rows[0];
}

// --- Create task (admin+ only) — assign to one or many members at once ---
router.post('/:orgId/tasks', requireOrgRole('admin'), async (req, res) => {
  const { title, description, due_date, assignee_ids } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
  if (!Array.isArray(assignee_ids) || assignee_ids.length === 0) {
    return res.status(400).json({ error: 'At least one assignee is required' });
  }

  // Verify every assignee actually belongs to this org — prevents assigning
  // a task to a user from a different org just by knowing their user id.
  const { rows: validMembers } = await query(
    'SELECT user_id FROM memberships WHERE org_id = $1 AND user_id = ANY($2)',
    [req.params.orgId, assignee_ids]
  );
  if (validMembers.length !== assignee_ids.length) {
    return res.status(400).json({ error: 'One or more assignees are not members of this org' });
  }

  const task = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO tasks (org_id, created_by, title, description, due_date)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.orgId, req.user.id, title.trim(), description || null, due_date || null]
    );
    const task = rows[0];
    for (const userId of assignee_ids) {
      await client.query(
        'INSERT INTO task_assignees (task_id, user_id) VALUES ($1, $2)',
        [task.id, userId]
      );
    }
    return task;
  });

  await recordAudit({
    orgId: req.params.orgId, actorId: req.user.id, action: 'task.created',
    target: task.id, metadata: { assignee_ids },
  });

  res.status(201).json({ task: { ...task, assignee_ids } });
});

// --- List tasks — admins see all org tasks, members see only their own ---
router.get('/:orgId/tasks', requireOrgRole('member'), async (req, res) => {
  const isAdmin = ['admin', 'owner'].includes(req.membership.role);

  const { rows } = isAdmin
    ? await query(
        `SELECT t.*, array_agg(ta.user_id) as assignee_ids
         FROM tasks t
         LEFT JOIN task_assignees ta ON ta.task_id = t.id
         WHERE t.org_id = $1
         GROUP BY t.id ORDER BY t.created_at DESC`,
        [req.params.orgId]
      )
    : await query(
        `SELECT t.*, array_agg(ta2.user_id) as assignee_ids
         FROM tasks t
         JOIN task_assignees ta ON ta.task_id = t.id AND ta.user_id = $2
         LEFT JOIN task_assignees ta2 ON ta2.task_id = t.id
         WHERE t.org_id = $1
         GROUP BY t.id ORDER BY t.created_at DESC`,
        [req.params.orgId, req.user.id]
      );

  res.json({ tasks: rows });
});

// --- Single task (permission-checked) ---
router.get('/:orgId/tasks/:taskId', requireOrgRole('member'), async (req, res) => {
  if (!(await canAccessTask(req, req.params.taskId))) {
    return res.status(404).json({ error: 'Task not found' });
  }
  const { rows } = await query('SELECT * FROM tasks WHERE id = $1 AND org_id = $2', [req.params.taskId, req.params.orgId]);
  if (!rows[0]) return res.status(404).json({ error: 'Task not found' });

  const { rows: assignees } = await query(
    `SELECT u.id, u.email FROM task_assignees ta JOIN users u ON u.id = ta.user_id WHERE ta.task_id = $1`,
    [req.params.taskId]
  );
  const { rows: responses } = await query(
    `SELECT tr.id, tr.body, tr.created_at, u.email as author_email
     FROM task_responses tr JOIN users u ON u.id = tr.user_id
     WHERE tr.task_id = $1 ORDER BY tr.created_at ASC`,
    [req.params.taskId]
  );

  res.json({ task: rows[0], assignees, responses });
});

// --- Update status (assignee or admin+) ---
router.patch('/:orgId/tasks/:taskId/status', requireOrgRole('member'), async (req, res) => {
  if (!(await canAccessTask(req, req.params.taskId))) {
    return res.status(404).json({ error: 'Task not found' });
  }
  const { status } = req.body;
  if (!['open', 'in_progress', 'done'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const { rows } = await query(
    'UPDATE tasks SET status = $1, updated_at = now() WHERE id = $2 AND org_id = $3 RETURNING *',
    [status, req.params.taskId, req.params.orgId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Task not found' });

  await recordAudit({ orgId: req.params.orgId, actorId: req.user.id, action: 'task.status_changed', target: req.params.taskId, metadata: { status } });
  res.json({ task: rows[0] });
});

// --- Post a response (assignee or admin+) ---
router.post('/:orgId/tasks/:taskId/responses', requireOrgRole('member'), async (req, res) => {
  if (!(await canAccessTask(req, req.params.taskId))) {
    return res.status(404).json({ error: 'Task not found' });
  }
  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'Response body is required' });

  const { rows } = await query(
    'INSERT INTO task_responses (task_id, user_id, body) VALUES ($1, $2, $3) RETURNING *',
    [req.params.taskId, req.user.id, body.trim()]
  );
  res.status(201).json({ response: rows[0] });
});

export default router;