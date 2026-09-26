# Claude — Motion Showreel 2026

A 15-second, 1920×1080, 60 fps showreel. It's hand-coded as a single canvas composition, rendered frame by frame, with a soundtrack synthesized on the same beat grid.

**Watch:** `showreel.mp4` · **Live:** serve this folder, open `index.html`, and click to play with sound.

## Structure (128 BPM, so 32 beats = exactly 15.000 s)

| Beats | Time | Scene | Craft on show |
|---|---|---|---|
| 0–4 | 0.00–1.88 | **The Ball** | squash & stretch, arcs, onion-skin trail, principle labels on each impact, then an anticipation squash that fires an iris wipe |
| 4–8 | 1.88–3.75 | **Kinetic type** | masked rise, spring-staggered letters, a slam with elastic squash, a colour-split panel, a serif swoosh reveal, then a diagonal slash wipe |
| 8–12 | 3.75–5.63 | **01 Rhythm** | 144-cell grid, four ripples from different origins, shape morphs, a `difference` knockout headline, then an implosion to a seed dot |
| 12–16 | 5.63–7.50 | **02 Dimension** | 4,200 particles in 3D: sphere → (3,5) torus knot → the word "DEPTH", then a warp into camera and a white burn |
| 16–20 | 7.50–9.38 | **03 Flow** | moiré silk ribbons with draw-on/off and a masked italic headline |
| 20–24 | 9.38–11.25 | **04 Energy** | eight half-beat cuts: tunnel, halftone, stripes, wireframes, golden spiral, glitch, starburst, dot pop |
| 24–28 | 11.25–13.13 | **05 Systems** | staggered UI panels, rolling counters, bars, a line graph, an easing curve, then a match-cut zoom through the donut ring |
| 28–32 | 13.13–15.00 | **Resolve** | the ring collapses into the ball from the intro, which rolls out the wordmark and lands as its full stop |

Global passes: true motion blur (6 sub-frames, 180° shutter), camera punch and chromatic aberration on hits, a HUD with a live timecode, vignette, and seeded film grain. Every frame is a pure function of `t`, so renders are deterministic.

## Rebuild

```bash
pip install numpy imageio-ffmpeg        # imageio-ffmpeg ships an ffmpeg with libx264
python3 audio.py                         # -> showreel.wav
FFMPEG=$(python3 -c "import imageio_ffmpeg as i; print(i.get_ffmpeg_exe())") node render.mjs   # -> showreel.mp4
node render.mjs --stills 2.5,6.8         # review individual frames in stills/
```

Rendering needs Playwright + Chromium. Fonts (Archivo Black, Space Mono, Instrument Serif; all OFL) are vendored in `fonts/`.
