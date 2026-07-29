import { vi, describe, it, expect } from 'vitest';

const servicePath = new URL('../../../services/transactionCreationFlowService.ts', import.meta.url).href;

vi.mock('db', () => ({
  prisma: {},
}));

const { buildPreviewModel, validateMilestoneDateOrder } = await import(servicePath);

describe('transactionCreationFlowService', () => {
  const template = {
    milestones: [
      { id: 'm1', key: 'offer_accepted', label: 'Offer Accepted', sortOrder: 1, required: true },
      { id: 'm2', key: 'inspection_deadline', label: 'Inspection Deadline', sortOrder: 2, required: true },
    ],
    taskDefinitions: [
      {
        key: 'inspection_follow_up',
        title: 'Review inspection findings',
        description: null,
        priority: 'HIGH',
        status: 'TODO',
        sortOrder: 1,
        offsetDays: -1,
        anchorMilestoneId: 'm2',
      },
    ],
    eventDefinitions: [
      {
        key: 'inspection_event',
        type: 'INSPECTION',
        title: 'Inspection walkthrough',
        status: 'SCHEDULED',
        sortOrder: 1,
        offsetDays: 0,
        durationHours: 1,
        isAllDay: false,
        anchorMilestoneId: 'm2',
      },
    ],
  };

  it('flags milestone ordering violations', () => {
    const milestoneDates = new Map([
      ['offer_accepted', new Date('2026-05-15T00:00:00.000Z')],
      ['inspection_deadline', new Date('2026-05-10T00:00:00.000Z')],
    ]);

    const errors = validateMilestoneDateOrder(template.milestones, milestoneDates);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('Inspection Deadline cannot be before Offer Accepted');
  });

  it('resolves offsets for scheduled timeline items', () => {
    const milestoneDates = new Map([['inspection_deadline', new Date('2026-05-10T00:00:00.000Z')]]);
    const preview = buildPreviewModel(template, milestoneDates);

    expect(preview.tasks[0].timelineStatus).toBe('scheduled');
    expect(new Date(preview.tasks[0].dueDate).toISOString()).toBe('2026-05-09T00:00:00.000Z');
    expect(preview.events[0].timelineStatus).toBe('scheduled');
    expect(preview.timeline.length).toBeGreaterThan(0);
  });

  it('marks timeline entries pending when anchor milestone is missing', () => {
    const preview = buildPreviewModel(template, new Map());
    expect(preview.tasks[0].timelineStatus).toBe('pending_anchor');
    expect(preview.tasks[0].dueDate).toBeNull();
    expect(preview.events[0].timelineStatus).toBe('pending_anchor');
  });
});
