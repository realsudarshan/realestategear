import { prisma } from 'db';

const DEFAULT_TEMPLATE_KEY = 'standard-transaction-v1';

const DEFAULT_TEMPLATE_BLUEPRINT = {
  key: DEFAULT_TEMPLATE_KEY,
  name: 'Standard Transaction Milestone Template',
  description: 'Default workflow for milestone-driven transaction setup.',
  milestones: [
    { key: 'offer_accepted', label: 'Offer Accepted', sortOrder: 1, required: true },
    { key: 'inspection_deadline', label: 'Inspection Deadline', sortOrder: 2, required: true },
    { key: 'appraisal_date', label: 'Appraisal Date', sortOrder: 3, required: true },
    { key: 'financing_deadline', label: 'Financing Deadline', sortOrder: 4, required: true },
    { key: 'closing_date', label: 'Closing Date', sortOrder: 5, required: true },
  ],
  tasks: [
    {
      key: 'confirm_escrow_opened',
      title: 'Confirm escrow is opened',
      description: 'Verify escrow account details and notify all parties.',
      anchorMilestoneKey: 'offer_accepted',
      offsetDays: 1,
      priority: 'HIGH',
      status: 'TODO',
      sortOrder: 1,
    },
    {
      key: 'inspection_follow_up',
      title: 'Review inspection findings',
      description: 'Compile findings and action requests before deadline.',
      anchorMilestoneKey: 'inspection_deadline',
      offsetDays: -1,
      priority: 'HIGH',
      status: 'TODO',
      sortOrder: 2,
    },
    {
      key: 'appraisal_packet',
      title: 'Prepare appraisal packet',
      description: 'Ensure all property details and comps are ready.',
      anchorMilestoneKey: 'appraisal_date',
      offsetDays: -2,
      priority: 'MEDIUM',
      status: 'TODO',
      sortOrder: 3,
    },
    {
      key: 'financing_checkin',
      title: 'Confirm lender readiness',
      description: 'Check lender status and clear pending underwriting items.',
      anchorMilestoneKey: 'financing_deadline',
      offsetDays: -1,
      priority: 'HIGH',
      status: 'TODO',
      sortOrder: 4,
    },
    {
      key: 'closing_statement_review',
      title: 'Review closing statement',
      description: 'Validate figures and approvals before closing day.',
      anchorMilestoneKey: 'closing_date',
      offsetDays: -2,
      priority: 'URGENT',
      status: 'TODO',
      sortOrder: 5,
    },
  ],
  events: [
    {
      key: 'inspection_walkthrough_event',
      type: 'INSPECTION',
      title: 'Inspection walkthrough',
      anchorMilestoneKey: 'inspection_deadline',
      offsetDays: -1,
      durationHours: 1,
      isAllDay: false,
      status: 'SCHEDULED',
      sortOrder: 1,
    },
    {
      key: 'appraisal_event',
      type: 'APPRAISAL',
      title: 'Appraisal appointment',
      anchorMilestoneKey: 'appraisal_date',
      offsetDays: 0,
      durationHours: 1,
      isAllDay: false,
      status: 'SCHEDULED',
      sortOrder: 2,
    },
    {
      key: 'closing_event',
      type: 'CLOSING',
      title: 'Closing appointment',
      anchorMilestoneKey: 'closing_date',
      offsetDays: 0,
      durationHours: 2,
      isAllDay: false,
      status: 'SCHEDULED',
      sortOrder: 3,
    },
  ],
  documents: [
    { key: 'purchase_agreement', label: 'Purchase Agreement', required: true, sortOrder: 1 },
    { key: 'seller_disclosures', label: 'Seller Disclosures', required: true, sortOrder: 2 },
    { key: 'title_report', label: 'Title Report / Commitment', required: true, sortOrder: 3 },
    { key: 'closing_disclosure', label: 'Closing Disclosure', required: true, sortOrder: 4 },
    { key: 'inspection_report', label: 'Inspection Report', required: false, sortOrder: 5 },
    { key: 'appraisal', label: 'Appraisal', required: false, sortOrder: 6 },
    { key: 'amendment', label: 'Amendment / Addendum', required: false, sortOrder: 7 },
    { key: 'proof_of_funds', label: 'Proof of Funds / Pre-Approval', required: false, sortOrder: 8 },
    { key: 'home_warranty', label: 'Home Warranty', required: false, sortOrder: 9 },
    { key: 'lead_paint_disclosure', label: 'Lead Paint Disclosure', required: false, sortOrder: 10 },
  ],
};

