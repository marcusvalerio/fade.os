# Landing × produto — cada promessa com a tela que a sustenta

Regra: a landing só promete o que o produto faz hoje, e cada tela mostrada na
landing é reconstrução de uma tela real (`app/_landing/screens.tsx`). Quando o
produto muda, esta tabela é revisada junto.

| Promessa na landing | Funcionalidade real | Onde se vê no produto | Lacuna / cuidado |
|---|---|---|---|
| "Menos tempo no WhatsApp marcando horário" | Página pública `/[slug]/agendar` com os horários do mesmo motor da agenda (`get_available_slots`); confirmação pronta para o WhatsApp | Agenda recebe o horário na hora | O envio da mensagem é da barbearia (link `wa.me`), não automático. Sem API do WhatsApp |
| "Caixa que bate no fim do dia" / "O caixa bate — ou você sabe por quê" | Abertura + entrou − saiu = esperado; fechamento com contado, diferença e motivo, imutável | Caixa (sessão aberta e sessões fechadas) | — |
| "Comissão sem conta de cabeça" / "Comissão sem discussão" | Comissão gerada no fechamento; resumo por pessoa (a pagar, gerado, pago no mês); pagamento em lote auditado; barbeiro vê a própria | Comissões / Minhas comissões | O pagamento é registrado no CORTEX; o dinheiro sai por fora (Pix, dinheiro) |
| "Cliente que volta no ritmo dele" / "O cliente volta" | Ritmo por cliente (lib/crm-regras), "Clientes para chamar hoje" com mensagem pronta (só com consentimento), próxima visita sugerida no fechamento | Clientes, ficha do cliente, fechamento do atendimento | Não há disparo automático de lembrete — ver `docs/notificacoes.md` |
| "Você sabe como foi o mês" | Início: faturamento, recebido, ticket, atendimentos contra o período anterior, serviços × produtos, meta do mês | Início | A meta precisa ser definida em Configurações → Financeiro; sem meta, o bloco oferece definir |
| "Fechou o atendimento. O resto já sabe." | `close_attendance` grava venda, pagamento, caixa, comissão, estoque e agenda numa transação | Tela de resultado do fechamento | — |
| "O balcão cabe no bolso" | Barbeiro entra pelo navegador com identificador + senha própria | Login da equipe, agenda do profissional | Sem app nativo (não é prometido) |
| FAQ "Já tenho minha lista de clientes" | Importação .xlsx/.csv com prévia, duplicados e relatório | Clientes → Importar planilha | Só responsável/gerente importa. Arquivos .xls antigos precisam ser salvos como .xlsx |
| FAQ "E o meu cliente, o que ele consegue fazer?" | Conta do cliente por e-mail ou Google; ver, mudar (Agendado/Confirmado, no futuro), cancelar, avaliar, editar dados | `/[slug]/entrar`, `/[slug]/minha-conta` | Apple não é oferecido |
| FAQ "Meus dados ficam separados" | RLS por empresa em todas as tabelas; funções com checagem de papel | — | — |
| Prova social | Nenhum depoimento real ainda | — | A seção não aparece enquanto não houver depoimento autorizado |

## Revisado nesta rodada

- O mock do Início mostrava "Serviços mais realizados" (ranking), que o Início
  não tem mais. Trocado por serviços × produtos e meta do mês — o que o Início
  mostra.
- O mock de papéis usava rótulos antigos do menu ("Negócio", "Catálogo").
  Agora reflete o menu real de cada papel.
- O menu do barbeiro não tinha Comissões, embora a landing dissesse que ele vê
  o que tem a receber. Corrigido no produto (`components/app-nav.tsx`).
