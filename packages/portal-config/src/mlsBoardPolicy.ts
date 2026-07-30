import type { MlsBoardPolicy } from './types.js';
import { PortalConfigError } from './errors.js';

// Board-scoped, surface-scoped MLS display rules. See docs/MLS_COMPLIANCE.md.
// Do not assume every surface requires the same attribution policy.
//
// Exact disclaimer copy is intentionally not hardcoded here. Public display is
// gated on board-specific review, and approved copy is deployment-specific.
// Renderers consuming `disclaimerRequired` must source approved copy
// separately. Do not add board-specific strings before sign-off.
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
// throwing (see docs/MLS_COMPLIANCE.md and MLS_PUBLIC_DISPLAY_ENABLED).
export function getMlsBoardPolicy(boardId: string): MlsBoardPolicy {
  const policy = MLS_BOARD_POLICIES[boardId];
  if (!policy) {
    throw new PortalConfigError(`No MLS board policy registered for "${boardId}".`, 404);
  }
  return policy;
}
