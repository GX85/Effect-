import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInquiryHandler } from '../api/inquiry.mjs';

const brief = {
  business: 'Example Studio',
  type: 'Creative',
  idea: 'A website for our independent design studio.',
  style: 'Editorial',
  pages: ['Home', 'Contact'],
  features: ['Motion & 3D'],
  name: 'Alex',
  email: 'alex@example.com',
  phone: '',
  plan: 'ImAPro — $90',
};
const env = {
  RESEND_API_KEY: 'test-only-not-a-real-key',
  RESEND_FROM: 'Prism <hello@example.com>',
};
const request = (body = { brief }, headers = {}) =>
  new Request('https://focus.example/api/inquiry', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://focus.example',
      ...headers,
    },
    body: JSON.stringify(body),
  });

test('sends a plain-text inquiry only to both configured inboxes, with safe reply-to and repeatable idempotency', async () => {
  const calls = [];
  const handler = createInquiryHandler({
    env,
    send: async (url, options) => {
      calls.push({ url, ...options });
      return Response.json({ id: 'provider-id' });
    },
  });
  const malicious = {
    ...brief,
    to: ['intruder@example.com'],
    from: 'intruder@example.com',
    business: 'Studio\r\nBcc: intruder@example.com',
  };
  assert.equal((await handler(request({ brief: malicious }))).status, 200);
  assert.equal((await handler(request({ brief: malicious }))).status, 200);
  const sent = JSON.parse(calls[0].body);
  assert.deepEqual(sent.to, [
    'ItsTeamSwift@proton.me',
    'gigabytex50@gmail.com',
  ]);
  assert.equal(sent.from, env.RESEND_FROM);
  assert.equal(sent.reply_to, brief.email);
  assert.equal(sent.html, undefined);
  assert.ok(sent.text.includes(brief.idea));
  assert.doesNotMatch(sent.subject, /[\r\n]/);
  assert.equal(
    calls[0].headers['Idempotency-Key'],
    calls[1].headers['Idempotency-Key'],
  );
});

test('rejects bad contacts, malformed data, cross-origin requests, and oversized streams before sending', async () => {
  let calls = 0;
  const handler = createInquiryHandler({
    env,
    send: async () => {
      calls++;
      return Response.json({ id: 'id' });
    },
  });
  for (const changed of [
    { email: 'x@example.com\r\nBcc:y@example.com' },
    { idea: 'short' },
    { pages: [] },
    { features: [4] },
    { business: 42 },
    { idea: 'a'.repeat(4001) },
  ]) {
    assert.equal(
      (await handler(request({ brief: { ...brief, ...changed } }))).status,
      400,
    );
  }
  assert.equal((await handler(request({ brief, website: 'bot' }))).status, 400);
  assert.equal(
    (await handler(request({ brief }, { Origin: 'https://unrelated.example' })))
      .status,
    403,
  );
  assert.equal(
    (await handler(request({ brief, padding: 'x'.repeat(17_000) }))).status,
    413,
  );
  assert.equal(
    (await handler(new Request('https://focus.example/api/inquiry'))).status,
    405,
  );
  assert.equal(calls, 0);
});

test('reports missing configuration and provider failures without claiming acceptance or exposing credentials', async () => {
  const offline = await createInquiryHandler({ env: {} })(request());
  assert.equal(offline.status, 503);
  assert.equal((await offline.json()).accepted, false);
  for (const send of [
    async () =>
      Response.json({ message: 'secret provider detail' }, { status: 403 }),
    async () => Response.json({}, { status: 200 }),
    async () => {
      throw new Error('network');
    },
  ]) {
    const result = await createInquiryHandler({ env, send })(request());
    assert.equal(result.status, 502);
    const body = await result.json();
    assert.equal(body.accepted, false);
    assert.doesNotMatch(
      JSON.stringify(body),
      /test-only|secret provider detail/,
    );
  }
  const rateLimited = await createInquiryHandler({
    env,
    send: async () => Response.json({}, { status: 429 }),
  })(request());
  assert.equal(rateLimited.status, 429);
});
