import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useOrg } from '../context/OrgContext';
import { api } from '../lib/api';

const navItems = [
  { to: '/', label: 'Overview', end: true },
  { to: '/members', label: 'Members' },
  { to: '/billing', label: 'Billing' },
  { to: '/audit-log', label: 'Audit Log' },
];

export default function Shell() {
  const { user, logout } = useAuth();
  const { orgs, activeOrg, activeOrgId, switchOrg, refreshOrgs } = useOrg();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');

  async function handleCreateOrg(e) {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    const data = await api('/orgs', { method: 'POST', body: { name: newOrgName } });
    setNewOrgName('');
    setCreating(false);
    await refreshOrgs();
    switchOrg(data.organization.id);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <select
            value={activeOrgId || ''}
            onChange={(e) => switchOrg(e.target.value)}
            className="w-full text-sm font-medium border border-slate-300 rounded-lg px-2 py-2 bg-white"
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} · {o.role}
              </option>
            ))}
          </select>

          {!creating ? (
            <button
              onClick={() => setCreating(true)}
              className="mt-2 text-xs text-indigo-600 hover:underline"
            >
              + New organization
            </button>
          ) : (
            <form onSubmit={handleCreateOrg} className="mt-2 flex gap-1">
              <input
                autoFocus
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="Org name"
                className="flex-1 text-xs border border-slate-300 rounded px-2 py-1"
              />
              <button type="submit" className="text-xs bg-indigo-600 text-white rounded px-2">
                Add
              </button>
            </form>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm font-medium transition ${
                  isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          <button
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
            className="mt-1 text-xs text-red-600 hover:underline"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8 max-w-5xl">
        {activeOrg ? (
          <Outlet />
        ) : (
          <div className="text-sm text-slate-500">
            You don't belong to any organization yet — create one from the sidebar to get started.
          </div>
        )}
      </main>
    </div>
  );
}
