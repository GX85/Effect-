'use client';
import { useState, useEffect } from 'react';
import Navbar from './Navbar';
import Hero from './Hero';
import Portfolio from './Portfolio';
import Process from './Process';
import About from './About';
import Pricing from './Pricing';
import FAQ from './FAQ';
import ProjectForm from './ProjectForm';
import Footer from './Footer';
import PrismProjects from './PrismProjects';
import Link from '@/components/focus/PageLink';
export default function FocusSite({
  view = 'home',
}: {
  view?: 'home' | 'work' | 'start';
}) {
  const [selectedPlan, setSelectedPlan] = useState('IknowHow — $40');
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const targets = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.08 },
    );
    targets.forEach((el) => {
      el.classList.add('will-reveal');
      observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);
  return (
    <main className={'focus-pro ' + (view === 'home' ? '' : 'pro-subpage')}>
      <Navbar />
      <div id="main-content" tabIndex={-1} />
      {view === 'home' && (
        <>
          <Hero />
          <Process />
        </>
      )}
      {view !== 'start' && <Portfolio />}
      {view !== 'start' && <PrismProjects />}
      {view === 'home' && (
        <>
          <About />
          <Pricing onSelect={setSelectedPlan} />
          <FAQ />
        </>
      )}
      {view !== 'work' && <ProjectForm selectedPlan={selectedPlan} />}
      {view === 'work' && (
        <section className="section pro-work-cta">
          <p className="eyebrow">Start a project</p>
          <h2>
            Let’s build something
            <br />
            remarkable.
          </h2>
          <Link className="button primary" href="/#project">
            Tell us your idea ↗
          </Link>
        </section>
      )}
      <Footer />
    </main>
  );
}
