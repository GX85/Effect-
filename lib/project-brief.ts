export type ProjectBrief = {
  business: string;
  type: string;
  idea: string;
  style: string;
  pages: string[];
  features: string[];
  name: string;
  email: string;
  phone: string;
  plan: string;
};
export const emptyBrief: ProjectBrief = {
  business: '',
  type: '',
  idea: '',
  style: 'Editorial & minimal',
  pages: ['Home', 'About', 'Contact'],
  features: [],
  name: '',
  email: '',
  phone: '',
  plan: 'IknowHow — $40',
};
export function validateBrief(b: ProjectBrief, step: number): string | null {
  if (step === 0) {
    if (b.business.trim().length < 2)
      return 'Please enter your business name (at least 2 characters).';
    if (!b.type) return 'Please choose your business type.';
    if (b.idea.trim().length < 20)
      return 'Tell us a little more about your idea (at least 20 characters).';
  }
  if (step === 1 && b.pages.length === 0)
    return 'Choose at least one page for your website.';
  if (step === 2) {
    if (b.name.trim().length < 2) return 'Please enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email.trim()))
      return 'Please enter a valid email address.';
  }
  return null;
}
export function briefText(b: ProjectBrief): string {
  return `FOCUS / PROJECT BRIEF\nProject inquiry — scope and pricing to be agreed. No payment collected.\n\nBusiness: ${b.business}\nBusiness type: ${b.type}\nPackage: ${b.plan}\n\nTHE IDEA\n${b.idea}\n\nStyle: ${b.style}\nPages: ${b.pages.join(', ')}\nFeatures: ${b.features.length ? b.features.join(', ') : 'To discuss'}\n\nCONTACT\n${b.name.trim()}\n${b.email.trim()}\n${b.phone || 'No phone provided'}\n\nWebsite design and development only. Hosting, deployment and cybersecurity are not included unless explicitly agreed.`;
}
