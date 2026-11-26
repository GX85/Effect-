const questions = [
  [
    'Does Focus provide cybersecurity?',
    'No. Focus provides website design and development, not cybersecurity services, security monitoring, or security guarantees.',
  ],
  [
    'Does Focus host websites?',
    'Hosting and deployment are not included in the website packages. You receive the files to deploy independently. One-time deployment assistance can be scoped separately, with a demo starting price of $20; ongoing hosting fees and third-party services are separate.',
  ],
  [
    'What do I receive?',
    'The finished website project, its source code and assets included in your agreed scope, plus handover instructions. Any third-party licenses are identified separately.',
  ],
  [
    'Can you build a custom website?',
    'Yes. Tell us about your business, the people you want to reach, and the experience you have in mind. We shape a scope around the project.',
  ],
  [
    'Can I request a specific design?',
    'Absolutely. Share references, colours, styles, pages, and features. The more we understand your vision, the more personal the result can be.',
  ],
  [
    'What is the $10 mobile version?',
    'A mobile adaptation of an existing desktop website, with layouts and navigation designed for phones. New Focus website packages already include responsive design. We agree on scope before work begins.',
  ],
  [
    'Are the portfolio projects and prices real?',
    'Rapid, Opal Coffee and ENvoid are original studio concepts, not commissioned client projects. Portfolio forms and displayed prices are demonstrations. The Focus project form prepares a draft in Proton or WhatsApp. Review the details and press Send in the app. No payment is collected on this site.',
  ],
];
export default function FAQ() {
  return (
    <section id="faq" className="section faq">
      <div className="faq-intro">
        <p className="eyebrow">FAQ &amp; terms</p>
        <h2>
          Clear answers,
          <br />
          <em>before you commit.</em>
        </h2>
        <p>
          Here’s what to expect
          <br />
          when we work together.
        </p>
      </div>
      <div className="faq-list">
        {questions.map(([q, a], i) => (
          <details key={q}>
            <summary>
              <span className="faq-number">0{i + 1}</span>
              {q}
              <span className="faq-plus" aria-hidden="true">
                +
              </span>
            </summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
