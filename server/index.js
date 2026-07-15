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

// Admin dashboard password. Set ADMIN_PASSWORD in Render's environment
// variables for real deployments -- this fallback only exists so the panel
// still works out of the box in local/dev testing.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
if (!process.env.ADMIN_PASSWORD) {
  console.warn('WARNING: ADMIN_PASSWORD not set, using insecure default. Set it in your environment for production.');
}

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
//
// Also doubles as the activity table the admin dashboard reads from: every
// room that has ever requested a userSig gets an entry here (pin is null if
// never protected), so the dashboard can show "which rooms are active" even
// for unprotected rooms.
const roomPins = new Map(); // strRoomId -> { pin: string|null, updatedAt, createdAt, joinCount }
const ROOM_PIN_TTL_MS = 24 * 60 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [roomId, info] of roomPins) {
    if (now - info.updatedAt > ROOM_PIN_TTL_MS) roomPins.delete(roomId);
  }
}, 60 * 60 * 1000).unref?.();

// Server-side settings the admin dashboard can tune at runtime. The client
// reads maxParticipants via GET /api/settings so a change here takes effect
// for new joins without redeploying.
const settings = {
  maxParticipants: Number(process.env.MAX_PARTICIPANTS) || 10,
};

let totalSignRequests = 0;
const serverStartedAt = Date.now();

function requireAdmin(req, res, next) {
  const provided = req.headers['x-admin-password'];
  if (provided !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'كلمة مرور الأدمن غير صحيحة.' });
  }
  next();
}

app.post('/api/user-sig', (req, res) => {
  console.log(`Received user-sig request for userId: ${req.body?.userId}`);
  const { userId, strRoomId, pin } = req.body || {};

  if (!isValidUserId(userId)) {
    console.log(`Invalid userId: ${userId}`);
    return res.status(400).json({ error: 'A valid userId is required.' });
  }

  totalSignRequests += 1;

  if (typeof strRoomId === 'string' && strRoomId) {
    const providedPin = typeof pin === 'string' ? pin.trim() : '';
    const existing = roomPins.get(strRoomId);
    if (existing) {
      if (existing.pin && providedPin !== existing.pin) {
        console.log(`PIN mismatch for room ${strRoomId}`);
        return res.status(403).json({ error: 'رمز الغرفة (PIN) غير صحيح.' });
      }
      existing.updatedAt = Date.now();
      existing.joinCount += 1;
    } else {
      roomPins.set(strRoomId, {
        pin: providedPin || null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        joinCount: 1,
      });
      if (providedPin) console.log(`Room ${strRoomId} is now PIN-protected`);
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

// Public: current tunable settings the client needs (e.g. max participants).
app.get('/api/settings', (_req, res) => {
  res.json({ maxParticipants: settings.maxParticipants });
});

// --- Admin dashboard API ------------------------------------------------

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'كلمة المرور غير صحيحة.' });
  }
  res.json({ ok: true });
});

app.get('/api/admin/rooms', requireAdmin, (_req, res) => {
  const rooms = Array.from(roomPins.entries()).map(([roomId, info]) => ({
    roomId,
    hasPin: !!info.pin,
    joinCount: info.joinCount,
    createdAt: info.createdAt,
    updatedAt: info.updatedAt,
  }));
  rooms.sort((a, b) => b.updatedAt - a.updatedAt);
  res.json({ rooms });
});

app.post('/api/admin/rooms/:roomId/reset-pin', requireAdmin, (req, res) => {
  const { roomId } = req.params;
  const existing = roomPins.get(roomId);
  if (!existing) {
    return res.status(404).json({ error: 'الغرفة غير موجودة.' });
  }
  existing.pin = null;
  res.json({ ok: true });
});

app.delete('/api/admin/rooms/:roomId', requireAdmin, (req, res) => {
  const { roomId } = req.params;
  const deleted = roomPins.delete(roomId);
  if (!deleted) {
    return res.status(404).json({ error: 'الغرفة غير موجودة.' });
  }
  res.json({ ok: true });
});

app.get('/api/admin/settings', requireAdmin, (_req, res) => {
  res.json({ maxParticipants: settings.maxParticipants });
});

