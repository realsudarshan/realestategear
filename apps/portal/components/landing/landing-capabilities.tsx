import { capabilities } from './data/content';

export default function LandingCapabilities() {
  return (
    <section className="capabilities" aria-label="Platform overview">
      <div className="wrap cap-row">
        {capabilities.map(([num, name, text]) => (
          <div key={num}>
            <strong>{num}</strong>
            <span>{name}</span>
            <p>{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
