'use client';
import { useState } from 'react';
const steps = [
  {
    name: 'Tell us',
    description:
      'You tell us about your company, your customers and the idea you carry around. No briefs, no jargon — a conversation.',
    tags: [
      'Discovery call',
      'Business & audience notes',
      'Reference gathering',
    ],
  },
  {
    name: 'Shape',
    description:
      'We turn the idea into structure, user experience and a visual concept — the whole site decided before a line of code.',
    tags: ['Sitemap & content order', 'UX flows', 'Visual direction'],
  },
  {
    name: 'Build',
    description:
      'Our team develops the full website: typography, motion, responsive layouts and the interactive details that make it feel considered.',
    tags: ['Frontend development', 'Motion & interaction', 'Responsive QA'],
  },
  {
    name: 'Deliver',
    description:
      'You receive the finished project — files and code, ready for you to publish wherever you like.',
    tags: ['Project handover', 'Source files & code', 'Walkthrough notes'],
  },
];
export default function Process() {
  const [active, setActive] = useState(0);
  return (
    <section id="process" className="section pro-process">
      <div className="pro-process-intro reveal">
        <p className="eyebrow">How it works</p>
        <h2>
          Four calm steps
          <br />
          from idea
          <br />
          to delivery.
        </h2>
        <p>
          Every project follows the same measured rhythm. You always know where
          the work stands and what happens next.
        </p>
        <span className="pro-hand">no guesswork, ever</span>
      </div>
      <div className="pro-steps">
        {steps.map((s, i) => (
          <button
            key={s.name}
            className={'pro-step ' + (active === i ? 'active' : '')}
            onClick={() => setActive(i)}
            aria-expanded={active === i}
            aria-controls={'step-detail-' + i}
          >
            <span className="pro-step-number">0{i + 1}</span>
            <div>
              <h3>{s.name}</h3>
              <p>{s.description}</p>
              <div
                className="pro-step-tags"
                id={'step-detail-' + i}
                hidden={active !== i}
              >
                {s.tags.map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
