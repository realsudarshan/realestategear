import { prisma } from 'db';
import logger from '../utils/logger.js';

/**
 * After a Contact is created, check if a portal User exists with matching email.
 * If found and the contact has no portal link yet, set portalUserId.
 */
export async function tryLinkContactToUser(contactId) {
  try {
    const contact = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact?.email || contact.userId) return;

    const user = await prisma.user.findFirst({
      where: { email: contact.email.toLowerCase() },
    });
    if (!user) return;

    await prisma.contact.update({
      where: { id: contactId },
      data: { userId: user.id },
    });
    logger.info(`Auto-linked contact ${contactId} to portal user ${user.id}`);
  } catch (error) {
    logger.warn(`Failed to auto-link contact ${contactId}:`, error.message);
  }
}

/**
 * After a UserInquiry is created, find any Contacts with the same email
 * that lack a portal link and set portalUserId on each.
 */
export async function tryLinkUserToContacts(userId) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.email) return;

    const unlinkedContacts = await prisma.contact.findMany({
      where: {
        email: { equals: user.email, mode: 'insensitive' },
        userId: null,
      },
    });

    for (const contact of unlinkedContacts) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: { userId: user.id },
      });
      logger.info(`Auto-linked contact ${contact.id} to portal user ${user.id} (via inquiry)`);
    }
  } catch (error) {
    logger.warn(`Failed to auto-link contacts for user ${userId}:`, error.message);
  }
}

/**
 * After a ContactSubmission is created, route it into the CRM:
 * 1. Find existing Contact by email, or create a new one assigned to DEFAULT_AGENT_ID.
 * 2. Link the submission to the contact.
 * 3. Create a FORM_SUBMISSION interaction on the contact.
 * 4. If a portal User exists with the same email, set portalUserId.
 */
export async function processContactSubmission(submissionId) {
  try {
    const submission = await prisma.contactSubmission.findUnique({
      where: { id: submissionId },
    });
    if (!submission) return;

    const normalizedEmail = submission.email.toLowerCase();

    let contact = await prisma.contact.findFirst({
      where: { normalizedEmail },
    });

    if (!contact) {
      const defaultAgentId = process.env.DEFAULT_AGENT_ID;
      if (!defaultAgentId) {
        logger.warn('DEFAULT_AGENT_ID not set — cannot auto-create contact from submission');
        return;
      }

      const defaultMember = await prisma.accountMember.findFirst({ where: { userId: defaultAgentId } });
      if (!defaultMember) {
        logger.warn('DEFAULT_AGENT_ID has no account membership — cannot auto-create contact');
        return;
      }

      contact = await prisma.contact.create({
        data: {
          firstName: submission.firstName,
          lastName: submission.lastName,
          email: normalizedEmail,
          normalizedEmail,
          phone: submission.phone,
          type: 'LEAD',
          stage: 'NEW',
          source: 'website',
          accountId: defaultMember.accountId,
          assignedMemberId: defaultMember.id,
        },
      });
      logger.info(`Created contact ${contact.id} from submission ${submissionId}`);
    }

    await prisma.contactSubmission.update({
      where: { id: submissionId },
      data: { contactId: contact.id },
    });

    await prisma.contactInteraction.create({
      data: {
        contactId: contact.id,
        type: 'FORM_SUBMISSION',
        subject: submission.inquiryType,
        body: submission.message,
      },
    });

    if (!contact.userId) {
      await tryLinkContactToUser(contact.id);
    }
  } catch (error) {
    logger.warn(`Failed to process contact submission ${submissionId}:`, error.message);
  }
}
