"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@realestategear/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@realestategear/ui/card";
import { Empty } from "@realestategear/ui/empty";
import { Skeleton } from "@realestategear/ui/skeleton";
import {
  AGENT_API_DISABLED_CODE,
  formatAgentApiError,
  isAgentApiDisabled,
  isDashboardEmpty,
  type AgentApiErrorBody,
  type AgentDashboardData,
} from "@/lib/agent";
import { AgentApiDisabled } from "./agent-api-disabled";

type ViewState =
  | { kind: "loading" }
  | { kind: "ready"; data: AgentDashboardData }
  | { kind: "error"; status: number; message: string; code?: string };

const STATS: { key: keyof AgentDashboardData["stats"]; label: string }[] = [
  { key: "activeContacts", label: "Active contacts" },
  { key: "openTransactions", label: "Open transactions" },
  { key: "pendingTasks", label: "Pending tasks" },
  { key: "closedThisMonth", label: "Closed this month" },
];

function contactName(contact: AgentDashboardData["recentContacts"][number]): string {
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
  return name || contact.email || "Untitled contact";
}

function formatDue(dueDate: string | null): string {
  if (!dueDate) return "No due date";
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return dueDate;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function AgentDashboard() {
  const router = useRouter();
  const [state, setState] = useState<ViewState>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/agent/dashboard", { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as AgentApiErrorBody & Partial<AgentDashboardData>;
      if (res.status === 401) {
        router.push("/agent/login?from=/agent");
        router.refresh();
        return;
      }
      if (!res.ok) {
        setState({
          kind: "error",
          status: res.status,
          message: formatAgentApiError(res.status, body),
          code: body.code,
        });
        return;
      }
      if (!body.stats || !Array.isArray(body.recentContacts) || !Array.isArray(body.upcomingTasks)) {
        setState({ kind: "error", status: res.status, message: "Unexpected dashboard response." });
        return;
      }
      setState({
        kind: "ready",
        data: {
          stats: body.stats,
          recentContacts: body.recentContacts,
          upcomingTasks: body.upcomingTasks,
        },
      });
    } catch {
      setState({ kind: "error", status: 0, message: "Unable to connect to server" });
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.kind === "loading") {
    return <DashboardSkeleton />;
  }

  if (state.kind === "error") {
    if (state.code === AGENT_API_DISABLED_CODE || isAgentApiDisabled(state.status, { code: state.code })) {
      return (
        <div className="flex flex-col gap-4">
          <AgentApiDisabled title="Agent dashboard is unavailable" />
          <Button type="button" variant="outline" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-4" role="alert">
        <p className="text-sm text-destructive">
          {state.status === 403
            ? "You do not have permission to view this dashboard."
            : state.status === 404
              ? state.message
              : state.message}
        </p>
        <Button type="button" variant="outline" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  const { data } = state;
  const empty = isDashboardEmpty(data);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your contacts, transactions, and tasks at a glance.</p>
      </div>

      <section aria-label="Workspace stats">
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {STATS.map((stat) => (
            <li key={stat.key}>
              <Card>
                <CardHeader>
                  <CardTitle>{stat.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-mono text-2xl font-semibold tabular-nums">{data.stats[stat.key]}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <nav aria-label="Workspace sections" className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/agent/contacts">Contacts</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/agent/transactions">Transactions</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/agent/tasks">Tasks</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/agent/inquiries">Inquiries</Link>
        </Button>
      </nav>

      {empty ? (
        <Empty
          title="No workspace activity yet"
          description="When you add contacts and tasks, they will show up here."
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="recent-contacts-heading">
          <h2 id="recent-contacts-heading" className="mb-3 text-sm font-semibold">
            Recent contacts
          </h2>
          {data.recentContacts.length === 0 ? (
            <Empty compact title="No contacts yet" description="New contacts will appear in this list." />
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border bg-card">
              {data.recentContacts.map((contact) => (
                <li key={contact.id} className="px-4 py-3">
                  <p className="text-sm font-medium">{contactName(contact)}</p>
                  <p className="text-xs text-muted-foreground">
                    {[contact.type, contact.stage, contact.email].filter(Boolean).join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="upcoming-tasks-heading">
          <h2 id="upcoming-tasks-heading" className="mb-3 text-sm font-semibold">
            Upcoming tasks
          </h2>
          {data.upcomingTasks.length === 0 ? (
            <Empty compact title="No upcoming tasks" description="Tasks assigned to you will appear here." />
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border bg-card">
              {data.upcomingTasks.map((task) => (
                <li key={task.id} className="px-4 py-3">
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {[formatDue(task.dueDate), task.priority, task.status].filter(Boolean).join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div data-testid="dashboard-skeleton" aria-busy="true" aria-label="Loading dashboard" className="flex flex-col gap-8">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}
