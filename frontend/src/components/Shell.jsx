import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useOrg } from '../context/OrgContext';
import { api } from '../lib/api';

const navItems = [
  { to: '/dashboard', label: '🏠 Overview', end: true },
  { to: '/dashboard/members', label: '👥 Members' },
  { to: '/dashboard/tasks', label: '✅ Tasks' },
  { to: '/dashboard/billing', label: '💳 Billing' },
  { to: '/dashboard/audit-log', label: '📋 Audit Log' },
  { to: '/dashboard/settings', label: '⚙️ Settings' },
];

export default function Shell() {
  const { user, logout } = useAuth();
  const { orgs, activeOrg, activeOrgId, switchOrg, refreshOrgs } = useOrg();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [createError, setCreateError] = useState('');

  async function handleCreateOrg(e) {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setCreateError('');
    try {
      const data = await api('/orgs', { method: 'POST', body: { name: newOrgName } });
      setNewOrgName('');
      setCreating(false);
      await refreshOrgs();
      switchOrg(data.organization.id);
    } catch (err) {
      setCreateError(err.message);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col fixed h-full">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-slate-100">
          <span className="font-bold text-slate-900 text-sm">⚡ SaaS Starter</span>
        </div>

        {/* Org switcher */}
        <div className="p-4 border-b border-slate-100">
          <p className="text-xs font-medium text-slate-400 uppercase mb-2">Organization</p>
          <select
            value={activeOrgId || ''}
            onChange={(e) => switchOrg(e.target.value)}
            className="w-full text-sm font-medium border border-slate-200 rounded-lg px-2 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          {activeOrg && (
            <span className="text-xs text-slate-400 mt-1 block capitalize">
              Your role: <span className="font-medium text-slate-600">{activeOrg.role}</span>
            </span>
          )}

          {!creating ? (
            <button
              onClick={() => setCreating(true)}
              className="mt-2 text-xs text-indigo-600 hover:underline"
            >
              + New organization
            </button>
          ) : (
            <form onSubmit={handleCreateOrg} className="mt-2 space-y-1">
              <div className="flex gap-1">
                <input
                  autoFocus
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="Org name"
                  className="flex-1 text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button type="submit" className="text-xs bg-indigo-600 text-white rounded px-2 font-medium">
                  Add
                </button>
              </div>
              {createError && <p className="text-xs text-red-500">{createError}</p>}
              <button
                type="button"
                onClick={() => { setCreating(false); setCreateError(''); }}
                className="text-xs text-slate-400 hover:underline"
              >
                Cancel
              </button>
            </form>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center px-3 py-2 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
              {user?.email?.[0]?.toUpperCase()}
            </div>
            <p className="text-xs text-slate-600 truncate flex-1">{user?.email}</p>
          </div>
          <button
            onClick={async () => { await logout(); navigate('/login'); }}
            className="text-xs text-red-500 hover:underline"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-5xl mx-auto">
          {activeOrg ? (
            <Outlet />
          ) : (
            <div className="flex flex-col items-center justify-center h-96 text-center">
              <div className="text-5xl mb-4">🏢</div>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">No organization yet</h2>
              <p className="text-sm text-slate-500">
                Create your first organization using the sidebar to get started.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
