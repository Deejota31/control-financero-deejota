-- Eventos: organización analítica independiente de los fondos y períodos.
-- Las plantillas comparten estructura (is_template), pero nunca reciben gastos.
create table public.events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 100),
  description text not null default '' check (length(description) <= 1000),
  event_type text not null default 'other' check (event_type in ('birthday','travel','celebration','wedding','home','project','family','other')),
  target_date date,
  start_date date,
  budget numeric(14,2) not null default 0 check (budget >= 0),
  currency text not null default 'PEN' check (currency = 'PEN'),
  icon_key text not null default 'party-popper' check (public.is_valid_icon(icon_key)),
  color_token text not null default 'c1' check (public.is_valid_color(color_token)),
  status text not null default 'planned' check (status in ('planned','in_progress','completed','cancelled')),
  is_template boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  check (start_date is null or target_date is null or start_date <= target_date),
  check (is_template or target_date is not null)
);
create index events_user_date_idx on public.events(user_id,is_template,target_date,id);
create trigger events_updated before update on public.events for each row execute function public.set_updated_at();

create table public.event_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  household_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 100),
  planned_amount numeric(14,2) not null default 0 check (planned_amount >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id,event_id,household_id),
  foreign key (event_id,household_id) references public.events(id,household_id) on delete cascade
);
create index event_items_event_idx on public.event_items(event_id,sort_order,id);

create table public.event_commitments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  household_id uuid not null,
  event_item_id uuid,
  name text not null check (length(btrim(name)) between 1 and 100),
  contracted_amount numeric(14,2) not null check (contracted_amount >= 0),
  currency text not null default 'PEN' check (currency='PEN'),
  due_date date,
  notes text not null default '' check(length(notes)<=1000),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id,event_id,household_id),
  foreign key (event_id,household_id) references public.events(id,household_id) on delete cascade,
  foreign key (event_item_id,event_id,household_id) references public.event_items(id,event_id,household_id) on delete set null (event_item_id)
);
create index event_commitments_event_idx on public.event_commitments(event_id,id);
create trigger event_commitments_updated before update on public.event_commitments for each row execute function public.set_updated_at();

alter table public.expenses
  add column event_id uuid,
  add column event_item_id uuid,
  add column event_commitment_id uuid,
  add constraint expenses_event_fk foreign key(event_id,household_id) references public.events(id,household_id),
  add constraint expenses_event_item_fk foreign key(event_item_id,event_id,household_id) references public.event_items(id,event_id,household_id) on delete set null(event_item_id),
  add constraint expenses_event_commitment_fk foreign key(event_commitment_id,event_id,household_id) references public.event_commitments(id,event_id,household_id),
  add constraint expenses_event_context check ((event_item_id is null and event_commitment_id is null) or event_id is not null);
create index expenses_event_idx on public.expenses(event_id,status,expense_date,id) where event_id is not null;
create index expenses_commitment_idx on public.expenses(event_commitment_id,status) where event_commitment_id is not null;

alter table public.expense_templates add column event_id uuid,
  add constraint expense_templates_event_fk foreign key(event_id,household_id) references public.events(id,household_id);

alter table public.events enable row level security;
alter table public.event_items enable row level security;
alter table public.event_commitments enable row level security;
revoke all on public.events,public.event_items,public.event_commitments from public,anon,authenticated;
grant select,insert,update on public.events to authenticated;
grant select,insert,update,delete on public.event_items to authenticated;
grant select,insert,update on public.event_commitments to authenticated;
create policy events_own on public.events for all to authenticated
  using(user_id=(select auth.uid()) and public.is_household_member(household_id))
  with check(user_id=(select auth.uid()) and public.is_household_member(household_id));
create policy event_items_own on public.event_items for all to authenticated
  using(exists(select 1 from public.events e where e.id=event_id and e.household_id=household_id))
  with check(exists(select 1 from public.events e where e.id=event_id and e.household_id=household_id));
create policy event_commitments_own on public.event_commitments for all to authenticated
  using(exists(select 1 from public.events e where e.id=event_id and e.household_id=household_id))
  with check(exists(select 1 from public.events e where e.id=event_id and e.household_id=household_id));

