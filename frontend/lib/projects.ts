export type ProjectRecord = {
  id: string;
  title: string;
  file_name: string;
  size: number;
  duration: number;
  language: string;
  style: string;
  settings_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  media_available: boolean;
};

export type ApiCue = { idx?: number; start: number; end: number; text: string; linked?: boolean; words?: { text: string; start: number; end: number }[]; words_json?: { text: string; start: number; end: number }[] };

export const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${backendUrl}${path}`, init);
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try { const payload = await response.json(); message = payload.detail || message; } catch { /* use status text */ }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export function uploadProject(file: File, language: string, style: string) {
  const body = new FormData();
  body.append('file', file, file.name);
  body.append('language', language);
  body.append('style', style);
  return apiRequest<ProjectRecord>('/projects', { method: 'POST', body });
}

export function fetchProject(id: string) { return apiRequest<ProjectRecord>(`/projects/${encodeURIComponent(id)}`); }
export function fetchProjects() { return apiRequest<ProjectRecord[]>('/projects'); }
export function deleteProject(id: string) { return apiRequest<{ deleted: boolean }>(`/projects/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
export function patchProject(id: string, patch: Partial<Pick<ProjectRecord, 'language' | 'style' | 'title' | 'duration' | 'settings_json'>>) {
  return apiRequest<ProjectRecord>(`/projects/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
}
export function fetchProjectCues(id: string) { return apiRequest<ApiCue[]>(`/projects/${encodeURIComponent(id)}/cues`); }
export function saveProjectCues(id: string, cues: ApiCue[]) {
  return apiRequest<{ saved: number }>(`/projects/${encodeURIComponent(id)}/cues`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cues.map((cue, idx) => ({ ...cue, idx, words_json: cue.words || cue.words_json || [] }))) });
}
