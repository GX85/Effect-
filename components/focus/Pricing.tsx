'use client';
import { type RapidTier } from '@/lib/rapid';
import { ArrowUpRight, Check, Monitor, Smartphone } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
export const plans: {
  name: string;
  price: number | null;
  label: string;
  items: string[];
  demoTier?: RapidTier;
  premium?: boolean;
}[] = [
  {
    name: 'HowItWorks',
    price: 20,
    demoTier: 'howitworks',
    label: 'For small projects that need one strong page.',
    items: [
      'A considered single-page website',
      'Responsive design',
      'Project files & handover',
    ],
  },
  {
    name: 'IknowHow',
    price: 40,
    demoTier: 'iknowhow',
    label: 'For companies that need a complete website.',
    items: [
      'A complete multi-page website',
      'Custom visual direction & motion',
      'Responsive design & source files',
    ],
  },
  {
    name: 'Business',
    price: 60,
    label: 'More room for your services and your story.',
    items: [
      'Up to 7 individually designed pages',
      'Service pages & project case studies',
      'Enquiry forms & content structure',
      'Responsive design & source files',
    ],
  },
  {
    name: 'ImAPro',
    price: 90,
    demoTier: 'imapro',
    premium: true,
    label: 'For a distinctive, immersive brand experience.',
    items: [
      'An individually scoped website',
      'Advanced interactions & visual effects',
      'Custom pages & project handover',
    ],
  },
  {
    name: 'Brand Studio',
    price: 150,
    label: 'A visual identity and website, made together.',
    items: [
      'Website in the ImAPro scope',
      'Logo direction & colour palette',
      'Typography & reusable brand guide',
      'Launch assets & full handover',
    ],
  },
  {
    name: 'Custom',
    price: null,
    label: 'A larger idea deserves its own scope.',
    items: [
      'Discovery & individual project roadmap',
      'Scope for specialist integrations',
      'Tailored design & development',
      'Written estimate before work begins',
    ],
  },
];
export default function Pricing({
  onSelect,
}: {
  onSelect: (plan: string) => void;
}) {
  return (
    <section id="pricing" className="section pricing">
      <div className="section-heading reveal">
        <div>
          <p className="eyebrow">Pricing</p>
          <h2>
            A considered start.
            <br />
            <em>Room to grow.</em>
          </h2>
        </div>
        <p>
          Six scopes, one standard of care.
          <br />
          Demo prices in USD. Final scope agreed together.
        </p>
      </div>
      <Tabs defaultValue="websites" className="pricing-tabs">
        <TabsList className="pricing-tab-list" aria-label="Website services">
          <TabsTrigger value="websites">
            <Monitor size={17} /> Websites
          </TabsTrigger>
          <TabsTrigger value="mobile">
            <Smartphone size={17} /> Mobile version <span>$10</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="websites">
          <div className="price-grid">
            {plans.map((p, i) => (
              <article
                className={'price-plan reveal ' + (p.premium ? 'featured' : '')}
                key={p.name}
              >
                <div className="price-title">
                  <span>0{i + 1}</span>
                  {p.premium && (
                    <span className="popular">The premium experience</span>
                  )}
                </div>
                <h3>{p.name}</h3>
                <p>{p.label}</p>
                <div className="price">
                  {p.price === null ? (
                    <strong className="quote-price">Let’s talk</strong>
                  ) : (
                    <>
                      <sup>$</sup>
                      {p.price}
                      <span>/ demo project</span>
                    </>
                  )}
                </div>
                <ul>
                  {p.items.map((item) => (
                    <li key={item}>
                      <Check size={15} />
                      {item}
                    </li>
                  ))}
                </ul>
                <a
                  href="#project"
                  className={'button ' + (p.premium ? 'primary' : '')}
                  onClick={() =>
                    onSelect(
                      p.name +
                        (p.price === null
                          ? ' — individual quote'
                          : ' — $' + p.price),
                    )
                  }
                >
                  Start your project <ArrowUpRight size={18} />
                </a>
                {p.demoTier && (
                  <a
                    className="plan-demo-link"
                    href={'/work/rapid/' + p.demoTier}
                  >
                    See this package in action: Rapid <ArrowUpRight size={15} />
                  </a>
                )}
              </article>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="mobile">
          <article className="mobile-service">
            <div className="mobile-service-story">
              <p className="eyebrow">
                <Smartphone size={18} /> Small screen. Full experience.
              </p>
              <h3>
                Your website.
                <br />
                <em>Made for thumbs.</em>
              </h3>
              <p>
                A dedicated mobile version for an existing desktop website.
                Thoughtful layouts, easy navigation and a lighter experience on
                every phone.
              </p>
              <span className="handwritten">
                Good design fits in your hand.
              </span>
            </div>
            <div className="mobile-service-details">
              <div className="price">
                <sup>$</sup>10<span>/ mobile version</span>
              </div>
              <ul>
                {[
                  'Layouts adapted to phone screens',
                  'Touch-friendly menus and controls',
                  'Optimized images and lighter effects',
                  'Responsive frontend files',
                ].map((item) => (
                  <li key={item}>
                    <Check size={16} />
                    {item}
                  </li>
                ))}
              </ul>
              <a
                className="button primary"
                href="#project"
                onClick={() => onSelect('Mobile version — $10')}
              >
                Request a mobile version <ArrowUpRight size={18} />
              </a>
              <p className="mobile-scope">
                For adapting an existing desktop site. New Focus website
                packages already include responsive design. Scope agreed before
                work begins.
              </p>
            </div>
          </article>
        </TabsContent>
      </Tabs>
      <p className="pricing-footnote">
        Website design and development. Hosting and cybersecurity are not
        included. <a href="#faq">See the details ↗</a>
      </p>
    </section>
  );
}
