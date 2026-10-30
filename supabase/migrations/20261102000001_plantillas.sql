-- Plantillas reutilizables: gastos (notas) y fondos (biblioteca global del hogar, sin período).
-- Una plantilla es una configuración, no un movimiento ni un fondo asignado: guardarla no afecta saldos, consumos ni indicadores.
-- Una instancia de fondo (funds) sigue perteneciendo a UN mes; template_id solo registra de qué plantilla salió, para no duplicarla en el mes.

alter table public.expense_templates add column notes text check (notes is null or char_length(notes) <= 500);

create table public.fund_templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  description text check (description is null or char_length(description) <= 300),
  icon_key text check (icon_key is null or public.is_valid_icon(icon_key)),
  color_token text check (color_token is null or public.is_valid_color(color_token)),
  is_general boolean not null default false,
  suggested_amount numeric(14,2) not null default 0 check (suggested_amount >= 0),
  priority integer not null default 100,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id)
);
create unique index fund_templates_name_uq on public.fund_templates (household_id, lower(btrim(name)));
create trigger fund_templates_normalize before insert or update on public.fund_templates for each row execute function public.normalize_name();
create trigger fund_templates_set_updated_at before update on public.fund_templates for each row execute function public.set_updated_at();

create table public.fund_template_scope_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  template_id uuid not null,
  ambito_id uuid,
  categoria_id uuid,
  subcategoria_id uuid,
  effect text not null check (effect in ('include', 'exclude')),
  created_at timestamptz not null default now(),
  check (num_nonnulls(ambito_id, categoria_id, subcategoria_id) = 1),
  foreign key (template_id, household_id) references public.fund_templates (id, household_id) on delete cascade,
  foreign key (ambito_id, household_id) references public.ambitos (id, household_id) on delete cascade,
  foreign key (categoria_id, household_id) references public.categorias (id, household_id) on delete cascade,
  foreign key (subcategoria_id, household_id) references public.subcategorias (id, household_id) on delete cascade
);
create index fund_template_scope_rules_idx on public.fund_template_scope_rules (template_id);

create table public.fund_template_payment_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  template_id uuid not null,
  payment_method_id uuid not null,
  effect text not null check (effect in ('include', 'exclude')),
  created_at timestamptz not null default now(),
  unique (template_id, payment_method_id),
  foreign key (template_id, household_id) references public.fund_templates (id, household_id) on delete cascade,
  foreign key (payment_method_id, household_id) references public.medios_pago (id, household_id) on delete cascade
);
create index fund_template_payment_rules_idx on public.fund_template_payment_rules (template_id);

alter table public.fund_templates enable row level security;
alter table public.fund_template_scope_rules enable row level security;
alter table public.fund_template_payment_rules enable row level security;
create policy fund_templates_select on public.fund_templates for select to authenticated using (public.is_household_member(household_id));
create policy fund_templates_update on public.fund_templates for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy fund_templates_delete on public.fund_templates for delete to authenticated using (public.is_household_member(household_id));
create policy fund_template_scope_rules_select on public.fund_template_scope_rules for select to authenticated using (public.is_household_member(household_id));
create policy fund_template_payment_rules_select on public.fund_template_payment_rules for select to authenticated using (public.is_household_member(household_id));
-- Altas y reglas solo por save_fund_template (valida y es atómica).
revoke insert on public.fund_templates from authenticated, anon;
revoke insert, update, delete on public.fund_template_scope_rules, public.fund_template_payment_rules from authenticated, anon;

alter table public.funds add column template_id uuid;
alter table public.funds add constraint funds_template_fk foreign key (template_id, household_id) references public.fund_templates (id, household_id) on delete set null (template_id);
create unique index funds_template_once on public.funds (period_id, template_id) where template_id is not null;

