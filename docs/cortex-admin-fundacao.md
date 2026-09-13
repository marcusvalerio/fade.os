# CORTEX ADMIN — fundação (V1)

Camada de autorização de **plataforma**, separada do multi-tenancy das
barbearias. Ser owner/admin de uma company não concede nada aqui, e este
nível não depende de nenhum vínculo em `user_company_role`.

```
CORTEX.OS
│
├── APP OPERACIONAL          (já existia — RLS por company_id)
│   └── empresas / barbearias
│
└── CORTEX ADMIN             (novo — RLS por is_platform_admin())
    ├── /admin              Visão geral
    ├── /admin/empresas     Leitura cross-company
    ├── /admin/acessos      Fila de solicitações Beta
    ├── /admin/usuarios     Contas + gestão de platform admin
    └── /admin/auditoria    platform_audit_log
```

---

## 1. Auditoria do mecanismo existente (antes de implementar)

Antes de desenhar qualquer coisa, o mecanismo de autorização já em produção
foi lido por inteiro:

- `has_company_management_access(company_id)` — `STABLE SECURITY DEFINER`,
  checa `user_company_role`/`role`, usado tanto em policies de RLS quanto
  chamado da aplicação via `.rpc()`.
- `write_audit_log(...)` — `SECURITY DEFINER`, recusa ser chamada como RPC
  de primeiro nível (checagem de `pg_context`), exige `company_id in
  my_company_ids()`.
- `lib/permissions.ts`/`lib/tenancy.ts` — `requireCompanyManager`,
  `TenancyError`, o comentário que já dizia a frase que guiou este trabalho:
  "esconder o link na navegação não protege nada".
- `lib/supabase/middleware.ts` — `PRIVATE_ROOTS`, uma lista de prefixos que
  só exige sessão; a autorização fina (gerente vs. staff) sempre foi
  checada na própria página/Server Action, nunca no middleware.

**Decisão de arquitetura**: reaproveitar o padrão inteiro
(RLS + SECURITY DEFINER + Server Action que checa de novo), não inventar um
segundo jeito de fazer autorização. A única coisa nova é o que se
autoriza — plataforma em vez de empresa — não como se autoriza.

`audit_log` foi avaliado e **não reaproveitado**: `company_id` é `NOT NULL`
e a leitura é escopada por `has_company_management_access`, ou seja, é uma
tabela desenhada para nunca existir sem empresa. Fingir uma empresa para
gravar eventos de plataforma foi explicitamente proibido — por isso
`platform_audit_log` é uma tabela própria, do tamanho exato do que este
nível precisa (7 colunas, sem nada além do que os eventos listados exigem).

---

## 2. Modelo de dados

### `platform_admin`

```sql
platform_admin (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','revoked')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
)
```

- **1:1 com `auth.users`**: a chave primária é o próprio `user_id`.
- **RLS ligada, sem grant de INSERT/UPDATE/DELETE para `anon`/`authenticated`**
  — a única forma de escrever é dentro de `grant_platform_admin`/
  `revoke_platform_admin`, que rodam como dono da tabela (`SECURITY DEFINER`)
  e cada uma reexige `is_platform_admin(auth.uid())` antes de fazer
  qualquer coisa.
- SELECT: só quem já é platform admin ativo vê a lista.

### `is_platform_admin(p_user_id uuid default auth.uid())`

Mesmo desenho de `has_company_management_access`: `STABLE SECURITY DEFINER`,
chamável de dentro de policies de RLS (sem recursão — roda como dono da
tabela) e do código via `.rpc("is_platform_admin")`.

### `platform_audit_log`

```sql
platform_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),   -- null = visitante anônimo
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  reason text,
  created_at timestamptz not null default now()
)
```

Só gravável via `write_platform_audit_log(...)`, que recusa ser chamada
como RPC de primeiro nível (mesma checagem de `pg_context` que
`write_audit_log` já usa). Sem checagem de `is_platform_admin` **dentro**
dela de propósito: quem decide se a chamada é legítima é cada função que
grava — `submit_beta_access_request` é pública por desenho (visitante
anônimo tem `actor_id = null`), as de aprovação/revogação/concessão já
exigem platform admin antes de chegar aqui.

