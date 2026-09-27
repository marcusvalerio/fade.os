# Autenticação do CORTEX.OS

Estado verificado em 27/09/2026, na branch `claude/fade-os-pre-pilot-update-7znkqj`,
contra o projeto Supabase `xaxszgyvapvzwensbjjq`.

## Formas de entrar

| Forma | Quem usa | Onde está |
|---|---|---|
| E-mail e senha | dono e gerência | `actions/auth.ts` (`signIn`), aba **Com e-mail** |
| Identificador + senha | barbeiros e recepção | `actions/auth.ts` (`signIn`, modo `professional`), aba **Sou profissional** |
| Google | dono e gerência | `app/login/BotaoGoogle.tsx` |

Apple não é usada: não há botão nem lógica para ela. WhatsApp não é forma de
login. O cliente final da barbearia não tem login (o link de agendamento por
token não é conta).

## Google

Fluxo nativo do Supabase Auth, sem implementação própria de OAuth e sem nenhum
segredo no navegador ou no repositório:

1. `/login` → **Continuar com o Google** → `signInWithOAuth({ provider: "google",
   redirectTo: <origem>/auth/oauth-callback })` (PKCE).
2. Supabase → Google (`redirect_uri` =
   `https://xaxszgyvapvzwensbjjq.supabase.co/auth/v1/callback`).
3. Google → Supabase → `<origem>/auth/oauth-callback?code=…`.
4. `app/auth/oauth-callback/route.ts` troca o código por sessão e manda para
   `/` (a mesma porta do login por e-mail: onboarding ou agenda). Sem código,
   código inválido ou login cancelado → `/login?error=oauth`.

O botão só aparece quando o provedor está ligado no Supabase
(`lib/auth-provedores.ts` lê `GET /auth/v1/settings`, revalidado a cada 5 min).

`app/auth/callback/route.ts` é outra rota: serve só à recuperação de senha
(ver `recuperacao-de-senha.md`).

### Configuração no Supabase

Verificado pelo endpoint público e pelo redirecionamento real ao Google:

- Provedor Google **ligado** (`external.google: true`).
- Client ID de aplicativo web do Google Cloud; o Google aceita o cliente e o
  `redirect_uri` acima (abre a tela "Prosseguir para
  xaxszgyvapvzwensbjjq.supabase.co").
- **Site URL**: `https://fadeos-five.vercel.app`.
- **Redirect URLs** aceitas hoje: `https://fadeos-five.vercel.app/auth/oauth-callback`.
  `http://localhost:*` e as URLs de Preview da Vercel **não** estão na lista:
  o Supabase troca o destino pela Site URL e o login pelo Google, iniciado
  dali, não conclui.

Não verificável por fora do painel (conferir em Authentication → Providers →
Google): **Skip nonce checks** desligado e **Allow users without an email**
desligado.

Para o Google funcionar localmente e nos Previews, adicionar em
Authentication → URL Configuration → Redirect URLs:

- `http://localhost:3000/auth/oauth-callback`
- `https://cortex-*-meji-projects.vercel.app/auth/oauth-callback` (cobre os Previews por commit, `cortex-<hash>-…`, e o alias da branch, `cortex-os-git-…`)

## Variáveis

Só as públicas do Supabase: `NEXT_PUBLIC_SUPABASE_URL` e
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. O Client Secret do Google fica apenas no
painel do Supabase.

## Sessão, rotas e saída

- Sessão em cookies `sb-<projeto>-auth-token` (`@supabase/ssr`), renovada no
  `middleware.ts` (`lib/supabase/middleware.ts`).
- Rotas do produto sem sessão → `/login`; `/login` com sessão → `/`.
- **Sair** (`signOut`) encerra a sessão e volta para `/login`.

## Entrada CORTEX■OS

O login (e-mail, profissional ou Google) marca o cookie `cortex-entrada` (2 min,
`lib/entrada.ts`). O layout do produto lê o cookie no servidor e manda a
sequência da marca já no HTML (`components/entrada-cortex.tsx`, 900 ms). O
componente apaga o cookie ao montar: a sequência roda uma vez por login, nunca
ao navegar ou recarregar. A camada tem `pointer-events: none`. Com
`prefers-reduced-motion: reduce` ela fica com `display: none` e o produto abre
direto. Erro de senha ou retorno do Google sem sessão apagam o cookie.
