import Image from 'next/image';
import Link from '@/components/focus/PageLink';
import { rapidTiers } from '@/lib/rapid';
import { ArrowUpRight } from 'lucide-react';
export default function Portfolio() {
  return (
    <section id="work" className="section portfolio">
      <div className="section-heading reveal">
        <div>
          <p className="eyebrow">Selected work</p>
          <h2>
            Concepts.
            <br />
            <em>Built to be believed.</em>
          </h2>
        </div>
        <p>
          Different worlds. One obsession with detail.
          <br />
          Independent concepts by Focus.
        </p>
      </div>
      <div className="work-grid">
        {[
          {
            title: 'Opal Coffee',
            slug: 'opal-coffee',
            kind: 'Hospitality / Brand & digital',
            desc: 'A digital identity crafted for a modern coffee house.',
          },
          {
            title: 'ENvoid',
            slug: 'envoid',
            kind: 'Nature & technology / Digital experience',
            desc: 'Where technology meets the living world.',
          },
        ].map((p, i) => (
          <Link
            className={'project-card reveal project-' + i}
            href={'/work/' + p.slug}
            key={p.slug}
            aria-label={'Explore ' + p.title + ' concept website'}
          >
            <div className="project-image">
              <Image
                unoptimized
                src={
                  i === 0
                    ? '/images/focus-pro-opal.jpg'
                    : '/images/focus-pro-envoid.jpg'
                }
                alt={
                  i === 0
                    ? 'Morning sunlight falls across espresso on a travertine coffee bar'
                    : 'A brushed steel ring reflected in a misty forest pool'
                }
                loading="lazy"
                width="1672"
                height="941"
              />
              <span className="project-index">0{i + 1} / CONCEPT</span>
              <span className="project-art-title">{p.title}</span>
              <span className="round-arrow">
                <ArrowUpRight />
              </span>
            </div>
            <div className="project-meta">
              <h3>{p.title}</h3>
              <span>{p.kind}</span>
            </div>
            <p>{p.desc}</p>
          </Link>
        ))}
      </div>
      <article className="rapid-showcase">
        <Link
          className="rapid-showcase-image"
          href="/work/rapid"
          aria-label="Explore Rapid concept website"
        >
          <Image
            unoptimized
            src="/images/rapid-aeris.webp"
            alt="Rapid graphite carbon performance bicycle"
            width={1536}
            height={1024}
          />
        </Link>
        <div className="rapid-showcase-copy">
          <p className="eyebrow">03 / RAPID — A Prism experiment</p>
          <h3>
            One brand.
            <br />
            Three possibilities.
          </h3>
          <p>
            One performance brand. Three complete experiences, from a refined
            product website to our most immersive premium edition.
          </p>
          <div className="rapid-demo-links">
            <Link
              href="/work/rapid"
              className="rapid-premium-launch rapid-main-link"
            >
              Explore Rapid <ArrowUpRight size={16} />
            </Link>
            {rapidTiers.map((t) => (
              <Link
                key={t.id}
                href={'/work/rapid/' + t.id}
                className={t.id === 'imapro' ? 'rapid-premium-launch' : ''}
              >
                {t.name}
                {t.id === 'imapro' ? ' · Premium' : ' ↗'}
              </Link>
            ))}
          </div>
          <p className="rapid-preview-hint" lang="ru">
            Полноценный сайт Rapid. Три версии для сравнения тарифов.
          </p>
        </div>
      </article>
    </section>
  );
}