### `beta_access_requests`

```sql
beta_access_requests (
  id, email, name, barbershop_name, phone,
  status text check (status in ('pending','approved','rejected','revoked')),
  created_at, approved_at, approved_by,
  rejected_at, rejected_by, revoked_at, revoked_by
)
```

- E-mail sempre comparado normalizado (`lower(btrim(email))`).
- Índice único **parcial** em `lower(btrim(email))` só para `status='pending'`
  — impede duas solicitações abertas do mesmo e-mail, mas permite solicitar
  de novo depois de uma rejeição/revogação.
- RLS: sem grant de escrita para `anon`/`authenticated`. A única porta de
  entrada é `submit_beta_access_request(...)` (pública, chamável por `anon`);
  aprovar/rejeitar/revogar são RPCs próprias, cada uma exigindo platform
  admin e validando a transição de status (`pending→approved`,
  `pending→rejected`, `approved→revoked`).

### Leituras cross-company

`admin_list_companies()` e `admin_list_users()` — `SECURITY DEFINER`,
checam `is_platform_admin` por dentro, devolvem só a projeção mínima
(nunca `encrypted_password`, tokens ou metadata bruto de `auth.users`). A
RLS de `company`/`professional`/`user_company_role` **continua igual a
antes** — um platform admin não vira membro de nenhuma empresa; estas duas
funções são a única porta de leitura cross-tenant, com escopo mínimo e
explícito, não uma função genérica que aceita qualquer `company_id`.

---

## 3. Bootstrap do primeiro Platform Admin

Não existe (e não deveria existir) um caminho dentro do app para o primeiro
platform admin se conceder o próprio acesso — seria exatamente o "botão
público tornar admin" que a rodada pediu para não criar. O caminho seguro é
uma operação manual, uma única vez, fora do app, direto no banco:

```sql
insert into platform_admin (user_id, created_by)
select id, id from auth.users where email = '<email da pessoa>';
```

Isso precisa ser rodado com acesso privilegiado ao Postgres do projeto
(SQL Editor do painel do Supabase, ou qualquer credencial com esse nível —
nunca a chave anônima do app). Não depende de
`SUPABASE_SERVICE_ROLE_KEY` — é uma inserção direta no banco, não uma
chamada à Auth Admin API.

**Esta rodada não executou esse insert de verdade.** Localizei, por meio do
projeto Supabase real, uma conta já existente que corresponde ao seu
próprio e-mail (`contatomarcusjr@gmail.com`) — candidata natural para o
primeiro platform admin, mas a decisão de qual conta recebe esse acesso não
é minha para tomar sozinho. Confirme o e-mail e eu rodo o insert acima
diretamente (tenho acesso ao banco por esta sessão) — ou você mesmo roda no
SQL Editor do Supabase, se preferir manter o controle total desse passo.

---

## 4. Proteção de rotas — evidência, não suposição

`middleware.ts`/`lib/supabase/middleware.ts` ganhou `/admin` em
`PRIVATE_ROOTS` — isso garante só que ninguém deslogado chega perto
(confirmado ao vivo: `curl -I /admin` sem sessão devolve `307` para
`/login`). A autorização de verdade (`is_platform_admin`) é checada em
`app/admin/layout.tsx` — se falhar, a página "Acesso restrito" renderiza
**no lugar** do conteúdo administrativo, que nunca chega a ser buscado — e
de novo, independentemente, em cada Server Action de
`actions/platform-admin.ts`/`actions/beta.ts`, porque uma Server Action é
um endpoint HTTP e pode ser chamada direto, sem passar pela tela.

### Testado contra o banco real (transações sempre revertidas)

| Ator | `is_platform_admin()` | `admin_list_companies()` | `grant_platform_admin()` | INSERT direto em `platform_admin` |
|---|---|---|---|---|
| `anon` | bloqueado (sem grant) | bloqueado (sem grant) | bloqueado (sem grant) | bloqueado (RLS) |
| `staff` (NORTE 21) | `false` | `FORBIDDEN` | `FORBIDDEN` | bloqueado (RLS) |
| `owner` real (NORTE 21) | `false` | `FORBIDDEN` | `FORBIDDEN` (nem a si mesmo) | bloqueado (RLS) |
| **platform admin** (bootstrap simulado) | `true` | 3 empresas | ok (segundo usuário real testado) | — |

