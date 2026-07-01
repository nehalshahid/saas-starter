# Multi-tenant SaaS Starter (PERN)

Essential SaaS infrastructure: auth, multi-tenancy, RBAC, Stripe billing
with idempotent webhooks, and audit logging. Backend only here (Express + Postgres);
pair with a React frontend that calls these routes.

## Stack
Postgres, Express (Node), React, Node.

## Setup

```bash
cp .env.example .env   # fill in DATABASE_URL, JWT secrets, Stripe keys
createdb saas_starter
npm install
npm run migrate        # runs db/schema.sql
npm run dev
```

## Architecture decisions worth being able to explain in an interview

**Tenancy model**: shared-schema with `org_id` on every tenant-scoped row, rather
than schema-per-tenant. Simpler operationally (one connection pool, one migration
path), and the isolation boundary is enforced in application code via the RBAC
middleware rather than at the database level. Schema-per-tenant (or row-level
security policies in Postgres) would give stronger isolation guarantees at the
cost of much more complex migrations and connection management — worth it once
you have compliance requirements (e.g. enterprise customers demanding physical
data separation), not before.

**Auth**: argon2id for password hashing (memory-hard, resists GPU cracking).
Short-lived JWT access tokens (15 min, stateless, no DB hit to verify) + opaque
refresh tokens stored as hashes with rotation (every refresh issues a new token
and revokes the old one — a stolen-but-unused refresh token is single-use against
a real attacker since using it once invalidates it for the legitimate owner too).

**RBAC**: a single middleware (`requireOrgRole`) is the chokepoint for every
tenant-scoped route. It does double duty: confirms the authenticated user has
*any* membership in the org from the URL (this is what stops cross-tenant data
leaks), and confirms their role meets the route's minimum. Routes never trust
an `org_id` from the request body for authorization — only from the URL param,
checked against the DB.

**Stripe webhooks**: the genuinely tricky part. Stripe explicitly does not
guarantee ordered or exactly-once delivery. Handled here by:
- Recording `event.id` into a `stripe_events` table with a unique constraint
  *before* processing — duplicate deliveries hit the unique conflict and are
  acked without reprocessing.
- Webhook route mounted with `express.raw()` ahead of the global JSON parser,
  since Stripe's signature check needs the untouched body bytes.
- Each event handler is written to be safe to apply out of order where
  possible (e.g. matching on `stripe_subscription_id` rather than assuming
  `checkout.session.completed` always arrives first).

**Audit log**: every sensitive mutation (role change, member removal, invite,
billing state change) writes to `audit_logs` in the same logical operation as
the action. `actor_id` is nullable because webhook-driven events (e.g. a
payment failure) aren't triggered by a logged-in user.

## Testing the tenant boundary (milestone 2)

This is the test that actually matters for this project:

1. Register two users, create one org each (User A → Org A, User B → Org B).
2. Log in as User B, grab their access token.
3. Call `GET /api/orgs/:orgAId/members` using User B's token and Org A's id.
4. Confirm you get `403 Not a member of this organization` — not a 500, not
   a silent empty array, not Org A's actual member list.

```terminal
# as user B, trying to read org A's data
curl -H "Authorization: Bearer $USER_B_TOKEN" \
     http://localhost:4000/api/orgs/$ORG_A_ID/members
# expect: {"error":"Not a member of this organization"}
```

Also worth testing: a `member`-role user hitting an `admin`-only route
(e.g. `PATCH /:orgId/members/:userId`) — expect 403 `Insufficient role`.

## Stripe webhook testing locally

```terminal
stripe listen --forward-to localhost:4000/api/billing/webhook
stripe trigger checkout.session.completed
stripe trigger checkout.session.completed   # fire twice — confirm second is logged as duplicate
```

## Milestones

1. **Auth + org creation/invitation flow** — `src/routes/auth.js`, `src/routes/orgs.js`
   (register, verify email, login, refresh w/ rotation, password reset, create org,
   invite teammate by email, accept invite).
2. **RBAC middleware enforced on API routes** — `src/middleware/rbac.js`. Test per
   above: confirm cross-org access is blocked, confirm role escalation is blocked.
3. **Stripe subscription integration + webhook handling** — `src/routes/billing.js`.
   Checkout session, billing portal, webhook with idempotency table.
4. **Audit log table + UI** — table is `audit_logs`; API is
   `GET /api/orgs/:orgId/audit-logs` (admin+ only). Build a simple React table
   that paginates/filters by action type — not scaffolded here, but the API
   shape is ready for it.
5. **Polish** — rate limiting is already in `src/index.js` (global + stricter
   on auth routes); centralized error handler is in place. Still to add: a
   settings page for org name/slug editing, request validation on more routes
   (only auth currently uses `zod`), structured logging (pino), and tests
   (supertest + a test DB) for the RBAC boundary specifically.

## What's intentionally left as TODO (mention these in interviews — knowing
what you cut and why is itself a signal)

- Email sending is stubbed to `console.log` — wire up nodemailer/SES/Resend.
- No row-level security (RLS) in Postgres — the app-layer RBAC is the only
  boundary. Worth adding RLS as defense-in-depth if you want to go further.
- No background job queue for webhook retries beyond Stripe's own retry
  schedule — fine at this scale, would add BullMQ/pg-boss before production.
- Frontend not included here — routes are designed to be called from a
  React app with the access/refresh token pattern (access token in memory,
  refresh token in httpOnly cookie or secure storage).
