'use client';
import type { ComponentProps } from 'react';
import { emailLink } from '@/lib/contact';
import { openProton } from '@/lib/open-proton';
type Props = Omit<ComponentProps<'a'>, 'href' | 'onClick'> & {
  subject?: string;
  body?: string;
};
export default function ProtonLink({
  subject,
  body,
  children,
  ...props
}: Props) {
  return (
    <a
      {...props}
      href={emailLink(subject, body)}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
          return;
        event.preventDefault();
        openProton(subject, body);
      }}
    >
      {children}
    </a>
  );
}
