begin;
select plan(12);

-- El alta de un usuario crea solo lo técnico: nada de catálogo, fondos, presupuestos ni gastos de ejemplo.
insert into auth.users (instance_id, id, aud, role, email)
values ('00000000-0000-0000-0000-000000000000', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'authenticated', 'authenticated', 'd@test.local');

create temp table mio as select household_id as hid from public.profiles where user_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

select is((select count(*)::int from public.households where created_by = 'dddddddd-dddd-dddd-dddd-dddddddddddd'), 1, 'se crea su hogar');
select is((select count(*)::int from public.household_members where user_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' and role = 'owner'), 1, 'es owner de su hogar');
select is((select count(*)::int from public.profiles where user_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' and household_id is not null), 1, 'tiene perfil vinculado al hogar');

select is((select count(*)::int from public.ambitos where household_id = (select hid from mio)), 0, 'sin ámbitos');
select is((select count(*)::int from public.categorias where household_id = (select hid from mio)), 0, 'sin categorías');
select is((select count(*)::int from public.subcategorias where household_id = (select hid from mio)), 0, 'sin subcategorías');
select is((select count(*)::int from public.medios_pago where household_id = (select hid from mio)), 0, 'sin medios de pago');
select is((select count(*)::int from public.funds where household_id = (select hid from mio)), 0, 'sin fondos');
select is((select count(*)::int from public.budget_periods where household_id = (select hid from mio)), 0, 'sin períodos');
select is((select count(*)::int from public.expenses where household_id = (select hid from mio)), 0, 'sin gastos');
select is((select count(*)::int from public.expense_templates where household_id = (select hid from mio)), 0, 'sin plantillas');
select is((select count(*)::int from public.audit_logs where household_id = (select hid from mio)), 0, 'sin actividad registrada');

select * from finish();
rollback;
