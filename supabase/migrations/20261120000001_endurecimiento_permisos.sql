-- Gate 1 · Endurecimiento de permisos (defensa en profundidad).
-- No cambia datos ni lógica financiera ni desactiva RLS: solo recorta privilegios que no se usan.
--   1. `anon` no necesita ningún privilegio sobre tablas ni secuencias de `public`.
--   2. `authenticated` no necesita TRUNCATE, REFERENCES ni TRIGGER.
--   3. Las funciones de trigger no deben ser invocables por los roles de la API.
-- Los privilegios por defecto se ajustan para que las tablas futuras nazcan ya recortadas.

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke truncate, references, trigger on tables from authenticated;

do $do$
declare f record;
begin
  for f in
    select p.oid::regprocedure as firma
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prorettype = 'pg_catalog.trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.firma);
  end loop;
end
$do$;
