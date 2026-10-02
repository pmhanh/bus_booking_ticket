import { apiClient } from '../../../shared/api/api';
import { rememberCheckout } from '../utils/checkoutReturn';

export type CreateStripePaymentResponse = {
  checkoutUrl: string;
  sessionId: string;
  expiresAt?: string;
};

export async function createStripePayment(params: {
  bookingId: string;
  email?: string;
}) {
  const result = await apiClient<CreateStripePaymentResponse>(
    '/payments/stripe/create',
    {
      method: 'POST',
      body: params,
    },
  );
  rememberCheckout(params);
  return result;
}
