'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { filterCommands, type Command } from '@/lib/effect/commands';
import { Icon } from '../ui';

export type { Command };

/** ⌘K: one searchable list of projects, actions, views, devices and models. */
export function Palette({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [at, setAt] = useState(0);
  const list = useMemo(() => filterCommands(commands, q).slice(0, 60), [commands, q]);
  const sel = Math.min(at, Math.max(0, list.length - 1));
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.querySelector(`[data-i="${sel}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [sel]);
  const run = (c: Command | undefined) => {
    if (!c) return;
    onClose();
    c.run();
  };
  return (
    <div className="fxs-palette-wrap" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <dialog open className="fxs-palette" aria-label="Команды">
        <label className="fxs-palette-q">
          <Icon name="search" size={20} />
          <span className="fx-sr">Команда или проект</span>
          <input
            autoFocus
            type="search"
            aria-controls="fxs-palette-list"
            aria-describedby="fxs-palette-sel"
            placeholder="Команда или проект…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setAt(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setAt((sel + 1) % Math.max(1, list.length));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setAt((sel - 1 + list.length) % Math.max(1, list.length));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                run(list[sel]);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }
            }}
          />
          <kbd>Esc</kbd>
        </label>
        <output id="fxs-palette-sel" className="fx-sr">
          {list[sel] ? list[sel].group + ': ' + list[sel].label : ''}
        </output>
        <div className="fxs-palette-list" id="fxs-palette-list" ref={box}>
          {list.length === 0 && <p className="fxs-palette-empty">Ничего не нашлось.</p>}
          {list.map((c, i) => {
            const head = i === 0 || list[i - 1].group !== c.group ? c.group : null;
            return (
              <div key={c.id}>
                {head && <p className="fxs-palette-group">{head}</p>}
                <button
                  type="button"
                  data-i={i}
                  tabIndex={-1}
                  aria-current={i === sel ? 'true' : undefined}
                  className="fxs-palette-item"
                  onPointerMove={() => i !== sel && setAt(i)}
                  onClick={() => run(c)}
                >
                  <Icon name={c.icon} size={16} />
                  <span>{c.label}</span>
                  {c.hint && <kbd>{c.hint}</kbd>}
                </button>
              </div>
            );
          })}
        </div>
      </dialog>
    </div>
  );
}
