-- Approved identity correction only. No populated identity conversion is allowed.
BEGIN;
LOCK TABLE public.interview_sessions, public.vendor_boost_requests
  IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.interview_sessions WHERE "vendorId" IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.vendor_boost_requests) THEN
    RAISE EXCEPTION 'Vendor references now exist; explicit identity mapping required';
  END IF;
END $$;
ALTER TABLE public.interview_sessions
  DROP CONSTRAINT IF EXISTS "interview_sessions_vendorId_fkey";
ALTER TABLE public.interview_sessions
  ADD CONSTRAINT "interview_sessions_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES public.users(id)
  ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE public.vendor_boost_requests
  DROP CONSTRAINT IF EXISTS "vendor_boost_requests_vendorId_fkey";
ALTER TABLE public.vendor_boost_requests
  ADD CONSTRAINT "vendor_boost_requests_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES public.users(id)
  ON UPDATE CASCADE ON DELETE CASCADE;
COMMIT;
