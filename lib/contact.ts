export const FOCUS_EMAIL = 'ItsTeamSwift@proton.me';
export const FOCUS_PHONE = '+77478652645';

export const CONTACT_MESSAGE = 'Здравствуйте, хочу обсудить создание проекта';

export function emailLink(
  subject = 'Создание проекта — Focus',
  body = CONTACT_MESSAGE,
) {
  return `mailto:${FOCUS_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function whatsappLink(body = CONTACT_MESSAGE) {
  return `https://wa.me/${FOCUS_PHONE.replace(/\D/g, '')}?text=${encodeURIComponent(body)}`;
}

export function protonWebLink(
  subject = 'Создание проекта — Focus',
  body = CONTACT_MESSAGE,
) {
  return `https://mail.proton.me/inbox/#mailto=${encodeURIComponent(emailLink(subject, body))}`;
}

export function protonAppLink(
  platform: 'android' | 'default',
  subject = 'Создание проекта — Focus',
  body = CONTACT_MESSAGE,
) {
  if (platform === 'android')
    return `intent:${FOCUS_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}#Intent;scheme=mailto;action=android.intent.action.SENDTO;package=ch.protonmail.android;S.browser_fallback_url=${encodeURIComponent(protonWebLink(subject, body))};end`;
  return emailLink(subject, body);
}
