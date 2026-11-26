'use client';
import { useEffect, useState } from 'react';
import Studio from './Studio';
import { siteEngine } from './site-engine';

/** The studio page on the site: Effect models via /api/effect, OpenRouter when configured. */
export default function SiteStudio() {
  const [q, setQ] = useState<string | undefined>();
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('fx-root', 'fxs-root');
    const t = window.setTimeout(() => setQ(new URLSearchParams(window.location.search).get('q')?.slice(0, 6000) || undefined), 0);
    return () => {
      window.clearTimeout(t);
      root.classList.remove('fx-root', 'fxs-root');
    };
  }, []);
  return <Studio engine={siteEngine} initialPrompt={q} onExit={() => (window.location.href = '/effect')} />;
}
