/**
 * Where the studio's AI comes from. The site talks to /api/effect, the artifact to the
 * `sample` runtime capability. Both expose the same `call`, so the same agent pipeline runs.
 */
import type { SyntaxCheck } from '@/lib/effect/agent/html';
import type { CallFn } from '@/lib/effect/agent/types';

export type CatalogModel = {
  id: string;
  name: string;
  provider: string;
  context?: number;
  /** USD per million tokens. */
  prompt?: number;
  completion?: number;
};

export type EngineStatus =
  | { state: 'checking' }
  | { state: 'ready'; effect: boolean; openrouter: boolean }
  | { state: 'no-key'; env: string[] }
  | { state: 'no-sample' }
  | { state: 'denied' };

export type SaveResult = 'saved' | 'declined' | 'unavailable';

export interface Engine {
  surface: 'site' | 'artifact';
  status(): Promise<EngineStatus>;
  call: CallFn;
  /** OpenRouter catalog (site only). */
  catalog?(): Promise<CatalogModel[]>;
  /** Offers a file to the viewer. Absent: the studio uses a blob link. */
  save?(filename: string, data: string): Promise<SaveResult>;
  /** Opens the host's permission settings (artifact). */
  manage?(): Promise<void>;
  syntax?: SyntaxCheck | null;
}
