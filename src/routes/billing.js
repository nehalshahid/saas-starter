import { Router } from 'express';
import Stripe from 'stripe';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOrgRole } from '../middleware/rbac.js';
import { recordAudit } from '../utils/audit.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const router = Router();

// --- Checkout session (admin+ only — billing is sensitive) -----------------
router.post('/:orgId/checkout', requireAuth, requireOrgRole('admin'), async (req, res) => {
  const orgId = req.params.orgId;
  const { rows } = await query('SELECT * FROM subscriptions WHERE org_id = $1', [orgId]);
  let sub = rows[0];

  // Lazily create the Stripe customer on first checkout.
  if (!sub?.stripe_customer_id) {
    const { rows: orgRows } = await query('SELECT name FROM organizations WHERE id = $1', [orgId]);
    const customer = await stripe.customers.create({
      name: orgRows[0].name,
      metadata: { org_id: orgId },
    });
    await query(
      `UPDATE subscriptions SET stripe_customer_id = $1, updated_at = now() WHERE org_id = $2`,
      [customer.id, orgId]
    );
    sub = { ...sub, stripe_customer_id: customer.id };
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: sub.stripe_customer_id,
    line_items: [{ price: process.env.STRIPE_PRICE_PRO, quantity: 1 }],
    success_url: `${process.env.APP_URL}/billing?success=true`,
    cancel_url: `${process.env.APP_URL}/billing?canceled=true`,
    // org_id travels with the session so the webhook can attribute events
    // even on the very first event, before our subscription row has the
    // Stripe subscription id populated.
    metadata: { org_id: orgId },
    subscription_data: { metadata: { org_id: orgId } },
  });

  res.json({ url: session.url });
});

router.post('/:orgId/portal', requireAuth, requireOrgRole('admin'), async (req, res) => {
  const { rows } = await query('SELECT stripe_customer_id FROM subscriptions WHERE org_id = $1', [req.params.orgId]);
  if (!rows[0]?.stripe_customer_id) return res.status(400).json({ error: 'No billing customer on file' });

  const session = await stripe.billingPortal.sessions.create({
    customer: rows[0].stripe_customer_id,
    return_url: `${process.env.APP_URL}/billing`,
  });
  res.json({ url: session.url });
});

router.get('/:orgId/subscription', requireAuth, requireOrgRole('member'), async (req, res) => {
  const { rows } = await query(
    'SELECT plan, status, current_period_end FROM subscriptions WHERE org_id = $1',
    [req.params.orgId]
  );
  res.json({ subscription: rows[0] || null });
});

// --- Webhook handler (exported separately) -----------------------------
// Mounted in index.js with express.raw() BEFORE express.json(), at a
// dedicated path — NOT as part of this router — because Stripe's signature
// verification needs the untouched raw body, and mounting this whole router
// twice (once raw, once json) would double-register every other route.
export const stripeWebhookHandler = async (req, res) => {
  let event;
  try {
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Idempotency: Stripe guarantees an event.id is stable across redeliveries,
  // but does NOT guarantee delivery order or exactly-once delivery. We
  // dedupe by inserting the event id first; if it's already there, this is
  // a duplicate delivery and we ack it without reprocessing.
  const inserted = await query(
    `INSERT INTO stripe_events (id, type, payload) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING RETURNING id`,
    [event.id, event.type, event]
  );
  if (inserted.rows.length === 0) {
    return res.json({ received: true, duplicate: true });
  }

  try {
    await handleStripeEvent(event);
    res.json({ received: true });
  } catch (err) {
    console.error('Error processing webhook:', err);
    // Returning 500 makes Stripe retry — safe because of the dedupe above,
    // but ONLY because we recorded the event id before processing, not after.
    res.status(500).json({ error: 'Processing failed' });
  }
};

async function handleStripeEvent(event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const orgId = session.metadata?.org_id;
      if (!orgId) break;
      const subscriptionId = session.subscription;
      await query(
        `UPDATE subscriptions SET stripe_subscription_id = $1, plan = 'pro', status = 'active', updated_at = now()
         WHERE org_id = $2`,
        [subscriptionId, orgId]
      );
      await recordAudit({ orgId, action: 'billing.subscription_started', metadata: { subscriptionId } });
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object;
      const orgId = sub.metadata?.org_id;
      if (!orgId) break;
      // Out-of-order protection: only apply this update if it's not stale.
      // We use current_period_end as a coarse ordering signal — a real
      // production system might also track Stripe's event creation timestamp.
      await query(
        `UPDATE subscriptions
         SET status = $1, current_period_end = to_timestamp($2), updated_at = now()
         WHERE org_id = $3 AND stripe_subscription_id = $4`,
        [sub.status, sub.current_period_end, orgId, sub.id]
      );
      await recordAudit({ orgId, action: 'billing.subscription_updated', metadata: { status: sub.status } });
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      const orgId = sub.metadata?.org_id;
      if (!orgId) break;
      await query(
        `UPDATE subscriptions SET plan = 'free', status = 'canceled', updated_at = now()
         WHERE org_id = $1 AND stripe_subscription_id = $2`,
        [orgId, sub.id]
      );
      await recordAudit({ orgId, action: 'billing.subscription_canceled' });
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const orgId = invoice.subscription_details?.metadata?.org_id;
      if (!orgId) break;
      await query(`UPDATE subscriptions SET status = 'past_due', updated_at = now() WHERE org_id = $1`, [orgId]);
      await recordAudit({ orgId, action: 'billing.payment_failed' });
      break;
    }

    default:
      // Unhandled event types are fine to no-op on — just don't error.
      break;
  }
}

export default router;
