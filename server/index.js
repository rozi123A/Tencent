/**
 * Minimal userSig signing server for TRTC demos.
 *
 * WHY THIS EXISTS (security fix):
 * The original demos generated `userSig` in the browser using the SDKSecretKey.
 * That key is a full-privilege server secret — anyone opening devtools could read
 * it and forge valid signatures for any user/room. This server keeps the secret
 * on the backend only; the browser calls /api/user-sig and gets back a signed
 * token, never the key itself.
 *
 * Configure via environment variables (never hardcode the secret):
 *   TENCENT_SDK_APP_ID     - your numeric SDKAppID (not secret)
 *   TENCENT_SDK_SECRET_KEY - your SDKSecretKey (SECRET - keep out of git/client)
 *   PORT                   - port to listen on (default 3001)
 *   ALLOWED_ORIGIN         - origin allowed to call this API (default *)
 */
const express = require('express');
const cors = require('cors');
const TLSSigAPIv2 = require('tls-sig-api-v2');

// Enhanced debug logging
console.log('--- SYSTEM DEBUG START ---');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PWD:', process.cwd());

const rawAppId = process.env.TENCENT_SDK_APP_ID || process.env.VITE_SDK_APP_ID;
const SDK_APP_ID = Number(rawAppId);
const SDK_SECRET_KEY = process.env.TENCENT_SDK_SECRET_KEY;
const PORT = Number(process.env.PORT) || 3001;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const SIG_EXPIRE_SECONDS = 24 * 60 * 60;

console.log('--- Environment Check ---');
console.log('Raw App ID from env:', rawAppId);
console.log('Parsed SDK_APP_ID:', SDK_APP_ID);
console.log('SDK_SECRET_KEY exists (length):', SDK_SECRET_KEY ? SDK_SECRET_KEY.length : 0);

if (!SDK_APP_ID || !SDK_SECRET_KEY) {
  console.error('CRITICAL: Missing credentials! Generating userSig will fail.');
}

const path = require('path');
const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json());

// Serve static files from the quick-demo-react/dist directory (React build)
const distPath = path.resolve(__dirname, '..', 'quick-demo-react', 'dist');
console.log(`Serving static files from: ${distPath}`);
app.use(express.static(distPath));

// Fallback to index.html for React Router
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  const indexPath = path.join(distPath, 'index.html');
  res.sendFile(indexPath);
});

function isValidUserId(userId) {
  return typeof userId === 'string' && userId.length > 0 && userId.length <= 64 && /^[\w-]+$/.test(userId);
}

// In-memory optional room PIN protection. Not persisted (acceptable for a
// demo: a Render restart wipes it anyway), and only enforced for the main
// "join by room ID" flow -- fetchUserSig() on the client skips it for invite
// links, since a signed invite link is already a stronger proof of access.
// The first person to submit a non-empty pin for a given room "sets" it;
// everyone after that must send the same pin.
const roomPins = new Map(); // strRoomId -> { pin, updatedAt }
const ROOM_PIN_TTL_MS = 24 * 60 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [roomId, info] of roomPins) {
    if (now - info.updatedAt > ROOM_PIN_TTL_MS) roomPins.delete(roomId);
  }
}, 60 * 60 * 1000).unref?.();

app.post('/api/user-sig', (req, res) => {
  console.log(`Received user-sig request for userId: ${req.body?.userId}`);
  const { userId, strRoomId, pin } = req.body || {};

  if (!isValidUserId(userId)) {
    console.log(`Invalid userId: ${userId}`);
    return res.status(400).json({ error: 'A valid userId is required.' });
  }

  if (typeof strRoomId === 'string' && strRoomId) {
    const providedPin = typeof pin === 'string' ? pin.trim() : '';
    const existing = roomPins.get(strRoomId);
    if (existing) {
      if (providedPin !== existing.pin) {
        console.log(`PIN mismatch for room ${strRoomId}`);
        return res.status(403).json({ error: 'رمز الغرفة (PIN) غير صحيح.' });
      }
      existing.updatedAt = Date.now();
    } else if (providedPin) {
      roomPins.set(strRoomId, { pin: providedPin, updatedAt: Date.now() });
      console.log(`Room ${strRoomId} is now PIN-protected`);
    }
  }

  try {
    const api = new TLSSigAPIv2.Api(SDK_APP_ID, SDK_SECRET_KEY);
    const userSig = api.genUserSig(userId, SIG_EXPIRE_SECONDS);
    console.log(`Successfully generated userSig for ${userId}`);
    return res.json({ sdkAppId: SDK_APP_ID, userSig });
  } catch (err) {
    console.error('Failed to generate userSig:', err);
    return res.status(500).json({ error: 'Internal server error while generating signature.' });
  }
});

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`userSig server listening on port ${PORT}`);
});
