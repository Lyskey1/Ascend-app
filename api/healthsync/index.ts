import type { VercelRequest, VercelResponse } from '../_lib/vercel';
import { put } from '@vercel/blob';
import {
  validateHealthSyncPayload,
  HEALTHSYNC_BLOB_PATHNAME,
} from '../../src/services/healthSyncSchema';

// POST /api/healthsync — relay endpoint for the daily iOS Shortcut.
// Stores the single "latest payload" in Vercel Blob, overwritten each time.
export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    return res
      .status(503)
      .json({ error: 'Blob store is not provisioned (BLOB_READ_WRITE_TOKEN missing). Create a Vercel Blob store for this project.' });
  }

  try {
    await put(
      HEALTHSYNC_BLOB_PATHNAME,
      JSON.stringify({ ...payload, receivedAt: new Date().toISOString() }),
      {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
        cacheControlMaxAge: 60, // minimum allowed; GET busts the CDN cache anyway
      },
    );
  } catch (err) {
    return res.status(503).json({
      error: `Failed to store payload: ${err instanceof Error ? err.message : 'unknown error'}`,
    });
  }

  return res.status(200).json({ ok: true });
}
