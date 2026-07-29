export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required.');
  }
  return secret;
}

export function getEmailUnsubscribeSecret(): string {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('EMAIL_UNSUBSCRIBE_SECRET or JWT_SECRET environment variable is required.');
  }
  return secret;
}
