import { CONTACT_MESSAGE, protonWebLink, protonAppLink } from './contact';

// iOS and desktop use the OS email handler; Proton must be the default mail app.
export function openProton(
  subject = 'Создание проекта — Focus',
  body = CONTACT_MESSAGE,
) {
  const web = protonWebLink(subject, body);
  const cleanup = () => {
    clearTimeout(fallback);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', cleanup);
    window.removeEventListener('blur', cleanup);
  };
  const onVisibility = () => {
    if (document.hidden) cleanup();
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', cleanup, { once: true });
  window.addEventListener('blur', cleanup, { once: true });
  const fallback = setTimeout(() => {
    cleanup();
    if (!document.hidden) window.location.assign(web);
  }, 2500);
  try {
    window.location.assign(
      protonAppLink(
        /Android/i.test(navigator.userAgent) ? 'android' : 'default',
        subject,
        body,
      ),
    );
  } catch {
    cleanup();
    window.location.assign(web);
  }
}
