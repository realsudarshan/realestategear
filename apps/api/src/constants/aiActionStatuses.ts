/**
 * Statuses that block a new idempotency-guarded action from being created.
 * Covers all states where an action is still "live" and should not be duplicated.
 * Used in service-layer duplicate checks (relationship memory, transaction risk, lead response).
 */
export const IDEMPOTENCY_BLOCK_STATUSES = ['PENDING', 'APPROVED', 'EXECUTING', 'SNOOZED'] as const;

/**
 * Statuses shown in the active action queue (user-actionable states).
 * Used by actionQueueService to filter what the agent sees in their queue.
 * Intentionally different from IDEMPOTENCY_BLOCK_STATUSES — FAILED is shown
 * (so agents can retry) but APPROVED/EXECUTING are not (internal pipeline states).
 */
export const QUEUE_DISPLAY_STATUSES = ['PENDING', 'SNOOZED', 'FAILED'] as const;
