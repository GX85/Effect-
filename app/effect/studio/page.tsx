import type { Metadata, Viewport } from 'next';
import SiteStudio from '@/components/effect/studio/SiteStudio';

export const metadata: Metadata = {
  title: 'Студия — Effect',
  description: 'Опишите проект словами — агенты Effect спроектируют, нарисуют, напишут и проверят сайт, игру, приложение или презентацию.',
  icons: { icon: '/effect/icon.svg' },
};

export const viewport: Viewport = {
  viewportFit: 'cover',
  themeColor: '#000000',
  colorScheme: 'dark',
};

export default function Page() {
  return <SiteStudio />;
}
