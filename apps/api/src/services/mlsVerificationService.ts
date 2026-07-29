import { prisma } from 'db';
import { getAccountEmailTarget, sendInternalMlsStatusFlaggedAlert } from './lifecycleEmailService.js';
import logger from '../utils/logger.js';

/**
 * Agent onboarding MLS verification (decision D8, read side).
 *
 * Matches a submitted MLS id against the roster (MlsAgent) that apps/mls-service
 * syncs, and on success records the membership in AccountMlsAccess. The roster
 * stores mlsId de-prefixed (D17); this strips the same prefix from the submitted
 * value before matching, so onboarding works for boards that prefix IDs (e.g.
 * ACTRIS's "ACT" via MLS Grid), not just unprefixed boards like Canopy.
 *
 * MVP scope: the live single-id fallback for a brand-new agent not yet in the
 * daily roster (D8) is intentionally NOT built — a same-day-licensed agent signing
 * up is an edge case not worth the live-connector plumbing for MVP. A roster
 * miss returns 'not_found'; the agent verifies after the next daily roster sync.
 * Tracked in TODOS.md.
 */

export type MlsVerificationStatus = 'verified' | 'not_found' | 'inactive' | 'ambiguous' | 'invalid';

export interface MlsVerificationResult {
  status: MlsVerificationStatus;
  /** AccountMlsAccess id, set on 'verified'. */
  accessId?: string;
  agent?: { name: string | null; email: string | null };
}

export interface MlsVerificationConfig {
  providerId: string;
  /** Board key stored on AccountMlsAccess.mlsBoardId — must match Listing.mlsBoardId. */
  mlsBoardId: string;
  /** Vendor board prefix (D17) — must match mls-service's MLS_PREFIX. */
  prefix?: string;
}

/** Local, unexported — deliberately duplicated from apps/mls-service's
 *  connectors/reso/prefix.ts rather than shared across app boundaries (see
 *  TODOS.md's deferred live-fallback item for the real cross-app extraction). */
function stripPrefix(value: string, prefix: string | undefined): string {
  if (!prefix) return value;
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

/**
 * There is no default board or vendor — every deployment must configure
 * MLS_BOARD_ID explicitly (same value as mls-service's MLS_BOARD_ID). This is
 * a function, not a module-level constant, used only as a default-parameter
 * expression: JS re-evaluates default-parameter expressions per call, not
 * once at import time, so the throw only fires when a caller actually omits
 * `config` — importing this module (or a test that always passes an explicit
 * config) never triggers it.
 */
function requireMlsBoardConfig(): MlsVerificationConfig {
  const providerId = process.env.MLS_PROVIDER_ID?.trim() || 'mls';
  const mlsBoardId = process.env.MLS_BOARD_ID?.trim();
  const prefix = process.env.MLS_PREFIX?.trim() || undefined;
  if (!mlsBoardId) {
    throw Object.assign(
      new Error(
        "MLS_BOARD_ID is not set. Agent MLS verification cannot run until this deployment's " +
          "board is configured — set it to the same value as mls-service's MLS_BOARD_ID.",
      ),
      { status: 500 },
    );
  }
  return { providerId, mlsBoardId, prefix };
}

export async function verifyAndLinkMlsAccess(
  accountId: string,
  submittedMlsId: string,
  config: MlsVerificationConfig = requireMlsBoardConfig(),
): Promise<MlsVerificationResult> {
  const mlsId = stripPrefix(submittedMlsId?.trim() ?? '', config.prefix);
  if (!mlsId) return { status: 'invalid' };

  const matches = await prisma.mlsAgent.findMany({
    where: { providerId: config.providerId, mlsId },
    select: { id: true, status: true, name: true, email: true },
  });

  if (matches.length === 0) return { status: 'not_found' };
  if (matches.length > 1) {
    logger.warn('[mls-verify] ambiguous MLS id — multiple active roster matches', {
      mlsId,
      count: matches.length,
    });
    return { status: 'ambiguous' };
  }

  const agent = matches[0];
  if ((agent.status ?? '').toLowerCase() !== 'active') {
    return { status: 'inactive', agent: { name: agent.name, email: agent.email } };
  }

  const access = await prisma.accountMlsAccess.upsert({
    where: { accountId_mlsBoardId: { accountId, mlsBoardId: config.mlsBoardId } },
    create: { accountId, mlsBoardId: config.mlsBoardId, membershipId: mlsId, verifiedAt: new Date() },
    update: { membershipId: mlsId, verifiedAt: new Date() },
  });

  return { status: 'verified', accessId: access.id, agent: { name: agent.name, email: agent.email } };
}

export interface MlsStatusCheckSummary {
  checked: number;
  newlyFlagged: number;
  cleared: number;
  ambiguous: number;
}

/**
 * Daily re-check (issue #205, detection side). Compares every AccountMlsAccess
 * membership against the current roster and flags/clears
 * AccountMlsAccess.flaggedInactiveAt accordingly. Never touches a Portal —
 * taking a portal down is a manual admin action, not automatic (grace period
 * is read as "time since flagged", no auto-expiry).
 */
export async function checkMlsStatuses(
  config: MlsVerificationConfig = requireMlsBoardConfig(),
): Promise<MlsStatusCheckSummary> {
  const accesses = await prisma.accountMlsAccess.findMany({
    where: { mlsBoardId: config.mlsBoardId },
    select: { id: true, accountId: true, membershipId: true, flaggedInactiveAt: true },
  });
  if (accesses.length === 0) return { checked: 0, newlyFlagged: 0, cleared: 0, ambiguous: 0 };

  const membershipIds = [...new Set(accesses.map((a) => a.membershipId))];
  const roster = await prisma.mlsAgent.findMany({
    where: { providerId: config.providerId, mlsId: { in: membershipIds } },
    select: { mlsId: true, status: true, name: true, email: true },
  });
  const byMlsId = new Map<string, typeof roster>();
  for (const agent of roster) {
    if (!agent.mlsId) continue;
    const list = byMlsId.get(agent.mlsId) ?? [];
    list.push(agent);
    byMlsId.set(agent.mlsId, list);
  }

  let newlyFlagged = 0;
  let cleared = 0;
  let ambiguous = 0;

  for (const access of accesses) {
    const matches = byMlsId.get(access.membershipId) ?? [];
    if (matches.length > 1) {
      // Same ambiguity guard as verifyAndLinkMlsAccess: don't guess which
      // roster row applies, leave the existing flag state untouched.
      ambiguous++;
      logger.warn('[mls-status-check] ambiguous roster match, skipping', {
        accountId: access.accountId,
        membershipId: access.membershipId,
      });
      continue;
    }

    const agent = matches[0];
    const isActive = (agent?.status ?? '').toLowerCase() === 'active';

    if (!isActive && !access.flaggedInactiveAt) {
      const flaggedAt = new Date();
      await prisma.accountMlsAccess.update({
        where: { id: access.id },
        data: { flaggedInactiveAt: flaggedAt },
      });
      newlyFlagged++;

      const account = await getAccountEmailTarget(access.accountId);
      if (account) {
        await sendInternalMlsStatusFlaggedAlert(account, {
          membershipId: access.membershipId,
          agentName: agent?.name,
          flaggedAt,
        });
      }
    } else if (isActive && access.flaggedInactiveAt) {
      await prisma.accountMlsAccess.update({
        where: { id: access.id },
        data: { flaggedInactiveAt: null },
      });
      cleared++;
    }
  }

  return { checked: accesses.length, newlyFlagged, cleared, ambiguous };
}
