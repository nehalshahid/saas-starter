import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useOrg } from '../context/OrgContext';
import { api } from '../lib/api';

const STATUS_COLORS = {
  open: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-amber-100 text-amber-800',
  done: 'bg-green-100 text-green-800',
};

export default function Tasks() {
  const { activeOrg } = useOrg();
  const myRole = activeOrg?.role;
  const isAdmin = myRole === 'owner' || myRole === 'admin';

  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api(`/orgs/${activeOrg.id}/tasks`);
      setTasks(data.tasks);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeOrg]);

  useEffect(() => {
    if (activeOrg) loadTasks();
  }, [activeOrg, loadTasks]);

  useEffect(() => {
    if (activeOrg && isAdmin) {
      api(`/orgs/${activeOrg.id}/members`).then((data) => setMembers(data.members)).catch(() => {});
    }
  }, [activeOrg, isAdmin]);

  function toggleAssignee(userId) {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (selectedIds.length === 0) {
      setCreateError('Select at least one assignee');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      await api(`/orgs/${activeOrg.id}/tasks`, {
        method: 'POST',
        body: { title, description, due_date: dueDate || null, assignee_ids: selectedIds },
      });
      setTitle('');
      setDescription('');
      setDueDate('');
      setSelectedIds([]);
      setShowCreate(false);
      loadTasks();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Tasks</h1>
          <p className="text-sm text-slate-500">{activeOrg.name}</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="bg-indigo-600 text-white text-sm rounded-lg px-4 py-2 font-medium hover:bg-indigo-700"
          >
            {showCreate ? 'Cancel' : '+ New task'}
          </button>
        )}
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl p-4 mb-6 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Due date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Assign to</label>
            <div className="space-y-1 max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2">
              {members.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm py-0.5">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(m.id)}
                    onChange={() => toggleAssignee(m.id)}
                  />
                  {m.email}
                </label>
              ))}
            </div>
          </div>
          {createError && <p className="text-sm text-red-600">{createError}</p>}
          <button
            type="submit"
            disabled={creating}
            className="bg-indigo-600 text-white text-sm rounded-lg px-4 py-2 font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {creating ? 'Creating…' : 'Create task'}
          </button>
        </form>
      )}

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Title</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Due</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td className="px-4 py-4 text-slate-400" colSpan={3}>Loading…</td></tr>
            ) : tasks.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-slate-400" colSpan={3}>
                  {isAdmin ? 'No tasks yet — create one above.' : 'No tasks assigned to you yet.'}
                </td>
              </tr>
            ) : (
              tasks.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link to={`/dashboard/tasks/${t.id}`} className="font-medium text-slate-800 hover:text-indigo-600">
                      {t.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[t.status]}`}>
                      {t.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {t.due_date ? new Date(t.due_date).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}