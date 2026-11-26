'use client';
import Image from 'next/image';
import { lazy, Suspense, useState } from 'react';
import {
  ArrowUpRight,
  ArrowDown,
  MoveUpRight,
  Leaf,
  Radio,
  Sun,
  Pause,
  Play,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CaseBar, CaseDetails } from './CaseStudy';
import ConceptDialog from './ConceptDialog';
const Scene3D = lazy(() => import('./Scene3D'));
const modes = [
  {
    id: 'observe',
    name: 'Observe',
    tag: '01 / Read the landscape',
    headline: 'Before we change anything, we listen.',
    text: 'Imagine a quiet network that helps us understand the rhythms of a place: the texture of the air, the sound of water, the passing of light.',
    readout: [
      ['Ambient temperature', '14.2°C'],
      ['Relative humidity', '86%'],
      ['Canopy light', '320 lx'],
    ],
  },
  {
    id: 'connect',
    name: 'Connect',
    tag: '02 / Make the invisible visible',
    headline: 'Bring the whole picture into view.',
    text: 'A considered interface connects field observations into a shared understanding. Technology recedes, so the living world stays in focus.',
    readout: [
      ['Field nodes', '08'],
      ['Listening window', '24 h'],
      ['Observation mode', 'Passive'],
    ],
  },
  {
    id: 'restore',
    name: 'Restore',
    tag: '03 / Act with intention',
    headline: 'Leave a lighter mark.',
    text: 'The goal is a more thoughtful relationship with the places we inhabit. Small interventions, designed around the landscape and the people caring for it.',
    readout: [
      ['Material approach', 'Modular'],
      ['Power concept', 'Solar'],
      ['Design intention', 'Repairable'],
    ],
  },
];
export default function Envoid() {
  const [contact, setContact] = useState(false),
    [mode, setMode] = useState('observe'),
    [paused, setPaused] = useState(false);
  return (
    <main className="envoid-page">
      <CaseBar other="opal-coffee" label="02 / ENvoid" />
      <header className="concept-nav envoid-nav">
        <a href="#envoid-top" className="envoid-logo">
          ENvoid<span>®</span>
        </a>
        <nav aria-label="ENvoid navigation">
          <a href="#envoid-approach">Our approach</a>
          <a href="#envoid-system">The system</a>
          <a href="#envoid-principles">Principles</a>
        </nav>
        <button className="concept-nav-cta" onClick={() => setContact(true)}>
          Make a connection <ArrowUpRight size={16} />
        </button>
      </header>
      <section className="envoid-hero" id="envoid-top">
        <Image
          unoptimized
          src="/images/envoid.webp"
          alt="A brushed metal ring in a misty conifer forest, reflected in still water"
          fetchPriority="high"
          width="1672"
          height="941"
        />
        <Suspense fallback={null}>
          <Scene3D weather="sun" paused={paused} />
        </Suspense>
        <div className="envoid-hero-copy">
          <p className="eyebrow">
            <span className="status-dot" /> Nature has something to tell us.
          </p>
          <h1>
            A quieter kind
            <br />
            of <em>progress.</em>
          </h1>
          <p>Where technology meets the living world.</p>
          <a className="button" href="#envoid-approach">
            Step into the possibility <ArrowDown size={18} />
          </a>
        </div>
        <div className="envoid-hero-bottom">
          <span>Designed to belong.</span>
          <button
            onClick={() => setPaused(!paused)}
            aria-label={paused ? 'Play atmosphere' : 'Pause atmosphere'}
          >
            {paused ? <Play size={14} /> : <Pause size={14} />} Atmosphere{' '}
            {paused ? 'paused' : 'on'}
          </button>
          <span>Nature × Thoughtful technology</span>
        </div>
      </section>
      <section id="envoid-approach" className="concept-section envoid-approach">
        <p className="eyebrow">01 / A different perspective</p>
        <div>
          <h2>
            The future should
            <br />
            feel more <em>natural.</em>
          </h2>
          <p>
            Progress can be quiet. It can listen before it speaks. It can
            understand the ground beneath it.
            <br />
            <br />
            ENvoid explores a world where technology works with the landscape —
            helping us see more, understand more, and leave less behind.
          </p>
        </div>
      </section>
      <section className="concept-section envoid-system" id="envoid-system">
        <div className="section-heading">
          <div>
            <p className="eyebrow">02 / A living connection</p>
            <h2>
              Meet the
              <br />
              <em>possibility.</em>
            </h2>
          </div>
          <p>
            The Threshold / A speculative field system.
            <br />
            Explore three ways of seeing.
          </p>
        </div>
        <Tabs
          value={mode}
          onValueChange={(v) => setMode(String(v))}
          className="system-tabs"
        >
          <TabsList className="system-tabs-list">
            {modes.map((m, i) => (
              <TabsTrigger value={m.id} key={m.id}>
                <span>0{i + 1}</span>
                {m.name}
                <MoveUpRight size={16} />
              </TabsTrigger>
            ))}
          </TabsList>
          {modes.map((m) => (
            <TabsContent value={m.id} key={m.id}>
              <div className={'system-view mode-' + m.id}>
                <Image
                  unoptimized
                  src="/images/envoid.webp"
                  alt="The Threshold concept within a living forest"
                  loading="lazy"
                  width="1672"
                  height="941"
                />
                <div className="field-badge">
                  <Radio size={16} />
                  <span>Field view / Concept simulation</span>
                </div>
                <div className="field-readouts">
                  {m.readout.map(([l, v]) => (
                    <div key={l}>
                      <span>{l}</span>
                      <strong>{v}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className="system-description">
                <div>
                  <p className="eyebrow">{m.tag}</p>
                  <h3>{m.headline}</h3>
                </div>
                <p>{m.text}</p>
              </div>
            </TabsContent>
          ))}
        </Tabs>
        <p className="concept-small">
          Illustrative readings and proposed capabilities. No live sensors or
          environmental measurements are connected.
        </p>
      </section>
      <section
        className="concept-section envoid-principles"
        id="envoid-principles"
      >
        <p className="eyebrow">03 / What guides us</p>
        <h2>
          Intelligence,
          <br />
          <em>with a lighter footprint.</em>
        </h2>
        <div className="principle-grid">
          {[
            {
              Icon: Leaf,
              title: 'Belong to the place.',
              text: 'Materials and forms that feel at home in the landscape. The environment comes first.',
            },
            {
              Icon: Sun,
              title: 'Work with the rhythm.',
              text: 'Imagine systems that draw from natural cycles, designed around available light and energy.',
            },
            {
              Icon: Radio,
              title: 'Do more by doing less.',
              text: 'A modular, repairable approach. Useful technology, without unnecessary complexity.',
            },
          ].map(({ Icon, title, text }, i) => (
            <article key={title}>
              <div>
                <Icon size={25} strokeWidth={1} />
                <span>0{i + 1}</span>
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="envoid-connect">
        <Image
          unoptimized
          src="/images/envoid.webp"
          loading="lazy"
          alt="Still water beneath a canopy of conifers"
          width="1672"
          height="941"
        />
        <div>
          <p className="eyebrow">
            The next chapter starts with a conversation.
          </p>
          <h2>
            Let’s grow
            <br />
            <em>something good.</em>
          </h2>
          <button className="button primary" onClick={() => setContact(true)}>
            Make a connection <ArrowUpRight size={18} />
          </button>
        </div>
      </section>
      <footer className="envoid-footer">
        <a href="#envoid-top" className="envoid-logo">
          ENvoid<span>®</span>
        </a>
        <p>
          Where technology meets
          <br />
          the living world.
        </p>
        <span>A concept by Focus.</span>
      </footer>
      <CaseDetails
        name="ENvoid"
        description="A digital experience where technology meets the living world. Cinematic atmosphere, tactile materials and an interactive system story make an abstract vision feel tangible — while keeping the landscape at the heart of it."
        services={[
          'Art direction',
          'Immersive website',
          'Interactive storytelling',
          'Motion & atmosphere',
        ]}
        next="Opal Coffee"
        slug="opal-coffee"
      />
      <ConceptDialog kind="envoid" open={contact} onOpenChange={setContact} />
    </main>
  );
}
