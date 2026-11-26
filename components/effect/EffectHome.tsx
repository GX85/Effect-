'use client';
import { useEffect, useRef, useState } from 'react';
import { EFFORTS, MODELS } from '@/lib/effect/agent/models';
import Link from '@/components/focus/PageLink';
import PrismHero, { PrismPreload } from './PrismHero';
import { EffectLogo, Icon, KindIcon } from './ui';

type MockKind = 'site' | 'landing' | 'slides' | 'game';

const agents: ['architect' | 'designer' | 'developer' | 'tester', string, string][] = [
  ['architect', 'Архитектор', 'Превращает ваши слова в спецификацию: страницы, разделы, функции, критерии готовности. Для игр — гейм-дизайн.'],
  ['designer', 'Дизайнер', 'Подбирает направление, палитру с проверкой контраста, пару шрифтов, отступы и движение.'],
  ['developer', 'Разработчик', 'Пишет полный проект в одном HTML-файле. Превью обновляется прямо во время работы.'],
  ['tester', 'Тестировщик', 'Ищет ошибки, поломки вёрстки на телефоне и компьютере, проблемы доступности и недоделки. Разработчик их исправляет.'],
];

/** Idea prompts: clicking one only fills the composer. Every project is written by the agents. */
const ideas = [
  'Сайт семейной пекарни «Колос» с меню, доставкой и формой заказа',
  'Аркада про кота-курьера на крышах ночного города',
  'Дашборд продаж за квартал с фильтрами и графиками',
  'Презентация для инвесторов: аренда электросамокатов',
];

// Syntax-highlighted lines for the "one HTML file" bento cell: [class, text] tokens.
const codeLines: [string, string][][] = [
  [['t', '<!doctype '], ['a', 'html'], ['t', '>']],
  [['t', '<html '], ['a', 'lang'], ['', '='], ['v', '"ru"'], ['t', '>']],
  [['', '  '], ['t', '<title>'], ['', 'Луна'], ['t', '</title>']],
  [['', '  '], ['t', '<style>'], ['c', '/* … */'], ['t', '</style>']],
  [['', '  '], ['t', '<script>'], ['c', '/* … */'], ['t', '</script>']],
  [['', '  '], ['t', '<body>'], ['', '…'], ['t', '</body>']],
  [['t', '</html>']],
];

const faq: [string, string][] = [
  ['Есть ли готовые шаблоны?', 'Нет. Каждый проект пишут агенты Effect по вашим словам: архитектор, дизайнер, разработчик и тестировщик. Два одинаковых запроса дадут два разных проекта.'],
  ['Нужно ли выбирать режим или тип проекта?', 'Нет. Effect сам понимает, создать ли новый проект, изменить текущий или ответить на вопрос, определяет тип проекта и подбирает модель и глубину работы. Выбрать модель и глубину вручную тоже можно.'],
  ['Где хранятся проекты и данные?', 'Проекты хранятся в браузере пользователя — у Effect нет своей базы проектов. Запросы к модели уходят выбранному провайдеру: Anthropic для моделей Effect или OpenRouter для остальных моделей.'],
  ['Как устроены ключи доступа?', 'Ключи провайдеров задаются переменными окружения на сервере (Vercel) и в браузер не передаются. Без ключей студия открывается и показывает, какие переменные добавить.'],
  ['Какие модели можно использовать?', 'Effect Astrolabe, Compass и Spyglass, а на сайте с ключом OpenRouter — любую модель из каталога OpenRouter. Модель можно выбрать для всего запроса или оставить «Авто»: тогда Effect подбирает модель под каждого агента.'],
  ['Кому принадлежит код?', 'Вам. Результат — один HTML-файл без зависимостей и водяных знаков: его можно положить в репозиторий, отдать на ревью и разместить на любом хостинге.'],
  ['Что такое Effect внутри Claude?', 'Та же студия, опубликованная как артефакт Claude: агенты работают на тарифе Claude того, кто её открыл, без ключей. Каталог OpenRouter там недоступен — он работает на сайте Effect.'],
];

