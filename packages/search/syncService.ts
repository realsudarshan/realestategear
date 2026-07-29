// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SearchParams = any;
import client from './typesenseClient.js';
import logger from './logger.js';

export async function upsertDocument(collection: string, doc: Record<string, unknown>) {
  try {
    await client.collections(collection).documents().upsert(doc);
  } catch (err) {
    logger.error(`Typesense upsert failed [${collection}:${doc.id}]`, err);
  }
}

export async function deleteDocument(collection: string, id: string) {
  try {
    await client.collections(collection).documents(id).delete();
  } catch (err) {
    logger.error(`Typesense delete failed [${collection}:${id}]`, err);
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
) {
  const docs = await fetchDocs();
  if (!docs.length) return;

  await client
    .collections(collection)
    .documents()
    .import(docs, { action: 'upsert' });

  logger.info(`Typesense reindex complete: ${collection} (${docs.length} docs)`);
}
