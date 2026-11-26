'use client';
import Image from 'next/image';
import { useState } from 'react';
import { ArrowUpRight, ArrowDown, Sun, Coffee } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CaseBar, CaseDetails } from './CaseStudy';
import ConceptDialog from './ConceptDialog';
const menu = [
  {
    name: 'The house espresso',
    notes: 'Chocolate, toasted hazelnut, a long finish.',
    price: '3.50',
    category: 'Coffee',
    tag: 'Our daily ritual',
  },
  {
    name: 'Flat white',
    notes: 'Double espresso, silky milk, nothing more.',
    price: '4.50',
    category: 'Coffee',
    tag: '',
  },
  {
    name: 'Slow pour',
    notes: 'A rotating single origin, brewed by hand.',
    price: '5.00',
    category: 'Coffee',
    tag: '',
  },
  {
    name: 'Iced oat latte',
    notes: 'Espresso over ice, with a little oat softness.',
    price: '5.50',
    category: 'Coffee',
    tag: '',
  },
  {
    name: 'Almond morning',
    notes: 'A flaky almond croissant, baked fresh.',
    price: '4.50',
    category: 'Bakery',
    tag: 'The perfect pairing',
  },
  {
    name: 'A slice of sunshine',
    notes: 'Lemon & olive oil cake, a spoon of cream.',
    price: '5.00',
    category: 'Bakery',
    tag: '',
  },
];
export default function OpalCoffee() {
  const [booking, setBooking] = useState(false),
    [category, setCategory] = useState('All');
  return (
    <main className="opal-page">
      <CaseBar other="envoid" label="01 / Opal Coffee" />
      <header className="concept-nav">
        <a className="opal-logo" href="#opal-top">
          opal<span>COFFEE HOUSE</span>
        </a>
        <nav aria-label="Opal navigation">
          <a href="#opal-story">Our story</a>
          <a href="#opal-menu">The menu</a>
          <a href="#opal-visit">Find your moment</a>
        </nav>
        <button className="concept-nav-cta" onClick={() => setBooking(true)}>
          A table for you <ArrowUpRight size={16} />
        </button>
      </header>
      <section id="opal-top" className="opal-hero">
        <Image
          unoptimized
          src="/images/opal-coffee.webp"
          alt="Espresso in a ceramic cup on a warm travertine coffee bar"
          width="1672"
          height="941"
          fetchPriority="high"
        />
        <div className="opal-hero-copy">
          <p className="eyebrow">Good coffee. A little stillness.</p>
          <h1>
            A slower kind
            <br />
            of <em>morning.</em>
          </h1>
          <p>
            Thoughtfully sourced. Patiently brewed.
            <br />
            Always a moment worth staying for.
          </p>
          <a className="button" href="#opal-menu">
            Discover the menu <ArrowDown size={18} />
          </a>
        </div>
        <div className="opal-hero-bottom">
          <span>
            <Sun size={16} /> Made for the everyday ritual.
          </span>
          <span>Come as you are. Stay a little longer.</span>
        </div>
      </section>
      <div className="opal-marquee" aria-hidden="true">
        <span>Good mornings</span>
        <Coffee strokeWidth={1} />
        <em>Slow moments</em>
        <Coffee strokeWidth={1} />
        <span>Better coffee</span>
      </div>
      <section id="opal-story" className="opal-story concept-section">
        <div>
          <p className="eyebrow">01 / A space to exhale</p>
          <h2>
            There’s a little
            <br />
            beauty in
            <br />
            <em>taking your time.</em>
          </h2>
          <span className="handwritten">Your usual, made special.</span>
        </div>
        <div className="opal-story-content">
          <p>
            That first sip. The light through the window. A familiar face behind
            the bar.
          </p>
          <p>
            Opal is our idea of a neighbourhood coffee house: carefully chosen
            beans, simple things made well, and a warm place to pause in a world
            that rarely does.
          </p>
          <div className="opal-principles">
            <div>
              <span>01</span>
              <h3>Care in the cup</h3>
              <p>Seasonal coffees chosen for character.</p>
            </div>
            <div>
              <span>02</span>
              <h3>Room to linger</h3>
              <p>Natural materials. A gentler pace.</p>
            </div>
          </div>
        </div>
      </section>
      <section id="opal-menu" className="concept-section opal-menu">
        <div className="section-heading">
          <div>
            <p className="eyebrow">02 / The simple pleasures</p>
            <h2>
              Something <em>good.</em>
            </h2>
          </div>
          <p>
            A considered menu for unhurried days.
            <br />
            Concept menu · Illustrative prices in USD.
          </p>
        </div>
        <Tabs value={category} onValueChange={(v) => setCategory(String(v))}>
          <TabsList className="menu-tabs">
            {['All', 'Coffee', 'Bakery'].map((c) => (
              <TabsTrigger key={c} value={c}>
                {c}
              </TabsTrigger>
            ))}
          </TabsList>
          {['All', 'Coffee', 'Bakery'].map((c) => (
            <TabsContent value={c} key={c}>
              <div className="menu-items">
                {menu
                  .filter((m) => c === 'All' || m.category === c)
                  .map((m) => (
                    <article className="menu-item" key={m.name}>
                      <div>
                        <p className="menu-category">
                          {m.category}
                          {m.tag && ' / ' + m.tag}
                        </p>
                        <h3>{m.name}</h3>
                        <p>{m.notes}</p>
                      </div>
                      <span>${m.price}</span>
                    </article>
                  ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
        <p className="menu-note">
          Oat milk is always an option. Please discuss allergens with a team
          before ordering at a real venue.
        </p>
      </section>
      <section className="opal-image-break">
        <Image
          unoptimized
          src="/images/opal-coffee.webp"
          alt="The texture of hand-glazed ceramics and morning coffee"
          loading="lazy"
          width="1672"
          height="941"
        />
        <div>
          <p className="eyebrow">The little things are the big things.</p>
          <h2>
            Stay for
            <br />
            <em>another cup.</em>
          </h2>
        </div>
      </section>
      <section id="opal-visit" className="concept-section opal-visit">
        <div>
          <p className="eyebrow">03 / Make a little time</p>
          <h2>
            A table.
            <br />A good coffee.
            <br />
            <em>Your moment.</em>
          </h2>
        </div>
        <div>
          <p>
            An imagined neighbourhood corner, with real attention to every
            detail. Explore how a table reservation could feel.
          </p>
          <dl>
            <div>
              <dt>Weekday mornings</dt>
              <dd>07:30 – 17:00</dd>
            </div>
            <div>
              <dt>Slower weekends</dt>
              <dd>08:00 – 16:00</dd>
            </div>
          </dl>
          <p className="concept-small">
            Illustrative opening hours for this concept.
          </p>
          <button
            className="button opal-button"
            onClick={() => setBooking(true)}
          >
            Find your table <ArrowUpRight size={18} />
          </button>
        </div>
      </section>
      <footer className="opal-footer">
        <a href="#opal-top" className="opal-logo">
          opal<span>GOOD COFFEE, GOOD COMPANY.</span>
        </a>
        <p>
          A slower kind of morning.
          <br />A concept by Focus.
        </p>
      </footer>
      <CaseDetails
        name="Opal Coffee"
        description="A digital identity crafted for a modern coffee house. Warm materials, expressive editorial typography and a simple reservation journey bring the feeling of a neighbourhood café into the browser."
        services={[
          'Brand direction',
          'Website design',
          'Interactive menu',
          'Reservation concept',
        ]}
        next="ENvoid"
        slug="envoid"
      />
      <ConceptDialog kind="coffee" open={booking} onOpenChange={setBooking} />
    </main>
  );
}
