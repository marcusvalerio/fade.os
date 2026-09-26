#!/usr/bin/env bash
# Monta o filme do zero a partir do STORYBOARD.md e das capturas:
# frames → index → transições → GSAP local no index → lint.
# (A injeção de transições edita os frames; por isso tudo roda nesta ordem.)
set -euo pipefail
cd "$(dirname "$0")/.."
S="${PLV_SCRIPTS:-$HOME/.claude/skills/product-launch-video/scripts}"
node scripts/build-frames.mjs
node "$S/assemble-index.mjs" --storyboard ./STORYBOARD.md --hyperframes .
node "$S/transitions.mjs" inject --storyboard ./STORYBOARD.md --hyperframes .
node "$S/transitions.mjs" verify --storyboard ./STORYBOARD.md --index ./index.html
# O assembler aponta o GSAP para a CDN; o render usa a cópia vendorizada.
sed -i -E 's#<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"[^>]*></script>#<script src="assets/vendor/gsap.min.js"></script>#' index.html
grep -q 'assets/vendor/gsap.min.js' index.html
npx hyperframes@0.8.78 lint
