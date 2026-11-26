'use client';
/**
 * Effect Studio: projects, a conversation with the agent team and a live preview. The same
 * component runs on the site (engine = /api/effect) and inside the artifact (engine =
 * `sample`). It owns all state; children are presentational.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { runPipeline } from '@/lib/effect/agent/pipeline';
import { isEffort, modelName, parseModel } from '@/lib/effect/agent/models';
import type { AgentEvent, EffortId } from '@/lib/effect/agent/types';
import {
  amendHtml,
  applyEvent,
  commitHtml,
  duplicateProject,
  fileName,
  loadProjects,
  newId,
  newProject,
  previousVersion,
  projectInput,
  renameProject,
  restoreVersion,
  saveProjects,
  startRun,
  stopRun,
  type ChatMessage,
  type Project,
} from '@/lib/effect/project';
import type { CatalogModel, Engine, EngineStatus } from './engine';
import { Composer, Conversation, EmptyStart, Sidebar } from './parts';
import Stage, { type Device, type View } from './Stage';
import { EffectLogo, Icon } from '../ui';

type Running = { projectId: string; messageId: string; ctl: AbortController };
type Toast = { id: number; text: string; tone: 'ok' | 'err' };

const PREFS = 'effect.studio.prefs';

function readPrefs(): { model?: string; effort?: EffortId; device?: Device } {
  try {
    return JSON.parse(localStorage.getItem(PREFS) || '{}');
  } catch {
    return {};
  }
}

/** Runs a DOM-changing update inside a View Transition when the browser supports it. */
export function transition(fn: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!doc.startViewTransition || reduce) return fn();
  try {
    doc.startViewTransition(() => flushSync(fn));
  } catch {
    fn();
  }
}

export type StudioProps = {
  engine: Engine;
  /** Called by the logo button: back to the landing. */
  onExit?: () => void;
  /** Prompt to send as soon as the engine is ready (site: ?q=). */
  initialPrompt?: string;
  /** Site link for features that only work there (artifact). */
  siteUrl?: string;
};

