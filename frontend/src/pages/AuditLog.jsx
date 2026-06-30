import { useState, useEffect, useCallback } from 'react';
import { useOrg } from '../context/OrgContext';
import { api } from '../lib/api';

function formatAction(action) {
  // 'member.role_changed' -> 'Member · Role changed'
  return action
    .split('.')
    .map((part) => part.replace(/_/g, ' '))
    .join(' · ');
}

export default function AuditLog() {
  const { activeOrg } = useOrg();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const myRole = activeOrg?.role;
  const canView = myRole === 'owner' || myRole === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api(`/orgs/${activeOrg.id}/audit-logs`);
      setLogs(data.auditLogs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeOrg]);

  useEffect(() => {
    if (activeOrg && canView) load();
    else setLoading(false);
  }, [activeOrg, canView, load]);

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900 mb-1">Audit Log</h1>
      <p className="text-sm text-slate-500 mb-6">
        Every sensitive action in {activeOrg.name} — who did what, and when.
      </p>

      {!canView ? (
        <p className="text-sm text-slate-400">Only org admins/owners can view the audit log.</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Action</th>
                <th className="text-left px-4 py-3 font-medium">Actor</th>
                <th className="text-left px-4 py-3 font-medium">Target</th>
                <th className="text-left px-4 py-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td className="px-4 py-4 text-slate-400" colSpan={4}>Loading…</td></tr>
              ) : logs.length === 0 ? (
                <tr><td className="px-4 py-4 text-slate-400" colSpan={4}>No activity recorded yet.</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-3 font-medium text-slate-800 capitalize">{formatAction(log.action)}</td>
                    <td className="px-4 py-3 text-slate-500">{log.actor_email || 'system'}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{log.target || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
