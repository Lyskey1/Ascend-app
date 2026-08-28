import type { VercelRequest, VercelResponse } from '../_lib/vercel.js';
import { get } from '@vercel/blob';
import { HEALTHSYNC_BLOB_PATHNAME } from '../_lib/validate.js';

// GET /api/healthsync/latest — the PWA polls this on boot.
// No token required from the caller: the data is non-sensitive daily
// fitness numbers, and this endpoint is the only reader of the blob.
async function get_(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store');

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({
      error:
        'Blob store is not provisioned (BLOB_READ_WRITE_TOKEN missing). Create a Vercel Blob store for this project.',
    });
  }

  // Read the blob server-side. The store is private, so there is no public
  // URL to fetch — get() authenticates with BLOB_READ_WRITE_TOKEN and
  // streams the content back to us. That keeps the credential on the
  // server: the PWA only ever talks to this endpoint.
  // useCache: false reads from origin, so a POST is visible immediately
  // instead of waiting out the blob's own cache TTL.
  const result = await get(HEALTHSYNC_BLOB_PATHNAME, {
    access: 'private',
    useCache: false,
  });

  // null = nothing POSTed yet. A normal empty state, not an error.
  if (!result) return res.status(200).json({ payload: null });

  // 304 needs an ifNoneMatch, which we never send, so a missing stream
  // here means something unexpected rather than "not modified".
  if (result.statusCode !== 200 || !result.stream) {
    return res.status(200).json({ payload: null });
  }

  const payload: unknown = await new Response(result.stream).json();
  return res.status(200).json({ payload });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return await get_(req, res);
  } catch (err) {
    console.error('[healthsync] GET failed:', err);
    if (res.headersSent) return;
    return res
      .status(500)
      .json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
}
