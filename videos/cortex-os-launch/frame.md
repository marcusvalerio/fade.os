---
version: alpha
name: CORTEX.OS — Frame (video / frame layer)
description: >
  Bespoke spec derived 1:1 from the product's own design tokens (app/globals.css, Color System 3.0 /
  R23) — no preset, because the brief forbids a new identity. The product UI is the content: captured
  real screens are the frame's subject; this spec only governs the ground around them and the brand
  lockup. Creeping Depth shell, Kahu Blue as the only functional accent, Panchang reserved for the
  wordmark, Geist for everything else.
unit: the frame — 1920×1080
principle: the product is the design · atoms come from app/globals.css · nothing invented

colors:
  canvas: "#041723"        # --neutral-ink · Creeping Depth · the shell, the ground of every frame
  surface: "#0F1F29"       # --neutral-onyx · app background (content area)
  ink: "#D8CFCA"           # --neutral-bone · shell foreground / wordmark
  bright: "#F6F2F1"        # --neutral-warm-white · the brightest emphasis
  primary: "#0093D6"       # --brand-blue · Kahu Blue · function, interaction, the wordmark dot
  muted: "rgba(232,230,221,0.62)"   # --muted-foreground (dark)
  border: "rgba(232,230,221,0.14)"  # --border (dark)
  glow: "rgba(0,147,214,0.16)"      # the Landing hero radial, top right

radii:
  window: "14px"   # --radius-lg (material-moment)
  control: "8px"   # --radius-md

typography:
  wordmark:  { fontFamily: "Panchang", weight: 700, tracking: "-0.005em (md) / -0.03em (xl)", color: "ink", dot: "primary" }
  eyebrow:   { fontFamily: "Geist", weight: 600, tracking: "0.14em", upper: true, color: "muted" }  # Landing hero eyebrow

motion:
  ease-emphasized: "cubic-bezier(0.2, 0, 0, 1)"   # --ease-emphasized
  ease-standard: "cubic-bezier(0.4, 0, 0.2, 1)"   # --ease-standard
  micro: "140ms"        # the finger pressed
  interacao: "220ms"    # state changed (hover, selection)
  transicao: "320ms"    # entered / left the screen
  momento: "560ms"      # something important concluded (cortex-resolve)
  rise-in: "6px"
  scale-in: "0.97 → 1"
---

# CORTEX.OS — Frame (video / frame layer)

## Overview

The video is made of the real product. Every frame is either a captured state of the running
CORTEX.OS app, or its brand lockup on the shell color. This spec keeps the ground, type and motion
identical to what the product itself ships, so a paused frame reads as the product, not as a video
"about" it.

## Colors

The ground is always **Creeping Depth `#041723`**, the color of the shell, which the product keeps
constant across themes. **Kahu Blue `#0093D6`** is the only accent. It marks function (the
wordmark's dot, the active state), never decoration. The one atmospheric use is the Landing hero's
own radial glow, top right, at ≤16%.

## Typography

**Panchang 700** only in the wordmark (`CORTEX` · blue `.` · `OS`), at the product's tracking.
**Geist** for any other text. The only text the video adds is the official tagline, set like the
Landing hero eyebrow (uppercase, 600, 0.14em, muted).

## Depth & Surface

When the camera pulls out, the app sits in a window: 14px radius (`--radius-lg`), a 1px border at
`--border`, and a deep navy shadow (`--shadow-color: 4 23 35`). No glass on content, no gradients
on UI.

## Composition Rules

### Do
- Frame the real UI large and legible; move the camera, never the pixels of the UI.
- Transition between real states with the product's own motion: opacity for state, rise-in for page,
  scale-in for the dialog, cortex-resolve for the mark.
- Leave negative space around the lockup.

### Don't
- No particles, explosions, glitch, neon, decorative circles or shapes without function.
- No invented charts, numbers or copy: every figure on screen comes from the captured app.
- No second accent color; no Panchang outside the wordmark.

## Numerals & Claims (hard rule)

Every number on screen is rendered by the app from the seeded database (Norte 21 Barbearia demo).
The video adds none.
