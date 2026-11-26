import type { Metadata } from 'next';
import Rapid from '@/components/focus/Rapid';
export const metadata: Metadata = {
  title: 'Rapid / HowItWorks — Prism',
  description:
    'A focused product website for the fictional performance bicycle brand Rapid. HowItWorks package demonstration.',
};
export default function Page() {
  return <Rapid tier="howitworks" />;
}
