import assert from 'node:assert/strict';

async function verifyDbContract() {
  const db = await import('db');

  assert.equal(typeof db.PrismaClient, 'function', 'db should export PrismaClient');
  assert.equal(typeof db.prisma, 'object', 'db should export prisma');
  assert.equal(typeof db.generatePropertySlug, 'function', 'db should export generatePropertySlug');
  assert.equal(typeof db.generateUniquePropertySlug, 'function', 'db should export generateUniquePropertySlug');
}

async function verifyEmailContract() {
  const email = await import('email');

  assert.equal(typeof email.sendEmail, 'function', 'email should export sendEmail');
  assert.equal(typeof email.sendPasswordReset, 'function', 'email should export sendPasswordReset');
  assert.equal(typeof email.sendInquiryConfirmation, 'function', 'email should export sendInquiryConfirmation');
  assert.equal(typeof email.sendWelcome, 'function', 'email should export sendWelcome');
}

async function verifySearchContract() {
  const search = await import('search');

  assert.equal(typeof search.default, 'object', 'search should export a default service instance');
  assert.equal(typeof search.ElasticsearchService, 'function', 'search should export ElasticsearchService');
  assert.ok(search.HybridSearchService, 'search should export HybridSearchService');
  assert.ok(search.searchIndexingService, 'search should export searchIndexingService');
}

async function verifyCacheContract() {
  const cache = await import('cache');

  assert.equal(typeof cache.default, 'object', 'cache should export a default cache manager');
  assert.equal(typeof cache.CacheManager, 'function', 'cache should export CacheManager');
}

const contracts = [
  ['db', verifyDbContract],
  ['email', verifyEmailContract],
  ['search', verifySearchContract],
  ['cache', verifyCacheContract],
];

for (const [name, verify] of contracts) {
  await verify();
  console.log(`[smoke:contracts] ${name} contract ok`);
}
