/**
 * Client for the admin dashboard API (see server/index.js `/api/admin/*`).
 * Every protected call sends the admin password as a header; the server
 * checks it per-request (no session/cookie -- simple by design since this
 * is a single-admin demo, not a multi-user auth system).
 */

const SERVER_URL = import.meta.env.VITE_USER_SIG_SERVER_URL || window.location.origin;
const BASE = `${SERVER_URL.replace(/\/$/, '')}/api`;

async function request(path: string, opts: { method?: string; password?: string; body?: object } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.password) headers['x-admin-password'] = opts.password;

  const resp = await fetch(`${BASE}${path}`, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || `خطأ في الخادم (${resp.status})`);
  return data;
}

export interface AdminRoom {
  roomId: string;
  hasPin: boolean;
  joinCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface AdminStats {
  totalRooms: number;
  protectedRooms: number;
  totalSignRequests: number;
  uptimeSeconds: number;
  maxParticipants: number;
}

export const adminApi = {
  login: (password: string) => request('/admin/login', { method: 'POST', body: { password } }),
  getRooms: (password: string): Promise<{ rooms: AdminRoom[] }> => request('/admin/rooms', { password }),
  resetPin: (password: string, roomId: string) =>
    request(`/admin/rooms/${encodeURIComponent(roomId)}/reset-pin`, { method: 'POST', password }),
  deleteRoom: (password: string, roomId: string) =>
    request(`/admin/rooms/${encodeURIComponent(roomId)}`, { method: 'DELETE', password }),
  getStats: (password: string): Promise<AdminStats> => request('/admin/stats', { password }),
  getSettings: (password: string): Promise<{ maxParticipants: number }> => request('/admin/settings', { password }),
  updateSettings: (password: string, maxParticipants: number) =>
    request('/admin/settings', { method: 'POST', password, body: { maxParticipants } }),
};

export async function getPublicSettings(): Promise<{ maxParticipants: number }> {
  const resp = await fetch(`${BASE}/settings`);
  if (!resp.ok) throw new Error('failed to load settings');
  return resp.json();
}
