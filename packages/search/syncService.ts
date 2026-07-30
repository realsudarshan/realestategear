// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SearchParams = any;
import client from './typesenseClient.js';
import logger from './logger.js';

export async function upsertDocument(collection: string, doc: Record<string, unknown>) {
  try {
    await client.collections(collection).documents().upsert(doc);
  } catch (err) {
    logger.error(`Typesense upsert failed [${collection}:${doc.id}]`, err);
    throw err;
  }
}

function isNotFoundError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'httpStatus' in err && err.httpStatus === 404;
}

export async function deleteDocument(collection: string, id: string) {
  try {
    await client.collections(collection).documents(id).delete();
  } catch (err) {
    if (isNotFoundError(err)) return;
    logger.error(`Typesense delete failed [${collection}:${id}]`, err);
    throw err;
  }
}

const QUERY_BY: Record<string, string> = {
  properties: 'address,city,state,mlsId,description',
  contacts: 'fullName,firstName,lastName,email,phone,company',
  transactions: 'address,mlsId,partyNames',
  notes: 'body',
  tasks: 'title,description',
};

export async function searchDocuments(
  collection: string,
  params: {
    q?: string;
    filterBy?: string;
    sortBy?: string;
    page?: number;
    perPage?: number;
    facetBy?: string;
  },
) {
  const searchParams: SearchParams = {
    q: params.q || '*',
    query_by: QUERY_BY[collection] || 'id',
    per_page: params.perPage ?? 20,
    page: params.page ?? 1,
  };
  if (params.filterBy) searchParams.filter_by = params.filterBy;
  if (params.sortBy) searchParams.sort_by = params.sortBy;
  if (params.facetBy) {
    searchParams.facet_by = params.facetBy;
    searchParams.max_facet_values = 0; // stats only, no value enumeration
  }

  return client.collections(collection).documents().search(searchParams);
}

export async function reindexAll(
  collection: string,
  fetchDocs: () => Promise<Record<string, unknown>[]>,
  options: {
    exact?: boolean;
    reconcile?: (id: string) => Promise<unknown>;
  } = {},
) {
  const existingIds = new Set<string>();
  if (options.exact) {
    const exported = await client.collections(collection).documents().export({ include_fields: 'id' });
    for (const [index, line] of exported.split('\n').entries()) {
      if (!line.trim()) continue;
      let document: unknown;
      try {
        document = JSON.parse(line);
      } catch {
        throw new Error(`Typesense reindex export contains invalid JSON on line ${index + 1} [${collection}]`);
      }
      if (
        typeof document !== 'object'
        || document === null
        || !('id' in document)
        || typeof document.id !== 'string'
        || !document.id
      ) {
        throw new Error(`Typesense reindex export is missing a string id on line ${index + 1} [${collection}]`);
      }
      existingIds.add(document.id);
    }
  }

  const docs = await fetchDocs();
  const desiredIds = new Set<string>();
  for (const doc of docs) {
    if (typeof doc.id !== 'string' || !doc.id) {
      throw new Error(`Typesense reindex document is missing a string id [${collection}]`);
    }
    desiredIds.add(doc.id);
  }

  if (docs.length) {
    const importResults = await client
      .collections(collection)
      .documents()
      .import(docs, { action: 'upsert', throwOnFail: false });

    if (importResults.length !== docs.length) {
      throw new Error(
        `Typesense reindex import returned ${importResults.length} results for ${docs.length} documents [${collection}]`,
      );
    }
    const failures = importResults.filter((result) => !result.success);
    if (failures.length) {
      throw new Error(
        `Typesense reindex import failed for ${failures.length}/${docs.length} documents [${collection}]: ${failures.map((failure) => failure.error).join('; ')}`,
      );
    }
  }

  const staleIds = options.exact
    ? [...existingIds].filter((id) => !desiredIds.has(id))
    : [];
  for (const id of staleIds) await deleteDocument(collection, id);

  if (options.reconcile) {
    for (const id of new Set([...existingIds, ...desiredIds])) await options.reconcile(id);
  }

  const counts = {
    desiredCount: desiredIds.size,
    upsertedCount: docs.length,
    deletedCount: staleIds.length,
  };
  logger.info(
    `Typesense reindex complete: ${collection} (${counts.upsertedCount} upserted, ${counts.deletedCount} deleted)`,
  );
  return counts;
}
