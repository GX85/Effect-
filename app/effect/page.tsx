import type { Metadata, Viewport } from 'next';
import EffectHome from '@/components/effect/EffectHome';

const title = 'Effect — сайты, лендинги, презентации и игры из одной фразы';
const description =
  'Effect от Prism: бесплатный конструктор на основе Focus. Опишите идею — и получите сайт, лендинг, презентацию или игру за секунду.';

export const metadata: Metadata = {
  metadataBase: new URL('https://focus-nine-chi.vercel.app'),
  title,
  description,
  icons: { icon: '/effect/icon.svg' },
  openGraph: {
    type: 'website',
    title,
    description,
    url: '/effect',
    locale: 'ru_RU',
    images: [{ url: '/effect/og.jpg', width: 1200, height: 630, alt: 'Стеклянная призма раскладывает луч света в радугу' }],
  },
  twitter: { card: 'summary_large_image', title, description, images: ['/effect/og.jpg'] },
};

export const viewport: Viewport = {
  viewportFit: 'cover',
  themeColor: '#000000',
  colorScheme: 'dark',
};

export default function Page() {
  return <EffectHome />;
}
