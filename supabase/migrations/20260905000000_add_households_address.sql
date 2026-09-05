-- The web client reads/writes households.address in the dashboard, invite page and API,
-- but the column never existed, which made every PostgREST select naming it fail.
ALTER TABLE public.households ADD COLUMN IF NOT EXISTS address text;
COMMENT ON COLUMN public.households.address IS 'Free-form street address shown on the dashboard and invitation page';
