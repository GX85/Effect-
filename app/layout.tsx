import type { Metadata } from 'next';
import {
  Geist,
  Geist_Mono,
  Instrument_Serif,
  Work_Sans,
  Caveat,
} from 'next/font/google';
import './globals.css';
import './refinements.css';
import './rapid.css';
import './rapid-upgrade.css';
import './focus-pro.css';
import './rapid-next.css';
import './effect.css';
import './effect-home.css';

const display = Instrument_Serif({
  variable: '--font-focus-display',
  subsets: ['latin'],
  weight: '400',
});
const work = Work_Sans({
  variable: '--font-focus-body',
  subsets: ['latin'],
  weight: ['300', '400', '500'],
});
const hand = Caveat({
  variable: '--font-focus-hand',
  subsets: ['latin'],
  weight: '400',
});

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  icons: { icon: '/favicon.svg' },
  title: 'Focus — Your idea. Our craft.',
  description:
    'Independent website design and development by Prism. Explore Focus, Rapid, Opal Coffee, and ENvoid, then shape your next project.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${display.variable} ${work.variable} ${hand.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
