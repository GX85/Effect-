'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cleanEditedHtml, MAX_EDIT_HTML, withBridge } from '@/lib/effect/bridge';
import { highlightHtml } from '@/lib/effect/highlight';
import { clock, duration, thumbnailHtml, type Project, type RunView } from '@/lib/effect/project';
import { Icon } from '../ui';

export type View = 'preview' | 'code' | 'versions';
export type Device = 'desktop' | 'tablet' | 'phone';

const DEVICES: Record<Device, { w: number; h: number; label: string }> = {
  desktop: { w: 1440, h: 900, label: 'Компьютер' },
  tablet: { w: 820, h: 1180, label: 'Планшет' },
  phone: { w: 390, h: 844, label: 'Телефон' },
};

const SANDBOX = 'allow-scripts allow-pointer-lock allow-forms';

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
  useEffect(() => {
    onFrame?.((st.front === 0 ? a : b).current?.contentWindow ?? null);
  });
  return (
    <div className="fxs-frames">
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

function CodeView({ html, onApply, busy }: { html: string; onApply: (html: string) => void; busy: boolean }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(html);
  const highlighted = useMemo(() => (editing ? '' : highlightHtml(html)), [html, editing]);
  const lines = useMemo(() => html.split('\n').length, [html]);
  return (
    <div className="fxs-code">
      <div className="fxs-code-bar">
        <span>
          index.html · {Math.max(1, Math.round(html.length / 1024))} КБ · {lines} строк
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

function Versions({ project, onRestore, onCompare, compare }: { project: Project; onRestore: (id: string) => void; onCompare: (id: string | null) => void; compare: string | null }) {
  const list = [...project.versions].reverse();
  if (!list.length) return <p className="fxs-empty-note">Версий пока нет — они появятся после первой генерации.</p>;
  return (
    <ol className="fxs-versions">
      {list.map((v, i) => {
        const n = project.versions.length - i;
        const isCurrent = v.html === project.html && i === 0;
        return (
          <li key={v.id} className={(isCurrent ? 'current ' : '') + (compare === v.id ? 'cmp' : '')}>
            <span className="fxs-vnum">{n}</span>
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
  onDownload: () => void;
  onCopy: () => void;
  flash: (t: string, tone?: 'ok' | 'err') => void;
}) {
  const { project, html, view, device } = props;
  const [bridged, setBridged] = useState<string | null>(null);
  // Text editing ends when the project, the view or a run changes (derived during render).
  const block = project.id + '|' + view + '|' + String(props.running);
  const [lastBlock, setLastBlock] = useState(block);
  if (block !== lastBlock) {
    setLastBlock(block);
    if (bridged !== null) setBridged(null);
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
      const data = e.data as { fx?: string; html?: string };
      if (e.source !== frameWin.current || data?.fx !== 'html' || typeof data.html !== 'string' || data.html.length > MAX_EDIT_HTML) return;
      onEdit(cleanEditedHtml(data.html), 'text');
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [editing, onEdit]);

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
            aria-pressed={editing}
            disabled={!has || props.running}
            title="Править текст прямо в превью"
            onClick={() => {
              if (editing) setBridged(null);
              else {
                setBridged(withBridge(html));
                props.flash('Кликните по тексту в превью и пишите');
              }
            }}
          >
            <Icon name="text" size={16} /> <span className="fxs-hide-md">Текст</span>
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
              <div className="fxs-empty-stage">
                <Icon name="eye" size={24} />
                <p>Здесь появится превью проекта.</p>
              </div>
            )}
            {has && props.running && (
              <output className="fxs-stream-badge">
                <i /> {props.run?.steps.find((s) => s.status === 'running')?.title ?? 'Effect'} работает
              </output>
            )}
          </div>
        )}
        {view === 'code' && (has ? <CodeView key={project.id + ':' + html.length} html={html} busy={props.running} onApply={(h) => props.onEdit(h, 'code')} /> : <p className="fxs-empty-note">Кода пока нет.</p>)}
        {view === 'versions' && (
          <div className={'fxs-vwrap' + (cmp ? ' comparing' : '')}>
            <Versions project={project} onRestore={props.onRestore} onCompare={setCompare} compare={compare} />
            {cmp && (
              <div className="fxs-compare" aria-label="Сравнение версий">
                <figure>
                  <figcaption>До · {cmp.label}</figcaption>
                  <iframe title="Выбранная версия" sandbox={SANDBOX} srcDoc={thumbnailHtml(cmp.html, 2500)} />
                </figure>
                <figure>
                  <figcaption>Сейчас</figcaption>
                  <iframe title="Текущая версия" sandbox={SANDBOX} srcDoc={thumbnailHtml(project.html, 2500)} />
                </figure>
              </div>
            )}
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
