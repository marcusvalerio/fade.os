# Beta, onboarding, pesquisas e inteligência do beta

## 1. Posicionamento comercial (uma fonte só)

`lib/beta.ts` concentra tudo que a interface diz sobre preço e beta:

| Constante | Valor | Onde aparece |
|---|---|---|
| `PRECO_REFERENCIA_MENSAL` | 200 | Onboarding (“Seu plano”, riscado), landing (FAQ “Quanto custa?” e faixa da chamada final) |
| `PLANOS_DISPONIVEIS_A_PARTIR_DE` | "janeiro de 2027" | Onboarding, landing, `/beta` |
| `O_QUE_O_PLANO_INCLUI` | 4 grupos de módulos reais | Card do plano |
| `MENSAGEM_DO_BETA` / `FRASE_COMERCIAL` | textos curtos | Onboarding, `/beta` |

Regras: o CORTEX é **pago**; o valor é **referência visual**, não preço
contratado; **não há cobrança, checkout nem Stripe**; dezembro é parte do
teste real (mês mais cheio); os planos abrem em janeiro de 2027. Nenhuma
superfície diz “grátis”/“gratuito” (verificado por busca e no fluxo).

Para mudar valor ou data: só `lib/beta.ts`.

## 2. Onboarding

Etapas: 01 Sua barbearia → 02 Unidade → 03 Equipe → 04 Serviços → 05 Horários
→ 06 Produtos → 07 Como você recebe → **08 Seu plano** → 09 Revisão → 10 Pronto.

- **CNPJ ou CPF** (`lib/documento.ts`, testado): dígitos verificadores de CPF
  e CNPJ, CNPJ alfanumérico (regra da Receita), salvo formatado. Quem ainda
  não tem CNPJ usa o CPF do responsável. A mesma validação vale em
  Configurações → Dados da barbearia (servidor e tela).
- **Seu plano** (`components/plano-beta.tsx`): “CORTEX completo”, selo BETA,
  R$ 200/mês riscado como referência, “Sem cobrança enquanto durar o beta”,
  o que inclui e “Planos disponíveis a partir de janeiro de 2027. Nada é
  contratado nem cobrado agora.”
- Validado de ponta a ponta no navegador com usuário temporário (removido):
  CNPJ inválido recusado com mensagem, válido aceito, plano sem “grátis”,
  390 e 1280 px sem transbordo, conclusão leva ao produto.
- Corrigido na validação: um documento recusado **apagava todos os campos**
  da etapa (reset automático do `form action` do React). Agora o envio é por
  `onSubmit` e o que foi digitado fica.

## 3. Pesquisas in-app

### Modelo (migration `20260929100000_pesquisas_e_beta.sql`)

- `pesquisa`: título interno, pergunta, tipo (`nota` 1–5, `sim_nao`,
  `escolha`, `multipla`, `texto`), opções (2–8, sem repetidas), comentário
  opcional, funcionalidade relacionada (lista fechada de módulos reais),
  público (`gestor`, `profissional`, `cliente`, combináveis), status
  (`rascunho` → `publicada` → `encerrada`), publicar em, encerrar em.
- `pesquisa_participacao`: uma linha por pessoa e pesquisa — exibida,
  dispensada ou respondida, com valor, comentário, público e empresa. É o
  que impede a repetição e dá a taxa de resposta real.

### Público (decidido pelo banco, nunca pelo navegador)

| Público | Regra |
|---|---|
| Responsável e gerência (`gestor`) | papel `owner` ou `admin` na empresa, empresa ativa |
| Profissionais (`profissional`) | papel `staff` na empresa, empresa ativa |
| Clientes (`cliente`) | conta de cliente (`client_identity`) naquela barbearia |

A tela só informa a área (`equipe` ou `cliente`) e a empresa; mandar outra
empresa não dá acesso a nada (`PESQUISA_INDISPONIVEL`). Tabelas sem acesso
direto (RLS sem política; `revoke` para anon/authenticated) — só funções
`SECURITY DEFINER` que conferem quem chama.

### Funções

- Quem responde: `pesquisa_pendente`, `marcar_pesquisa_exibida`,
  `dispensar_pesquisa`, `responder_pesquisa` (valida o valor pelo tipo).
