import type { Metadata } from 'next';
import Rapid from '@/components/focus/Rapid';
export const metadata: Metadata = {
  title: 'Rapid / IknowHow — Prism',
  description:
    'Explore three fictional professional bicycles in a complete Rapid brand experience. IknowHow package demonstration.',
};
export default function Page() {
  return <Rapid tier="iknowhow" />;
}