function buildError(message, status = 400, details = null) {
  const error = new Error(message);
  error.status = status;
  if (details) error.details = details;
  return error;
}

function toDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeMilestoneDateInput(milestoneDefinitions, input) {
  const provided = input && typeof input === 'object' ? input : {};
  const knownKeys = new Set(milestoneDefinitions.map((definition) => definition.key));
  const dateMap = new Map();

  for (const [key, rawValue] of Object.entries(provided)) {
    if (!knownKeys.has(key)) continue;
    const parsed = toDate(rawValue);
    if (!parsed) continue;
    dateMap.set(key, parsed);
  }

  return dateMap;
}

export function validateMilestoneDateOrder(milestoneDefinitions, milestoneDates) {
  const errors = [];
  const ordered = [...milestoneDefinitions].sort((a, b) => a.sortOrder - b.sortOrder);

  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    const previousDate = milestoneDates.get(previous.key);
    const currentDate = milestoneDates.get(current.key);

    if (!previousDate || !currentDate) continue;
    if (currentDate < previousDate) {
      errors.push({
        key: current.key,
        message: `${current.label} cannot be before ${previous.label}.`,
      });
    }
  }

  return errors;
}

export function dateWithOffset(anchorDate, offsetDays) {
  const base = new Date(anchorDate);
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return base;
}

function eventRangeForDate(date, durationHours, isAllDay) {
  const start = new Date(date);
  if (isAllDay) {
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { startAt: start, endAt: end };
  }

  start.setUTCHours(15, 0, 0, 0);
  const end = new Date(start);
  end.setUTCHours(end.getUTCHours() + (durationHours || 1));
  return { startAt: start, endAt: end };
}

