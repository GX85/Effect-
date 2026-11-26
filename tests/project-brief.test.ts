import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyBrief, validateBrief, briefText } from '../lib/project-brief.ts';
import { emailLink, FOCUS_EMAIL, FOCUS_PHONE } from '../lib/contact.ts';
const valid = {
  ...emptyBrief,
  business: 'Small Studio',
  type: 'Professional services',
  idea: 'A considered portfolio for our independent design business.',
  name: 'Alex Rivers',
  email: 'alex@example.com',
};
test('empty business information cannot advance', () => {
  assert.match(validateBrief(emptyBrief, 0) ?? '', /business name/);
  assert.match(validateBrief({ ...valid, type: '' }, 0) ?? '', /business type/);
  assert.match(
    validateBrief({ ...valid, idea: 'Too short' }, 0) ?? '',
    /20 characters/,
  );
});
test('a website must include at least one page', () => {
  assert.match(validateBrief({ ...valid, pages: [] }, 1) ?? '', /at least one/);
  assert.equal(validateBrief({ ...valid, pages: ['Home'] }, 1), null);
});
test('contact validation rejects incomplete or malformed contact details', () => {
  for (const email of [
    'alex',
    'alex@',
    'alex@example',
    'alex example@example.com',
  ])
    assert.match(validateBrief({ ...valid, email }, 2) ?? '', /valid email/);
  assert.match(validateBrief({ ...valid, name: ' ' }, 2) ?? '', /name/);
  assert.equal(
    validateBrief({ ...valid, email: '  alex@example.com  ' }, 2),
    null,
  );
});
test('a complete brief passes all steps and retains optional choices in export', () => {
  for (let step = 0; step < 3; step++)
    assert.equal(validateBrief(valid, step), null);
  const exported = briefText({
    ...valid,
    features: ['Motion & 3D', 'Booking flow'],
    plan: 'ImAPro',
  });
  assert.ok(exported.includes('Small Studio'));
  assert.ok(exported.includes('Motion & 3D, Booking flow'));
  assert.ok(exported.includes('ImAPro'));
  assert.ok(exported.includes('scope and pricing to be agreed'));
  assert.ok(exported.includes('No payment collected'));
});
test('contact links preserve the supplied destination and encode draft content safely', () => {
  const subject = 'Focus project: Кофе & craft?';
  const body = briefText({
    ...valid,
    business: 'Кофе & craft?',
    idea: 'Line one & more\nLine two: #details?bcc=someone@example.com',
  });
  const link = new URL(emailLink(subject, body));
  assert.equal(link.protocol, 'mailto:');
  assert.equal(link.pathname, 'ItsTeamSwift@proton.me');
  assert.equal(FOCUS_EMAIL, 'ItsTeamSwift@proton.me');
  assert.equal(FOCUS_PHONE, '+77478652645');
  assert.equal(link.searchParams.get('subject'), subject);
  assert.equal(link.searchParams.get('body'), body);
  assert.equal(link.searchParams.get('bcc'), null);
});
