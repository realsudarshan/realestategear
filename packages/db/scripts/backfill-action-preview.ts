/**
 * Backfill previewData for seeded AIAction records that have payload but no previewData.
 * Run once after seeding: npx tsx packages/db/scripts/backfill-action-preview.ts
 */
import './loadEnv.js';
import { prisma } from '../index.js';

const RISK_LABELS: Record<string, string> = {
  inspection_contingency_deadline: 'Inspection contingency deadline approaching',
  financing_contingency_deadline: 'Financing contingency deadline approaching',
  appraisal_contingency_deadline: 'Appraisal contingency deadline approaching',
  earnest_money_due: 'Earnest money due date approaching',
  closing_date_approaching: 'Closing date within 7 days',
};

async function main() {
  const actions = await prisma.aIAction.findMany({
    where: { status: 'PENDING' },
  });
  const unset = actions.filter(a => a.previewData === null);

  console.log(`Found ${unset.length} actions without previewData`);
  let updated = 0;

  for (const action of unset) {
    const payload = action.payload as Record<string, any>;
    let previewData: Record<string, any> | null = null;

    if (action.toolType === 'LEAD_RESPONSE') {
      previewData = {
        leadSummary: `${payload.contactName ?? 'This lead'} has not been contacted recently. Re-engagement now will help prevent this lead from going cold.`,
        qualificationSignals: ['Has expressed interest in the local market', 'Prequalification not yet confirmed'],
        recommendedStrategy: 'Send a personalized follow-up email to re-engage and gauge current interest level.',
        emailSubject: payload.suggestedSubject ?? 'Following up on your home search',
        emailBody: payload.suggestedBody ?? `Hi ${payload.contactName?.split(' ')[0] ?? 'there'}, just checking in — happy to answer any questions!`,
        suggestedTags: [],
        suggestedStage: null,
        followUpTask: {
          title: `Follow-up call with ${payload.contactName ?? 'contact'}`,
          description: 'Check in after email to gauge interest.',
          dueInDays: 3,
          priority: 'MEDIUM',
        },
        missingInfo: ['Pre-approval status', 'Target move-in timeline'],
        riskFlags: [],
      };
    } else if (action.toolType === 'TRANSACTION_RISK') {
      const riskType = payload.riskType ?? 'closing_date_approaching';
      const daysUntil = payload.daysUntilDeadline ?? 5;
      const address = payload.address ?? 'this property';
      previewData = {
        riskFactors: [{
          rule: riskType,
          ruleLabel: RISK_LABELS[riskType] ?? riskType,
          description: `${daysUntil} day${daysUntil !== 1 ? 's' : ''} remaining — action required immediately.`,
          severity: daysUntil <= 3 ? 'HIGH' : 'MEDIUM',
          item: null,
        }],
        overallSeverity: daysUntil <= 3 ? 'HIGH' : 'MEDIUM',
        summary: `${RISK_LABELS[riskType] ?? riskType} for ${address}. Only ${daysUntil} day${daysUntil !== 1 ? 's' : ''} remain on this ${payload.transactionType ?? ''} transaction.`,
        recommendedNextStep: 'Contact all parties involved to confirm deadline awareness and take corrective action if needed.',
        suggestedTaskTitle: `Resolve: ${RISK_LABELS[riskType] ?? riskType} — ${address}`,
        closingDateFormatted: null,
        transactionAddress: address,
      };
    } else if (action.toolType === 'RELATIONSHIP_MEMORY') {
      const daysSince = payload.daysSinceLastContact ?? 45;
      previewData = {
        rule: 'dormant_contact',
        ruleLabel: 'Dormant Contact',
        summary: `No interaction with ${payload.contactName ?? 'this contact'} recorded in the past ${daysSince} days. This relationship is at risk of going cold.`,
        lastInteractionAt: payload.lastInteractionAt ?? null,
        recommendedAction: payload.suggestedAction ?? 'Send a check-in email',
        suggestedTaskTitle: `Follow up with ${payload.contactName ?? 'contact'}`,
        urgency: daysSince > 60 ? 'high' : daysSince > 45 ? 'medium' : 'low',
      };
    }

    if (previewData) {
      await prisma.aIAction.update({
        where: { id: action.id },
        data: { previewData },
      });
      updated++;
    }
  }

  console.log(`✅ Backfilled previewData for ${updated} actions`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
