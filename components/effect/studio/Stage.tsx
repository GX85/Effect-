'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cleanEditedHtml, MAX_EDIT_HTML, withBridge } from '@/lib/effect/bridge';
import { cleanInspected, STYLE_PROPS, withInspector, type Picked } from '@/lib/effect/inspector';
import { highlightHtml } from '@/lib/effect/highlight';
import { clock, duration, thumbnailHtml, type Project, type RunView } from '@/lib/effect/project';
import { emptyMemory, type Memory } from '@/lib/effect/brain';
import type { IconName } from '@/lib/effect/icons';
import { Icon } from '../ui';

export type View = 'preview' | 'code' | 'versions' | 'memory';
export type Device = 'desktop' | 'tablet' | 'phone';

const DEVICES: Record<Device, { w: number; h: number; label: string }> = {
  desktop: { w: 1440, h: 900, label: 'Компьютер' },
  tablet: { w: 820, h: 1180, label: 'Планшет' },
  phone: { w: 390, h: 844, label: 'Телефон' },
};

export const SANDBOX = 'allow-scripts allow-pointer-lock allow-forms';

/**
 * Two iframes take turns: the next document loads in the hidden one and is shown only once
 * it has loaded, so streaming updates do not flash a blank page.
 */
function LiveFrame({ html, title, onFrame }: { html: string; title: string; onFrame?: (w: Window | null) => void }) {
  const [st, setSt] = useState<{ docs: [string, string]; front: number }>({ docs: [html, ''], front: 0 });
  // A new document goes to the hidden frame (state derived during render, no effect).
  if (st.docs[st.front] !== html && st.docs[1 - st.front] !== html) {
    const docs: [string, string] = [st.docs[0], st.docs[1]];
    docs[1 - st.front] = html;
    setSt({ docs, front: st.front });
  }
  const a = useRef<HTMLIFrameElement>(null);
  const b = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    onFrame?.((st.front === 0 ? a : b).current?.contentWindow ?? null);
  });
  return (
    <div className={'fxs-frames' + (loaded ? '' : ' loading')}>
      {[0, 1].map((i) =>
        st.docs[i] ? (
          <iframe
            key={i}
            ref={i === 0 ? a : b}
            title={title}
            sandbox={SANDBOX}
            allow="fullscreen; autoplay; gamepad"
            srcDoc={st.docs[i]}
            className={i === st.front ? 'front' : 'back'}
            aria-hidden={i === st.front ? undefined : true}
            inert={i !== st.front}
            onLoad={() => {
              setLoaded(true);
              setSt((cur) => {
                if (i === cur.front || cur.docs[i] !== html) return cur;
                const docs: [string, string] = [cur.docs[0], cur.docs[1]];
                docs[1 - i] = '';
                return { docs, front: i };
              });
            }}
          />
        ) : null,
      )}
      {!loaded && <PageSkeleton />}
    </div>
  );
}