-- Valida relaciones también al usar las RPC financieras originales o lotes.
create function public.validate_expense_event() returns trigger
language plpgsql security definer set search_path='' as $$
declare ev public.events%rowtype; co public.event_commitments%rowtype; inherited uuid;
begin
  if tg_table_name='expense_templates' then
    if new.event_id is null then return new; end if;
    select * into ev from public.events where id=new.event_id;
    if ev.user_id is distinct from auth.uid() or ev.household_id<>new.household_id or ev.is_template then
      raise exception 'Evento no disponible para esta cuenta.' using errcode='EV001';
    end if;
    return new;
  end if;
  if tg_op='INSERT' and new.event_id is null and new.template_id is not null then
    select t.event_id into inherited from public.expense_templates t join public.events e on e.id=t.event_id
      where t.id=new.template_id and e.user_id=auth.uid() and e.household_id=new.household_id
        and e.status in ('planned','in_progress') and e.archived_at is null and not e.is_template;
    new.event_id:=inherited;
  end if;
  if new.event_id is null then
    if new.event_item_id is not null or new.event_commitment_id is not null then raise exception 'Selecciona primero el evento.' using errcode='EV001'; end if;
    return new;
  end if;
  -- Una FK puede quitar un concepto ya eliminado (también al limpiar una cuenta).
  -- Solo admite limpiar esa referencia; nunca permite introducir vínculos nuevos.
  if tg_op='UPDATE' and pg_trigger_depth()>1 and new.event_id is not distinct from old.event_id
    and new.event_commitment_id is not distinct from old.event_commitment_id
    and new.event_item_id is null and old.event_item_id is not null
    and not exists(select 1 from public.event_items where id=old.event_item_id) then
    return new;
  end if;
  select * into ev from public.events where id=new.event_id for share;
  if not found or ev.household_id<>new.household_id or ev.user_id is distinct from auth.uid() or ev.is_template
    or new.created_by is distinct from ev.user_id or ev.currency<>new.currency then
    raise exception 'El gasto y el evento deben pertenecer a la misma cuenta y moneda.' using errcode='EV001';
  end if;
  if tg_op='INSERT' or new.event_id is distinct from old.event_id or new.event_commitment_id is distinct from old.event_commitment_id then
    if ev.archived_at is not null or ev.status not in ('planned','in_progress') then
      raise exception 'Este evento ya no recibe nuevas asociaciones. Puedes consultar su historial o reabrirlo.' using errcode='EV002';
    end if;
  end if;
  if new.event_commitment_id is not null then
    select * into co from public.event_commitments where id=new.event_commitment_id and event_id=new.event_id and household_id=new.household_id;
    if not found then raise exception 'El compromiso no pertenece al evento.' using errcode='EV001'; end if;
    if co.cancelled_at is not null and (tg_op='INSERT' or new.event_commitment_id is distinct from old.event_commitment_id) then
      raise exception 'El compromiso está cancelado.' using errcode='EV002';
    end if;
    if co.event_item_id is not null then
      if new.event_item_id is not null and new.event_item_id<>co.event_item_id then raise exception 'El concepto no corresponde al compromiso.' using errcode='EV001'; end if;
      new.event_item_id:=co.event_item_id;
    end if;
  end if;
  return new;
end;
$$;
create trigger expenses_validate_event before insert or update of event_id,event_item_id,event_commitment_id,currency on public.expenses for each row execute function public.validate_expense_event();
create trigger expense_templates_validate_event before insert or update of event_id on public.expense_templates for each row execute function public.validate_expense_event();

create function public.validate_event_structure() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if old.id<>new.id or old.user_id<>new.user_id or old.household_id<>new.household_id then
    raise exception 'La identidad del evento no se puede cambiar.' using errcode='EV001';
  end if;
  if old.is_template<>new.is_template then
    raise exception 'Usa Guardar como plantilla o Usar plantilla para crear una copia sin movimientos.' using errcode='EV001';
  end if;
  return new;
end;
$$;
create trigger events_structure before update on public.events for each row execute function public.validate_event_structure();

-- Reagrupar un contrato actualiza el concepto de todos sus pagos, sin mover fondos.
create function public.sync_commitment_item() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.event_item_id is distinct from old.event_item_id then
    update public.expenses set event_item_id=new.event_item_id where event_commitment_id=new.id;
  end if;
  return new;
end;
$$;
create trigger commitments_item_sync after update of event_item_id on public.event_commitments
  for each row execute function public.sync_commitment_item();

