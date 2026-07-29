import { prisma } from 'db';
import {
  getOrCreateTransactionFolder,
  copyGmailAttachmentToDrive,
  accountHasDriveFileScope,
} from './driveService.js';
import { getAuthorizedAccount } from './googleWorkspaceService.js';

// Reusable include shape for matchedAttachment so the API response is consistent.
const MATCHED_ATTACHMENT_INCLUDE = {
  matchedAttachment: {
    select: {
      id: true,
      filename: true,
      mimeType: true,
      sizeBytes: true,
      providerAttachmentId: true,
      suggestedDocType: true,
      suggestedConfidence: true,
      message: {
        select: {
          id: true,
          subject: true,
          snippet: true,
          sentAt: true,
          providerMessageId: true,
          providerThreadId: true,
        },
      },
    },
  },
} as const;

/**
 * Create document slots from the transaction template when missing (e.g. legacy transactions).
 */
export async function ensureTransactionDocumentsForTransaction(transactionId) {
  const count = await prisma.transactionDocument.count({ where: { transactionId } });
  if (count > 0) return;

  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: { templateId: true },
  });
  if (!tx?.templateId) return;

  const defs = await prisma.templateDocumentDefinition.findMany({
    where: { templateId: tx.templateId },
    orderBy: { sortOrder: 'asc' },
  });
  if (!defs.length) return;

  await prisma.transactionDocument.createMany({
    data: defs.map((def) => ({
      transactionId,
      documentDefinitionId: def.id,
      label: def.label,
      status: 'MISSING',
    })),
  });
}

async function assertTransactionAccess(agentId, transactionId) {
  const tx = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      assignedAgentId: agentId,
    },
    select: { id: true },
  });
  if (!tx) {
    const error = new Error('Transaction not found.');
    error.status = 404;
    throw error;
  }
  return tx;
}

async function assertDocumentOnTransaction(transactionId, documentId) {
  const doc = await prisma.transactionDocument.findFirst({
    where: { id: documentId, transactionId },
    include: {
      ...MATCHED_ATTACHMENT_INCLUDE,
      documentDefinition: true,
    },
  });
  if (!doc) {
    const error = new Error('Document not found.');
    error.status = 404;
    throw error;
  }
  return doc;
}

export async function listTransactionDocuments(agentId, transactionId) {
  await assertTransactionAccess(agentId, transactionId);
  await ensureTransactionDocumentsForTransaction(transactionId);
  return prisma.transactionDocument.findMany({
    where: { transactionId },
    orderBy: { createdAt: 'asc' },
    include: {
      documentDefinition: {
        select: { id: true, key: true, label: true, required: true, sortOrder: true },
      },
      ...MATCHED_ATTACHMENT_INCLUDE,
    },
  });
}

/**
 * Returns CONFIRMED discovered attachments for this transaction that haven't
 * been matched to a document slot yet, plus any already-matched ones.
 * Replaces the old thread-linked attachments endpoint.
 */