/** A page-shaped skeleton with a light sweep, shown until the preview has loaded. */
function PageSkeleton() {
  return (
    <div className="fxs-page-skel" aria-hidden="true">
      <i className="nav" />
      <i className="h1" />
      <i className="h2" />
      <i className="btn" />
      <span>
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

function EmptyState({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <div className="fxs-empty">
      <span className="fxs-empty-ic">
        <Icon name={icon} />
      </span>
      <b>{title}</b>
      <p>{text}</p>
    </div>
  );
}

function useFit(device: Device) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const d = DEVICES[device];
    const ro = new ResizeObserver(() => {
      if (device === 'desktop') return setScale(1);
      const pad = 32;
      const s = Math.min(1, (el.clientWidth - pad) / (d.w + 24), (el.clientHeight - pad) / (d.h + 24));
      setScale(Math.max(0.2, s));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [device]);
  return { box, scale };
}

function Building({ run }: { run?: RunView }) {
  const steps = run?.steps.filter((s) => s.role !== 'answer') ?? [];
  return (
    <div className="fxs-building">
      <div className="fxs-skel" aria-hidden="true">
        <i className="a" />
        <i className="b" />
        <i className="c" />
        <span>
          <i />
          <i />
          <i />
        </span>
      </div>
      <p className="fxs-building-title">{run?.route?.reason ?? 'Effect разбирает задачу…'}</p>
      <ol>
        {steps.map((s) => (
          <li key={s.id} data-status={s.status}>
            {s.title}
            <small>{s.status === 'running' ? 'работает' : s.status === 'done' ? (s.ms ? duration(s.ms) : 'готово') : s.status === 'skipped' ? 'пропущен' : s.status === 'error' ? 'ошибка' : 'ждёт'}</small>
          </li>
        ))}
      </ol>
    </div>
  );
}

function CodeView({ html, onApply, busy, label = 'index.html' }: { html: string; onApply: (html: string) => void; busy: boolean; label?: string }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(html);
  const highlighted = useMemo(() => (editing ? '' : highlightHtml(html)), [html, editing]);
  const lines = useMemo(() => html.split('\n').length, [html]);
  return (
    <div className="fxs-code">
      <div className="fxs-code-bar">
        <span>
          {label} · {Math.max(1, Math.round(html.length / 1024))} КБ · {lines} строк
        </span>
        {editing ? (
          <>
            <button type="button" className="fxs-btn sm" onClick={() => setEditing(false)}>
              Отмена
            </button>
            <button
              type="button"
              className="fxs-btn sm primary"
              onClick={() => {
                onApply(text);
                setEditing(false);
              }}
            >
              Применить
            </button>
          </>
        ) : (
          <button
            type="button"
            className="fxs-btn sm"
            disabled={busy}
            onClick={() => {
              setText(html);
              setEditing(true);
            }}
          >
            <Icon name="edit" size={16} /> Редактировать
          </button>
        )}
      </div>
      {editing ? (
        <textarea className="fxs-code-edit" spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} aria-label="Код проекта" />
      ) : (
        <pre className="fxs-code-pre" aria-label="Код проекта">
          <code dangerouslySetInnerHTML={{ __html: highlighted }} />
        </pre>
      )}
    </div>
  );
}

/** Multi-file projects: a file list and the selected file's code. */
function FilesView({ files, busy, onApply }: { files: Record<string, string>; busy: boolean; onApply: (path: string, content: string) => void }) {
  const names = Object.keys(files).sort((a, b) => (a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b)));
  const [sel, setSel] = useState(names[0]);
  const path = files[sel] != null ? sel : names[0];
  return (
    <div className="fxs-files">
      <nav className="fxs-file-tabs" aria-label="Файлы проекта">
        {names.map((n) => (
          <button key={n} type="button" aria-pressed={n === path} onClick={() => setSel(n)}>
            {n}
          </button>
        ))}
      </nav>
      <CodeView key={path + ':' + files[path].length} html={files[path]} busy={busy} onApply={(c) => onApply(path, c)} label={path} />
    </div>
  );
}

