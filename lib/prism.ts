export type PrismProject = {
  id: string;
  title: string;
  kind: string;
  desc: string;
  tags: string[];
  site: string;
  repo: string;
};

export const prismProjects: PrismProject[] = [
  {
    id: 'effect',
    title: 'Effect',
    kind: 'Website, slides & game builder',
    desc: 'Describe an idea in one sentence and get a website, landing page, presentation or browser game in a second. Edit it in chat or right in the preview, then download a single HTML file. Free, built on Focus, with an optional Claude AI mode.',
    tags: ['React', 'Three.js', 'Claude API', 'Free'],
    site: '/effect',
    repo: 'https://github.com/GX85/Focus',
  },
  {
    id: 'flowtouch',
    title: 'FlowTouch',
    kind: 'Gesture control for Windows',
    desc: 'Control your computer with hand gestures through a webcam: 126 gesture patterns bound to keys, mouse actions, websites and apps. A spatial glass landing page plus a downloadable Studio.',
    tags: ['MediaPipe', 'Three.js', 'WebView2', 'Python'],
    site: 'https://flowtouch-peach.vercel.app/',
    repo: 'https://github.com/GX85/FlowTouch',
  },
  {
    id: 'focus-ai',
    title: 'Focus AI',
    kind: 'AI assistant & agent team',
    desc: 'A free AI assistant that answers in about a second and builds games, websites and presentations right in the chat. Aeronus mode lets Claude, GPT, Gemini and other agents work on one task together.',
    tags: ['TypeScript', 'Vite', 'Vercel', 'Multi-model'],
    site: 'https://focus-agents.vercel.app/',
    repo: 'https://github.com/GX85/Landing-for-Claude-code-',
  },
  {
    id: 'onlyguests',
    title: 'OnlyGuests',
    kind: 'Almaty city guide',
    desc: 'A guide to cafés, restaurants, bars and shops in Almaty with 2GIS ratings, menus, a map and an AI “Where to go?” helper. AI agents re-check ratings every six hours. Telegram and WhatsApp bots included.',
    tags: ['Leaflet', 'AI agents', 'Telegram bot', 'RU · KZ · EN'],
    site: 'https://onlyguests.vercel.app/',
    repo: 'https://github.com/GX85/OnlyGuests',
  },
  {
    id: 'ultrasquad',
    title: 'UltraSquad',
    kind: 'Windows security dashboard',
    desc: 'A local dashboard for Windows Defender, inbound request blocks and coordinated security checks. The live site shows the interface; the Windows app runs on your computer.',
    tags: ['Windows Defender', 'Node.js', 'Local dashboard'],
    site: 'https://ultrasquad.vercel.app/',
    repo: 'https://github.com/GX85/UltraSquad-',
  },
];
