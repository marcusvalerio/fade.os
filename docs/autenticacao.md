# Autenticação do CORTEX.OS

Estado verificado em 27/09/2026, na branch `claude/fade-os-pre-pilot-update-7znkqj`,
contra o projeto Supabase `xaxszgyvapvzwensbjjq`.

## Duas portas, um Supabase Auth

| Quem | Onde entra | Formas | Código |
|---|---|---|---|
| Equipe — dono e gerência | `/login`, aba **Com e-mail** | e-mail e senha | `actions/auth.ts` (`signIn`) |
| Equipe — barbeiros e recepção | `/login`, aba **Sou profissional** | identificador + senha | `actions/auth.ts` (`signIn`, modo `professional`) |
| Cliente final da barbearia | `/[slug]/entrar` | e-mail e senha **ou** Google | `actions/cliente.ts`, `app/[slug]/entrar/` |

- **Equipe: só e-mail (ou identificador) e senha.** `/login` não tem Google
  nem Apple. A conta de quem administra a barbearia não nasce de um clique
  social.
- **Cliente: e-mail e senha ou Google.** O Google só aparece em
  `/[slug]/entrar`, e só quando o provedor está ligado no Supabase
  (`lib/auth-provedores.ts` lê `GET /auth/v1/settings`, revalidado a cada
  5 min).
- **Apple não é usada** em lugar nenhum. WhatsApp não é forma de login.
- O link de agendamento por token (`/[slug]/agendamentos/[token]`) continua
  existindo para quem marca sem conta; ele não é uma conta.

## Separação entre equipe e cliente

É o mesmo Supabase Auth — o que separa é o vínculo:

- **Equipe** = linha em `user_company_role` (e, para profissionais,
  `professional_access`). É isso que o RLS de todas as tabelas da operação
  usa (`my_company_ids()`).
- **Cliente** = linha em `client_identity (user_id, company_id, client_id)`,
  única por `(user_id, company_id)`. Ela não aparece em `my_company_ids()`:
  ser cliente não dá leitura de nada da operação.

Regras (migrations `20260928090000_agenda_disponibilidade_e_identidade_do_cliente.sql`
e `20260928092000_barbearias_do_cliente.sql`):

- `link_client_identity(p_slug, p_name, p_phone)` — cria ou devolve o vínculo
  da pessoa autenticada com a barbearia. **Exige e-mail confirmado**
  (`EMAIL_NAO_CONFIRMADO`). Procura o cliente da barbearia pelo e-mail
  (sem diferenciar maiúsculas); se não existir, cria. Nunca vincula por
  telefone.
- `get_my_client_appointments(p_slug)` — os horários do próprio cliente.
- `create_client_appointment(...)` — agendamento com o cliente vindo da
  identidade; as mesmas validações do agendamento público
  (`assert_appointment_slot_valid`, exclusão de sobreposição).
- `get_my_client_barbershops()` — em quais barbearias a pessoa é cliente.
- Todas são `security definer` com `search_path` fixo e `grant execute` só a
  `authenticated` (revogado de `public` e `anon`). RLS de `client_identity`:
  lê a própria linha, ou as da própria barbearia (equipe).

Guardas no app:

- Quem é **só cliente** (tem `client_identity` e nenhum vínculo de equipe) é
  levado para `/[slug]/minha-conta` em `/`, no layout do produto e no
  onboarding (`lib/cliente-conta.ts`, `destinoDoClienteSemEquipe`); o
  onboarding recusa criar barbearia para essa conta.
- **Sessão aberta pelo Google não entra na gestão** (`lib/supabase/middleware.ts`
  + `lib/metodo-de-entrada.ts`). O Supabase liga as formas de entrar pelo
  e-mail verificado: alguém da equipe que use "Continuar com o Google" na área
  do cliente recebe uma sessão da mesma conta. O middleware lê a claim `amr`
  do access token; se o método for `oauth` e a rota for do produto,
  onboarding ou admin:
  - só cliente → `/[slug]/minha-conta` (a sessão continua);
  - qualquer outro caso → encerra **só esta sessão** (`signOut({ scope: "local" })`)
    e manda para `/login?error=metodo`, com o aviso "A gestão da barbearia
    entra só com e-mail e senha…".
  Recuperação de senha (`recovery`) e confirmação de e-mail não são `oauth` e
  não são afetadas.

