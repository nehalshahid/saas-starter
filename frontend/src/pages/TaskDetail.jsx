import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useOrg } from '../context/OrgContext';
import { api } from '../lib/api';

const STATUS_OPTIONS = ['open', 'in_progress', 'done'];

export default function TaskDetail() {
  const { taskId } = useParams();
  const { activeOrg } = useOrg();

  const [task, setTask] = useState(null);
  const [assignees, setAssignees] = useState([]);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reply, setReply] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api(`/orgs/${activeOrg.id}/tasks/${taskId}`);
      setTask(data.task);
      setAssignees(data.assignees);
      setResponses(data.responses);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeOrg, taskId]);

  useEffect(() => {
    if (activeOrg) load();
  }, [activeOrg, load]);

  async function handleStatusChange(status) {
    try {
      const data = await api(`/orgs/${activeOrg.id}/tasks/${taskId}/status`, { method: 'PATCH', body: { status } });
      setTask(data.task);
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleReply(e) {
    e.preventDefault();
    if (!reply.trim()) return;
    setPosting(true);
    try {
      await api(`/orgs/${activeOrg.id}/tasks/${taskId}/responses`, { method: 'POST', body: { body: reply.trim() } });
      setReply('');
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setPosting(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>;

  if (error && !task) {
    return (
      <div>
        <p className="text-sm text-red-600 mb-4">{error}</p>
        <Link to="/dashboard/tasks" className="text-sm text-indigo-600 hover:underline">Back to tasks</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <Link to="/dashboard/tasks" className="text-sm text-indigo-600 hover:underline mb-4 inline-block">
        ← Back to tasks
      </Link>

      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="text-lg font-semibold text-slate-900">{task.title}</h1>
          <select
            value={task.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="text-sm border border-slate-300 rounded-lg px-2 py-1"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
        </div>

        {task.description && <p className="text-sm text-slate-600 mb-3">{task.description}</p>}
        {task.due_date && (
          <p className="text-xs text-slate-400 mb-3">Due {new Date(task.due_date).toLocaleDateString()}</p>
        )}

        <div className="flex flex-wrap gap-1">
          {assignees.map((a) => (
            <span key={a.id} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              {a.email}
            </span>
          ))}
        </div>
      </div>

      <h2 className="text-sm font-medium text-slate-900 mb-3">Responses</h2>
      <div className="space-y-3 mb-4">
        {responses.length === 0 ? (
          <p className="text-sm text-slate-400">No responses yet.</p>
        ) : (
          responses.map((r) => (
            <div key={r.id} className="bg-white border border-slate-200 rounded-lg p-3">
              <p className="text-sm text-slate-800">{r.body}</p>
              <p className="text-xs text-slate-400 mt-1">
                {r.author_email} · {new Date(r.created_at).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleReply} className="flex gap-2">
        <input
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Write a response…"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={posting}
          className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {posting ? '…' : 'Send'}
        </button>
      </form>
    </div>
  );
}