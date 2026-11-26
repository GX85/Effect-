import type { Metadata } from 'next';
import Rapid from '@/components/focus/Rapid';
export const metadata: Metadata = {
  title: 'Rapid / ImAPro — Prism',
  description:
    'The Rapid signature experience: a fictional bicycle collection and a detailed interactive 3D engineering study.',
};
export default function Page() {
  return <Rapid tier="imapro" />;
}
