import { apiClient } from "../../../shared/api/api";

export type CreateStripePaymentResponse = {
  checkoutUrl: string;
  sessionId: string;
};

export async function createStripePayment(
  params: { bookingId: string; email?: string },
  token?: string | null,
) {
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  return apiClient<CreateStripePaymentResponse>("/payments/stripe/create", {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });
}