## Google (só cliente)

Fluxo nativo do Supabase Auth, sem OAuth próprio e sem segredo no navegador
ou no repositório:

1. `/[slug]/entrar` → **Continuar com o Google** → a action
   `prepararEntradaGoogle` grava o cookie httpOnly `cortex-cliente` (slug da
   barbearia, 24 h) → `signInWithOAuth({ provider: "google", redirectTo:
   <origem>/auth/oauth-callback })` (PKCE).
2. Supabase → Google (`redirect_uri` =
   `https://xaxszgyvapvzwensbjjq.supabase.co/auth/v1/callback`).
3. Google → Supabase → `<origem>/auth/oauth-callback?code=…`.
4. `app/auth/oauth-callback/route.ts` troca o código por sessão e volta para
   `/<slug>/minha-conta` (slug do cookie; se o cookie não existir, o
   `cliente_slug` dos metadados do cadastro; senão `/`). O slug é validado
   (`^[a-z0-9-]{1,80}$`) — nunca vira redirecionamento aberto. Falha →
   `/<slug>/entrar?erro=retorno` (ou `/login` sem slug). O cookie é apagado.
5. `/[slug]/minha-conta` faz o vínculo (`link_client_identity`) na primeira
   visita.

A mesma rota recebe o link de confirmação do cadastro de cliente por e-mail
(`emailRedirectTo` = `<origem>/auth/oauth-callback`).

`app/auth/callback/route.ts` é outra rota: serve só à recuperação de senha
(ver `recuperacao-de-senha.md`).

### Configuração no Supabase

Verificado pelo endpoint público e pelo redirecionamento real ao Google:

- Provedor Google **ligado** (`external.google: true`).
- Client ID de aplicativo web do Google Cloud; o Google aceita o cliente e o
  `redirect_uri` acima.
- **Site URL**: `https://fadeos-five.vercel.app`.
- **Redirect URLs** aceitas hoje: `https://fadeos-five.vercel.app/auth/oauth-callback`.
  `http://localhost:*` e as URLs de Preview da Vercel **não** estão na lista:
  o Supabase troca o destino pela Site URL e o login pelo Google (e o link de
  confirmação do cadastro), iniciado dali, não conclui no mesmo ambiente.

Para funcionar localmente e nos Previews, adicionar em Authentication → URL
Configuration → Redirect URLs:

- `http://localhost:3000/auth/oauth-callback`
- `https://cortex-*-meji-projects.vercel.app/auth/oauth-callback`

Não verificável por fora do painel (conferir em Authentication → Providers →
Google): **Skip nonce checks** desligado e **Allow users without an email**
desligado.

### E-mail de confirmação do cadastro de cliente

O cadastro de cliente por e-mail exige confirmar o e-mail (o vínculo só nasce
com e-mail confirmado). O envio usa o SMTP padrão do Supabase, que tem limite
baixo por hora ("Muitas tentativas"): para o piloto com clientes reais,
configurar um SMTP próprio em Authentication → Emails → SMTP Settings.

## Variáveis

Só as públicas do Supabase: `NEXT_PUBLIC_SUPABASE_URL` e
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. O Client Secret do Google fica apenas no
painel do Supabase.

## Sessão, rotas e saída

- Sessão em cookies `sb-<projeto>-auth-token` (`@supabase/ssr`), renovada no
  `middleware.ts` (`lib/supabase/middleware.ts`).
- Rotas do produto sem sessão → `/login`; `/login` com sessão → `/`.
- **Sair** da equipe (`signOut`) volta para `/login`; **Sair** do cliente
  (`sairDaContaDeCliente`) volta para a página da barbearia.

## Entrada CORTEX■OS

O login da equipe (e-mail ou profissional) marca o cookie `cortex-entrada`
(2 min, `lib/entrada.ts`). O layout do produto lê o cookie no servidor e manda
a sequência da marca já no HTML (`components/entrada-cortex.tsx`, 900 ms). O
componente apaga o cookie ao montar: a sequência roda uma vez por login, nunca
ao navegar ou recarregar. A camada tem `pointer-events: none`. Com
`prefers-reduced-motion: reduce` ela fica com `display: none` e o produto abre
direto. Erro de senha apaga o cookie.
