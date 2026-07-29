import { Prisma, prisma } from 'db';
import { generateCMA } from './aiService.js';

export async function getReports(agentId, filters: Record<string, any> = {}) {
  const { page = 1, limit = 20, status } = filters;
  const skip = (page - 1) * limit;
  const take = parseInt(limit);

  const where: Prisma.MarketReportWhereInput = { agentId };
  if (status) where.status = status;

  const [reports, total] = await Promise.all([
    prisma.marketReport.findMany({
      where, skip, take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.marketReport.count({ where }),
  ]);

  return { reports, pagination: { page: parseInt(page), limit: take, total, totalPages: Math.ceil(total / take) } };
}

export async function getReportById(id, agentId) {
  return prisma.marketReport.findFirst({ where: { id, agentId } });
}

export async function createReport(agentId, data) {
  return prisma.marketReport.create({
    data: { ...data, agentId },
  });
}

export async function generateReport(agentId, subjectPropertyId) {
  const subject = await prisma.property.findUnique({
    where: { id: subjectPropertyId },
    include: {
      media: true,
      listings: { orderBy: { listDate: 'desc' }, take: 1 },
    },
  });

  if (!subject) throw new Error('Subject property not found');

  const subjectListing = subject.listings?.[0] ?? null;
  const subjectPrice = subjectListing?.listPrice != null ? parseFloat(subjectListing.listPrice.toString()) : null;

  const candidates = await prisma.property.findMany({
    where: {
      id: { not: subject.id },
      city: subject.city,
      state: subject.state,
      ...(subject.bedrooms && {
        bedrooms: { gte: subject.bedrooms - 1, lte: subject.bedrooms + 1 },
      }),
    },
    include: { listings: { orderBy: { listDate: 'desc' }, take: 1 } },
    take: 20,
    orderBy: { createdAt: 'desc' },
  });

  let comps = candidates;
  if (subjectPrice) {
    const priceFiltered = candidates.filter((c) => {
      const lp = c.listings?.[0]?.listPrice;
      if (lp == null) return true;
      const p = parseFloat(lp.toString());
      return p >= subjectPrice * 0.75 && p <= subjectPrice * 1.25;
    });
    if (priceFiltered.length >= 3) comps = priceFiltered;
  }
  comps = comps.slice(0, 5);

  const subjectData = {
    address: subject.address,
    city: subject.city,
    state: subject.state,
    price: subjectPrice,
    bedrooms: subject.bedrooms,
    bathrooms: subject.bathrooms,
    squareFeet: subject.squareFeet,
    yearBuilt: subject.yearBuilt,
    propertyType: subject.propertyType,
    lotSize: subject.lotSize,
  };

  const compData = comps.map((c) => {
    const listing = c.listings?.[0] ?? null;
    return {
      address: c.address,
      city: c.city,
      price: listing?.listPrice != null ? parseFloat(listing.listPrice.toString()) : null,
      bedrooms: c.bedrooms,
      bathrooms: c.bathrooms,
      squareFeet: c.squareFeet,
      yearBuilt: c.yearBuilt,
      propertyType: c.propertyType,
      status: listing?.status ?? null,
    };
  });

  let aiAnalysis;
  try {
    aiAnalysis = await generateCMA(subjectData, compData);
  } catch (err) {
    aiAnalysis = `AI analysis unavailable: ${err.message}. ${comps.length} comparable properties found in ${subject.city}, ${subject.state}.`;
  }

  const report = await prisma.marketReport.create({
    data: {
      title: `CMA - ${subject.address}`,
      subjectPropertyAddress: `${subject.address}, ${subject.city}, ${subject.state}`,
      subjectPropertyData: subjectData,
      comparables: compData,
      aiAnalysis,
      status: 'DRAFT',
      agentId,
    },
  });

  return report;
}

export async function updateReport(id, agentId, data) {
  const report = await prisma.marketReport.findFirst({ where: { id, agentId } });
  if (!report) return null;
  return prisma.marketReport.update({ where: { id }, data });
}

export async function deleteReport(id, agentId) {
  const report = await prisma.marketReport.findFirst({ where: { id, agentId } });
  if (!report) return false;
  await prisma.marketReport.delete({ where: { id } });
  return true;
}
