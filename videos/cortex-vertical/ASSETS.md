# Assets do vídeo vertical

Estado de cada peça. "Existe" = componente real já usado pela landing e pelo filme 16:9. "Capturar" = tela real do produto que ainda não tem componente de demonstração: capturar do app numa **conta de demonstração com dados fictícios**, nunca da Norte 21.

| Asset | Cena | Fonte | Estado |
|---|---|---|---|
| Símbolo (quadrado azul) + wordmark CORTEX.OS | 1, 3, 14 | `components/ui/wordmark.tsx`, Panchang em `../cortex-em-acao/assets/fonts` | Existe |
| Ícones de linha (caderno, planilha, WhatsApp, maquininha, fiado) | 2 | desenhar em SVG, traço 1,5 px | Criar |
| Agenda (dia, com linha em atendimento) | 4 | `AgendaDaHistoria` (`app/_landing/screens.tsx`) | Existe |
| Clientes/CRM (ritmo) | 5 | `ClientesRitmo` | Existe |
| Agenda do profissional ("Minha agenda") | 6 | `AgendaDoProfissional` | Existe |
| Atendimento no celular | 7 | `AtendimentoNoCelular` | Existe |
| Caixa (antes/depois) | 8 | `CaixaDaHistoria`; `../cortex-em-acao/assets/caixa-*.png` | Existe |
| Vendas/PDV | 9 | tela `/pdv` | Capturar |
| Estoque (item abaixo do mínimo) | 10 | tela `/estoque` | Capturar |
| Início (indicadores da semana) | 11 | `InicioResumo` | Existe |
| Onboarding: "Sozinho / Equipe" e "Sua equipe" | 12 | `app/onboarding/OnboardingWizard.tsx` | Capturar |
| Agenda semana com 1, 3, 5 e 8 profissionais | 13 | `/agenda?vista=semana` na conta de demonstração | Capturar |
| Fontes Geist + Panchang | todas | `../cortex-em-acao/assets/fonts` | Existe |

## Captura vertical (preparação)

O pipeline existente (`../cortex-em-acao/scripts/capture-ui.mjs`) fotografa os componentes em 2x. Para o vertical:

- viewport de captura **430 × 932** (celular) para as telas de celular;
- **recorte em coluna de 960 × 1400** das telas de desktop (1440 × 900 em 2x), uma região por módulo;
- mesmo contorno de 1 px e sem sombra;
- saída em `capture/assets/ui/` deste projeto, com o mesmo nome da cena.

Sequência de produção (depois da aprovação do storyboard):

1. Capturar os quatro itens "Capturar".
2. Desenhar os ícones da cena 2.
3. Montar as composições HyperFrames (`npx hyperframes init` neste diretório, reaproveitando o `frame.md` do projeto 16:9 com `format: 1080x1920`).
4. `npx hyperframes check` e render.
