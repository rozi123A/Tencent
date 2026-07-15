/**
 * Security fix: userSig is no longer generated in the browser with the
 * SDKSecretKey (that key must never reach client code — see /server).
 * Instead we call the backend signing server, which is the only place
 * that holds the secret.
 */

// Auto-detect server URL: use the provided env var, or fallback to current origin (for unified deployment)
const USER_SIG_SERVER_URL = import.meta.env.VITE_USER_SIG_SERVER_URL || window.location.origin;

export async function fetchUserSig({
  userId,
  strRoomId,
  pin,
}: {
  userId: string;
  // Optional room PIN check (see /server). Only the main "join by room ID"
  // flow sends these -- invite links intentionally skip the PIN, since a
  // signed invite link is already a stronger proof of access than a PIN.
  strRoomId?: string;
  pin?: string;
}): Promise<{ sdkAppId: number; userSig: string }> {
  const targetUrl = `${USER_SIG_SERVER_URL.replace(/\/$/, '')}/api/user-sig`;
  console.log('Fetching userSig from:', targetUrl);
  
  try {
    const resp = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, strRoomId, pin }),
    });

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.error || `Server error ${resp.status} at ${targetUrl}`);
    }

    return await resp.json();
  } catch (err: any) {
    console.error('fetchUserSig error:', err);
    throw new Error(`Failed to reach userSig server: ${err.message}`);
  }
}
