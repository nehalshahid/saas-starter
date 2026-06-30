import { useOrg } from '../context/OrgContext';

export default function Overview() {
  const { activeOrg } = useOrg();

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900 mb-1">{activeOrg.name}</h1>
      <p className="text-sm text-slate-500 mb-6">
        You're signed in as <span className="font-medium capitalize">{activeOrg.role}</span> in this organization.
      </p>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase font-medium mb-1">Org slug</p>
          <p className="text-sm font-mono text-slate-800">{activeOrg.slug}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase font-medium mb-1">Your role</p>
          <p className="text-sm font-medium text-slate-800 capitalize">{activeOrg.role}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase font-medium mb-1">Org ID</p>
          <p className="text-xs font-mono text-slate-500 truncate">{activeOrg.id}</p>
        </div>
      </div>

      <p className="text-xs text-slate-400 mt-6">
        Use the sidebar to manage members, billing, and view the audit log.
      </p>
    </div>
  );
}
