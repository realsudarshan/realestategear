import { Resend } from 'resend';

type EmailPayload = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
};

// Resend client is lazy-initialized on first send so env vars loaded after this
// module is imported (e.g. via dotenv.config() in apps/api/src/server.ts) are
// still picked up. Reading env at module scope would freeze an undefined key
// because ESM imports are evaluated before any top-level statement.
let cachedClient: Resend | null | undefined;
let cachedApiKey: string | undefined;
function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey !== cachedApiKey) {
    cachedApiKey = apiKey;
    cachedClient = apiKey ? new Resend(apiKey) : null;
  }
  return cachedClient ?? null;
}

function getFromEmail(): string {
  const customFrom = process.env.EMAIL_FROM;
  return customFrom ? customFrom : 'Real Estate Gear <notifications@realestategear.com>';
}

function getReplyToEmail(): string | undefined {
  return process.env.EMAIL_REPLY_TO ?? 'kyle@realestategear.com';
}

function getFrontendUrl(): string {
  return process.env.FRONTEND_URL ?? 'http://localhost:3000';
}

export async function sendEmail({ to, subject, html, text, replyTo }: EmailPayload) {
  const resend = getResend();
  if (!resend) {
    console.warn('[Email] RESEND_API_KEY not set, skipping send:', { to, subject });
    return { ok: false, skipped: true };
  }
  try {
    const { data, error } = await resend.emails.send({
      from: getFromEmail(),
      to: Array.isArray(to) ? to : [to],
      subject,
      html: html || text,
      text: text || (html ? html.replace(/<[^>]*>/g, '') : undefined),
      replyTo: replyTo ?? getReplyToEmail(),
    });
    if (error) throw new Error(error.message);
    return { ok: true, id: data?.id };
  } catch (err) {
    console.error('[Email] Send failed:', err);
    throw err;
  }
}

export function plainTextToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family: sans-serif; line-height: 1.6; color: #111; white-space: pre-wrap;">${escaped}</body></html>`;
}

export function sendPlainTextEmail(payload: EmailPayload & { text: string }) {
  return sendEmail({
    ...payload,
    html: payload.html ?? plainTextToHtml(payload.text),
  });
}

export function getPasswordResetText({ resetUrl, userName }) {
  return `Hi ${userName || 'there'},

We received a request to reset your Real Estate Gear password.

Use this link to set a new password:
${resetUrl}

This link expires in 1 hour. If you did not request this, you can ignore this email.`;
}

export function getInquiryConfirmationText({ propertyAddress, city, state }) {
  return `Thank you for your interest in ${propertyAddress}, ${city}, ${state}.

An agent will contact you shortly to help with your request.`;
}

export function getWelcomeText({ userName }) {
  return `Hi ${userName},

Welcome to Real Estate Gear.

You can now save favorites and submit inquiries on available properties.`;
}

export async function sendPasswordReset(to, token, userName) {
  const resetUrl = `${getFrontendUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  return sendPlainTextEmail({
    to,
    subject: 'Reset your password',
    text: getPasswordResetText({ resetUrl, userName }),
  });
}

export async function sendInquiryConfirmation(to, property) {
  const address = property?.address ?? 'the property';
  const city = property?.city ?? '';
  const state = property?.state ?? '';
  return sendPlainTextEmail({
    to,
    subject: 'We received your inquiry',
    text: getInquiryConfirmationText({
      propertyAddress: address,
      city,
      state,
    }),
  });
}

export async function sendWelcome(to, userName) {
  return sendPlainTextEmail({
    to,
    subject: 'Welcome to Real Estate Gear',
    text: getWelcomeText({ userName }),
  });
}

export * from './platformEmails.js';
