const AGENT_AUTH_PAGES = new Set([
  "/agent/login",
  "/agent/register",
  "/agent/forgot-password",
  "/agent/reset-password",
]);

export const AGENT_HOME = "/agent";
export const AGENT_LOGIN = "/agent/login";

export function isAgentAuthPage(pathname: string): boolean {
  const path = pathname.split("?")[0] ?? pathname;
  return AGENT_AUTH_PAGES.has(path);
}

export function isAgentProtectedPage(pathname: string): boolean {
  const path = pathname.split("?")[0] ?? pathname;
  return path === "/agent" || (path.startsWith("/agent/") && !isAgentAuthPage(path));
}

/**
 * Redirects unauthenticated visitors away from Agent workspace routes and
 * authenticated agents away from login/register/password pages.
 */
export function resolveAgentRouteRedirect(
  pathname: string,
  isAuthenticated: boolean,
): string | null {
  const path = pathname.split("?")[0] ?? pathname;
  if (!path.startsWith("/agent")) return null;

  if (!isAuthenticated && isAgentProtectedPage(path)) {
    return `${AGENT_LOGIN}?from=${encodeURIComponent(path)}`;
  }

  if (isAuthenticated && isAgentAuthPage(path)) {
    return AGENT_HOME;
  }

  return null;
}

export function safeAgentPath(path: string | null | undefined): string {
  if (!path || !path.startsWith("/")) return AGENT_HOME;
  const base = "http://agent-safe-path.invalid";
  try {
    const resolved = new URL(path, base);
    if (resolved.origin !== base) return AGENT_HOME;
    const next = resolved.pathname + resolved.search + resolved.hash;
    if (!next.startsWith("/agent")) return AGENT_HOME;
    return next;
  } catch {
    return AGENT_HOME;
  }
}

export const AGENT_API_DISABLED_CODE = "AGENT_API_DISABLED";

export type AgentApiErrorBody = {
  error?: string;
  code?: string;
  fields?: Record<string, string>;
  details?: { body?: string[]; query?: string[]; params?: string[] };
  message?: string;
};

export function isAgentApiDisabled(status: number, body: AgentApiErrorBody | null | undefined): boolean {
  return status === 404 && body?.code === AGENT_API_DISABLED_CODE;
}

export function formatAgentApiError(status: number, body: AgentApiErrorBody | null | undefined): string {
  if (isAgentApiDisabled(status, body)) {
    return "The Agent API is disabled on this server. Ask an administrator to set AGENT_API_ENABLED=true.";
  }
  if (body?.error) return body.error;
  if (body?.message) return body.message;
  if (status === 401) return "Invalid credentials";
  if (status === 403) return "You do not have permission to view this page.";
  if (status === 404) return "The requested Agent resource was not found.";
  return "Something went wrong. Please try again.";
}

export function fieldErrorsFromBody(body: AgentApiErrorBody | null | undefined): Record<string, string> {
  return body?.fields ?? {};
}

export type AgentPublicUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phoneNumber?: string | null;
  avatarUrl: string | null;
  role: string;
  emailVerified?: boolean;
};

export type AgentDashboardStats = {
  activeContacts: number;
  openTransactions: number;
  pendingTasks: number;
  closedThisMonth: number;
};

export type AgentDashboardContact = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  type: string | null;
  stage: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
};

export type AgentDashboardTask = {
  id: string;
  title: string;
  dueDate: string | null;
  priority: string | null;
  status: string;
};

export type AgentDashboardData = {
  stats: AgentDashboardStats;
  recentContacts: AgentDashboardContact[];
  upcomingTasks: AgentDashboardTask[];
};

export function isAgentDashboardData(value: unknown): value is AgentDashboardData {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<AgentDashboardData>;
  const stats = data.stats;
  if (!stats || typeof stats !== "object") return false;

  const statKeys: (keyof AgentDashboardStats)[] = [
    "activeContacts",
    "openTransactions",
    "pendingTasks",
    "closedThisMonth",
  ];
  if (statKeys.some((key) => typeof stats[key] !== "number" || !Number.isFinite(stats[key]))) {
    return false;
  }

  if (!Array.isArray(data.recentContacts) || !Array.isArray(data.upcomingTasks)) return false;
  return (
    data.recentContacts.every((contact) => {
      if (!contact || typeof contact !== "object") return false;
      return (
        typeof contact.id === "string" &&
        (contact.firstName === null || typeof contact.firstName === "string") &&
        (contact.lastName === null || typeof contact.lastName === "string") &&
        (contact.type === null || typeof contact.type === "string") &&
        (contact.stage === null || typeof contact.stage === "string") &&
        (contact.email === null || typeof contact.email === "string") &&
        (contact.phone === null || typeof contact.phone === "string") &&
        typeof contact.createdAt === "string"
      );
    }) &&
    data.upcomingTasks.every((task) => {
      if (!task || typeof task !== "object") return false;
      return (
        typeof task.id === "string" &&
        typeof task.title === "string" &&
        (task.dueDate === null || typeof task.dueDate === "string") &&
        (task.priority === null || typeof task.priority === "string") &&
        typeof task.status === "string"
      );
    })
  );
}

export function isDashboardEmpty(data: AgentDashboardData): boolean {
  return (
    data.stats.activeContacts === 0 &&
    data.stats.openTransactions === 0 &&
    data.stats.pendingTasks === 0 &&
    data.stats.closedThisMonth === 0 &&
    data.recentContacts.length === 0 &&
    data.upcomingTasks.length === 0
  );
}

