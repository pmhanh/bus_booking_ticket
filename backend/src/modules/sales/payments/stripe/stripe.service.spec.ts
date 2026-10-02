import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { StripeService } from './stripe.service';

jest.mock('stripe', () => jest.fn());

describe('Stripe refund completion', () => {
  const request = {
    paymentIntentId: 'pi_123',
    amount: 100000,
    idempotencyKey: 'refund-payment-1',
  };
  const refunds = {
    list: jest.fn(() => [] as any[]),
    create: jest.fn(),
    retrieve: jest.fn(),
  };
  let service: StripeService;

  beforeEach(() => {
    jest.resetAllMocks();
    refunds.list.mockReturnValue([]);
    (Stripe as unknown as jest.Mock).mockImplementation(() => ({ refunds }));
    service = new StripeService({
      get: () => 'test-key',
    } as unknown as ConfigService);
  });

  it('returns a completed gateway refund', async () => {
    refunds.create.mockResolvedValue({ id: 're_123', status: 'succeeded' });
    await expect(service.refundPaymentIntent(request)).resolves.toMatchObject({
      status: 'succeeded',
    });
    expect(refunds.retrieve).not.toHaveBeenCalled();
  });

  it('refreshes a pending response replayed by an idempotent retry', async () => {
    refunds.create.mockResolvedValue({ id: 're_123', status: 'pending' });
    refunds.retrieve.mockResolvedValue({ id: 're_123', status: 'succeeded' });
    await expect(service.refundPaymentIntent(request)).resolves.toMatchObject({
      status: 'succeeded',
    });
    expect(refunds.retrieve).toHaveBeenCalledWith('re_123');
  });

  it('does not report success while the refund remains pending', async () => {
    refunds.create.mockResolvedValue({ id: 're_123', status: 'pending' });
    refunds.retrieve.mockResolvedValue({ id: 're_123', status: 'pending' });
    await expect(service.refundPaymentIntent(request)).resolves.toMatchObject({
      status: 'pending',
      id: 're_123',
    });
  });
  it('recovers a previous refund by request metadata without issuing a new refund', async () => {
    refunds.list.mockReturnValue([
      { id: 're_existing', metadata: { requestId: request.idempotencyKey } },
    ]);
    refunds.retrieve.mockResolvedValue({
      id: 're_existing',
      status: 'succeeded',
    });
    await service.refundPaymentIntent(request);
    expect(refunds.create).not.toHaveBeenCalled();
    expect(refunds.retrieve).toHaveBeenCalledWith('re_existing');
  });
  it('retrieves a saved refund ID directly', async () => {
    refunds.retrieve.mockResolvedValue({ id: 're_saved', status: 'succeeded' });
    await service.refundPaymentIntent({
      ...request,
      stripeRefundId: 're_saved',
    });
    expect(refunds.list).not.toHaveBeenCalled();
    expect(refunds.create).not.toHaveBeenCalled();
  });
});
