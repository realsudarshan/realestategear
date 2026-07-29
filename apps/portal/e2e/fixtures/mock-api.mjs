import { createServer } from "node:http";

const property = {
  id: "property-101",
  address: "101 Fairway Drive",
  city: "Charlotte",
  state: "NC",
  zipCode: "28210",
  subdivision: "Test Club",
  price: 625000,
  bedrooms: 3,
  bathrooms: 2,
  squareFeet: 2100,
  imageUrl: null,
  slug: "101-fairway-drive",
  status: "ACTIVE",
  listingId: "listing-101",
  propertyType: "SINGLE_FAMILY",
  lotSize: 0.3,
  yearBuilt: 2018,
  latitude: null,
  longitude: null,
  description: "A test home beside the fairway.",
  mlsId: "TEST101",
  mlsBoardId: "test-board",
  mlsBoardName: "Test MLS",
  listingDate: "2026-01-01",
  lastMlsUpdate: "2026-01-01",
  listingAgentName: "Test Agent",
  brokerageName: "Example Realty",
  brokeragePhone: null,
  media: [],
};

const readiness = {
  listingMode: "mock",
  publicListingDisplay: "mock",
  canShowSearch: true,
  canShowListings: true,
  configSource: "code",
  gates: [],
  blockers: [],
  warnings: [],
};

function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1:3011");

  if (url.pathname === "/health") return json(response, 200, { ok: true });
  if (request.method === "GET" && url.pathname === "/api/portals/slug/example-realty/listings") {
    return json(response, 200, {
      properties: [property],
      pagination: { page: 1, limit: 12, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      readiness,
    });
  }
  if (
    request.method === "GET"
    && url.pathname === "/api/portals/slug/example-realty/properties/101-fairway-drive"
  ) {
    return json(response, 200, property);
  }
  if (request.method === "POST" && url.pathname === "/api/portals/example-realty/inquiries") {
    return json(response, 503, { error: "Test inquiry service unavailable" });
  }

  return json(response, 404, { error: "Not found" });
});

server.listen(3011, "127.0.0.1");

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