export type AgentContactTrack = {
  id?: string;
  side: string;
  stage: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type AgentContact = {
  id: string;
  accountId?: string;
  type: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string | null;
  stage: string;
  tags: string[] | null;
  avatarUrl?: string | null;
  userId?: string | null;
  createdAt: string;
  updatedAt: string;
  buyerTrack?: AgentContactTrack | null;
  sellerTrack?: AgentContactTrack | null;
  tracks?: AgentContactTrack[];
  lastContactAt?: string | null;
  lastConsultAt?: string | null;
  lastEventAt?: string | null;
  user?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    _count?: { favorites: number; inquiries: number; savedSearches: number };
  } | null;
  interactions?: AgentInteraction[];
  transactionParties?: Array<{ transaction: Record<string, unknown> }>;
  tasks?: Array<Record<string, unknown>>;
  notes?: Array<Record<string, unknown>>;
  eventAttendees?: Array<{ event: Record<string, unknown> }>;
};

export type AgentInteraction = {
  id: string;
  contactId: string;
  type: string;
  side: string | null;
  subject: string | null;
  body: string | null;
  occurredAt: string;
  duration: number | null;
  createdAt: string;
};

export type AgentContactListResponse = {
  contacts: AgentContact[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  lifecycleCounts: { prospect: number; activeLead: number; client: number; vendor: number };
};

export type AgentTransactionParty = {
  id?: string;
  contactId: string;
  role: string;
  contact: { id: string; firstName: string; lastName: string; email?: string | null; phone?: string | null };
};

export type AgentTransaction = {
  id: string;
  type: string;
  stage: string;
  address: string | null;
  mlsId?: string | null;
  listPrice: number | string | null;
  salePrice?: number | string | null;
  commissionRate: number | null;
  closingDate: string | null;
  notes: string | null;
  createdAt?: string;
  updatedAt?: string;
  parties: AgentTransactionParty[];
  property?: { id: string; address: string; city: string; state: string; listings?: Array<Record<string, unknown>> } | null;
  milestones?: Array<{ id: string; date: string; milestoneDefinition: { key: string; label: string; required: boolean } }>;
  tasks?: Array<{ id: string; title: string; dueDate: string | null; status: string; priority: string }>;
  transactionNotes?: Array<{ id: string; body: string; createdAt: string }>;
  events?: Array<Record<string, unknown>>;
  documents?: Array<Record<string, unknown>>;
};

export type AgentTransactionListResponse = {
  transactions: AgentTransaction[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export type AgentTransactionTemplate = {
  key: string;
  name: string;
  description: string;
  milestones: Array<{ key: string; label: string; required: boolean; sortOrder: number }>;
};

export type AgentTransactionDocument = {
  id: string;
  label: string;
  status: string;
  notes?: string | null;
  matchedAt?: string | null;
  driveFileId?: string | null;
  driveWebLink?: string | null;
  documentDefinition?: { key: string; label: string; required: boolean; sortOrder: number } | null;
  matchedAttachment?: {
    id: string;
    filename: string;
    mimeType: string;
    sizeBytes: number | null;
    suggestedDocType?: string | null;
    suggestedConfidence?: number | null;
    message?: { id: string; subject: string | null; sentAt: string | null };
  } | null;
};

export type AgentTransactionAttachment = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number | null;
  suggestedDocType: string | null;
  suggestedConfidence: number | null;
  isMatched: boolean;
  message: { id: string; subject: string | null; sentAt: string | null };
};

export type AgentSyncRun = {
  id: string;
  status: string;
  query: string | null;
  messagesFound: number;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
};

export type AgentDiscoveredMessage = {
  id: string;
  subject: string | null;
  snippet: string | null;
  fromEmail: string | null;
  fromName: string | null;
  sentAt: string | null;
  category: string | null;
  confidence: number | null;
  status: string;
  attachments: Array<{
    id: string;
    filename: string;
    mimeType: string;
    sizeBytes: number | null;
    suggestedDocType: string | null;
    suggestedConfidence: number | null;
    matchedDocument?: { id: string; label: string; status: string } | null;
  }>;
};

export type AgentTask = {
  id: string; title: string; description: string | null; dueDate: string | null;
  priority: string; status: string; contactId: string | null; transactionId: string | null;
  contact?: { id: string; firstName: string; lastName: string } | null;
  transaction?: { id: string; address: string | null; stage: string } | null;
};

export type AgentEvent = {
  id: string; type: string; customType: string | null; title: string; description: string | null;
  location: string | null; startAt: string; endAt: string; isAllDay: boolean; status: string;
  transactionId: string | null; providerSyncError: string | null; lastSyncedAt: string | null;
  attendees: Array<{ id: string; contactId: string; role: string | null; contact: { id: string; firstName: string; lastName: string; email?: string | null } }>;
  transaction?: { id: string; address: string | null; stage: string; type: string } | null;
};

export type AgentNote = {
  id: string; body: string; createdAt: string; contactId: string | null; transactionId: string | null;
  eventId: string | null; contact?: { id: string; firstName: string; lastName: string } | null;
  transaction?: { id: string; address: string | null } | null;
  event?: { id: string; title: string; startAt: string } | null;
};
