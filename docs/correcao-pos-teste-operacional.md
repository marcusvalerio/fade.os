# Correção pós-teste operacional

Base: `main` @ `8b2865c`. Branch: `claude/fade-os-pre-pilot-update-7znkqj`.

O teste operacional do pré-piloto reprovou o sistema com dois P0 e oito P1.
Este documento registra o que foi corrigido, como, e o que foi medido depois —
tanto o que passou quanto o que continua em aberto.

---

## P0 #1 — Bypass de preço pelo catálogo

### O que estava errado

Em todo o schema, **uma única tabela** (`professional_access`) tinha policy com
gate de papel. Todas as outras eram escopadas apenas por `my_company_ids()` —
"é da minha empresa". No nível dos dados, portanto, `staff` era igual a `owner`.

As Server Actions já chamavam `requireCompanyManager` corretamente. O buraco era
o PostgREST, que fala com as tabelas sem passar por elas. Medido com o papel real:

```
UPDATE service.default_price ........... 2 linhas alteradas
UPDATE product.sale_price .............. 2 linhas alteradas
UPDATE company.name / company.slug ..... 1 linha alterada
UPDATE unit_business_hours ............. 4 linhas alteradas
UPDATE professional.active ............. 1 linha alterada
UPDATE payment_method .................. 2 linhas alteradas
INSERT product / service / professional  PERMITIDO
INSERT audit_log forjado ............... PERMITIDO
```

E a consequência que reprovava o pré-piloto:

```
Preço de catálogo ANTES ......................... R$ 80,00
Preço de catálogo DEPOIS do PATCH do staff ...... R$  1,00
Item gravado, sem código de autorização ......... R$  1,00
```

O trigger `enforce_attendance_item_integrity` fazia exatamente o que devia —
derivava o preço do catálogo. O catálogo é que não estava protegido. A
manipulação apenas subiu um nível.

### Como foi corrigido

**Duas camadas, ambas no banco.**

1. **RLS por papel** em `company`, `unit`, `unit_business_hours`, `service`,
   `product`, `consumable`, `professional`, `professional_service`,
   `professional_schedule` (+ `_break`), `professional_block`,
   `professional_absence`, `payment_method`, `campaign` e `cash_register`.

   O `USING` mantém o escopo de empresa e o gate de papel vai no `WITH CHECK`.
   Isso é deliberado: com o gate no `USING`, o RLS filtrava a linha antes do
   `BEFORE UPDATE` e o PostgREST devolvia "0 linhas" — indistinguível de "não
   existe", que é onde um bypass se esconde.

2. **Trigger `assert_admin_write`**, que levanta `42501
   ACESSO_ADMINISTRATIVO_NECESSARIO`. Uma tentativa bloqueada nunca é
   indistinguível de um no-op.

**Uma exceção, deliberada:** `apply_stock_delta` virou `SECURITY DEFINER` com
checagem explícita de tenant, e o trigger deixa passar uma alteração que toque
apenas `current_stock`. A baixa de estoque é operação de venda — quem vende é o
barbeiro — e trancar o cadastro não pode trancar a venda.

**Auditoria de preço:** `service`, `product`, `consumable` e
`professional_service` ganharam trigger que registra alteração de preço e de
comissão via `write_audit_log`, com ator, valor anterior e valor novo. Nenhum
segredo entra no log.

### Medido depois (HTTP direto, JWT de `staff`, sem frontend)

| Vetor | Resultado |
|---|---|
| `UPDATE service.default_price` | 403 `ACESSO_ADMINISTRATIVO_NECESSARIO` |
| `UPDATE product.sale_price` | 403 `ACESSO_ADMINISTRATIVO_NECESSARIO` |
| `UPDATE company.slug` | 403 `ACESSO_ADMINISTRATIVO_NECESSARIO` |
| `UPDATE company.name` | 403 `ACESSO_ADMINISTRATIVO_NECESSARIO` |
| `UPDATE unit_business_hours` | 403 `ACESSO_ADMINISTRATIVO_NECESSARIO` |
| `UPDATE professional.active` | 403 `ACESSO_ADMINISTRATIVO_NECESSARIO` |
| `UPDATE payment_method` | 403 `ACESSO_ADMINISTRATIVO_NECESSARIO` |
| `UPDATE professional_service.commission_percent` | 403 `ACESSO_ADMINISTRATIVO_NECESSARIO` |
| `UPDATE professional_schedule` | 403 `ACESSO_ADMINISTRATIVO_NECESSARIO` |
| `UPDATE unit` | 403 `ACESSO_ADMINISTRATIVO_NECESSARIO` |
| `INSERT product / service / professional` | 403 `ACESSO_ADMINISTRATIVO_NECESSARIO` |
| `INSERT audit_log` | 403 permission denied |
| `DELETE professional_service` | 403 `ACESSO_ADMINISTRATIVO_NECESSARIO` |
| `RPC write_audit_log` | 403 `AUDITORIA_NAO_CHAMAVEL_DIRETAMENTE` |
| `RPC adjust_stock` | 403 `FORBIDDEN` |
| `RPC set_company_slug` | 403 `FORBIDDEN` |
| `RPC regenerate_authorization_code` | 403 `FORBIDDEN` |
| `SELECT company_authorization_code` | 403 permission denied |

