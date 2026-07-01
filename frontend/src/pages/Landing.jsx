import { Link } from 'react-router-dom';

const features = [
  {
    icon: '🏢',
    title: 'Multi-tenant organizations',
    desc: 'Each customer gets their own isolated workspace. Data is completely walled off between organizations — enforced at the database level, not just the UI.',
  },
  {
    icon: '🔐',
    title: 'Role-based access control',
    desc: 'Owners, admins, and members each have different permissions. Every API route checks roles server-side — hiding buttons in the UI is never enough.',
  },
  {
    icon: '💳',
    title: 'Stripe billing built in',
    desc: 'Subscription tiers, checkout, billing portal, and webhook handling — including idempotent event processing so duplicate webhooks never cause double charges.',
  },
  {
    icon: '📋',
    title: 'Full audit logging',
    desc: 'Every sensitive action — role changes, billing updates, member removals — is permanently recorded with who did it, when, and in which organization.',
  },
  {
    icon: '🔑',
    title: 'Secure authentication',
    desc: 'argon2id password hashing, short-lived JWT access tokens, rotating refresh tokens, email verification, and password reset — all built in from day one.',
  },
  {
    icon: '📧',
    title: 'Team invitations',
    desc: 'Invite teammates by email with role assignment. Invitation links are time-limited and single-use, and verified against the invited email address on acceptance.',
  },
];

const plans = [
  {
    name: 'Free',
    price: '$0',
    desc: 'For individuals and small teams getting started.',
    features: ['1 organization', 'Up to 3 members', 'Audit log (7 days)', 'Community support'],
    cta: 'Get started free',
    href: '/register',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$29',
    desc: 'For growing teams that need more power.',
    features: ['Unlimited organizations', 'Unlimited members', 'Audit log (1 year)', 'Priority support', 'Advanced billing controls'],
    cta: 'Start free trial',
    href: '/register',
    highlight: true,
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-slate-200 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <span className="text-lg font-bold text-slate-900">SaaS Starter</span>
        <div className="flex items-center gap-4">
          <Link to="/login" className="text-sm text-slate-600 hover:text-slate-900">Sign in</Link>
          <Link to="/register" className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium">
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <span className="inline-block bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1 rounded-full mb-6">
          Multi-tenant SaaS infrastructure
        </span>
        <h1 className="text-5xl font-bold text-slate-900 leading-tight mb-6">
          The boring infrastructure<br />your SaaS actually needs
        </h1>
        <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-10">
          Auth, organizations, role-based permissions, Stripe billing, and audit logging — 
          all the unglamorous plumbing that has to be right before any product feature matters.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            to="/register"
            className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition"
          >
            Create an account
          </Link>
          <Link
            to="/login"
            className="border border-slate-300 text-slate-700 px-6 py-3 rounded-lg font-medium hover:bg-slate-50 transition"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20 border-t border-slate-100">
        <h2 className="text-2xl font-bold text-slate-900 text-center mb-4">
          Everything you need, none of what you don't
        </h2>
        <p className="text-slate-500 text-center mb-12 max-w-xl mx-auto">
          Built for teams that want to ship a real product without re-implementing the same security primitives from scratch.
        </p>
        <div className="grid grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="bg-slate-50 rounded-xl p-6 border border-slate-100">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-slate-900 mb-2">{f.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Proof point */}
      <section className="bg-slate-900 py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-slate-400 text-sm uppercase font-medium mb-4">Security that's actually tested</p>
          <p className="text-white text-2xl font-semibold leading-relaxed">
            "We created two accounts, each with their own organization, and tried to have one 
            read the other's data using a fully valid logged-in session. It was rejected."
          </p>
          <p className="text-slate-500 text-sm mt-4">
            That's not a feature — that's the foundation.
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <h2 className="text-2xl font-bold text-slate-900 text-center mb-4">Simple, transparent pricing</h2>
        <p className="text-slate-500 text-center mb-12">No hidden fees. Cancel anytime.</p>
        <div className="grid grid-cols-2 gap-6 max-w-2xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-xl border p-6 ${
                plan.highlight
                  ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500'
                  : 'border-slate-200 bg-white'
              }`}
            >
              {plan.highlight && (
                <span className="text-xs font-semibold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-bold text-slate-900 mt-2">{plan.name}</h3>
              <p className="text-3xl font-bold text-slate-900 mt-1">
                {plan.price}<span className="text-sm font-normal text-slate-500">/mo</span>
              </p>
              <p className="text-sm text-slate-500 mt-1 mb-4">{plan.desc}</p>
              <ul className="space-y-2 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="text-green-500">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link
                to={plan.href}
                className={`block text-center py-2 rounded-lg text-sm font-medium transition ${
                  plan.highlight
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 px-6 py-8 text-center text-sm text-slate-400">
        <p>Built with PostgreSQL, Express, React, and Node.js.</p>
      </footer>
    </div>
  );
}
