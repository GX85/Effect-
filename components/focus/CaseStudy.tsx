import Link from '@/components/focus/PageLink';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
export function CaseBar({ other, label }: { other: string; label: string }) {
  return (
    <div className="case-bar">
      <Link href="/#work">
        <ArrowLeft size={14} /> Back to Focus
      </Link>
      <span>{label} · Original studio concept</span>
      <Link href={'/work/' + other}>
        Next project <ArrowUpRight size={14} />
      </Link>
    </div>
  );
}
export function CaseDetails({
  name,
  description,
  services,
  next,
  slug,
}: {
  name: string;
  description: string;
  services: string[];
  next: string;
  slug: string;
}) {
  return (
    <section className="case-details">
      <div className="case-details-inner">
        <p className="eyebrow">Behind the experience / Focus Studio</p>
        <div className="case-description">
          <h2>
            {name}
            <em>, in focus.</em>
          </h2>
          <div>
            <p>{description}</p>
            <div className="case-services">
              {services.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>
            <p className="case-disclosure">
              An independent concept project. The brand, products, pricing and
              interactions are demonstrations, not an operating business.
            </p>
          </div>
        </div>
        <div className="case-next">
          <Link className="button primary" href="/#project">
            Create something like this <ArrowUpRight size={18} />
          </Link>
          <Link className="text-link" href={'/work/' + slug}>
            Explore {next} <ArrowUpRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}
