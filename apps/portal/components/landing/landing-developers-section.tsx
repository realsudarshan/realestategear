"use client"

import { useState } from "react"
import { integrations } from "./data/content"

export default function LandingDevelopersSection() {
  const [selected, setSelected] = useState<string[]>([])
  const toggle = (name: string) =>
    setSelected((items) =>
      items.includes(name) ? items.filter((item) => item !== name) : [...items, name]
    )

  return (
    <section id="developers" className="developers-section">
      <div className="wrap">
        <div className="developer-shell">
          <div className="developer-grid">
            <div>
              <p className="eyebrow eyebrow-light">FOR BUILDERS</p>
              <h2>Bring your own frontend. Keep the real-estate backend.</h2>
              <p>Build on an Express API backed by PostgreSQL and Prisma. Use the agent routes for CRM, listings, transactions, portals, AI workflows and reporting, then add integrations as your deployment needs them.</p>

              <div className="developer-rows">
                <div><strong>Core data</strong><span>Users · contacts · properties · listings · transactions · tasks · events · notes</span></div>
                <div><strong>Search</strong><span>Typesense when configured, with PostgreSQL fallback search.</span></div>
                <div><strong>Integrations</strong><span>Google Workspace · OpenAI · Resend · Redis · storage · MLS</span></div>
              </div>

              <div className="integration-chips" aria-label="Integrations">
                {integrations.map(([name]) => (
                  <button key={name} aria-pressed={selected.includes(name)} onClick={() => toggle(name)}>{name}</button>
                ))}
              </div>
              <div className="integration-readout">
                {selected.length ? selected.map((name) => {
                  const detail = integrations.find(([label]) => label === name)?.[1]
                  return <div key={name}><b>{name}</b><span> — {detail}</span></div>
                }) : "Select an integration to see the capability it adds."}
              </div>
            </div>

            <div className="developer-art">
              <img src="/art/island-api-servers-database.svg" alt="API servers, database and cloud" />
              <div className="code-label">MINIMUM AGENT API CONFIG</div>
              <pre><b>DATABASE_URL</b>=postgresql://…{"\n"}<b>JWT_SECRET</b>=long-random-secret{"\n"}<b>AGENT_API_ENABLED</b>=true{"\n\n"}npm run db:migrate{"\n"}npm run dev:api</pre>
              <p className="route-note">Dashboard · contacts · transactions · documents · listings · tasks · events · notes · reports · AI · portals · domains · collections · MLS · unified search</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
