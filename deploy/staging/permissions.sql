BEGIN;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM rublevka_app;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM rublevka_app;

DO $permissions$
DECLARE
    item record;
BEGIN
    FOR item IN
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
        AND (left(tablename, 9) = 'cms_site_' OR left(tablename, 10) = 'assistant_')
    LOOP
        EXECUTE format(
            'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO rublevka_app', item.tablename
        );
    END LOOP;

    FOR item IN
        SELECT sequencename FROM pg_sequences WHERE schemaname = 'public'
        AND (left(sequencename, 9) = 'cms_site_' OR left(sequencename, 10) = 'assistant_')
    LOOP
        EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.%I TO rublevka_app', item.sequencename);
    END LOOP;
END;
$permissions$;
COMMIT;