-- Misma transacción que el motor existente; un fallo de asociación revierte también
-- el movimiento, sus imputaciones y su clave. Reintentar no cambia asociaciones.
create function public.save_expense_event(p jsonb,p_key uuid default null,p_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare res jsonb; eid uuid; hid uuid:=public.current_household_id();
begin
  if auth.uid() is null or hid is null then raise exception 'Sesión no válida.' using errcode='28000'; end if;
  if p_id is null then res:=public.create_expense(p,p_key); else res:=public.update_expense(p_id,p); end if;
  if coalesce((res->>'replayed')::boolean,false) then return res; end if;
  eid:=coalesce(p_id,(res->>'expense_id')::uuid);
  if p ? 'event_id' then
    update public.expenses set event_id=nullif(p->>'event_id','')::uuid,
      event_item_id=nullif(p->>'event_item_id','')::uuid, event_commitment_id=nullif(p->>'event_commitment_id','')::uuid
      where id=eid and household_id=hid and (
        event_id is distinct from nullif(p->>'event_id','')::uuid or
        event_item_id is distinct from nullif(p->>'event_item_id','')::uuid or
        event_commitment_id is distinct from nullif(p->>'event_commitment_id','')::uuid
      );
  end if;
  return res;
end;
$$;

-- Vínculos puramente analíticos: no invocan recalc_period ni modifican importes.
-- Bloqueo de filas ordenado, conflicto explícito y cambio de evento opt-in.
create function public.link_event_expenses(p_ids uuid[],p_event uuid default null,p_item uuid default null,p_commitment uuid default null,p_replace boolean default false)
returns integer language plpgsql security definer set search_path='' as $$
declare e public.expenses%rowtype; n integer:=0; hid uuid:=public.current_household_id();
begin
  if auth.uid() is null or hid is null then raise exception 'Sesión no válida.' using errcode='28000'; end if;
  if coalesce(cardinality(p_ids),0) not between 1 and 100 then raise exception 'Selecciona entre 1 y 100 gastos.' using errcode='EV001'; end if;
  for e in select * from public.expenses where id=any(p_ids) order by id for update loop
    if e.household_id<>hid or e.created_by is distinct from auth.uid() then raise exception 'Gasto no disponible para esta cuenta.' using errcode='EV001'; end if;
    if p_event is not null and e.status<>'active' then raise exception 'Restaura el gasto antes de asociarlo.' using errcode='EV001'; end if;
    if e.event_id is not null and p_event is not null and e.event_id<>p_event and not p_replace then
      raise exception 'Hay gastos en otro evento. Confirma explícitamente su traslado.' using errcode='EV003';
    end if;
    if e.event_id=p_event and p_item is null and p_commitment is null then
      -- Repetir la asociación del evento no desvincula un pago de su contrato.
      n:=n+1;
      continue;
    end if;
    if e.event_commitment_id is not null and p_commitment is not null and e.event_commitment_id<>p_commitment and not p_replace then
      raise exception 'Hay pagos en otro compromiso. Confirma explícitamente su traslado.' using errcode='EV003';
    end if;
    update public.expenses set event_id=p_event,event_item_id=p_item,event_commitment_id=p_commitment where id=e.id;
    n:=n+1;
  end loop;
  if n<>(select count(distinct i) from unnest(p_ids) i) then raise exception 'Uno de los gastos ya no está disponible.' using errcode='EV001'; end if;
  return n;
end;
$$;

create view public.event_commitment_metrics with(security_invoker=true) as
select c.*,coalesce(p.paid,0)::numeric(14,2) as paid,
  (case when c.cancelled_at is not null then 0 else greatest(0,c.contracted_amount-coalesce(p.paid,0)) end)::numeric(14,2) as pending,
  greatest(0,coalesce(p.paid,0)-c.contracted_amount)::numeric(14,2) as overpaid,
  case when c.cancelled_at is not null then 'cancelled' when coalesce(p.paid,0)>=c.contracted_amount then 'paid' when coalesce(p.paid,0)>0 then 'partial' else 'pending' end as payment_status
from public.event_commitments c left join (
  select event_commitment_id,sum(amount) as paid from public.expenses where status='active' and event_commitment_id is not null group by event_commitment_id
) p on p.event_commitment_id=c.id;

create view public.event_item_metrics with(security_invoker=true) as
select i.*,coalesce(p.paid,0)::numeric(14,2) as paid,coalesce(c.pending,0)::numeric(14,2) as pending
from public.event_items i left join (
  select event_item_id,sum(amount) as paid from public.expenses where status='active' and event_item_id is not null group by event_item_id
) p on p.event_item_id=i.id left join (
  select event_item_id,sum(pending) as pending from public.event_commitment_metrics where event_item_id is not null group by event_item_id
) c on c.event_item_id=i.id;

create view public.event_metrics with(security_invoker=true) as
select e.*,coalesce(p.paid,0)::numeric(14,2) as paid,coalesce(p.expense_count,0) as expense_count,
  coalesce(c.pending,0)::numeric(14,2) as pending,
  (coalesce(p.paid,0)+coalesce(c.pending,0))::numeric(14,2) as projected,
  (e.budget-coalesce(p.paid,0))::numeric(14,2) as available,
  (e.budget-coalesce(p.paid,0)-coalesce(c.pending,0))::numeric(14,2) as projected_available,
  case when e.budget>0 then round(coalesce(p.paid,0)/e.budget*100,2) end as paid_percent,
  case when e.budget>0 then round((coalesce(p.paid,0)+coalesce(c.pending,0))/e.budget*100,2) end as projected_percent,
  coalesce(i.planned_total,0)::numeric(14,2) as planned_total,
  (e.budget-coalesce(i.planned_total,0))::numeric(14,2) as unplanned
from public.events e left join (
  select event_id,sum(amount) as paid,count(*) as expense_count from public.expenses where status='active' and event_id is not null group by event_id
) p on p.event_id=e.id left join (
  select event_id,sum(pending) as pending from public.event_commitment_metrics group by event_id
) c on c.event_id=e.id left join (
  select event_id,sum(planned_amount) as planned_total from public.event_items group by event_id
) i on i.event_id=e.id;
revoke all on public.event_metrics,public.event_item_metrics,public.event_commitment_metrics from public,anon,authenticated;
grant select on public.event_metrics,public.event_item_metrics,public.event_commitment_metrics to authenticated;

create function public.event_analytics(p_event uuid)
returns table(dimension text,label text,amount numeric,quantity bigint)
language sql stable security invoker set search_path='' as $$
  select v.dimension,v.label,sum(e.amount),count(*) from public.expenses e
  join public.events ev on ev.id=e.event_id
  join public.ambitos a on a.id=e.ambito_id join public.categorias c on c.id=e.categoria_id
  left join public.subcategorias s on s.id=e.subcategoria_id join public.medios_pago m on m.id=e.payment_method_id
  cross join lateral(values('ambito',a.name),('categoria',c.name),('subcategoria',coalesce(s.name,'Sin subcategoría')),('mes',to_char(e.expense_date,'YYYY-MM')),('medio',m.name)) v(dimension,label)
  where e.event_id=p_event and e.status='active' group by v.dimension,v.label order by v.dimension,sum(e.amount) desc,v.label;
$$;

-- Clonación de configuración, jamás de movimientos. El cliente entrega una clave
-- para que repetir la operación no cree dos eventos ni duplique sus conceptos.
create function public.clone_event(p_source uuid,p_values jsonb,p_key uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare src public.events%rowtype; dest uuid; item record; nuevo uuid; mapa jsonb:='{}'; prev uuid;
begin
  select * into src from public.events where id=p_source;
  if not found then raise exception 'Evento no disponible.' using errcode='EV001'; end if;
  if p_key is null then raise exception 'Falta la clave de la operación.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_key::text,0));
  -- El ID del nuevo evento es también la clave; RLS impide consultar IDs ajenos.
  select id into prev from public.events where id=p_key;
  if found then return prev; end if;
  insert into public.events(id,household_id,user_id,name,description,event_type,target_date,start_date,budget,currency,icon_key,color_token,is_template,status)
    values(p_key,src.household_id,auth.uid(),coalesce(p_values->>'name',src.name||' (copia)'),coalesce(p_values->>'description',src.description),coalesce(p_values->>'event_type',src.event_type),
      nullif(p_values->>'target_date','')::date,nullif(p_values->>'start_date','')::date,coalesce((p_values->>'budget')::numeric,src.budget),src.currency,coalesce(p_values->>'icon_key',src.icon_key),coalesce(p_values->>'color_token',src.color_token),coalesce((p_values->>'is_template')::boolean,false),coalesce(p_values->>'status','planned')) returning id into dest;
  for item in select * from public.event_items where event_id=src.id order by sort_order,id loop
    insert into public.event_items(event_id,household_id,name,planned_amount,sort_order)
      values(dest,src.household_id,item.name,item.planned_amount,item.sort_order) returning id into nuevo;
    mapa:=mapa||jsonb_build_object(item.id::text,nuevo);
  end loop;
  insert into public.event_commitments(event_id,household_id,event_item_id,name,contracted_amount,currency,notes)
    select dest,src.household_id,(mapa->>c.event_item_id::text)::uuid,c.name,c.contracted_amount,c.currency,c.notes
    from public.event_commitments c where c.event_id=src.id and c.cancelled_at is null;
  return dest;
end;
$$;

revoke all on function public.validate_expense_event(),public.validate_event_structure(),public.sync_commitment_item(),public.save_expense_event(jsonb,uuid,uuid),
  public.link_event_expenses(uuid[],uuid,uuid,uuid,boolean),public.event_analytics(uuid),public.clone_event(uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.save_expense_event(jsonb,uuid,uuid),public.link_event_expenses(uuid[],uuid,uuid,uuid,boolean),
  public.event_analytics(uuid),public.clone_event(uuid,jsonb,uuid) to authenticated;
notify pgrst,'reload schema';
