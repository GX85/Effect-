/**
 * Types shared by the Effect agent pipeline, the studio UI (site and artifact) and the
 * serverless endpoint. No DOM, no network: everything here runs in a browser and in Node.
 */

/** What the project is. Decided by the router from the user's words. */
export type Kind = 'website' | 'landing' | 'presentation' | 'game' | 'app' | 'dashboard' | 'other';
/** What the message asks for. */
export type Intent = 'new' | 'edit' | 'question';
/** Effect's own models. On the site they run on Anthropic, in the artifact on `sample` tiers. */
export type ModelId = 'astrolabe' | 'compass' | 'spyglass';
/** Effort picked in the composer. `auto` lets the router decide. */
export type EffortId = 'auto' | 'quick' | 'thoughtful' | 'deep' | 'ultra';
/** Effort sent to a provider. `max` is only used on the site (Ultra); the artifact caps it at `high`. */
export type Level = 'low' | 'medium' | 'high' | 'max';

/** Agent roles. Each role has its own prompt in prompts.ts. */
export type Role = 'router' | 'architect' | 'designer' | 'developer' | 'tester' | 'reviewer' | 'answer';

export type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

export type Usage = { input: number; output: number };

export type CallOpts = {
  role: Role;
  effort: Level;
  signal?: AbortSignal;
  /** Called with the WHOLE answer so far, a few times a second at most. */
  onText?: (whole: string) => void;
  maxTokens?: number;
  /** The structured context the messages were built from (the site sends this instead of raw prompts). */
  ctx?: StepContext;
};

export type CallResult = {
  text: string;
  truncated: boolean;
  usage?: Usage;
  /** Model that actually answered, as reported by the provider. */
  model?: string;
};

/**
 * The only way the pipeline talks to a model. `model` is a model reference string:
 * "astrolabe" | "compass" | "spyglass" or "or:<vendor>/<model>" for OpenRouter.
 */
export type CallFn = (model: string, messages: Msg[], opts: CallOpts) => Promise<CallResult>;

/** A failure a transport reports. `code` drives what the studio shows. */
export class AgentError extends Error {
  code: string;
  partial?: string;
  constructor(code: string, message: string, partial?: string) {
    super(message);
    this.name = 'AgentError';
    this.code = code;
    this.partial = partial;
  }
}

/** One planned pipeline step. */
export type StepPlan = { id: string; role: Role; title: string; model: string; effort: Level };

export type Route = {
  intent: Intent;
  kind: Kind;
  complexity: 1 | 2 | 3;
  confidence: number;
  /** Effort after resolving "Авто". */
  effort: Exclude<EffortId, 'auto'>;
  steps: StepPlan[];
  /** One line for the user, e.g. "Новая игра · Effect Astrolabe · Глубоко". */
  reason: string;
  /** How many fix rounds the tester may trigger. */
  fixRounds: number;
  /** True when the router asked a model (low confidence). */
  llm?: boolean;
};

/** What the user picked in the composer. Empty / "auto" means Effect decides. */
export type Choice = { model?: string; effort?: EffortId };

/** Architect output. Loose on purpose: models fill what fits the project. */
export type Spec = {
  name?: string;
  kind?: Kind;
  language?: string;
  summary?: string;
  audience?: string;
  goal?: string;
  tone?: string;
  pages?: { id?: string; title?: string; sections?: { type?: string; content?: string }[] }[];
  features?: string[];
  interactions?: string[];
  data?: string[];
  game?: Record<string, unknown>;
  acceptance?: string[];
  [key: string]: unknown;
};

/** Designer output. */
export type Design = {
  direction?: string;
  rationale?: string;
  palette?: Record<string, string>;
  dark?: Record<string, string>;
  type?: { display?: string; text?: string; mono?: string; scale?: string; [k: string]: unknown };
  spacing?: Record<string, unknown>;
  radius?: Record<string, unknown>;
  motion?: Record<string, unknown>;
  components?: unknown[];
  [key: string]: unknown;
};

export type Issue = { severity: 'critical' | 'major' | 'minor'; area?: string; problem: string; fix?: string };

/** Tester / reviewer output. */
export type Report = { verdict: 'pass' | 'fix'; summary: string; issues: Issue[] };

/** Static check result (no model needed). */
export type Check = { id: string; ok: boolean; severity: Issue['severity']; message: string };

/** What a step's prompt is built from. Sent to the site API, which rebuilds the prompt itself. */
export type StepContext = {
  request: string;
  kind: Kind;
  intent: Intent;
  html?: string;
  spec?: Spec | null;
  design?: Design | null;
  report?: Report | null;
  checks?: Check[];
  /** Recent conversation, oldest first (short). */
  history?: { role: 'user' | 'assistant'; text: string }[];
  projectName?: string;
  /** Ultra: one extra review round. */
  ultra?: boolean;
  /** Fix round number (1-based) for developer fix steps. */
  round?: number;
};

export type StepStatus = 'pending' | 'running' | 'done' | 'skipped' | 'error';

export type AgentEvent =
  | { type: 'route'; route: Route }
  | { type: 'step'; id: string; role: Role; status: 'start'; title: string; model: string; at: number }
  | { type: 'step'; id: string; status: 'done'; ms: number; summary: string; output?: string }
  | { type: 'step'; id: string; status: 'skipped'; reason: string }
  | { type: 'step'; id: string; status: 'error'; message: string }
  | { type: 'text'; id: string; delta: string }
  | { type: 'progress'; id: string; chars: number; note?: string }
  | { type: 'html'; html: string; final: boolean }
  | {
      type: 'done';
      intent: Intent;
      kind: Kind;
      html?: string;
      reply: string;
      name?: string;
      spec?: Spec | null;
      design?: Design | null;
      report?: Report | null;
      usage?: Usage;
    }
  | { type: 'error'; code: string; message: string };

/** Minimal project view the pipeline needs. */
export type ProjectInput = {
  name: string;
  kind: Kind;
  html: string;
  spec?: Spec | null;
  design?: Design | null;
  history?: { role: 'user' | 'assistant'; text: string }[];
};
