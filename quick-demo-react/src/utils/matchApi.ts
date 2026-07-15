/**
 * Client for the random-matchmaking API (see server/index.js `/api/match/*`).
 * Lets someone find a random available partner and start talking without
 * typing/sharing a room number or PIN.
 */

const SERVER_URL = import.meta.env.VITE_USER_SIG_SERVER_URL || window.location.origin;
const BASE = `${SERVER_URL.replace(/\/$/, '')}/api/match`;

export interface MatchResult {
  matched: boolean;
  waiting?: boolean;
  roomId?: string;
  partnerId?: string;
}

async function request(path: string, opts: { method?: string; body?: object } = {}): Promise<MatchResult> {
  const resp = await fetch(`${BASE}${path}`, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || `خطأ في الخادم (${resp.status})`);
  return data;
}

export const matchApi = {
  join: (userId: string) => request('/join', { method: 'POST', body: { userId } }),
  status: (userId: string) => request(`/status/${encodeURIComponent(userId)}`),
  cancel: (userId: string) => request('/cancel', { method: 'POST', body: { userId } }),
};
