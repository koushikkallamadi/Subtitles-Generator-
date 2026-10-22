"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Trash2, FolderOpen } from 'lucide-react';
import { deleteProject, fetchProjects, ProjectRecord } from '../lib/projects';

function durationLabel(seconds: number) {
  const value = Math.max(0, Math.floor(seconds || 0));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

export default function HistoryDrawer({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { void fetchProjects().then(setProjects).catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load history.')); }, []);
  const remove = async (id: string) => {
    try { await deleteProject(id); setProjects((items) => items.filter((item) => item.id !== id)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not delete project.'); }
  };
  return <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="flex h-full w-full max-w-md flex-col border-l border-gray-700 bg-[#111621] shadow-2xl">
      <header className="flex h-14 items-center justify-between border-b border-gray-800 px-5"><h2 className="text-sm font-semibold text-white">History</h2><button onClick={onClose} aria-label="Close history" className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white"><X size={18} /></button></header>
      {error && <p role="alert" className="px-5 pt-4 text-sm text-red-300">{error}</p>}
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {projects.map((project) => <article key={project.id} className="rounded-xl border border-gray-800 bg-[#191e29] p-3">
          <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-medium text-white">{project.title}</p><p className="mt-1 text-xs text-gray-400">{new Date(project.updated_at).toLocaleDateString()} · {durationLabel(project.duration)} · {project.language}</p></div><button onClick={() => void remove(project.id)} aria-label={`Delete ${project.title}`} className="rounded-lg p-2 text-gray-500 hover:bg-red-950/50 hover:text-red-300"><Trash2 size={15} /></button></div>
          <button onClick={() => { onClose(); router.push(`/editor?project=${encodeURIComponent(project.id)}`); }} className="mt-3 flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-200 hover:bg-white/5"><FolderOpen size={14} />Open</button>
        </article>)}
        {!error && projects.length === 0 && <p className="py-8 text-center text-sm text-gray-500">No saved projects yet.</p>}
      </div>
    </aside>
  </div>;
}
