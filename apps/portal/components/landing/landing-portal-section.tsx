"use client"

import { useState } from "react"

const STATUSES = ["NEW", "READ", "RESPONDED"] as const
const LABELS = ["Mark as read", "Reply to inquiry", "Start over"] as const
const FEATURES: [string, string][] = [
  ["Featured listings", "Choose the properties visitors should see first."],
  ["Areas & collections", "Publish market slices without rebuilding the site."],
  ["Custom domains", "Verify ownership and keep a canonical domain."],
  ["Inquiry inbox", "Track New, Read, Responded and Archived leads."],
  ["Buyer accounts", "Let visitors save searches, favorite listings and send inquiries."],
]

export default function LandingPortalSection() {
  const [statusIndex, setStatusIndex] = useState<number>(0)
  const status = STATUSES[statusIndex]

  return (
    <section id="portal" className="portal-section">
      <div className="wrap portal-grid">
        <div className="portal-copy">
          <p className="eyebrow">AGENT PORTAL</p>
          <h2>Your brand on the front end. Your data behind it.</h2>
          <p>Give agents a public listing site with featured properties, areas and collections. Connect a custom domain, check launch readiness, and route every inquiry into the same workspace.</p>

          <div className="feature-list">
            {FEATURES.map(([title, text]) => (
              <div key={title}><strong>{title}</strong><span>{text}</span></div>
            ))}
          </div>
        </div>

        <div className="portal-demo">
          <div className="portal-art-wrap">
            <img src="/art/island-agent-website-portal.svg" alt="Agent portal illustration" />
          </div>
          <div className="browser">
            <div className="browser-bar">
              <span className="browser-dots"><i /><i /><i /></span>
              <span className="browser-url">demo.northstarrealty.com</span>
              <span className="verified">Verified</span>
            </div>
            <div className="browser-body">
              <div className="portal-brand-line"><small>NORTHSTAR REALTY</small><span>Featured homes</span></div>
              <div className="portal-title">Homes selected for your next move.</div>
              <div className="listing-strip">
                <article><span>FEATURED</span><b>14 Maple Court</b></article>
                <article><span>NEW LISTING</span><b>41 Hollis Row</b></article>
                <article><span>OPEN HOUSE</span><b>220 Birch Avenue</b></article>
              </div>
            </div>
            <div className="inbox-row">
              <div><b>New inquiry · 14 Maple Court</b><span className={`status ${status.toLowerCase()}`}>{status}</span></div>
              <button onClick={() => setStatusIndex((statusIndex + 1) % STATUSES.length)}>{LABELS[statusIndex]}</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
