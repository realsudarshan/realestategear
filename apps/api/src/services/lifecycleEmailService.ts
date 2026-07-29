import { createHmac, timingSafeEqual } from 'node:crypto';
import { prisma } from 'db';
import {
  buildPlatformEmail,
  PLATFORM_EMAIL_KINDS,
  sendPlatformEmail,
  type PlatformEmailContext,
  type PlatformEmailKind,
} from 'email';
import logger from '../utils/logger.js';
import { getEmailUnsubscribeSecret } from '../utils/secrets.js';

type AccountEmailTarget = {
  id: string;
  name: string | null;
  createdAt?: Date;
  members?: Array<{
    role: string;
    user: {
      id: string;
      email: string;
      firstName: string | null;
      marketingEmailsOptOutAt?: Date | null;
    };
  }>;
};

function getApiBaseUrl() {
  return process.env.API_PUBLIC_URL || process.env.PUBLIC_API_URL || process.env.FRONTEND_URL || 'http://localhost:3001';
}

export function getAdminUrl() {
  return process.env.ADMIN_URL || 'http://localhost:3004';
}

export function getInternalEmail() {
  return process.env.REALESTATEGEAR_INTERNAL_EMAIL || process.env.EMAIL_REPLY_TO || 'kyle@realestategear.com';
}

export function getPublicPortalUrl(slug: string) {
  const base = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/p/${slug}`;
}

export function signUnsubscribeToken(userId: string) {
  const signature = createHmac('sha256', getEmailUnsubscribeSecret()).update(userId).digest('base64url');
  return `${userId}.${signature}`;
}

export function verifyUnsubscribeToken(token: string) {
  const [userId, signature] = token.split('.');
  if (!userId || !signature) return null;
  const expected = createHmac('sha256', getEmailUnsubscribeSecret()).update(userId).digest('base64url');
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return null;
  return timingSafeEqual(actualBuffer, expectedBuffer) ? userId : null;
}

export function unsubscribeUrlForUser(userId: string) {
  return `${getApiBaseUrl().replace(/\/$/, '')}/api/email/unsubscribe?token=${encodeURIComponent(signUnsubscribeToken(userId))}`;
}

function ownerForAccount(account: AccountEmailTarget) {
  return account.members?.find((member) => member.role === 'OWNER')?.user ?? null;
}

export const ACCOUNT_EMAIL_TARGET_SELECT = {
  id: true,
  name: true,
  createdAt: true,
  members: {
    where: { role: 'OWNER' },
    take: 1,
    select: {
      role: true,
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          marketingEmailsOptOutAt: true,
        },
      },
    },
  },
} as const;

export async function getAccountEmailTarget(accountId: string) {
  return prisma.account.findUnique({
    where: { id: accountId },
    select: ACCOUNT_EMAIL_TARGET_SELECT,
  });
}

export async function sendAccountLifecycleEmail({
  account,
  kind,
  deliveryKind = kind,
  context = {},
  ignoreOptOut = false,
  to,
}: {
  account: AccountEmailTarget;
  kind: PlatformEmailKind;
  deliveryKind?: string;
  context?: PlatformEmailContext;
  ignoreOptOut?: boolean;
  to?: string;
}) {
  const owner = ownerForAccount(account);
  const recipient = to ?? owner?.email;
  if (!recipient) return { ok: false, skipped: true, reason: 'missing_recipient' };
  if (!ignoreOptOut && owner?.marketingEmailsOptOutAt) {
    return { ok: false, skipped: true, reason: 'marketing_opt_out' };
  }

  const emailContext: PlatformEmailContext = {
    firstName: owner?.firstName,
    accountName: account.name,
    unsubscribeUrl: owner && !ignoreOptOut ? unsubscribeUrlForUser(owner.id) : null,
    userEmail: owner?.email,
    accountId: account.id,
    ...context,
  };
  const template = buildPlatformEmail(kind, emailContext);

  let delivery;
  try {
    delivery = await prisma.emailDelivery.create({
      data: {
        accountId: account.id,
        userId: owner?.id ?? null,
        kind: deliveryKind,
        to: Array.isArray(recipient) ? recipient.join(',') : recipient,
        subject: template.subject,
      },
    });
  } catch (err) {
    if (err?.code === 'P2002') return { ok: false, skipped: true, reason: 'already_sent' };
    throw err;
  }

  const cleanupDelivery = () =>
    prisma.emailDelivery.delete({ where: { id: delivery.id } }).catch((cleanupErr) =>
      logger.warn('Failed to clean up delivery row after a failed send — retries for this account+kind will be blocked until this row is removed:', {
        deliveryId: delivery.id,
        accountId: account.id,
        kind: deliveryKind,
        error: cleanupErr?.message,
      })
    );

  let result;
  try {
    result = await sendPlatformEmail({ to: recipient, kind, context: emailContext });
  } catch (err) {
    await cleanupDelivery();
    throw err;
  }
  if (!result.ok) {
    await cleanupDelivery();
    return result;
  }
  await prisma.emailDelivery.update({
    where: { id: delivery.id },
    data: { providerId: result.id ?? null },
  });
  return result;
}

export async function sendInternalMlsStatusFlaggedAlert(
  account: AccountEmailTarget,
  { membershipId, agentName, flaggedAt }: { membershipId: string; agentName?: string | null; flaggedAt: Date },
) {
  // deliveryKind includes the flagged date (not just membershipId) because this
  // is a recurring event — an account can be flagged, cleared, then flagged
  // again later. Scoping by membershipId alone (like PORTAL_LAUNCHED does for
  // its one-time event) would permanently dedupe after the first alert ever
  // sent for this membership, silently swallowing every future recurrence.
  const dateKey = flaggedAt.toISOString().slice(0, 10);
  return sendAccountLifecycleEmail({
    account,
    kind: PLATFORM_EMAIL_KINDS.INTERNAL_MLS_STATUS_FLAGGED,
    deliveryKind: `${PLATFORM_EMAIL_KINDS.INTERNAL_MLS_STATUS_FLAGGED}:${membershipId}:${dateKey}`,
    context: {
      membershipId,
      agentName,
      adminAccountUrl: `${getAdminUrl().replace(/\/$/, '')}/accounts/${account.id}`,
    },
    ignoreOptOut: true,
    to: getInternalEmail(),
  }).catch((err) => logger.warn('Failed to send internal MLS status flagged alert:', { error: err?.message }));
}

export async function sendPortalLaunchedEmails({
  account,
  portalId,
  portalName,
  portalSlug,
}: {
  account: AccountEmailTarget;
  portalId: string;
  portalName: string;
  portalSlug: string;
}) {
  const context = {
    portalName,
    portalUrl: getPublicPortalUrl(portalSlug),
  };
  await sendAccountLifecycleEmail({
    account,
    kind: PLATFORM_EMAIL_KINDS.PORTAL_LAUNCHED,
    deliveryKind: `${PLATFORM_EMAIL_KINDS.PORTAL_LAUNCHED}:${portalId}`,
    context,
    ignoreOptOut: true,
  }).catch((err) => logger.warn('Failed to send portal launched email:', { error: err?.message }));
  await sendAccountLifecycleEmail({
    account,
    kind: PLATFORM_EMAIL_KINDS.INTERNAL_PORTAL_LAUNCHED,
    deliveryKind: `${PLATFORM_EMAIL_KINDS.INTERNAL_PORTAL_LAUNCHED}:${portalId}`,
    context,
    ignoreOptOut: true,
    to: getInternalEmail(),
  }).catch((err) => logger.warn('Failed to send internal portal launched alert:', { error: err?.message }));
}
