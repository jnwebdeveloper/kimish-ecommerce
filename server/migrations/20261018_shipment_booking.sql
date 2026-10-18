-- Shiprocket booking from the admin "Ship" button: the courier the customer chose, pickup and
-- delivery times, and the last booking error shown in the admin shipment panel
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS courier_id text NOT NULL DEFAULT '';
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS pickup_scheduled_at timestamptz;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS booking_error text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS shipments_awb_idx ON shipments(awb_code) WHERE awb_code <> '';
