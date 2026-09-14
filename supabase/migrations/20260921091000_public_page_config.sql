-- P1.3/P1.4/P1.5/P1.6 — a página pública da barbearia deixa de mostrar só
-- nome/endereço/telefone: ganha imagem de capa (com ponto focal, não corte
-- automático arriscado), Instagram, e um onboarding opcional de 2 páginas
-- (apresentação + diferenciais). Tudo aditivo e nullable — nenhuma barbearia
-- existente muda de comportamento até o dono configurar algo em
-- /configuracoes. Nada aqui é específico da NORTE 21: é estrutura para
-- QUALQUER empresa preencher (ou não).
--
-- Ponto focal (x/y em 0..1) em vez de recorte de pixels: a imagem nunca é
-- reprocessada no servidor (sem pipeline de imagem nesta rodada), e
-- `object-fit: cover` + `object-position: {x}% {y}%` já resolve
-- proporção/enquadramento/responsividade com um único padrão reutilizável
-- em qualquer contexto de imagem (capa, apresentação, diferenciais).

alter table public.company
  add column if not exists instagram text,
  add column if not exists cover_image_url text,
  add column if not exists cover_image_focal_x numeric(4,3) not null default 0.5,
  add column if not exists cover_image_focal_y numeric(4,3) not null default 0.5,
  add column if not exists public_onboarding_enabled boolean not null default false,
  add column if not exists public_intro_title text,
  add column if not exists public_intro_text text,
  add column if not exists public_intro_image_url text,
  add column if not exists public_intro_image_focal_x numeric(4,3) not null default 0.5,
  add column if not exists public_intro_image_focal_y numeric(4,3) not null default 0.5,
  add column if not exists public_highlights_title text,
  add column if not exists public_highlights_text text,
  add column if not exists public_highlights_image_url text,
  add column if not exists public_highlights_image_focal_x numeric(4,3) not null default 0.5,
  add column if not exists public_highlights_image_focal_y numeric(4,3) not null default 0.5,
  add constraint company_cover_focal_x_range check (cover_image_focal_x >= 0 and cover_image_focal_x <= 1),
  add constraint company_cover_focal_y_range check (cover_image_focal_y >= 0 and cover_image_focal_y <= 1),
  add constraint company_intro_focal_x_range check (public_intro_image_focal_x >= 0 and public_intro_image_focal_x <= 1),
  add constraint company_intro_focal_y_range check (public_intro_image_focal_y >= 0 and public_intro_image_focal_y <= 1),
  add constraint company_highlights_focal_x_range check (public_highlights_image_focal_x >= 0 and public_highlights_image_focal_x <= 1),
  add constraint company_highlights_focal_y_range check (public_highlights_image_focal_y >= 0 and public_highlights_image_focal_y <= 1);

comment on column public.company.instagram is 'Handle ou URL do Instagram da barbearia, exibido na página pública. Nunca obrigatório.';
comment on column public.company.cover_image_url is 'Imagem de capa (hero) da página pública — formato largo, distinta do logo_url (que continua sendo o ícone/avatar quadrado).';
comment on column public.company.public_onboarding_enabled is 'Liga/desliga a apresentação de 2 páginas antes do agendamento público. Desativado por padrão: sem essa configuração, o cliente cai direto em Serviço→Profissional→Data→Horário.';

-- get_public_company ganha as novas colunas — mesma função, mesmo contrato
-- de segurança (SECURITY DEFINER, só o que a barbearia decidiu tornar
-- público). Precisa DROP porque o conjunto de colunas de retorno mudou.
drop function if exists public.get_public_company(text);

create or replace function public.get_public_company(p_slug text)
returns table (
  company_id uuid,
  name text,
  trade_name text,
  logo_url text,
  phone text,
  whatsapp text,
  instagram text,
  address text,
  city text,
  state text,
  cover_image_url text,
  cover_image_focal_x numeric,
  cover_image_focal_y numeric,
  public_onboarding_enabled boolean,
  public_intro_title text,
  public_intro_text text,
  public_intro_image_url text,
  public_intro_image_focal_x numeric,
  public_intro_image_focal_y numeric,
  public_highlights_title text,
  public_highlights_text text,
  public_highlights_image_url text,
  public_highlights_image_focal_x numeric,
  public_highlights_image_focal_y numeric,
  unit_id uuid,
  unit_name text,
  unit_address text,
  unit_phone text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    c.id, c.name, c.trade_name, c.logo_url, c.phone, c.whatsapp, c.instagram,
    c.address, c.city, c.state,
    c.cover_image_url, c.cover_image_focal_x, c.cover_image_focal_y,
    c.public_onboarding_enabled,
    c.public_intro_title, c.public_intro_text, c.public_intro_image_url,
    c.public_intro_image_focal_x, c.public_intro_image_focal_y,
    c.public_highlights_title, c.public_highlights_text, c.public_highlights_image_url,
    c.public_highlights_image_focal_x, c.public_highlights_image_focal_y,
    u.id, u.name, u.address, u.phone
  from public.company c
  left join lateral (
    select id, name, address, phone
    from public.unit
    where unit.company_id = c.id and unit.status = 'active'
    order by created_at
    limit 1
  ) u on true
  where c.slug = public.slugify(p_slug);
$$;

revoke all on function public.get_public_company(text) from public;
grant execute on function public.get_public_company(text) to anon, authenticated;
