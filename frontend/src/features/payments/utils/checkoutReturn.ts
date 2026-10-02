const KEY = 'bus-booking-checkout-return';
type CheckoutReturn = { bookingId: string; email?: string };

export function rememberCheckout(value: CheckoutReturn) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* Lookup remains available when storage is blocked. */
  }
}

export function readCheckoutReturn(
  bookingId: string | null,
): CheckoutReturn | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (
      !value ||
      typeof value !== 'object' ||
      !('bookingId' in value) ||
      typeof value.bookingId !== 'string'
    )
      return null;
    if (bookingId && bookingId !== value.bookingId) return null;
    return {
      bookingId: value.bookingId,
      email:
        'email' in value && typeof value.email === 'string'
          ? value.email
          : undefined,
    };
  } catch {
    return null;
  }
}
