import type { Metadata } from 'next';
import OpalCoffee from '@/components/focus/OpalCoffee';
export const metadata: Metadata = {
  title: 'Opal Coffee — A Focus concept',
  description:
    'A slower kind of morning. Explore the Opal Coffee concept website, seasonal menu and demo table reservation.',
};
export default function Page() {
  return <OpalCoffee />;
}
