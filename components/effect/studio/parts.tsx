'use client';
import { forwardRef, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { EFFORTS, KIND_LABELS, MODELS, effortName, modelName } from '@/lib/effect/agent/models';
import type { EffortId } from '@/lib/effect/agent/types';
import { clock, duration, searchProjects, timeAgo, type ChatMessage, type Project, type RunView, type StepView } from '@/lib/effect/project';
import type { IconName } from '@/lib/effect/icons';
import type { CatalogModel, EngineStatus } from './engine';
import { EffectLogo, Icon, KindIcon } from '../ui';

// ───────────── Sidebar ─────────────

/** The project's own accent (from the designer), used to tint its thumbnail. */
function accentStyle(p: Project): CSSProperties | undefined {
  const a = p.design?.palette?.accent;
  return typeof a === 'string' && /^#[0-9a-f]{3,8}$/i.test(a) ? ({ '--ac': a } as CSSProperties) : undefined;
}

export function Sidebar(props: {
  projects: Project[];
  currentId: string | null;
  runningId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const list = useMemo(() => searchProjects(props.projects, q), [props.projects, q]);
  return (
    <aside className="fxs-side" aria-label="Проекты">
      <div className="fxs-side-head">
        <h2>
          Проекты {props.projects.length > 0 && <span className="fxs-count">{props.projects.length}</span>}
        </h2>
        <button type="button" className="fxs-icon-btn" aria-label="Новый проект" onClick={props.onNew}>
          <Icon name="plus" />
        </button>
        <button type="button" className="fxs-icon-btn fxs-side-close" aria-label="Скрыть проекты" onClick={props.onClose}>
          <Icon name="close" />
        </button>
      </div>
      <label className="fxs-search">
        <Icon name="search" size={16} />
        <span className="fx-sr">Поиск по проектам</span>
         <input id="fxs-search" type="search" placeholder="Поиск" value={q} onChange={(e) => setQ(e.target.value)} />
        <kbd>⌘K</kbd>
      </label>
      {list.length === 0 ? (
        <div className="fxs-side-empty">
          <span className="fxs-empty-ic">
            <Icon name={q ? 'search' : 'projects'} />
          </span>
          <p>{q ? 'Ничего не нашлось.' : 'Здесь появятся ваши проекты.'}</p>
          {!q && <small>Они хранятся только в этом браузере.</small>}
        </div>
      ) : (
        <ul className="fxs-plist">
          {list.map((p) => (
            <li key={p.id} className={p.id === props.currentId ? 'on' : ''}>
              {editing === p.id ? (
                <form
                  className="fxs-prow"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setEditing(null);
                  }}
                >
                  <span className={'fxs-pic k-' + p.kind} style={accentStyle(p)}>
                    <KindIcon kind={p.kind} />
                  </span>
                  <input
                    ref={(el) => el?.focus()}
                    aria-label="Новое название"
                    defaultValue={p.name}
                    maxLength={60}
                    onBlur={(e) => {
                      props.onRename(p.id, e.target.value);
                      setEditing(null);
                    }}
                    onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}
                  />
                </form>
              ) : confirm === p.id ? (
                <fieldset className="fxs-prow confirm">
                  <legend className="fx-sr">Подтверждение удаления</legend>
                  <span>Удалить «{p.name}»?</span>
                  <button type="button" className="fxs-btn danger sm" onClick={() => (setConfirm(null), props.onDelete(p.id))}>
                    Удалить
                  </button>
                  <button type="button" className="fxs-btn sm" ref={(el) => el?.focus()} onClick={() => setConfirm(null)}>
                    Отмена
                  </button>
                </fieldset>
              ) : (
                <div className="fxs-prow">
                  <button type="button" className="fxs-pmain" onClick={() => props.onSelect(p.id)} aria-current={p.id === props.currentId ? 'page' : undefined}>
                    <span className={'fxs-pic k-' + p.kind} style={accentStyle(p)}>
                      {props.runningId === p.id ? <i className="fxs-spin" aria-label="работает" /> : <KindIcon kind={p.kind} />}
                    </span>
                    <span className="fxs-ptext">
                      <b>{p.name}</b>
                      <small>
                        {KIND_LABELS[p.kind]} · {timeAgo(p.updated)}
                      </small>
                    </span>
                  </button>
                  <span className="fxs-pacts">
                    <button type="button" aria-label={'Переименовать «' + p.name + '»'} title="Переименовать" onClick={() => setEditing(p.id)}>
                      <Icon name="edit" size={16} />
                    </button>
                    <button type="button" aria-label={'Дублировать «' + p.name + '»'} title="Дублировать" onClick={() => props.onDuplicate(p.id)}>
                      <Icon name="duplicate" size={16} />
                    </button>
                    <button type="button" aria-label={'Удалить «' + p.name + '»'} title="Удалить" onClick={() => setConfirm(p.id)}>
                      <Icon name="trash" size={16} />
                    </button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="fxs-side-foot">
        <Icon name="lock" size={16} /> Проекты хранятся в вашем браузере
      </p>
    </aside>
  );
}

// ───────────── Timeline ─────────────

const ROLE_ICON: Record<string, IconName> = {
  architect: 'architect',
  designer: 'designer',
  developer: 'developer',
  tester: 'tester',
  reviewer: 'reviewer',
  answer: 'answer',
  router: 'router',
};

/** Current time, refreshed every second while `active` (0 until the first tick). */
function useNow(active: boolean) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [active]);
  return now;
}

function StepRow({ step, catalog, now }: { step: StepView; catalog: CatalogModel[]; now: number }) {
  const [open, setOpen] = useState(false);
  const running = step.status === 'running';
  const elapsed = running && step.startedAt ? (now ? Math.max(0, now - step.startedAt) : 0) : step.ms;
  const detail =
    step.status === 'running'
      ? (step.note ? step.note + (step.chars ? ' ' + Math.max(1, Math.round(step.chars / 1024)) + ' КБ' : '') : 'Работает') + (elapsed ? ' · ' + duration(elapsed) : '')
      : step.status === 'done'
        ? step.summary || 'Готово'
        : step.status === 'skipped'
          ? step.reason || 'Пропущен'
          : step.status === 'error'
            ? step.reason || 'Ошибка'
            : 'Ожидает';
  const hasOut = !!step.output && step.status !== 'pending';
  return (
    <li className="fxs-step" data-status={step.status}>
      <span className="fxs-step-ic">
        <Icon name={ROLE_ICON[step.role] ?? 'spark'} size={16} />
      </span>
      <div className="fxs-step-body">
        <div className="fxs-step-head">
          <b>{step.title}</b>
          {step.model && <span className="fxs-chip">{modelName(step.model, catalog).replace(/^Effect /, '')}</span>}
          {step.status === 'done' && step.ms != null && <span className="fxs-step-time">{duration(step.ms)}</span>}
          {hasOut && (
            <button type="button" className="fxs-step-more" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
              <span className="fxs-hide-md">{open ? 'Скрыть' : 'Подробнее'}</span>
              <span className="fx-sr">{open ? 'Скрыть результат' : 'Показать результат'}</span> <Icon name="chevron" size={16} />
            </button>
          )}
        </div>
        <p>{detail}</p>
        {running && step.role === 'developer' && (
          <span className="fxs-step-bar" aria-hidden="true">
            <i style={{ transform: `scaleX(${Math.min(0.95, (step.chars ?? 0) / 60000 + 0.04)})` }} />
          </span>
        )}
        {open && hasOut && <pre className="fxs-step-out">{step.output}</pre>}
      </div>
    </li>
  );
}

export function Timeline({ run, catalog }: { run: RunView; catalog: CatalogModel[] }) {
  const now = useNow(run.status === 'running');
  const total = Math.max(0, (run.finishedAt ?? (now || run.startedAt)) - run.startedAt);
  const visible = run.steps.filter((s) => !(s.status === 'skipped' && s.role === 'answer'));
  const settled = visible.filter((s) => s.status === 'done' || s.status === 'skipped' || s.status === 'error').length;
  const share = run.status === 'running' ? Math.min(0.96, (settled + 0.35) / Math.max(1, visible.length)) : 1;
  return (
    <div className="fxs-run" data-status={run.status}>
      <div className="fxs-run-head">
        <span>{run.route?.reason ?? 'Effect разбирает задачу…'}</span>
        <span className="fxs-run-time">
          {visible.length > 0 && run.status === 'running' ? settled + ' из ' + visible.length + ' · ' : ''}
          {duration(total)}
        </span>
      </div>
      <div className="fxs-run-bar" aria-hidden="true">
        <i style={{ transform: `scaleX(${share})` }} />
      </div>
      {visible.length > 0 && (
        <ol className="fxs-steps">
          {visible.map((s) => (
            <StepRow key={s.id} step={s} catalog={catalog} now={now} />
          ))}
        </ol>
      )}
      {run.usage && run.usage.output > 0 && (
        <p className="fxs-run-usage">
          Токены: {run.usage.input.toLocaleString('ru-RU')} на входе · {run.usage.output.toLocaleString('ru-RU')} на выходе
        </p>
      )}
    </div>
  );
}

// ───────────── Conversation ─────────────

export function Conversation(props: {
  project: Project;
  runningId: string | null;
  onRetry: (text: string) => void;
  onShowPreview: () => void;
  status: EngineStatus;
  onManage?: () => Promise<void>;
  catalog: CatalogModel[];
}) {
  const end = useRef<HTMLDivElement>(null);
  const last = props.project.messages.at(-1);
  const sig = props.project.messages.length + ':' + (last?.run?.steps.map((s) => s.status).join() ?? '') + (last?.text.length ?? 0);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [sig]);
  return (
    <div className="fxs-msgs" role="log" aria-live="polite" aria-label="Сообщения">
      {props.project.messages.length === 0 && <p className="fxs-hint">Напишите, что изменить, или задайте вопрос о проекте.</p>}
      {props.project.messages.map((m) => (
        <Message key={m.id} m={m} running={m.id === props.runningId} onRetry={props.onRetry} onShowPreview={props.onShowPreview} catalog={props.catalog} />
      ))}
      {props.status.state === 'denied' && <AccessNote onManage={props.onManage} />}
      <div ref={end} />
    </div>
  );
}

function Message({ m, running, onRetry, onShowPreview, catalog }: { m: ChatMessage; running: boolean; onRetry: (t: string) => void; onShowPreview: () => void; catalog: CatalogModel[] }) {
  if (m.role === 'user')
    return (
      <div className="fxs-msg me">
        <p>{m.text}</p>
        <time>{clock(m.at)}</time>
      </div>
    );
  return (
    <div className={'fxs-msg ai' + (m.error ? ' err' : '')}>
      <span className="fxs-avatar">
        <EffectLogo size={24} />
      </span>
      <div className="fxs-msg-body">
        {m.run && <Timeline run={m.run} catalog={catalog} />}
        {m.text ? <p className="fxs-msg-text">{m.text}</p> : running ? null : null}
        <div className="fxs-msg-foot">
          <time>{clock(m.at)}</time>
          {m.retry && (
            <button type="button" className="fxs-btn sm" onClick={() => onRetry(m.retry!)}>
              <Icon name="retry" size={16} /> Повторить
            </button>
          )}
          {m.versionId && (
            <button type="button" className="fxs-btn sm fxs-only-phone" onClick={onShowPreview}>
              <Icon name="eye" size={16} /> Превью
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AccessNote({ onManage }: { onManage?: () => Promise<void> }) {
  return (
    <div className="fxs-note">
      <Icon name="lock" />
      <div>
        <b>Effect не получил доступ к Claude</b>
        <p>Агенты Effect работают на вашем тарифе Claude. Разрешите это в настройках разрешений артефакта и отправьте запрос снова.</p>
        {onManage && (
          <button type="button" className="fxs-btn sm" onClick={() => onManage().catch(() => {})}>
            Открыть разрешения
          </button>
        )}
      </div>
    </div>
  );
}

// ───────────── Pickers ─────────────

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', down);
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('keydown', key, true);
    };
  }, [open]);
  return { open, setOpen, ref };
}

const price = (n?: number) => (n == null ? '' : n === 0 ? 'бесплатно' : '$' + (n < 1 ? n.toFixed(2) : n < 10 ? n.toFixed(1) : Math.round(n)));
const ctx = (n?: number) => (!n ? '' : n >= 1_000_000 ? Math.round(n / 100_000) / 10 + 'M' : Math.round(n / 1000) + 'K');

export function ModelPicker(props: {
  model: string;
  label: string;
  onModel: (m: string) => void;
  catalog: CatalogModel[];
  status: EngineStatus;
  surface: 'site' | 'artifact';
  siteUrl?: string;
}) {
  const { open, setOpen, ref } = usePopover();
  const [q, setQ] = useState('');
  const openrouter = props.status.state === 'ready' && props.status.openrouter;
  const effect = props.status.state !== 'ready' || props.status.effect;
  const groups = useMemo(() => {
    const t = q.trim().toLowerCase();
    const hits = props.catalog.filter((m) => !t || m.id.toLowerCase().includes(t) || m.name.toLowerCase().includes(t)).slice(0, 80);
    const by = new Map<string, CatalogModel[]>();
    for (const m of hits) by.set(m.provider, [...(by.get(m.provider) ?? []), m]);
    return [...by.entries()];
  }, [props.catalog, q]);
  const pick = (m: string) => {
    props.onModel(m);
    setOpen(false);
  };
  return (
    <div className="fxs-picker" ref={ref}>
      <button type="button" className="fxs-pill" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Icon name="cpu" size={16} /> <span className="fxs-pill-k">Модель</span> {props.label} <Icon name="chevron" size={16} />
      </button>
      {open && <div className="fxs-sheet-backdrop" aria-hidden="true" onClick={() => setOpen(false)} />}
      {open && (
        <dialog open className="fxs-pop" aria-label="Модель">
          <i className="fxs-grabber" aria-hidden="true" />
          <p className="fxs-pop-title">Модель</p>
          <button type="button" className="fxs-opt" aria-pressed={props.model === 'auto'} onClick={() => pick('auto')}>
            <span className="fxs-opt-ic">
              <Icon name="spark" size={16} />
            </span>
            <span>
              <b>Авто</b>
              <small>Effect подбирает модель для каждого агента: мощную — для кода, быструю — для проверок</small>
            </span>
          </button>
          {MODELS.map((m) => (
            <button key={m.id} type="button" className="fxs-opt" aria-pressed={props.model === m.id} disabled={!effect} onClick={() => pick(m.id)}>
              <span className={'fxs-opt-ic m-' + m.id}>
                <EffectLogo size={18} />
              </span>
              <span>
                <b>
                  {m.name} <em>{m.tag}</em>
                </b>
                <small>{m.blurb}</small>
              </span>
            </button>
          ))}
          <p className="fxs-pop-title">OpenRouter</p>
          {props.surface === 'artifact' ? (
            <p className="fxs-pop-note">
              Сотни моделей OpenRouter доступны на сайте Effect{props.siteUrl ? ': ' : '.'}
              {props.siteUrl && (
                <a href={props.siteUrl} target="_blank" rel="noopener">
                  открыть сайт
                </a>
              )}
            </p>
          ) : !openrouter ? (
            <p className="fxs-pop-note">
              Добавьте переменную <code>OPENROUTER_API_KEY</code> в настройках Vercel, чтобы выбрать любую модель OpenRouter.
            </p>
          ) : (
            <>
              <label className="fxs-search in-pop">
                <Icon name="search" size={16} />
                <span className="fx-sr">Поиск модели</span>
                <input type="search" placeholder="Поиск: gpt, gemini, llama…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
              </label>
              <div className="fxs-or-list">
                {groups.length === 0 && <p className="fxs-pop-note">{props.catalog.length ? 'Ничего не нашлось.' : 'Загружаю каталог…'}</p>}
                {groups.map(([provider, list]) => (
                  <div key={provider}>
                    <p className="fxs-or-group">{provider}</p>
                    {list.map((m) => (
                      <button key={m.id} type="button" className="fxs-opt row" aria-pressed={props.model === 'or:' + m.id} onClick={() => pick('or:' + m.id)}>
                        <span className="fxs-or-name">{m.name}</span>
                        <span className="fxs-or-meta">
                          {ctx(m.context) && <span className="fxs-chip">{ctx(m.context)}</span>}
                          {m.prompt != null && <span className="fxs-chip">{price(m.prompt)} / {price(m.completion)}</span>}
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </dialog>
      )}
    </div>
  );
}

export function EffortPicker({ effort, onEffort }: { effort: EffortId; onEffort: (e: EffortId) => void }) {
  const { open, setOpen, ref } = usePopover();
  return (
    <div className="fxs-picker" ref={ref}>
      <button type="button" className="fxs-pill" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Icon name="bolt" size={16} /> <span className="fxs-pill-k">Глубина</span> {effortName(effort)} <Icon name="chevron" size={16} />
      </button>
      {open && <div className="fxs-sheet-backdrop" aria-hidden="true" onClick={() => setOpen(false)} />}
      {open && (
        <dialog open className="fxs-pop narrow" aria-label="Глубина">
          <i className="fxs-grabber" aria-hidden="true" />
          <p className="fxs-pop-title">Глубина работы</p>
          {EFFORTS.map((e) => (
            <button
              key={e.id}
              type="button"
              className={'fxs-opt' + (e.id === 'ultra' ? ' ultra' : '')}
              aria-pressed={effort === e.id}
              aria-label={e.name + ' — ' + e.hint}
              onClick={() => {
                onEffort(e.id);
                setOpen(false);
              }}
            >
              <span>
                <b>{e.id === 'ultra' ? <span className="fxs-ultra">{e.name}</span> : e.name}</b>
                <small>{e.hint}</small>
              </span>
            </button>
          ))}
        </dialog>
      )}
    </div>
  );
}

// ───────────── Composer ─────────────

type ComposerProps = {
  value: string;
  onChange: (v: string) => void;
  onSend: (v: string) => void;
  onStop: () => void;
  running: boolean;
  model: string;
  effort: EffortId;
  onModel: (m: string) => void;
  onEffort: (e: EffortId) => void;
  catalog: CatalogModel[];
  status: EngineStatus;
  surface: 'site' | 'artifact';
  siteUrl?: string;
  placeholder: string;
  choiceLabel: string;
  big?: boolean;
};

export const Composer = forwardRef<HTMLTextAreaElement, ComposerProps>(function Composer(p, ref) {
  const local = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const ta = local.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, p.big ? 260 : 200) + 'px';
  }, [p.value, p.big]);
  const blocked = p.status.state === 'no-key' || p.status.state === 'no-sample';
  return (
    <form
      className={'fxs-composer' + (p.big ? ' big' : '')}
      onSubmit={(e) => {
        e.preventDefault();
        if (p.running) p.onStop();
        else p.onSend(p.value);
      }}
    >
      <label htmlFor="fxs-input" className="fx-sr">
        Сообщение для Effect
      </label>
      <textarea
        id="fxs-input"
        ref={(el) => {
          local.current = el;
          if (typeof ref === 'function') ref(el);
          else if (ref) ref.current = el;
        }}
        rows={p.big ? 3 : 1}
        value={p.value}
        placeholder={p.placeholder}
        maxLength={6000}
        onChange={(e) => p.onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (!p.running) p.onSend(p.value);
          }
        }}
      />
      <span className="fxs-ring" aria-hidden="true" />
      <div className="fxs-composer-row">
        <ModelPicker model={p.model} label={p.choiceLabel} onModel={p.onModel} catalog={p.catalog} status={p.status} surface={p.surface} siteUrl={p.siteUrl} />
        <EffortPicker effort={p.effort} onEffort={p.onEffort} />
        <span className="fxs-composer-sp" />
        <span className="fxs-kbd-hint">Enter — отправить · Shift+Enter — строка</span>
        {p.running ? (
          <button type="submit" className="fxs-send stop" aria-label="Остановить (Esc)">
            <i className="fxs-send-ring" aria-hidden="true" />
            <Icon name="stop" />
          </button>
        ) : (
          <button type="submit" className="fxs-send" aria-label="Отправить" disabled={!p.value.trim() || blocked}>
            <Icon name="send" />
          </button>
        )}
      </div>
    </form>
  );
});

// ───────────── Empty start ─────────────

export function EmptyStart(props: {
  status: EngineStatus;
  surface: 'site' | 'artifact';
  onManage?: () => Promise<void>;
  siteUrl?: string;
  children: ReactNode;
}) {
  const s = props.status;
  return (
    <section className="fxs-start" aria-label="Новый проект">
      <div className="fxs-ambient" aria-hidden="true">
        <i className="a" />
        <i className="b" />
        <i className="c" />
      </div>
      <div className="fxs-start-inner">
        <div className="fxs-hero-mark">
          <EffectLogo size={84} live />
        </div>
        <h1>Что создадим?</h1>
        <p className="fxs-start-lead">Опишите идею своими словами — команда агентов Effect спроектирует, нарисует, напишет и проверит проект.</p>
        {s.state === 'no-key' ? (
          <KeySetup env={s.env} />
        ) : s.state === 'no-sample' ? (
          <div className="fxs-note">
            <Icon name="lock" />
            <div>
              <b>Откройте Effect в Claude</b>
              <p>В этом окне ИИ недоступен: агенты Effect работают на тарифе Claude того, кто открыл страницу. Откройте ссылку на артефакт в Claude{props.siteUrl ? ' или перейдите на сайт Effect' : ''}.</p>
              {props.siteUrl && (
                <a className="fxs-btn sm" href={props.siteUrl} target="_blank" rel="noopener">
                  Сайт Effect <Icon name="external" size={16} />
                </a>
              )}
            </div>
          </div>
        ) : s.state === 'denied' ? (
          <AccessNote onManage={props.onManage} />
        ) : null}
        {props.children}
        <ul className="fxs-start-facts" aria-label="Как работает Effect">
          <li>
            <Icon name="router" size={16} /> Сам поймёт: новый проект, правка или вопрос
          </li>
          <li>
            <Icon name="tester" size={16} /> Тестировщик проверяет каждую сборку
          </li>
          <li>
            <Icon name="history" size={16} /> Каждая генерация — новая версия
          </li>
        </ul>
      </div>
    </section>
  );
}

function KeySetup({ env }: { env: string[] }) {
  return (
    <div className="fxs-keys">
      <div className="fxs-keys-head">
        <span className="fxs-keys-ic">
          <Icon name="key" />
        </span>
        <div>
          <b>Подключите ключ, чтобы агенты заработали</b>
          <p>Ключи хранятся только на сервере и не попадают в браузер. Добавьте переменные окружения в Vercel → Project → Settings → Environment Variables и сделайте Redeploy.</p>
        </div>
      </div>
      <ul>
        {env.map((k) => (
          <li key={k}>
            <code>{k}</code>
            <span>{k.startsWith('ANTHROPIC') ? 'Модели Effect Astrolabe, Compass и Spyglass' : k.startsWith('OPENROUTER') ? 'Любая модель из каталога OpenRouter' : 'Необязательно'}</span>
          </li>
        ))}
      </ul>
      <p className="fxs-keys-foot">Достаточно одного ключа. Без ключей студия открывает и хранит ваши проекты, но не генерирует новые.</p>
    </div>
  );
}

// ───────────── About ─────────────

export function About({ prismUrl }: { prismUrl: string }) {
  const { open, setOpen, ref } = usePopover();
  const external = /^https?:/.test(prismUrl);
  return (
    <div className="fxs-picker fxs-about" ref={ref}>
      <button type="button" className="fxs-icon-btn" aria-label="О Effect" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Icon name="info" />
      </button>
      {open && (
        <dialog open className="fxs-pop down" aria-label="О Effect">
          <div className="fxs-about-head">
            <EffectLogo size={40} live />
            <div>
              <b>Effect by Prism</b>
              <small>ИИ-студия команды Prism</small>
            </div>
          </div>
          <p className="fxs-pop-note">Effect собирает сайты, приложения, игры и презентации командой агентов: архитектор, дизайнер, разработчик и тестировщик. Проекты хранятся в вашем браузере.</p>
          <p className="fxs-pop-note">
            <a href={prismUrl} target={external ? '_blank' : undefined} rel={external ? 'noopener' : undefined}>
              Проекты Prism →
            </a>
          </p>
          <p className="fxs-pop-title">Горячие клавиши</p>
          <ul className="fxs-keys-list">
            <li><kbd>Enter</kbd> отправить</li>
            <li><kbd>Esc</kbd> остановить агентов</li>
            <li><kbd>⌘K</kbd> поиск по проектам</li>
            <li><kbd>⌘S</kbd> скачать HTML</li>
            <li><kbd>⌘Z</kbd> предыдущая версия</li>
            <li><kbd>/</kbd> к полю ввода</li>
          </ul>
        </dialog>
      )}
    </div>
  );
}
