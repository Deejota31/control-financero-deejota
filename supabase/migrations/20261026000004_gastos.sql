-- Gastos, plantillas, lotes, imputaciones, auditoría e idempotencia.
-- Los gastos y sus imputaciones solo se escriben desde funciones RPC (ver migración de motor de asignación).

create extension if not exists pg_trgm with schema extensions;

create table public.expense_templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text not null check (char_length(btrim(description)) between 1 and 200),
  default_amount numeric(14,2) check (default_amount is null or default_amount > 0),
  is_amount_variable boolean not null default false,
  ambito_id uuid not null,
  categoria_id uuid not null,
  subcategoria_id uuid,
  payment_method_id uuid,
  default_fund_id uuid,
  expense_type text not null default 'fixed' check (expense_type in ('fixed', 'variable')),
  recurrence text not null default 'monthly' check (recurrence in ('monthly')),
  day_of_month integer check (day_of_month is null or day_of_month between 1 and 31),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (ambito_id, household_id) references public.ambitos (id, household_id),
  foreign key (categoria_id, ambito_id) references public.categorias (id, ambito_id),
  foreign key (subcategoria_id, categoria_id) references public.subcategorias (id, categoria_id),
  foreign key (payment_method_id, household_id) references public.medios_pago (id, household_id),
  foreign key (default_fund_id, household_id) references public.funds (id, household_id) on delete set null (default_fund_id)
);
create unique index expense_templates_name_uq on public.expense_templates (household_id, lower(btrim(name)));
create trigger expense_templates_normalize before insert or update on public.expense_templates
  for each row execute function public.normalize_name();
create trigger expense_templates_set_updated_at before update on public.expense_templates
  for each row execute function public.set_updated_at();

alter table public.expense_templates enable row level security;
create policy expense_templates_select on public.expense_templates for select to authenticated using (public.is_household_member(household_id));
create policy expense_templates_insert on public.expense_templates for insert to authenticated with check (public.is_household_member(household_id));
create policy expense_templates_update on public.expense_templates for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy expense_templates_delete on public.expense_templates for delete to authenticated using (public.is_household_member(household_id));

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  expense_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'PEN' check (currency = 'PEN'),
  description text not null check (char_length(btrim(description)) between 1 and 200),
  ambito_id uuid not null,
  categoria_id uuid not null,
  subcategoria_id uuid,
  payment_method_id uuid not null,
  expense_type text not null default 'variable' check (expense_type in ('fixed', 'variable')),
  is_recurring boolean not null default false,
  status text not null default 'active' check (status in ('active', 'annulled')),
  notes text check (notes is null or char_length(notes) <= 500),
  receipt_path text,
  template_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  annulled_at timestamptz,
  annulled_by uuid references auth.users (id) on delete set null,
  unique (id, household_id),
  check ((status = 'annulled') = (annulled_at is not null)),
  -- Jerarquía coherente: la categoría pertenece al ámbito y la subcategoría a la categoría.
  foreign key (ambito_id, household_id) references public.ambitos (id, household_id),
  foreign key (categoria_id, ambito_id) references public.categorias (id, ambito_id),
  foreign key (subcategoria_id, categoria_id) references public.subcategorias (id, categoria_id),
  foreign key (payment_method_id, household_id) references public.medios_pago (id, household_id),
  foreign key (template_id, household_id) references public.expense_templates (id, household_id) on delete set null (template_id)
);
create index expenses_household_date_idx on public.expenses (household_id, expense_date desc);
create index expenses_household_status_date_idx on public.expenses (household_id, status, expense_date);
create index expenses_ambito_idx on public.expenses (ambito_id);
create index expenses_categoria_idx on public.expenses (categoria_id);
create index expenses_subcategoria_idx on public.expenses (subcategoria_id) where subcategoria_id is not null;
create index expenses_payment_idx on public.expenses (payment_method_id);
create index expenses_template_idx on public.expenses (template_id) where template_id is not null;
create index expenses_description_trgm on public.expenses using gin (description extensions.gin_trgm_ops);
create trigger expenses_set_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();

create table public.expense_fund_allocations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  expense_id uuid not null,
  fund_id uuid not null,
  period_id uuid not null,
  amount numeric(14,2) not null check (amount > 0),
  allocation_kind text not null check (allocation_kind in ('specific', 'general')),
  created_at timestamptz not null default now(),
  foreign key (expense_id, household_id) references public.expenses (id, household_id) on delete cascade,
  foreign key (fund_id, household_id) references public.funds (id, household_id),
  foreign key (period_id, household_id) references public.budget_periods (id, household_id)
);
create index allocations_expense_idx on public.expense_fund_allocations (expense_id);
create index allocations_period_fund_idx on public.expense_fund_allocations (period_id, fund_id);

