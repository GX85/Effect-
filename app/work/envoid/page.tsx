import type { Metadata } from 'next';
import Envoid from '@/components/focus/Envoid';
export const metadata: Metadata = {
  title: 'ENvoid — A Focus concept',
  description:
    'Where technology meets the living world. Explore an immersive nature and technology concept by Focus.',
};
export default function Page() {
  return <Envoid />;
}