export default function Studio({ engine, onExit, initialPrompt, siteUrl }: StudioProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [status, setStatus] = useState<EngineStatus>({ state: 'checking' });
  const [model, setModel] = useState('auto');
  const [effort, setEffort] = useState<EffortId>('auto');
  const [catalog, setCatalog] = useState<CatalogModel[]>([]);
  const [running, setRunning] = useState<Running | null>(null);
  const [live, setLive] = useState<{ projectId: string; html: string } | null>(null);
  const [view, setView] = useState<View>('preview');
  const [device, setDevice] = useState<Device>('desktop');
  const [pane, setPane] = useState<'chat' | 'stage'>('chat');
  const [sidebar, setSidebar] = useState(false);
  const [draft, setDraft] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [ready, setReady] = useState(false);
  const [queued, setQueued] = useState<string | null>(initialPrompt ?? null);
  const runRef = useRef<Running | null>(null);
  const projectsRef = useRef<Project[]>([]);
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  // Latest choice and engine for the async run (read when a message is sent).
  const live$ = useRef({ model, effort, engine });
  useEffect(() => {
    live$.current = { model, effort, engine };
  }, [model, effort, engine]);

  const current = useMemo(() => projects.find((p) => p.id === currentId) ?? null, [projects, currentId]);

  const flash = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  // Load projects, preferences and engine status.
  useEffect(() => {
    const list = loadProjects();
    const prefs = readPrefs();
    const params = new URLSearchParams(window.location.search);
    const pid = params.get('p');
    const timer = window.setTimeout(() => {
      setProjects(list);
      if (pid && list.some((p) => p.id === pid)) setCurrentId(pid);
      if (prefs.model && (prefs.model === 'auto' || parseModel(prefs.model))) setModel(prefs.model);
      if (isEffort(prefs.effort)) setEffort(prefs.effort);
      if (prefs.device) setDevice(prefs.device);
      setSidebar(window.matchMedia('(min-width: 1180px)').matches);
      setReady(true);
    }, 0);
    let alive = true;
    void engine.status().then((s) => {
      if (!alive) return;
      setStatus(s);
      if (s.state === 'ready' && s.openrouter && engine.catalog) void engine.catalog().then((c) => alive && setCatalog(c));
    });
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [engine]);

  // Persist (debounced) and on page hide.
  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => {
      if (!saveProjects(projects) && projects.length) flash('Не удалось сохранить: хранилище браузера недоступно', 'err');
    }, 500);
    return () => window.clearTimeout(t);
  }, [projects, ready, flash]);
  useEffect(() => {
    const onHide = () => saveProjects(projectsRef.current);
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(PREFS, JSON.stringify({ model, effort, device }));
    } catch {
      /* storage blocked */
    }
  }, [model, effort, device, ready]);

  const patch = useCallback((id: string, fn: (p: Project) => Project) => {
    setProjects((list) => list.map((p) => (p.id === id ? fn(p) : p)));
  }, []);

  const patchMessage = useCallback(
    (pid: string, mid: string, fn: (m: ChatMessage) => ChatMessage) =>
      patch(pid, (p) => ({ ...p, messages: p.messages.map((m) => (m.id === mid ? fn(m) : m)) })),
    [patch],
  );

  const select = useCallback((id: string | null) => {
    transition(() => {
      setCurrentId(id);
      setView('preview');
      if (window.matchMedia('(max-width: 1179px)').matches) setSidebar(false);
    });
    try {
      const url = new URL(window.location.href);
      if (url.pathname.includes('/effect/studio')) {
        if (id) url.searchParams.set('p', id);
        else url.searchParams.delete('p');
        url.searchParams.delete('q');
        history.replaceState(null, '', url.toString());
      }
    } catch {
      /* sandboxed history */
    }
  }, []);

  // ───────────── Agent run ─────────────
  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim().slice(0, 6000);
      if (!text || runRef.current) return;
      if (status.state === 'checking') {
        setQueued(text);
        setDraft('');
        flash('Подключаю Effect…');
        return;
      }
      if (status.state !== 'ready') {
        setDraft(text);
        flash(status.state === 'no-key' ? 'Сначала подключите ключ на сервере' : 'ИИ недоступен в этом окне', 'err');
        return;
      }
      setDraft('');
      const now = Date.now();
      const base = projectsRef.current.find((p) => p.id === currentId) ?? null;
      let targetId = base?.id ?? '';
      const user: ChatMessage = { id: newId(), role: 'user', text, at: now };
      const reply: ChatMessage = { id: newId(), role: 'assistant', text: '', at: now, run: startRun(now) };
      if (!base) {
        const p = { ...newProject(now), messages: [user, reply] };
        targetId = p.id;
        setProjects((list) => [p, ...list]);
        select(p.id);
      } else {
        patch(base.id, (p) => ({ ...p, messages: [...p.messages, user, reply], updated: now }));
      }
      const ctl = new AbortController();
      const run: Running = { projectId: targetId, messageId: reply.id, ctl };
      runRef.current = run;
      setRunning(run);
      const input = projectInput(base);
      const toReply = (fn: (m: ChatMessage) => ChatMessage) =>
        patch(targetId, (p) => ({ ...p, messages: p.messages.map((m) => (m.id === reply.id ? fn(m) : m)) }));

      const onEvent = (e: AgentEvent) => {
        if (e.type === 'route' && e.route.intent === 'new' && base && base.html) {
          // A new project: move this exchange out of the open project.
          const fresh = { ...newProject(Date.now()), kind: e.route.kind };
          const oldId = targetId;
          setProjects((list) => {
            const old = list.find((p) => p.id === oldId);
            const moved = old ? old.messages.filter((m) => m.id === user.id || m.id === reply.id) : [user, reply];
            return [
              { ...fresh, messages: moved },
              ...list.map((p) => (p.id === oldId ? { ...p, messages: p.messages.filter((m) => m.id !== user.id && m.id !== reply.id) } : p)),
            ];
          });
          targetId = fresh.id;
          run.projectId = fresh.id;
          setRunning({ ...run });
          select(fresh.id);
        } else if (e.type === 'route' && e.route.intent === 'new') {
          patch(targetId, (p) => ({ ...p, kind: e.route.kind }));
        }
        if (e.type === 'html') {
          setLive({ projectId: targetId, html: e.html });
          return;
        }
        if (e.type === 'text' || e.type === 'progress' || e.type === 'step' || e.type === 'route') {
          toReply((m) => ({ ...m, run: m.run ? applyEvent(m.run, e) : m.run }));
          return;
        }
        if (e.type === 'done') {
          const at = Date.now();
          patch(targetId, (p) => {
            let next: Project = {
              ...p,
              messages: p.messages.map((m) => (m.id === reply.id ? { ...m, text: e.reply, at, run: m.run ? applyEvent(m.run, e, at) : m.run } : m)),
              updated: at,
            };
            if (e.html) {
              const label = (e.intent === 'new' ? 'Создано: ' : 'Правка: ') + '«' + text.slice(0, 60) + (text.length > 60 ? '…' : '') + '»';
              next = commitHtml(next, e.html, label, 'agent', at);
              const vid = next.versions.at(-1)?.id;
              next = {
                ...next,
                kind: e.kind,
                spec: e.intent === 'new' ? (e.spec ?? null) : (p.spec ?? e.spec ?? null),
                design: e.intent === 'new' ? (e.design ?? null) : (p.design ?? e.design ?? null),
                name: p.name === 'Новый проект' || e.intent === 'new' ? e.name || p.name : p.name,
                messages: next.messages.map((m) => (m.id === reply.id ? { ...m, versionId: vid } : m)),
              };
            }
            return next;
          });
          return;
        }
        if (e.type === 'error') {
          const at = Date.now();
          toReply((m) => ({
            ...m,
            at,
            text: e.code === 'cancelled' ? 'Остановлено.' : e.message,
            error: e.code === 'cancelled' ? undefined : { code: e.code, message: e.message },
            retry: e.code === 'cancelled' || e.code === 'not_granted' ? undefined : text,
            run: m.run ? applyEvent(m.run, e, at) : m.run,
          }));
          if (e.code === 'not_granted' || e.code === 'sampling_disabled') setStatus({ state: 'denied' });
        }
      };

      const cur = live$.current;
      try {
        await runPipeline({
          request: text,
          project: input,
          choice: { model: cur.model === 'auto' ? undefined : cur.model, effort: cur.effort },
          call: cur.engine.call,
          onEvent,
          signal: ctl.signal,
          syntax: cur.engine.syntax ?? null,
        });
      } finally {
        runRef.current = null;
        setRunning(null);
        setLive(null);
      }
    },
    [status, currentId, patch, select, flash],
  );

  const stop = useCallback(() => {
    const r = runRef.current;
    if (!r) return;
    r.ctl.abort();
    patchMessage(r.projectId, r.messageId, (m) => (m.run && m.run.status === 'running' ? { ...m, run: stopRun(m.run) } : m));
  }, [patchMessage]);

  useEffect(() => {
    if (!initialPrompt) return;
    const t = window.setTimeout(() => setQueued(initialPrompt), 0);
    return () => window.clearTimeout(t);
  }, [initialPrompt]);

  // Send a queued prompt (landing / ?q=) once the engine is ready.
  useEffect(() => {
    if (!ready || !queued || status.state === 'checking' || running) return;
    const t = window.setTimeout(() => {
      setQueued(null);
      if (status.state === 'ready') void send(queued);
      else setDraft(queued);
    }, 0);
    return () => window.clearTimeout(t);
  }, [ready, queued, status, running, send]);

  // Prompts from the landing (artifact): `effect:prompt` events.
  useEffect(() => {
    const onPrompt = (e: Event) => {
      const d = (e as CustomEvent<{ text?: string; send?: boolean }>).detail;
      if (!d?.text) return;
      if (d.send) {
        if (!runRef.current) select(null);
        setQueued(d.text);
      } else setDraft(d.text);
    };
    window.addEventListener('effect:prompt', onPrompt);
    return () => window.removeEventListener('effect:prompt', onPrompt);
  }, [select]);

  // ───────────── Project actions ─────────────
  const createNew = useCallback(() => {
    if (runRef.current) return flash('Дождитесь окончания работы агентов', 'err');
    select(null);
    window.setTimeout(() => composerRef.current?.focus(), 50);
  }, [select, flash]);

  const remove = useCallback(
    (id: string) => {
      if (runRef.current?.projectId === id) stop();
      setProjects((list) => list.filter((p) => p.id !== id));
      if (currentId === id) select(null);
      flash('Проект удалён');
    },
    [currentId, select, stop, flash],
  );

  const duplicate = useCallback(
    (id: string) => {
      const p = projectsRef.current.find((x) => x.id === id);
      if (!p) return;
      const copy = duplicateProject(p);
      setProjects((list) => [copy, ...list]);
      select(copy.id);
      flash('Создана копия');
    },
    [select, flash],
  );

  const rename = useCallback((id: string, name: string) => patch(id, (p) => renameProject(p, name)), [patch]);

  const restore = useCallback(
    (vid: string) => {
      if (!current) return;
      patch(current.id, (p) => restoreVersion(p, vid));
      transition(() => setView('preview'));
      flash('Версия восстановлена');
    },
    [current, patch, flash],
  );

  const editHtml = useCallback(
    (html: string, source: 'text' | 'code') => {
      if (!current) return;
      patch(current.id, (p) => amendHtml(p, html, source));
    },
    [current, patch],
  );

  const download = useCallback(async () => {
    if (!current?.html) return;
    const name = fileName(current.name);
    if (engine.save) {
      const r = await engine.save(name, current.html);
      if (r === 'saved') flash('Файл сохранён');
      else if (r === 'unavailable') flash('Скачивание недоступно здесь — скопируйте код', 'err');
      return;
    }
    const url = URL.createObjectURL(new Blob([current.html], { type: 'text/html' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    flash('Скачиваю ' + name);
  }, [current, engine, flash]);

  const copy = useCallback(async () => {
    if (!current?.html) return;
    try {
      await navigator.clipboard.writeText(current.html);
      flash('HTML скопирован');
    } catch {
      flash('Буфер обмена недоступен — откройте вкладку «Код» и скопируйте вручную', 'err');
    }
  }, [current, flash]);

  const undo = useCallback(() => {
    if (!current || runRef.current) return;
    const prev = previousVersion(current);
    if (!prev) return flash('Это первая версия');
    restore(prev.id);
  }, [current, restore, flash]);

  // Global shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSidebar(true);
        window.setTimeout(() => document.getElementById('fxs-search')?.focus(), 30);
      } else if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void download();
      } else if (mod && !e.shiftKey && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        undo();
      } else if (e.key === 'Escape' && runRef.current && !document.querySelector('.fxs-pop')) {
        stop();
      } else if (e.key === '/' && !typing && !mod) {
        e.preventDefault();
        composerRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [download, undo, stop]);

  const manage = useMemo(() => (engine.manage ? () => engine.manage!() : undefined), [engine]);
  const isRunningHere = !!running && running.projectId === current?.id;
  const shownHtml = live && current && live.projectId === current.id ? live.html : (current?.html ?? '');
  const activeRun = isRunningHere ? current?.messages.find((m) => m.id === running!.messageId)?.run : undefined;
  const choiceLabel = model === 'auto' ? 'Авто' : modelName(model, catalog);

  const composer = (
    <Composer
      ref={composerRef}
      value={draft}
      onChange={setDraft}
      onSend={send}
      onStop={stop}
      running={!!running}
      model={model}
      effort={effort}
      onModel={setModel}
      onEffort={setEffort}
      catalog={catalog}
      status={status}
      surface={engine.surface}
      siteUrl={siteUrl}
      placeholder={current?.html ? 'Опишите правку или задайте вопрос…' : 'Опишите, что создать…'}
      choiceLabel={choiceLabel}
      big={!current}
    />
  );

  return (
    <div className="fxs" data-pane={pane} data-sidebar={sidebar ? 'open' : 'closed'} data-empty={current ? undefined : 'true'}>
      <header className="fxs-bar">
        <button type="button" className="fxs-icon-btn" aria-label={sidebar ? 'Скрыть проекты' : 'Показать проекты'} aria-expanded={sidebar} onClick={() => transition(() => setSidebar((v) => !v))}>
          <Icon name="sidebar" />
        </button>
        <button type="button" className="fxs-brand" onClick={onExit} aria-label={onExit ? 'Effect — на главную' : 'Effect'} disabled={!onExit}>
          <EffectLogo size={26} /> <span>Effect</span>
        </button>
        {current && (
          <input
            className="fxs-name"
            aria-label="Название проекта"
            value={current.name}
            maxLength={60}
            onChange={(e) => rename(current.id, e.target.value)}
          />
        )}
        <span className="fxs-bar-sp" />
        {running && (
          <output className="fxs-live">
            <i /> {activeRun?.steps.find((s) => s.status === 'running')?.title ?? 'Effect работает'}
          </output>
        )}
        <button type="button" className="fxs-btn ghost" onClick={createNew}>
          <Icon name="plus" size={16} /> <span className="fxs-hide-sm">Новый проект</span>
        </button>
      </header>

      <Sidebar
        projects={projects}
        currentId={currentId}
        runningId={running?.projectId ?? null}
        onSelect={select}
        onNew={createNew}
        onRename={rename}
        onDelete={remove}
        onDuplicate={duplicate}
        onClose={() => transition(() => setSidebar(false))}
      />

      {!current ? (
        <EmptyStart status={status} surface={engine.surface} onIdea={(t) => { setDraft(t); composerRef.current?.focus(); }} onManage={manage} siteUrl={siteUrl}>
          {composer}
        </EmptyStart>
      ) : (
        <>
          <section className="fxs-chat" aria-label="Диалог">
            <Conversation
              project={current}
              runningId={running?.messageId ?? null}
              onRetry={send}
              onShowPreview={() => transition(() => setPane('stage'))}
              status={status}
              onManage={manage}
              catalog={catalog}
            />
            {composer}
          </section>
          <Stage
            project={current}
            html={shownHtml}
            running={isRunningHere}
            run={activeRun}
            view={view}
            onView={(v) => transition(() => setView(v))}
            device={device}
            onDevice={setDevice}
            onEdit={editHtml}
            onRestore={restore}
            onDownload={download}
            onCopy={copy}
            flash={flash}
          />
          <nav className="fxs-tabs" aria-label="Панели">
            {(
              [
                ['chat', 'chat', 'Диалог'],
                ['stage', 'eye', 'Превью'],
              ] as const
            ).map(([id, icon, label]) => (
              <button key={id} type="button" aria-pressed={pane === id} onClick={() => transition(() => setPane(id))}>
                <Icon name={icon} /> {label}
                {id === 'stage' && running && <i className="fxs-dot" aria-label="идёт генерация" />}
              </button>
            ))}
          </nav>
        </>
      )}

      <div className="fxs-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={'fxs-toast ' + t.tone}>
            <Icon name={t.tone === 'ok' ? 'check' : 'close'} size={16} /> {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