-- La suma de las imputaciones de un gasto activo debe ser igual a su importe (se valida al cerrar la transacción).
create function public.check_allocation_sum()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  eid uuid;
  v_amount numeric;
  v_status text;
  v_sum numeric;
begin
  if tg_table_name = 'expenses' then
    eid := new.id;
  elsif tg_op = 'DELETE' then
    eid := old.expense_id;
  else
    eid := new.expense_id;
  end if;
  select amount, status into v_amount, v_status from public.expenses where id = eid;
  if not found then
    return null; -- el gasto ya no existe (borrado en cascada)
  end if;
  select coalesce(sum(amount), 0) into v_sum from public.expense_fund_allocations where expense_id = eid;
  if v_status = 'active' and v_sum <> v_amount then
    raise exception 'La suma de imputaciones (%) no coincide con el gasto (%).', v_sum, v_amount using errcode = '23514';
  end if;
  if v_status = 'annulled' and v_sum <> 0 then
    raise exception 'Un gasto anulado no puede tener imputaciones.' using errcode = '23514';
  end if;
  return null;
end;
$$;
create constraint trigger expenses_allocation_sum
  after insert or update on public.expenses
  deferrable initially deferred for each row execute function public.check_allocation_sum();
create constraint trigger allocations_allocation_sum
  after insert or update or delete on public.expense_fund_allocations
  deferrable initially deferred for each row execute function public.check_allocation_sum();

-- Registro mensual por lote.
create table public.template_batches (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  period_id uuid not null,
  executed_by uuid references auth.users (id) on delete set null,
  status text not null default 'completed' check (status in ('completed')),
  expense_count integer not null default 0 check (expense_count >= 0),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  unique (id, household_id),
  unique (household_id, idempotency_key),
  foreign key (period_id, household_id) references public.budget_periods (id, household_id)
);

create table public.template_batch_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  batch_id uuid not null,
  template_id uuid not null references public.expense_templates (id) on delete cascade,
  outcome text not null check (outcome in ('included', 'excluded', 'not_applicable')),
  expense_id uuid references public.expenses (id) on delete set null,
  amount numeric(14,2),
  created_at timestamptz not null default now(),
  foreign key (batch_id, household_id) references public.template_batches (id, household_id) on delete cascade
);
create index template_batch_items_batch_idx on public.template_batch_items (batch_id);
create index template_batch_items_template_idx on public.template_batch_items (template_id);

-- Auditoría: solo lectura para el propietario; se escribe desde triggers.
create table public.audit_logs (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  entity text not null,
  entity_id uuid,
  action text not null,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_household_idx on public.audit_logs (household_id, created_at desc);

create function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_action text := lower(tg_op);
begin
  if tg_table_name = 'expenses' and tg_op = 'UPDATE' and v_old ->> 'status' is distinct from v_new ->> 'status' then
    v_action := case v_new ->> 'status' when 'annulled' then 'annul' else 'restore' end;
  end if;
  insert into public.audit_logs (household_id, user_id, entity, entity_id, action, before_state, after_state)
  values ((v_row ->> 'household_id')::uuid, (select auth.uid()), tg_table_name, (v_row ->> 'id')::uuid, v_action, v_old, v_new);
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['ambitos', 'categorias', 'subcategorias', 'medios_pago', 'funds', 'fund_period_budgets', 'expense_templates', 'expenses', 'budget_periods'] loop
    execute format('create trigger %I after insert or delete on public.%I for each row execute function public.audit_trigger()', t || '_audit_id', t);
    execute format('create trigger %I after update on public.%I for each row when (old.* is distinct from new.*) execute function public.audit_trigger()', t || '_audit_u', t);
  end loop;
end $$;

create table public.idempotency_requests (
  household_id uuid not null references public.households (id) on delete cascade,
  key uuid not null,
  operation text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (household_id, key, operation)
);

do $$
declare
  t text;
begin
  foreach t in array array['expenses', 'expense_fund_allocations', 'template_batches', 'template_batch_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_household_member(household_id))', t || '_select', t);
    execute format('revoke insert, update, delete on public.%I from authenticated, anon', t);
  end loop;
end $$;

alter table public.audit_logs enable row level security;
create policy audit_logs_select on public.audit_logs for select to authenticated using (public.is_household_owner(household_id));
revoke insert, update, delete on public.audit_logs from authenticated, anon;

alter table public.idempotency_requests enable row level security;
revoke all on public.idempotency_requests from authenticated, anon;
