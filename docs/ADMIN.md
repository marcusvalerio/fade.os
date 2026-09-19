# CORTEX ADMIN

Superfície de **plataforma** — administração e observabilidade do CORTEX.OS
como um todo, distinta do produto operacional que cada barbearia usa
(`app/(app)/**`). Este documento substitui `docs/cortex-admin-fundacao.md`
(V1, histórico, mantido por registro) como referência corrente: descreve o
que existe de fato hoje, não o que foi desenhado.

```
CORTEX.OS
│
├── APP OPERACIONAL          RLS por company_id — cada barbearia só vê a si
│   └── app/(app)/**
│
└── CORTEX ADMIN             RLS por is_platform_admin() — cross-tenant
    └── app/admin/**
```

Ser owner/admin/staff de uma empresa não concede nada aqui. Este nível não
depende de nenhum vínculo em `user_company_role` — a fonte de verdade é a
tabela `platform_admin`.

---

## 1. Achado crítico desta rodada: drift entre migrations e banco real

**O mais importante deste documento.** Antes de qualquer alteração de UI,
uma auditoria estática (grep em `supabase/migrations/*.sql`) concluiu que
`admin_get_company_detail`, `admin_suspend_company`, `admin_reactivate_company`
e as colunas `company.status`/`suspended_at`/`suspension_reason` **não
existiam em nenhuma migration versionada** — o que levaria a crer que o
detalhe de empresa e a suspensão estavam quebrados (chamando RPCs
inexistentes) e a uma primeira rodada de correção que os removeu.

**Essa conclusão estava errada.** Uma consulta direta ao banco Supabase
real do projeto (`xaxszgyvapvzwensbjjq`, via MCP) mostrou que essas quatro
funções e as três colunas **existem e funcionam no banco em produção**,
com a assinatura exata que o código já esperava:

```
admin_get_company_detail(p_company_id uuid) returns jsonb
admin_suspend_company(p_company_id uuid, p_reason text) returns void
admin_reactivate_company(p_company_id uuid, p_reason text default null) returns void
admin_list_companies() returns table(..., status text, suspended_at timestamptz, suspension_reason text)
```

Ou seja: **em algum momento anterior, essas mudanças de schema foram
aplicadas diretamente no banco de produção sem que a migration
correspondente fosse commitada no repositório.** A correção que este
documento aplicou foi reverter a primeira rodada (que teria apagado uma
funcionalidade real e funcionando) e manter o código original intacto —
`app/admin/empresas/page.tsx`, `app/admin/empresas/[id]/page.tsx`,
`app/admin/empresas/[id]/CompanyActions.tsx` e as funções `suspendCompany`/
`reactivateCompany` em `actions/platform-admin.ts` **não foram alteradas**
nesta rodada.

**Isto fica registrado como uma lacuna real, não corrigida aqui:** sem uma
migration commitada, um ambiente novo criado a partir de
`supabase/migrations/` (um clone local, uma reconstrução do banco, uma
migração de infraestrutura futura) **não teria** essas quatro funções nem
essas três colunas — o detalhe de empresa e a suspensão quebrariam
silenciosamente nesse ambiente. Corrigir isso exige escrever e aplicar uma
migration que apenas *documenta* o que já existe (não uma mudança de
comportamento) — deliberadamente **não feito nesta rodada**, por estar fora
do escopo autorizado ("nenhuma alteração de Supabase/banco"). Recomendação
para uma rodada futura: gerar essa migration a partir do schema real
(`pg_dump`/introspecção) e commitá-la, sem alterar nenhuma definição.

**Lição de processo:** qualquer auditoria futura desta superfície deve
confirmar contra o banco real (Supabase MCP ou equivalente), nunca só
contra os arquivos de migration locais — os dois já divergiram uma vez.

---

## 2. Boundary CORTEX.OS × CORTEX ADMIN

