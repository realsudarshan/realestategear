import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { prisma } from 'db';

const GOOGLE_PROVIDER = 'google';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';
const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v2/userinfo';
const GMAIL_BASE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me';
const CALENDAR_BASE_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary';
const ACCESS_TOKEN_REFRESH_BUFFER_MS = 60 * 1000;

function getGoogleConfig() {
  const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_TOKEN_ENCRYPTION_KEY,
  } = process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_TOKEN_ENCRYPTION_KEY) {
    throw new Error('Google integration is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_TOKEN_ENCRYPTION_KEY.');
  }

  return {
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    encryptionKey: GOOGLE_TOKEN_ENCRYPTION_KEY,
  };
}

function getCipherKey(secret) {
  return createHash('sha256').update(secret).digest();
}

function encryptToken(value, secret) {
  if (!value) return null;

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getCipherKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptToken(value, secret) {
  if (!value) return null;

  const [ivB64, tagB64, encryptedB64] = value.split(':');
  if (!ivB64 || !tagB64 || !encryptedB64) {
    throw new Error('Stored Google token is invalid.');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    getCipherKey(secret),
    Buffer.from(ivB64, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedB64, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

function parseScopeList(scopeValue) {
  if (!scopeValue) return [];
  if (Array.isArray(scopeValue)) return scopeValue.filter(Boolean);
  return String(scopeValue)
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function parseJsonArray(value) {
  return Array.isArray(value) ? value : [];
}

async function googleTokenRequest(body) {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error_description === 'string' ? data.error_description : 'Google token exchange failed.');
  }

  return data;
}

async function googleJsonRequest(url, accessToken, init: RequestInit = {}) {
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
          : 'Google API request failed.';
    const error = new Error(message);
    error.status = res.status;
    error.body = data;
    throw error;
  }

  return data;
}

function buildEmailAddress(name, email) {
  if (name && email) return `${name} <${email}>`;
  return email || name || null;
}

function parseHeaderMap(headers = []) {
  return headers.reduce((acc, header) => {
    if (header?.name) acc[header.name.toLowerCase()] = header.value;
    return acc;
  }, {});
}

function extractParticipants(message) {
  const payloadHeaders = message?.payload?.headers || [];
  const headerMap = parseHeaderMap(payloadHeaders);
  return {
    from: headerMap.from || null,
    to: headerMap.to || null,
    cc: headerMap.cc || null,
    subject: headerMap.subject || null,
    date: headerMap.date || null,
  };
}

function toIsoDateTime(startOrEnd) {
  if (!startOrEnd) return null;
  return startOrEnd.dateTime || startOrEnd.date || null;
}

function mapCalendarEvent(event) {
  return {
    id: event.id,
    status: event.status || 'confirmed',
    title: event.summary || '(Untitled event)',
    description: event.description || null,
    location: event.location || null,
    organizerEmail: event.organizer?.email || null,
    htmlLink: event.htmlLink || null,
    isAllDay: Boolean(event.start?.date && !event.start?.dateTime),
    start: toIsoDateTime(event.start),
    end: toIsoDateTime(event.end),
    attendees: (event.attendees || []).map((attendee) => ({
      email: attendee.email || null,
      displayName: attendee.displayName || null,
      responseStatus: attendee.responseStatus || null,
    })),
  };
}

async function getConnectedAccount(userId) {
  return prisma.connectedAccount.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: GOOGLE_PROVIDER,
      },
    },
  });
}

async function saveTokensForAccount(accountId, tokenResponse, secret) {
  const accessTokenExpiresAt = tokenResponse.expires_in
    ? new Date(Date.now() + Number(tokenResponse.expires_in) * 1000)
    : null;

  return prisma.connectedAccount.update({
    where: { id: accountId },
    data: {
      encryptedAccessToken: tokenResponse.access_token
        ? encryptToken(tokenResponse.access_token, secret)
        : undefined,
      encryptedRefreshToken: tokenResponse.refresh_token
        ? encryptToken(tokenResponse.refresh_token, secret)
        : undefined,
      accessTokenExpiresAt,
      scopes: tokenResponse.scope ? parseScopeList(tokenResponse.scope) : undefined,
    },
  });
}

