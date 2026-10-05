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
