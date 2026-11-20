begin;
select plan(6);
-- Gate 1: permisos mínimos sobre el esquema public.
select is((select count(*)::int from information_schema.role_table_grants where table_schema='public' and grantee='anon'), 0, 'anon no tiene privilegios sobre tablas de public');
select is((select count(*)::int from information_schema.role_usage_grants where object_schema='public' and object_type='SEQUENCE' and grantee='anon'), 0, 'anon no tiene privilegios sobre secuencias de public');
select is((select count(*)::int from information_schema.role_table_grants where table_schema='public' and grantee='authenticated' and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER')), 0, 'authenticated no puede truncar ni crear triggers/referencias');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prorettype='pg_catalog.trigger'::regtype and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute'))), 0, 'las funciones de trigger no son invocables desde la API');
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity), 0, 'todas las tablas de public tienen RLS activo');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig,'{}')) c where c like 'search_path=%')), 0, 'toda función SECURITY DEFINER fija search_path');
select * from finish();
rollback;
