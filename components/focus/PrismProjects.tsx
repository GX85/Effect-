import { ArrowUpRight } from 'lucide-react';
import { prismProjects } from '@/lib/prism';

export default function PrismProjects() {
  return (
    <section
      id="prism"
      className="section prism"
      aria-labelledby="prism-title"
    >
      <div className="section-heading reveal">
        <div>
          <p className="eyebrow">Prism projects</p>
          <h2 id="prism-title">
            Our own products.
            <br />
            <em>Live and open source.</em>
          </h2>
        </div>
        <p>
          Beyond client concepts, Prism ships its own tools.
          <br />
          Open the live site or read the code on GitHub.
        </p>
      </div>
      <div className="prism-grid">
        {prismProjects.map((p, i) => (
          <article className="prism-card reveal" key={p.id}>
            <p className="prism-index">
              0{i + 1} / {p.kind}
            </p>
            <h3>{p.title}</h3>
            <p className="prism-desc">{p.desc}</p>
            <ul className="prism-tags" aria-label={p.title + ' stack'}>
              {p.tags.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <div className="prism-actions">
              <a
                className="button primary"
                href={p.site}
                {...(p.site.startsWith('http')
                  ? { target: '_blank', rel: 'noopener noreferrer', 'aria-label': 'Open ' + p.title + ' (opens in a new tab)' }
                  : { 'aria-label': 'Open ' + p.title })}
              >
                Open site <ArrowUpRight size={16} />
              </a>
              <a
                className="button"
                href={p.repo}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={p.title + ' on GitHub (opens in a new tab)'}
              >
                <GithubMark /> GitHub
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function GithubMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.22 1.87.87 2.33.67.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
      />
    </svg>
  );
}
