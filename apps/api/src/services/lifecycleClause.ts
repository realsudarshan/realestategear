export const LIFECYCLE_PARAMS = ['prospect', 'active-lead', 'client', 'vendor', 'all'] as const;
export type LifecycleParam = typeof LIFECYCLE_PARAMS[number];

type WhereClause = Record<string, unknown>;

export function buildLifecycleClause(lifecycle: string | undefined): WhereClause {
  switch (lifecycle) {
    case 'prospect':
      return { type: 'LEAD', stage: { in: ['NEW', 'CONTACTED'] } };
    case 'active-lead':
      return { type: 'LEAD', stage: { in: ['QUALIFIED', 'ACTIVE'] } };
    case 'client':
      return { type: 'CLIENT' };
    case 'vendor':
      return { type: 'VENDOR' };
    case 'all':
      return { type: { in: ['LEAD', 'CLIENT'] } };
    default:
      throw Object.assign(new Error('Invalid lifecycle'), { status: 400 });
  }
}
