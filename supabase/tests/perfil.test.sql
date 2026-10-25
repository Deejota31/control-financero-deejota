begin;
select plan(4);

insert into auth.users (instance_id, id, aud, role, email)
values ('00000000-0000-0000-0000-000000000000', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'authenticated', 'authenticated', 'c@test.local');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}', true);

select lives_ok($$update public.profiles set display_name = 'Ana', theme = 'oscuro' where user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'$$, 'el dueño edita su perfil');
select is((select display_name from public.profiles), 'Ana', 'el cambio se guarda');
select throws_ok($$update public.profiles set date_format = 'raro' where user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'$$, '23514', null, 'formato de fecha inválido se rechaza');
select throws_ok($$update public.profiles set display_currency = 'USD' where user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'$$, '23514', null, 'solo PEN como moneda');

select * from finish();
rollback;
