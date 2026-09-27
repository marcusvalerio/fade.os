# CÓRTEX.OS — Finalização, redesign, operação, admin e landing

Branch `claude/fade-os-pre-pilot-update-7znkqj` · 27/09/2026 · 21 commits à frente
de `main` (7 da missão anterior + 14 desta). Nada foi enviado para `main`.

## Resumo executivo

O produto ganhou identidade própria (tipografia Familjen / Supreme / Sora, shell
novo, primeiro acesso guiado), um Início que funciona como centro de comando, a
agenda semanal real, reagendamento com profissionais diferentes, a área do
cliente completa (mudar horário, dados), ficha de cliente de CRM, importação de
clientes por planilha, e as telas de dinheiro reescritas para responder primeiro
e detalhar depois. O Admin virou console da plataforma. A landing passou a
vender resultado — com cada promessa amarrada a uma tela real.

Três números errados que o dono via foram corrigidos (comissão devida,
resultado do Financeiro, data padrão da despesa). Em produção, que ainda roda
`main`, o Financeiro de setembro da NORTE 21 mostra **R$ 2.572,00**; o correto,
que a branch mostra, é **R$ 4.141,00**.

## Migrations desta missão (arquivo no repositório + aplicada)

| Arquivo | O que faz |
|---|---|
| `20260928100000_inicio_panorama.sql` | `get_inicio_panorama`; corrige cancelamentos/faltas de `get_dashboard_metrics` para respeitarem o período |
| `20260928100100_inicio_panorama_agenda.sql` | minutos agendados por profissional (ocupação do dia) |
| `20260928110000_admin_console.sql` | `admin_platform_overview`, `admin_company_activity`, `admin_module_usage`, `admin_list_users_detailed`, `admin_audit_feed` — todas com `is_platform_admin` |
| `20260928120000_reagendamento_composto.sql` | `appointment_slot_problem` (regra única), `assert_appointment_slot_valid` como invólucro, `get_reschedule_starts` |
| `20260928130000_cliente_reagenda_e_dados.sql` | reagendar e editar dados pela conta do cliente; `cancel_public_appointment` só Agendado/Confirmado |
| `20260928140000_comissoes_resumo.sql` | `get_commission_summary` (invoker) e `mark_commissions_paid` (auditado) |

Compatibilidade com `main` (produção compartilha o banco): `get_dashboard_metrics`,
`cancel_public_appointment` e `assert_appointment_slot_valid` mantêm assinatura e
colunas; smoke de produção sem erro.

## Dados de teste — criados e removidos

| Criado | Removido |
|---|---|
| Admin temporário `qa-admin-temporario@cortex-qa.test` (usuário, identidade, `platform_admin`) | Sim |
| Cliente temporário `qa-cliente-r6@cortex-qa.test` (usuário, identidade, cliente, vínculo, 1 agendamento com 1 linha) | Sim |
| 5 clientes da importação (`QA Import Um/Dois/Três`, `QA Import XLSX A/B`) | Sim |
| Agendamento do teste de reagendamento composto (1 agendamento, 2 linhas) | Sim |
| Pagamento de comissões em lote, testes de RLS/RBAC | Transação desfeita — nada gravado (31 comissões / R$ 581,10 intactas) |
| 2 eventos em `audit_log` (`client_reschedule_appointment` cd7b071f…, e o do reagendamento composto) | **Mantidos** — trilha de auditoria é imutável por desenho |
| `user_metadata.apresentacao_vista_em` da conta QA | Mantido — é o estado normal de quem viu a apresentação |

## Não validado (dito com todas as letras)

- Bloco **Próxima visita** no resultado do fechamento do atendimento: fechar um
  atendimento real grava venda, financeiro e comissão que o razão não deixa
  apagar. Validado só o carregamento da tela com atendimento aberto.
- Faixa **Abertura / Entrou / Saiu** do caixa aberto: exigiria abrir uma sessão
  de caixa real.
- Importação por usuário **não gerente** no navegador (bloqueio existe no
  servidor e na tela; não houve login de equipe sem gestão nesta rodada).
- Fluxo real do **Google** do cliente (só a presença do botão foi conferida).
- **Tema escuro** das telas novas desta rodada.
- Leitor de tela real (só verificação automatizada de rótulos, nomes e foco).

## Pendências

1. **Segurança — decisão sua:** duas contas de QA de rodadas anteriores têm
   `platform_admin` em produção: `qa.r7.admin.1789415784@gmail.com` (desde
   14/09) e `qa.r9.owner.1789437227@gmail.com` (desde 17/09). Recomendo revogar.
2. Fazer o merge da branch — o bug do Financeiro segue em produção até lá.
3. Ledger × arquivos de migration: nomes batem, versões não (P2.2 conhecido).
   Não rodar `supabase db push` sem reconciliar.
4. Supabase (pré-existentes): Leaked Password Protection desligada (depende do
   plano); view `professional_directory` SECURITY DEFINER; 2 funções com
   `search_path` mutável.
5. Notificações automáticas não existem — só a arquitetura (`docs/notificacoes.md`).
6. Página pública de agendamento: só ajustes (contraste, rótulo); sem redesign
   do wizard nesta rodada. PDV não foi alterado nesta rodada.
7. `.xls` antigo não é lido (pede salvar como `.xlsx`).
8. Desempenho: `/configuracoes` (188 kB) e `/agenda` (176 kB) de JS inicial são
   as maiores — candidatas a divisão de código.
9. Prova social da landing vazia até existir depoimento real autorizado.
