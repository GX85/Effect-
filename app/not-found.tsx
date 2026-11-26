import Link from '@/components/focus/PageLink';
export default function NotFound() {
  return (
    <main className="not-found">
      <Link className="wordmark" href="/">
        focus<span>®</span>
      </Link>
      <p className="eyebrow">404 / A little out of focus</p>
      <h1>
        This page has
        <br />
        <em>wandered off.</em>
      </h1>
      <p>Let’s get you back to the good stuff.</p>
      <Link className="button primary" href="/">
        Back to Focus ↗
      </Link>
    </main>
  );
}
