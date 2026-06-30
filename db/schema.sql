-- Multi-tenant SaaS starter schema
-- Strategy: shared-schema with org_id on every tenant-scoped table.
-- (Schema-per-tenant noted as an alternative in README — not implemented here;
--  it trades operational complexity for stronger isolation, usually overkill
--  until you have compliance requirements or very large tenants.)

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;   -- case-insensitive email comparisons

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           CITEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,           -- argon2id hash
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Role per (user, org). A user can belong to multiple orgs with different roles.
CREATE TYPE org_role AS ENUM ('owner', 'admin', 'member');

CREATE TABLE memberships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role        org_role NOT NULL DEFAULT 'member',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id)
);

CREATE TABLE invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email       CITEXT NOT NULL,
  role        org_role NOT NULL DEFAULT 'member',
  token       TEXT UNIQUE NOT NULL,         -- random, sent in invite link
  invited_by  UUID NOT NULL REFERENCES users(id),
  expires_at  TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,                -- store hash, never raw token
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE email_verification_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_customer_id  TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  plan                TEXT NOT NULL DEFAULT 'free',   -- free | pro | enterprise
  status              TEXT NOT NULL DEFAULT 'inactive', -- active | past_due | canceled | trialing
  current_period_end  TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotency for Stripe webhooks: every event id we've processed is recorded here.
-- Stripe can send duplicate / out-of-order events; this is the dedupe guard.
CREATE TABLE stripe_events (
  id          TEXT PRIMARY KEY,         -- Stripe event.id, naturally unique
  type        TEXT NOT NULL,
  payload     JSONB NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES users(id),   -- nullable: system/webhook actions
  action      TEXT NOT NULL,               -- e.g. 'member.role_changed', 'billing.subscription_updated'
  target      TEXT,                        -- e.g. the affected resource id/type
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_memberships_org ON memberships(org_id);
CREATE INDEX idx_memberships_user ON memberships(user_id);
CREATE INDEX idx_audit_logs_org_created ON audit_logs(org_id, created_at DESC);
CREATE INDEX idx_invitations_org ON invitations(org_id);