export async function listTransactionAttachments(agentId, transactionId) {
  await assertTransactionAccess(agentId, transactionId);

  const matchedIds = new Set(
    (
      await prisma.transactionDocument.findMany({
        where: { transactionId, matchedAttachmentId: { not: null } },
        select: { matchedAttachmentId: true },
      })
    ).map((d) => d.matchedAttachmentId)
  );

  const attachments = await prisma.transactionDiscoveredAttachment.findMany({
    where: {
      message: {
        transactionId,
        status: 'CONFIRMED',
      },
    },
    include: {
      message: {
        select: {
          id: true,
          subject: true,
          snippet: true,
          sentAt: true,
          providerMessageId: true,
          providerThreadId: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return {
    attachments: attachments.map((att) => ({
      ...att,
      isMatched: matchedIds.has(att.id),
    })),
    // Kept for UI compat — true once any sync run has completed for this transaction
    syncRan: await prisma.transactionSyncRun.count({
      where: { transactionId, status: 'COMPLETED' },
    }).then((n) => n > 0),
  };
}

export async function addCustomDocument(agentId, transactionId, { label, notes }: { label?: string; notes?: string } = {}) {
  await assertTransactionAccess(agentId, transactionId);
  if (!label || typeof label !== 'string') {
    const error = new Error('label is required');
    error.status = 400;
    throw error;
  }
  return prisma.transactionDocument.create({
    data: {
      transactionId,
      label: String(label).slice(0, 200),
      notes: notes ? String(notes).slice(0, 2000) : null,
      status: 'MISSING',
    },
    include: {
      documentDefinition: true,
      ...MATCHED_ATTACHMENT_INCLUDE,
    },
  });
}

export async function matchDocumentToAttachment(agentId, transactionId, documentId, attachmentId) {
  await assertTransactionAccess(agentId, transactionId);
  const doc = await assertDocumentOnTransaction(transactionId, documentId);

  if (doc.status === 'VERIFIED') {
    const error = new Error('Unmatch this document before choosing a different attachment.');
    error.status = 400;
    throw error;
  }

  // Verify the attachment belongs to this transaction via the discovered message
  const attachment = await prisma.transactionDiscoveredAttachment.findFirst({
    where: { id: attachmentId },
    include: {
      message: { select: { transactionId: true } },
      matchedDocument: { select: { id: true } },
    },
  });

  if (!attachment || attachment.message?.transactionId !== transactionId) {
    const error = new Error('Attachment not found or not part of this transaction.');
    error.status = 404;
    throw error;
  }

  if (attachment.matchedDocument && attachment.matchedDocument.id !== documentId) {
    const error = new Error('Attachment is already matched to another document.');
    error.status = 409;
    throw error;
  }

  await prisma.$transaction(async (tx) => {
    // Clear previous match on this doc slot if it was pointing elsewhere
    if (doc.matchedAttachmentId && doc.matchedAttachmentId !== attachmentId) {
      await tx.transactionDocument.update({
        where: { id: documentId },
        data: {
          matchedAttachmentId: null,
          matchedAt: null,
          status: 'MISSING',
          driveFileId: null,
          driveWebLink: null,
        },
      });
    }

    // Clear any other slot that was previously matched to this attachment
    const other = await tx.transactionDocument.findFirst({
      where: {
        transactionId,
        matchedAttachmentId: attachmentId,
        NOT: { id: documentId },
      },
    });
    if (other) {
      await tx.transactionDocument.update({
        where: { id: other.id },
        data: {
          matchedAttachmentId: null,
          matchedAt: null,
          status: 'MISSING',
          driveFileId: null,
          driveWebLink: null,
        },
      });
    }

    await tx.transactionDocument.update({
      where: { id: documentId },
      data: {
        matchedAttachmentId: attachmentId,
        matchedAt: new Date(),
        status: 'MATCHED',
      },
    });
  });

  return assertDocumentOnTransaction(transactionId, documentId);
}

export async function unmatchDocument(agentId, transactionId, documentId) {
  await assertTransactionAccess(agentId, transactionId);
  await assertDocumentOnTransaction(transactionId, documentId);

  await prisma.transactionDocument.update({
    where: { id: documentId },
    data: {
      matchedAttachmentId: null,
      matchedAt: null,
      status: 'MISSING',
      driveFileId: null,
      driveWebLink: null,
    },
  });

  return prisma.transactionDocument.findFirst({
    where: { id: documentId },
    include: {
      documentDefinition: true,
      ...MATCHED_ATTACHMENT_INCLUDE,
    },
  });
}

export async function verifyDocument(agentId, transactionId, documentId) {
  await assertTransactionAccess(agentId, transactionId);
  const doc = await assertDocumentOnTransaction(transactionId, documentId);
  if (doc.status !== 'MATCHED' || !doc.matchedAttachmentId) {
    const error = new Error('Only matched documents can be verified.');
    error.status = 400;
    throw error;
  }
  return prisma.transactionDocument.update({
    where: { id: documentId },
    data: { status: 'VERIFIED' },
    include: {
      documentDefinition: true,
      ...MATCHED_ATTACHMENT_INCLUDE,
    },
  });
}

export async function deleteCustomDocument(agentId, transactionId, documentId) {
  await assertTransactionAccess(agentId, transactionId);
  const doc = await assertDocumentOnTransaction(transactionId, documentId);
  if (doc.documentDefinitionId) {
    const error = new Error('Only custom document slots can be deleted.');
    error.status = 400;
    throw error;
  }
  await prisma.transactionDocument.delete({ where: { id: documentId } });
  return { deleted: true };
}

export async function copyMatchedDocumentToDrive(agentId, transactionId, documentId) {
  await assertTransactionAccess(agentId, transactionId);
  const doc = await assertDocumentOnTransaction(transactionId, documentId);

  if (!doc.matchedAttachment || !doc.matchedAttachment.message) {
    const error = new Error('Document has no matched attachment.');
    error.status = 400;
    throw error;
  }

  const { account } = await getAuthorizedAccount(agentId);
  if (!accountHasDriveFileScope(account)) {
    const error = new Error(
      'Google Drive access is not granted. Reconnect Google in Settings to enable file sync.'
    );
    error.status = 403;
    throw error;
  }

  const { folderId } = await getOrCreateTransactionFolder(agentId, transactionId);
  const att = doc.matchedAttachment;

  const uploaded = await copyGmailAttachmentToDrive(agentId, {
    messageId: att.message.providerMessageId,
    attachmentId: att.providerAttachmentId,
    filename: att.filename,
    mimeType: att.mimeType,
    folderId,
  });

  return prisma.transactionDocument.update({
    where: { id: documentId },
    data: {
      driveFileId: uploaded.driveFileId,
      driveWebLink: uploaded.driveWebLink,
    },
    include: {
      documentDefinition: true,
      ...MATCHED_ATTACHMENT_INCLUDE,
    },
  });
}
