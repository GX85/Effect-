export type RapidTier = 'howitworks' | 'iknowhow' | 'imapro';
export const rapidTiers = [
  {
    id: 'howitworks',
    name: 'HowItWorks',
    price: 20,
    detail: 'A considered product page',
  },
  {
    id: 'iknowhow',
    name: 'IknowHow',
    price: 40,
    detail: 'A complete brand experience',
  },
  {
    id: 'imapro',
    name: 'ImAPro',
    price: 90,
    detail: 'An interactive product studio',
  },
] as const;
export const rapidModels = [
  {
    name: 'AERIS R1',
    image: '/images/rapid-aeris.webp',
    category: 'Aero race',
    weight: '7.2',
    depth: '60',
    range: 'Race geometry',
    copy: 'For the breakaway. A sculpted carbon chassis that turns every watt into forward motion.',
  },
  {
    name: 'SUMMIT S2',
    image: '/images/rapid-summit.webp',
    category: 'Climbing',
    weight: '6.8',
    depth: '35',
    range: 'Climbing geometry',
    copy: 'Less between you and the summit. A responsive climbing platform for the road above the clouds.',
  },
  {
    name: 'VECTOR G3',
    image: '/images/rapid-vector.webp',
    category: 'All-road',
    weight: '8.1',
    depth: '45',
    range: 'Endurance geometry',
    copy: 'The road is a suggestion. More clearance, composed handling, and room to go further.',
  },
];
export const rapidFinishes = [
  { name: 'Graphite', value: '#34393c' },
  { name: 'Glacier', value: '#d6e2e6' },
  { name: 'Volt', value: '#c2e76b' },
];
