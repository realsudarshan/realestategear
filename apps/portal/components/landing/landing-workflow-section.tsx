"use client"

import { useState } from "react"
import { workflowStages } from "./data/content"

type ActionKey = "exec" | "snooze" | "dismiss" | null

const ACTION_COPY: Record<Exclude<ActionKey, null>, string> = {
  exec: "Approved. The reminder is queued and a follow-up task is ready for tomorrow.",
  snooze: "Snoozed. The item will return to the review queue tomorrow morning.",
  dismiss: "Dismissed. The deal remains in the workflow for manual follow-up.",
}

export default function LandingWorkflowSection() {
  const [action, setAction] = useState<ActionKey>(null)

  return (
    <section id="workflow" className="workflow-section dark-section">
      <div className="wrap">
        <div className="section-heading split-heading">
          <div>
            <p className="eyebrow eyebrow-light">WORKFLOW</p>
            <h2>See the work move from lead to closing.</h2>
            <p>Transactions have shared people, milestones and documents. AI watches for gaps, but a human stays in the loop before anything is executed.</p>
          </div>
          <div className="section-visual">
            <img src="/art/island-deal-risk-inspection.svg" alt="Property inspection with a checklist" />
          </div>
        </div>

        <div className="crm-workspace">
          <div className="crm-topline">
            <div>
              <span className="micro-label">TRANSACTION WORKSPACE</span>
              <strong>Northstar Realty · active pipeline</strong>
            </div>
            <span className="live-dot"><i /> Live demo</span>
          </div>

          <div className="pipeline-line" aria-hidden="true">
            <span className="pipeline-fill" />
          </div>

          <div className="stage-heads">
            {workflowStages.map((stage, index) => (
              <div className="stage-head" key={stage.id}>
                <span className="stage-index">0{index + 1}</span>
                <span className="stage-name">{stage.label}</span>
                <span className="stage-count">{stage.count}</span>
              </div>
            ))}
          </div>

          <div className="deal-grid">
            {workflowStages.map((stage) => (
              <div className="deal-lane" key={stage.id}>
                {stage.deals.map((deal) => (
                  <button
                    className={`deal-card ${deal.risk ? "risk" : ""} ${deal.complete ? "complete" : ""} ${action === "exec" && deal.risk ? "resolved" : ""}`}
                    key={`${stage.id}-${deal.address}`}
                    type="button"
                    onClick={() => deal.risk && setAction(null)}
                    aria-label={`${deal.address}, ${deal.person}`}
                  >
                    <span className="deal-marker" />
                    <span className="deal-main">
                      <b>{deal.address}</b>
                      <small>{deal.person}</small>
                    </span>
                    <span className="deal-meta">{action === "exec" && deal.risk ? "Reminder queued" : deal.meta}</span>
                    {deal.risk && action !== "exec" && <span className="risk-flag">Needs review</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>

          <div className="crm-footnote">
            <span>5 active deals</span>
            <span>1 item needs review</span>
            <span>3 documents verified today</span>
          </div>
        </div>

        <aside className="ai-rail" aria-live="polite">
          <div className="ai-rail-copy">
            <p className="mini-label">AI ACTION QUEUE</p>
            <div className="ai-title-row">
              <span className="ai-badge">Review</span>
              <span className="ai-count">1 pending action</span>
            </div>
            <h3>One review step before AI acts.</h3>
            <p>{action ? ACTION_COPY[action] : "The inspection report for 14 Maple Court is not matched to its document slot. A reminder can be prepared and sent after approval."}</p>
          </div>
          <div className="ai-controls">
            <button className="go" disabled={action === "exec"} onClick={() => setAction("exec")}>Approve and send</button>
            <button onClick={() => setAction("snooze")}>Snooze</button>
            <button onClick={() => setAction("dismiss")}>Dismiss</button>
          </div>
        </aside>
      </div>
    </section>
  )
}
