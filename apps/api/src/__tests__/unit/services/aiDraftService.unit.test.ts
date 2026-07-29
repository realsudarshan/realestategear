import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockSendEmail = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  aIAction: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  aIAuditLog: { create: vi.fn() },
  inquiry: { findUnique: vi.fn(), update: vi.fn() },
  contactSubmission: { update: vi.fn() },
  contactInteraction: { create: vi.fn() },
  contact: { update: vi.fn() },
  task: { create: vi.fn() },
  user: { findUnique: vi.fn() },
  accountMember: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('db', () => ({ prisma: mockPrisma }));
vi.mock('email', () => ({ sendEmail: mockSendEmail }));
vi.mock('../../../utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { executeLeadResponse } = await import('../../../services/aiDraftService.js');

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ACTION_ID = 'action-1';
const AGENT_ID = 'agent-1';

const baseAction = {
  id: ACTION_ID,
  userId: AGENT_ID,
  status: 'PENDING',
  lockedUntil: null,
  lockedBy: null,
  sourceType: 'inquiry',
  sourceId: 'inq-1',
  contactId: 'c-1',
  decidedAt: null,
  payload: {
    leadContext: { lead: { email: 'lead@example.com' } },
  },
};

const baseOpts = {
  sendEmail: false,
  updateStage: null,
  updateTags: null,
  createTask: false,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('executeLeadResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: $transaction delegates immediately to the callback.
    mockPrisma.$transaction.mockImplementation(async (fn) => fn(mockPrisma));
    mockPrisma.inquiry.update.mockResolvedValue({});
    mockPrisma.contactSubmission.update.mockResolvedValue({});
    mockPrisma.contactInteraction.create.mockResolvedValue({});
    mockPrisma.aIAction.update.mockResolvedValue({ ...baseAction, status: 'EXECUTED' });
    mockPrisma.aIAction.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.aIAuditLog.create.mockResolvedValue({});
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'agent@re.com', firstName: 'A', lastName: 'B' });
    mockPrisma.accountMember.findFirst.mockResolvedValue({ accountId: 'account-1' });
  });

  it('returns error when action not found', async () => {
    mockPrisma.aIAction.findFirst.mockResolvedValue(null);
    const result = await executeLeadResponse(ACTION_ID, AGENT_ID, baseOpts);
    expect(result).toEqual({ ok: false, error: 'Action not found' });
  });

  it.each(['EXECUTING', 'SENT', 'DISMISSED', 'EXPIRED', 'EXECUTED'])(
    'returns error when action status is %s (non-executable)',
    async (status) => {
      mockPrisma.aIAction.findFirst.mockResolvedValue({ ...baseAction, status });
      const result = await executeLeadResponse(ACTION_ID, AGENT_ID, baseOpts);
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/cannot execute/i);
    },
  );

  it('returns error when action is actively locked', async () => {
    const lockedAction = {
      ...baseAction,
      lockedUntil: new Date(Date.now() + 60_000),
      lockedBy: 'another-process',
    };
    mockPrisma.aIAction.findFirst.mockResolvedValue(lockedAction);
    const result = await executeLeadResponse(ACTION_ID, AGENT_ID, baseOpts);
    expect(result).toEqual({ ok: false, error: 'Action is currently being processed' });
  });

  it('marks action EXPIRED when source was already responded to', async () => {
    mockPrisma.aIAction.findFirst.mockResolvedValue(baseAction);
    mockPrisma.inquiry.findUnique.mockResolvedValue({ status: 'RESPONDED' });
    mockPrisma.aIAction.update.mockResolvedValue({ ...baseAction, status: 'EXPIRED' });

    const result = await executeLeadResponse(ACTION_ID, AGENT_ID, baseOpts);

    expect(result).toEqual({ ok: false, error: 'Source has already been responded to' });
    expect(mockPrisma.aIAction.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'EXPIRED' }) }),
    );
  });

  it('marks EXECUTED (no email) when source not yet responded and sendEmail=false', async () => {
    mockPrisma.aIAction.findFirst.mockResolvedValue(baseAction);
    mockPrisma.inquiry.findUnique.mockResolvedValue({ status: 'NEW' });

    const result = await executeLeadResponse(ACTION_ID, AGENT_ID, { ...baseOpts, sendEmail: false });

    expect(result.ok).toBe(true);
    expect(mockPrisma.aIAction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: ACTION_ID,
          userId: AGENT_ID,
          status: { in: ['PENDING', 'APPROVED', 'FAILED'] },
        }),
        data: expect.objectContaining({ status: 'EXECUTING' }),
      }),
    );
    // Final update sets EXECUTED
    const lastUpdate = mockPrisma.aIAction.update.mock.calls.at(-1)[0];
    expect(lastUpdate.data.status).toBe('EXECUTED');
  });

  it('returns processing error when atomic lease acquisition loses the race', async () => {
    mockPrisma.aIAction.findFirst.mockResolvedValue(baseAction);
    mockPrisma.inquiry.findUnique.mockResolvedValue({ status: 'NEW' });
    mockPrisma.aIAction.updateMany.mockResolvedValue({ count: 0 });

    const result = await executeLeadResponse(ACTION_ID, AGENT_ID, { ...baseOpts, sendEmail: false });

    expect(result).toEqual({ ok: false, error: 'Action is currently being processed' });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('sends email and marks SENT when sendEmail=true', async () => {
    mockPrisma.aIAction.findFirst.mockResolvedValue(baseAction);
    mockPrisma.inquiry.findUnique.mockResolvedValue({ status: 'NEW' });
    mockSendEmail.mockResolvedValue({ id: 'resend-msg-1' });

    const result = await executeLeadResponse(ACTION_ID, AGENT_ID, {
      sendEmail: true,
      emailSubject: 'Hello',
      emailBody: 'Paragraph <one> & "two".\n\nLine with \'quote\'.',
      updateStage: null,
      updateTags: null,
      createTask: false,
    });

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'lead@example.com',
        subject: 'Hello',
        html: '<p>Paragraph &lt;one&gt; &amp; &quot;two&quot;.</p>\n<p>Line with &#39;quote&#39;.</p>',
      }),
    );
    expect(result.ok).toBe(true);
    const lastUpdate = mockPrisma.aIAction.update.mock.calls.at(-1)[0];
    expect(lastUpdate.data.status).toBe('SENT');
  });

  it('marks FAILED and returns error when no recipient email found', async () => {
    const actionNoEmail = {
      ...baseAction,
      payload: { leadContext: { lead: { email: null } } },
    };
    mockPrisma.aIAction.findFirst.mockResolvedValue(actionNoEmail);
    mockPrisma.inquiry.findUnique.mockResolvedValue({ status: 'NEW' });
    // markFailed does a findUnique to get userId for audit log
    mockPrisma.aIAction.findUnique.mockResolvedValue({ userId: AGENT_ID });
    mockPrisma.aIAction.update.mockResolvedValue({ ...actionNoEmail, status: 'FAILED' });

    const result = await executeLeadResponse(ACTION_ID, AGENT_ID, {
      sendEmail: true,
      updateStage: null,
      updateTags: null,
      createTask: false,
    });

    expect(result).toEqual({ ok: false, error: 'No recipient email on action' });
  });

  it('marks FAILED and returns partial=true when email succeeds but CRM transaction throws', async () => {
    mockPrisma.aIAction.findFirst.mockResolvedValue(baseAction);
    mockPrisma.inquiry.findUnique.mockResolvedValue({ status: 'NEW' });
    mockSendEmail.mockResolvedValue({ id: 'resend-msg-2' });
    mockPrisma.$transaction.mockRejectedValue(new Error('DB connection lost'));

    const result = await executeLeadResponse(ACTION_ID, AGENT_ID, {
      sendEmail: true,
      emailSubject: 'Hi',
      emailBody: 'Body',
      updateStage: null,
      updateTags: null,
      createTask: false,
    });

    expect(result.ok).toBe(false);
    expect(result.partial).toBe(true);
    const lastUpdate = mockPrisma.aIAction.update.mock.calls.at(-1)[0];
    expect(lastUpdate.data.status).toBe('FAILED');
  });
});
