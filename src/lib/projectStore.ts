import type { AnalysisState } from "@/types/analysisState";

export interface SavedProjectMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedProject extends SavedProjectMeta {
  state: AnalysisState;
}

const STORAGE_KEY = "aerowind.projects.v1";

function readAll(): SavedProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SavedProject[];
  } catch {
    return [];
  }
}

function writeAll(projects: SavedProject[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function listProjects(): SavedProjectMeta[] {
  return readAll()
    .map(({ state: _s, ...meta }) => meta)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function loadProject(id: string): SavedProject | null {
  return readAll().find((p) => p.id === id) ?? null;
}

export function saveProject(name: string, state: AnalysisState, existingId?: string): SavedProjectMeta {
  const now = new Date().toISOString();
  const projects = readAll();
  const id = existingId ?? crypto.randomUUID();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx >= 0) {
    projects[idx] = { ...projects[idx], name, updatedAt: now, state };
  } else {
    projects.unshift({ id, name, createdAt: now, updatedAt: now, state });
  }
  writeAll(projects);
  return { id, name, createdAt: idx >= 0 ? projects[idx].createdAt : now, updatedAt: now };
}

export function renameProject(id: string, name: string) {
  const projects = readAll();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx < 0) return;
  projects[idx] = { ...projects[idx], name, updatedAt: new Date().toISOString() };
  writeAll(projects);
}

export function deleteProject(id: string) {
  const projects = readAll().filter((p) => p.id !== id);
  writeAll(projects);
}

