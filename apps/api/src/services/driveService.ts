import { prisma } from 'db';
import { getAuthorizedAccount } from './googleWorkspaceService.js';

const GMAIL_ATTACHMENTS_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3/files';
const DRIVE_FILES_BASE = 'https://www.googleapis.com/drive/v3/files';

const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

function parseScopeList(scopes) {
  if (!scopes) return [];
  if (Array.isArray(scopes)) return scopes.map(String);
  return String(scopes)
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function accountHasDriveFileScope(account) {
  const list = parseScopeList(account?.scopes);
  return list.some((s) => s === DRIVE_FILE_SCOPE);
}

async function driveJsonRequest(url, accessToken, init: RequestInit = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(init.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof data.error?.message === 'string'
        ? data.error.message
        : typeof data.error_description === 'string'
          ? data.error_description
          : 'Google Drive API request failed.';
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }
  return data;
}

async function fetchGmailAttachmentBytes(accessToken, messageId, attachmentId) {
  const url = `${GMAIL_ATTACHMENTS_BASE}/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error?.message || 'Gmail attachment fetch failed.');
    error.status = res.status;
    throw error;
  }
  if (!data.data) {
    const error = new Error('Gmail attachment response missing data.');
    error.status = 400;
    throw error;
  }
  return Buffer.from(data.data, 'base64url');
}

/**
 * Ensure the transaction has a Drive folder; create if missing.
 * Returns { folderId }.
 */
export async function getOrCreateTransactionFolder(userId, transactionId) {
  const { accessToken, account } = await getAuthorizedAccount(userId);
  if (!accountHasDriveFileScope(account)) {
    const error = new Error(
      'Google Drive access is not granted. Reconnect Google in Settings to enable file sync.'
    );
    error.status = 403;
    throw error;
  }

  const tx = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      assignedAgentId: userId,
    },
    select: { id: true, address: true, driveFolderId: true },
  });
  if (!tx) {
    const error = new Error('Transaction not found.');
    error.status = 404;
    throw error;
  }
  if (tx.driveFolderId) {
    return { folderId: tx.driveFolderId };
  }

  const folderName = `${tx.address || 'Transaction'} - Files`.slice(0, 200);
  const meta = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };

  const created = await driveJsonRequest(`${DRIVE_FILES_BASE}?fields=id,webViewLink`, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(meta),
  });

  await prisma.transaction.update({
    where: { id: transactionId },
    data: { driveFolderId: created.id },
  });

  return { folderId: created.id };
}

/**
 * Upload bytes from a Gmail attachment into the transaction Drive folder.
 */
export async function copyGmailAttachmentToDrive(
  userId,
  { messageId, attachmentId, filename, mimeType, folderId }
) {
  const { accessToken, account } = await getAuthorizedAccount(userId);
  if (!accountHasDriveFileScope(account)) {
    const error = new Error(
      'Google Drive access is not granted. Reconnect Google in Settings to enable file sync.'
    );
    error.status = 403;
    throw error;
  }

  const fileBuffer = await fetchGmailAttachmentBytes(accessToken, messageId, attachmentId);
  const safeName = (filename || 'document').replace(/[/\\?%*:|"<>]/g, '_').slice(0, 200);
  const contentType = mimeType || 'application/octet-stream';

  const boundary = `boundary_${Date.now()}`;
  const metadata = JSON.stringify({
    name: safeName,
    parents: [folderId],
    mimeType: contentType,
  });

  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const body = Buffer.concat([
    Buffer.from(`${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${metadata}`, 'utf8'),
    Buffer.from(`${delimiter}Content-Type: ${contentType}\r\n\r\n`, 'utf8'),
    fileBuffer,
    Buffer.from(closeDelimiter, 'utf8'),
  ]);

  const params = new URLSearchParams({
    uploadType: 'multipart',
    fields: 'id,name,webViewLink,mimeType',
  });

  const res = await fetch(`${DRIVE_UPLOAD_BASE}?${params.toString()}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof data.error?.message === 'string' ? data.error.message : 'Drive upload failed.';
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }

  return {
    driveFileId: data.id,
    driveWebLink: data.webViewLink || null,
    name: data.name || safeName,
    mimeType: data.mimeType || contentType,
  };
}

/**
 * List files in a Drive folder (non-trashed).
 */
export async function listDriveFilesInFolder(userId, folderId) {
  const { accessToken, account } = await getAuthorizedAccount(userId);
  if (!accountHasDriveFileScope(account)) {
    const error = new Error(
      'Google Drive access is not granted. Reconnect Google in Settings to enable file sync.'
    );
    error.status = 403;
    throw error;
  }

  const q = `'${folderId}' in parents and trashed = false`;
  const params = new URLSearchParams({
    q,
    fields: 'files(id,name,mimeType,webViewLink,createdTime,modifiedTime)',
    pageSize: '100',
  });

  const data = await driveJsonRequest(`${DRIVE_FILES_BASE}?${params.toString()}`, accessToken);
  return (data.files || []).map((f) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    webViewLink: f.webViewLink || null,
    createdTime: f.createdTime || null,
    modifiedTime: f.modifiedTime || null,
  }));
}
