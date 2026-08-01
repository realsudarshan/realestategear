import '../scripts/loadEnv.js';
import { prisma } from '../index.js';
import { faker } from '@faker-js/faker';
import bcrypt from 'bcrypt';
import { requireDemoSeedOptIn } from '../scripts/seedGuard.js';

/**
 * Generates an SEO-friendly URL slug from property address info
 * Example: "123 Main St, Charlotte, NC" → "123-main-st-charlotte-nc"
 */
function generatePropertySlug(address, city, state) {
  const cleanAddress = address
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')         // Replace spaces with hyphens
    .replace(/-+/g, '-')          // Replace multiple hyphens with single
    .replace(/^-|-$/g, '');       // Remove leading/trailing hyphens

  const cleanCity = city
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  const stateCode = state.toLowerCase().replace(/[^a-z]/g, '');

  return `${cleanAddress}-${cleanCity}-${stateCode}`;
}

// Track existing slugs to ensure uniqueness
const existingSlugs = new Set();

// Charlotte Metro Area Neighborhoods with realistic coordinate boundaries
const charlotteNeighborhoods = [
  {
    name: "Uptown Charlotte",
    centerLat: 35.2271,
    centerLng: -80.8431,
    radius: 0.015, // ~1 mile radius
    zipCodes: ["28202", "28204"],
    avgPrice: 650000,
    priceRange: [400000, 1200000],
    propertyTypes: ["Condo", "Townhouse"],
    yearBuiltRange: [2000, 2024]
  },
  {
    name: "Dilworth",
    centerLat: 35.2018,
    centerLng: -80.8344,
    radius: 0.02,
    zipCodes: ["28203"],
    avgPrice: 750000,
    priceRange: [500000, 1500000],
    propertyTypes: ["Single Family", "Condo", "Townhouse"],
    yearBuiltRange: [1920, 2023]
  },
  {
    name: "Myers Park",
    centerLat: 35.2134,
    centerLng: -80.8651,
    radius: 0.025,
    zipCodes: ["28207", "28209"],
    avgPrice: 1400000,
    priceRange: [800000, 3000000],
    propertyTypes: ["Single Family"],
    yearBuiltRange: [1920, 2020]
  },
  {
    name: "South End",
    centerLat: 35.2003,
    centerLng: -80.8370,
    radius: 0.018,
    zipCodes: ["28203", "28209"],
    avgPrice: 550000,
    priceRange: [350000, 900000],
    propertyTypes: ["Condo", "Townhouse"],
    yearBuiltRange: [2010, 2024]
  },
  {
    name: "NoDa",
    centerLat: 35.2431,
    centerLng: -80.8112,
    radius: 0.015,
    zipCodes: ["28205", "28206"],
    avgPrice: 475000,
    priceRange: [300000, 750000],
    propertyTypes: ["Single Family", "Townhouse"],
    yearBuiltRange: [1900, 2022]
  },
  {
    name: "Plaza Midwood",
    centerLat: 35.2243,
    centerLng: -80.7915,
    radius: 0.02,
    zipCodes: ["28205", "28206"],
    avgPrice: 525000,
    priceRange: [350000, 850000],
    propertyTypes: ["Single Family", "Townhouse"],
    yearBuiltRange: [1940, 2023]
  },
  {
    name: "Fourth Ward",
    centerLat: 35.2341,
    centerLng: -80.8421,
    radius: 0.012,
    zipCodes: ["28202"],
    avgPrice: 825000,
    priceRange: [600000, 1300000],
    propertyTypes: ["Townhouse", "Condo"],
    yearBuiltRange: [1880, 2020]
  },
  {
    name: "Elizabeth",
    centerLat: 35.2187,
    centerLng: -80.8156,
    radius: 0.018,
    zipCodes: ["28204", "28209"],
    avgPrice: 625000,
    priceRange: [400000, 1000000],
    propertyTypes: ["Single Family", "Townhouse"],
    yearBuiltRange: [1930, 2021]
  },
  {
    name: "SouthPark",
    centerLat: 35.1431,
    centerLng: -80.8298,
    radius: 0.03,
    zipCodes: ["28210", "28211"],
    avgPrice: 675000,
    priceRange: [450000, 1200000],
    propertyTypes: ["Condo", "Single Family", "Townhouse"],
    yearBuiltRange: [1980, 2024]
  },
  {
    name: "Ballantyne",
    centerLat: 35.1121,
    centerLng: -80.8543,
    radius: 0.035,
    zipCodes: ["28277"],
    avgPrice: 625000,
    priceRange: [400000, 1100000],
    propertyTypes: ["Single Family", "Condo", "Townhouse"],
    yearBuiltRange: [1995, 2024]
  },
  {
    name: "Davidson",
    centerLat: 35.4993,
    centerLng: -80.8481,
    radius: 0.025,
    zipCodes: ["28036"],
    avgPrice: 575000,
    priceRange: [350000, 900000],
    propertyTypes: ["Single Family", "Townhouse"],
    yearBuiltRange: [1985, 2023]
  },
  {
    name: "Matthews",
    centerLat: 35.1168,
    centerLng: -80.7234,
    radius: 0.03,
    zipCodes: ["28104", "28105"],
    avgPrice: 485000,
    priceRange: [300000, 750000],
    propertyTypes: ["Single Family", "Townhouse"],
    yearBuiltRange: [1990, 2023]
  },
  {
    name: "Cornelius",
    centerLat: 35.4854,
    centerLng: -80.8540,
    radius: 0.025,
    zipCodes: ["28031"],
    avgPrice: 525000,
    priceRange: [350000, 850000],
    propertyTypes: ["Single Family", "Townhouse"],
    yearBuiltRange: [1985, 2023]
  },
  {
    name: "Huntersville",
    centerLat: 35.4107,
    centerLng: -80.8428,
    radius: 0.03,
    zipCodes: ["28078"],
    avgPrice: 475000,
    priceRange: [325000, 750000],
    propertyTypes: ["Single Family", "Townhouse"],
    yearBuiltRange: [1990, 2024]
  },
  {
    name: "Mint Hill",
    centerLat: 35.1796,
    centerLng: -80.6651,
    radius: 0.025,
    zipCodes: ["28227"],
    avgPrice: 425000,
    priceRange: [275000, 675000],
    propertyTypes: ["Single Family"],
    yearBuiltRange: [1985, 2023]
  }
];

