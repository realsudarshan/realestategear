"use client"

import { useState } from "react"
import { floors } from "./data/content"

const FLOOR_TOP = 8
const FLOOR_STEP = 12.75
const FLOOR_HEIGHT = 12.3
const FEATHER = 3.2

export default function LandingPlatformSection() {
  const [active, setActive] = useState<number>(0)
  const [hovered, setHovered] = useState<number | null>(null)
  const index = hovered ?? active

  const floorY = FLOOR_TOP + index * FLOOR_STEP
  const floorBottom = floorY + FLOOR_HEIGHT
  const glowTop = FLOOR_TOP - 0.3 + index * FLOOR_STEP

  const maskVertical = `linear-gradient(to bottom, transparent ${Math.max(0, floorY - FEATHER)}%, #000 ${floorY}%, #000 ${floorBottom}%, transparent ${Math.min(100, floorBottom + FEATHER)}%)`

  return (
    <section id="platform" className="platform-section dark-section">
      <div className="wrap">
        <div className="section-heading">
          <p className="eyebrow">THE PLATFORM</p>
          <h2>Separate workspaces. One connected system.</h2>
          <p>Each area has a focused job, while contacts, properties, tasks, events and transactions stay connected underneath.</p>
        </div>

        <div className="platform-grid">
          <div className="building-frame">
            <div className="building-stage">
              <img className="building-base" src="/art/building-six-floors-cutaway.svg" alt="Six-floor real-estate platform illustration" />
              <img
                className="building-light"
                src="/art/building-six-floors-cutaway.svg"
                alt=""
                aria-hidden="true"
                style={{
                  maskImage: maskVertical,
                  WebkitMaskImage: maskVertical,
                }}
              />
              <span className="building-glow" style={{ top: `${glowTop}%` }} aria-hidden="true" />
            </div>
          </div>

          <div className="platform-list">
            {floors.map((floor, i) => {
              const open = active === i
              return (
                <div
                  className={`floor-row ${open ? "open" : ""} ${index === i ? "highlighted" : ""}`}
                  key={floor.name}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <button type="button" onClick={() => setActive(i)} aria-expanded={open}>
                    <span className="floor-number">0{i + 1}</span>
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
