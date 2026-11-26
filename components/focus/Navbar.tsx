'use client';
import Link from '@/components/focus/PageLink';
import { useState } from 'react';
import { ArrowUpRight, Menu, X } from 'lucide-react';
export default function Navbar() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Link className="skip-link" href="#main-content">
        Skip to content
      </Link>
      <header className="navbar">
        <Link className="wordmark" href="/" aria-label="Focus home">
          Focus<span>studio</span>
        </Link>
        <nav aria-label="Main navigation">
          <Link href="/work">Work</Link>
          <Link href="/#prism">Prism</Link>
          <Link href="/effect">Effect</Link>
          <Link href="/#process">Process</Link>
          <Link href="/#about">About</Link>
          <Link href="/#pricing">Pricing</Link>
          <Link href="/#faq">FAQ</Link>
        </nav>
        <div className="nav-right">
          <Link className="nav-cta" href="/#project">
            Start a project <ArrowUpRight size={17} />
          </Link>
          <button
            className="menu-button"
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open && (
          <nav
            id="mobile-navigation"
            className="mobile-navigation"
            aria-label="Mobile navigation"
          >
            {[
              'Work',
              'Prism',
              'Effect',
              'Process',
              'About',
              'Pricing',
              'FAQ',
              'Contact',
              'Project',
            ].map((s) => (
              <Link
                href={
                  s === 'Work'
                    ? '/work'
                    : s === 'Prism'
                      ? '/#prism'
                      : s === 'Effect'
                        ? '/effect'
                        : '/#' + s.toLowerCase()
                }
                key={s}
                onClick={() => setOpen(false)}
              >
                {s === 'Project' ? 'Start a project' : s}
                <ArrowUpRight size={20} />
              </Link>
            ))}
          </nav>
        )}
      </header>
    </>
  );
}
