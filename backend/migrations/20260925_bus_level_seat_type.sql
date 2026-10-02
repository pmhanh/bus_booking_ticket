-- The existing buses.busType is the single source of the type for a whole bus.
-- Per-seat types are intentionally removed; bus types and seat positions are retained.
-- Run when deploying without TypeORM synchronize, after stopping the old backend.
BEGIN;
ALTER TABLE seat_definitions DROP COLUMN IF EXISTS "seatType";
DROP TYPE IF EXISTS seat_definitions_seattype_enum;
COMMIT;