| | CORTEX.OS (produto) | CORTEX ADMIN |
|---|---|---|
| Rota | `/`, `/agenda`, `/caixa`, `/configuracoes`, ... | `/admin/**` |
| RLS | por `company_id` | por `is_platform_admin()` |
| Shell | `app/(app)/layout.tsx` — nome da empresa, unidade, módulos do produto | `app/admin/layout.tsx` — sidebar própria, sem nome de empresa nenhuma |
| Configurações | `/configuracoes` — da empresa logada | `/admin/configuracoes` — da plataforma, informativo |
| Quem acessa | qualquer usuário vinculado a uma empresa | só quem está em `platform_admin` com `status='active'` |

Nenhuma tela do produto operacional foi alterada nesta rodada.

---

## 3. Arquitetura de informação

```
CORTEX ADMIN
├── Visão geral        /admin
├── Empresas
│   ├── Empresas        /admin/empresas
│   ├── Detalhe         /admin/empresas/[id]
│   ├── Acessos Beta    /admin/acessos
│   ├── Assinaturas     /admin/assinaturas
│   └── Transações      /admin/transacoes
├── Contas
│   ├── Usuários        /admin/usuarios
│   ├── Sessões         /admin/usuarios/sessoes
│   └── Permissões      /admin/usuarios/permissoes
├── Observabilidade
│   ├── System Health   /admin/sistema
│   ├── Erros           /admin/erros
│   ├── Webhooks        /admin/webhooks
│   ├── Jobs / Workers  /admin/jobs
│   └── Uso             /admin/uso
└── Governança
    ├── Segurança       /admin/auditoria
    └── Configurações   /admin/configuracoes
```

Duas divergências deliberadas da IA-alvo pedida, e por quê:

- **"Acessos Beta" não está listado na IA-alvo**, mas é o pipeline mais
  crítico e mais real que existe no CORTEX ADMIN (provisiona conta +
  empresa de verdade). Mantido como item de primeira classe dentro do
  grupo Empresas, porque aprovar um Beta *é* criar um tenant.
- **"Segurança" reaproveita a rota `/admin/auditoria`** em vez de uma nova
  `/admin/seguranca`, para não quebrar `revalidatePath("/admin/auditoria")`
  já usado por `actions/platform-admin.ts`. O rótulo na navegação mudou
  para "Segurança"; a URL não.

---

## 4. Estado real por área

| Área | Estado | Fonte de dado |
|---|---|---|
| Visão geral | **Real** | `admin_list_companies()`, `admin_list_users()`, `beta_access_requests`, checagens de saúde ao vivo |
| Empresas (lista) | **Real** | `admin_list_companies()` — inclui `status` (ver §1) |
| Empresas (detalhe) | **Real** | `admin_get_company_detail(p_company_id)` — RPC existe no banco, não na migration versionada (ver §1) |
| Suspender/reativar empresa | **Real** | `admin_suspend_company`/`admin_reactivate_company` — mesma ressalva do §1 |
| Acessos Beta | **Real** | `beta_access_requests` + pipeline de aprovação/provisionamento completo |
| Assinaturas | **Parcial, honesto** | Não existe billing (sem Stripe, sem tabela `subscription`). Mostra o único ciclo real — o período de Beta — rotulado como tal, nunca como "plano pago" |
| Transações | **Estrutural** | Não conectado — não existe leitura administrativa cross-empresa de vendas/pagamentos |
| Usuários | **Real** | `admin_list_users()` + `platform_admin` |
| Sessões | **Estrutural, parcialmente real** | Não existe lista de sessões (Supabase Auth não expõe isso); mostra o único dado real disponível, `last_sign_in_at` |
| Permissões | **Real (descritivo)** | Descreve os dois níveis reais (`platform_admin`, `user_company_role.role`); não cria um terceiro sistema |
| System Health | **Parcial, real onde é possível** | API/Database/Authentication: checagem ao vivo, latência medida agora. Storage/Email/Payments/Webhooks: "Não conectado", porque genuinamente não há integração |
| Erros | **Estrutural** | Não conectado — sem Sentry ou equivalente no código |
| Webhooks | **Estrutural** | Não conectado — nenhum endpoint inbound existe |
| Jobs / Workers | **Estrutural** | Não conectado — sem fila/cron/Edge Function agendada |
| Uso | **Parcial, real** | Sem telemetria de requests/API/storage; mostra contagem real de usuários/profissionais por empresa |
| Segurança | **Real (parcial)** | `platform_audit_log` é real e completo para decisões administrativas; tentativas de login falhas, sessões e IP/dispositivo não são registrados |
| Configurações | **Informativo** | Sem `platform_settings`; mostra ambiente/projeto, nenhum campo editável |

