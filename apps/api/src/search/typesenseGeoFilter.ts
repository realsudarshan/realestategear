const MAX_VALUES_PER_FIELD = 25;
export function sanitizeFilterValue(value: string): string { return value.replace(/[^a-zA-Z0-9 '\-]/g, ''); }
export function normalizeArray(values: string[] | undefined | null): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>(); const out: string[] = [];
  for (const raw of values) { if (typeof raw !== 'string') continue; const safe = sanitizeFilterValue(raw).trim(); if (!safe || seen.has(safe)) continue; seen.add(safe); out.push(safe); if (out.length >= MAX_VALUES_PER_FIELD) break; }
  return out;
}
export interface GeographicFilters { cities?: string[]; zipCodes?: string[]; subdivisions?: string[] }
export function buildTypesenseGeoFilter(rules: GeographicFilters, opts: { appendStatus?: boolean } = {}): string {
  const parts: string[] = []; const cities = normalizeArray(rules.cities); const zipCodes = normalizeArray(rules.zipCodes); const subdivisions = normalizeArray(rules.subdivisions);
  if (zipCodes.length) parts.push(`zipCode:=[${zipCodes.join(',')}]`); if (cities.length) parts.push(`city:=[${cities.join(',')}]`); if (subdivisions.length) parts.push(`subdivision:=[${subdivisions.join(',')}]`);
  if (!parts.length) return ''; const group = parts.length > 1 ? `(${parts.join(' || ')})` : parts[0]; return (opts.appendStatus ?? true) ? `${group} && status:=Active` : group;
}
