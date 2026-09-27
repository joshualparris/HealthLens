-- Lock all personal HealthLens data away from public browser roles.
-- Server-side service-role clients continue to work because service_role bypasses RLS.

DO $$
DECLARE
  table_name text;
  private_tables text[] := ARRAY[
    'oauth_tokens',
    'health_sources',
    'health_sync_imports',
    'daily_health_summary',
    'sleep_sessions',
    'heart_metrics',
    'exercise_sessions',
    'body_measurements',
    'daily_context_tags',
    'strava_activities',
    'strava_webhook_events'
  ];
BEGIN
  FOREACH table_name IN ARRAY private_tables
  LOOP
    EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE IF EXISTS public.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', table_name);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', table_name);
  END LOOP;
END $$;

-- Older Fitbit rows stored the provider response verbatim. Remove duplicate
-- access/refresh tokens from raw_response while keeping the dedicated columns.
UPDATE public.oauth_tokens
SET raw_response = raw_response - 'access_token' - 'refresh_token'
WHERE raw_response IS NOT NULL;