---

## 5. Autorização — inalterada nesta rodada

`platform_admin` (tabela) + `is_platform_admin()` (SECURITY DEFINER) +
`requirePlatformAdmin()` (`lib/platform-permissions.ts`), checado no
`layout.tsx` e de novo em cada Server Action — nada disso foi tocado.
Middleware garante só que existe sessão (`PRIVATE_ROOTS`); a autorização
fina continua na página/Server Action. Ver `docs/cortex-admin-fundacao.md`
para a auditoria original desse mecanismo (ainda válida).

Existe hoje **1 platform admin ativo** no banco de produção (confirmado
via consulta direta, sem expor quem).

---

## 6. Componentes novos desta rodada

- `app/admin/admin-nav.ts` — configuração única da IA (grupos + rotas),
  consumida pela sidebar e pelo seletor mobile.
- `app/admin/AdminNavLinks.tsx` — `AdminSidebarNav` (desktop/tablet
  ≥1024px) e `AdminMobileNav` (abaixo disso) — nunca as duas juntas.
- `app/admin/StatusIndicator.tsx` — vocabulário único de saúde
  (Operacional/Degradado/Fora do ar/Desconhecido/Não conectado).
- `app/admin/UnavailableTable.tsx` — a forma compartilhada de "esta área
  não tem backend ainda": cabeçalho real, zero linha fabricada, motivo
  explícito. Reaproveitado por Erros/Webhooks/Jobs/Transações.
- `lib/platform-health.ts` — checagens reais (não simuladas) de
  API/Database/Authentication, com latência medida na hora.

Reaproveitados sem alteração de comportamento: `PageHeader`, `Surface`/
`SurfaceRow`, `Badge`, `Vazio`/`Aviso`, `StatGrid`/`StatTile`, `GlassSurface`,
`Wordmark`, `ToastProvider`, `ConfirmActionButton`, `Modal`, `Field`/`Input`.
Nenhuma fonte nova; Panchang só no wordmark, Geist no resto — igual ao
resto do produto.

---

## 7. O que fica fora desta rodada (de propósito)

- **A migration faltante do §1** — capturar o schema já real em uma
  migration commitada. Não é uma mudança de banco; é documentar uma que já
  aconteceu. Recomendado para a próxima rodada de manutenção.
- **Billing real (Stripe ou equivalente)** — Assinaturas/Transações
  continuam sem esse backend; a UI está pronta para receber.
- **Observabilidade real (Sentry, health checks contínuos, webhooks
  inbound, fila/jobs)** — todas essas áreas são green-field; nada foi
  fabricado para parecer que existem.
- **RPC administrativa para uso operacional por empresa** (clientes,
  agendamentos, vendas de uma empresa específica, cross-tenant) — o
  detalhe de empresa mostra hoje só o que `admin_get_company_detail` já
  devolve.
- **CRUD de empresa além de suspender/reativar** — permanece só leitura
  fora dessas duas ações, como já era.
- **ARCH 3** — nenhuma migração de infraestrutura (Neon, Cloudflare,
  Better Auth) foi iniciada ou considerada aqui.
