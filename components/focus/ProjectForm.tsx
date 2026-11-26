'use client';
import { useState, useEffect, useRef } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  Check,
  Download,
  Mail,
} from 'lucide-react';
import ContactLinks from './ContactLinks';
import { CONTACT_MESSAGE, whatsappLink } from '@/lib/contact';
import ProtonLink from './ProtonLink';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  emptyBrief,
  validateBrief,
  briefText,
  type ProjectBrief,
} from '@/lib/project-brief';
function Choice({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const options =
    id === 'business-type'
      ? [
          'Coffee & hospitality',
          'Retail & e-commerce',
          'Health & wellness',
          'Professional services',
          'Creative & personal brand',
          'Nature & technology',
          'Something else',
        ]
      : [
          'Editorial & minimal',
          'Warm & organic',
          'Bold & expressive',
          'Cinematic & immersive',
          'Not sure — guide me',
        ];
  return (
    <div className="field">
      <label id={id + '-label'} htmlFor={id}>
        {label} <span>*</span>
      </label>
      <Select value={value || null} onValueChange={(v) => onChange(String(v))}>
        <SelectTrigger
          id={id}
          aria-labelledby={id + '-label'}
          className="form-select"
        >
          <SelectValue placeholder="Choose one" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem value={o} key={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
export default function ProjectForm({
  selectedPlan,
}: {
  selectedPlan: string;
}) {
  const [draft, setBrief] = useState<ProjectBrief>({ ...emptyBrief }),
    [step, setStep] = useState(0),
    [error, setError] = useState(''),
    [sending, setSending] = useState(false),
    [website, setWebsite] = useState(''),
    [done, setDone] = useState(false),
    [submittedBrief, setSubmittedBrief] = useState<ProjectBrief | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null),
    wasNavigated = useRef(false);
  const brief =
    done && submittedBrief ? submittedBrief : { ...draft, plan: selectedPlan };
  useEffect(() => {
    if (wasNavigated.current) titleRef.current?.focus();
  }, [step, done]);
  const update = <K extends keyof ProjectBrief>(
    key: K,
    value: ProjectBrief[K],
  ) => {
    setBrief((b) => ({ ...b, [key]: value }));
    setError('');
  };
  const toggle = (key: 'pages' | 'features', value: string) =>
    update(
      key,
      brief[key].includes(value)
        ? brief[key].filter((v) => v !== value)
        : [...brief[key], value],
    );
  function next() {
    const issue = validateBrief(brief, step);
    if (issue) {
      setError(issue);
      return;
    }
    wasNavigated.current = true;
    setStep((s) => s + 1);
    setError('');
  }
  async function submit() {
    if (sending) return;
    for (let i = 0; i < 3; i++) {
      const issue = validateBrief(brief, i);
      if (issue) {
        setError(issue);
        setStep(i);
        return;
      }
    }
    setSending(true);
    setError('');
    try {
      const response = await fetch('/api/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, website }),
        signal: AbortSignal.timeout(20_000),
      });
      const result: unknown = await response.json().catch(() => null);
      const message =
        result &&
        typeof result === 'object' &&
        'message' in result &&
        typeof result.message === 'string'
          ? result.message
          : null;
      const accepted =
        result &&
        typeof result === 'object' &&
        'accepted' in result &&
        result.accepted === true;
      if (!response.ok || !accepted) {
        setError(
          message ||
            'Email sending is unavailable here. Use Proton or WhatsApp below, or download your brief.',
        );
        return;
      }
      wasNavigated.current = true;
      setSubmittedBrief(brief);
      setDone(true);
    } catch {
      setError(
        'We could not reach the email service. Your brief is still here. Retry or use a contact link below.',
      );
    } finally {
      setSending(false);
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([briefText(brief)], { type: 'text/plain;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Focus-project-brief.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const titles = [
    'Tell us about your business.',
    'Make it feel like you.',
    'Let’s stay in touch.',
    'Your idea, in focus.',
  ];
  return (
    <section id="project" className="section project-section">
      <div className="project-intro">
        <p className="eyebrow">
          <span className="status-dot" /> Your next chapter
        </p>
        <h2>
          Let’s build
          <br />
          something
          <br />
          <em>remarkable.</em>
        </h2>
        <p>
          A rough idea. A big ambition.
          <br />
          We’d love to hear it.
        </p>
        <span className="handwritten">
          You bring the spark.
          <br />
          We’ll bring the craft.
        </span>
        <ContactLinks />
        <p className="demo-label">
          Start a conversation · No payment required
          <br />
          Send your brief here, or talk in Proton or WhatsApp.
        </p>
      </div>
      <div className="brief-panel">
        {done ? (
          <div className="success-state">
            <div className="success-check">
              <Check size={30} />
            </div>
            <p className="eyebrow">Thank you for reaching out</p>
            <h3 tabIndex={-1} ref={titleRef}>
              Your idea is
              <br />
              <em>on its way.</em>
            </h3>
            <p>
              Your brief for <strong>{brief.business}</strong> has been
              submitted to Prism. We’ll reply to{' '}
              <strong>{brief.email}</strong>.
            </p>
            <div className="success-note">
              The email service accepted your request. You can keep a copy of
              your brief or contact us below if you want to add anything.
            </div>
            <ProtonLink
              className="button primary"
              subject={`Focus project: ${brief.business.replace(/[\r\n]/g, ' ')}`}
              body={`${CONTACT_MESSAGE}\n\n${briefText(brief)}`}
            >
              Follow up in Proton <Mail size={18} />
            </ProtonLink>
            <a
              className="button brief-download"
              href={whatsappLink(`${CONTACT_MESSAGE}\n\n${briefText(brief)}`)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in WhatsApp <ArrowUpRight size={18} />
            </a>
            <button className="button brief-download" onClick={download}>
              Download your brief <Download size={18} />
            </button>
            <button
              className="text-link"
              onClick={() => {
                setDone(false);
                setStep(3);
              }}
            >
              Back to your summary <ArrowLeft size={16} />
            </button>
          </div>
        ) : (
          <>
            <div className="form-progress">
              <span>0{step + 1} / 04</span>
              <span>
                {
                  [
                    'Your business',
                    'The direction',
                    'Contact details',
                    'Review & request',
                  ][step]
                }
              </span>
              <span>{brief.plan}</span>
            </div>
            <Progress
              value={(step + 1) * 25}
              aria-label="Project brief progress"
              className="brief-progress"
            />
            <h3 tabIndex={-1} ref={titleRef}>
              {titles[step]}
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (step < 3) next();
                else void submit();
              }}
              noValidate
            >
              {step === 0 && (
                <div className="form-fields">
                  <div className="field">
                    <label htmlFor="business-name">
                      Business name <span>*</span>
                    </label>
                    <input
                      id="business-name"
                      autoComplete="organization"
                      placeholder="What should we call you?"
                      value={brief.business}
                      maxLength={120}
                      onChange={(e) => update('business', e.target.value)}
                      required
                    />
                  </div>
                  <Choice
                    id="business-type"
                    label="Business type"
                    value={brief.type}
                    onChange={(v) => update('type', v)}
                  />
                  <div className="field">
                    <label htmlFor="website-idea">
                      Website idea <span>*</span>
                    </label>
                    <textarea
                      id="website-idea"
                      placeholder="Tell us about your idea..."
                      value={brief.idea}
                      onChange={(e) => update('idea', e.target.value)}
                      minLength={20}
                      maxLength={4000}
                      required
                      rows={5}
                    />
                    <span className="field-hint">
                      What do you do, who is it for, and what should the website
                      achieve?
                    </span>
                  </div>
                </div>
              )}
              {step === 1 && (
                <div className="form-fields">
                  <Choice
                    id="desired-style"
                    label="Desired style"
                    value={brief.style}
                    onChange={(v) => update('style', v)}
                  />
                  <fieldset>
                    <legend>
                      Required pages <span>*</span>
                    </legend>
                    <div className="choice-chips">
                      {[
                        'Home',
                        'About',
                        'Services',
                        'Work / Gallery',
                        'Menu',
                        'Shop',
                        'Blog',
                        'Contact',
                      ].map((p) => (
                        <label
                          className={
                            'choice-chip ' +
                            (brief.pages.includes(p) ? 'chosen' : '')
                          }
                          key={p}
                        >
                          <Checkbox
                            checked={brief.pages.includes(p)}
                            onCheckedChange={() => toggle('pages', p)}
                          />
                          {p}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend>
                      Features <span className="optional">Optional</span>
                    </legend>
                    <div className="choice-chips">
                      {[
                        'Contact form',
                        'Booking flow',
                        'E-commerce',
                        'Motion & 3D',
                        'Multiple languages',
                        'Content editing',
                      ].map((p) => (
                        <label
                          className={
                            'choice-chip ' +
                            (brief.features.includes(p) ? 'chosen' : '')
                          }
                          key={p}
                        >
                          <Checkbox
                            checked={brief.features.includes(p)}
                            onCheckedChange={() => toggle('features', p)}
                          />
                          {p}
                        </label>
                      ))}
                    </div>
                    <p className="field-hint">
                      We’ll confirm feasibility and scope together.
                    </p>
                  </fieldset>
                </div>
              )}
              {step === 2 && (
                <div className="form-fields">
                  <div className="field">
                    <label htmlFor="contact-name">
                      Your name <span>*</span>
                    </label>
                    <input
                      id="contact-name"
                      autoComplete="name"
                      value={brief.name}
                      onChange={(e) => update('name', e.target.value)}
                      placeholder="Your full name"
                      maxLength={120}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="contact-email">
                      Email address <span>*</span>
                    </label>
                    <input
                      id="contact-email"
                      autoComplete="email"
                      type="email"
                      value={brief.email}
                      onChange={(e) => update('email', e.target.value)}
                      placeholder="you@yourbusiness.com"
                      maxLength={254}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="contact-phone">
                      Phone or messenger{' '}
                      <span className="optional">Optional</span>
                    </label>
                    <input
                      id="contact-phone"
                      autoComplete="tel"
                      type="tel"
                      value={brief.phone}
                      onChange={(e) => update('phone', e.target.value)}
                      maxLength={80}
                      placeholder="A number or handle"
                    />
                  </div>
                  <p className="form-privacy">
                    When you press Send project brief, your details are sent
                    through Resend to Prism’s two inboxes so we can reply.
                  </p>
                </div>
              )}
              {step === 3 && (
                <div className="brief-summary">
                  <div className="summary-title">
                    <p className="eyebrow">Project brief / {brief.plan}</p>
                    <button
                      className="text-link"
                      type="button"
                      onClick={() => setStep(0)}
                      disabled={sending}
                    >
                      Edit <ArrowUpRight size={14} />
                    </button>
                  </div>
                  <h4>{brief.business}</h4>
                  <p>{brief.type}</p>
                  <div className="summary-idea">{brief.idea}</div>
                  <dl>
                    <div>
                      <dt>Direction</dt>
                      <dd>{brief.style}</dd>
                    </div>
                    <div>
                      <dt>Pages</dt>
                      <dd>{brief.pages.join(', ')}</dd>
                    </div>
                    <div>
                      <dt>Features</dt>
                      <dd>{brief.features.join(', ') || 'To discuss'}</dd>
                    </div>
                    <div>
                      <dt>Contact</dt>
                      <dd>
                        {brief.name}
                        <br />
                        {brief.email}
                        {brief.phone && (
                          <>
                            <br />
                            {brief.phone}
                          </>
                        )}
                      </dd>
                    </div>
                  </dl>
                  <p className="form-privacy">
                    Send this brief to Prism for a reply by email. No
                    payment is collected. Project scope is agreed together.
                  </p>
                </div>
              )}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="inquiry-honeypot" aria-hidden="true">
                <label htmlFor="inquiry-website">Leave this field empty</label>
                <input
                  id="inquiry-website"
                  value={website}
                  tabIndex={-1}
                  autoComplete="off"
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>
              <div className="form-actions">
                {step > 0 ? (
                  <button
                    className="text-link"
                    type="button"
                    disabled={sending}
                    onClick={() => {
                      wasNavigated.current = true;
                      setError('');
                      setStep((s) => s - 1);
                    }}
                  >
                    <ArrowLeft size={16} />
                    Back
                  </button>
                ) : (
                  <span className="field-hint">
                    A few minutes, a fresh start.
                  </span>
                )}
                <button
                  className="button primary"
                  type="submit"
                  disabled={sending}
                  aria-busy={sending}
                >
                  {step < 3
                    ? 'Continue'
                    : sending
                      ? 'Sending…'
                      : 'Send project brief'}
                  <ArrowRight size={17} />
                </button>
              </div>
              {step === 3 && (
                <div className="inquiry-alternatives">
                  <ProtonLink
                    subject={`Focus project: ${brief.business}`}
                    body={`${CONTACT_MESSAGE}\n\n${briefText(brief)}`}
                  >
                    Send via Proton
                  </ProtonLink>
                  <a
                    href={whatsappLink(
                      `${CONTACT_MESSAGE}\n\n${briefText(brief)}`,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Send via WhatsApp
                  </a>
                  <button type="button" onClick={download}>
                    Download brief
                  </button>
                </div>
              )}
            </form>
          </>
        )}
      </div>
    </section>
  );
}
