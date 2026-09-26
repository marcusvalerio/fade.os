---
workflow: product-launch-video
flow: automation
storyboard: no
message: "Do horário marcado ao caixa fechado: o CORTEX.OS acompanha um atendimento inteiro — do celular do cliente ao caixa e à comissão."
destination: website
aspect: 1920x1080
language: pt-BR
audience: donos e gerentes de barbearia
length: 35s
angle: product-demo
---

## Intent

Show-it-as-is: o filme é a demonstração do produto aberta pelo botão "Ver o
CORTEX em ação" da landing (app/_landing). Mostra, com as telas reais do
CORTEX, um cliente atravessando a barbearia: marca pelo celular → aparece na
Agenda (Agendado) → mensagem de confirmação pronta para o WhatsApp →
Confirmado → Em atendimento → atendimento fechado em dinheiro → a venda
entra no saldo esperado do caixa e a comissão aparece como devida → Início
com os indicadores da semana → fechamento com a marca.

Pedido original do usuário: "Use a skill Hyperframes de forma séria [...]
para apresentação de telas; transições entre estados; product storytelling;
motion de UI; demonstrações do produto" — com o exemplo "interface aparece →
horário é selecionado → atendimento muda de estado → cliente aparece →
atendimento entra em andamento → caixa recebe o resultado".

## Assets

- capture/ — captura da landing local (http://localhost:3000), fonte de tokens e estrutura.
- capture/assets/ui/*.png — capturas 2x dos componentes REAIS do produto (os mesmos da landing, com dados de exemplo) em cada estado da história.

## Customizations

- Silencioso: sem narração, sem trilha (music: none, sem SCRIPT.md).
- Títulos de cena tipográficos em português, curtos — são a legenda do filme.
- Toques/cliques indicados sobre os botões reais que mudam o estado (Confirmar, Cliente chegou, Confirmar e fechar).

## Notes

- Não inventar funcionalidade, número real, cliente, depoimento ou logo. Todos os dados são de exemplo e o filme termina dizendo isso.
- A venda entra na gaveta porque é em dinheiro (só `method = 'cash'` gera movimento de caixa no banco) — não trocar para Pix/cartão.
- Identidade: Creeping Depth #041723, Bright White #F6F2F1, Kahu Blue #0093D6; Geist em tudo; Panchang só no wordmark CORTEX.OS.
- Inferido (sem pergunta, sinal "execute o plano inteiro"): destination=website (vai num <dialog> da landing) → 1920x1080; flow=automation, storyboard=no; length≈35s (seis passos + abertura/fecho); language pt-BR (idioma do usuário).
