import type { IncomingMessage, ServerResponse } from 'node:http';

// Minimal typings for Vercel's Node.js function signature, matching the
// request/response helpers the runtime injects. Kept local instead of
// depending on @vercel/node, which is only needed for its types.
// (Underscore-prefixed folders in api/ are not deployed as functions.)

export interface VercelRequest extends IncomingMessage {
  body?: unknown;
  query: Record<string, string | string[]>;
  cookies: Record<string, string>;
}

export interface VercelResponse extends ServerResponse {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => VercelResponse;
  send: (body: unknown) => VercelResponse;
}
