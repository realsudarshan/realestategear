import 'dotenv/config';
import { prisma } from '../index.js';
import bcrypt from 'bcrypt';
import { requireDemoSeedOptIn } from '../scripts/seedGuard.js';

/**
 * Generates an SEO-friendly URL slug from property address info
 * Example: "123 Main St, New York, NY" → "123-main-st-new-york-ny"
 */
function generatePropertySlug(property) {
  const { address, city, state } = property;

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

function mapPropertyType(type: string): string | null {
  const map: Record<string, string> = {
    'Single Family': 'SINGLE_FAMILY',
    'Condo': 'CONDO',
    'Townhouse': 'TOWNHOUSE',
    'Multi Family': 'MULTI_FAMILY',
    'Land': 'LAND',
    'Commercial': 'COMMERCIAL',
  };
  return map[type] ?? null;
}

function mapListingStatus(status: string): string {
  const map: Record<string, string> = {
    'Active': 'ACTIVE',
    'Pending': 'PENDING',
    'Sold': 'SOLD',
    'Withdrawn': 'WITHDRAWN',
    'Expired': 'EXPIRED',
    'Coming Soon': 'COMING_SOON',
  };
  return map[status] ?? 'ACTIVE';
}

// Charlotte Metro Area Properties (20 properties across different neighborhoods)
const charlotteProperties = [
  {
    mlsId: "CLT001",
    address: "123 South Tryon Street #2304",
    city: "Charlotte",
    state: "NC",
    zipCode: "28202",
    latitude: 35.2271,
    longitude: -80.8431,
    price: 750000,
    bedrooms: 2,
    bathrooms: 2.5,
    squareFeet: 1400,
    lotSize: null,
    yearBuilt: 2019,
    propertyType: "Condo",
    status: "Active",
    listingDate: new Date("2024-06-15"),
    imageUrl: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800",
    description: "Luxury high-rise condo in Uptown Charlotte with stunning city views. Walking distance to banks, restaurants, and nightlife. Premium finishes with rooftop amenities.",
    listingAgentName: "Sarah Mitchell",
    listingAgentEmail: "sarah.mitchell@allentate.com",
    listingAgentPhone: "(704) 555-0142",
    brokerageName: "Allen Tate Realtors",
    brokeragePhone: "(704) 556-0100",
    mlsBoardName: "Canopy MLS",
    rawData: {
      originalSource: "CANOPYMLS",
      mlsNumber: "CLT001",
      daysOnMarket: 8,
      hoaFees: 650,
      amenities: ["Concierge", "Rooftop Pool", "Fitness Center", "Valet Parking"]
    }
  },
  {
    mlsId: "CLT002",
    address: "456 Kenilworth Avenue",
    city: "Charlotte",
    state: "NC",
    zipCode: "28203",
    latitude: 35.2018,
    longitude: -80.8344,
    price: 1200000,
    bedrooms: 4,
    bathrooms: 3.5,
    squareFeet: 2800,
    lotSize: 0.33,
    yearBuilt: 1925,
    propertyType: "Single Family",
    status: "Active",
    listingDate: new Date("2024-06-10"),
    imageUrl: "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800",
    description: "Historic Dilworth home completely renovated with modern luxury. Original hardwood floors, chef's kitchen, and private backyard oasis. Walk to Freedom Park and trendy restaurants.",
    listingAgentName: "Marcus Johnson",
    listingAgentEmail: "marcus.johnson@coldwellbanker.com",
    listingAgentPhone: "(704) 555-0218",
    brokerageName: "Coldwell Banker Realty",
    brokeragePhone: "(704) 543-9292",
    mlsBoardName: "Canopy MLS",
    rawData: {
      originalSource: "CANOPYMLS",
      mlsNumber: "CLT002",
      daysOnMarket: 12,
      features: ["Historic District", "Renovated Kitchen", "Hardwood Floors", "Private Garden"]
    }
  },
  {
    mlsId: "CLT003",
    address: "789 East Boulevard #15C",
    city: "Charlotte",
    state: "NC",
    zipCode: "28203",
    latitude: 35.1951,
    longitude: -80.8282,
    price: 625000,
    bedrooms: 2,
    bathrooms: 2,
    squareFeet: 1150,
    lotSize: null,
    yearBuilt: 2021,
    propertyType: "Condo",
    status: "Active",
    listingDate: new Date("2024-06-18"),
    imageUrl: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",
    description: "Brand new condo in trendy Dilworth. Floor-to-ceiling windows, quartz countertops, and premium finishes. Walking distance to South End light rail and local cafes.",
    listingAgentName: "Lisa Chen",
    listingAgentEmail: "lisa.chen@corcoranHM.com",
    listingAgentPhone: "(704) 555-0374",
    brokerageName: "Corcoran HM Properties",
    brokeragePhone: "(704) 367-7637",
    mlsBoardName: "Canopy MLS",
    rawData: {
      originalSource: "CANOPYMLS",
      mlsNumber: "CLT003",
      daysOnMarket: 4,
      hoaFees: 420,
      amenities: ["Fitness Center", "Rooftop Deck", "Storage Unit"]
    }
  },
  {
    mlsId: "CLT004",
    address: "1234 Queens Road West",
    city: "Charlotte",
    state: "NC",
    zipCode: "28207",
    latitude: 35.2134,
    longitude: -80.8651,
    price: 2100000,
    bedrooms: 5,
    bathrooms: 4.5,
    squareFeet: 4200,
    lotSize: 0.75,
    yearBuilt: 1935,
    propertyType: "Single Family",
    status: "Active",
    listingDate: new Date("2024-06-01"),
    imageUrl: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800",
    description: "Stately Myers Park estate with original architectural details and modern updates. Grand foyer, formal dining, and expansive manicured grounds. Premier Charlotte address.",
    listingAgentName: "David Park",
    listingAgentEmail: "david.park@sothebys.com",
    listingAgentPhone: "(704) 555-0491",
    brokerageName: "Premier Sotheby's International Realty",
    brokeragePhone: "(704) 248-0490",
    mlsBoardName: "Canopy MLS",
    rawData: {
      originalSource: "CANOPYMLS",
      mlsNumber: "CLT004",
      daysOnMarket: 20,
      features: ["Historic Estate", "Formal Gardens", "3-Car Garage", "Original Details"]
    }
  },
  {
    mlsId: "CLT005",
    address: "2345 South Boulevard #801",
    city: "Charlotte",
    state: "NC",
    zipCode: "28203",
    latitude: 35.2003,
    longitude: -80.8370,
    price: 450000,
    bedrooms: 1,
    bathrooms: 1.5,
    squareFeet: 950,
    lotSize: null,
    yearBuilt: 2020,
    propertyType: "Condo",
    status: "Active",
    listingDate: new Date("2024-06-20"),
    imageUrl: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800",
    description: "Modern South End loft with exposed concrete and floor-to-ceiling windows. Prime location near light rail, breweries, and shopping. Perfect for urban living.",
    listingAgentName: "Jennifer Torres",
    listingAgentEmail: "jennifer.torres@dickens-mitchener.com",
    listingAgentPhone: "(704) 555-0563",
    brokerageName: "Dickens Mitchener & Associates",
    brokeragePhone: "(704) 342-1000",
    mlsBoardName: "Canopy MLS",
    rawData: {
      originalSource: "CANOPYMLS",
      mlsNumber: "CLT005",
      daysOnMarket: 2,
      hoaFees: 375,
      amenities: ["Rooftop Terrace", "Gym", "Bike Storage"]
    }
  },
  {
    mlsId: "CLT006",
    address: "567 North Davidson Street",
    city: "Charlotte",
    state: "NC",
    zipCode: "28202",
    latitude: 35.2431,
    longitude: -80.8112,
    price: 525000,
    bedrooms: 3,
    bathrooms: 2,
    squareFeet: 1650,
    lotSize: 0.18,
    yearBuilt: 1920,
    propertyType: "Single Family",
    status: "Active",
    listingDate: new Date("2024-06-12"),
    imageUrl: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800",
    description: "Charming NoDa Craftsman bungalow with original character and modern updates. Walk to art galleries, live music venues, and craft breweries. Vibrant artistic community.",
    listingAgentName: "Robert Kim",
    listingAgentEmail: "robert.kim@allentate.com",
    listingAgentPhone: "(704) 555-0617",
    brokerageName: "Allen Tate Realtors",
    brokeragePhone: "(704) 556-0100",
    mlsBoardName: "Canopy MLS",
    rawData: {
      originalSource: "CANOPYMLS",
      mlsNumber: "CLT006",
      daysOnMarket: 10,
      features: ["Craftsman Style", "Original Hardwood", "Updated Kitchen", "Art District"]
    }
  },
  {
    mlsId: "CLT007",
    address: "890 Central Avenue",
    city: "Charlotte",
    state: "NC",
    zipCode: "28204",
    latitude: 35.2243,
    longitude: -80.7915,
    price: 485000,
    bedrooms: 3,
    bathrooms: 2.5,
    squareFeet: 1550,
    lotSize: 0.15,
    yearBuilt: 1950,
    propertyType: "Single Family",
    status: "Active",
    listingDate: new Date("2024-06-08"),
    imageUrl: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800",
    description: "Mid-century modern home in eclectic Plaza Midwood. Recently renovated with clean lines, open concept, and private backyard. Close to trendy restaurants and shops.",
    listingAgentName: "Michelle Davis",
    listingAgentEmail: "michelle.davis@coldwellbanker.com",
    listingAgentPhone: "(704) 555-0729",
    brokerageName: "Coldwell Banker Realty",
    brokeragePhone: "(704) 543-9292",
    mlsBoardName: "Canopy MLS",
    rawData: {
      originalSource: "CANOPYMLS",
      mlsNumber: "CLT007",
      daysOnMarket: 14,
      features: ["Mid-Century Modern", "Open Concept", "Renovated", "Plaza Midwood"]
    }
  },
  {
    mlsId: "CLT008",
    address: "432 North Poplar Street",
    city: "Charlotte",
    state: "NC",
    zipCode: "28202",
    latitude: 35.2341,
    longitude: -80.8421,
    price: 850000,
    bedrooms: 3,
    bathrooms: 3.5,
    squareFeet: 2200,
    lotSize: 0.12,
    yearBuilt: 1890,
    propertyType: "Townhouse",
    status: "Active",
    listingDate: new Date("2024-06-16"),
    imageUrl: "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800",
    description: "Historic Fourth Ward townhouse with Victorian architecture and modern luxury. Completely restored with high-end finishes. Walk to uptown Charlotte and cultural district.",
    listingAgentName: "Andrew Wilson",
    listingAgentEmail: "andrew.wilson@ivester-jackson.com",
    listingAgentPhone: "(704) 555-0834",
    brokerageName: "Ivester Jackson Christie's International",
    brokeragePhone: "(704) 525-9898",
    mlsBoardName: "Canopy MLS",
    rawData: {
      originalSource: "CANOPYMLS",
      mlsNumber: "CLT008",
      daysOnMarket: 6,
      features: ["Historic Restoration", "Victorian Architecture", "Luxury Finishes", "Fourth Ward"]
    }
  },
  {
    mlsId: "CLT009",
    address: "1567 Elizabeth Avenue",
    city: "Charlotte",
    state: "NC",
    zipCode: "28204",
    latitude: 35.2187,
    longitude: -80.8156,
    price: 675000,
    bedrooms: 4,
    bathrooms: 3,
    squareFeet: 2100,
    lotSize: 0.22,
    yearBuilt: 1940,
    propertyType: "Single Family",
    status: "Active",
    listingDate: new Date("2024-06-05"),
    imageUrl: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800",
    description: "Beautiful colonial revival in trendy Elizabeth neighborhood. Updated kitchen, refinished hardwood floors, and mature landscaping. Minutes from uptown Charlotte.",
    listingAgentName: "Patricia Brown",
    listingAgentEmail: "patricia.brown@allentate.com",
    listingAgentPhone: "(704) 555-0951",
    brokerageName: "Allen Tate Realtors",
    brokeragePhone: "(704) 556-0100",
    mlsBoardName: "Canopy MLS",
    rawData: {
      originalSource: "CANOPYMLS",
      mlsNumber: "CLT009",
      daysOnMarket: 17,
      features: ["Colonial Revival", "Updated Kitchen", "Mature Trees", "Elizabeth Neighborhood"]
    }
  },
  {
    mlsId: "CLT010",
    address: "4325 Cameron Valley Parkway #1204",
    city: "Charlotte",
    state: "NC",
    zipCode: "28211",
    latitude: 35.1431,
    longitude: -80.8298,
    price: 580000,
    bedrooms: 2,
    bathrooms: 2.5,
    squareFeet: 1320,
    lotSize: null,
    yearBuilt: 2018,
    propertyType: "Condo",
    status: "Active",
    listingDate: new Date("2024-06-22"),
    imageUrl: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",
    description: "Modern SouthPark high-rise with luxury amenities and shopping at your doorstep. Premium finishes, city views, and resort-style living. Close to SouthPark Mall.",
    listingAgentName: "Steven Lee",
    listingAgentEmail: "steven.lee@corcoranHM.com",
    listingAgentPhone: "(704) 555-1073",
    brokerageName: "Corcoran HM Properties",
    brokeragePhone: "(704) 367-7637",
    mlsBoardName: "Canopy MLS",
    rawData: {
      originalSource: "CANOPYMLS",
      mlsNumber: "CLT010",
      daysOnMarket: 1,
      hoaFees: 520,
      amenities: ["Resort Pool", "Tennis Court", "Concierge", "Shopping Access"]
    }
  },
  {
    mlsId: "CLT011",
    address: "8934 Rea Road",
    city: "Charlotte",
    state: "NC",
    zipCode: "28277",
    latitude: 35.1121,
    longitude: -80.8543,
    price: 725000,
    bedrooms: 4,
    bathrooms: 3.5,
    squareFeet: 2650,
    lotSize: 0.45,
    yearBuilt: 2015,
    propertyType: "Single Family",
    status: "Active",
    listingDate: new Date("2024-06-14"),
    imageUrl: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800",
    description: "Contemporary Ballantyne home with open floor plan and gourmet kitchen. Master suite with walk-in closet, finished basement, and 3-car garage. Top-rated schools nearby.",
    listingAgentName: "Maria Gonzalez",
    listingAgentEmail: "maria.gonzalez@dickens-mitchener.com",
    listingAgentPhone: "(704) 555-1186",
    brokerageName: "Dickens Mitchener & Associates",
    brokeragePhone: "(704) 342-1000",
    mlsBoardName: "Canopy MLS",
    rawData: {
      originalSource: "CANOPYMLS",
      mlsNumber: "CLT011",
      daysOnMarket: 9,
      features: ["Open Floor Plan", "Gourmet Kitchen", "Finished Basement", "3-Car Garage"]
    }
  },
  {
    mlsId: "CLT012",
    address: "234 Main Street",
    city: "Davidson",
    state: "NC",
    zipCode: "28036",
    latitude: 35.4993,
    longitude: -80.8481,
    price: 650000,
    bedrooms: 4,
    bathrooms: 2.5,
    squareFeet: 2350,
    lotSize: 0.28,
    yearBuilt: 2010,
    propertyType: "Single Family",
    status: "Active",
    listingDate: new Date("2024-06-11"),
    imageUrl: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800",
    description: "Family-friendly home in charming Davidson. Walking distance to Davidson College and Lake Norman. Open concept with large backyard, perfect for entertaining.",
    listingAgentName: "Thomas Anderson",
    listingAgentEmail: "thomas.anderson@allentate.com",
    listingAgentPhone: "(704) 555-1294",
    brokerageName: "Allen Tate Realtors",
    brokeragePhone: "(704) 556-0100",
    mlsBoardName: "Canopy MLS",
    rawData: {
      originalSource: "CANOPYMLS",
      mlsNumber: "CLT012",
      daysOnMarket: 11,
      features: ["Lake Norman Access", "Davidson College Area", "Large Backyard", "Family Neighborhood"]
    }
  },
  {
    mlsId: "CLT013",
    address: "5678 Matthews Township Parkway",
    city: "Matthews",
    state: "NC",
    zipCode: "28105",
    latitude: 35.1168,
    longitude: -80.7234,
    price: 550000,
    bedrooms: 3,
    bathrooms: 2.5,
    squareFeet: 1950,
    lotSize: 0.35,
    yearBuilt: 2008,
    propertyType: "Single Family",
    status: "Active",
    listingDate: new Date("2024-06-09"),
    imageUrl: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800",
    description: "Well-maintained home in desirable Matthews community. Updated throughout with granite counters, stainless appliances, and hardwood floors. Close to shopping and dining.",
    listingAgentName: "Rachel White",
    listingAgentEmail: "rachel.white@coldwellbanker.com",
    listingAgentPhone: "(704) 555-1307",
    brokerageName: "Coldwell Banker Realty",
    brokeragePhone: "(704) 543-9292",
    mlsBoardName: "Canopy MLS",
    rawData: {
      originalSource: "CANOPYMLS",
      mlsNumber: "CLT013",
      daysOnMarket: 13,
      features: ["Updated Throughout", "Granite Counters", "Hardwood Floors", "Matthews Location"]
    }
  },
  {
    mlsId: "CLT014",
    address: "111 West Trade Street #3205",
    city: "Charlotte",
    state: "NC",
    zipCode: "28202",
    latitude: 35.2276,
    longitude: -80.8414,
    price: 950000,
    bedrooms: 3,
    bathrooms: 3,
    squareFeet: 1850,
    lotSize: null,
    yearBuilt: 2022,
    propertyType: "Condo",
    status: "Active",
    listingDate: new Date("2024-06-25"),
    imageUrl: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800",
    description: "Brand new luxury condo in iconic uptown tower. Floor-to-ceiling windows with panoramic city views, premium finishes, and white-glove building services.",
    listingAgentName: "Kenneth Thompson",
    listingAgentEmail: "kenneth.thompson@sothebys.com",
    listingAgentPhone: "(704) 555-1421",
    brokerageName: "Premier Sotheby's International Realty",
    brokeragePhone: "(704) 248-0490",
    mlsBoardName: "Canopy MLS",
    rawData: {
      originalSource: "CANOPYMLS",
      mlsNumber: "CLT014",
      daysOnMarket: 0,
      hoaFees: 850,
      amenities: ["White Glove Service", "Sky Lounge", "Wine Storage", "Panoramic Views"]
    }
  },
  {
    mlsId: "CLT015",
    address: "3456 Providence Road #422",
    city: "Charlotte",
    state: "NC",
    zipCode: "28211",
    latitude: 35.1678,
    longitude: -80.8234,
    price: 425000,
    bedrooms: 2,
    bathrooms: 2,
    squareFeet: 1100,
    lotSize: null,
    yearBuilt: 2019,
    propertyType: "Condo",
    status: "Active",
    listingDate: new Date("2024-06-19"),
    imageUrl: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800",
    description: "Modern SouthPark area condo with contemporary finishes and great natural light. In-unit laundry, private balcony, and access to community amenities.",
    listingAgentName: "Nicole Martinez",
    listingAgentEmail: "nicole.martinez@allentate.com",
    listingAgentPhone: "(704) 555-1538",
    brokerageName: "Allen Tate Realtors",
    brokeragePhone: "(704) 556-0100",
    mlsBoardName: "Canopy MLS",
    rawData: {
      originalSource: "CANOPYMLS",
      mlsNumber: "CLT015",
      daysOnMarket: 3,
      hoaFees: 295,
      amenities: ["Community Pool", "Fitness Center", "Private Balcony"]
    }
  },
  {
    mlsId: "CLT016",
    address: "2234 Coltsgate Road",
    city: "Charlotte",
    state: "NC",
    zipCode: "28211",
    latitude: 35.1567,
    longitude: -80.8398,
    price: 1650000,
    bedrooms: 5,
    bathrooms: 4.5,
    squareFeet: 3850,
    lotSize: 0.68,
    yearBuilt: 1988,
    propertyType: "Single Family",
    status: "Active",
    listingDate: new Date("2024-06-07"),
    imageUrl: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800",
    description: "Executive home in prestigious SouthPark area. Updated kitchen with marble counters, master suite with sitting area, and resort-style backyard with pool.",
    listingAgentName: "Gregory Adams",
    listingAgentEmail: "gregory.adams@ivester-jackson.com",
    listingAgentPhone: "(704) 555-1642",
    brokerageName: "Ivester Jackson Christie's International",
    brokeragePhone: "(704) 525-9898",
    mlsBoardName: "Canopy MLS",
    rawData: {
      originalSource: "CANOPYMLS",
      mlsNumber: "CLT016",
      daysOnMarket: 15,
      features: ["Executive Home", "Marble Kitchen", "Resort Backyard", "Pool"]
    }
  },
  {
    mlsId: "CLT017",
    address: "789 Camden Road #1102",
    city: "Charlotte",
    state: "NC",
    zipCode: "28202",
    latitude: 35.2198,
    longitude: -80.8387,
    price: 695000,
    bedrooms: 2,
    bathrooms: 2.5,
    squareFeet: 1450,
    lotSize: null,
    yearBuilt: 2021,
    propertyType: "Condo",
    status: "Pending",
    listingDate: new Date("2024-05-28"),
    imageUrl: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",
    description: "Ultra-modern condo near uptown with sleek finishes and smart home technology. Private terrace, premium appliances, and building amenities include rooftop pool.",
    listingAgentName: "Stephanie Clark",
    listingAgentEmail: "stephanie.clark@corcoranHM.com",
    listingAgentPhone: "(704) 555-1759",
    brokerageName: "Corcoran HM Properties",
    brokeragePhone: "(704) 367-7637",
    mlsBoardName: "Canopy MLS",
    rawData: {
      originalSource: "CANOPYMLS",
      mlsNumber: "CLT017",
      daysOnMarket: 25,
      hoaFees: 595,
      amenities: ["Smart Home Tech", "Private Terrace", "Rooftop Pool", "Modern Finishes"]
    }
  },
  {
    mlsId: "CLT018",
    address: "1234 Eastway Drive",
    city: "Charlotte",
    state: "NC",
    zipCode: "28205",
    latitude: 35.2387,
    longitude: -80.7745,
    price: 385000,
    bedrooms: 3,
    bathrooms: 2,
    squareFeet: 1450,
    lotSize: 0.25,
    yearBuilt: 1965,
    propertyType: "Single Family",
    status: "Active",
    listingDate: new Date("2024-06-21"),
    imageUrl: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800",
    description: "Renovated ranch home in up-and-coming eastside Charlotte. New kitchen, updated bathrooms, and large fenced backyard. Great investment opportunity in growing area.",
    listingAgentName: "Michael Rodriguez",
    listingAgentEmail: "michael.rodriguez@dickens-mitchener.com",
    listingAgentPhone: "(704) 555-1863",
    brokerageName: "Dickens Mitchener & Associates",
    brokeragePhone: "(704) 342-1000",
    mlsBoardName: "Canopy MLS",
    rawData: {
      originalSource: "CANOPYMLS",
      mlsNumber: "CLT018",
      daysOnMarket: 2,
      features: ["Renovated Ranch", "New Kitchen", "Fenced Yard", "Investment Opportunity"]
    }
  },
  {
    mlsId: "CLT019",
    address: "9876 Ballantyne Commons Parkway #304",
    city: "Charlotte",
    state: "NC",
    zipCode: "28277",
    latitude: 35.0876,
    longitude: -80.8512,
    price: 475000,
    bedrooms: 2,
    bathrooms: 2,
    squareFeet: 1250,
    lotSize: null,
    yearBuilt: 2017,
    propertyType: "Condo",
    status: "Active",
    listingDate: new Date("2024-06-13"),
    imageUrl: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800",
    description: "Upscale Ballantyne condo with modern amenities and resort-style living. Granite counters, stainless appliances, and access to golf course and shopping.",
    listingAgentName: "Amanda Foster",
    listingAgentEmail: "amanda.foster@coldwellbanker.com",
    listingAgentPhone: "(704) 555-1974",
    brokerageName: "Coldwell Banker Realty",
    brokeragePhone: "(704) 543-9292",
    mlsBoardName: "Canopy MLS",
    rawData: {
      originalSource: "CANOPYMLS",
      mlsNumber: "CLT019",
      daysOnMarket: 9,
      hoaFees: 385,
      amenities: ["Golf Course Access", "Resort Amenities", "Shopping Nearby"]
    }
  },
  {
    mlsId: "CLT020",
    address: "5432 Sardis Road",
    city: "Charlotte",
    state: "NC",
    zipCode: "28270",
    latitude: 35.1234,
    longitude: -80.7456,
    price: 615000,
    bedrooms: 4,
    bathrooms: 3,
    squareFeet: 2450,
    lotSize: 0.42,
    yearBuilt: 2012,
    propertyType: "Single Family",
    status: "Sold",
    listingDate: new Date("2024-05-20"),
    imageUrl: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800",
    description: "Recently sold family home in sought-after southeast Charlotte. Two-story with bonus room, updated kitchen, and large deck overlooking private backyard.",
    listingAgentName: "Brandon Taylor",
    listingAgentEmail: "brandon.taylor@allentate.com",
    listingAgentPhone: "(704) 555-2087",
    brokerageName: "Allen Tate Realtors",
    brokeragePhone: "(704) 556-0100",
    mlsBoardName: "Canopy MLS",
    rawData: {
      originalSource: "CANOPYMLS",
      mlsNumber: "CLT020",
      daysOnMarket: 18,
      soldDate: "2024-06-07",
      soldPrice: 610000,
      features: ["Two Story", "Bonus Room", "Large Deck", "Private Backyard"]
    }
  }
];

// Charlotte property media
const charlotteMedia = [
  // CLT001 - Uptown Condo
  { propertyMlsId: "CLT001", url: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800", caption: "Living area with city views", order: 1 },
  { propertyMlsId: "CLT001", url: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800", caption: "Modern kitchen", order: 2 },
  { propertyMlsId: "CLT001", url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800", caption: "Master bedroom", order: 3 },

  // CLT002 - Dilworth Historic
  { propertyMlsId: "CLT002", url: "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800", caption: "Historic front exterior", order: 1 },
  { propertyMlsId: "CLT002", url: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800", caption: "Renovated chef's kitchen", order: 2 },
  { propertyMlsId: "CLT002", url: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800", caption: "Private backyard oasis", order: 3 },

  // CLT003 - Dilworth New Condo
  { propertyMlsId: "CLT003", url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800", caption: "Modern living space", order: 1 },
  { propertyMlsId: "CLT003", url: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800", caption: "Contemporary kitchen", order: 2 },

  // CLT004 - Myers Park Estate
  { propertyMlsId: "CLT004", url: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800", caption: "Grand estate exterior", order: 1 },
  { propertyMlsId: "CLT004", url: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800", caption: "Formal living room", order: 2 },
  { propertyMlsId: "CLT004", url: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800", caption: "Manicured gardens", order: 3 },

  // CLT005 - South End Loft
  { propertyMlsId: "CLT005", url: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800", caption: "Modern loft living", order: 1 },
  { propertyMlsId: "CLT005", url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800", caption: "Industrial chic design", order: 2 },

  // CLT006 - NoDa Craftsman
  { propertyMlsId: "CLT006", url: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800", caption: "Craftsman bungalow exterior", order: 1 },
  { propertyMlsId: "CLT006", url: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800", caption: "Original character living room", order: 2 },
  { propertyMlsId: "CLT006", url: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800", caption: "Updated kitchen", order: 3 },

  // CLT007 - Plaza Midwood Mid-Century
  { propertyMlsId: "CLT007", url: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800", caption: "Mid-century modern exterior", order: 1 },
  { propertyMlsId: "CLT007", url: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800", caption: "Open concept living", order: 2 },
  { propertyMlsId: "CLT007", url: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800", caption: "Private backyard", order: 3 },

  // CLT008 - Fourth Ward Townhouse
  { propertyMlsId: "CLT008", url: "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800", caption: "Historic Victorian townhouse", order: 1 },
  { propertyMlsId: "CLT008", url: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800", caption: "Restored interior", order: 2 },
  { propertyMlsId: "CLT008", url: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800", caption: "Luxury kitchen", order: 3 },

  // CLT009 - Elizabeth Colonial
  { propertyMlsId: "CLT009", url: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800", caption: "Colonial revival exterior", order: 1 },
  { propertyMlsId: "CLT009", url: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800", caption: "Traditional living room", order: 2 },

  // CLT010 - SouthPark High-rise
  { propertyMlsId: "CLT010", url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800", caption: "High-rise living with views", order: 1 },
  { propertyMlsId: "CLT010", url: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800", caption: "Premium kitchen", order: 2 },

  // CLT011 - Ballantyne Contemporary
  { propertyMlsId: "CLT011", url: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800", caption: "Contemporary home exterior", order: 1 },
  { propertyMlsId: "CLT011", url: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800", caption: "Open floor plan living", order: 2 },
  { propertyMlsId: "CLT011", url: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800", caption: "Gourmet kitchen", order: 3 },

  // CLT012 - Davidson Family Home (20 photos for testing)
  { propertyMlsId: "CLT012", url: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800", caption: "Family-friendly exterior", order: 1 },
  { propertyMlsId: "CLT012", url: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800", caption: "Open living space", order: 2 },
  { propertyMlsId: "CLT012", url: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800", caption: "Modern kitchen", order: 3 },
  { propertyMlsId: "CLT012", url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800", caption: "Master bedroom", order: 4 },
  { propertyMlsId: "CLT012", url: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800", caption: "Backyard oasis", order: 5 },
  { propertyMlsId: "CLT012", url: "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800", caption: "Front entrance", order: 6 },
  { propertyMlsId: "CLT012", url: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800", caption: "Living room", order: 7 },
  { propertyMlsId: "CLT012", url: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800", caption: "Formal dining", order: 8 },
  { propertyMlsId: "CLT012", url: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800", caption: "Family room", order: 9 },
  { propertyMlsId: "CLT012", url: "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800", caption: "Kitchen island", order: 10 },
  { propertyMlsId: "CLT012", url: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800", caption: "Guest bedroom", order: 11 },
  { propertyMlsId: "CLT012", url: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800", caption: "Study/office", order: 12 },
  { propertyMlsId: "CLT012", url: "https://images.unsplash.com/photo-1604709177225-055f99402ea3?w=800", caption: "Master bathroom", order: 13 },
  { propertyMlsId: "CLT012", url: "https://images.unsplash.com/photo-1507089947368-19c1da9775ae?w=800", caption: "Walk-in closet", order: 14 },
  { propertyMlsId: "CLT012", url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800", caption: "Laundry room", order: 15 },
  { propertyMlsId: "CLT012", url: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800", caption: "Garage", order: 16 },
  { propertyMlsId: "CLT012", url: "https://images.unsplash.com/photo-1560184897-ae75f418493e?w=800", caption: "Patio area", order: 17 },
  { propertyMlsId: "CLT012", url: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800", caption: "Side yard", order: 18 },
  { propertyMlsId: "CLT012", url: "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=800", caption: "Neighborhood view", order: 19 },
  { propertyMlsId: "CLT012", url: "https://images.unsplash.com/photo-1605276373954-0c4a0dac5726?w=800", caption: "Evening exterior", order: 20 },

  // CLT013 - Matthews Home
  { propertyMlsId: "CLT013", url: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800", caption: "Well-maintained exterior", order: 1 },
  { propertyMlsId: "CLT013", url: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800", caption: "Updated kitchen with granite", order: 2 },

  // CLT014 - Uptown Luxury Tower
  { propertyMlsId: "CLT014", url: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800", caption: "Luxury tower living", order: 1 },
  { propertyMlsId: "CLT014", url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800", caption: "Panoramic city views", order: 2 },
  { propertyMlsId: "CLT014", url: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800", caption: "Premium finishes", order: 3 },

  // CLT015 - SouthPark Modern Condo
  { propertyMlsId: "CLT015", url: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800", caption: "Modern condo living", order: 1 },
  { propertyMlsId: "CLT015", url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800", caption: "Contemporary design", order: 2 },

  // CLT016 - SouthPark Executive Home
  { propertyMlsId: "CLT016", url: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800", caption: "Executive home exterior", order: 1 },
  { propertyMlsId: "CLT016", url: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800", caption: "Formal living area", order: 2 },
  { propertyMlsId: "CLT016", url: "https://images.unsplash.com/photo-1544984243-ec57ea16fe25?w=800", caption: "Resort-style backyard pool", order: 3 },

  // CLT017 - Camden Smart Condo
  { propertyMlsId: "CLT017", url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800", caption: "Ultra-modern interior", order: 1 },
  { propertyMlsId: "CLT017", url: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800", caption: "Smart home kitchen", order: 2 },

  // CLT018 - Eastside Ranch
  { propertyMlsId: "CLT018", url: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800", caption: "Renovated ranch exterior", order: 1 },
  { propertyMlsId: "CLT018", url: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800", caption: "Updated living space", order: 2 },

  // CLT019 - Ballantyne Golf Condo
  { propertyMlsId: "CLT019", url: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800", caption: "Upscale condo living", order: 1 },
  { propertyMlsId: "CLT019", url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800", caption: "Resort-style amenities", order: 2 },

  // CLT020 - Sardis Family Home (Sold)
  { propertyMlsId: "CLT020", url: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800", caption: "Two-story family home", order: 1 },
  { propertyMlsId: "CLT020", url: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800", caption: "Family room with bonus space", order: 2 },
  { propertyMlsId: "CLT020", url: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800", caption: "Large deck and backyard", order: 3 }
];

// Sample users with hashed passwords
const sampleUsers = [
  {
    email: "john.doe@example.com",
    password: "password123", // Will be hashed
    firstName: "John",
    lastName: "Doe",
    phoneNumber: "+1-555-0123",
    role: "USER",
    emailVerified: true,
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face"
  },
  {
    email: "jane.smith@realestategear.com",
    password: "agent123", // Will be hashed
    firstName: "Jane",
    lastName: "Smith",
    phoneNumber: "+1-555-0456",
    role: "AGENT",
    emailVerified: true,
    avatarUrl: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face"
  },
  {
    email: "sarah.johnson@realestategear.com",
    password: "agent456", // Will be hashed
    firstName: "Sarah",
    lastName: "Johnson",
    phoneNumber: "+1-555-0789",
    role: "AGENT",
    emailVerified: true,
    avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face"
  },
  {
    email: "admin@realestategear.com",
    password: "admin123", // Will be hashed
    firstName: "Admin",
    lastName: "User",
    phoneNumber: "+1-555-0999",
    role: "ADMIN",
    emailVerified: true,
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face"
  },
  {
    email: "emily.rodriguez@example.com",
    password: "user123", // Will be hashed
    firstName: "Emily",
    lastName: "Rodriguez",
    phoneNumber: "+1-555-0321",
    role: "USER",
    emailVerified: true,
    avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face"
  }
];

// Sample favorites updated for Charlotte properties
const charlotteFavorites = [
  { userEmail: "john.doe@example.com", propertyMlsId: "CLT001" }, // Uptown condo
  { userEmail: "john.doe@example.com", propertyMlsId: "CLT002" }, // Dilworth historic
  { userEmail: "john.doe@example.com", propertyMlsId: "CLT008" }, // Fourth Ward townhouse
  { userEmail: "emily.rodriguez@example.com", propertyMlsId: "CLT006" }, // NoDa craftsman
  { userEmail: "emily.rodriguez@example.com", propertyMlsId: "CLT011" }, // Ballantyne contemporary
];

// Sample inquiries updated for Charlotte properties
const charlotteInquiries = [
  {
    userEmail: "john.doe@example.com",
    propertyMlsId: "CLT001",
    message: "I'm interested in this uptown condo. Can you tell me more about the building amenities and HOA fees? What floor is this unit on?",
    contactPreference: "EMAIL",
    status: "RESPONDED",
    agentResponse: "Hi John! This beautiful unit is on the 23rd floor with amazing city views. HOA fees are $650/month and include concierge, rooftop pool, fitness center, and valet parking. I'd love to show it to you this week!",
    respondedAt: new Date("2024-06-25T10:30:00Z")
  },
  {
    userEmail: "john.doe@example.com",
    propertyMlsId: "CLT008",
    message: "This Fourth Ward townhouse is stunning! What's the history of the restoration and are there any special considerations for owning in this historic area?",
    contactPreference: "PHONE",
    status: "PENDING"
  },
  {
    userEmail: "emily.rodriguez@example.com",
    propertyMlsId: "CLT006",
    message: "I love the NoDa area! This Craftsman home has so much character. Can you tell me about the neighborhood and walkability to restaurants and art galleries?",
    contactPreference: "BOTH",
    status: "RESPONDED",
    agentResponse: "Emily, NoDa is such a vibrant neighborhood! You can walk to incredible art galleries, live music venues, and craft breweries. The light rail stop is just a few blocks away. This home is in the heart of it all. Would you like to schedule a neighborhood tour?",
    respondedAt: new Date("2024-06-20T14:15:00Z")
  },
  {
    userEmail: "emily.rodriguez@example.com",
    propertyMlsId: "CLT011",
    message: "This Ballantyne home looks perfect for a family! What are the schools like in this area and is there good access to parks and recreation?",
    contactPreference: "EMAIL",
    status: "PENDING"
  }
];

async function main() {
  requireDemoSeedOptIn();
  console.log('🌱 Starting Charlotte seed...');

  // Clear existing data (order matters due to foreign key constraints)
  // Notes have Restrict on authorId — must be deleted before users
  await prisma.note.deleteMany();
  await prisma.inquiryDelivery.deleteMany();
  await prisma.inquiry.deleteMany();
  await prisma.userFavorites.deleteMany();
  await prisma.media.deleteMany();
  // Account cascade: contacts, transactions, tasks, segments, members, portals, manual listings
  await prisma.account.deleteMany();
  // Property cascade: MLS listings, media
  await prisma.property.deleteMany();
  // User cascade: AIAction, ConnectedAccount, AuthIdentity, AccountMember, SavedSearch
  await prisma.user.deleteMany();

  console.log('🗑️  Cleared existing data');

  // Seed users + their accounts atomically. Schema requires every User to
  // belong to an Account (billing migration). Match the pattern used in
  // apps/api/src/routes/auth.ts register-agent: tx creates Account → User →
  // AccountMember. plan='free' so seeded accounts bypass billing gates.
  for (const userData of sampleUsers) {
    const hashedPassword = await bcrypt.hash(userData.password, 12);
    await prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          name: `${userData.firstName} ${userData.lastName}`,
          plan: 'free',
        },
      });
      const created = await tx.user.create({
        data: {
          ...userData,
          password: hashedPassword,
          accountId: account.id,
        },
      });
      await tx.accountMember.create({
        data: { accountId: account.id, userId: created.id, role: 'OWNER' },
      });
    });
  }

  console.log(`👤 Created ${sampleUsers.length} users`);

  // Seed Charlotte properties — split into Property (physical) + Listing (market event)
  const existingSlugs: string[] = [];
  const listingByMlsId = new Map<string, { propertyId: string; listingId: string }>();

  for (const propertyData of charlotteProperties) {
    let slug = generatePropertySlug(propertyData);
    let counter = 1;
    const originalSlug = slug;
    while (existingSlugs.includes(slug)) {
      slug = `${originalSlug}-${counter}`;
      counter++;
    }
    existingSlugs.push(slug);

    const property = await prisma.property.create({
      data: {
        address: propertyData.address,
        city: propertyData.city,
        state: propertyData.state,
        zipCode: propertyData.zipCode,
        latitude: propertyData.latitude ?? null,
        longitude: propertyData.longitude ?? null,
        bedrooms: propertyData.bedrooms ?? null,
        bathrooms: propertyData.bathrooms ?? null,
        squareFeet: propertyData.squareFeet ?? null,
        lotSize: propertyData.lotSize ?? null,
        yearBuilt: propertyData.yearBuilt ?? null,
        propertyType: mapPropertyType(propertyData.propertyType) as any,
      },
    });

    const listing = await prisma.listing.create({
      data: {
        propertyId: property.id,
        source: 'MLS',
        mlsBoardId: 'canopy_mls',
        mlsId: propertyData.mlsId,
        slug,
        listPrice: propertyData.price,
        status: mapListingStatus(propertyData.status) as any,
        listDate: propertyData.listingDate ?? null,
        imageUrl: propertyData.imageUrl ?? null,
        description: propertyData.description ?? null,
        listingAgentName: propertyData.listingAgentName ?? null,
        listingAgentEmail: propertyData.listingAgentEmail ?? null,
        listingAgentPhone: propertyData.listingAgentPhone ?? null,
        brokerageName: propertyData.brokerageName ?? null,
        brokeragePhone: propertyData.brokeragePhone ?? null,
        rawData: JSON.stringify(propertyData.rawData),
        bedrooms: propertyData.bedrooms ?? null,
        bathrooms: propertyData.bathrooms ?? null,
        squareFeet: propertyData.squareFeet ?? null,
      },
    });

    listingByMlsId.set(propertyData.mlsId, { propertyId: property.id, listingId: listing.id });
  }

  console.log(`📍 Created ${charlotteProperties.length} Charlotte properties with listings`);

  // Seed media for Charlotte properties
  for (const mediaData of charlotteMedia) {
    const ids = listingByMlsId.get(mediaData.propertyMlsId);
    if (ids) {
      await prisma.media.create({
        data: {
          propertyId: ids.propertyId,
          url: mediaData.url,
          caption: mediaData.caption,
          order: mediaData.order,
        },
      });
    }
  }

  console.log(`🖼️  Created ${charlotteMedia.length} media items`);

  // Seed Charlotte favorites
  for (const favoriteData of charlotteFavorites) {
    const user = await prisma.user.findFirst({ where: { email: favoriteData.userEmail } });
    const ids = listingByMlsId.get(favoriteData.propertyMlsId);
    if (user && ids) {
      await prisma.userFavorites.create({
        data: { userId: user.id, listingId: ids.listingId },
      });
    }
  }

  console.log(`❤️  Created ${charlotteFavorites.length} favorites`);

  // Seed canonical inquiries when a seeded user is attached to a portal.
  let createdInquiryCount = 0;
  for (const inquiryData of charlotteInquiries) {
    const user = await prisma.user.findFirst({ where: { email: inquiryData.userEmail } });
    const ids = listingByMlsId.get(inquiryData.propertyMlsId);
    if (user?.portalId && ids) {
      const normalizedEmail = user.email.trim().toLowerCase();
      const contact = await prisma.contact.upsert({
        where: { accountId_normalizedEmail: { accountId: user.accountId, normalizedEmail } },
        create: {
          accountId: user.accountId,
          firstName: user.firstName ?? '',
          lastName: user.lastName ?? '',
          email: normalizedEmail,
          normalizedEmail,
          phone: user.phoneNumber,
          userId: user.id,
          source: 'portal',
        },
        update: { userId: user.id },
      });
      await prisma.inquiry.create({
        data: {
          accountId: user.accountId,
          portalId: user.portalId,
          userId: user.id,
          listingId: ids.listingId,
          contactId: contact.id,
          source: 'PORTAL_AUTHENTICATED',
          visitorName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
          visitorEmail: normalizedEmail,
          visitorPhone: user.phoneNumber,
          message: inquiryData.message,
          contactPreference: inquiryData.contactPreference,
          status: inquiryData.status === 'PENDING' ? 'NEW' : inquiryData.status,
          agentResponse: inquiryData.agentResponse ?? null,
          respondedAt: inquiryData.respondedAt ?? null,
        },
      });
      createdInquiryCount++;
    }
  }

  console.log(`💬 Created ${createdInquiryCount} inquiries`);

  console.log('✅ Charlotte seed completed successfully!');
  console.log('\n📋 Test accounts created:');
  console.log('👤 Users:');
  console.log('   - john.doe@example.com (password: password123)');
  console.log('   - emily.rodriguez@example.com (password: user123)');
  console.log('🏢 Agents:');
  console.log('   - jane.smith@realestategear.com (password: agent123)');
  console.log('   - sarah.johnson@realestategear.com (password: agent456)');
  console.log('⚡ Admin:');
  console.log('   - admin@realestategear.com (password: admin123)');
  console.log('\n🏠 Charlotte Properties:');
  console.log('   - 20 properties across Charlotte metro neighborhoods');
  console.log('   - Uptown, Dilworth, Myers Park, South End, NoDa, Plaza Midwood');
  console.log('   - Davidson, Matthews, Ballantyne, SouthPark, Fourth Ward, Elizabeth');
  console.log('   - Price range: $385K - $2.1M');
  console.log('   - All properties have realistic coordinates for mapping');
}

main()
  .catch((e) => {
    console.error('❌ Charlotte seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
