export function LandingLogo() {
  return (
    <a className="brand" href="#top" aria-label="realestate-gear home">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 44 44" role="presentation">
          <path className="brand-gear" d="M22 3.5l3 2.8 4-.4 1.8 3.6 3.7 1.7-.4 4 2.9 3-2.9 3 .4 4-3.7 1.7-1.8 3.6-4-.4-3 2.8-3-2.8-4 .4-1.8-3.6-3.7-1.7.4-4-2.9-3 2.9-3-.4-4L10.2 9.5 12 5.9l4 .4z" />
          <path className="brand-house" d="M13 20.5L22 13l9 7.5v8.8H13z" />
          <path className="brand-cut" d="M19 29.3v-6h6v6" />
        </svg>
      </span>
      <span className="brand-copy"><strong>realestate</strong><span>-gear</span></span>
    </a>
  );
}
