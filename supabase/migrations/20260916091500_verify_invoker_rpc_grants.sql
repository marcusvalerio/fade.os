-- FADE OS — R21: guarda de regressão para o P0 de venda/atendimento.
--
-- Idempotente e permanente: roda toda vez que as migrations são replayed
-- (reset local, ambiente novo, CI). Se uma migration futura revogar de
-- novo EXECUTE de `authenticated` em qualquer uma das três funções que
-- create_pdv_sale/close_attendance chamam internamente — o mesmo engano
-- do R15 — o db reset falha imediatamente aqui, em vez de silenciosamente
-- quebrar venda e atendimento outra vez. Verifica também que `anon`
-- continua sem acesso a nenhuma delas.
do $$
begin
  if not has_function_privilege('authenticated', 'public.apply_stock_delta(uuid, uuid, text, uuid, numeric)', 'EXECUTE') then
    raise exception 'REGRESSAO_P0_R21: authenticated perdeu EXECUTE em apply_stock_delta — create_pdv_sale/close_attendance vão falhar com 42501.';
  end if;
  if not has_function_privilege('authenticated', 'public.authorize_operation(uuid, text, text)', 'EXECUTE') then
    raise exception 'REGRESSAO_P0_R21: authenticated perdeu EXECUTE em authorize_operation — desconto com código vai falhar com 42501.';
  end if;
  if not has_function_privilege('authenticated', 'public.write_audit_log(uuid, text, text, uuid, jsonb, jsonb, text)', 'EXECUTE') then
    raise exception 'REGRESSAO_P0_R21: authenticated perdeu EXECUTE em write_audit_log — create_pdv_sale/close_attendance vão falhar com 42501.';
  end if;

  if has_function_privilege('anon', 'public.apply_stock_delta(uuid, uuid, text, uuid, numeric)', 'EXECUTE')
     or has_function_privilege('anon', 'public.authorize_operation(uuid, text, text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.write_audit_log(uuid, text, text, uuid, jsonb, jsonb, text)', 'EXECUTE')
  then
    raise exception 'REGRESSAO_SEGURANCA_R21: anon ganhou EXECUTE em uma função interna que deveria ficar protegida.';
  end if;
end;
$$;
