# Database Package

This package contains the Prisma database configuration and seeding scripts for the Real Estate Gear application.

## Seeding Options

### Default Local Demo Seed
```bash
npm run seed
```
Run this from the repo root. It resets local dev data and creates the Agent HQ-ready Charlotte demo dataset: 1000 listings, media, verified Canopy MLS access, deployed listing segments, CRM contacts, transactions, tasks, action queue items, and demo user accounts.

### Small Seed (20 Properties)
```bash
npm run seed
```
This runs the original seed with 20 hand-crafted Charlotte properties for development.

### Large Seed (1000 Properties)
```bash
npm run seed:1000
```
This generates 1000 realistic Charlotte properties using Faker.js across 15 neighborhoods.

## Seeding Features

### Property Generation
- **1000 Properties**: Distributed across 15 Charlotte metro neighborhoods
- **Realistic Locations**: Coordinates within actual neighborhood boundaries
- **Market-Based Pricing**: Property type and age-adjusted pricing
- **Diverse Property Types**: Single Family, Condos, Townhouses
- **Charlotte-Specific Data**: Real street names, zip codes, neighborhoods

### Neighborhoods Covered
- Uptown Charlotte, Dilworth, Myers Park, South End
- NoDa, Plaza Midwood, Fourth Ward, Elizabeth
- SouthPark, Ballantyne, Davidson, Matthews
- Cornelius, Huntersville, Mint Hill

### Media & Images
- Lightweight placeholder images for fast seeding
- Multiple photos per property (3-8 images)
- Realistic captions and ordering

### Sample Data
- Test user accounts (USER, AGENT, ADMIN roles)
- Sample favorites and inquiries
- Property media collections

## Database Commands

```bash
# Install dependencies (run this first)
npm install

# Generate Prisma client
npm run generate

# Reset database and reseed with original data
npm run db:reset

# Reset database and reseed with 1000 properties
npm run db:reset && npm run seed:1000

# Deploy migrations
npm run db:migrate
```

## Test Accounts

After seeding, you can use these accounts:

Demo accounts are local-only. Seed commands print the accounts they create; do
not reuse demo credentials in a deployed environment.

## Performance Notes

- The 1000-property seed takes 2-3 minutes to complete
- Properties are generated in batches of 100 for optimal performance
- Media generation is limited to first 100 properties to keep seed time reasonable
- All coordinates are within realistic Charlotte neighborhood boundaries

## Data Structure

The seeding script generates:
- Properties with realistic Charlotte addresses and coordinates
- Market-appropriate pricing based on neighborhood and property type
- Property details (bedrooms, bathrooms, square footage) appropriate for type
- Listing statuses: 70% Active, 20% Pending, 10% Sold
- MLS-style raw data with agent names and property features
