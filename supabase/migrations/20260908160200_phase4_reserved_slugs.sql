-- FADE OS — Fase 4: novas rotas administrativas reservadas (vendas,
-- comissões, kpis) — mesma lista mantida em lib/slug.ts.
insert into public.reserved_slug (slug) values ('vendas'), ('comissoes'), ('kpis'), ('relatorios')
on conflict (slug) do nothing;
