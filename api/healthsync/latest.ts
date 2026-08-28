import type { VercelRequest, VercelResponse } from '../_lib/vercel';
import { head, BlobNotFoundError } from '@vercel/blob';
import { HEALTHSYNC_BLOB_PATHNAME } from '../../src/services/healthSyncSchema';

// GET /api/healthsync/latest — the PWA polls this on boot.
// No token required: the data is non-sensitive daily fitness numbers.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store');

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res
      .status(503)
      .json({ error: 'Blob store is not provisioned (BLOB_READ_WRITE_TOKEN missing). Create a Vercel Blob store for this project.' });
  }

  try {
    const meta = await head(HEALTHSYNC_BLOB_PATHNAME);
    // The blob URL is stable (no random suffix), so bust the CDN cache to
    // always serve the most recently POSTed payload.
    const blobRes = await fetch(`${meta.url}?v=${Date.now()}`, { cache: 'no-store' });
    if (!blobRes.ok) {
      return res.status(503).json({ error: `Failed to read stored payload (${blobRes.status}).` });
    }
    const payload: unknown = await blobRes.json();
    return res.status(200).json({ payload });
  } catch (err) {
    if (err instanceof BlobNotFoundError) {
      return res.status(200).json({ payload: null });
    }
    return res.status(503).json({
      error: `Failed to read stored payload: ${err instanceof Error ? err.message : 'unknown error'}`,
    });
  }
}
