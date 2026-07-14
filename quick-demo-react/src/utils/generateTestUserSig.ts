/**
 * Security fix: userSig is no longer generated in the browser with the
 * SDKSecretKey (that key must never reach client code — see /server).
 * Instead we call the backend signing server, which is the only place
 * that holds the secret.
 */

const USER_SIG_SERVER_URL = import.meta.env.VITE_USER_SIG_SERVER_URL || 'http://localhost:3001';

export async function fetchUserSig({
  userId,
}: {
  userId: string;
}): Promise<{ sdkAppId: number; userSig: string }> {
  const resp = await fetch(`${USER_SIG_SERVER_URL.replace(/\/$/, '')}/api/user-sig`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.error || `userSig server responded with ${resp.status}`);
  }

  return resp.json();
}
