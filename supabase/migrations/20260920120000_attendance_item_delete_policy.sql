-- P0.9: permitir remover um item do atendimento lançado por engano, antes
-- da conclusão. Faltava política de DELETE em attendance_item — sem ela,
-- RLS nega por padrão e nenhuma remoção era possível pela aplicação.
--
-- Seguro por integridade: estoque e comissão só nascem em close_attendance()
-- (nenhum dos dois é tocado ao adicionar/remover item antes disso), e a
-- trigger trg_attendance_item_immutable já bloqueia qualquer DELETE quando
-- attendance.status = 'completed' — esta policy só abre a porta que a
-- trigger continua guardando.
create policy attendance_item_delete on public.attendance_item
  for delete
  using (
    exists (
      select 1 from public.attendance at
      where at.id = attendance_item.attendance_id
        and at.company_id in (select my_company_ids())
    )
  );
