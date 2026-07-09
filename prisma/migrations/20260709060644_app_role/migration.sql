-- Create the app_user role if it does not already exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user WITH LOGIN PASSWORD 'app_user_password';
    END IF;
END
$$;

-- Grant usage on public schema
GRANT USAGE ON SCHEMA public TO app_user;

-- Grant SELECT, INSERT, UPDATE, DELETE on all current tables in public schema
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;

-- Grant SELECT on the raw_items_worker_view specifically
GRANT SELECT ON public.raw_items_worker_view TO app_user;

-- Grant USAGE, SELECT on all sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Ensure future tables/sequences also automatically grant privileges to app_user
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;