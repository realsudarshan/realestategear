import { Prisma, prisma } from 'db';

const OPEN_STAGES = ['PROSPECT', 'SIGNED', 'LISTED', 'PENDING'];
const STAGE_PROBABILITY = {
  PROSPECT: 0.1,
  SIGNED: 0.4,
  LISTED: 0.5,
  PENDING: 0.85,
};

function coerceDate(value, fallback) {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed;
}

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function addDays(date, days) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function getScopeWhere(agentId, role) {
  if (role === 'ADMIN') return {};
  return {
    assignedAgentId: agentId,
  };
}

function parseNumber(value) {
  if (value == null) return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function reduceMetrics(rows) {
  return rows.reduce(
    (acc, row) => {
      const salePrice = parseNumber(row.salePrice);
      const commissionRate = parseNumber(row.commissionRate);
      acc.closings += 1;
      acc.volume += salePrice;
      acc.commission += salePrice * (commissionRate / 100);
      if (!salePrice || !commissionRate) acc.missingDataCount += 1;
      return acc;
    },
    { closings: 0, volume: 0, commission: 0, missingDataCount: 0 }
  );
}

function getDeltaPct(current, previous) {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function getBucketStart(date, granularity) {
  const d = startOfDay(date);
  if (granularity === 'week') {
    const day = d.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + offset);
    return d;
  }
  d.setDate(1);
  return d;
}

function bucketKey(date, granularity) {
  const start = getBucketStart(date, granularity);
  return start.toISOString();
}

function withBaseFilters(agentId, role, filters: Record<string, any> = {}) {
  const scope = getScopeWhere(agentId, role);
  const where: Prisma.TransactionWhereInput = { ...scope };
  if (filters.type) where.type = filters.type;
  return where;
}

export async function getReportSummary(agentId, role, filters: Record<string, any> = {}) {
  const now = new Date();
  const to = endOfDay(coerceDate(filters.to, now));
  const from = startOfDay(coerceDate(filters.from, addDays(to, -364)));
  const daySpan = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const prevTo = endOfDay(addDays(from, -1));
  const prevFrom = startOfDay(addDays(prevTo, -(daySpan - 1)));

  const base = withBaseFilters(agentId, role, filters);

  const [currentRows, previousRows] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        ...base,
        stage: 'CLOSED',
        closingDate: { gte: from, lte: to },
      },
      select: { salePrice: true, commissionRate: true },
    }),
    prisma.transaction.findMany({
      where: {
        ...base,
        stage: 'CLOSED',
        closingDate: { gte: prevFrom, lte: prevTo },
      },
      select: { salePrice: true, commissionRate: true },
    }),
  ]);

  const current = reduceMetrics(currentRows);
  const prev = reduceMetrics(previousRows);

  return {
    window: { from: from.toISOString(), to: to.toISOString() },
    closings: current.closings,
    volume: current.volume,
    commission: current.commission,
    missingDataCount: current.missingDataCount,
    prev: {
      closings: prev.closings,
      volume: prev.volume,
      commission: prev.commission,
      missingDataCount: prev.missingDataCount,
    },
    deltaPct: {
      closings: getDeltaPct(current.closings, prev.closings),
      volume: getDeltaPct(current.volume, prev.volume),
      commission: getDeltaPct(current.commission, prev.commission),
    },
  };
}

export async function getReportTrend(agentId, role, filters: Record<string, any> = {}) {
  const granularity = filters.granularity === 'week' ? 'week' : 'month';
  const to = endOfDay(coerceDate(filters.to, new Date()));
  const from = startOfDay(coerceDate(filters.from, addDays(to, -364)));
  const base = withBaseFilters(agentId, role, filters);

  const rows = await prisma.transaction.findMany({
    where: {
      ...base,
      stage: 'CLOSED',
      closingDate: { gte: from, lte: to },
    },
    select: {
      closingDate: true,
      salePrice: true,
      commissionRate: true,
    },
    orderBy: { closingDate: 'asc' },
  });

  const map = new Map();
  for (const row of rows) {
    if (!row.closingDate) continue;
    const key = bucketKey(row.closingDate, granularity);
    const current = map.get(key) ?? { bucket: key, closings: 0, volume: 0, commission: 0 };
    const salePrice = parseNumber(row.salePrice);
    const commissionRate = parseNumber(row.commissionRate);
    current.closings += 1;
    current.volume += salePrice;
    current.commission += salePrice * (commissionRate / 100);
    map.set(key, current);
  }

  return Array.from(map.values()).sort((a, b) => new Date(a.bucket).getTime() - new Date(b.bucket).getTime());
}

export async function getReportForecast(agentId, role, filters: Record<string, any> = {}) {
  const base = withBaseFilters(agentId, role, filters);
  const rows = await prisma.transaction.findMany({
    where: {
      ...base,
      stage: { in: OPEN_STAGES },
    },
    select: {
      stage: true,
      salePrice: true,
      commissionRate: true,
    },
  });

  const byStage = OPEN_STAGES.map((stage) => ({
    stage,
    probability: STAGE_PROBABILITY[stage],
    count: 0,
    projectedClosings: 0,
    projectedVolume: 0,
    projectedCommission: 0,
  }));
  const stageLookup = new Map(byStage.map((row) => [row.stage, row]));

  for (const row of rows) {
    const stageRow = stageLookup.get(row.stage);
    if (!stageRow) continue;
    const salePrice = parseNumber(row.salePrice);
    const commissionRate = parseNumber(row.commissionRate);
    stageRow.count += 1;
    stageRow.projectedClosings += stageRow.probability;
    stageRow.projectedVolume += salePrice * stageRow.probability;
    stageRow.projectedCommission += salePrice * (commissionRate / 100) * stageRow.probability;
  }

  return {
    projectedClosings: byStage.reduce((sum, row) => sum + row.projectedClosings, 0),
    projectedVolume: byStage.reduce((sum, row) => sum + row.projectedVolume, 0),
    projectedCommission: byStage.reduce((sum, row) => sum + row.projectedCommission, 0),
    byStage,
  };
}
