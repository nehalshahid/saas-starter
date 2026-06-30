import { useState, useEffect, useCallback } from 'react';
import { useOrg } from '../context/OrgContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

const ROLE_COLORS = {
  owner: 'bg-amber-100 text-amber-800',
  admin: 'bg-indigo-100 text-indigo-800',
  member: 'bg-slate-100 text-slate-700',
};

export default function Members() {
  const { activeOrg } = useOrg();
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');

  // The current user's own role in this org — drives which controls render.
  // Mirrors the server-side check; this is a UX nicety, NOT the security
  // boundary. The real enforcement happens in requireOrgRole on the backend —
  // hiding a button here is not what stops a member-role user from acting,
  // the 403 from the API is what stops them.
  const myRole = activeOrg?.role;
  const canManage = myRole === 'owner' || myRole === 'admin';

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api(`/orgs/${activeOrg.id}/members`);
      setMembers(data.members);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeOrg]);

  useEffect(() => {
    if (activeOrg) loadMembers();
  }, [activeOrg, loadMembers]);

  async function handleInvite(e) {
    e.preventDefault();
    setInviting(true);
    setInviteMsg('');
    try {
      await api(`/orgs/${activeOrg.id}/invitations`, {
        method: 'POST',
        body: { email: inviteEmail, role: inviteRole },
      });
      setInviteMsg(`Invite sent to ${inviteEmail}. Link is logged in the backend console (dev mode).`);
      setInviteEmail('');
    } catch (err) {
      setInviteMsg(err.message);
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(userId, role) {
    try {
      await api(`/orgs/${activeOrg.id}/members/${userId}`, { method: 'PATCH', body: { role } });
      loadMembers();
    } catch (err) {
      alert(err.message); // simple feedback for a starter project
    }
  }

  async function handleRemove(userId) {
    if (!confirm('Remove this member from the organization?')) return;
    try {
      await api(`/orgs/${activeOrg.id}/members/${userId}`, { method: 'DELETE' });
      loadMembers();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Members</h1>
          <p className="text-sm text-slate-500">{activeOrg.name} · your role: {myRole}</p>
        </div>
      </div>

      {canManage && (
        <form onSubmit={handleInvite} className="bg-white border border-slate-200 rounded-xl p-4 mb-6 flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">Invite by email</label>
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="teammate@example.com"
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg px-2 py-2"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={inviting}
            className="bg-indigo-600 text-white text-sm rounded-lg px-4 py-2 font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {inviting ? 'Sending…' : 'Send invite'}
          </button>
        </form>
      )}
      {inviteMsg && <p className="text-xs text-slate-500 mb-4">{inviteMsg}</p>}

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-left px-4 py-3 font-medium">Role</th>
              {canManage && <th className="text-right px-4 py-3 font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td className="px-4 py-4 text-slate-400" colSpan={3}>Loading…</td></tr>
            ) : (
              members.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3">
                    {m.email}
                    {m.id === user.id && <span className="text-xs text-slate-400 ml-2">(you)</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[m.role]}`}>
                      {m.role}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right space-x-2">
                      {m.role !== 'owner' && (
                        <select
                          value={m.role}
                          onChange={(e) => handleRoleChange(m.id, e.target.value)}
                          className="text-xs border border-slate-300 rounded px-1 py-1"
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                          {myRole === 'owner' && <option value="owner">Owner</option>}
                        </select>
                      )}
                      {m.id !== user.id && (
                        <button
                          onClick={() => handleRemove(m.id)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
