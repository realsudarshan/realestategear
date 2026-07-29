import type { MlsBoardPolicy } from './types.js';
import { PortalConfigError } from './errors.js';

// Board-scoped, surface-scoped MLS display rules. Source: docs/mls-compliance.md
// and docs/plans/PORTAL_PLATFORM_PLAN.md "MLS Compliance Policy". Do not assume
// every surface requires attribution — Canopy's own gate doc requires it on
// listing detail but not the listing card.
//
// Exact disclaimer copy is intentionally NOT hardcoded here: docs/mls-compliance.md
// gates public display on legal/Canopy agreement sign-off, and the required
// disclaimer text is listed there as an unconfirmed example, not final copy.
// Renderers consuming `disclaimerRequired` must source approved copy
// separately — do not add board-specific strings to this registry pre-signoff.
export const MLS_BOARD_POLICIES: Record<string, MlsBoardPolicy> = {
  CanopyMLS: {
    boardId: 'CanopyMLS',
    displayName: 'Canopy MLS',
    surfaces: {
      portalListingCard: {
        attributionRequired: false,
      },
      portalListingGrid: {
        attributionRequired: false,
      },
      listingDetail: {
        attributionRequired: true,
        requiresListingBrokerage: true,
        requiresMlsId: true,
        requiresMlsBoardName: true,
        requiresLastUpdatedAt: true,
      },
      portalFooter: {
        attributionRequired: false,
        disclaimerRequired: true,
      },
    },
  },
};

// Fails loud for unregistered boards rather than defaulting to "no
// attribution required" — an unknown board is a missing policy, not a board
// with no display rules. Callers gate public listing display on this not
// throwing (see docs/mls-compliance.md MLS_PUBLIC_DISPLAY_ENABLED gate).
export function getMlsBoardPolicy(boardId: string): MlsBoardPolicy {
  const policy = MLS_BOARD_POLICIES[boardId];
  if (!policy) {
    throw new PortalConfigError(`No MLS board policy registered for "${boardId}".`, 404);
  }
  return policy;
}
