import { LandingLogo } from './landing-logo';

export function LandingFooter() {
  return (
    <footer>
      <div className="wrap">
        <img className="footer-strip" src="/art/strip-closing-street.svg" alt="Street of homes with a sold sign" />
        <p className="eyebrow">ONE WORKSPACE</p>
        <h2>Keep the whole practice moving.</h2>
        <div className="hero-actions" style={{ justifyContent: 'center' }}>
          <a className="btn" href="/join">Create an account</a>
          <a className="btn btn-ghost" href="/login" style={{ color: 'var(--ink)', boxShadow: 'inset 0 0 0 1px var(--line)' }}>Buyer log in</a>
          <a className="btn" href="/agent/login" style={{ background: 'var(--night)', color: 'var(--chalk)' }}>Agent sign in</a>
        </div>
        <div className="footer-bottom"><LandingLogo /><small>Express · Postgres · Prisma</small></div>
      </div>
    </footer>
  );
}