app.post('/api/admin/settings', requireAdmin, (req, res) => {
  const { maxParticipants } = req.body || {};
  const n = Number(maxParticipants);
  if (!Number.isInteger(n) || n < 2 || n > 100) {
    return res.status(400).json({ error: 'الحد الأقصى يجب أن يكون رقمًا بين 2 و 100.' });
  }
  settings.maxParticipants = n;
  res.json({ ok: true, maxParticipants: settings.maxParticipants });
});

app.get('/api/admin/stats', requireAdmin, (_req, res) => {
  const rooms = Array.from(roomPins.values());
  res.json({
    totalRooms: rooms.length,
    protectedRooms: rooms.filter((r) => r.pin).length,
    totalSignRequests,
    uptimeSeconds: Math.floor((Date.now() - serverStartedAt) / 1000),
    maxParticipants: settings.maxParticipants,
  });
});

// --- Random matchmaking ("talk to a random person, no room number / PIN") --
//
// Flow: a client posts /api/match/join with its userId. If someone else is
// already waiting, the two are paired immediately into a freshly generated
// room and both get the roomId back (the waiting one via /api/match/status
// polling, since their original request already returned "waiting"). If no
// one is waiting, the client is queued and must poll /api/match/status until
// paired or it cancels. This is plain HTTP polling (no websocket layer in
// this server), fine for a small demo's traffic.
const matchQueue = []; // { userId, joinedAt }
const matchResults = new Map(); // userId -> { roomId, partnerId, ts }
const MATCH_QUEUE_TTL_MS = 5 * 60 * 1000;
const MATCH_RESULT_TTL_MS = 60 * 1000;

function generateMatchRoomId() {
  return 'match_' + Math.random().toString(36).slice(2, 10);
}

setInterval(() => {
  const now = Date.now();
  for (let i = matchQueue.length - 1; i >= 0; i--) {
    if (now - matchQueue[i].joinedAt > MATCH_QUEUE_TTL_MS) matchQueue.splice(i, 1);
  }
  for (const [uid, r] of matchResults) {
    if (now - r.ts > MATCH_RESULT_TTL_MS) matchResults.delete(uid);
  }
}, 30 * 1000).unref?.();

app.post('/api/match/join', (req, res) => {
  const { userId } = req.body || {};
  if (!isValidUserId(userId)) {
    return res.status(400).json({ error: 'A valid userId is required.' });
  }

  // Clear any stale queue entry for this same userId (e.g. re-clicked).
  for (let i = matchQueue.length - 1; i >= 0; i--) {
    if (matchQueue[i].userId === userId) matchQueue.splice(i, 1);
  }
  matchResults.delete(userId);

  const partnerIndex = matchQueue.findIndex((entry) => entry.userId !== userId);
  if (partnerIndex !== -1) {
    const partner = matchQueue.splice(partnerIndex, 1)[0];
    const roomId = generateMatchRoomId();
    matchResults.set(partner.userId, { roomId, partnerId: userId, ts: Date.now() });
    console.log(`Matched ${userId} <-> ${partner.userId} in room ${roomId}`);
    return res.json({ matched: true, roomId, partnerId: partner.userId });
  }

  matchQueue.push({ userId, joinedAt: Date.now() });
  res.json({ matched: false, waiting: true });
});

app.get('/api/match/status/:userId', (req, res) => {
  const { userId } = req.params;
  const result = matchResults.get(userId);
  if (result) {
    matchResults.delete(userId);
    return res.json({ matched: true, roomId: result.roomId, partnerId: result.partnerId });
  }
  const stillWaiting = matchQueue.some((entry) => entry.userId === userId);
  res.json({ matched: false, waiting: stillWaiting });
});

app.post('/api/match/cancel', (req, res) => {
  const { userId } = req.body || {};
  for (let i = matchQueue.length - 1; i >= 0; i--) {
    if (matchQueue[i].userId === userId) matchQueue.splice(i, 1);
  }
  matchResults.delete(userId);
  res.json({ ok: true });
});

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`userSig server listening on port ${PORT}`);
});