Também confirmado nesta bateria:
- `revoke_platform_admin` recusa revogar **a si mesmo**
  (`NAO_PODE_REVOGAR_A_SI_MESMO`) — evita um único platform admin se
  trancar para fora sem querer.
- `submit_beta_access_request` funciona para `anon` (é a porta pública por
  desenho); `approve/reject/revoke_beta_access_request` bloqueados para
  `owner`.
- Duplicidade de e-mail pendente bloqueada mesmo com maiúscula/espaço
  diferentes (`SOLICITACAO_JA_EXISTE`), graças à normalização + índice
  único parcial.
- Todas as 5 mutações relevantes (`platform_admin_granted/revoked`,
  `beta_request_created/approved/rejected/revoked`) geraram linha em
  `platform_audit_log` na mesma transação.

Um bug real foi encontrado e corrigido durante este teste:
`admin_list_users()` falhava (`structure of query does not match function
result type`) porque `auth.users.email` é `character varying(255)`, não
`text` — corrigido com `u.email::text`.

### Testado ao vivo contra a aplicação publicada

```
GET /beta (sem sessão) ........................... 200
GET /admin (sem sessão) ........................... 307 → /login
POST /beta (formulário real, e-mail de teste) ..... "Solicitação recebida"
  → linha real criada em beta_access_requests (status=pending)
  → linha real criada em platform_audit_log (beta_request_created)
  → ambas removidas depois, por serem só teste
```

**Não testado ao vivo**: a tela autorizada de `/admin` com uma sessão de
platform admin de verdade — testar isso exigiria logar como
`contatomarcusjr@gmail.com` de verdade, o que depende da senha real dessa
conta (que não está e não deveria estar disponível para esta sessão). A
autorização foi provada de forma equivalente, e mais rigorosa, direto no
banco (tabela acima) — mas fica registrado como limitação de evidência
visual, não como "testado".

---

## 5. UX / design

Layout próprio em `app/admin/`, não uma cópia do shell operacional:
cabeçalho `GlassSurface tone="shell"` (mesma superfície do app, Creeping
Depth invariante por tema) com o wordmark CORTEX.OS (Panchang, único lugar
onde ela aparece) seguido de um rótulo "Admin" em caixa alta — nunca um
segundo wordmark inventado. Números editoriais (Visão geral) usam Supreme
(`font-heading`); toda a interface operacional (nav, listas, botões) usa
Geist, a fonte padrão do produto. Estados vazios reaproveitam `<Vazio>` — a
mesma peça usada em todo o app operacional — em vez de inventar um "empty
state" novo. Confirmação de ação sensível (aprovar/rejeitar/revogar Beta,
conceder/revogar platform admin) reaproveita o padrão de
`CancelSaleButton` (Modal + motivo obrigatório + toast de sucesso), agora
como um componente único (`ConfirmActionButton`) para não repetir cinco
modais quase idênticos.

Nenhuma tela do app operacional foi redesenhada. Nenhum gradiente, nenhum
glass fora do já existente, nenhuma métrica inventada — os quatro números
da Visão geral vêm de `admin_list_companies()`/`admin_list_users()`/
`beta_access_requests`, nada estimado.

---

## 6. O que fica fora desta rodada (de propósito)

- **Convite + criação de senha pelo usuário aprovado.** `approve_beta_access_request`
  só muda o status. Conectar a um envio de e-mail de convite e a um fluxo
  de "criar conta" é a próxima etapa natural, e depende de decidir como o
  convite chega até a pessoa — não inventado aqui.
- **CRUD de empresas.** Só leitura. Nenhuma ação destrutiva.
- **Edição de permissão operacional de empresa a partir do CORTEX ADMIN.**
  `/admin/usuarios` só concede/revoga *platform admin* — nunca papel dentro
  de uma company.
- **Link de acesso ao CORTEX ADMIN dentro do app operacional.** Por ora, a
  rota se acessa direto (`/admin`) — não foi adicionado nenhum item de menu
  na navegação das barbearias, para não misturar os dois níveis
  visualmente antes de decidir se isso deve existir.
