import '../scripts/loadEnv.js';
import { prisma } from '../index.js';

const updates: Record<string, {
  listingAgentName: string;
  listingAgentEmail: string;
  listingAgentPhone: string;
  brokerageName: string;
  brokeragePhone: string;
  mlsBoardName: string;
}> = {
  CLT001: { listingAgentName: "Sarah Mitchell", listingAgentEmail: "sarah.mitchell@allentate.com", listingAgentPhone: "(704) 555-0142", brokerageName: "Allen Tate Realtors", brokeragePhone: "(704) 556-0100", mlsBoardName: "Canopy MLS" },
  CLT002: { listingAgentName: "Marcus Johnson", listingAgentEmail: "marcus.johnson@coldwellbanker.com", listingAgentPhone: "(704) 555-0218", brokerageName: "Coldwell Banker Realty", brokeragePhone: "(704) 543-9292", mlsBoardName: "Canopy MLS" },
  CLT003: { listingAgentName: "Lisa Chen", listingAgentEmail: "lisa.chen@corcoranHM.com", listingAgentPhone: "(704) 555-0374", brokerageName: "Corcoran HM Properties", brokeragePhone: "(704) 367-7637", mlsBoardName: "Canopy MLS" },
  CLT004: { listingAgentName: "David Park", listingAgentEmail: "david.park@sothebys.com", listingAgentPhone: "(704) 555-0491", brokerageName: "Premier Sotheby's International Realty", brokeragePhone: "(704) 248-0490", mlsBoardName: "Canopy MLS" },
  CLT005: { listingAgentName: "Jennifer Torres", listingAgentEmail: "jennifer.torres@dickens-mitchener.com", listingAgentPhone: "(704) 555-0563", brokerageName: "Dickens Mitchener & Associates", brokeragePhone: "(704) 342-1000", mlsBoardName: "Canopy MLS" },
  CLT006: { listingAgentName: "Robert Kim", listingAgentEmail: "robert.kim@allentate.com", listingAgentPhone: "(704) 555-0617", brokerageName: "Allen Tate Realtors", brokeragePhone: "(704) 556-0100", mlsBoardName: "Canopy MLS" },
  CLT007: { listingAgentName: "Michelle Davis", listingAgentEmail: "michelle.davis@coldwellbanker.com", listingAgentPhone: "(704) 555-0729", brokerageName: "Coldwell Banker Realty", brokeragePhone: "(704) 543-9292", mlsBoardName: "Canopy MLS" },
  CLT008: { listingAgentName: "Andrew Wilson", listingAgentEmail: "andrew.wilson@ivester-jackson.com", listingAgentPhone: "(704) 555-0834", brokerageName: "Ivester Jackson Christie's International", brokeragePhone: "(704) 525-9898", mlsBoardName: "Canopy MLS" },
  CLT009: { listingAgentName: "Patricia Brown", listingAgentEmail: "patricia.brown@allentate.com", listingAgentPhone: "(704) 555-0951", brokerageName: "Allen Tate Realtors", brokeragePhone: "(704) 556-0100", mlsBoardName: "Canopy MLS" },
  CLT010: { listingAgentName: "Steven Lee", listingAgentEmail: "steven.lee@corcoranHM.com", listingAgentPhone: "(704) 555-1073", brokerageName: "Corcoran HM Properties", brokeragePhone: "(704) 367-7637", mlsBoardName: "Canopy MLS" },
  CLT011: { listingAgentName: "Maria Gonzalez", listingAgentEmail: "maria.gonzalez@dickens-mitchener.com", listingAgentPhone: "(704) 555-1186", brokerageName: "Dickens Mitchener & Associates", brokeragePhone: "(704) 342-1000", mlsBoardName: "Canopy MLS" },
  CLT012: { listingAgentName: "Thomas Anderson", listingAgentEmail: "thomas.anderson@allentate.com", listingAgentPhone: "(704) 555-1294", brokerageName: "Allen Tate Realtors", brokeragePhone: "(704) 556-0100", mlsBoardName: "Canopy MLS" },
  CLT013: { listingAgentName: "Rachel White", listingAgentEmail: "rachel.white@coldwellbanker.com", listingAgentPhone: "(704) 555-1307", brokerageName: "Coldwell Banker Realty", brokeragePhone: "(704) 543-9292", mlsBoardName: "Canopy MLS" },
  CLT014: { listingAgentName: "Kenneth Thompson", listingAgentEmail: "kenneth.thompson@sothebys.com", listingAgentPhone: "(704) 555-1421", brokerageName: "Premier Sotheby's International Realty", brokeragePhone: "(704) 248-0490", mlsBoardName: "Canopy MLS" },
  CLT015: { listingAgentName: "Nicole Martinez", listingAgentEmail: "nicole.martinez@allentate.com", listingAgentPhone: "(704) 555-1538", brokerageName: "Allen Tate Realtors", brokeragePhone: "(704) 556-0100", mlsBoardName: "Canopy MLS" },
  CLT016: { listingAgentName: "Gregory Adams", listingAgentEmail: "gregory.adams@ivester-jackson.com", listingAgentPhone: "(704) 555-1642", brokerageName: "Ivester Jackson Christie's International", brokeragePhone: "(704) 525-9898", mlsBoardName: "Canopy MLS" },
  CLT017: { listingAgentName: "Stephanie Clark", listingAgentEmail: "stephanie.clark@corcoranHM.com", listingAgentPhone: "(704) 555-1759", brokerageName: "Corcoran HM Properties", brokeragePhone: "(704) 367-7637", mlsBoardName: "Canopy MLS" },
  CLT018: { listingAgentName: "Michael Rodriguez", listingAgentEmail: "michael.rodriguez@dickens-mitchener.com", listingAgentPhone: "(704) 555-1863", brokerageName: "Dickens Mitchener & Associates", brokeragePhone: "(704) 342-1000", mlsBoardName: "Canopy MLS" },
  CLT019: { listingAgentName: "Amanda Foster", listingAgentEmail: "amanda.foster@coldwellbanker.com", listingAgentPhone: "(704) 555-1974", brokerageName: "Coldwell Banker Realty", brokeragePhone: "(704) 543-9292", mlsBoardName: "Canopy MLS" },
  CLT020: { listingAgentName: "Brandon Taylor", listingAgentEmail: "brandon.taylor@allentate.com", listingAgentPhone: "(704) 555-2087", brokerageName: "Allen Tate Realtors", brokeragePhone: "(704) 556-0100", mlsBoardName: "Canopy MLS" },
};

async function main() {
  let updated = 0;
  let skipped = 0;

  for (const [mlsId, data] of Object.entries(updates)) {
    const result = await prisma.property.updateMany({
      where: { mlsId, brokerageName: null },
      data,
    });
    if (result.count > 0) {
      console.log(`✓ ${mlsId}`);
      updated++;
    } else {
      console.log(`– ${mlsId} (skipped — already populated or not found)`);
      skipped++;
    }
  }

  console.log(`\nDone: ${updated} updated, ${skipped} skipped.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
