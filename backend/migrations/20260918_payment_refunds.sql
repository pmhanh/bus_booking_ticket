-- Run using psql with autocommit (not --single-transaction): PostgreSQL must
-- commit the new enum value before the data migration can use it.
ALTER TYPE payments_status_enum ADD VALUE IF NOT EXISTS 'PARTIALLY_REFUNDED';

BEGIN;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "paidPaymentId" uuid;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "pendingRefund" jsonb;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "refundHistory" jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Earlier versions recorded partial refunds as REFUNDED.
UPDATE payments SET status = 'PARTIALLY_REFUNDED'
WHERE status = 'REFUNDED' AND "refundAmount" > 0 AND "refundAmount" < amount;

-- A legacy confirmed booking is bound to its earliest successful payment.
UPDATE bookings b SET "paidPaymentId" = p.id
FROM (
  SELECT DISTINCT ON (booking_id) booking_id, id
  FROM payments WHERE status IN ('SUCCESS', 'PARTIALLY_REFUNDED')
  ORDER BY booking_id, "createdAt", id
) p
WHERE b.id = p.booking_id AND b.status = 'CONFIRMED' AND b."paidPaymentId" IS NULL;
COMMIT;
