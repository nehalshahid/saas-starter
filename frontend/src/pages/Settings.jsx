import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrg } from '../context/OrgContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

export default function Settings() {
  const { activeOrg, refreshOrgs, switchOrg } = useOrg();
  const { user } = useAuth();
  const navigate = useNavigate();
  const myRole = activeOrg?.role;
  const isOwner = myRole === 'owner';

  const [name, setName] = useState(activeOrg?.name || '');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveError, setSaveError] = useState('');

  const [leaving, setLeaving] = useState(false);

  async function handleSaveName(e) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg('');
    setSaveError('');
    try {
      await api(`/orgs/${activeOrg.id}`, { method: 'PATCH', body: { name } });
      await refreshOrgs();
      setSaveMsg('Organization name updated.');
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleLeave() {
    if (!confirm(`Leave ${activeOrg.name}? You'll lose access immediately.`)) return;
    setLeaving(true);
    try {
      await api(`/orgs/${activeOrg.id}/members/${user.id}`, { method: 'DELETE' });
      await refreshOrgs();
      navigate('/');
    } catch (err) {
      alert(err.message);
      setLeaving(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-lg font-semibold text-slate-900 mb-1">Settings</h1>
      <p className="text-sm text-slate-500 mb-8">{activeOrg.name}</p>

      {/* Org name */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
        <h2 className="font-medium text-slate-900 mb-4">Organization name</h2>
        <form onSubmit={handleSaveName} className="flex gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isOwner}
            className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
          />
          {isOwner && (
            <button
              type="submit"
              disabled={saving || name === activeOrg.name}
              className="bg-indigo-600 text-white text-sm rounded-lg px-4 py-2 font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </form>
        {!isOwner && <p className="text-xs text-slate-400 mt-2">Only owners can rename the organization.</p>}
        {saveMsg && <p className="text-xs text-green-600 mt-2">{saveMsg}</p>}
        {saveError && <p className="text-xs text-red-600 mt-2">{saveError}</p>}
      </div>

      {/* Org details */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
        <h2 className="font-medium text-slate-900 mb-4">Organization details</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Slug</span>
            <span className="font-mono text-slate-800">{activeOrg.slug}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">ID</span>
            <span className="font-mono text-xs text-slate-500">{activeOrg.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Your role</span>
            <span className="capitalize font-medium text-slate-800">{myRole}</span>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-white border border-red-200 rounded-xl p-6">
        <h2 className="font-medium text-red-700 mb-1">Danger zone</h2>
        <p className="text-sm text-slate-500 mb-4">
          {isOwner
            ? "As the owner, you can't leave until you transfer ownership to another member first."
            : "Leaving the organization will immediately remove your access to all its data."}
        </p>
        <button
          onClick={handleLeave}
          disabled={leaving || isOwner}
          className="text-sm border border-red-300 text-red-600 rounded-lg px-4 py-2 font-medium hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {leaving ? 'Leaving…' : 'Leave organization'}
        </button>
      </div>
    </div>
  );
}
