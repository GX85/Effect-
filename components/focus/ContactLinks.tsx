import { ArrowUpRight, Mail, MessageCircle } from 'lucide-react';
import ProtonLink from './ProtonLink';
import { whatsappLink } from '@/lib/contact';
export default function ContactLinks() {
  return (
    <div className="contact-links" lang="ru">
      <ProtonLink
        className="contact-link"
        aria-label="Написать в Proton"
        title="На iPhone и компьютере выберите Proton почтой по умолчанию"
      >
        <Mail size={18} />
        <span>Написать в Proton</span>
        <ArrowUpRight size={17} />
      </ProtonLink>
      <a
        href={whatsappLink()}
        target="_blank"
        rel="noopener noreferrer"
        className="contact-link"
      >
        <MessageCircle size={18} />
        <span>Написать в WhatsApp</span>
        <ArrowUpRight size={17} />
      </a>
    </div>
  );
}
