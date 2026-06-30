import { useState, useEffect, useCallback } from 'react';
import { useOrg } from '../context/OrgContext';
import { api } from '../lib/api';

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-800',
  trialing: 'bg-blue-100 text-blue-800',
  past_due: 'bg-amber-100 text-amber-800',
  canceled: 'bg-slate-100 text-slate-700',
  inactive: 'bg-slate-100 text-slate-700',
};

export default function Billing() {
  const { activeOrg } = useOrg();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const myRole = activeOrg?.role;
  const canManageBilling = myRole === 'owner' || myRole === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    const data = await api(`/billing/${activeOrg.id}/subscription`);
    setSubscription(data.subscription);
    setLoading(false);
  }, [activeOrg]);

  useEffect(() => {
    if (activeOrg) load();
  }, [activeOrg, load]);

  async function handleUpgrade() {
    setActionLoading(true);
    try {
      const data = await api(`/billing/${activeOrg.id}/checkout`, { method: 'POST' });
      window.location.href = data.url; // redirect to Stripe Checkout
    } catch (err) {
      alert(err.message);
      setActionLoading(false);
    }
  }

  async function handleManage() {
    setActionLoading(true);
    try {
      const data = await api(`/billing/${activeOrg.id}/portal`, { method: 'POST' });
      window.location.href = data.url; // redirect to Stripe Billing Portal
    } catch (err) {
      alert(err.message);
      setActionLoading(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>;

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900 mb-1">Billing</h1>
      <p className="text-sm text-slate-500 mb-6">{activeOrg.name}</p>

      <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-slate-500 uppercase font-medium">Current plan</p>
            <p className="text-2xl font-semibold text-slate-900 capitalize">{subscription?.plan || 'free'}</p>
          </div>
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[subscription?.status] || STATUS_COLORS.inactive}`}>
            {subscription?.status || 'inactive'}
          </span>
        </div>

        {subscription?.current_period_end && (
          <p className="text-xs text-slate-500 mb-4">
            Renews {new Date(subscription.current_period_end).toLocaleDateString()}
          </p>
        )}

        {!canManageBilling ? (
          <p className="text-xs text-slate-400">Only org admins/owners can manage billing.</p>
        ) : subscription?.plan === 'free' ? (
          <button
            onClick={handleUpgrade}
            disabled={actionLoading}
            className="w-full bg-indigo-600 text-white text-sm rounded-lg py-2 font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {actionLoading ? 'Redirecting…' : 'Upgrade to Pro'}
          </button>
        ) : (
          <button
            onClick={handleManage}
            disabled={actionLoading}
            className="w-full border border-slate-300 text-slate-700 text-sm rounded-lg py-2 font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            {actionLoading ? 'Redirecting…' : 'Manage subscription'}
          </button>
        )}
      </div>

      <p className="text-xs text-slate-400 mt-4 max-w-md">
        Checkout and the billing portal both redirect to Stripe-hosted pages —
        nothing here, by design, touches raw card details. Subscription state
        updates here come from Stripe webhooks, not from this button click
        directly, so there can be a few seconds' delay after checkout.
      </p>
    </div>
  );
}
