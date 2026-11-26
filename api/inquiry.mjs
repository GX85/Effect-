import { createHash } from 'node:crypto';

const recipients = ['ItsTeamSwift@proton.me', 'gigabytex50@gmail.com'];
const limit = 16_384;
const reply = (status, message) =>
  Response.json(
    { message, accepted: status === 200 },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );

async function readJson(request) {
  if (Number(request.headers.get('content-length')) > limit)
    throw new Error('large');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('empty');
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new Error('large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function cleanBrief(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const b = {};
  for (const [key, max] of Object.entries({
    business: 120,
    type: 120,
    idea: 4000,
    style: 120,
    name: 120,
    email: 254,
    phone: 80,
    plan: 160,
  })) {
    if (typeof input[key] !== 'string' || input[key].length > max) return null;
    b[key] = input[key].trim();
  }
  for (const key of ['pages', 'features']) {
    const values = input[key];
    if (
      !Array.isArray(values) ||
      values.length > 20 ||
      values.some((v) => typeof v !== 'string' || v.length > 100)
    )
      return null;
    b[key] = values.map((v) => v.trim()).filter(Boolean);
  }
  if (
    b.business.length < 2 ||
    !b.type ||
    b.idea.length < 20 ||
    b.name.length < 2 ||
    !b.style ||
    !b.plan ||
    !b.pages.length ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)
  )
    return null;
  return b;
}

export function createInquiryHandler({ env = process.env, send = fetch } = {}) {
  return async function inquiry(request) {
    if (request.method !== 'POST') {
      const response = reply(405, 'Use POST to send a project inquiry.');
      response.headers.set('Allow', 'POST');
      return response;
    }
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin)
      return reply(403, 'Please send your brief from this website.');
    if (
      !request.headers
        .get('content-type')
        ?.toLowerCase()
        .startsWith('application/json')
    )
      return reply(415, 'Please send a JSON project brief.');
    let input;
    try {
      input = await readJson(request);
    } catch (error) {
      return reply(
        error.message === 'large' ? 413 : 400,
        'The project brief could not be read.',
      );
    }
    if (input?.website)
      return reply(400, 'Please leave the website field empty.');
    const b = cleanBrief(input?.brief);
    if (!b)
      return reply(400, 'Please check your project details and email address.');
    if (!env.RESEND_API_KEY || !env.RESEND_FROM)
      return reply(
        503,
        'Email sending is not connected yet. Your brief is still here — use Proton or WhatsApp below.',
      );

    const text = `Здравствуйте, хочу обсудить создание проекта\n\nFOCUS / PROJECT BRIEF\n\nBusiness: ${b.business}\nBusiness type: ${b.type}\nPackage: ${b.plan}\n\nTHE IDEA\n${b.idea}\n\nStyle: ${b.style}\nPages: ${b.pages.join(', ')}\nFeatures: ${b.features.join(', ') || 'To discuss'}\n\nCONTACT\n${b.name}\n${b.email}\n${b.phone || 'No phone provided'}\n\nScope and pricing to be agreed. No payment collected.`;
    // A retry of the same brief within Resend's 24-hour window must not send duplicates.
    const id = createHash('sha256').update(JSON.stringify(b)).digest('hex');
    try {
      const result = await send('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `focus-inquiry/${id}`,
        },
        body: JSON.stringify({
          from: env.RESEND_FROM,
          to: recipients,
          reply_to: b.email,
          subject: `Focus project: ${b.business.replace(/[\r\n]/g, ' ')}`,
          text,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = await result.json().catch(() => null);
      if (!result.ok || !data?.id)
        return reply(
          result.status === 429 ? 429 : 502,
          'We could not send your brief right now. Please retry, or use Proton or WhatsApp below.',
        );
      return reply(
        200,
        'Your project brief has been accepted for sending to Prism.',
      );
    } catch {
      return reply(
        502,
        'The email service did not respond. Your brief is saved on this page — please retry.',
      );
    }
  };
}

export default { fetch: createInquiryHandler() };
