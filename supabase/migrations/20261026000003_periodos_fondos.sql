-- Períodos y fondos presupuestales.
-- Las tablas que afectan asignaciones (períodos, fondos, reglas, presupuestos) son de solo lectura para el cliente:
-- todo cambio pasa por funciones RPC que recalculan de forma atómica.

create table public.budget_periods (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, household_id),
  unique (household_id, start_date),
  check (end_date >= start_date),
  check ((status = 'closed') = (closed_at is not null))
);

create table public.funds (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  description text check (description is null or char_length(description) <= 300),
  icon_key text check (icon_key is null or public.is_valid_icon(icon_key)),
  color_token text check (color_token is null or public.is_valid_color(color_token)),
  is_general boolean not null default false,
  default_amount numeric(14,2) not null default 0 check (default_amount >= 0),
  priority integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id)
);
create unique index funds_name_uq on public.funds (household_id, lower(btrim(name)));
-- Como máximo un Fondo General activo por hogar.
create unique index funds_one_active_general on public.funds (household_id) where is_general and is_active;

create trigger funds_normalize before insert or update on public.funds
  for each row execute function public.normalize_name();
create trigger funds_set_updated_at before update on public.funds
  for each row execute function public.set_updated_at();

create table public.fund_period_budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  fund_id uuid not null,
  period_id uuid not null,
  assigned_amount numeric(14,2) not null default 0 check (assigned_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fund_id, period_id),
  foreign key (fund_id, household_id) references public.funds (id, household_id) on delete cascade,
  foreign key (period_id, household_id) references public.budget_periods (id, household_id) on delete cascade
);
create trigger fund_period_budgets_set_updated_at before update on public.fund_period_budgets
  for each row execute function public.set_updated_at();

-- Reglas de cobertura por clasificación: exactamente un nivel por regla.
create table public.fund_scope_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  fund_id uuid not null,
  ambito_id uuid,
  categoria_id uuid,
  subcategoria_id uuid,
  effect text not null check (effect in ('include', 'exclude')),
  created_at timestamptz not null default now(),
  check (num_nonnulls(ambito_id, categoria_id, subcategoria_id) = 1),
  foreign key (fund_id, household_id) references public.funds (id, household_id) on delete cascade,
  foreign key (ambito_id, household_id) references public.ambitos (id, household_id) on delete cascade,
  foreign key (categoria_id, household_id) references public.categorias (id, household_id) on delete cascade,
  foreign key (subcategoria_id, household_id) references public.subcategorias (id, household_id) on delete cascade
);
create index fund_scope_rules_fund_idx on public.fund_scope_rules (fund_id);

create table public.fund_payment_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  fund_id uuid not null,
  payment_method_id uuid not null,
  effect text not null check (effect in ('include', 'exclude')),
  created_at timestamptz not null default now(),
  unique (fund_id, payment_method_id),
  foreign key (fund_id, household_id) references public.funds (id, household_id) on delete cascade,
  foreign key (payment_method_id, household_id) references public.medios_pago (id, household_id) on delete cascade
);
create index fund_payment_rules_fund_idx on public.fund_payment_rules (fund_id);

-- Resultado congelado de cada período cerrado.
create table public.period_fund_snapshots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  period_id uuid not null,
  fund_id uuid not null references public.funds (id) on delete cascade,
  fund_name text not null,
  is_general boolean not null,
  assigned_amount numeric(14,2) not null,
  consumed_amount numeric(14,2) not null,
  created_at timestamptz not null default now(),
  unique (period_id, fund_id),
  foreign key (period_id, household_id) references public.budget_periods (id, household_id) on delete cascade
);

do $$
declare
  t text;
begin
  foreach t in array array['budget_periods', 'funds', 'fund_period_budgets', 'fund_scope_rules', 'fund_payment_rules', 'period_fund_snapshots'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_household_member(household_id))', t || '_select', t);
    execute format('revoke insert, update, delete on public.%I from authenticated, anon', t);
  end loop;
end $$;
