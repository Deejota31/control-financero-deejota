-- Gestor de plantillas: grupos propios para las de fondos, orden manual atómico y prioridad propuesta editable al aplicar.

alter table public.fund_templates add column group_name text check (group_name is null or char_length(btrim(group_name)) between 1 and 40);

-- Guarda el orden manual (sort_order) de plantillas. p_kind: 'expense' | 'fund'. Es solo presentación: no cambia categoría, ámbito ni prioridad financiera.
create function public.reorder_templates(p_kind text, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hid uuid := public.current_household_id();
begin
  if v_hid is null then raise exception 'Sesión no válida.' using errcode = '28000'; end if;
  if p_kind = 'expense' then
    update public.expense_templates t set sort_order = x.n from unnest(p_ids) with ordinality as x(id, n) where t.id = x.id and t.household_id = v_hid;
  elsif p_kind = 'fund' then
    update public.fund_templates t set sort_order = x.n from unnest(p_ids) with ordinality as x(id, n) where t.id = x.id and t.household_id = v_hid;
  else
    raise exception 'Tipo de plantilla no válido.' using errcode = 'GD010';
  end if;
end;
$$;
revoke all on function public.reorder_templates(text, uuid[]) from public, anon;
grant execute on function public.reorder_templates(text, uuid[]) to authenticated;

-- apply_fund_templates: cada ítem puede traer una prioridad propuesta (priority) confirmada por la persona; sin ella se usa la de la plantilla resuelta contra el mes.
create or replace function public.apply_fund_templates(p_period uuid, p_items jsonb)
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
        when nullif(v_item ->> 'priority', '') is not null then (v_item ->> 'priority')::int
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
