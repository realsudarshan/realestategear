import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { ClassifierExpression, CollectionPredicate } from './types.js';

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80);
const numeric = z.object({
  min: z.number().finite().optional(),
  max: z.number().finite().optional(),
  nulls: z.enum(['exclude', 'include', 'only']),
}).refine((v) => v.min == null || v.max == null || v.min <= v.max, 'min must be <= max');

export const collectionPredicateSchema = z.object({
  areaSlugs: z.array(slug).max(100).optional(),
  tagsAny: z.array(slug).max(100).optional(),
  tagsAll: z.array(slug).max(100).optional(),
  tagsExclude: z.array(slug).max(100).optional(),
  propertyTypes: z.array(z.enum(['SINGLE_FAMILY', 'CONDO', 'TOWNHOUSE', 'MULTI_FAMILY', 'LAND', 'COMMERCIAL'])).optional(),
  price: numeric.optional(), beds: numeric.optional(), baths: numeric.optional(),
  sqft: numeric.optional(), lotSize: numeric.optional(), yearBuilt: numeric.optional(),
}).strict();

const conditionSchema = z.discriminatedUnion('operator', [
  z.object({ field: z.string().min(1), operator: z.literal('equals'), value: z.union([z.string(), z.number(), z.boolean()]) }),
  z.object({ field: z.string().min(1), operator: z.literal('exists') }),
  z.object({ field: z.string().min(1), operator: z.literal('includesAny'), values: z.array(z.union([z.string(), z.number(), z.boolean()])).min(1) }),
]);
export const classifierExpressionSchema = z.lazy(() => z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('fields'), all: z.array(conditionSchema) }),
  z.object({ kind: z.literal('place'), cities: z.array(z.string()).optional(), zipCodes: z.array(z.string()).optional(), subdivisions: z.array(z.string()).optional() }),
  z.object({ kind: z.literal('radius'), latitude: z.number(), longitude: z.number(), miles: z.number().positive() }),
  z.object({ kind: z.literal('polygon'), coordinates: z.array(z.tuple([z.number(), z.number()])).min(3) }),
  z.object({ kind: z.literal('composite'), operator: z.enum(['all', 'any']), definitions: z.array(classifierExpressionSchema).min(1) }),
])) as unknown as z.ZodType<ClassifierExpression>;

export function parseCollectionPredicate(value: unknown): CollectionPredicate {
  return collectionPredicateSchema.parse(value);
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]));
  return value;
}

export function classificationConfigHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

export interface ClassifierProperty {
  latitude?: number | null; longitude?: number | null; city?: string | null;
  zipCode?: string | null; subdivision?: string | null; attributes: Record<string, unknown>;
}

function same(a: unknown, b: unknown) { return String(a).trim().toLowerCase() === String(b).trim().toLowerCase(); }
function fieldValue(input: ClassifierProperty, field: string) { return input.attributes[field]; }
function distanceMiles(a: number, b: number, c: number, d: number) {
  const rad = Math.PI / 180; const x = (d - b) * rad * Math.cos((a + c) * rad / 2); const y = (c - a) * rad;
  return Math.sqrt(x * x + y * y) * 3958.8;
}
function inPolygon(lat: number, lon: number, points: Array<[number, number]>) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i]!; const [xj, yj] = points[j]!;
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function evaluateClassifier(expression: ClassifierExpression, input: ClassifierProperty): { matched: boolean; evidence: unknown } {
  const parsed = classifierExpressionSchema.parse(expression);
  let matched = false;
  if (parsed.kind === 'fields') matched = parsed.all.every((c) => {
    const value = fieldValue(input, c.field);
    if (c.operator === 'exists') return value !== undefined && value !== null && value !== '';
    if (c.operator === 'equals') return same(value, c.value);
    const values = Array.isArray(value) ? value : value == null ? [] : [value];
    return values.some((v) => c.values.some((candidate) => same(v, candidate)));
  });
  if (parsed.kind === 'place') matched = Boolean(
    (parsed.cities?.some((v) => same(input.city, v))) ||
    (parsed.zipCodes?.some((v) => same(input.zipCode, v))) ||
    (parsed.subdivisions?.some((v) => same(input.subdivision, v)))
  );
  if (parsed.kind === 'radius') matched = input.latitude != null && input.longitude != null && distanceMiles(parsed.latitude, parsed.longitude, input.latitude, input.longitude) <= parsed.miles;
  if (parsed.kind === 'polygon') matched = input.latitude != null && input.longitude != null && inPolygon(input.latitude, input.longitude, parsed.coordinates);
  if (parsed.kind === 'composite') {
    const children = parsed.definitions.map((child) => evaluateClassifier(child, input));
    matched = parsed.operator === 'all' ? children.every((v) => v.matched) : children.some((v) => v.matched);
    return { matched, evidence: { kind: parsed.kind, operator: parsed.operator, children } };
  }
  return { matched, evidence: { classifier: parsed, input } };
}
