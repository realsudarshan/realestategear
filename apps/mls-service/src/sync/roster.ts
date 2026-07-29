import { prisma } from 'db';
import { stripPrefix } from '../connectors/reso/prefix.js';
import type { ResoMemberRecord, ResoOfficeRecord } from '../connectors/reso/types.js';
import { str, dateOf } from './coerce.js';

/**
 * MLS member/office roster upserts (decision D8, write side). Verification reads
 * MlsAgent.mlsId at onboarding — stored de-prefixed since agents type the
 * un-prefixed id (D17). Keyed on (providerId, externalId) = the immutable Key.
 */

export interface RosterConfig {
  providerId: string;
  prefix?: string;
}

export async function upsertAgent(record: ResoMemberRecord, config: RosterConfig): Promise<boolean> {
  const externalId = str(record.MemberKey);
  if (!externalId) return false;
  const rawMlsId = str(record.MemberMlsId);
  const data = {
    mlsId: rawMlsId ? stripPrefix(rawMlsId, config.prefix) : null,
    firstName: str(record.MemberFirstName) ?? null,
    lastName: str(record.MemberLastName) ?? null,
    name: str(record.MemberFullName) ?? null,
    email: str(record.MemberEmail) ?? null,
    phone: str(record.MemberMobilePhone) ?? null,
    stateLicense: str(record.MemberStateLicense) ?? null,
    status: str(record.MemberStatus) ?? null,
    officeKey: str(record.OfficeKey) ?? null,
    officeMlsId: str(record.OfficeMlsId) ?? null,
    rawData: record as unknown as object,
    modifiedAt: dateOf(record.ModificationTimestamp) ?? null,
  };
  await prisma.mlsAgent.upsert({
    where: { providerId_externalId: { providerId: config.providerId, externalId } },
    create: { providerId: config.providerId, externalId, ...data },
    update: data,
  });
  return true;
}

export async function upsertOffice(record: ResoOfficeRecord, config: RosterConfig): Promise<boolean> {
  const externalId = str(record.OfficeKey);
  if (!externalId) return false;
  const rawMlsId = str(record.OfficeMlsId);
  const data = {
    mlsId: rawMlsId ? stripPrefix(rawMlsId, config.prefix) : null,
    name: str(record.OfficeName) ?? null,
    phone: str(record.OfficePhone) ?? null,
    address: str(record.OfficeAddress1) ?? null,
    city: str(record.OfficeCity) ?? null,
    zipCode: str(record.OfficePostalCode) ?? null,
    status: str(record.OfficeStatus) ?? null,
    rawData: record as unknown as object,
    modifiedAt: dateOf(record.ModificationTimestamp) ?? null,
  };
  await prisma.mlsOffice.upsert({
    where: { providerId_externalId: { providerId: config.providerId, externalId } },
    create: { providerId: config.providerId, externalId, ...data },
    update: data,
  });
  return true;
}