E a cadeia do P0, refeita do começo:

```
P0: staff adultera preço de catálogo ... BLOQUEADO — ACESSO_ADMINISTRATIVO_NECESSARIO
    preço antes / depois ............... R$ 80 / R$ 80
```

Como `owner`, as mesmas operações continuam passando; `company.slug` passa a
exigir `set_company_slug` (que resolve slug reservado e colisão) mesmo para
owner/admin, e a alteração de preço aparece no `audit_log`:

```
update_price       service              {"default_price": 80} → {"default_price": 1}   qa2.owner
update_price       product              {"sale_price": 50}    → {"sale_price": 1}      qa2.owner
update_commission  professional_service {"commission_percent": 40} → {…: 99}           qa2.owner
```

---

## P1 #5 — Trilha de auditoria falsificável

`audit_log` tinha `INSERT` e `UPDATE` concedidos a `authenticated`. Um `staff`
inseria eventos arbitrários na trilha da própria empresa — a mesma trilha em que
o código de autorização registra desconto, cortesia e cancelamento.

`INSERT`/`UPDATE`/`DELETE` foram revogados. `write_audit_log` virou a única
porta: `SECURITY DEFINER`, deriva ator de `auth.uid()` e valida a empresa contra
`my_company_ids()`. E recusa chamada direta pelo PostgREST — a pilha de chamada
separa "chamada de dentro de close_attendance" (dois ou mais frames plpgsql) de
"POST em /rpc/write_audit_log" (um só). Leitura passou a ser de gestão.

Medido: `INSERT` direto e `POST /rpc/write_audit_log` recusados para `staff` **e
para `owner`**; os registros legítimos continuam sendo gravados pelas funções de
venda, cancelamento e autorização, com o ator correto.

---

## P0 #2, P1 #9, P1 #10 — Onboarding

Três problemas com a mesma origem: o estado do onboarding vivia só no React.

- O wizard terminava com "Tudo pronto" tendo 0 formas de pagamento, 0 horários
  de funcionamento e 0 jornadas. A barbearia não conseguia agendar (o motor
  cruza funcionamento da unidade com jornada do profissional) nem receber. Era a
  causa do "A unidade não está aberta nesse horário" no primeiro agendamento.
- Abandonar e voltar recriava tudo: o passo 1 sempre inseria. O teste produziu 8
  empresas.
- Depois de criar uma empresa, a ativa passava a ser a mais antiga.

**Correções.** `lib/onboarding-readiness.ts` define o mínimo operacional (sete
condições) num lugar só. `completeOnboarding` confere no servidor e recusa
listando o que falta. Novo passo "Seus horários" grava funcionamento da unidade
e jornada de toda a equipe de uma vez. Serviço e forma de pagamento deixaram de
ser puláveis. `getOnboardingState` retoma a empresa em andamento e devolve o
wizard ao primeiro passo pendente; `createCompanyStep` e `createUnitStep` são
idempotentes. `completeOnboarding` grava o cookie de empresa ativa e, sem cookie,
`getCurrentCompany` cai na empresa mais recente.

**Medido**, do login à conclusão, com um refresh no meio:

```
retomou após refresh ............... sim, no passo da unidade
sem serviço, "Continuar" bloqueado . sim
passo "Seus horários" existe ....... sim
sem forma de pagamento, bloqueado .. sim
conclusão .......................... "Tudo pronto" exibido
```

No banco, uma única empresa, operável:

```
unidades 1 | horários 6 | profissionais 1 | jornadas 6 | serviços 1 | habilitações 1 | pagamentos 1
```

E a empresa ativa:

```
logo após criar a 2a empresa ....... QA TESTE Segunda   (a nova)
após escolher a 1a à mão ........... QA TESTE Fix
depois de sair e entrar de novo .... QA TESTE Fix       (escolha explícita vale)
sessão nova sem cookie ............. QA TESTE Segunda   (a mais recente)
```

---

## P1 #3 — Ativação de acesso presa

`enable_professional_access` grava a linha; a aplicação então provisiona a conta
no Supabase Auth. Quando a segunda parte falhava, a compensação apenas marcava
`is_access_enabled = false`. Dois desfechos ruins:

- **sem conta ainda:** linha órfã com `professional.user_id` nulo, lida pela tela
  como "tem acesso, desativado" — sem botão de ativar, com "Resetar Acesso"
  falhando, sem saída pela interface;
- **com conta:** o identificador já tinha sido trocado no banco e o Auth ficava
  com o antigo. A tela dizia "Ativo" exibindo um identificador que não autentica.

`rollback_professional_access` recebe o estado anterior e o restaura: sem linha
antes, apaga; com linha antes, devolve identificador, situação e
`password_set_at`. `getProfessionalAccessStatus` passou a tratar linha sem
`professional.user_id` como "sem acesso", o que recupera também os registros já
presos hoje.

