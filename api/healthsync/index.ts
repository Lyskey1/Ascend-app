import type { VercelRequest, VercelResponse } from '../_lib/vercel.js';
import { put } from '@vercel/blob';
import { validateHealthSyncPayload, HEALTHSYNC_BLOB_PATHNAME } from '../_lib/validate.js';

// POST /api/healthsync — relay endpoint for the daily iOS Shortcut.
// Stores the single "latest payload" in Vercel Blob, overwritten each time.
//
// Every import above stays inside api/ (or is the @vercel/blob dependency,
// which Vercel installs into the function). Nothing reaches into src/ —
// Vercel bundles only api/, so such an import throws ERR_MODULE_NOT_FOUND
// at runtime even though it compiles cleanly.
async function post(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expected = process.env.HEALTHSYNC_TOKEN;
  if (!expected) {
    return res.status(503).json({ error: 'HEALTHSYNC_TOKEN is not configured on the server.' });
  }
  if (req.headers['x-sync-token'] !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let body: unknown = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }
  const payload = validateHealthSyncPayload(body);
  if (!payload) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({
      error:
        'Blob store is not provisioned (BLOB_READ_WRITE_TOKEN missing). Create a Vercel Blob store for this project.',
    });
  }

  await put(
    HEALTHSYNC_BLOB_PATHNAME,
    JSON.stringify({ ...payload, receivedAt: new Date().toISOString() }),
    {
      // The store is configured with private access; 'public' (the SDK
      // default) is rejected outright. Privacy costs nothing here: the
      // payload reaches the PWA through our own GET endpoint, which reads
      // the blob server-side with BLOB_READ_WRITE_TOKEN, so the client
      // never needs Blob credentials or a public URL.
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
      cacheControlMaxAge: 60, // minimum allowed; the GET reads with useCache: false anyway
    },
  );

  return res.status(200).json({ ok: true });
}

// Any unexpected throw becomes a short JSON 500 rather than an opaque
// crash, so failures are visible from curl instead of only in the logs.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return await post(req, res);
  } catch (err) {
    console.error('[healthsync] POST failed:', err);
    if (res.headersSent) return;
    return res
      .status(500)
      .json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
}
