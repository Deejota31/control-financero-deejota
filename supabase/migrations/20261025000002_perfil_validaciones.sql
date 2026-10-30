-- Perfil: formato de fecha acotado y updated_at automático.

alter table public.profiles
  add constraint profiles_formato_fecha_check
  check (formato_fecha in ('dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd'));

alter table public.profiles
  add constraint profiles_zona_horaria_check
  check (char_length(zona_horaria) between 1 and 64);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