function InspectorPanel({ el, onSet, onAsk, onClose }: { el: Picked; onSet: (prop: string, value: string | boolean) => void; onAsk: () => void; onClose: () => void }) {
  const [text, setText] = useState(el.text ?? '');
  const num = (prop: string, unit = 'px') => (e: React.ChangeEvent<HTMLInputElement>) => onSet(prop, e.target.value + unit);
  const color = (v: string) => (v === 'transparent' ? '#000000' : v);
  return (
    <aside className="fxs-inspector" aria-label="Инспектор элемента">
      <header>
        <b>{el.label}</b>
        <button type="button" className="fxs-icon-btn" aria-label="Закрыть инспектор" onClick={onClose}>
          <Icon name="close" size={16} />
        </button>
      </header>
      {el.text !== null && (
        <label>
          <span>Текст</span>
          <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} onBlur={() => text !== el.text && onSet('text', text)} />
        </label>
      )}
      <div className="fxs-insp-row">
        <label>
          <span>Цвет текста</span>
          <input type="color" defaultValue={color(el.styles.color)} onChange={(e) => onSet(STYLE_PROPS.color, e.target.value)} />
        </label>
        <label>
          <span>Фон</span>
          <input type="color" defaultValue={color(el.styles.background)} onChange={(e) => onSet(STYLE_PROPS.background, e.target.value)} />
        </label>
      </div>
      <label>
        <span>Размер шрифта · {el.styles.fontSize}px</span>
        <input type="range" min={10} max={120} defaultValue={el.styles.fontSize} onChange={num(STYLE_PROPS.fontSize)} />
      </label>
      <label>
        <span>Насыщенность</span>
        <select defaultValue={String(Math.round(el.styles.fontWeight / 100) * 100)} onChange={(e) => onSet(STYLE_PROPS.fontWeight, e.target.value)}>
          {[300, 400, 500, 600, 700, 800].map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Внутренний отступ · {el.styles.padding}px</span>
        <input type="range" min={0} max={96} defaultValue={el.styles.padding} onChange={num(STYLE_PROPS.padding)} />
      </label>
      <label>
        <span>Скругление · {el.styles.radius}px</span>
        <input type="range" min={0} max={48} defaultValue={el.styles.radius} onChange={num(STYLE_PROPS.radius)} />
      </label>
      <label className="fxs-insp-check">
        <input type="checkbox" defaultChecked={el.styles.hidden} onChange={(e) => onSet('hidden', e.target.checked)} /> Скрыть элемент
      </label>
      <button type="button" className="fxs-btn sm fxs-insp-ask" onClick={onAsk}>
        Спросить Effect про этот элемент
      </button>
    </aside>
  );
}

/** Live miniatures for the newest versions; older ones show their number. */
const THUMBS = 8;

