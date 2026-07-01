import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.js';
import orgRoutes from './routes/orgs.js';
import billingRoutes, { stripeWebhookHandler } from './routes/billing.js';
import tasksRoutes from './routes/tasks.js';

dotenv.config();
const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.APP_URL, credentials: true }));

// Stripe webhook needs the RAW body for signature verification, so it must
// be mounted BEFORE express.json() globally parses the body, and as a
// standalone handler (not the billingRoutes router, to avoid double-mounting).
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

app.use(express.json());

// Global rate limit — generous baseline; auth routes get a stricter one below.
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // brute-force protection on login/register/reset
  message: { error: 'Too many attempts, please try again later.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/orgs', orgRoutes);
app.use('/api/orgs', tasksRoutes);
app.use('/api/billing', billingRoutes); // non-webhook billing routes (checkout, portal, subscription GET)

app.get('/health', (req, res) => res.json({ ok: true }));

// Centralized error handler — keeps stack traces out of responses.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

export default app;

// Vercel imports this file as a serverless function and never calls
// app.listen() itself — only run the local dev server outside production.
if (process.env.NODE_ENV !== 'production') {
  const port = process.env.PORT || 4000;
  app.listen(port, () => console.log(`API listening on :${port}`));
}