// Charlotte street prefixes and suffixes for realistic addresses
const charlotteStreetPrefixes = [
  "North", "South", "East", "West", "Old", "New", "Lake", "Park", "Forest",
  "Garden", "Ridge", "Valley", "Hill", "Creek", "River", "Stone", "Oak",
  "Pine", "Cedar", "Maple", "Elm", "Cherry", "Magnolia", "Providence"
];

const charlotteStreetNames = [
  "Tryon", "Independence", "Providence", "Pineville", "Matthews", "Monroe",
  "Sharon", "Park", "Queens", "Selwyn", "Kenilworth", "Scott", "Randolph",
  "Trade", "College", "Mint", "Graham", "Brevard", "Central", "Elizabeth",
  "Morehead", "Wilkinson", "Davidson", "Statesville", "Sugar Creek",
  "Albemarle", "Eastway", "Wendover", "Tyvola", "Woodlawn", "Beatties Ford",
  "Freedom", "Wilmore", "Sardis", "Rea", "Ballantyne", "Ardrey Kell"
];

const streetSuffixes = [
  "Street", "Avenue", "Road", "Drive", "Lane", "Way", "Circle", "Court",
  "Place", "Boulevard", "Parkway", "Trail", "Path"
];

// Property status options
const propertyStatuses = ["Active", "Pending", "Sold"];
const statusWeights = [0.7, 0.2, 0.1]; // 70% Active, 20% Pending, 10% Sold