function Versions({ project, onRestore, onCompare, compare }: { project: Project; onRestore: (id: string) => void; onCompare: (id: string | null) => void; compare: string | null }) {
  const list = [...project.versions].reverse();
  if (!list.length) return <EmptyState icon="history" title="Версий пока нет" text="Каждая генерация и правка сохраняется отдельной версией." />;
  return (
    <ol className="fxs-versions">
      {list.map((v, i) => {
        const n = project.versions.length - i;
        const isCurrent = v.html === project.html && i === 0;
        return (
          <li key={v.id} className={(isCurrent ? 'current ' : '') + (compare === v.id ? 'cmp' : '')}>
            {i < THUMBS ? (
              <span className="fxs-vthumb" aria-hidden="true">
                <iframe title="Миниатюра версии" sandbox={SANDBOX} srcDoc={thumbnailHtml(v.html)} loading="lazy" tabIndex={-1} />
                <em>{n}</em>
              </span>
            ) : (
              <span className="fxs-vnum">{n}</span>
            )}
            <div>
              <b>{v.label}</b>
              <small>
                {clock(v.at)} · {Math.max(1, Math.round(v.html.length / 1024))} КБ{isCurrent ? ' · текущая' : ''}
              </small>
            </div>
            {!isCurrent && (
              <span className="fxs-vacts">
                <button type="button" className="fxs-btn sm" aria-pressed={compare === v.id} onClick={() => onCompare(compare === v.id ? null : v.id)}>
                  <Icon name="compare" size={16} /> Сравнить
                </button>
                <button type="button" className="fxs-btn sm" onClick={() => onRestore(v.id)}>
                  <Icon name="history" size={16} /> Восстановить
                </button>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Before / after on top of each other; drag the line or use the slider (arrow keys work). */
function CompareSlider({ before, beforeLabel, after }: { before: string; beforeLabel: string; after: string }) {
  const [pos, setPos] = useState(50);
  const drag = useRef(false);
  const at = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPos(Math.round(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100))));
  };
  return (
    <div className="fxs-compare" aria-label="Сравнение версий" style={{ '--cut': pos + '%' } as React.CSSProperties}>
      <div className="fxs-cmp-stage">
        <iframe className="after" title="Текущая версия" sandbox={SANDBOX} srcDoc={thumbnailHtml(after, 2500)} />
        <iframe className="before" title="Выбранная версия" sandbox={SANDBOX} srcDoc={thumbnailHtml(before, 2500)} />
        <div
          className="fxs-cmp-drag"
          aria-hidden="true"
          onPointerDown={(e) => {
            drag.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            at(e);
          }}
          onPointerMove={(e) => drag.current && at(e)}
          onPointerUp={() => (drag.current = false)}
        >
          <i />
        </div>
        <span className="fxs-cmp-tag l">До · {beforeLabel}</span>
        <span className="fxs-cmp-tag r">Сейчас</span>
      </div>
      <label className="fxs-cmp-range">
        <span className="fx-sr">Граница сравнения</span>
        <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} />
      </label>
    </div>
  );
}

/** Effect Brain: what every agent remembers about this project. Editable. */
function MemoryPanel({ memory, onChange }: { memory: Memory | null | undefined; onChange: (m: Memory) => void }) {
  const m = memory ?? emptyMemory(0);
  const tokens = Object.entries(m.tokens);
  const isColor = (v: string) => /^(#|rgb|hsl|oklch)/i.test(v);
  if (!m.brief && !tokens.length && !m.decisions.length)
    return <EmptyState icon="layers" title="Память пока пуста" text="После первой сборки здесь появятся бриф проекта, дизайн-токены и ваши решения. Агенты читают их при каждой правке." />;
  return (
    <div className="fxs-memory">
      <section>
        <h3>Бриф</h3>
        <textarea
          aria-label="Бриф проекта"
          value={m.brief}
          rows={4}
          maxLength={900}
          onChange={(e) => onChange({ ...m, brief: e.target.value, updated: Date.now() })}
        />
      </section>
      {tokens.length > 0 && (
        <section>
          <h3>Дизайн-токены</h3>
          <ul className="fxs-tokens">
            {tokens.map(([k, v]) => (
              <li key={k}>
                {isColor(v) && <i style={{ background: v }} aria-hidden="true" />}
                <span>{k}</span>
                <code>{v}</code>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h3>Решения</h3>
        {m.decisions.length === 0 ? (
          <p className="fxs-muted-note">Правки, которые вы попросите, появятся здесь — агенты будут их соблюдать.</p>
        ) : (
          <ul className="fxs-decisions">
            {m.decisions.map((d, i) => (
              <li key={d + i}>
                <span>{d}</span>
                <button type="button" aria-label={'Забыть: ' + d} title="Забыть" onClick={() => onChange({ ...m, decisions: m.decisions.filter((_, j) => j !== i), updated: Date.now() })}>
                  <Icon name="close" size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <button type="button" className="fxs-btn sm danger" onClick={() => onChange(emptyMemory())}>
        <Icon name="trash" size={16} /> Очистить память
      </button>
    </div>
  );
}

export default function Stage(props: {
  project: Project;
  html: string;
  running: boolean;
  run?: RunView;
  view: View;
  onView: (v: View) => void;
  device: Device;
  onDevice: (d: Device) => void;
  onEdit: (html: string, source: 'text' | 'code') => void;
  onRestore: (id: string) => void;
  onMemory: (m: Memory) => void;
  onEditFile: (path: string, content: string) => void;
  onAsk: (el: Picked) => void;
  onDownload: () => void;
  onCopy: () => void;
  onShare?: () => void;
  flash: (t: string, tone?: 'ok' | 'err') => void;
}) {
  const { project, html, view, device } = props;
  const [bridged, setBridged] = useState<string | null>(null);
  const [mode, setMode] = useState<'text' | 'inspect'>('text');
  const [picked, setPicked] = useState<Picked | null>(null);
  // Text editing ends when the project, the view or a run changes (derived during render).
  const block = project.id + '|' + view + '|' + String(props.running);
  const [lastBlock, setLastBlock] = useState(block);
  if (block !== lastBlock) {
    setLastBlock(block);
    if (bridged !== null) setBridged(null);
    if (picked) setPicked(null);
  }
  const [compare, setCompare] = useState<string | null>(null);
  const [maxed, setMaxed] = useState(false);
  const frameWin = useRef<Window | null>(null);
  const stageRef = useRef<HTMLElement>(null);
  const { box, scale } = useFit(device);
  const d = DEVICES[device];
  // While text editing, the frame keeps the document it started with: edits flow out of it.
  const editing = bridged !== null && !props.running;
  const doc = editing ? bridged : html;
  const cmp = compare ? project.versions.find((v) => v.id === compare) : null;

  // Text edits posted by the bridge.
  const onEdit = props.onEdit;
  useEffect(() => {
    if (!editing) return;
    const onMsg = (e: MessageEvent) => {
      const data = e.data as { fx?: string; html?: string; el?: Picked };
      if (e.source !== frameWin.current) return;
      if (data?.fx === 'pick' && data.el && typeof data.el.id === 'string') return setPicked(data.el);
      if (data?.fx !== 'html' || typeof data.html !== 'string' || data.html.length > MAX_EDIT_HTML) return;
      onEdit(mode === 'inspect' ? cleanInspected(data.html) : cleanEditedHtml(data.html), mode === 'inspect' ? 'code' : 'text');
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [editing, onEdit, mode]);
  const setStyle = (prop: string, value: string | boolean) => {
    if (!picked) return;
    frameWin.current?.postMessage({ fx: 'set', id: picked.id, prop, value }, '*');
  };

  useEffect(() => {
    if (!maxed) return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setMaxed(false);
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [maxed]);

  const fullscreen = useCallback(async () => {
    const el = stageRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (el.requestFullscreen) await el.requestFullscreen();
      else throw new Error('no fullscreen');
    } catch {
      setMaxed((v) => !v);
    }
  }, []);

  const has = !!html;
  const toggleEdit = (m: 'text' | 'inspect') => {
    if (!has || props.running) return;
    setPicked(null);
    if (editing && mode === m) return setBridged(null);
    setMode(m);
    setBridged(m === 'text' ? withBridge(html) : withInspector(html));
    props.flash(m === 'text' ? 'Кликните по тексту в превью и пишите' : 'Выберите элемент в превью');
  };
  // Commands from the ⌘K palette.
  const toggle$ = useRef(toggleEdit);
  useEffect(() => {
    toggle$.current = toggleEdit;
  });
  useEffect(() => {
    const on = (e: Event) => {
      const cmd = (e as CustomEvent<string>).detail;
      if (cmd === 'fullscreen') void fullscreen();
      else if (cmd === 'present') setMaxed(true);
      else if (cmd === 'text' || cmd === 'inspect') toggle$.current(cmd);
    };
    window.addEventListener('effect:stage', on);
    return () => window.removeEventListener('effect:stage', on);
  }, [fullscreen]);
  return (
    <section className={'fxs-stage' + (maxed ? ' maxed' : '')} ref={stageRef} aria-label="Результат">
      <div className="fxs-stage-bar">
        <fieldset className="fxs-seg">
          <legend className="fx-sr">Вид</legend>
          {(
            [
              ['preview', 'eye', 'Превью'],
              ['code', 'code', 'Код'],
              ['versions', 'history', 'Версии'],
              ['memory', 'layers', 'Память'],
            ] as const
          ).map(([id, icon, label]) => (
            <button key={id} type="button" aria-pressed={view === id} onClick={() => props.onView(id)}>
              <Icon name={icon} size={16} /> <span>{label}</span>
              {id === 'versions' && project.versions.length > 0 && <em>{project.versions.length}</em>}
            </button>
          ))}
        </fieldset>
        {view === 'preview' && (
          <fieldset className="fxs-seg devices">
            <legend className="fx-sr">Устройство</legend>
            {(Object.keys(DEVICES) as Device[]).map((k) => (
              <button key={k} type="button" aria-pressed={device === k} aria-label={DEVICES[k].label} title={DEVICES[k].label} onClick={() => props.onDevice(k)}>
                <Icon name={k} size={16} />
              </button>
            ))}
          </fieldset>
        )}
        <span className="fxs-bar-sp" />
        {view === 'preview' && (
          <button
            type="button"
            className="fxs-tool"
            aria-pressed={editing && mode === 'text'}
            disabled={!has || props.running}
            title="Править текст прямо в превью"
            onClick={() => toggleEdit('text')}
          >
            <Icon name="text" size={16} /> <span className="fxs-hide-md">Текст</span>
          </button>
        )}
        {view === 'preview' && (
          <button
            type="button"
            className="fxs-tool"
            aria-pressed={editing && mode === 'inspect'}
            disabled={!has || props.running}
            title="Инспектор: выберите элемент в превью"
            onClick={() => toggleEdit('inspect')}
          >
            <Icon name="cursor" size={16} /> <span className="fxs-hide-md">Инспектор</span>
          </button>
        )}
        <button type="button" className="fxs-tool" disabled={!has} onClick={props.onCopy} title="Копировать HTML">
          <Icon name="copy" size={16} />
          <span className="fx-sr">Копировать HTML</span>
        </button>
        <button type="button" className="fxs-tool" disabled={!has} onClick={props.onDownload} title="Скачать HTML (⌘S)">
          <Icon name="download" size={16} />
          <span className="fx-sr">Скачать HTML</span>
        </button>
        {props.onShare && (
          <button type="button" className="fxs-tool" disabled={!has} onClick={props.onShare} title="Ссылка только для просмотра">
            <Icon name="link" size={16} />
            <span className="fx-sr">Ссылка только для просмотра</span>
          </button>
        )}
        <button type="button" className="fxs-tool" disabled={!has} onClick={fullscreen} title="Во весь экран">
          <Icon name="expand" size={16} />
          <span className="fx-sr">Во весь экран</span>
        </button>
      </div>

      <div className="fxs-stage-body" data-view={view}>
        {view === 'preview' && (
          <div className={'fxs-viewport ' + device} ref={box}>
            {has ? (
              <div
                className={'fxs-device ' + device}
                style={device === 'desktop' ? undefined : { width: d.w, height: d.h, transform: `scale(${scale})` }}
              >
                <LiveFrame html={doc} title={'Превью: ' + project.name} onFrame={(w) => (frameWin.current = w)} />
              </div>
            ) : props.running ? (
              <Building run={props.run} />
            ) : (
              <EmptyState icon="eye" title="Превью появится здесь" text="Опишите проект в диалоге — превью обновится прямо во время работы агентов." />
            )}
            {editing && mode === 'inspect' && picked && (
              <InspectorPanel key={picked.id} el={picked} onSet={setStyle} onAsk={() => props.onAsk(picked)} onClose={() => setPicked(null)} />
            )}
            {has && props.running && (
              <output className="fxs-stream-badge">
                <i /> {props.run?.steps.find((s) => s.status === 'running')?.title ?? 'Effect'} работает
              </output>
            )}
          </div>
        )}
        {view === 'code' && has && project.files && Object.keys(project.files).length > 1 && (
          <FilesView files={project.files} busy={props.running} onApply={props.onEditFile} />
        )}
        {view === 'code' && (project.files && Object.keys(project.files).length > 1 ? null : has ? <CodeView key={project.id + ':' + html.length} html={html} busy={props.running} onApply={(h) => props.onEdit(h, 'code')} /> : <EmptyState icon="code" title="Кода пока нет" text="Код появится, как только разработчик начнёт писать проект." />)}
        {view === 'memory' && <MemoryPanel memory={project.memory} onChange={props.onMemory} />}
        {view === 'versions' && (
          <div className={'fxs-vwrap' + (cmp ? ' comparing' : '')}>
            <Versions project={project} onRestore={props.onRestore} onCompare={setCompare} compare={compare} />
            {cmp && <CompareSlider key={cmp.id} before={cmp.html} beforeLabel={cmp.label} after={project.html} />}
          </div>
        )}
      </div>
      {maxed && (
        <button type="button" className="fxs-unmax" onClick={() => setMaxed(false)}>
          <Icon name="close" size={16} /> Выйти (Esc)
        </button>
      )}
    </section>
  );
}
