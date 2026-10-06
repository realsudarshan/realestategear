export type Capability = [string, string, string]

export interface Deal {
  address: string
  person: string
  meta: string
  risk?: boolean
  complete?: boolean
}

export interface WorkflowStage {
  id: string
  label: string
  count: number
  deals: Deal[]
}

export interface Floor {
  name: string
  kicker: string
  text: string
  bullets: string[]
}

export type Integration = [string, string]

export const capabilities: Capability[] = [
  ['01', 'Find', 'Search properties, listings, contacts and tasks from one place.'],
  ['02', 'Manage', 'Keep people, deals, documents, meetings and notes connected.'],
  ['03', 'Automate', 'Review AI-suggested actions before anything is sent or changed.'],
  ['04', 'Publish', 'Run a branded portal with domains, listings and inquiry routing.'],
]

export const workflowStages: WorkflowStage[] = [
  {
    id: 'lead',
    label: 'Lead',
    count: 2,
    deals: [
      { address: '14 Maple Court', person: 'Priya Shah', meta: 'Buyer · new lead' },
      { address: '41 Hollis Row', person: 'Call booked', meta: 'Seller inquiry' },
    ],
  },
  {
    id: 'contract',
    label: 'Under contract',
    count: 1,
    deals: [
      { address: '220 Birch Avenue', person: 'Closing in 19 days', meta: 'Buyer · contract signed' },
    ],
  },
  {
    id: 'inspection',
    label: 'Inspection',
    count: 1,
    deals: [
      { address: '14 Maple Court', person: 'Report not matched', meta: 'Due today', risk: true },
    ],
  },
  {
    id: 'closing',
    label: 'Closing',
    count: 1,
    deals: [
      { address: '7 Quarry Street', person: '3/3 core documents', meta: 'Verified · ready to close', complete: true },
    ],
  },
]

export const floors: Floor[] = [
  {
    name: 'AI assistant',
    kicker: 'Search and act',
    text: 'Ask across the agent workspace, draft useful work, and keep a human approval step before actions are executed.',
    bullets: ['Streaming assistant conversations', 'Marketing copy and campaign drafts', 'Risk and relationship scans that create reviewable actions'],
  },
  {
    name: 'Listings',
    kicker: 'Properties and MLS',
    text: 'Search properties and listings, open detailed records, and organize inventory into reusable market collections.',
    bullets: ['Address and MLS search', 'Listing facts, media and history', 'Areas, collections and CMA reports'],
  },
  {
    name: 'Transactions',
    kicker: 'Deals and documents',
    text: 'Track a deal from pipeline stage through milestones, parties, required documents and related email.',
    bullets: ['Milestone-based transaction setup', 'Match and verify transaction documents', 'Gmail sync and Google Drive copy workflows'],
  },
  {
    name: 'CRM',
    kicker: 'Contacts and activity',
    text: 'Keep people, companies and relationships connected to calls, emails, meetings, tasks and notes.',
    bullets: ['Stages, sources, tags and interactions', 'Tasks linked to people or deals', 'Calendar events and attendees'],
  },
  {
    name: 'Portals',
    kicker: 'Branded public sites',
    text: 'Manage the public experience for an agent with featured listings, areas, collections, custom domains and inquiries.',
    bullets: ['Launch-readiness checks', 'Custom-domain verification', 'Inquiry status tracking'],
  },
  {
    name: 'Reporting',
    kicker: 'Leads and performance',
    text: 'Turn inbound interest and transaction activity into a clearer operating view.',
    bullets: ['Lead and inquiry inbox', 'CSV lead export', 'Performance summaries, trends and forecasts'],
  },
]

export const integrations: Integration[] = [
  ['Google', 'Calendar, Gmail activity, transaction email sync and Drive copy workflows.'],
  ['AI', 'Assistant chat, marketing copy, campaign generation and approval-based actions.'],
  ['Email', 'Password resets, inquiry notifications, saved-search alerts and portal emails.'],
  ['Search', 'Fast property search, autocomplete and unified agent search when configured.'],
  ['Cache', 'Optional Redis caching; PostgreSQL remains the fallback when it is unavailable.'],
  ['Storage', 'S3-compatible portal logos and media using presigned upload URLs.'],
  ['MLS', 'Agent verification and listing synchronization when licensed and enabled.'],
]