const enterprise: ['shield' | 'lock' | 'users' | 'cpu' | 'code' | 'layers', string, string][] = [
  ['lock', 'Ключи только на сервере', 'Ключи Anthropic и OpenRouter живут в переменных окружения вашего развёртывания. Браузер получает только поток ответа.'],
  ['shield', 'Данные под контролем', 'Проекты лежат в браузере сотрудника, а не в чужой базе. Промпты агентов собираются на сервере из проверенного контекста — клиент не может подменить системные инструкции.'],
  ['cpu', 'Выбор провайдера', 'Модели Effect работают на Anthropic, остальные — через OpenRouter. Свою модель можно назначить переменными окружения без правки кода.'],
  ['users', 'Командная работа', 'Версии с восстановлением и сравнением «до / после», понятная лента агентов и один файл на выходе — результат легко передать дизайнеру, разработчику или в CMS.'],
  ['code', 'Код без привязки', 'Чистый HTML, CSS и JavaScript в одном файле. Никакого рантайма Effect: проект живёт дальше без нас.'],
  ['layers', 'Встраивание в процессы', 'Эндпоинт агентов отдаёт поток событий NDJSON: шаги, прогресс, текст и итоговый HTML. Его можно вызывать из своих инструментов.'],
];

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.fxh-reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        }),
      { rootMargin: '0px 0px -8% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/** Runs the mini animations of `selector` elements only while they are on screen. */
function useLive(selector: string) {
  useEffect(() => {
    const els = document.querySelectorAll(selector);
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-live'));
      return;
    }
    const io = new IntersectionObserver((entries) =>
      entries.forEach((e) => e.target.classList.toggle('is-live', e.isIntersecting)),
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [selector]);
}

/** Pauses every landing animation while the tab is hidden. */
function usePauseWhenHidden(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const sync = () => root.current?.classList.toggle('is-hidden', document.hidden);
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, [root]);
}

function Tilt({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const pos = useRef({ x: 0, y: 0 });
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  return (
    <div
      ref={ref}
      className={className}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse') return;
        pos.current = { x: e.clientX, y: e.clientY };
        if (frame.current) return;
        // One layout read per frame at most.
        frame.current = requestAnimationFrame(() => {
          frame.current = 0;
          const el = ref.current;
          if (!el) return;
          const r = el.getBoundingClientRect();
          const x = (pos.current.x - r.left) / r.width - 0.5;
          const y = (pos.current.y - r.top) / r.height - 0.5;
          el.style.transform = `perspective(1000px) rotateX(${-y * 9}deg) rotateY(${x * 11}deg)`;
          el.style.setProperty('--mx', `${(x + 0.5) * 100}%`);
          el.style.setProperty('--my', `${(y + 0.5) * 100}%`);
        });
      }}
      onPointerLeave={() => {
        cancelAnimationFrame(frame.current);
        frame.current = 0;
        if (ref.current) ref.current.style.transform = '';
      }}
    >
      {children}
    </div>
  );
}

