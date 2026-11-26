const qualities = [
  ['Strong UI/UX', 'Interfaces that guide a visitor to one clear action.'],
  [
    'Considered structure',
    'Content ordered the way customers actually decide.',
  ],
  [
    'Modern visual system',
    'Type, colour and spacing defined once, used everywhere.',
  ],
  ['Quality frontend', 'Clean, componentised code you own after handover.'],
  ['Responsive design', 'Composed for desktop, laptop, tablet and phone.'],
  ['Motion & 3D', 'Atmosphere and depth — only where it earns its weight.'],
];
export default function About() {
  return (
    <section id="about" className="section pro-about">
      <div className="pro-about-intro reveal">
        <p className="eyebrow">About Focus</p>
        <h2>
          We build
          <br />
          digital presence.
        </h2>
        <p>
          Focus helps small and local businesses look as credible online as
          they are in person. A bakery, a clinic, a workshop, a coffee house —
          the craft is the same as for a large brand, only the scope changes.
        </p>
        <p>
          We design and develop the website itself. You keep the finished
          project and publish it wherever you want, whenever you want.
        </p>
        <span className="pro-hand">made by people, one project at a time</span>
      </div>
      <div className="pro-qualities">
        {qualities.map(([name, desc], i) => (
          <article key={name}>
            <span className="eyebrow">0{i + 1}</span>
            <h3>{name}</h3>
            <p>{desc}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
