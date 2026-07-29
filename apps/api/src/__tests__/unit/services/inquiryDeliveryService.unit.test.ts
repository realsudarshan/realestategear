import { beforeEach, describe, expect, it, vi } from 'vitest';

const delivery = vi.hoisted(() => ({ findMany: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() }));
vi.mock('db', () => ({ prisma: { inquiryDelivery: delivery } }));
vi.mock('email', () => ({ sendEmail: vi.fn() }));
vi.mock('../../../utils/logger.js', () => ({ default: { warn: vi.fn() } }));
const { dispatchInquiryDeliveries } = await import('../../../services/inquiryDeliveryService.js');

describe('dispatchInquiryDeliveries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delivery.findMany.mockResolvedValue([{ id: 'd1' }]);
    delivery.updateMany.mockResolvedValue({ count: 1 });
    delivery.findUniqueOrThrow.mockResolvedValue({ id: 'd1', recipient: 'owner@example.com', payload: { subject: 'New lead', text: 'Body' }, attempts: 0, maxAttempts: 2, nextAttemptAt: new Date() });
    delivery.update.mockResolvedValue({});
  });

  it('claims once and records actual provider delivery idempotently', async () => {
    const sender = vi.fn().mockResolvedValue({ ok: true, id: 'provider-1' });
    expect(await dispatchInquiryDeliveries({ sender })).toMatchObject({ delivered: 1, retried: 0 });
    expect(delivery.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'd1', OR: expect.any(Array) }), data: expect.objectContaining({ state: 'PROCESSING' }) }));
    expect(delivery.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ state: 'DELIVERED', providerId: 'provider-1' }) }));
  });

  it('does not claim delivery when another dispatcher won', async () => {
    delivery.updateMany.mockResolvedValue({ count: 0 });
    const sender = vi.fn();
    expect(await dispatchInquiryDeliveries({ sender })).toMatchObject({ skipped: 1, delivered: 0 });
    expect(sender).not.toHaveBeenCalled();
  });

  it('reclaims a stale processing lock after a crashed dispatcher', async () => {
    delivery.findMany.mockResolvedValue([{ id: 'stale' }]);
    delivery.findUniqueOrThrow.mockResolvedValue({ id: 'stale', recipient: 'owner@example.com', payload: { subject: 'New lead', text: 'Body' }, attempts: 0, maxAttempts: 2, nextAttemptAt: new Date() });
    const sender = vi.fn().mockResolvedValue({ ok: true });
    await dispatchInquiryDeliveries({ sender, now: new Date('2026-07-01T12:00:00Z') });
    expect(delivery.updateMany.mock.calls[0][0].where.OR).toContainEqual({ state: 'PROCESSING', lockedAt: { lte: new Date('2026-07-01T11:45:00Z') } });
    expect(sender).toHaveBeenCalledOnce();
  });

  it('schedules retry then dead-letters at max attempts', async () => {
    const sender = vi.fn().mockRejectedValue(new Error('provider down'));
    expect(await dispatchInquiryDeliveries({ sender })).toMatchObject({ retried: 1 });
    expect(delivery.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ state: 'RETRY', attempts: 1 }) }));
    delivery.findUniqueOrThrow.mockResolvedValue({ id: 'd1', recipient: 'owner@example.com', payload: { subject: 'New lead', text: 'Body' }, attempts: 1, maxAttempts: 2, nextAttemptAt: new Date() });
    expect(await dispatchInquiryDeliveries({ sender })).toMatchObject({ deadLettered: 1 });
    expect(delivery.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ state: 'DEAD_LETTER', attempts: 2 }) }));
  });
});
