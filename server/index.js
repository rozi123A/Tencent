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

const SDK_APP_ID = Number(process.env.TENCENT_SDK_APP_ID);
const SDK_SECRET_KEY = process.env.TENCENT_SDK_SECRET_KEY;
const PORT = Number(process.env.PORT) || 3001;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const SIG_EXPIRE_SECONDS = 24 * 60 * 60; // 1 day; keep short-lived, not 7+ days

if (!SDK_APP_ID || !SDK_SECRET_KEY) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing TENCENT_SDK_APP_ID / TENCENT_SDK_SECRET_KEY environment variables. ' +
      'Set them as secrets, never commit them to the repo.'
  );
  process.exit(1);
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

app.post('/api/user-sig', (req, res) => {
  console.log(`Received user-sig request for userId: ${req.body?.userId}`);
  const { userId } = req.body || {};

  if (!isValidUserId(userId)) {
    console.log(`Invalid userId: ${userId}`);
    return res.status(400).json({ error: 'A valid userId is required.' });
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