- Admin (todas exigem `is_platform_admin`, todas auditadas em
  `platform_audit_log`): `admin_salvar_pesquisa` (pergunta, tipo, opções e
  público travam depois de publicar), `admin_mudar_status_pesquisa`,
  `admin_excluir_rascunho_pesquisa` (só rascunho), `admin_listar_pesquisas`,
  `admin_resultado_pesquisa` (agregado por valor e público; comentários com
  público, barbearia e data — nunca quem respondeu).

Testado no banco (30 cenários, revertidos): dono, profissional, cliente,
outra empresa, empresa suspensa, sem sessão, respostas inválidas, segunda
resposta, pesquisa encerrada, acesso direto às tabelas.

### Experiência

`components/pesquisa-discreta.tsx`, montado no layout do produto (área
equipe) e em `/[slug]/minha-conta` (área cliente):

- cartão no canto, nunca modal; busca a pesquisa 8 s depois de abrir a tela;
- não aparece em atendimento, venda, caixa, onboarding nem agendamento, nem
  enquanto houver diálogo aberto (apresentação do primeiro acesso,
  confirmações) — espera e aparece depois;
- não rouba o foco; “Agora não” ou o × = dispensar, e a pesquisa não volta;
- respeita movimento reduzido.

Admin: Beta → Pesquisas (criar com prévia do cartão, publicar, encerrar,
excluir rascunho, resultado).

### Pesquisa enviada como notificação

Uma pesquisa publicada pode virar aviso (sino + push) uma vez, só para o
público dela, com funil enviados → viram → começaram → responderam. Detalhes
em `docs/notificacoes.md` §8.

## 4. Inteligência do beta

`admin_beta_empresas(p_days)` — uma linha por barbearia:

- entrada no beta: aprovação do convite (`beta_access_requests.approved_at`
  com `provisioned_company_id`) ou, se veio direto, a criação da empresa;
- origem, status do beta, fim do beta;
- último acesso (maior `last_sign_in_at` da equipe) e dias sem acesso;
- última operação (agendamento, atendimento, venda, caixa) e dias sem;
- módulos usados (7 medidos), agendamentos e atendimentos no período;
- pesquisas respondidas e textos recebidos;
- **estado derivado**: `ativa` (operou em 7 dias), `esfriando` (7–14),
  `parada` (> 14), `sem_uso` (configurou e nunca operou), `configurando`
  (onboarding aberto), `suspensa`.

Erros por barbearia vêm do Sentry (tag `empresa_id`) quando a leitura está
conectada; senão, “—” com o motivo na tela.

## 5. Alertas internos (`lib/admin-alertas.ts`, testado)

Regras fixas, visíveis em Admin → Alertas, sobre banco e Sentry. Uma
barbearia gera no máximo um alerta (o mais grave; os outros sinais no
detalhe). Suspensas e com beta revogado não alertam.

| Nível | Quando |
|---|---|
| Crítico | erro novo em produção nas últimas 24 h |
| Importante | pedido de beta esperando; sem operação há > 14 dias; configurou e nunca operou há 3+ dias |
| Atenção | última operação entre 7 e 14 dias; onboarding parado há 3+ dias; ninguém da equipe entra há 7+ dias; erro recorrente; leitura do Sentry indisponível |
| Informativo | beta termina em até 14 dias; pesquisa com 10+ exibições e < 20% de resposta; leitura do Sentry não conectada |

Sem IA, sem previsão.

## 6. O que não é medido (e por quê)

- **Quem entrou em períodos anteriores**: `auth.users` guarda só o último
  login e o log de auditoria do Auth está vazio. A Central mostra quem
  entrou na janela, sem comparação, e diz isso.
- **Agendamento online × feito pela equipe**: `appointment` não guarda a
  origem. Não aparece em lugar nenhum até existir a coluna.
- **Telemetria de clique/página**: não existe; uso = registros criados.

## 7. Integrações futuras (não integradas)

Google Maps, Stripe/cobrança, WhatsApp API: nenhuma existe no código.
Sentry (`docs/observabilidade.md`) e Firebase Cloud Messaging
(`docs/notificacoes.md`) são as integrações externas.