const PROPERTY_TYPE_MAP = {
  "Single Family": "SINGLE_FAMILY",
  "Townhouse": "TOWNHOUSE",
  "Condo": "CONDO",
  "Multi-Family": "MULTI_FAMILY",
};
const LISTING_STATUS_MAP = {
  "Active": "ACTIVE",
  "Pending": "PENDING",
  "Sold": "SOLD",
};

// Lightweight placeholder images (small data URLs or reliable stock images)
const placeholderImages = [
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgdmlld0JveD0iMCAwIDgwMCA2MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI4MDAiIGhlaWdodD0iNjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Im00MDAgMzAwIDEwMC0xMDBoMjAwdjIwMGgtMjAwbC0xMDAtMTAweiIgZmlsbD0iIzlDQTNBRiIvPgo8dGV4dCB4PSI0MDAiIHk9IjMyMCIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IiM2Qjc4OEUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkhvbWUgUGhvdG88L3RleHQ+Cjwvc3ZnPgo=",
  "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=600&fit=crop"
];

// Utility functions
function getRandomFromArray(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getWeightedRandom(options, weights) {
  const random = Math.random();
  let sum = 0;

  for (let i = 0; i < weights.length; i++) {
    sum += weights[i];
    if (random <= sum) {
      return options[i];
    }
  }

  return options[options.length - 1];
}

function generateCoordinateInRadius(centerLat, centerLng, radiusDegrees) {
  const angle = Math.random() * 2 * Math.PI;
  const distance = Math.random() * radiusDegrees;

  const lat = centerLat + distance * Math.cos(angle);
  const lng = centerLng + distance * Math.sin(angle);

  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
}

function generateAddress(neighborhood) {
  const number = faker.number.int({ min: 100, max: 9999 });
  const prefix = Math.random() < 0.3 ? getRandomFromArray(charlotteStreetPrefixes) + " " : "";
  const streetName = getRandomFromArray(charlotteStreetNames);
  const suffix = getRandomFromArray(streetSuffixes);

  // Sometimes add unit numbers for condos/townhouses
  const unitSuffix = ["Condo", "Townhouse"].includes(getRandomFromArray(neighborhood.propertyTypes)) && Math.random() < 0.4
    ? ` #${faker.number.int({ min: 100, max: 999 })}`
    : "";

  return `${number} ${prefix}${streetName} ${suffix}${unitSuffix}`;
}

function generatePropertyPrice(neighborhood, propertyType, yearBuilt) {
  const [minPrice, maxPrice] = neighborhood.priceRange;

  // Adjust price based on property type
  let typeMultiplier = 1;
  if (propertyType === "Condo") typeMultiplier = 0.8;
  if (propertyType === "Townhouse") typeMultiplier = 0.9;
  if (propertyType === "Single Family") typeMultiplier = 1.1;

  // Adjust price based on age (newer = more expensive)
  const currentYear = new Date().getFullYear();
  const age = currentYear - yearBuilt;
  const ageMultiplier = Math.max(0.7, 1 - (age * 0.01)); // 1% per year, min 70%

  const basePrice = faker.number.int({ min: minPrice, max: maxPrice });
  const adjustedPrice = Math.round(basePrice * typeMultiplier * ageMultiplier / 1000) * 1000;

  return Math.max(adjustedPrice, minPrice * 0.8); // Ensure minimum price
}

function generatePropertyDetails(propertyType, price) {
  let bedrooms, bathrooms, squareFeet, lotSize;

  if (propertyType === "Condo") {
    bedrooms = faker.number.int({ min: 1, max: 3 });
    bathrooms = bedrooms === 1 ?
      faker.helpers.arrayElement([1, 1.5]) :
      faker.helpers.arrayElement([2, 2.5, 3]);
    squareFeet = faker.number.int({ min: 700, max: 2200 });
    lotSize = null; // Condos don't have lot size
  } else if (propertyType === "Townhouse") {
    bedrooms = faker.number.int({ min: 2, max: 4 });
    bathrooms = faker.helpers.arrayElement([1.5, 2, 2.5, 3, 3.5]);
    squareFeet = faker.number.int({ min: 1100, max: 2800 });
    lotSize = faker.number.float({ min: 0.05, max: 0.25, multipleOf: 0.01 });
  } else { // Single Family
    bedrooms = faker.number.int({ min: 2, max: 6 });
    bathrooms = faker.helpers.arrayElement([1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]);
    squareFeet = faker.number.int({ min: 1200, max: 5000 });
    lotSize = faker.number.float({ min: 0.15, max: 1.5, multipleOf: 0.01 });
  }

  return { bedrooms, bathrooms, squareFeet, lotSize };
}

function generateDescription(neighborhood, propertyType, bedrooms, bathrooms, squareFeet, yearBuilt) {
  const descriptors = [
    "Beautiful", "Stunning", "Charming", "Modern", "Elegant", "Spacious",
    "Luxury", "Updated", "Well-maintained", "Gorgeous", "Pristine"
  ];

  const features = [
    "open floor plan", "gourmet kitchen", "hardwood floors", "granite counters",
    "stainless appliances", "master suite", "walk-in closet", "private backyard",
    "updated bathrooms", "crown molding", "high ceilings", "natural light",
    "premium finishes", "modern amenities", "spacious rooms"
  ];

  const locationFeatures = [
    `in ${neighborhood.name}`, "near shopping and dining", "close to uptown",
    "walkable neighborhood", "family-friendly area", "quiet street",
    "convenient location", "desirable community"
  ];

  const descriptor = getRandomFromArray(descriptors);
  const propertyFeatures = faker.helpers.arrayElements(features, 3);
  const locationFeature = getRandomFromArray(locationFeatures);

  return `${descriptor} ${propertyType.toLowerCase()} ${locationFeature}. Features ${propertyFeatures.join(", ")}. ${bedrooms} bedrooms, ${bathrooms} bathrooms, ${squareFeet.toLocaleString()} sq ft.`;
}

async function generateProperty(index) {
  const neighborhood = getRandomFromArray(charlotteNeighborhoods);
  const propertyType = getRandomFromArray(neighborhood.propertyTypes);
  const yearBuilt = faker.number.int({
    min: neighborhood.yearBuiltRange[0],
    max: neighborhood.yearBuiltRange[1]
  });

  const coordinates = generateCoordinateInRadius(
    neighborhood.centerLat,
    neighborhood.centerLng,
    neighborhood.radius
  );

  const price = generatePropertyPrice(neighborhood, propertyType, yearBuilt);
  const details = generatePropertyDetails(propertyType, price);
  const status = getWeightedRandom(propertyStatuses, statusWeights);

  const address = generateAddress(neighborhood);
  const city = neighborhood.name.includes("Charlotte") || ["Uptown Charlotte", "Dilworth", "Myers Park", "South End", "NoDa", "Plaza Midwood", "Fourth Ward", "Elizabeth", "SouthPark", "Ballantyne"].includes(neighborhood.name) ? "Charlotte" : neighborhood.name;
  const state = "NC";

  // Generate unique slug
  let slug = generatePropertySlug(address, city, state);
  let counter = 1;
  const originalSlug = slug;
  while (existingSlugs.has(slug)) {
    slug = `${originalSlug}-${counter}`;
    counter++;
  }
  existingSlugs.add(slug);

  const mlsId = `CLT${(index + 1).toString().padStart(4, '0')}`;
  const listingAgent = faker.person.fullName();

  const property = {
    address: address,
    city: city,
    state: state,
    zipCode: getRandomFromArray(neighborhood.zipCodes),
    latitude: coordinates.lat,
    longitude: coordinates.lng,
    propertyType: PROPERTY_TYPE_MAP[propertyType] ?? null,
    bedrooms: details.bedrooms,
    bathrooms: details.bathrooms,
    squareFeet: details.squareFeet,
    lotSize: details.lotSize,
    yearBuilt: yearBuilt,
  };

  const listing = {
    source: 'MLS',
    mlsBoardId: 'CanopyMLS',
    mlsId: mlsId,
    listingKey: `CanopyMLS:${mlsId}`,
    slug: slug,
    listPrice: price,
    status: LISTING_STATUS_MAP[status] ?? 'ACTIVE',
    listDate: status === "Sold" ?
      faker.date.past({ years: 0.5 }) :
      faker.date.recent({ days: 30 }),
    imageUrl: getRandomFromArray(placeholderImages),
    description: generateDescription(neighborhood, propertyType, details.bedrooms, details.bathrooms, details.squareFeet, yearBuilt),
    rawData: JSON.stringify({
      originalSource: "CANOPYMLS",
      mlsNumber: mlsId,
      daysOnMarket: faker.number.int({ min: 1, max: 180 }),
      listingAgent: listingAgent,
      neighborhood: neighborhood.name,
      hoaFees: ["Condo", "Townhouse"].includes(propertyType) ?
        faker.number.int({ min: 200, max: 800 }) : null,
      features: faker.helpers.arrayElements([
        "Granite Counters", "Hardwood Floors", "Updated Kitchen", "Master Suite",
        "Walk-in Closet", "Fireplace", "Deck/Patio", "Garage", "Basement",
        "Pool", "Fenced Yard", "Storage", "Laundry Room", "Home Office"
      ], faker.number.int({ min: 2, max: 6 }))
    }),
    listingAgentName: listingAgent,
    brokerageName: getRandomFromArray([
      'Allen Tate Realtors',
      'Dickens Mitchener & Associates',
      'Premier Sotheby\'s International Realty',
      'Helen Adams Realty',
      'Coldwell Banker Realty',
    ]),
    brokeragePhone: '(704) 555-0100',
    bedrooms: details.bedrooms,
    bathrooms: details.bathrooms,
    squareFeet: details.squareFeet,
  };

  return { property, listing };
}

async function generateMediaForProperty(propertyId) {
  const numPhotos = faker.number.int({ min: 3, max: 8 });
  const mediaItems = [];

  const captions = [
    "Exterior view", "Living room", "Kitchen", "Master bedroom", "Bathroom",
    "Dining room", "Backyard", "Front entrance", "Family room", "Garage",
    "Basement", "Office", "Laundry room", "Walk-in closet", "Patio"
  ];

  for (let i = 0; i < numPhotos; i++) {
    mediaItems.push({
      propertyId: propertyId,
      url: getRandomFromArray(placeholderImages),
      caption: getRandomFromArray(captions),
      order: i + 1
    });
  }

  return mediaItems;
}

async function clearExistingData() {
  console.log('🗑️  Clearing existing data...');
  // Order matters due to foreign key constraints
  await prisma.marketReport.deleteMany();
  await prisma.note.deleteMany();
  await prisma.inquiryDelivery.deleteMany();
  await prisma.inquiry.deleteMany();
  await prisma.userFavorites.deleteMany();
  await prisma.media.deleteMany();
  await prisma.account.deleteMany();
  await prisma.property.deleteMany();
  await prisma.user.deleteMany();
  console.log('✅ Existing data cleared\n');
}

async function createAgentWorkbenchDemo(tx, accountId: string, userEmail: string, userPhone: string | null) {
  await tx.accountMlsAccess.create({
    data: {
      accountId,
      mlsBoardId: 'CanopyMLS',
      membershipId: 'JSMITH-DEMO',
      verifiedAt: new Date(),
    },
  });

  const portal = await tx.portal.create({
    data: {
      accountId,
      name: 'Jane Smith Charlotte Demo',
      slug: 'jane-smith-charlotte-demo',
      agentDisplayName: 'Jane Smith',
      agentPhone: userPhone,
      agentEmail: userEmail,
      brokerageName: 'Real Estate Gear Demo Realty',
      brokeragePhone: '(704) 555-0100',
      isActive: true,
    },
  });

  // Segment and PortalSegment were removed when classification replaced
  // segments; these are now portal-scoped ListingCollections, so the join
  // table is gone too. collectionPredicateSchema is strict and carries no
  // city/zip fields — geography comes from areaSlugs or classification tags,
  // neither of which this seed creates. Every seeded property is Charlotte
  // metro, so only the price floor survives as a real filter.
  await tx.listingCollection.createMany({
    data: [
      {
        portalId: portal.id,
        slug: 'charlotte-active',
        name: 'Charlotte Active Listings',
        predicate: {},
        isPublished: true,
        position: 0,
      },
      {
        portalId: portal.id,
        slug: 'dilworth-south-end',
        name: 'Dilworth and South End',
        predicate: {},
        isPublished: true,
        position: 1,
      },
      {
        portalId: portal.id,
        slug: 'luxury-charlotte',
        name: 'Luxury Charlotte Homes',
        predicate: { price: { min: 1_000_000, nulls: 'exclude' } },
        isPublished: true,
        position: 2,
      },
    ],
  });
}

async function seedData() {

    // Create a few sample users
    console.log('👤 Creating sample users...');
    const sampleUsers = [
      {
        email: "john.doe@example.com",
        password: await bcrypt.hash("password123", 12),
        firstName: "John",
        lastName: "Doe",
        phoneNumber: "+1-555-0123",
        role: "USER",
        emailVerified: true,
        avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face"
      },
      {
        email: "jane.agent@realestategear.com",
        password: await bcrypt.hash("agent123", 12),
        firstName: "Jane",
        lastName: "Smith",
        phoneNumber: "+1-555-0456",
        role: "AGENT",
        emailVerified: true,
        avatarUrl: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face"
      },
      {
        email: "admin@realestategear.com",
        password: await bcrypt.hash("admin123", 12),
        firstName: "Admin",
        lastName: "User",
        phoneNumber: "+1-555-0999",
        role: "ADMIN",
        emailVerified: true,
        avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face"
      }
    ];

    for (const userData of sampleUsers) {
      await prisma.$transaction(async (tx) => {
        const account = await tx.account.create({
          data: { name: `${userData.firstName} ${userData.lastName}` },
        });
        const created = await tx.user.create({
          data: { ...userData, accountId: account.id },
        });
        await tx.accountMember.create({
          data: { accountId: account.id, userId: created.id, role: 'OWNER' },
        });
        if (userData.role === 'AGENT') {
          await createAgentWorkbenchDemo(tx, account.id, userData.email, userData.phoneNumber);
        }
      });
    }
    console.log(`✅ Created ${sampleUsers.length} users\n`);

    // Generate properties in batches for better performance
    console.log('🏠 Generating 1000 properties...');
    const batchSize = 100;
    const totalProperties = 1000;

    for (let batch = 0; batch < Math.ceil(totalProperties / batchSize); batch++) {
      const batchStart = batch * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, totalProperties);

      console.log(`📊 Processing batch ${batch + 1}/${Math.ceil(totalProperties / batchSize)} (properties ${batchStart + 1}-${batchEnd})...`);

      for (let i = batchStart; i < batchEnd; i++) {
        const { property, listing } = await generateProperty(i);
        const created = await prisma.property.create({ data: property });
        await prisma.listing.create({ data: { ...listing, propertyId: created.id } });
      }
    }

    console.log(`✅ Created ${totalProperties} properties\n`);

    // Generate media for properties (sample for first 100 properties to keep seed time reasonable)
    console.log('🖼️  Generating media for sample properties...');
    const propertiesWithMedia = await prisma.property.findMany({
      take: 100,
      orderBy: { createdAt: 'asc' }
    });

    const allMediaItems = [];
    for (const property of propertiesWithMedia) {
      const mediaItems = await generateMediaForProperty(property.id);
      allMediaItems.push(...mediaItems);
    }

    // Insert media in batches
    const mediaBatchSize = 500;
    for (let i = 0; i < allMediaItems.length; i += mediaBatchSize) {
      const batch = allMediaItems.slice(i, i + mediaBatchSize);
      await prisma.media.createMany({ data: batch });
    }

    console.log(`✅ Created ${allMediaItems.length} media items\n`);

    // Generate some sample favorites and inquiries
    console.log('❤️  Generating sample favorites and inquiries...');
    const users = await prisma.user.findMany();
    const sampleListings = await prisma.listing.findMany({ take: 50 });

    // Create random favorites
    const favorites = [];
    for (const user of users) {
      const userFavorites = faker.helpers.arrayElements(sampleListings, faker.number.int({ min: 2, max: 8 }));
      for (const listing of userFavorites) {
        favorites.push({
          userId: user.id,
          listingId: listing.id
        });
      }
    }

    await prisma.userFavorites.createMany({ data: favorites });
    console.log(`✅ Created ${favorites.length} favorites\n`);

    console.log('🎉 Seeding completed successfully!\n');
    console.log('📊 SUMMARY:');
    console.log(`   • ${totalProperties} properties across ${charlotteNeighborhoods.length} Charlotte neighborhoods`);
    console.log(`   • ${allMediaItems.length} media items for sample properties`);
    console.log(`   • ${sampleUsers.length} sample users (USER, AGENT, ADMIN roles)`);
    console.log(`   • ${favorites.length} sample favorites\n`);

    console.log('🏘️  NEIGHBORHOODS COVERED:');
    charlotteNeighborhoods.forEach(n => {
      console.log(`   • ${n.name} (${n.zipCodes.join(', ')})`);
    });

    console.log('\n🔑 TEST ACCOUNTS:');
    console.log('   • john.doe@example.com (password: password123) - USER');
    console.log('   • jane.agent@realestategear.com (password: agent123) - AGENT');
    console.log('   • admin@realestategear.com (password: admin123) - ADMIN');

    console.log('\n💰 PRICE RANGES:');
    console.log('   • $275K - $3M across all neighborhoods');
    console.log('   • Realistic pricing based on Charlotte market data');
    console.log('   • Property type and age adjustments applied');

    console.log('\n📍 LOCATION DATA:');
    console.log('   • All properties have realistic Charlotte coordinates');
    console.log('   • Coordinates distributed within neighborhood boundaries');
    console.log('   • Ready for map-based search functionality');
}

async function main() {
  requireDemoSeedOptIn();
  console.log('🏠 Starting comprehensive Charlotte property seeding (1000 properties)...');
  console.log('⏱️  This may take a few minutes...\n');

  try {
    // Check for force flag
    const forceFlag = process.argv.includes('--force') || process.argv.includes('-f');

    if (!forceFlag) {
      // Check if database already has data
      const existingProperties = await prisma.property.count();
      const existingUsers = await prisma.user.count();

      console.log(`📊 Current database state:`);
      console.log(`   • Properties: ${existingProperties}`);
      console.log(`   • Users: ${existingUsers}\n`);

      // Skip seeding if data already exists
      if (existingProperties > 0 || existingUsers > 0) {
        console.log('ℹ️  Database already contains data. Skipping seeding.');
        console.log('   To reset and re-seed, use: npm run seed:demo:reset:1000\n');
        console.log('✅ Seeding completed (skipped - data exists)');
        return;
      }

      console.log('🌱 Database is empty. Starting fresh seeding...\n');
    } else {
      console.log('🔄 Force flag detected. Clearing existing data and re-seeding...\n');
      await clearExistingData();
    }

    // Run the actual seeding
    await seedData();

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
