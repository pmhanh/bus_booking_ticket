-- Apply after 20260918_payment_refunds.sql, before restarting the application.
BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM payments WHERE "pendingRefund" ->> 'status' = 'PENDING'
    AND ("pendingRefund" ->> 'amount')::int <> amount - COALESCE("refundAmount", 0)) THEN
    RAISE EXCEPTION 'Resolve existing partial refund requests using the previous version before migrating';
  END IF;
END $$;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "checkoutExpiresAt" timestamptz;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "paidAt" timestamptz;
ALTER TABLE trip_seats ADD COLUMN IF NOT EXISTS "checkoutBookingId" uuid;

-- Preserve actual historical refunded amounts. A subsequent full refund returns
-- only the remainder, never the original amount a second time.
UPDATE payments SET status = 'SUCCESS' WHERE status::text = 'PARTIALLY_REFUNDED';
ALTER TABLE payments ALTER COLUMN status DROP DEFAULT;
ALTER TYPE payments_status_enum RENAME TO payments_status_enum_previous;
CREATE TYPE payments_status_enum AS ENUM ('INIT', 'PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');
ALTER TABLE payments ALTER COLUMN status TYPE payments_status_enum USING status::text::payments_status_enum;
ALTER TABLE payments ALTER COLUMN status SET DEFAULT 'INIT'::payments_status_enum;
DROP TYPE payments_status_enum_previous;
COMMIT;
