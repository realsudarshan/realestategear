import { randomBytes } from 'node:crypto';
import { resolveTxt } from 'node:dns/promises';
import { prisma } from 'db';

// docs/plans/PORTAL_PLATFORM_PLAN.md Phase 1: "Add PortalDomain persistence
// and verified-domain state machine." Portal.customDomain (the older raw
// @unique field on Portal) is untouched by this file — nothing here reads or
// writes it. See the plan's "Open Decisions" for the long-term reconciliation.

const HOSTNAME_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;
const CHALLENGE_PREFIX = '_realestategear-challenge.';

function fail(message: string, statusCode: number): never {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  throw err;
}

// Heuristic, not a public-suffix-list parse: "www" first label -> WWW,
// exactly two labels -> APEX, anything longer -> SUBDOMAIN. Misclassifies
// multi-part TLDs (e.g. "example.co.uk" reads as SUBDOMAIN). `kind` only
// drives which DNS instructions get shown (A/ALIAS vs CNAME) — it doesn't
// gate verification — so that's an acceptable v1 gap.
function classifyHostname(hostname: string): 'APEX' | 'WWW' | 'SUBDOMAIN' {
  const labels = hostname.split('.');
  if (labels[0] === 'www') return 'WWW';
  return labels.length <= 2 ? 'APEX' : 'SUBDOMAIN';
}

export function verificationTxtRecordName(hostname: string): string {
  return `${CHALLENGE_PREFIX}${hostname}`;
}

export async function listDomainsForPortal(portalId: string) {
  return prisma.portalDomain.findMany({ where: { portalId }, orderBy: { createdAt: 'asc' } });
}

export async function createDomain(portalId: string, rawHostname: string) {
  const hostname = rawHostname.trim().toLowerCase().replace(/\.$/, '');
  if (!HOSTNAME_RE.test(hostname)) {
    fail('Enter a valid domain hostname, e.g. example.com or www.example.com.', 400);
  }

  const portal = await prisma.portal.findUnique({ where: { id: portalId }, select: { id: true } });
  if (!portal) fail('Portal not found', 404);

  const verificationToken = randomBytes(16).toString('hex');
  try {
    return await prisma.portalDomain.create({
      data: { portalId, hostname, kind: classifyHostname(hostname), verificationToken },
    });
  } catch (err: any) {
    if (err.code === 'P2002') fail('This domain is already registered to a portal.', 409);
    throw err;
  }
}

// DNS TXT ownership check against a fixed challenge subdomain (works for
// apex hostnames too, since it's always a subdomain of the target). Idempotent:
// re-verifying an already-active domain just returns it. The 'manual'
// provider (the only one implemented — see PortalDomain.provider in
// schema.prisma) has no SSL-automation step, so a verified domain goes
// straight to ACTIVE instead of parking in SSL_PENDING.
export async function verifyDomain(portalId: string, domainId: string) {
  const domain = await prisma.portalDomain.findFirst({ where: { id: domainId, portalId } });
  if (!domain) fail('Domain not found', 404);
  if (domain.status === 'REMOVED') fail('Domain has been removed', 400);
  if (domain.status === 'ACTIVE' || domain.status === 'VERIFIED') return domain;

  let records: string[][] = [];
  try {
    records = await resolveTxt(verificationTxtRecordName(domain.hostname));
  } catch {
    // NXDOMAIN / no TXT record yet — not a server error, just "not verified".
  }
  const found = records.some((chunks) => chunks.join('') === domain.verificationToken);
  if (!found) {
    fail(
      `DNS TXT record not found. Add a TXT record at ${verificationTxtRecordName(domain.hostname)} ` +
        `with value ${domain.verificationToken}, then retry.`,
      422
    );
  }

  return prisma.portalDomain.update({
    where: { id: domainId },
    data: { status: 'ACTIVE', verifiedAt: new Date(), activatedAt: new Date() },
  });
}

// Unset-then-set in one transaction so a portal never has zero or two
// canonical domains mid-write — same pattern as segmentSyncOps in
// agentPortals.ts.
export async function setCanonicalDomain(portalId: string, domainId: string) {
  const domain = await prisma.portalDomain.findFirst({ where: { id: domainId, portalId } });
  if (!domain) fail('Domain not found', 404);
  if (domain.status !== 'ACTIVE') {
    fail('Domain must be verified and active before it can be canonical', 400);
  }

  const [, updated] = await prisma.$transaction([
    prisma.portalDomain.updateMany({ where: { portalId, canonical: true }, data: { canonical: false } }),
    prisma.portalDomain.update({ where: { id: domainId }, data: { canonical: true } }),
  ]);
  return updated;
}

// Hard delete for v1 — no audit trail exists yet to preserve (the platform
// plan's "Audit Log Requirements" section covers domain removal, but that's
// separate, unbuilt work). The REMOVED status in PortalDomainStatus is
// reserved for when a soft-delete/audit path lands; this function doesn't
// set it today.
export async function removeDomain(portalId: string, domainId: string) {
  const domain = await prisma.portalDomain.findFirst({ where: { id: domainId, portalId } });
  if (!domain) fail('Domain not found', 404);
  await prisma.portalDomain.delete({ where: { id: domainId } });
}
