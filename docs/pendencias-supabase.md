# Pendências que exigem o conector do Supabase

Tudo o que está aqui depende de ler ou alterar o banco real, e ficou para uma sessão com o conector disponível. Nenhuma migration foi aplicada nesta etapa.

## Diagnóstico da Fase 0 (feito em leitura, 30/09/2026)

- **RLS e grants:** `notificacao`, `notificacao_entrega`, `beta_access_requests`, `platform_admin` e `platform_audit_log` com RLS ligado. `authenticated` só tem SELECT em `notificacao`, `beta_access_requests`, `platform_admin` e `platform_audit_log`, sempre filtrado por `is_platform_admin(auth.uid())` (e por `user_id` na notificação). `notificacao_entrega` não tem política nem grant: só funções internas escrevem e leem. `anon`: nada.
- **Triggers:** `notificar_beta_solicitacao` (insert), `resolver_notificacoes_beta` (update de status), `notificacao_entrega_acordar`, `notificar_mudanca_de_admin`.
- **Jobs (pg_cron):** 7 ativos, todos com sucesso nas últimas 24 h (envio de push, lembretes, comunicados, limpeza, verificações da plataforma, coleta e fechamento do piloto).
- **Realtime:** a publicação `supabase_realtime` tem só `appointment`, `appointment_service`, `attendance` e `attendance_item`. `notificacao` não está nela.
- **Vault:** vazio. Sem `notificacoes_url` nem `notificacoes_segredo`, o banco nunca chama `/api/notificacoes/processar`.
- **Último pedido de Beta (30/09 01:10 UTC):**
  - A notificação foi criada para o único admin ativo e entregue na central (`in_app: entregue`).
  - Ficou marcada como lida às 01:14, no momento da aprovação.
  - Nenhuma entrega de push foi criada, porque esse admin tem **0 aparelhos cadastrados** e **nunca ativou o push** (sem `notificacao_ajuste`).
  - Preferência `plataforma.beta` no padrão (ligada).
- **Causa real do "não chegou nada":**
  - O banco fez a parte dele.
  - O Admin não tinha nada que mostrasse a notificação na hora: sem Realtime e sem destaque próprio.
  - O sino consulta a cada 60 s, e só com a aba visível.
  - O push não roda: Vault vazio e nenhum aparelho do admin cadastrado.
- **`is_platform_admin`:**
  - 48 funções o usam para checar quem está logado.
  - 4 o usam para checar outra pessoa: `notificar`, `notificacao_tem_publico`, `notificacao_publicos_do_usuario` e `admin_list_users_detailed`.
  - Nenhuma `admin_*` fica sem essa checagem.
- **Piloto Norte 21:** ativo, 2 fotografias (Dia 0 em 28/09 e 29/09), coleta de hora em hora com sucesso. Nada nele foi alterado.

## A fazer (uma migration por item, aplicada individualmente, sem `db push`)

1. **`admin_sessao`**
   - Tabela `platform_admin_sessao`, presa ao `session_id` do token do Supabase e válida por 8 h.
   - Função de guarda nova, trocada **só** nas 48 funções que checam quem está logado e nas políticas.
   - Os 4 usos que checam outra pessoa continuam em `is_platform_admin`, para não quebrar as notificações.
   - `is_platform_admin` deixa de responder sobre outra pessoa para quem não é admin.
   - Auditoria de entrada, saída e acesso negado em `platform_audit_log`.
   - O middleware passa a exigir a sessão administrativa, e sair do Admin encerra só ela.
2. **`notificacao_realtime`**
   - Incluir `notificacao` na publicação `supabase_realtime`. A política atual já limita cada evento ao dono da linha e o público `plataforma` a admins.
   - Trocar a consulta de 30 s da faixa de pedidos Beta e o polling do sino por esse canal. A consulta fica como rede de segurança.
3. **Push:**
   - Cadastrar no Vault `notificacoes_url` (`https://fadeos-five.vercel.app`) e `notificacoes_segredo` (o mesmo valor de `NOTIFICACOES_SEGREDO` na Vercel).
   - Conferir na Vercel as variáveis do Firebase: servidor e as 5 públicas.
   - O admin ativa o push em cada aparelho (Admin → Avisos → Preferências).
   - Isso é configuração, não código: fica com o responsável pelo projeto.
4. **`analytics_base`**: ver `docs/analytics.md`.
5. **`produto_marcos`**: marcos por empresa e fotografia diária.