export function buildPreviewModel(template, milestoneDates) {
  const milestones = template.milestones.map((milestone) => {
    const date = milestoneDates.get(milestone.key) || null;
    return {
      definitionId: milestone.id,
      key: milestone.key,
      label: milestone.label,
      sortOrder: milestone.sortOrder,
      required: milestone.required,
      date,
      status: date ? 'scheduled' : milestone.required ? 'missing' : 'optional',
    };
  });

  const tasks = template.taskDefinitions.map((definition) => {
    const anchor = template.milestones.find((milestone) => milestone.id === definition.anchorMilestoneId);
    const anchorDate = anchor ? milestoneDates.get(anchor.key) : null;
    const dueDate = anchorDate ? dateWithOffset(anchorDate, definition.offsetDays) : null;
    return {
      key: definition.key,
      title: definition.title,
      description: definition.description,
      priority: definition.priority,
      status: definition.status,
      sortOrder: definition.sortOrder,
      offsetDays: definition.offsetDays,
      anchorMilestoneKey: anchor?.key || null,
      anchorMilestoneLabel: anchor?.label || null,
      dueDate,
      timelineStatus: dueDate ? 'scheduled' : 'pending_anchor',
    };
  });

  const events = template.eventDefinitions.map((definition) => {
    const anchor = template.milestones.find((milestone) => milestone.id === definition.anchorMilestoneId);
    const anchorDate = anchor ? milestoneDates.get(anchor.key) : null;
    const eventDate = anchorDate ? dateWithOffset(anchorDate, definition.offsetDays) : null;
    const range = eventDate ? eventRangeForDate(eventDate, definition.durationHours, definition.isAllDay) : null;
    return {
      key: definition.key,
      type: definition.type,
      title: definition.title,
      status: definition.status,
      sortOrder: definition.sortOrder,
      offsetDays: definition.offsetDays,
      durationHours: definition.durationHours,
      isAllDay: definition.isAllDay,
      anchorMilestoneKey: anchor?.key || null,
      anchorMilestoneLabel: anchor?.label || null,
      startAt: range?.startAt || null,
      endAt: range?.endAt || null,
      timelineStatus: range ? 'scheduled' : 'pending_anchor',
    };
  });

  const timeline = [
    ...milestones
      .filter((milestone) => milestone.date)
      .map((milestone) => ({
        id: `milestone:${milestone.key}`,
        type: 'milestone',
        label: milestone.label,
        date: milestone.date,
      })),
    ...tasks
      .filter((task) => task.dueDate)
      .map((task) => ({
        id: `task:${task.key}`,
        type: 'task',
        label: task.title,
        date: task.dueDate,
      })),
    ...events
      .filter((event) => event.startAt)
      .map((event) => ({
        id: `event:${event.key}`,
        type: 'event',
        label: event.title,
        date: event.startAt,
      })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return { milestones, tasks, events, timeline };
}

async function ensureDefaultTemplate(tx) {
  const existing = await tx.transactionTemplate.findUnique({
    where: { key: DEFAULT_TEMPLATE_KEY },
    include: {
      milestones: { orderBy: { sortOrder: 'asc' } },
      taskDefinitions: { orderBy: { sortOrder: 'asc' } },
      eventDefinitions: { orderBy: { sortOrder: 'asc' } },
      documentDefinitions: { orderBy: { sortOrder: 'asc' } },
    },
  });

  if (existing) {
    if (!existing.documentDefinitions?.length) {
      await tx.templateDocumentDefinition.createMany({
        data: DEFAULT_TEMPLATE_BLUEPRINT.documents.map((doc: any) => ({
          templateId: existing.id,
          key: doc.key,
          label: doc.label,
          description: doc.description || null,
          sortOrder: doc.sortOrder,
          required: doc.required,
        })),
      });
    }
    return tx.transactionTemplate.findUnique({
      where: { id: existing.id },
      include: {
        milestones: { orderBy: { sortOrder: 'asc' } },
        taskDefinitions: { orderBy: { sortOrder: 'asc' } },
        eventDefinitions: { orderBy: { sortOrder: 'asc' } },
        documentDefinitions: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  const template = await tx.transactionTemplate.create({
    data: {
      key: DEFAULT_TEMPLATE_BLUEPRINT.key,
      name: DEFAULT_TEMPLATE_BLUEPRINT.name,
      description: DEFAULT_TEMPLATE_BLUEPRINT.description,
      isActive: true,
    },
  });

  const milestoneByKey = new Map();

  for (const milestone of DEFAULT_TEMPLATE_BLUEPRINT.milestones) {
    const created = await tx.milestoneDefinition.create({
      data: {
        templateId: template.id,
        key: milestone.key,
        label: milestone.label,
        sortOrder: milestone.sortOrder,
        required: milestone.required,
      },
    });
    milestoneByKey.set(milestone.key, created.id);
  }

  await tx.templateTaskDefinition.createMany({
    data: DEFAULT_TEMPLATE_BLUEPRINT.tasks.map((task) => ({
      templateId: template.id,
      key: task.key,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      offsetDays: task.offsetDays,
      sortOrder: task.sortOrder,
      anchorMilestoneId: milestoneByKey.get(task.anchorMilestoneKey),
    })),
  });

  await tx.templateEventDefinition.createMany({
    data: DEFAULT_TEMPLATE_BLUEPRINT.events.map((event) => ({
      templateId: template.id,
      key: event.key,
      type: event.type,
      title: event.title,
      status: event.status,
      durationHours: event.durationHours,
      isAllDay: event.isAllDay,
      offsetDays: event.offsetDays,
      sortOrder: event.sortOrder,
      anchorMilestoneId: milestoneByKey.get(event.anchorMilestoneKey),
    })),
  });

  await tx.templateDocumentDefinition.createMany({
    data: DEFAULT_TEMPLATE_BLUEPRINT.documents.map((doc: any) => ({
      templateId: template.id,
      key: doc.key,
      label: doc.label,
      description: doc.description || null,
      sortOrder: doc.sortOrder,
      required: doc.required,
    })),
  });

  return tx.transactionTemplate.findUnique({
    where: { id: template.id },
    include: {
      milestones: { orderBy: { sortOrder: 'asc' } },
      taskDefinitions: { orderBy: { sortOrder: 'asc' } },
      eventDefinitions: { orderBy: { sortOrder: 'asc' } },
      documentDefinitions: { orderBy: { sortOrder: 'asc' } },
    },
  });
}

export async function getSetupTemplate() {
  return prisma.$transaction(async (tx) => {
    const template = await ensureDefaultTemplate(tx);
    return {
      key: template.key,
      name: template.name,
      description: template.description,
      milestones: template.milestones.map((milestone) => ({
        key: milestone.key,
        label: milestone.label,
        required: milestone.required,
        sortOrder: milestone.sortOrder,
      })),
    };
  });
}

export async function previewTransactionMilestonePlan(input) {
  return prisma.$transaction(async (tx) => {
    const template = await ensureDefaultTemplate(tx);
    const milestoneDates = normalizeMilestoneDateInput(template.milestones, input?.milestoneDates);
    const orderErrors = validateMilestoneDateOrder(template.milestones, milestoneDates);

    const requiredMissing = template.milestones
      .filter((definition) => definition.required && !milestoneDates.has(definition.key))
      .map((definition) => ({ key: definition.key, message: `${definition.label} is required.` }));

    const preview = buildPreviewModel(template, milestoneDates);
    return {
      template: {
        key: template.key,
        name: template.name,
      },
      validation: {
        orderErrors,
        requiredMissing,
      },
      preview,
    };
  });
}

export async function createTransactionFromMilestones(agentId, data) {
  if (!data?.type) throw buildError('Transaction type is required.');

  const member = await prisma.accountMember.findFirst({ where: { userId: agentId } });
  if (!member) throw buildError('User has no account', 403);

  return prisma.$transaction(async (tx) => {
    const template = await ensureDefaultTemplate(tx);
    const milestoneDates = normalizeMilestoneDateInput(template.milestones, data.milestoneDates);

    const requiredMissing = template.milestones
      .filter((definition) => definition.required && !milestoneDates.has(definition.key))
      .map((definition) => definition.label);
    if (requiredMissing.length) {
      throw buildError(
        `Missing required milestone dates: ${requiredMissing.join(', ')}.`,
        400,
        { requiredMissing }
      );
    }

    const orderErrors = validateMilestoneDateOrder(template.milestones, milestoneDates);
    if (orderErrors.length) {
      throw buildError('Milestone date order is invalid.', 400, { orderErrors });
    }

    const transaction = await tx.transaction.create({
      data: {
        accountId: member.accountId,
        type: String(data.type),
        stage: data.stage ? String(data.stage) : 'PROSPECT',
        address: data.address ? String(data.address) : null,
        mlsId: data.mlsId ? String(data.mlsId) : null,
        listPrice: data.listPrice ?? null,
        salePrice: data.salePrice ?? null,
        commissionRate: data.commissionRate ?? null,
        closingDate: milestoneDates.get('closing_date') || null,
        notes: data.notes ? String(data.notes) : null,
        propertyId: data.propertyId ? String(data.propertyId) : null,
        assignedAgentId: agentId,
        templateId: template.id,
      },
    });

    const milestoneRows = template.milestones
      .map((milestone) => ({
        milestoneDefinitionId: milestone.id,
        date: milestoneDates.get(milestone.key) || null,
      }))
      .filter((milestone) => milestone.date)
      .map((milestone) => ({
        transactionId: transaction.id,
        milestoneDefinitionId: milestone.milestoneDefinitionId,
        date: milestone.date,
      }));

    if (milestoneRows.length) {
      await tx.transactionMilestone.createMany({ data: milestoneRows });
    }

    const milestoneById = new Map(
      template.milestones.map((milestone) => [milestone.id, milestoneDates.get(milestone.key) || null])
    );

    const taskRows = template.taskDefinitions
      .map((definition) => {
        const anchorDate = milestoneById.get(definition.anchorMilestoneId);
        if (!anchorDate) return null;
        return {
          accountId: member.accountId,
          title: definition.title,
          description: definition.description,
          dueDate: dateWithOffset(anchorDate, definition.offsetDays),
          priority: definition.priority,
          status: definition.status,
          assignedToId: agentId,
          transactionId: transaction.id,
        };
      })
      .filter(Boolean);

    if (taskRows.length) {
      await tx.task.createMany({ data: taskRows });
    }

    const eventRows = template.eventDefinitions
      .map((definition) => {
        const anchorDate = milestoneById.get(definition.anchorMilestoneId);
        if (!anchorDate) return null;
        const eventDate = dateWithOffset(anchorDate, definition.offsetDays);
        const range = eventRangeForDate(eventDate, definition.durationHours, definition.isAllDay);
        return {
          type: definition.type,
          title: definition.title,
          status: definition.status,
          startAt: range.startAt,
          endAt: range.endAt,
          isAllDay: definition.isAllDay,
          assignedAgentId: agentId,
          transactionId: transaction.id,
        };
      })
      .filter(Boolean);

    if (eventRows.length) {
      await tx.event.createMany({ data: eventRows });
    }

    const docDefs = template.documentDefinitions || [];
    if (docDefs.length) {
      await tx.transactionDocument.createMany({
        data: docDefs.map((def) => ({
          transactionId: transaction.id,
          documentDefinitionId: def.id,
          label: def.label,
          status: 'MISSING',
        })),
      });
    }

    return tx.transaction.findUnique({
      where: { id: transaction.id },
      include: {
        milestones: {
          include: { milestoneDefinition: true },
          orderBy: { date: 'asc' },
        },
        tasks: { orderBy: { dueDate: 'asc' } },
        events: { orderBy: { startAt: 'asc' } },
        documents: {
          orderBy: { createdAt: 'asc' },
          include: {
            documentDefinition: true,
            matchedAttachment: { include: { message: true } },
          },
        },
      },
    });
  });
}
