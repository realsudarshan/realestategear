import { prisma } from 'db';

type Property = Awaited<ReturnType<typeof prisma.property.findFirstOrThrow>>;
type Listing = Awaited<ReturnType<typeof prisma.listing.findFirstOrThrow>>;
type Contact = Awaited<ReturnType<typeof prisma.contact.findFirstOrThrow>>;
type Transaction = Awaited<ReturnType<typeof prisma.transaction.findFirstOrThrow>>;
type Note = Awaited<ReturnType<typeof prisma.note.findFirstOrThrow>>;
type Task = Awaited<ReturnType<typeof prisma.task.findFirstOrThrow>>;

// Convert ListingStatus enum (ACTIVE, COMING_SOON, ...) to the title-case form
// Typesense filters expect ("Active", "Coming Soon", ...). The segment filter
// in agentSegments.ts uses `status:=Active`, so the indexed value must match.
function normalizeListingStatus(status: string): string {
  return status
    .split('_')
    .map((s) => s.charAt(0) + s.slice(1).toLowerCase())
    .join(' ');
}

export function toPropertyDoc(p: Property, listing?: Listing | null) {
  return {
    id: p.id,
    address: p.address,
    city: p.city,
    state: p.state,
    zipCode: p.zipCode,
    propertyType: p.propertyType ?? undefined,
    bedrooms: p.bedrooms ?? undefined,
    bathrooms: p.bathrooms ?? undefined,
    squareFeet: p.squareFeet ?? undefined,
    subdivision: p.subdivision ?? undefined,
    // Listing-sourced fields. Required by the portal "Available Homes" feed:
    // mlsId (display), mlsBoardId (board-scoped filtering), slug (card links),
    // imageUrl (card photo), listingDate (feed sort, unix seconds for int64).
    mlsId: listing?.mlsId ?? undefined,
    mlsBoardId: listing?.mlsBoardId ?? undefined,
    slug: listing?.slug ?? undefined,
    imageUrl: listing?.imageUrl ?? undefined,
    listingDate: listing?.listDate ? Math.floor(listing.listDate.getTime() / 1000) : undefined,
    status: listing?.status ? normalizeListingStatus(listing.status) : undefined,
    source: listing?.source ?? undefined,
    idxDisplayable: listing?.idxDisplayable ?? undefined,
    price: listing?.listPrice != null ? parseFloat(listing.listPrice.toString()) : undefined,
    location:
      p.latitude != null && p.longitude != null
        ? [p.latitude, p.longitude]
        : undefined,
    createdAt: Math.floor(p.createdAt.getTime() / 1000),
  };
}

export function toContactDoc(c: Contact) {
  const tags = Array.isArray(c.tags) ? (c.tags as string[]) : [];
  return {
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    fullName: `${c.firstName} ${c.lastName}`,
    email: c.email ?? undefined,
    phone: c.phone ?? undefined,
    company: c.company ?? undefined,
    type: c.type,
    stage: c.stage,
    tags: tags.length ? tags : undefined,
    accountId: c.accountId,
    createdAt: Math.floor(c.createdAt.getTime() / 1000),
  };
}

export function toTransactionDoc(
  t: Transaction & { parties?: Array<{ contact?: { firstName?: string; lastName?: string } | null }> },
) {
  const partyNames = (t.parties ?? [])
    .map((p) => (p.contact ? `${p.contact.firstName ?? ''} ${p.contact.lastName ?? ''}`.trim() : ''))
    .filter(Boolean);
  return {
    id: t.id,
    type: t.type,
    stage: t.stage,
    address: t.address ?? undefined,
    mlsId: t.mlsId ?? undefined,
    partyNames: partyNames.length ? partyNames : undefined,
    listPrice: t.listPrice ? parseFloat(t.listPrice.toString()) : undefined,
    accountId: t.accountId,
    assignedAgentId: t.assignedAgentId ?? undefined,
    createdAt: Math.floor(t.createdAt.getTime() / 1000),
  };
}

export function toNoteDoc(n: Note) {
  return {
    id: n.id,
    body: n.body,
    contactId: n.contactId ?? undefined,
    transactionId: n.transactionId ?? undefined,
    eventId: n.eventId ?? undefined,
    authorId: n.authorId,
    createdAt: Math.floor(n.createdAt.getTime() / 1000),
  };
}

export function toTaskDoc(t: Task) {
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? undefined,
    status: t.status,
    priority: t.priority,
    contactId: t.contactId ?? undefined,
    transactionId: t.transactionId ?? undefined,
    assignedToId: t.assignedToId ?? undefined,
    dueDate: t.dueDate ? Math.floor(t.dueDate.getTime() / 1000) : undefined,
    createdAt: Math.floor(t.createdAt.getTime() / 1000),
  };
}
