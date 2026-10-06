"use client"

import { useState } from "react"
import { floors } from "./data/content"

export default function LandingPlatformSection() {
  const [active, setActive] = useState<number>(0)

  return (
    <section id="platform" className="platform-section">
      <div className="wrap">
        <div className="section-heading">
          <p className="eyebrow">THE PLATFORM</p>
          <h2>Separate workspaces. One connected system.</h2>
          <p>Each area has a focused job, while contacts, properties, tasks, events and transactions stay connected underneath.</p>
        </div>

        <div className="platform-grid">
          <div className="building-frame">
            <img src="/art/building-six-floors-cutaway.svg" alt="Six-floor real-estate platform illustration" />
            <span className="building-active" style={{ top: `${17 + active * 12.8}%` }} aria-hidden="true" />
          </div>

          <div className="platform-list">
            {floors.map((floor, index) => {
              const open = active === index
              return (
                <div className={`floor-row ${open ? "open" : ""}`} key={floor.name}>
                  <button type="button" onClick={() => setActive(index)} aria-expanded={open}>
                    <span className="floor-number">0{index + 1}</span>
                    <span className="floor-copy"><b>{floor.name}</b><small>{floor.kicker}</small></span>
                    <span className="floor-arrow">{open ? "−" : "+"}</span>
                  </button>
                  {open && (
                    <div className="floor-panel">
                      <p>{floor.text}</p>
                      <ul>{floor.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
