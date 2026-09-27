# CORTEX em ação — o filme do produto

O vídeo de 39 s que abre no botão **"Ver o CORTEX em ação"** da landing
(`app/_landing/DemoDialog.tsx`). Publicado em `public/demo/cortex-em-acao.mp4`
(+ `cortex-em-acao.jpg` como pôster). Feito com [HyperFrames](https://hyperframes.heygen.com)
pelo fluxo `product-launch-video`: `BRIEF.md` → `STORYBOARD.md` → frames → render.

## Regras que o filme segue

- Toda tela é captura 2x dos componentes reais do CORTEX (os mesmos de
  `app/_landing/screens.tsx`), com dados de exemplo — o filme termina dizendo isso.
- Só aparece clique no que existe e faz exatamente aquilo no produto. Onde o
  produto tem passos que não foram capturados (Cliente chegou → Iniciar
  atendimento), a mudança é mostrada como passagem de tempo, sem clique.
- O pagamento é em **dinheiro**: só `method = 'cash'` gera movimento de caixa,
  por isso a venda entra no saldo esperado.
- Silencioso. O texto na tela é a narrativa; `DemoDialog` traz o roteiro em
  texto (WCAG 1.2.1).

## Atualizar quando a interface mudar

Com o app rodando (`npm run dev`, porta 3000), na pasta deste projeto:

```bash
# 1. Fotografa os componentes em cada estado + mede os alvos dos cliques
PLAYWRIGHT_MODULE=<caminho>/playwright/index.mjs node scripts/capture-ui.mjs
# 2. Leva as telas novas para o filme (stage-assets não sobrescreve)
for f in phone-servicos phone-confirmado agenda-s1 agenda-s2 agenda-s3 mensagem \
         atendimento modal caixa-antes caixa-depois inicio clientes; do
  cp capture/assets/ui/$f.png assets/; done
# 3. Frames (coordenadas vindas de positions.json) → index → transições → lint
./scripts/assemble.sh
# 4. Verificação completa e render
npx hyperframes@0.8.78 check
npx hyperframes@0.8.78 render --skill=product-launch-video --quality high --output renders/video.mp4
# 5. Publica na landing (moov no início para começar a tocar antes de baixar tudo)
ffmpeg -y -i renders/video.mp4 -c copy -movflags +faststart -an ../../public/demo/cortex-em-acao.mp4
ffmpeg -y -ss 12.4 -i renders/video.mp4 -frames:v 1 -q:v 3 ../../public/demo/cortex-em-acao.jpg
```

Mudou a duração? Atualize `DEMO_DURACAO` e `ROTEIRO` em `app/_landing/DemoDialog.tsx`.

`scripts/build-frames.mjs` gera `compositions/frames/*.html`; edite o gerador,
não os frames (a injeção de transições também os reescreve). O GSAP está
vendorizado em `assets/vendor/` porque o Chrome do render não usa a CDN e um
render offline é o que garante o mesmo MP4.
