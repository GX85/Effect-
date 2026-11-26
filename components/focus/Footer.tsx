import Link from '@/components/focus/PageLink';
import ContactLinks from './ContactLinks';
export default function Footer() {
  return (
    <footer className="pro-footer">
      <div className="pro-footer-inner">
        <div className="pro-footer-top">
          <Link className="footer-wordmark" href="/#top">
            Focus<span className="pro-hand">your idea, our craft</span>
          </Link>
          <nav aria-label="Footer navigation">
            {['Work', 'Process', 'About', 'FAQ'].map((s) => (
              <Link key={s} href={'/#' + s.toLowerCase()}>
                {s}
              </Link>
            ))}
            <Link href="/#prism">Prism projects</Link>
            <Link href="/effect">Effect</Link>
            <Link href="/#project">Start a project ↗</Link>
          </nav>
        </div>
        <div id="contact" className="pro-contact">
          <p className="eyebrow">Let’s talk about your idea</p>
          <ContactLinks />
        </div>
        <div className="pro-footer-legal">
          <p>
            Focus provides website design and development services. Hosting,
            deployment and cybersecurity services are not included unless
            explicitly stated.
          </p>
          <div>
            © {new Date().getFullYear()} Focus Studio
            <strong>Created by: Prism</strong>
          </div>
        </div>
      </div>
    </footer>
  );
}
