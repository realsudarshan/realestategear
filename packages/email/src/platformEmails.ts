import { sendPlainTextEmail } from './EmailService.js';

export const PLATFORM_EMAIL_KINDS = {
  PORTAL_LAUNCHED: 'portal_launched',
  INTERNAL_PORTAL_LAUNCHED: 'internal_portal_launched',
  INTERNAL_MLS_STATUS_FLAGGED: 'internal_mls_status_flagged',
} as const;

export type PlatformEmailKind = (typeof PLATFORM_EMAIL_KINDS)[keyof typeof PLATFORM_EMAIL_KINDS];

export type PlatformEmailContext = {
  firstName?: string | null;
  accountName?: string | null;
  portalName?: string | null;
  portalUrl?: string | null;
  unsubscribeUrl?: string | null;
  userEmail?: string | null;
  accountId?: string | null;
  agentName?: string | null;
  membershipId?: string | null;
  adminAccountUrl?: string | null;
};

type PlatformEmailTemplate = {
  subject: string;
  text: string;
  marketing?: boolean;
};

function name(ctx: PlatformEmailContext) {
  return ctx.firstName?.trim() || 'there';
}

function withSignature(body: string, ctx: PlatformEmailContext, marketing = true) {
  const footer = marketing && ctx.unsubscribeUrl
    ? `\n\nIf these setup emails are not useful, unsubscribe here:\n${ctx.unsubscribeUrl}`
    : '';
  return `${body.trim()}\n\nReal Estate Gear${footer}`;
}

const templates: Record<PlatformEmailKind, (ctx: PlatformEmailContext) => PlatformEmailTemplate> = {
  [PLATFORM_EMAIL_KINDS.PORTAL_LAUNCHED]: (ctx) => ({
    subject: 'Your portal is live',
    marketing: false,
    text: withSignature(`Hey ${name(ctx)},

Your portal${ctx.portalName ? `, ${ctx.portalName},` : ''} is live.${ctx.portalUrl ? `\n\nPortal URL: ${ctx.portalUrl}` : ''}

Next step: send it to a few people who fit the niche and watch what they ask for. That feedback is usually the fastest way to sharpen the portal.`, ctx, false),
  }),
  [PLATFORM_EMAIL_KINDS.INTERNAL_PORTAL_LAUNCHED]: (ctx) => ({
    subject: `Portal launched: ${ctx.portalName ?? ctx.accountName ?? 'Unknown portal'}`,
    marketing: false,
    text: `Portal launched

Account: ${ctx.accountName ?? 'Unknown'}
Portal: ${ctx.portalName ?? 'Unknown'}
Owner: ${ctx.firstName ?? 'Unknown'} (${ctx.userEmail ?? 'unknown email'})
URL: ${ctx.portalUrl ?? 'unknown'}
Account ID: ${ctx.accountId ?? 'unknown'}`,
  }),
  [PLATFORM_EMAIL_KINDS.INTERNAL_MLS_STATUS_FLAGGED]: (ctx) => ({
    subject: `MLS status flagged: ${ctx.accountName ?? 'Unknown account'}`,
    marketing: false,
    text: `MLS status flagged

The daily MLS status check found this account's agent is no longer active on the roster. No portal has been changed — this needs manual review.

Account: ${ctx.accountName ?? 'Unknown'}
Agent: ${ctx.agentName ?? 'Unknown'}
MLS ID: ${ctx.membershipId ?? 'unknown'}
Account ID: ${ctx.accountId ?? 'unknown'}${ctx.adminAccountUrl ? `\n\nReview: ${ctx.adminAccountUrl}` : ''}`,
  }),
};

export function buildPlatformEmail(kind: PlatformEmailKind, ctx: PlatformEmailContext) {
  return templates[kind](ctx);
}

export async function sendPlatformEmail({
  to,
  kind,
  context,
}: {
  to: string | string[];
  kind: PlatformEmailKind;
  context: PlatformEmailContext;
}) {
  const template = buildPlatformEmail(kind, context);
  return sendPlainTextEmail({
    to,
    subject: template.subject,
    text: template.text,
  });
}
