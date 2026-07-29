import { getMlsBoardPolicy } from '@realestategear/portal-config';

// getMlsBoardPolicy throws for an unregistered board (by design — see
// packages/portal-config/src/mlsBoardPolicy.ts). MANUAL-source listings and
// any board pending policy registration have no entry, and that must not 500
// a property page — display name is cosmetic, not a compliance gate.
export function resolveMlsBoardName(mlsBoardId: string | null | undefined): string | null {
  if (!mlsBoardId) return null;
  try {
    return getMlsBoardPolicy(mlsBoardId).displayName;
  } catch {
    return null;
  }
}
