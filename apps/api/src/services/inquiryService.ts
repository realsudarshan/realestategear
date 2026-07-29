import { prisma } from 'db';

export type CreateInquiryInput = {
  portalSlug: string;
  userId?: string;
  listingId?: string | null;
  visitorName?: string;
  visitorEmail?: string;
  visitorPhone?: string | null;
  message: string;
  contactPreference?: string | null;
  areaSlug?: string | null;
  collectionSlug?: string | null;
};

export class InquiryInputError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function splitName(name: string) {
  const [firstName, ...rest] = name.trim().split(/\s+/);
  return { firstName, lastName: rest.join(' ') };
}

export async function createInquiry(input: CreateInquiryInput) {
  return prisma.$transaction(async (tx) => {
    const portal = await tx.portal.findUnique({
      where: { slug: input.portalSlug },
      select: { id: true, accountId: true, isActive: true, agentEmail: true, name: true },
    });
    if (!portal || !portal.isActive) throw new InquiryInputError('Portal not found', 404);

    const user = input.userId
      ? await tx.user.findFirst({
          where: { id: input.userId, accountId: portal.accountId, portalId: portal.id },
          select: { id: true, email: true, firstName: true, lastName: true, phoneNumber: true },
        })
      : null;
    if (input.userId && !user) throw new InquiryInputError('User is not authorized for this portal', 403);

    const visitorName = input.visitorName?.trim()
      || [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
    const visitorEmail = normalizeEmail(input.visitorEmail || user?.email || '');
    const visitorPhone = input.visitorPhone ?? user?.phoneNumber ?? null;
    if (!visitorName || !visitorEmail || !input.message.trim()) {
      throw new InquiryInputError('Name, email, and message are required');
    }

    if (input.listingId) {
      const listing = await tx.listing.findUnique({ where: { id: input.listingId }, select: { id: true } });
      if (!listing) throw new InquiryInputError('Listing not found', 404);
    }
    const area = input.areaSlug ? await tx.geographicArea.findFirst({ where: { accountId: portal.accountId, slug: input.areaSlug, isPublished: true }, select: { id: true, slug: true, name: true } }) : null;
    if (input.areaSlug && !area) throw new InquiryInputError('Area attribution is invalid');
    const collection = input.collectionSlug ? await tx.listingCollection.findFirst({ where: { portalId: portal.id, slug: input.collectionSlug, isPublished: true }, select: { id: true, slug: true, name: true } }) : null;
    if (input.collectionSlug && !collection) throw new InquiryInputError('Collection attribution is invalid');

    const { firstName, lastName } = splitName(visitorName);
    const contact = await tx.contact.upsert({
      where: {
        accountId_normalizedEmail: { accountId: portal.accountId, normalizedEmail: visitorEmail },
      },
      create: {
        accountId: portal.accountId,
        firstName,
        lastName,
        email: visitorEmail,
        normalizedEmail: visitorEmail,
        phone: visitorPhone,
        userId: user?.id,
        type: 'LEAD',
        stage: 'NEW',
        source: 'portal',
      },
      update: {
        phone: visitorPhone || undefined,
        userId: user?.id || undefined,
      },
    });

    await tx.contactInteraction.create({
      data: {
        contactId: contact.id,
        type: 'FORM_SUBMISSION',
        subject: 'Portal inquiry',
        body: input.message.trim(),
      },
    });

    const inquiry = await tx.inquiry.create({
      data: {
        accountId: portal.accountId,
        portalId: portal.id,
        userId: user?.id,
        listingId: input.listingId || null,
        areaId: area?.id,
        collectionId: collection?.id,
        contactId: contact.id,
        source: user ? 'PORTAL_AUTHENTICATED' : 'PORTAL_ANONYMOUS',
        visitorName,
        visitorEmail,
        visitorPhone,
        message: input.message.trim(),
        contactPreference: input.contactPreference || null,
        areaSnapshot: area ? JSON.stringify({ slug: area.slug, name: area.name }) : null,
        collectionSnapshot: collection ? JSON.stringify({ slug: collection.slug, name: collection.name }) : null,
      },
    });

    if (portal.agentEmail) {
      const text = [
        `${visitorName} submitted an inquiry on ${portal.name}.`,
        `Email: ${visitorEmail}`,
        visitorPhone ? `Phone: ${visitorPhone}` : null,
        `Message: ${input.message.trim()}`,
      ].filter(Boolean).join('\n\n');
      await tx.inquiryDelivery.create({
        data: {
          inquiryId: inquiry.id,
          accountId: portal.accountId,
          kind: 'OWNER_INQUIRY_NOTIFICATION',
          recipient: normalizeEmail(portal.agentEmail),
          idempotencyKey: `owner-inquiry:${inquiry.id}`,
          payload: { subject: `New inquiry on ${portal.name}`, text },
        },
      });
    }

    return inquiry;
  });
}