export async function getAuthorizedAccount(userId) {
  const config = getGoogleConfig();
  const account = await getConnectedAccount(userId);
  if (!account) {
    const error = new Error('Google account not connected.');
    error.status = 404;
    throw error;
  }

  const accessTokenIsFresh =
    account.encryptedAccessToken &&
    account.accessTokenExpiresAt &&
    account.accessTokenExpiresAt.getTime() > Date.now() + ACCESS_TOKEN_REFRESH_BUFFER_MS;

  if (accessTokenIsFresh) {
    return {
      account,
      accessToken: decryptToken(account.encryptedAccessToken, config.encryptionKey),
      config,
    };
  }

  if (!account.encryptedRefreshToken) {
    const error = new Error('Google account needs to be reconnected.');
    error.status = 400;
    throw error;
  }

  const refreshToken = decryptToken(account.encryptedRefreshToken, config.encryptionKey);
  const refreshed = await googleTokenRequest({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const updatedAccount = await saveTokensForAccount(account.id, refreshed, config.encryptionKey);
  return {
    account: updatedAccount,
    accessToken: decryptToken(updatedAccount.encryptedAccessToken, config.encryptionKey),
    config,
  };
}

async function getThreadDetails(accessToken, threadId) {
  const params = new URLSearchParams();
  params.set('format', 'metadata');
  ['Subject', 'From', 'To', 'Cc', 'Date'].forEach((header) => {
    params.append('metadataHeaders', header);
  });

  const thread = await googleJsonRequest(
    `${GMAIL_BASE_URL}/threads/${threadId}?${params.toString()}`,
    accessToken
  );

  const lastMessage = thread.messages?.[thread.messages.length - 1];
  const participants = extractParticipants(lastMessage);

  return {
    id: thread.id,
    snippet: thread.snippet || null,
    historyId: thread.historyId || null,
    subject: participants.subject,
    from: participants.from,
    to: participants.to,
    cc: participants.cc,
    lastMessageAt: lastMessage?.internalDate
      ? new Date(Number(lastMessage.internalDate)).toISOString()
      : null,
    unread: Boolean(lastMessage?.labelIds?.includes('UNREAD')),
    messageCount: thread.messages?.length || 0,
  };
}

async function searchGmailThreads(accessToken, options: Record<string, any> = {}) {
  const params = new URLSearchParams();
  params.set('maxResults', String(options.limit || 20));
  params.set('includeSpamTrash', 'false');
  if (options.query) params.set('q', options.query);
  if (options.pageToken) params.set('pageToken', options.pageToken);

  const response = await googleJsonRequest(
    `${GMAIL_BASE_URL}/threads?${params.toString()}`,
    accessToken
  );

  const threads = await Promise.all(
    (response.threads || []).map((thread) => getThreadDetails(accessToken, thread.id))
  );

  return {
    threads,
    nextPageToken: response.nextPageToken || null,
    resultSizeEstimate: response.resultSizeEstimate || threads.length,
  };
}

export async function getConnectionStatus(userId) {
  const account = await getConnectedAccount(userId);
  if (!account) {
    return {
      connected: false,
      provider: GOOGLE_PROVIDER,
      driveScopeGranted: false,
      availableScopes: [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/drive.file',
      ],
    };
  }

  const scopesList = parseJsonArray(account.scopes);
  const driveScopeGranted = scopesList.some(
    (s) => s === 'https://www.googleapis.com/auth/drive.file'
  );

  return {
    connected: true,
    provider: account.provider,
    email: account.email,
    displayName: account.displayName,
    scopes: scopesList,
    driveScopeGranted,
    accessTokenExpiresAt: account.accessTokenExpiresAt?.toISOString() || null,
    lastSyncedAt: account.lastSyncedAt?.toISOString() || null,
    gmailHistoryId: account.gmailHistoryId || null,
    calendarSyncToken: account.calendarSyncToken || null,
  };
}

export async function completeOAuthCallback(userId, { code, redirectUri }) {
  const config = getGoogleConfig();

  const tokenResponse = await googleTokenRequest({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const profile = await googleJsonRequest(USERINFO_ENDPOINT, tokenResponse.access_token);
  const existingAccount = await getConnectedAccount(userId);

  const baseData = {
    provider: GOOGLE_PROVIDER,
    providerAccountId: String(profile.id),
    email: profile.email,
    displayName: profile.name || null,
    scopes: parseScopeList(tokenResponse.scope),
    encryptedAccessToken: tokenResponse.access_token
      ? encryptToken(tokenResponse.access_token, config.encryptionKey)
      : null,
    encryptedRefreshToken: tokenResponse.refresh_token
      ? encryptToken(tokenResponse.refresh_token, config.encryptionKey)
      : existingAccount?.encryptedRefreshToken || null,
    accessTokenExpiresAt: tokenResponse.expires_in
      ? new Date(Date.now() + Number(tokenResponse.expires_in) * 1000)
      : null,
    syncEnabled: true,
  };

  const account = existingAccount
    ? await prisma.connectedAccount.update({
        where: { id: existingAccount.id },
        data: baseData,
      })
    : await prisma.connectedAccount.create({
        data: {
          userId,
          ...baseData,
        },
      });

  return {
    connected: true,
    email: account.email,
    displayName: account.displayName,
    scopes: parseJsonArray(account.scopes),
  };
}

export async function disconnectGoogleAccount(userId) {
  const account = await getConnectedAccount(userId);
  if (!account) return { disconnected: true };

  const { encryptionKey } = getGoogleConfig();
  const refreshToken = decryptToken(account.encryptedRefreshToken, encryptionKey);
  const accessToken = decryptToken(account.encryptedAccessToken, encryptionKey);
  const tokenToRevoke = refreshToken || accessToken;

  if (tokenToRevoke) {
    await fetch(REVOKE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: tokenToRevoke }),
    }).catch(() => undefined);
  }

  await prisma.connectedAccount.delete({ where: { id: account.id } });
  return { disconnected: true };
}

export async function getCalendarEvents(
  userId,
  { limit = 20, pageToken }: { limit?: number; pageToken?: string } = {}
) {
  const { accessToken, account } = await getAuthorizedAccount(userId);
  const params = new URLSearchParams({
    maxResults: String(limit),
    singleEvents: 'true',
    orderBy: 'startTime',
    timeMin: new Date().toISOString(),
  });
  if (pageToken) params.set('pageToken', pageToken);

  const response = await googleJsonRequest(
    `${CALENDAR_BASE_URL}/events?${params.toString()}`,
    accessToken
  );

  if (response.nextSyncToken || !account.lastSyncedAt) {
    await prisma.connectedAccount.update({
      where: { id: account.id },
      data: {
        calendarSyncToken: response.nextSyncToken || account.calendarSyncToken,
        lastSyncedAt: new Date(),
      },
    });
  }

  return {
    events: (response.items || []).map(mapCalendarEvent),
    nextPageToken: response.nextPageToken || null,
  };
}

export async function createCalendarEvent(userId, eventPayload) {
  const { accessToken, account } = await getAuthorizedAccount(userId);
  const response = await googleJsonRequest(
    `${CALENDAR_BASE_URL}/events`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventPayload),
    }
  );

  await prisma.connectedAccount.update({
    where: { id: account.id },
    data: { lastSyncedAt: new Date() },
  });

  return response;
}

