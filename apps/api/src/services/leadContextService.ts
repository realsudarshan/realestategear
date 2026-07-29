/**
 * leadContextService — normalizes lead context from canonical inquiries and contact submissions
 * into a unified LeadContext shape for the AI.
 *
 * Source types:
 *   inquiry           → Inquiry
 *   contact_submission → ContactSubmission
 */
import { prisma } from 'db';
import logger from '../utils/logger.js';

export interface LeadContext {
  source: {
    type: 'inquiry' | 'contact_submission';
    id: string;
    message: string;
    inquiryType: string | null;
    contactPreference: string | null;
    submittedAt: string;
  };
  lead: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    contactId: string | null;
    stage: string | null;
    tags: string[] | null;
    source: string | null;
    priorInteractionCount: number;
  };
  property: {
    id: string;
    address: string;
    city: string;
    state: string;
    price: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    squareFeet: number | null;
    status: string | null;
    propertyType: string | null;
  } | null;
  agentId: string;
}

// ─── Inquiry ──────────────────────────────────────────────────────────────────

export async function fromInquiry(inquiryId: string): Promise<LeadContext | null> {
  const inquiry = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    include: {
      contact: { include: { interactions: { select: { id: true } } } },
      listing: { include: { property: true } },
    },
  });

  if (!inquiry) {
    logger.warn(`leadContextService: inquiry ${inquiryId} not found`);
    return null;
  }

  const owner = await prisma.accountMember.findFirst({
    where: { accountId: inquiry.accountId, role: 'OWNER' },
  });
  const agentId = owner?.userId ?? null;

  if (!agentId) {
    logger.warn(`leadContextService: no owner found for account ${inquiry.accountId} (inquiry ${inquiryId})`);
    return null;
  }

  const [firstName, ...rest] = inquiry.visitorName.trim().split(' ');
  const lastName = rest.join(' ') || '';

  return {
    source: {
      type: 'inquiry',
      id: inquiry.id,
      message: inquiry.message,
      inquiryType: null,
      contactPreference: inquiry.contactPreference,
      submittedAt: inquiry.createdAt.toISOString(),
    },
    lead: {
      firstName,
      lastName,
      email: inquiry.visitorEmail,
      phone: inquiry.visitorPhone ?? null,
      contactId: inquiry.contact.id,
      stage: inquiry.contact.stage,
      tags: (inquiry.contact.tags as string[]) ?? null,
      source: inquiry.contact.source,
      priorInteractionCount: inquiry.contact.interactions.length,
    },
    property: inquiry.listing ? normalizeListing(inquiry.listing) : null,
    agentId,
  };
}

// ─── Contact submission ────────────────────────────────────────────────────────

export async function fromContactSubmission(submissionId: string): Promise<LeadContext | null> {
  const submission = await prisma.contactSubmission.findUnique({
    where: { id: submissionId },
    include: {
      contact: {
        include: { interactions: { select: { id: true } } },
      },
    },
  });

  if (!submission) {
    logger.warn(`leadContextService: contact submission ${submissionId} not found`);
    return null;
  }

  const contact = submission.contact;

  let agentId: string | null = null;
  if (contact) {
    const member = await prisma.accountMember.findFirst({
      where: { accountId: contact.accountId, role: 'OWNER' },
    });
    agentId = member?.userId ?? null;
  }
  if (!agentId) agentId = process.env.DEFAULT_AGENT_ID ?? null;

  if (!agentId) {
    logger.warn(`leadContextService: no agent for submission ${submissionId} — skipping`);
    return null;
  }

  return {
    source: {
      type: 'contact_submission',
      id: submission.id,
      message: submission.message,
      inquiryType: submission.inquiryType,
      contactPreference: null,
      submittedAt: submission.createdAt.toISOString(),
    },
    lead: {
      firstName: submission.firstName,
      lastName: submission.lastName,
      email: submission.email,
      phone: submission.phone ?? null,
      contactId: contact?.id ?? null,
      stage: contact?.stage ?? null,
      tags: (contact?.tags as string[]) ?? null,
      source: contact?.source ?? null,
      priorInteractionCount: contact?.interactions.length ?? 0,
    },
    property: null,
    agentId,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeListing(listing: any) {
  const p = listing.property ?? {};
  return {
    id: listing.id,
    address: p.address ?? null,
    city: p.city ?? null,
    state: p.state ?? null,
    price: listing.listPrice ? listing.listPrice.toString() : null,
    bedrooms: listing.bedrooms ?? p.bedrooms ?? null,
    bathrooms: listing.bathrooms ?? p.bathrooms ?? null,
    squareFeet: listing.squareFeet ?? p.squareFeet ?? null,
    status: listing.status ?? null,
    propertyType: p.propertyType ?? null,
  };
}
