'use client';
import { lazy, Suspense, useState } from 'react';
import Image from 'next/image';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Layers,
  Gauge,
  Wind,
} from 'lucide-react';
import {
  rapidModels,
  rapidTiers,
  rapidFinishes,
  type RapidTier,
} from '@/lib/rapid';
import { CONTACT_MESSAGE, whatsappLink } from '@/lib/contact';
import ProtonLink from './ProtonLink';
import Link from './PageLink';
import type { Inspection } from './RapidProductStudio';
const RapidProductStudio = lazy(() => import('./RapidProductStudio'));

export default function Rapid({
  tier,
  embedded = false,
  onClose,
}: {
  tier: RapidTier;
  embedded?: boolean;
  onClose?: () => void;
}) {
  const pro = tier === 'imapro',
    plus = tier !== 'howitworks';
  const [modelIndex, setModelIndex] = useState(0);
  const [finish, setFinish] = useState(0);
  const [size, setSize] = useState('M');
  const [inspection, setInspection] = useState<Inspection>('whole');
  const [mode, setMode] = useState<'photo' | '3d'>('photo');
  const model = rapidModels[modelIndex];
  function selectModel(index: number) {
    setModelIndex(index);
    document
      .getElementById('rapid-detail')
      ?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      });
  }
  const projectMessage = `${CONTACT_MESSAGE}\n\nМне понравился пример Rapid / ${rapidTiers.find((t) => t.id === tier)?.name}. Хочу обсудить похожий сайт.`;
  return (
    <main className={`rapid-next rn-${tier}`} id="rapid-top">
      <div className="rn-demo-bar">
        {embedded ? (
          <button onClick={onClose}>
            <ArrowLeft size={15} /> Back to Focus
          </button>
        ) : (
          <Link href="/#work">
            <ArrowLeft size={15} /> Focus / Prism
          </Link>
        )}
        <nav aria-label="Compare Rapid website packages">
          {rapidTiers.map((t) => (
            <a
              href={`/work/rapid/${t.id}`}
              key={t.id}
              aria-current={tier === t.id ? 'page' : undefined}
            >
              {t.name}
              <span>${t.price}</span>
            </a>
          ))}
        </nav>
        <span className="rn-demo-caption">
          Concept website {pro && ' / Signature edition'}
        </span>
      </div>
      <header className="rn-header">
        <a href="#rapid-top" className="rn-logo">
          RAPID<span>®</span>
        </a>
        <nav aria-label="Rapid navigation">
          <a href="#rapid-collection">The collection</a>
          {plus && <a href="#rapid-engineering">Engineering</a>}
          {pro && (
            <a href="#rapid-studio" className="rn-nav-cta">
              Explore in 3D <ArrowUpRight size={16} />
            </a>
          )}
        </nav>
      </header>
      <section className="rn-hero">
        <div className="rn-hero-copy">
          <p className="rn-eyebrow">RAPID PERFORMANCE / AERIS R1</p>
          <h1>
            {pro ? (
              <>
                Engineered
                <br />
                to go <em>further.</em>
              </>
            ) : plus ? (
              <>
                Find your
                <br />
                <em>next limit.</em>
              </>
            ) : (
              <>
                Every ride.
                <br />
                <em>A new horizon.</em>
              </>
            )}
          </h1>
          <p>
            Precision you can feel. Performance you can make your own. Meet a
            new expression of speed.
          </p>
          <a
            className="rn-button"
            href={pro ? '#rapid-studio' : '#rapid-collection'}
          >
            {pro ? 'Enter the product studio' : 'Discover the AERIS R1'}{' '}
            <ArrowUpRight size={18} />
          </a>
          <span className="rn-small">Designed for the road ahead.</span>
        </div>
        <div className="rn-hero-visual">
          <span className="rn-outline-word" aria-hidden="true">
            R1
          </span>
          <Image
            unoptimized
            src="/images/rapid-aeris.webp"
            alt="Graphite Rapid AERIS R1 concept bicycle, shown in full with aero wheels and detailed drivetrain"
            width={1536}
            height={1024}
            priority
          />
          <div className="rn-visual-caption">
            <span>01 / AERIS R1</span>
            <span>Graphite · Aero race</span>
          </div>
        </div>
      </section>
      <div className="rn-spec-strip">
        <div>
          <strong>
            7.2 <small>kg</small>
          </strong>
          <span>Concept frame build</span>
        </div>
        <div>
          <strong>
            60 <small>mm</small>
          </strong>
          <span>Aero wheel profile</span>
        </div>
        <div>
          <strong>2 × 12</strong>
          <span>Precision drivetrain</span>
        </div>
        <p>
          A fictional performance brand.
          <br />A real example of what we build.
        </p>
      </div>
      <section className="rn-section" id="rapid-collection">
        <div className="rn-section-heading">
          <div>
            <p className="rn-eyebrow">01 / THE COLLECTION</p>
            <h2>
              A different road.
              <br />
              <em>The same obsession.</em>
            </h2>
          </div>
          <p>
            {plus
              ? 'Aero, climbing, and all-road. Three approaches to the feeling that brings you back to the bike.'
              : 'Meet the AERIS R1. A focused racing concept with a sculpted silhouette and uncompromising presence.'}
          </p>
        </div>
        <div className={`rn-collection ${!plus ? 'rn-single' : ''}`}>
          {rapidModels.slice(0, plus ? 3 : 1).map((bike, i) => (
            <button
              className="rn-bike-card"
              key={bike.name}
              onClick={() => selectModel(i)}
            >
              <div className="rn-bike-image">
                <Image
                  unoptimized
                  src={bike.image}
                  alt={`${bike.name} ${bike.category} concept bicycle`}
                  width={1536}
                  height={1024}
                />
              </div>
              <div className="rn-bike-title">
                <div>
                  <span className="rn-eyebrow">{bike.category}</span>
                  <h3>{bike.name}</h3>
                </div>
                <ArrowUpRight size={24} />
              </div>
              <p>{bike.copy}</p>
              <span className="rn-card-link">
                Explore this model <ArrowRight size={16} />
              </span>
            </button>
          ))}
        </div>
      </section>
      <section
        className="rn-detail rn-section"
        id="rapid-detail"
        aria-live="polite"
      >
        <div className="rn-detail-photo">
          <Image
            unoptimized
            src={model.image}
            alt={`${model.name} complete studio profile`}
            width={1536}
            height={1024}
          />
        </div>
        <div>
          <p className="rn-eyebrow">IN DETAIL / {model.category}</p>
          <h2>{model.name}</h2>
          <p>{model.copy}</p>
          <dl>
            <div>
              <dt>Build weight</dt>
              <dd>{model.weight} kg</dd>
            </div>
            <div>
              <dt>Wheel depth</dt>
              <dd>{model.depth} mm</dd>
            </div>
            <div>
              <dt>Platform</dt>
              <dd>{model.range}</dd>
            </div>
          </dl>
          <p className="rn-small">
            Concept specifications for this fictional collection.
          </p>
          {pro ? (
            <a href="#rapid-studio" className="rn-text-link">
              Explore our 3D engineering study <ArrowUpRight size={18} />
            </a>
          ) : (
            <ProtonLink className="rn-text-link" body={projectMessage}>
              Want a website like this? <ArrowUpRight size={18} />
            </ProtonLink>
          )}
        </div>
      </section>
      {plus && (
        <section className="rn-engineering rn-section" id="rapid-engineering">
          <div className="rn-section-heading">
            <div>
              <p className="rn-eyebrow">02 / BEHIND THE PERFORMANCE</p>
              <h2>
                Every detail.
                <br />
                <em>A reason to exist.</em>
              </h2>
            </div>
            <p>
              From the first line to the final finish, the ambition stays the
              same: a closer connection between rider and road.
            </p>
          </div>
          <div className="rn-engineering-grid">
            {[
              [
                Layers,
                '01',
                'Considered construction',
                'A sculpted frame language, clean junctions, and an integrated cockpit. Form follows the rider.',
              ],
              [
                Wind,
                '02',
                'Shaped by motion',
                'Deep wheel profiles and a purposeful silhouette express the aero ambition behind the R1 concept.',
              ],
              [
                Gauge,
                '03',
                'Connected to the road',
                'Balanced proportions, precise details, and a platform imagined for confident handling.',
              ],
            ].map(([Icon, number, title, copy]) => {
              const Symbol = Icon as typeof Layers;
              return (
                <article key={String(number)}>
                  <div>
                    <Symbol size={26} />
                    <span>{String(number)}</span>
                  </div>
                  <h3>{String(title)}</h3>
                  <p>{String(copy)}</p>
                </article>
              );
            })}
          </div>
        </section>
      )}
      {pro && (
        <section className="rn-section rn-studio-section" id="rapid-studio">
          <div className="rn-section-heading">
            <div>
              <p className="rn-eyebrow">03 / IMAPRO EXCLUSIVE</p>
              <h2>
                Closer to
                <br />
                <em>the machine.</em>
              </h2>
            </div>
            <p>
              Turn it. Study the components. Find your finish. A detailed racing
              bicycle, ready to explore from every angle.
            </p>
          </div>
          <div className="rn-studio-grid">
            <div className="rn-viewer">
              <Suspense
                fallback={
                  <p className="rn-loading">Opening the product studio…</p>
                }
              >
                <RapidProductStudio
                  key={mode}
                  mode={mode}
                  color={rapidFinishes[finish].value}
                  inspection={inspection}
                  onModeChange={setMode}
                  onResetView={() => setInspection('whole')}
                />
              </Suspense>
            </div>
            <div className="rn-config">
              <p className="rn-eyebrow">RAPID / ENGINEERING STUDY</p>
              <h3>Make it yours.</h3>
              <fieldset>
                <legend>
                  Frame finish <span>{rapidFinishes[finish].name}</span>
                </legend>
                <div className="rn-swatches">
                  {rapidFinishes.map((f, i) => (
                    <button
                      key={f.name}
                      onClick={() => {
                        setFinish(i);
                        setMode('3d');
                      }}
                      aria-label={`${f.name} finish`}
                      aria-pressed={finish === i}
                      style={{ background: f.value }}
                    >
                      {finish === i && (
                        <Check size={18} color={i === 0 ? '#fff' : '#151515'} />
                      )}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>
                  Preferred size <span>{size}</span>
                </legend>
                <div className="rn-sizes">
                  {['XS', 'S', 'M', 'L', 'XL'].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSize(s)}
                      aria-pressed={size === s}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <p className="rn-small">
                  Saved in your concept brief. The model keeps its original
                  geometry.
                </p>
              </fieldset>
              <fieldset>
                <legend>Inspect a component</legend>
                <div className="rn-inspection">
                  {(
                    [
                      ['whole', 'Full bicycle'],
                      ['frame', 'Frame'],
                      ['drivetrain', 'Drivetrain'],
                      ['cockpit', 'Cockpit'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => {
                        setInspection(id);
                        setMode('3d');
                      }}
                      aria-pressed={inspection === id}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <ProtonLink
                className="rn-button"
                body={`${projectMessage}\n\nRapid studio selection: ${rapidFinishes[finish].name}, size ${size}.`}
              >
                Discuss a project <ArrowUpRight size={18} />
              </ProtonLink>
            </div>
          </div>
          <p className="rn-small rn-model-note">
            Studio images and the interactive engineering model are separate
            concept representations. Rapid is a fictional brand; no bicycle is
            offered for sale.
          </p>
        </section>
      )}
      <section className="rn-contact rn-section">
        <p className="rn-eyebrow">RAPID × PRISM</p>
        <h2>
          Your vision.
          <br />
          <em>Our next project.</em>
        </h2>
        <p>Like what you see? Let’s create something for your brand.</p>
        <div>
          <ProtonLink className="rn-button" body={projectMessage}>
            Написать в Proton <ArrowUpRight size={18} />
          </ProtonLink>
          <a
            className="rn-text-link"
            href={whatsappLink(projectMessage)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Написать в WhatsApp <ArrowUpRight size={18} />
          </a>
        </div>
      </section>
      <footer className="rn-footer">
        <a className="rn-logo" href="#rapid-top">
          RAPID<span>®</span>
        </a>
        <p>Created by: Prism</p>
        <Link href="/#work">
          Back to Focus <ArrowUpRight size={16} />
        </Link>
        {pro && (
          <p className="rn-credit">
            3D:{' '}
            <a
              href="https://sketchfab.com/3d-models/racing-bicycle-223901fe94de4d55b6324e7d7e273469"
              target="_blank"
              rel="noopener noreferrer"
            >
              Racing Bicycle — Francesco Coldesina
            </a>{' '}
            ·{' '}
            <a
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noopener noreferrer"
            >
              CC BY 4.0
            </a>{' '}
            · Frame finish and studio presentation adapted.
          </p>
        )}
      </footer>
    </main>
  );
}
