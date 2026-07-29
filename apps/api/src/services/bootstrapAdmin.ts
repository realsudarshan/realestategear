import bcrypt from 'bcrypt';
import { prisma } from 'db';
import logger from '../utils/logger.js';

const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_ROUNDS = 12;

function isBootstrapEnabled(): boolean {
  const value = process.env.BOOTSTRAP_ADMIN_ENABLED;
  if (value == null) return true;
  return String(value).toLowerCase() === 'true';
}

function normalizeEmail(value: unknown): string {
  if (!value) return '';
  return String(value).trim().toLowerCase();
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'P2002'
  );
}

export async function ensureBootstrapAdmin() {
  try {
    if (!isBootstrapEnabled()) {
      logger.info('Bootstrap admin creation disabled (BOOTSTRAP_ADMIN_ENABLED is not true)');
      return;
    }

    const existingAdmin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true, email: true },
    });

    if (existingAdmin) {
      logger.info('Admin user already exists, skipping bootstrap');
      return;
    }

    const email = normalizeEmail(process.env.BOOTSTRAP_ADMIN_EMAIL);
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || '';

    if (!email || !password) {
      logger.warn(
        'No ADMIN user found and bootstrap credentials are missing. Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD to create the first admin.'
      );
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      logger.warn(
        `Bootstrap admin password is too short. BOOTSTRAP_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`
      );
      return;
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const accountName = process.env.BOOTSTRAP_ADMIN_ACCOUNT_NAME || 'System';

    await prisma.$transaction(async (tx) => {
      const account = await tx.account.create({ data: { name: accountName } });
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName: process.env.BOOTSTRAP_ADMIN_FIRST_NAME || 'Admin',
          lastName: process.env.BOOTSTRAP_ADMIN_LAST_NAME || 'User',
          role: 'ADMIN',
          emailVerified: true,
          accountId: account.id,
          portalId: null,
        },
        select: { id: true, email: true },
      });
      await tx.accountMember.create({
        data: { accountId: account.id, userId: user.id, role: 'OWNER' },
      });
    });

    logger.info(`Bootstrap admin created for ${email}`);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      logger.info('Bootstrap admin creation skipped: user already exists');
      return;
    }

    logger.error('Failed to bootstrap admin user', {
      error: error instanceof Error ? error.message : error,
    });
  }
}