-- Crea o edita una plantilla de fondo con sus reglas. p: id?, name, description, icon_key, color_token, is_general, suggested_amount, priority, is_active, scope_rules[], payment_rules[]
create function public.save_fund_template(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hid uuid := public.current_household_id();
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_rule jsonb;
  v_general boolean;
begin
  if v_hid is null then raise exception 'Sesión no válida.' using errcode = '28000'; end if;
  if exists (select 1 from public.fund_templates where household_id = v_hid and lower(btrim(name)) = lower(btrim(p ->> 'name')) and id is distinct from v_id) then
    raise exception 'Ya existe una plantilla de fondo con ese nombre.' using errcode = 'GD010';
  end if;
  if v_id is null then
    insert into public.fund_templates (household_id, name, description, icon_key, color_token, is_general, suggested_amount, priority, is_active, sort_order)
    values (v_hid, p ->> 'name', nullif(p ->> 'description', ''), nullif(p ->> 'icon_key', ''), nullif(p ->> 'color_token', ''),
      coalesce((p ->> 'is_general')::boolean, false), coalesce((p ->> 'suggested_amount')::numeric, 0), coalesce((p ->> 'priority')::int, 100),
      coalesce((p ->> 'is_active')::boolean, true), (select coalesce(max(sort_order), 0) + 1 from public.fund_templates where household_id = v_hid))
    returning id into v_id;
  else
    update public.fund_templates set
      name = coalesce(p ->> 'name', name),
      description = case when p ? 'description' then nullif(p ->> 'description', '') else description end,
      icon_key = case when p ? 'icon_key' then nullif(p ->> 'icon_key', '') else icon_key end,
      color_token = case when p ? 'color_token' then nullif(p ->> 'color_token', '') else color_token end,
      is_general = coalesce((p ->> 'is_general')::boolean, is_general),
      suggested_amount = coalesce((p ->> 'suggested_amount')::numeric, suggested_amount),
      priority = coalesce((p ->> 'priority')::int, priority),
      is_active = coalesce((p ->> 'is_active')::boolean, is_active)
    where id = v_id and household_id = v_hid;
    if not found then raise exception 'Plantilla no encontrada.' using errcode = 'GD004'; end if;
  end if;

  if p ? 'scope_rules' then
    delete from public.fund_template_scope_rules where template_id = v_id;
    for v_rule in select * from jsonb_array_elements(p -> 'scope_rules') loop
      insert into public.fund_template_scope_rules (household_id, template_id, ambito_id, categoria_id, subcategoria_id, effect)
      values (v_hid, v_id,
        case when v_rule ->> 'kind' = 'ambito' then (v_rule ->> 'ref')::uuid end,
        case when v_rule ->> 'kind' = 'categoria' then (v_rule ->> 'ref')::uuid end,
        case when v_rule ->> 'kind' = 'subcategoria' then (v_rule ->> 'ref')::uuid end,
        v_rule ->> 'effect');
    end loop;
  end if;
  if p ? 'payment_rules' then
    delete from public.fund_template_payment_rules where template_id = v_id;
    for v_rule in select * from jsonb_array_elements(p -> 'payment_rules') loop
      insert into public.fund_template_payment_rules (household_id, template_id, payment_method_id, effect)
      values (v_hid, v_id, (v_rule ->> 'method')::uuid, v_rule ->> 'effect');
    end loop;
  end if;

  select is_general into v_general from public.fund_templates where id = v_id;
  if not v_general and not exists (select 1 from public.fund_template_scope_rules where template_id = v_id and effect = 'include') then
    raise exception 'Un fondo específico necesita al menos un ámbito, categoría o subcategoría incluido.' using errcode = 'GD006';
  end if;
  return v_id;
end;
$$;
revoke all on function public.save_fund_template(jsonb) from public, anon;
grant execute on function public.save_fund_template(jsonb) to authenticated;

-- Crea en un mes abierto una instancia independiente por plantilla elegida. p_items: [{template_id, amount?, name?}].
-- Nunca duplica (una plantilla por mes), respeta el único Fondo General activo del mes y no toca otros meses ni la plantilla.
-- Una plantilla que no se pueda aplicar queda en «skipped» con su motivo; el resto se crea. Recalcula el mes una sola vez.
create function public.apply_fund_templates(p_period uuid, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hid uuid := public.current_household_id();
  v_item jsonb;
  t public.fund_templates%rowtype;
  v_new uuid;
  v_name text;
  v_amount numeric;
  v_priority int;
  v_created jsonb := '[]'::jsonb;
  v_skipped jsonb := '[]'::jsonb;
begin
  if v_hid is null then raise exception 'Sesión no válida.' using errcode = '28000'; end if;
  if not exists (select 1 from public.budget_periods where id = p_period and household_id = v_hid) then
    raise exception 'Período no encontrado.' using errcode = 'GD004';
  end if;
  if exists (select 1 from public.budget_periods where id = p_period and status = 'closed') then
    raise exception 'El período está cerrado: su histórico no se modifica.' using errcode = 'GD002';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    select * into t from public.fund_templates where id = (v_item ->> 'template_id')::uuid and household_id = v_hid;
    if not found then
      v_skipped := v_skipped || jsonb_build_object('template_id', v_item ->> 'template_id', 'name', null, 'reason', 'not_found');
      continue;
    end if;
    v_name := coalesce(nullif(btrim(v_item ->> 'name'), ''), t.name);
    v_amount := coalesce((v_item ->> 'amount')::numeric, t.suggested_amount);
    if v_amount < 0 then raise exception 'El importe no puede ser negativo.' using errcode = 'GD010'; end if;

    if not t.is_active then
      v_skipped := v_skipped || jsonb_build_object('template_id', t.id, 'name', t.name, 'reason', 'inactive');
    elsif exists (select 1 from public.funds where period_id = p_period and template_id = t.id) then
      v_skipped := v_skipped || jsonb_build_object('template_id', t.id, 'name', t.name, 'reason', 'already_applied');
    elsif exists (select 1 from public.funds where period_id = p_period and household_id = v_hid and lower(btrim(name)) = lower(btrim(v_name))) then
      v_skipped := v_skipped || jsonb_build_object('template_id', t.id, 'name', t.name, 'reason', 'name_exists');
    elsif t.is_general and exists (select 1 from public.funds where period_id = p_period and household_id = v_hid and is_general and is_active) then
      v_skipped := v_skipped || jsonb_build_object('template_id', t.id, 'name', t.name, 'reason', 'general_exists');
    elsif not t.is_general and not exists (select 1 from public.fund_template_scope_rules where template_id = t.id and effect = 'include') then
      v_skipped := v_skipped || jsonb_build_object('template_id', t.id, 'name', t.name, 'reason', 'invalid_rules');
    else
      -- La prioridad sugerida se respeta salvo que ya la use otro fondo específico del mes: entonces va al final.
      v_priority := case
        when not t.is_general and exists (select 1 from public.funds where period_id = p_period and household_id = v_hid and not is_general and priority = t.priority)
          then (select max(priority) + 1 from public.funds where period_id = p_period and household_id = v_hid and not is_general)
        else t.priority end;
      insert into public.funds (household_id, period_id, name, description, icon_key, color_token, is_general, default_amount, priority, is_active, template_id)
      values (v_hid, p_period, v_name, t.description, t.icon_key, t.color_token, t.is_general, v_amount, v_priority, true, t.id)
      returning id into v_new;
      insert into public.fund_period_budgets (household_id, fund_id, period_id, assigned_amount) values (v_hid, v_new, p_period, v_amount);
      insert into public.fund_scope_rules (household_id, fund_id, ambito_id, categoria_id, subcategoria_id, effect)
        select v_hid, v_new, ambito_id, categoria_id, subcategoria_id, effect from public.fund_template_scope_rules where template_id = t.id;
      insert into public.fund_payment_rules (household_id, fund_id, payment_method_id, effect)
        select v_hid, v_new, payment_method_id, effect from public.fund_template_payment_rules where template_id = t.id;
      v_created := v_created || jsonb_build_object('template_id', t.id, 'id', v_new, 'name', v_name, 'amount', v_amount);
    end if;
  end loop;

  if jsonb_array_length(v_created) > 0 then
    perform public.recalc_period(p_period);
  end if;
  return jsonb_build_object('created', v_created, 'skipped', v_skipped);
end;
$$;
revoke all on function public.apply_fund_templates(uuid, jsonb) from public, anon;
grant execute on function public.apply_fund_templates(uuid, jsonb) to authenticated;

-- save_fund: una instancia creada desde una plantilla queda vinculada a ella (template_id); el resto de la función no cambia.
create or replace function public.save_fund(p jsonb, p_dry_run boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hid uuid := public.current_household_id();
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_period uuid;
  v_amount numeric;
  v_before jsonb;
  v_after jsonb;
  v_cons_before jsonb;
  v_cons_after jsonb;
  v_blocked text;
  v_rule jsonb;
begin
  if v_hid is null then raise exception 'Sesión no válida.' using errcode = '28000'; end if;
  v_before := public.alloc_signature(v_hid);
  v_cons_before := public.open_consumption(v_hid);

  begin
    if v_id is null then
      v_period := nullif(p ->> 'period_id', '')::uuid;
      if v_period is null then raise exception 'Indica el mes al que pertenece el fondo.' using errcode = 'GD004'; end if;
      if not exists (select 1 from public.budget_periods where id = v_period and household_id = v_hid) then
        raise exception 'Período no encontrado.' using errcode = 'GD004';
      end if;
      if exists (select 1 from public.budget_periods where id = v_period and status = 'closed') then
        raise exception 'El período está cerrado.' using errcode = 'GD002';
      end if;
      v_amount := coalesce((p ->> 'period_amount')::numeric, (p ->> 'default_amount')::numeric, 0);
      insert into public.funds (household_id, period_id, name, description, icon_key, color_token, is_general, default_amount, priority, is_active, template_id)
      values (
        v_hid, v_period, p ->> 'name', nullif(p ->> 'description', ''), nullif(p ->> 'icon_key', ''), nullif(p ->> 'color_token', ''),
        coalesce((p ->> 'is_general')::boolean, false), v_amount,
        coalesce((p ->> 'priority')::int, 100), coalesce((p ->> 'is_active')::boolean, true),
        nullif(p ->> 'template_id', '')::uuid
      ) returning id into v_id;
      insert into public.fund_period_budgets (household_id, fund_id, period_id, assigned_amount) values (v_hid, v_id, v_period, v_amount);
    else
      select period_id into v_period from public.funds where id = v_id and household_id = v_hid;
      if v_period is null then raise exception 'Fondo no encontrado.' using errcode = 'GD004'; end if;
      if exists (select 1 from public.budget_periods where id = v_period and status = 'closed') then
        raise exception 'El período está cerrado: su histórico no se modifica.' using errcode = 'GD002';
      end if;
      update public.funds set
        name = coalesce(p ->> 'name', name),
        description = case when p ? 'description' then nullif(p ->> 'description', '') else description end,
        icon_key = case when p ? 'icon_key' then nullif(p ->> 'icon_key', '') else icon_key end,
        color_token = case when p ? 'color_token' then nullif(p ->> 'color_token', '') else color_token end,
        is_general = coalesce((p ->> 'is_general')::boolean, is_general),
        default_amount = coalesce((p ->> 'default_amount')::numeric, default_amount),
        priority = coalesce((p ->> 'priority')::int, priority),
        is_active = coalesce((p ->> 'is_active')::boolean, is_active)
      where id = v_id and household_id = v_hid;
      if nullif(p ->> 'period_amount', '') is not null then
        insert into public.fund_period_budgets (household_id, fund_id, period_id, assigned_amount)
        values (v_hid, v_id, v_period, (p ->> 'period_amount')::numeric)
        on conflict (fund_id, period_id) do update set assigned_amount = excluded.assigned_amount;
      end if;
    end if;

    if p ? 'scope_rules' then
      delete from public.fund_scope_rules where fund_id = v_id;
      for v_rule in select * from jsonb_array_elements(p -> 'scope_rules') loop
        insert into public.fund_scope_rules (household_id, fund_id, ambito_id, categoria_id, subcategoria_id, effect)
        values (
          v_hid, v_id,
          case when v_rule ->> 'kind' = 'ambito' then (v_rule ->> 'ref')::uuid end,
          case when v_rule ->> 'kind' = 'categoria' then (v_rule ->> 'ref')::uuid end,
          case when v_rule ->> 'kind' = 'subcategoria' then (v_rule ->> 'ref')::uuid end,
          v_rule ->> 'effect'
        );
      end loop;
    end if;
    if p ? 'payment_rules' then
      delete from public.fund_payment_rules where fund_id = v_id;
      for v_rule in select * from jsonb_array_elements(p -> 'payment_rules') loop
        insert into public.fund_payment_rules (household_id, fund_id, payment_method_id, effect)
        values (v_hid, v_id, (v_rule ->> 'method')::uuid, v_rule ->> 'effect');
      end loop;
    end if;

    if not exists (select 1 from public.funds where id = v_id and is_general)
       and not exists (select 1 from public.fund_scope_rules where fund_id = v_id and effect = 'include') then
      raise exception 'Un fondo específico necesita al menos un ámbito, categoría o subcategoría incluido.' using errcode = 'GD006';
    end if;

    -- Solo se recalcula el mes del fondo: los demás meses no se tocan.
    perform public.recalc_period(v_period);

    v_after := public.alloc_signature(v_hid);
    v_cons_after := public.open_consumption(v_hid);
    if p_dry_run then
      raise exception 'simulacion' using errcode = 'GD999';
    end if;
  exception when others then
    if sqlstate = 'GD999' then
      null;
    elsif p_dry_run and sqlstate = 'GD001' then
      v_blocked := sqlerrm;
    else
      raise;
    end if;
  end;

  return jsonb_build_object(
    'fund_id', v_id,
    'period_id', v_period,
    'dry_run', p_dry_run,
    'blocked', v_blocked,
    'changed_expenses', case when v_blocked is null then public.count_changed(v_before, v_after) else null end,
    'consumption_before', v_cons_before,
    'consumption_after', case when v_blocked is null then v_cons_after else null end
  );
end;
$$;
