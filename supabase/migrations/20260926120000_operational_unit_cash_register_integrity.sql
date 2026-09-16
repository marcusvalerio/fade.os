-- Toda unidade operacional precisa ter seu caixa físico criado junto.
-- O onboarding antigo criava a unidade e tentava criar o cash_register em uma
-- segunda chamada, ignorando a falha. Isso permitia uma unidade "pronta" sem
-- caixa. O trigger torna a relação atômica no próprio banco.

create or replace function public.ensure_unit_cash_register()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.cash_register (company_id, unit_id)
  values (new.company_id, new.id)
  on conflict (unit_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_unit_ensure_cash_register on public.unit;
create trigger trg_unit_ensure_cash_register
after insert on public.unit
for each row execute function public.ensure_unit_cash_register();

-- Corrige unidades antigas que ficaram sem caixa. Não duplica caixas já
-- existentes por causa do mesmo unique(unit_id) usado pelo trigger.
insert into public.cash_register (company_id, unit_id)
select u.company_id, u.id
from public.unit u
where not exists (
  select 1 from public.cash_register cr where cr.unit_id = u.id
)
on conflict (unit_id) do nothing;
