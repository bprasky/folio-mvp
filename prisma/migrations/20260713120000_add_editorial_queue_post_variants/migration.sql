-- Editorial Queue (docs/17_EDITORIAL_QUEUE.md), migration 1 of 3.
-- Add the three queue-assigned formats to PostVariant. Formats extend the
-- existing enum rather than introducing a new QueueFormat enum so completed
-- queue pieces flow directly through the existing ProjectPost publishing path.
--
-- Additive and idempotent: ADD VALUE IF NOT EXISTS leaves existing values and
-- rows untouched, and re-running this migration is a no-op.
ALTER TYPE "PostVariant" ADD VALUE IF NOT EXISTS 'QA';
ALTER TYPE "PostVariant" ADD VALUE IF NOT EXISTS 'THIS_OR_THAT';
ALTER TYPE "PostVariant" ADD VALUE IF NOT EXISTS 'GET_TO_KNOW';
