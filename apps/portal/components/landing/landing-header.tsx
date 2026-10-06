import { LandingLogo } from './landing-logo';

export function LandingHeader() {
  return (
    <header className="hero" id="top">
      <div className="wrap">
        <nav className="nav" aria-label="Main navigation">
          <LandingLogo />
          <div className="nav-links">
            <a href="#workflow">Workflow</a>
            <a href="#platform">Platform</a>
            <a href="#portal">Agent website</a>
            <a href="#developers">Developers</a>
            <a href="/properties">Browse listings</a>
          </div>
          <div className="nav-cta-group">
            <a className="nav-cta" href="/join">User signup</a>
            <a className="nav-cta nav-cta-secondary" href="/agent/register">Agent signup</a>
          </div>
        </nav>

        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">REAL ESTATE OPERATING SYSTEM</p>
            <h1>Listings, relationships, deals and <em>AI actions.</em></h1>
            <p className="lead">One workspace for agents: manage contacts, discover listings, move transactions forward, publish a branded portal, and review AI-suggested work before it acts.</p>
            <div className="hero-actions">
              <a className="btn" href="/join">User signup</a>
              <a className="btn btn-ghost" href="/agent/register">Agent signup</a>
            </div>
            <div className="hero-tags" aria-label="Core capabilities">
              {['CRM', 'Listings & MLS', 'Transactions', 'Portals', 'AI workflows'].map((item) => <span key={item}>{item}</span>)}
            </div>
          </div>
          <div className="hero-art" aria-label="Connected real-estate workspace illustration" role="img">
            <div className="stage">
              <img className="layer connectors" src="/art/connector-pipeline-dotted.svg" alt="" />
              <img className="layer island top" src="/art/island-agent-dashboard-workspace.svg" alt="" />
              <img className="layer island left" src="/art/island-listing-house-for-sale.svg" alt="" />
              <img className="layer island right" src="/art/island-apartment-block-mls.svg" alt="" />
              <img className="layer island bottom" src="/art/island-neighborhood-sold-sign.svg" alt="" />
              <img className="layer pin blue" src="/art/pin-location-blue.svg" alt="" />
              <img className="layer pin white" src="/art/pin-location-white.svg" alt="" />
              {[0, 1, 2].map((i) => <img key={i} className="layer listing-card" data-card={i} src="/art/card-listing-blue.svg" alt="" />)}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