export async function updateCalendarEvent(userId, providerEventId, eventPayload) {
  const { accessToken, account } = await getAuthorizedAccount(userId);
  const response = await googleJsonRequest(
    `${CALENDAR_BASE_URL}/events/${encodeURIComponent(providerEventId)}`,
    accessToken,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventPayload),
    }
  );

  await prisma.connectedAccount.update({
    where: { id: account.id },
    data: { lastSyncedAt: new Date() },
  });

  return response;
}

export async function deleteCalendarEvent(userId, providerEventId) {
  const { accessToken, account } = await getAuthorizedAccount(userId);
  const res = await fetch(
    `${CALENDAR_BASE_URL}/events/${encodeURIComponent(providerEventId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok && res.status !== 404) {
    const data = await res.json().catch(() => ({}));
    const message =
      typeof data.error?.message === 'string'
        ? data.error.message
        : 'Google Calendar delete failed.';
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }

  await prisma.connectedAccount.update({
    where: { id: account.id },
    data: { lastSyncedAt: new Date() },
  });

  return { deleted: true };
}

export async function getContactGoogleActivity(userId, contactId) {
  const member = await prisma.accountMember.findFirst({ where: { userId } });
  if (!member) {
    const error = new Error('No account found for user');
    error.status = 403;
    throw error;
  }
  const contact = await prisma.contact.findFirst({
    where: {
      id: contactId,
      accountId: member.accountId,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!contact) {
    const error = new Error('Contact not found');
    error.status = 404;
    throw error;
  }

  if (!contact.email) {
    return {
      contact: {
        id: contact.id,
        email: null,
        name: `${contact.firstName} ${contact.lastName}`.trim(),
      },
      emails: [],
      events: [],
    };
  }

  const normalizedEmail = normalizeEmail(contact.email);
  const { accessToken, account } = await getAuthorizedAccount(userId);

  const [emails, calendarResponse] = await Promise.all([
    searchGmailThreads(accessToken, {
      limit: 10,
      query: `from:${normalizedEmail} OR to:${normalizedEmail} OR cc:${normalizedEmail} OR bcc:${normalizedEmail}`,
    }),
    googleJsonRequest(
      `${CALENDAR_BASE_URL}/events?${new URLSearchParams({
        singleEvents: 'true',
        orderBy: 'startTime',
        timeMin: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        timeMax: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        maxResults: '100',
      }).toString()}`,
      accessToken
    ),
  ]);

  const events = (calendarResponse.items || [])
    .filter((event) =>
      (event.attendees || []).some(
        (attendee) => normalizeEmail(attendee.email) === normalizedEmail
      )
    )
    .map(mapCalendarEvent)
    .sort((a, b) => {
      const aTime = a.start ? new Date(a.start).getTime() : 0;
      const bTime = b.start ? new Date(b.start).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 10);

  const newestHistoryId = emails.threads.find((thread) => thread.historyId)?.historyId || null;
  if (newestHistoryId && newestHistoryId !== account.gmailHistoryId) {
    await prisma.connectedAccount.update({
      where: { id: account.id },
      data: {
        gmailHistoryId: newestHistoryId,
        lastSyncedAt: new Date(),
      },
    });
  }

  return {
    contact: {
      id: contact.id,
      email: contact.email,
      name: `${contact.firstName} ${contact.lastName}`.trim(),
    },
    emails: emails.threads,
    events,
  };
}

export function getGoogleConnectScopes() {
  return [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/drive.file',
  ];
}

export function getGoogleProviderName() {
  return GOOGLE_PROVIDER;
}
