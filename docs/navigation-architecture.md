# Arquitetura de navegação — FADE.OS

## Objetivo

A navegação representa **áreas de trabalho**, não cada tabela ou módulo interno. O usuário deve reconhecer onde uma tarefa acontece sem precisar conhecer a arquitetura técnica do sistema.

## Áreas principais

| Área | Entrada | Conteúdo |
| --- | --- | --- |
| Início | `/dashboard` | visão geral da operação e números essenciais |
| Agenda | `/agenda` | agenda, horários e fluxo de atendimento; `/atendimento` é o fluxo operacional iniciado a partir da agenda |
| Clientes | `/clientes` | cadastro, histórico e relacionamento |
| Negócio | `/pdv` | nova venda |
|  | `/vendas` | histórico e gestão de vendas |
|  | `/caixa` | abertura, movimentações e fechamento |
|  | `/financeiro` | visão financeira e movimentações |
| Catálogo | `/servicos` | serviços e preços |
|  | `/produtos` | produtos de venda |
|  | `/estoque` | saldo, entradas/saídas e alertas |
|  | `/materiais` | materiais/insumos operacionais |
| Equipe | `/profissionais` | profissionais e configuração da equipe |
|  | `/comissoes` | cálculo e acompanhamento de comissões |
| Inteligência | `/kpis` | indicadores analíticos |
|  | `/relatorios` | relatórios |
|  | `/inteligencia` | Central de Inteligência e recomendações |
| Configurações | `/configuracoes` | configurações da empresa |

## Regras de produto

### 1. Atendimento não é uma área principal independente

`Atendimento` é consequência da operação da agenda. Deve continuar existindo como rota própria enquanto o fluxo precisar dela, mas a navegação deve apresentá-lo dentro de **Agenda**.

### 2. PDV é uma capacidade, não necessariamente o nome da área

O nome técnico `PDV` fica preservado na rota por compatibilidade. Na interface, a entrada principal deve ser **Nova venda**, dentro de **Negócio**.

O conceito de negócio reúne o ciclo comercial e financeiro: vender, consultar vendas, operar caixa e acompanhar financeiro.

### 3. Catálogo reúne o que a empresa vende e consome

Serviços, produtos, estoque e materiais pertencem à mesma área conceitual. Não criar novas abas principais para cada um deles.

### 4. Equipe reúne pessoas e remuneração operacional

Profissionais e comissões ficam juntos. Futuras capacidades de acesso/permissões e jornada devem ser avaliadas dentro de Equipe antes de criar uma nova área principal.

### 5. Inteligência não deve virar um segundo dashboard

- **Início** responde: “como está o negócio agora?”
- **KPIs** responde: “quais indicadores devo acompanhar?”
- **Relatórios** responde: “quero consultar/exportar informação.”
- **Central** responde: “o que o FADE.OS percebeu e recomenda?”

Evitar duplicar os mesmos números nas quatro experiências.

### 6. Configurações fica isolada

Configurações não deve competir com áreas operacionais. Deve permanecer como destino administrativo.

## Migração de nomenclatura

As rotas atuais não devem ser renomeadas apenas para mudar a navegação. Primeiro validamos a arquitetura; depois podemos migrar URLs de forma controlada, preservando compatibilidade e evitando links quebrados.

## Próxima etapa técnica

Depois desta definição, revisar cada área e ajustar:

1. títulos e descrições das páginas para refletirem a nova linguagem;
2. ações primárias e secundárias de cada área;
3. breadcrumbs e links internos;
4. estados de loading e streaming para navegação percebida como rápida;
5. duplicações de autenticação/tenant nas páginas e actions;
6. estados do fluxo de Agenda → Atendimento → Venda;
7. permissões reais por papel antes de ampliar a navegação.

## Fora de escopo desta etapa

- não alterar schema do banco;
- não renomear tabelas;
- não remover rotas existentes;
- não inventar papéis que não existem no banco;
- não fazer redesign visual amplo;
- não otimizar consultas sem medir ou revisar o código que as dispara.
