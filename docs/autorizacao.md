# FADE.OS — Matriz de autorização

Papéis do banco, sem invenção de papéis novos:

- `owner` — responsável pela empresa
- `admin` — gerente
- `staff` — profissional / recepção

Os escopos de navegação (`manager`, `reception`, `barber`) são **derivados**
em `app/(app)/layout.tsx` a partir do papel real e do vínculo
`professional.user_id`. Eles decidem o que aparece, nunca o que é permitido.

## A regra

A UI não é mecanismo de segurança. Uma Server Action é um endpoint HTTP e
pode ser chamada direto, com qualquer payload, por qualquer sessão válida.
Portanto **toda** action decide sozinha.

Dois gates, em `lib/`:

| Helper | Aceita | Para |
|---|---|---|
| `requireCompanyAccess(companyId)` | qualquer vínculo (`owner`/`admin`/`staff`) | operação do dia a dia |
| `requireCompanyManager(companyId)` | só `owner`/`admin` | gestão, configuração e autoridade financeira |

`requireCompanyManager` também cobre o teste de acesso à empresa: sem vínculo
nenhum a consulta não retorna linha e a falha é a mesma. Uma query em vez de
duas.

Abaixo dos dois, o RLS do Postgres continua sendo a barreira real — nenhum
helper substitui `my_company_ids()` e as policies.

## Exige `owner`/`admin`

| Área | Actions |
|---|---|
| Profissionais | `createProfessionalRecord`, `updateProfessionalRecord`, `toggleProfessionalActive`, `setProfessionalAvatar` |
| Acesso profissional | `enableProfessionalAccess`, `disableProfessionalAccess`, `resetProfessionalAccess` |
| Serviços | `createServiceRecord`, `updateServiceRecord`, `toggleProfessionalOnService` |
| Produtos | `createProductRecord`, `updateProductRecord`, `toggleProductActive` |
| Materiais | `createConsumableRecord`, `updateConsumableRecord`, `toggleConsumableActive` |
| Estoque | `adjustStockAction` |
| Configurações | `updateCompanySettings`, `updateCompanySlug`, `setCompanyLogo`, `updateUnitSettings`, `setPaymentMethodActive` |
| Disponibilidade | jornada, intervalos, funcionamento da unidade, bloqueios e ausências |
| Comissões | `markCommissionPaid` |
| Financeiro | `createFinancialEntry` |
| Vendas | `cancelSale` |
| Onboarding | `createUnitStep`, `createProfessionalStep`, `createServiceStep`, `linkProfessionalToService`, `completeOnboarding` |

`createCompanyStep` exige apenas usuário autenticado, por definição: é o ato
que cria a empresa e torna quem o executou `owner` dela.

## Aceita qualquer vínculo da empresa

Isto é a operação da barbearia; travar em gerente quebraria o piloto.

| Área | Actions |
|---|---|
| Agenda | `createAppointment`, `updateAppointmentStatus` |
| Atendimento | walk-in, itens, início/fim, fechamento, cancelamento |
| Clientes | `createClientRecord`, `updateClientRecord` |
| Venda (PDV) | `createPdvSale` |
| Caixa | `openCashSession`, `closeCashSession`, `addCashMovement` |
| Leitura | dashboard, disponibilidade |

## Código de autorização

Owner/admin autorizam desconto e cortesia pelo próprio papel. Quem não é
gerente autoriza apresentando o **código de autorização da empresa**, que é
credencial de operação — não senha de administrador e não concede acesso
nenhum.

O código autoriza exatamente a operação pedida (`discount` ou `courtesy`), na
empresa pedida, e só dentro da transação em que foi apresentado. Vive só como
hash bcrypt, numa tabela sem policy de leitura e sem grant para
`authenticated`; regenerar invalida o anterior imediatamente; cada uso vira
registro de auditoria e o código nunca é gravado em log nem em auditoria.

Entradas cobertas pela mesma regra: `add_attendance_service_item`,
`add_attendance_product_item`, `update_attendance_item`, `close_attendance`
(desconto de venda) e `create_pdv_sale` (item e venda).

Quem impõe é o trigger `trg_attendance_item_integrity`, não a Server Action —
um `INSERT` direto no PostgREST bate na mesma regra.

## Razão financeiro

`sale`, `sale_item`, `payment`, `commission`, `financial_entry`,
`cash_movement` e `stock_movement` aceitam `INSERT` mas **não** `UPDATE` nem
`DELETE` de `authenticated`. As duas escritas legítimas depois do registro
passam por função: `cancel_sale` e `mark_commission_paid`, ambas
`SECURITY DEFINER` com checagem de papel e empresa lá dentro.

## Consultas de acesso

`getProfessionalAccessStatus` usa `requireCompanyAccess` de propósito: o
próprio profissional precisa poder ver o status do seu acesso. Quem enxerga o
quê é decidido pela policy `professional_access_select`, que libera a empresa
inteira para `owner`/`admin` e apenas o registro próprio para os demais.
