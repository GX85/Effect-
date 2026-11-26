import type { ComponentProps } from 'react';

// These standalone concept sites use native document navigation. This also
// avoids the current Vinext lazy client-router failure in production bundles.
export default function PageLink({ children, ...props }: ComponentProps<'a'>) {
  return <a {...props}>{children}</a>;
}
