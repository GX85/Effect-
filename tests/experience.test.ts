import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTACT_MESSAGE,
  emailLink,
  whatsappLink,
  protonWebLink,
  protonAppLink,
} from '../lib/contact.ts';
import { smoothWeatherBlend, weatherWeights } from '../lib/weather.ts';
import { briefText, emptyBrief } from '../lib/project-brief.ts';
test('both contact destinations retain the exact Russian introduction', () => {
  assert.equal(CONTACT_MESSAGE, 'Здравствуйте, хочу обсудить создание проекта');
  assert.equal(new URL(emailLink()).searchParams.get('body'), CONTACT_MESSAGE);
  const whatsapp = new URL(whatsappLink());
  assert.equal(whatsapp.hostname, 'wa.me');
  assert.equal(whatsapp.pathname, '/77478652645');
  assert.equal(whatsapp.searchParams.get('text'), CONTACT_MESSAGE);
});
test('Proton browser fallback retains recipient, subject and complete draft without query injection', () => {
  const subject = 'Проект & Swift',
    body = CONTACT_MESSAGE + '\n#bcc=other@example.com&subject=bad';
  const web = new URL(protonWebLink(subject, body));
  assert.equal(web.origin, 'https://mail.proton.me');
  const mail = new URL(decodeURIComponent(web.hash.slice('#mailto='.length)));
  assert.equal(mail.pathname, 'ItsTeamSwift@proton.me');
  assert.equal(mail.searchParams.get('subject'), subject);
  assert.equal(mail.searchParams.get('body'), body);
  assert.equal(mail.searchParams.get('bcc'), null);
  const intent = protonAppLink('android', subject, body);
  assert.ok(intent.includes('package=ch.protonmail.android;'));
  const fallback = intent.split('S.browser_fallback_url=')[1].split(';')[0];
  assert.equal(decodeURIComponent(fallback), web.href);
  assert.equal(
    protonAppLink('default', subject, body),
    emailLink(subject, body),
  );
});
test('interrupted weather transitions retain brightness and begin at the current sky', () => {
  const start = weatherWeights('storm'),
    rain = weatherWeights('rain'),
    sun = weatherWeights('sun');
  const middle = smoothWeatherBlend(start, rain, 0.4);
  assert.deepEqual(smoothWeatherBlend(middle, sun, 0), middle);
  for (let i = 0; i <= 20; i++) {
    const blend = smoothWeatherBlend(middle, sun, i / 20);
    assert.ok(blend.every((v) => v >= 0 && v <= 1));
    assert.ok(Math.abs(blend.reduce((a, b) => a + b, 0) - 1) < 1e-10);
  }
  assert.deepEqual(smoothWeatherBlend(middle, sun, 1), sun);
});
test('mobile service selection survives the exported project brief', () => {
  assert.ok(
    briefText({ ...emptyBrief, plan: 'Mobile version — $10' }).includes(
      'Package: Mobile version — $10',
    ),
  );
});
