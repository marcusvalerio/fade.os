---
format: 1080x1920
duration: 15s
message: "A operação inteira da barbearia, conectada em um único sistema."
arc: OPERAÇÃO → CONEXÃO → CONTROLE → CORTEX.OS
audience: donos e gestores de barbearias
mode: autonomous
music: own sound design (film-audio.py) — clicks, UI ticks, discreet whooshes, one chord
---

# Auditoria e plano

## 1 · O produto (auditoria do repositório)

Next.js 15 + Supabase, multi-tenant. O shell (sidebar + header) é sempre **Creeping Depth
`#041723`**, a função/interação é sempre **Kahu Blue `#0093D6`**, a marca é
**Panchang** (só no Wordmark) e a UI é **Geist**. O movimento segue tokens próprios
(`--ease-emphasized`, micro 140 / interação 220 / transição 320 / momento 560 ms, rise-in de 6 px,
`cortex-resolve` do CortexMark). O diferencial está no próprio código: a mesma ação atravessa
tabelas. `startAttendanceFromAppointment` transforma o agendamento em atendimento, e
`close_attendance` gera venda, pagamento, movimento de caixa (em dinheiro) e comissão numa
transação só. O Início lê tudo isso de volta como KPIs.

## 2 · Telas reais disponíveis

Início (`/dashboard`) · Agenda (`/agenda`) · Atendimentos (`/atendimento`, `/atendimento/[id]`) ·
Clientes (`/clientes`) · Vendas (`/vendas`) · Caixa (`/caixa`) · Nova venda (`/pdv`) · Comissões
(`/comissoes`) · Financeiro (`/financeiro`) · Serviços / Produtos (`/servicos`, `/produtos`) ·
Estoque (`/estoque`) · Profissionais (`/profissionais`) · KPIs (`/kpis`) · Inteligência ·
Relatórios · Configurações.

## 3 · Componentes reais usados como material de motion

Colhidos como **DOM vivo** (`harvest.mjs` → `assets/app/fragments.json`) e renderizados com o CSS
de produção do app. Não são screenshots.

| Componente | Origem | Vira… |
|---|---|---|
| CortexMark + Wordmark | `components/ui/cortex-mark.tsx`, `wordmark.tsx` | o começo; a metade azul abre o filme |
| Linha "Em atendimento" azul (Felipe Santos 10:00) | Início › Agora e a seguir | o campo azul em que a câmera mergulha |
| Lista "Agora e a seguir" | Início | a operação acontecendo, linha a linha |
| StatGrid (Aguardando / Em atendimento / Restantes / Concluídos) | Agenda | o contador que responde à ação |
| Linha da agenda (Henrique Rocha 10:30) em 3 estados reais | Agenda: aguardando → "Iniciando…" → em atendimento | decomposta em horário / cliente / serviço / status / ação |
| Card do atendimento + header "Originado de agendamento · Em andamento" | `/atendimento/[id]` | o agendamento virando atendimento |
| TOTAL R$ 50,00 | card do atendimento | o valor que viaja pelo sistema |
| `<dialog>` Fechar atendimento | `/atendimento/[id]` | a camada cinematográfica da venda |
| Caixa principal (movimentações de hoje) | `/caixa` | onde o valor pousa: "Venda 10:41 +R$ 50,00" |
| Linha de comissão (Thiago Moura 40% de R$ 50,00) | `/comissoes` | a consequência automática |
| Sidebar com cada módulo ativo | todas as telas | a espinha do sistema |
| Clientes para chamar hoje · Serviços · Estoque crítico · Devido no momento · Resultado do período · KPIs do Início | módulos | as camadas que se encaixam |
| Página inteira do Início (sidebar + header + main + gráfico SVG) | `/dashboard` | a revelação final |
| Linha do "agora" (ponto + rótulo azul) | Agenda | o estilo dos rótulos da cadeia ATENDIMENTO → VENDA → CAIXA |

## 4 · Diferenciais e fluxos reais

1. **Agenda → Atendimento:** "Iniciar atendimento" cria o atendimento a partir do agendamento.
2. **Atendimento → Venda → Caixa → Comissão:** "Fechar e receber" fecha tudo numa transação.
3. **Tudo volta como gestão:** o Início soma faturamento, ticket, atendimentos e ocupação.
4. **Um shell, todos os módulos:** a mesma sidebar organiza agenda, clientes, negócio, catálogo,
   equipe e financeiro.

## 5–6 · Storyboard (15 s) e elemento real por cena

| Tempo | Cena | Ritmo | Elemento real | Movimento |
|---|---|---|---|---|
| 0–2 | **O sistema** | silêncio | CortexMark + Wordmark | As metades do mark chegam separadas e pequenas, crescem e fecham (`cortex-resolve`). O nome se escreve a 62 ms por letra, e a câmera mergulha na metade azul. |
| 2–4 | **A operação** | construção | Linha azul Felipe Santos · lista Agora e a seguir | O azul do mark vira o azul da linha "Em atendimento". A câmera recua pelo 10:00 gigante até a linha inteira, e as outras linhas entram uma a uma. "AGORA E A SEGUIR" atravessa o quadro. |
| 4–6 | **Agenda → Atendimento** | construção | Linha de Henrique (3 estados) · StatGrid · card + header do atendimento | A câmera atravessa até a agenda real. A linha se desmonta na vertical (10:30 / Henrique Rocha / serviço / AGUARDANDO / Iniciar atendimento), o botão pressiona e mostra "Iniciando…", o status vira EM ATENDIMENTO e os contadores vão de 1/2 para 0/3. As peças se remontam no atendimento ("Originado de agendamento"). |
| 6–8 | **Atendimento → Negócio** | aceleração | TOTAL R$ 50,00 · `<dialog>` · Caixa · Comissão | O total cresce até ocupar a tela, pousa no modal e o botão confirma. Depois desce pela linha azul (ATENDIMENTO → VENDA → CAIXA) e vira a movimentação "Venda 10:41 +R$ 50,00" que abre espaço no Caixa. A comissão de Thiago aparece. |
| 8–11 | **Tudo conectado** | aceleração | Navegação real a 2× · 8 componentes de módulos (layout mobile do produto) | No alto, a navegação do sistema acende módulo a módulo (Agenda, Clientes, Negócio/Caixa, Catálogo, Estoque, Equipe/Comissões, Financeiro, Início). Embaixo, o componente real de cada um entra em carrossel cada vez mais rápido, até os KPIs do Início tomarem o quadro. |
| 11–13 | **Visão de gestão** | impacto | Página inteira do Início | Os KPIs fazem o match com o Início completo, a câmera recua, as seções se assentam e o gráfico real se desenha. |
| 13–15 | **Assinatura** | resolução | Lockup da sidebar + tagline oficial | A interface se dissolve, o lockup sai da sidebar para o centro e entra "Sistema operacional para barbearias". |