A mensagem também mudou. A falha neste ambiente era uma chave de serviço com
valor de placeholder respondendo "Invalid API key", e a tela dizia "Não foi
possível concluir a ação. Tente novamente." — o operador repetiria para sempre.
`createAdminClient` levanta `ConfigurationError` e `friendlyMessage` distingue
falha permanente de configuração, sem expor nada do ambiente.

**Medido** (a chave de serviço deste ambiente é um placeholder, então a falha é
real e reproduzível):

```
mensagem ......................... "O acesso de profissionais não está configurado
                                    neste ambiente. Fale com quem cuida da instalação."
após recarregar .................. botão "Ativar Acesso" continua disponível
linha em professional_access ..... nenhuma (rollback apagou)
2a tentativa ..................... aceita
```

---

## P1 #6, #7 — Configuração administrativa e criação de estrutura

Cobertos pela mesma correção do P0 #1 no banco. Na interface, `/servicos`,
`/produtos`, `/materiais` e `/profissionais` viraram telas de gestão, no formato
"Acesso restrito" já usado em Financeiro, Relatórios e Configurações. Em
`/estoque` o barbeiro continua vendo o saldo — precisa, para vender — e perde só
o formulário de movimentação.

## P1 #8 — Erro de agenda sem orientação

`FORA_DO_FUNCIONAMENTO` e `FORA_DA_JORNADA` passaram a dizer onde resolver, com
os nomes que aparecem na navegação ("Configurações → Horário de funcionamento",
"Equipe → Profissionais → Jornada").

## P2 corrigidos

- **Overflow horizontal** em `/atendimento` e `/profissionais`: o botão de ação
  do cabeçalho usa `whitespace-nowrap` e a linha não quebrava. `PageHeader` passou
  a quebrar. Varredura em 390px: **0 de 16 rotas com overflow**.
- **React #418** em `/configuracoes`: `PublicPageSettingsPanel` lia
  `window.location.origin` durante a renderização. Passou a ler depois de montar.
  Varredura: **0 erros de JS em 16 rotas**.
- **PDV** avisa na linha quando a quantidade passa do saldo e bloqueia
  "Finalizar venda".
- **Erro do wizard** deixou de vazar para o passo seguinte.
- **Texto duplicado** no campo de código de autorização.

---

## Regressão do código de autorização

```
staff: desconto sem código ............ BLOQUEADO — DESCONTO_NAO_AUTORIZADO
staff: desconto com código válido ..... AUTORIZADO   (original R$ 80, desconto R$ 10, final R$ 70)
staff: desconto com código errado ..... BLOQUEADO — CODIGO_AUTORIZACAO_INVALIDO
staff: cortesia sem código ............ BLOQUEADO — CORTESIA_NAO_AUTORIZADA
staff: cortesia com código válido ..... AUTORIZADO   (original R$ 80, final R$ 0)
owner: desconto SEM código ............ AUTORIZADO pelo papel
staff: injeta preço em attendance_item  INSERT aceito, preço sobrescrito para R$ 80
auditoria ............................. authorize_discount, authorize_courtesy,
                                        regenerate_authorization_code
```

O código de autorização **não** virou caminho de alteração do catálogo: ele
autoriza desconto e cortesia, nada mais.

---

## Fluxo operacional completo

Cliente → agendamento → caixa → atendimento → serviço + produto → desconto
autorizado → pagamento → venda → estoque → comissão → cancelamento → caixa:

```
staff cadastra cliente ............ ok
staff cria agendamento ............ ok
caixa aberto ...................... ok
staff lança serviço e produto ..... R$ 80 + R$ 100 (preço do catálogo)
staff fecha com desconto autorizado  venda R$ 160, desconto R$ 20, completed
estoque baixado ................... 10 → 8
comissão gerada ................... R$ 28,44
movimento de caixa ................ sale_payment R$ 160
staff tenta reescrever a venda .... BLOQUEADO (403)
staff tenta cancelar .............. BLOQUEADO — FORBIDDEN
dono cancela ...................... ok
estoque estornado ................. 8 → 10
comissão .......................... reversed ("Teste operacional")
venda ............................. cancelled
caixa fechado ..................... esperado R$ 100, contado R$ 100, diferença R$ 0
```

---

## O que continua em aberto

- **Concorrência real de estoque não foi exercitada.** A trava `for update` está
  em `apply_stock_delta` e a `CHECK (current_stock >= 0)` é a barreira final, mas
  duas vendas simultâneas do último item não foram testadas: o MCP usa uma conexão
  por chamada e este ambiente não tem credencial de banco para abrir duas sessões.
- **Provisão de acesso de profissional pelo caminho feliz.** A chave de serviço
  deste ambiente é um placeholder, então só o caminho de falha foi exercitado — e
  esse foi exercitado a fundo. Criar a conta, fazer login com ela, desativar e
  reativar continuam sem verificação ao vivo aqui.
- **Profissional com acesso em duas empresas** depende do item acima.
- **Lint** não roda: o projeto não tem ESLint configurado e `next lint` abre
  prompt interativo.