function Mock({ kind }: { kind: MockKind }) {
  if (kind === 'site')
    return (
      <div className="fxh-mock site">
        <div className="bar">
          <i />
          <i />
          <i />
        </div>
        <b className="w60" />
        <b className="w80 dim" />
        <div className="tiles">
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  if (kind === 'landing')
    return (
      <div className="fxh-mock landing">
        <b className="w70 grad" />
        <b className="w50 dim" />
        <span className="pill" />
        <div className="tiles two">
          <span />
          <span />
        </div>
      </div>
    );
  if (kind === 'slides')
    return (
      <div className="fxh-mock slides">
        <div className="deck d3" />
        <div className="deck d2" />
        <div className="deck d1">
          <b className="w50" />
          <div className="bars">
            <span style={{ height: '40%' }} />
            <span style={{ height: '72%' }} />
            <span style={{ height: '55%' }} />
            <span style={{ height: '92%' }} />
          </div>
        </div>
      </div>
    );
  return (
    <div className="fxh-mock game">
      <div className="grid" />
      <span className="orb o1" />
      <span className="orb o2" />
      <span className="orb o3" />
      <span className="ship" />
      <em>04200</em>
    </div>
  );
}

const sections: [string, string][] = [
  ['#agents', 'Агенты'],
  ['#worlds', 'Возможности'],
  ['#models', 'Модели'],
  ['#business', 'Для компаний'],
  ['#faq', 'FAQ'],
];

/** Top bar. On phones the section links live in a drop-down sheet. */
function Nav() {
  const [open, setOpen] = useState(false);
  const bar = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (bar.current && !bar.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [open]);
  return (
    <header className="fxh-nav" ref={bar}>
      <Link className="fxh-brand" href="/effect" aria-label="Effect — главная">
        <EffectLogo /> Effect
      </Link>
      <nav aria-label="Разделы">
        {sections.map(([href, label]) => (
          <a key={href} href={href}>
            {label}
          </a>
        ))}
      </nav>
      <div className="fxh-nav-end">
        <Link className="fxh-btn light sm" href="/effect/studio">
          Открыть студию
        </Link>
        <button
          type="button"
          className="fxh-menu-btn"
          aria-label="Меню"
          aria-expanded={open}
          aria-controls="fxh-menu"
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path className="l1" d="M4 7h16" />
            <path className="l2" d="M4 12h16" />
            <path className="l3" d="M4 17h16" />
          </svg>
        </button>
      </div>
      <div className="fxh-menu" id="fxh-menu" hidden={!open}>
        {sections.map(([href, label]) => (
          <a key={href} href={href} onClick={() => setOpen(false)}>
            {label}
          </a>
        ))}
      </div>
    </header>
  );
}

/** The hero composer: one field, Effect decides what to build. Ideas only fill the field. */
function Composer() {
  const [text, setText] = useState('');
  const go = () => {
    const q = text.trim();
    window.location.href = '/effect/studio' + (q ? '?q=' + encodeURIComponent(q) : '');
  };
  return (
    <form
      className="fxh-composer"
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
    >
      <div className="fxh-input">
        <label htmlFor="fxh-prompt" className="fx-sr">
          Опишите проект
        </label>
        <textarea
          id="fxh-prompt"
          rows={2}
          value={text}
          placeholder="Опишите сайт, игру, приложение или презентацию…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              go();
            }
          }}
        />
        <button className="fxh-send" type="submit" aria-label="Создать">
          <Icon name="send" />
        </button>
      </div>
      <div className="fxh-chips">
        {ideas.map((ex) => (
          <button key={ex} type="button" data-idea={ex} onClick={() => setText(ex)}>
            {ex}
          </button>
        ))}
      </div>
    </form>
  );
}

