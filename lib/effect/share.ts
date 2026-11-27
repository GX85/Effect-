/**
 * Read-only share links (site only). The project's page is compressed with the browser's
 * CompressionStream (deflate-raw) and put into the URL hash, so nothing leaves the browser
 * until the person sends the link. Pages that do not fit return null.
 */
import { isKind } from './agent/models.ts';
import type { Kind } from './agent/types.ts';

export type Shared = { name: string; kind: Kind; html: string };

export const SHARE_PREFIX = '#share=';
/** Longest hash we hand out: long links break in messengers and some browsers. */
export const MAX_SHARE = 60_000;

const b64url = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

export const canShare = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

/** The hash for a project ("#share=…"), or null when it is too big or compression is missing. */
export async function encodeShare(p: Shared): Promise<string | null> {
  if (!canShare() || !p.html) return null;
  const json = JSON.stringify({ v: 1, n: p.name.slice(0, 80), k: p.kind, h: p.html });
  const packed = b64url(await pipe(new TextEncoder().encode(json), new CompressionStream('deflate-raw')));
  return packed.length > MAX_SHARE ? null : SHARE_PREFIX + packed;
}

/** Reads a share hash. Null for anything malformed. */
export async function decodeShare(hash: string): Promise<Shared | null> {
  if (!hash.startsWith(SHARE_PREFIX) || !canShare()) return null;
  const raw = hash.slice(SHARE_PREFIX.length);
  if (!raw || raw.length > MAX_SHARE || !/^[\w-]+$/.test(raw)) return null;
  try {
    const bytes = await pipe(fromB64url(raw), new DecompressionStream('deflate-raw'));
    if (bytes.length > 2_000_000) return null;
    const j = JSON.parse(new TextDecoder().decode(bytes)) as { v?: number; n?: unknown; k?: unknown; h?: unknown };
    if (j.v !== 1 || typeof j.h !== 'string' || !j.h) return null;
    return { name: typeof j.n === 'string' && j.n.trim() ? j.n.slice(0, 80) : 'Проект', kind: isKind(j.k) ? j.k : 'website', html: j.h };
  } catch {
    return null;
  }
}