export default function EffectHome() {
  const root = useRef<HTMLDivElement>(null);
  useReveal();
  useLive('.fxh-mock, .fxh-scene, .fxh-agents');
  usePauseWhenHidden(root);

  useEffect(() => {
    document.documentElement.classList.add('fx-root', 'fxh-root');
    return () => document.documentElement.classList.remove('fx-root', 'fxh-root');
  }, []);

  return (
    <div className="fxh" ref={root}>
      <PrismPreload />
      <Nav />

      <main>
        <section className="fxh-hero">
          <PrismHero />
          <div className="fxh-hero-copy">
            <p className="fxh-kicker">
              <span className="fxh-dot" /> ИИ-студия · команда агентов · by Prism
            </p>
            <h1>
              Опиши идею.
              <br />
              <span className="fxh-spectrum">Получи эффект.</span>
            </h1>
            <p className="fxh-lead">Сайт, приложение, игра или презентация — спроектированы, написаны и проверены агентами Effect.</p>
          </div>
          <Composer />
        </section>

        <section className="fxh-section" id="agents">
          <p className="fxh-eyebrow fxh-reveal">Как работает Effect</p>
          <h2 className="fxh-display fxh-reveal">
            Команда агентов.
            <br />
            <span className="fxh-dim">Не просто чат.</span>
          </h2>
          <ol className="fxh-agents fxh-reveal">
            {agents.map(([icon, name, text], i) => (
              <li key={name} style={{ '--i': i } as React.CSSProperties}>
                <span className="fxh-agent-ic">
                  <Icon name={icon} />
                </span>
                <h3>{name}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
          <p className="fxh-muted fxh-agents-note fxh-reveal">
            Effect сам решает, кого позвать: на вопрос отвечает сразу, правку отдаёт разработчику и тестировщику, а новый проект проводит через всю команду. Если тестировщик находит проблемы, разработчик их исправляет. В режиме Ultra добавляется ревьюер.
          </p>
        </section>

        <section className="fxh-section" id="worlds">
          <h2 className="fxh-display fxh-reveal">
            Что угодно.
            <br />
            <span className="fxh-dim">Своими словами.</span>
          </h2>
          <div className="fxh-worlds">
            {(
              [
                ['site', 'Сайты и лендинги', 'Многостраничные сайты с навигацией, формами и живым контентом.'],
                ['landing', 'Приложения и дашборды', 'Калькуляторы, трекеры, панели с графиками и фильтрами.'],
                ['slides', 'Презентации', 'Слайды с графиками, переходами, свайпами и режимом обзора.'],
                ['game', 'Игры', 'Canvas-игры с уровнями, звуком, рекордами и тач-управлением.'],
              ] as [MockKind, string, string][]
            ).map(([k, t, d], i) => (
              <div key={k} className="fxh-reveal" style={{ '--i': i } as React.CSSProperties}>
                <Tilt className="fxh-world">
                  <div>
                    <h3>{t}</h3>
                    <p>{d}</p>
                  </div>
                  <Mock kind={k} />
                  <Link className="fxh-link" href="/effect/studio">
                    Создать →
                  </Link>
                </Tilt>
              </div>
            ))}
          </div>
        </section>

        <section className="fxh-section">
          <h2 className="fxh-display small fxh-reveal">
            Студия, а не генератор.
            <br />
            <span className="fxh-dim">Доводите проект до финала.</span>
          </h2>
          <div className="fxh-bento">
            <div className="fxh-cell big fxh-reveal">
              <div className="fxh-chat" aria-hidden="true">
                <span className="me">Добавь тарифы и сделай акцент фиолетовым</span>
                <span className="ai">Разработчик внёс правку, тестировщик проверил ✓</span>
                <span className="me">Как поменять шрифт заголовков?</span>
                <span className="ai">Ответил на вопрос, проект не трогал ✓</span>
              </div>
              <h3>Один чат без режимов</h3>
              <p>Effect сам понимает, что вы хотите: новый проект, правку или ответ. Модель и глубину можно оставить на «Авто».</p>
            </div>
            <div className="fxh-cell fxh-reveal" style={{ '--i': 1 } as React.CSSProperties}>
              <div className="fxh-scene edit" aria-hidden="true">
                <span className="tool">Текст</span>
                <span className="kicker" />
                <span className="title">
                  Кофе, ради которого просыпаешься<i className="caret" />
                </span>
                <span className="line" />
                <span className="line short" />
              </div>
              <h3>Текст прямо в превью</h3>
              <p>Кликните по заголовку и перепишите.</p>
            </div>
            <div className="fxh-cell fxh-reveal" style={{ '--i': 2 } as React.CSSProperties}>
              <div className="fxh-scene devices" aria-hidden="true">
                {(['desk', 'tab', 'phone'] as const).map((d) => (
                  <span key={d} className={'dev ' + d}>
                    <span className="page">
                      <i className="mnav" />
                      <i className="mhero" />
                      <i className="mbtn" />
                      <i className="tile" />
                      <i className="tile" />
                    </span>
                  </span>
                ))}
              </div>
              <h3>Три устройства</h3>
              <p>Компьютер, планшет и телефон в один клик.</p>
            </div>
            <div className="fxh-cell fxh-reveal" style={{ '--i': 3 } as React.CSSProperties}>
              <div className="fxh-scene code" aria-hidden="true">
                <span className="badge">index.html · 48 КБ</span>
                <pre>
                  <code>
                    {codeLines.map((line, i) => (
                      <span key={i} className="ln">
                        {line.map(([cls, text], j) =>
                          cls ? (
                            <b key={j} className={cls}>
                              {text}
                            </b>
                          ) : (
                            text
                          ),
                        )}
                      </span>
                    ))}
                  </code>
                </pre>
              </div>
              <h3>Код с подсветкой</h3>
              <p>Смотрите и правьте код, скачивайте один файл.</p>
            </div>
            <div className="fxh-cell fxh-reveal" style={{ '--i': 4 } as React.CSSProperties}>
              <ul className="fxh-scene projects" aria-hidden="true">
                {(
                  [
                    ['website', 'Создано: «Кофейня»', 'v1'],
                    ['presentation', 'Правка: тарифы', 'v2'],
                    ['game', 'Правка: тёмная тема', 'v3'],
                  ] as ['website' | 'presentation' | 'game', string, string][]
                ).map(([k, t, when]) => (
                  <li key={t}>
                    <span className="ic">
                      <KindIcon kind={k} />
                    </span>
                    <b>{t}</b>
                    <small>{when}</small>
                  </li>
                ))}
              </ul>
              <h3>Версии и сравнение</h3>
              <p>Каждая генерация — версия. Сравните «до / после» и восстановите любую.</p>
            </div>
          </div>
        </section>

        <section className="fxh-section" id="models">
          <h2 className="fxh-display fxh-reveal">
            Модели Effect.
            <br />
            <span className="fxh-dim">И любые другие.</span>
          </h2>
          <div className="fxh-models">
            {MODELS.map((m, i) => (
              <div key={m.id} className="fxh-reveal" style={{ '--i': i } as React.CSSProperties}>
                <Tilt className={'fxh-model ' + m.id}>
                  <span className="fxh-model-glow" aria-hidden="true" />
                  <p className="fxh-tag">{m.tag}</p>
                  <h3>
                    Effect <span>{m.short}</span>
                  </h3>
                  <p>{m.blurb}</p>
                  <div className="fxh-meter" aria-hidden="true">
                    <span style={{ width: ['100%', '68%', '40%'][i] }} />
                  </div>
                  <small>{['Глубина и качество', 'Баланс', 'Скорость'][i]}</small>
                </Tilt>
              </div>
            ))}
          </div>
          <div className="fxh-or fxh-reveal">
            <div>
              <p className="fxh-eyebrow">OpenRouter</p>
              <h3>Сотни моделей в одном пикере</h3>
              <p className="fxh-muted">На сайте Effect с ключом OpenRouter доступен весь каталог: поиск, группы по провайдерам, размер контекста и цена за миллион токенов прямо в списке.</p>
            </div>
            <ul aria-hidden="true">
              {[
                ['Effect Astrolabe', 'Effect', ''],
                ['Effect Compass', 'Effect', ''],
                ['Модель OpenRouter', 'провайдер', '1M · $ / $'],
                ['Модель OpenRouter', 'провайдер', '200K · $ / $'],
              ].map(([n, p, m], i) => (
                <li key={i}>
                  <b>{n}</b>
                  <small>{p}</small>
                  {m && <em>{m}</em>}
                </li>
              ))}
            </ul>
          </div>
          <div className="fxh-efforts fxh-reveal">
            <p className="fxh-eyebrow">Глубина работы</p>
            <div className="fxh-effort-row">
              {EFFORTS.map((e) => (
                <span key={e.id} className={e.id === 'ultra' ? 'ultra' : ''} title={e.hint}>
                  {e.name}
                </span>
              ))}
            </div>
            <p className="fxh-muted">«Авто» — Effect сам решает. Ultra — самый сильный режим: больше размышлений на каждом шаге и отдельный раунд ревью.</p>
          </div>
        </section>

        <section className="fxh-section" id="business">
          <p className="fxh-eyebrow fxh-reveal">Для компаний</p>
          <h2 className="fxh-display fxh-reveal">
            Готово к работе
            <br />
            <span className="fxh-dim">в вашей инфраструктуре.</span>
          </h2>
          <div className="fxh-ent">
            {enterprise.map(([icon, title, text], i) => (
              <div key={title} className="fxh-ent-card fxh-reveal" style={{ '--i': i } as React.CSSProperties}>
                <span className="fxh-ent-ic">
                  <Icon name={icon} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
          <div className="fxh-setup fxh-reveal">
            <div>
              <h3>Развёртывание за несколько минут</h3>
              <p className="fxh-muted">Effect разворачивается на Vercel. Добавьте один или оба ключа в Environment Variables и сделайте Redeploy — студия сама покажет, какие провайдеры подключены.</p>
            </div>
            <pre aria-label="Переменные окружения">
              <code>
                <span className="k">ANTHROPIC_API_KEY</span>=… <span className="c"># модели Effect</span>
                {'\n'}
                <span className="k">OPENROUTER_API_KEY</span>=… <span className="c"># каталог OpenRouter</span>
                {'\n'}
                <span className="k">EFFECT_RATE_LIMIT</span>=80 <span className="c"># шагов за 10 минут на клиента</span>
              </code>
            </pre>
          </div>
        </section>

        <section className="fxh-price">
          <div className="fxh-price-glow" aria-hidden="true" />
          <h2 className="fxh-reveal">
            <span className="fxh-spectrum">Ваш код.</span>
            <br />
            Без привязки.
          </h2>
          <p className="fxh-muted fxh-reveal">Один HTML-файл без зависимостей и водяных знаков. Забирайте и размещайте где угодно.</p>
          <div className="fxh-facts">
            {[
              ['4', 'агента в команде'],
              ['3', 'модели Effect'],
              ['5', 'уровней глубины'],
              ['1', 'HTML-файл на выходе'],
            ].map(([a, b], i) => (
              <div key={b} className="fxh-reveal" style={{ '--i': i } as React.CSSProperties}>
                <b>{a}</b>
                <span>{b}</span>
              </div>
            ))}
          </div>
          <Link className="fxh-btn light fxh-reveal" href="/effect/studio">
            Открыть студию
          </Link>
        </section>

        <section className="fxh-section" id="faq">
          <h2 className="fxh-display small fxh-reveal">Вопросы</h2>
          <div className="fxh-faq">
            {faq.map(([q, a], i) => (
              <details key={q} open={i === 0}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="fxh-footer">
        <div className="fxh-foot-brand">
          <Link className="fxh-brand" href="/effect">
            <EffectLogo /> Effect
          </Link>
          <p>Опиши идею. Получи эффект.</p>
          <small>ИИ-студия команды Prism: сайты, приложения, игры и презентации из ваших слов.</small>
        </div>
        <nav className="fxh-foot-cols" aria-label="Ссылки">
          <div>
            <h4>Продукт</h4>
            <Link href="/effect/studio">Студия</Link>
            <a href="#agents">Агенты</a>
            <a href="#models">Модели Effect</a>
          </div>
          <div>
            <h4>Компаниям</h4>
            <a href="#business">Безопасность и развёртывание</a>
            <a href="#faq">Вопросы</a>
          </div>
          <div>
            <h4>Prism</h4>
            <Link href="/">Сайт студии Prism</Link>
            <Link href="/start">Начать проект</Link>
          </div>
        </nav>
        <div className="fxh-foot-bottom">
          <span>© 2026 Prism. Все права защищены.</span>
          <Link href="/start">Обсудить внедрение →</Link>
        </div>
      </footer>
    </div>
  );
}
