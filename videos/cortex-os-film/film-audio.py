"""Minimal sound design for the CORTEX.OS film, on film.config.mjs beats.

Clicks where the UI is pressed, soft ticks where it responds, discreet air
whooshes for the big camera moves, one low impact for the reveal and an open
chord under the signature. No music bed that competes with the picture.

    python3 film-audio.py .beats.json assets/film.wav     (build.mjs runs it)
"""
import json
import sys
import wave

import numpy as np

cfg = json.load(open(sys.argv[1]))
B = cfg["beats"]
DUR = cfg["duration"]
SR = 48000
N = int(SR * DUR)
mix = np.zeros((N, 2))
rng = np.random.default_rng(7)


def t_(sec):
    return np.arange(int(sec * SR)) / SR


def place(sig, sec, gain=1.0, pan=0.0):
    if sig.ndim == 1:
        sig = np.stack([sig * np.sqrt((1 - pan) / 2), sig * np.sqrt((1 + pan) / 2)], axis=1) * np.sqrt(2)
    i = int(sec * SR)
    j = min(N, i + len(sig))
    if 0 <= i < N:
        mix[i:j] += sig[: j - i] * gain


def onepole(x, cutoff):
    cutoff = np.broadcast_to(np.asarray(cutoff, dtype=float), x.shape)
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for n in range(len(x)):
        acc = (1 - a[n]) * x[n] + a[n] * acc
        y[n] = acc
    return y


def click(f=1500, g=1.0):
    t = t_(0.05)
    n = rng.standard_normal(len(t))
    return ((np.sin(2 * np.pi * f * t) * 0.5 + (n - onepole(n, 2000)) * 0.5) * np.exp(-t * 130)
            + np.sin(2 * np.pi * 170 * t) * np.exp(-t * 55) * 0.35) * g


def tick(f=2600):
    t = t_(0.04)
    return np.sin(2 * np.pi * f * t) * np.exp(-t * 110)


def tone(freqs, sec, attack=0.01, decay=0.4, bright=1.0):
    t = t_(sec)
    s = sum(np.sin(2 * np.pi * f * h * t) / h ** (2.2 / bright) for f in freqs for h in (1, 2, 3))
    return s * np.minimum(1, t / attack) * np.exp(-t / decay) / len(freqs)


def whoosh(sec, rise=True, top=6000):
    t = t_(sec)
    u = t / sec
    env = (u ** 2 if rise else (1 - u) ** 1.5) * np.sin(np.pi * np.minimum(1, u * 1.02)) ** 0.3
    n = rng.standard_normal(len(t))
    cut = 250 + top * (u if rise else 1 - u)
    return (onepole(n, cut) - onepole(n, cut * 0.3)) * env * 2.2


def thump(sec=1.2, f0=90, f1=38):
    t = t_(sec)
    f = f1 + (f0 - f1) * np.exp(-t * 7)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.2)


# 01 — the mark forms in silence, the name types, the camera dives
place(tone([220, 330], 1.4, attack=0.5, decay=0.9, bright=0.6), B["markIn"], 0.10)
for i in range(9):
    place(tick(2200 + 120 * (i % 3)), B["typeStart"] + i * B["typeStep"], 0.05, pan=-0.2 + i * 0.05)
place(whoosh(B["dive"][1] - B["dive"][0] + 0.05), B["dive"][0], 0.18)
place(thump(0.9, 70, 40), B["dive"][1], 0.35)

# 02 — the operation: a tick per row landing, air through the zoom
place(whoosh(0.55, rise=False, top=4000), B["pullBack"][0], 0.12)
for i in range(7):
    place(tick(1800 + 90 * i), B["listIn"] + i * 0.05, 0.035, pan=0.3)
place(whoosh(B["zoomThrough"][1] - B["zoomThrough"][0]), B["zoomThrough"][0], 0.16)

# 03 — agenda: the row comes apart, the press, the system answers
place(whoosh(0.4, rise=False, top=3500), B["decompose"][0], 0.08)
place(click(), B["press"] - 0.03, 0.22)
for k in range(4):
    place(tick(3000), B["pending"] + 0.08 * k, 0.018)
place(tone([880, 1318.5], 0.8, decay=0.22, bright=0.8), B["result"], 0.07)
place(whoosh(0.4, rise=False, top=3000), B["toAttendance"][0], 0.07)

# 04 — the value: up, into the dialog, confirmed, into the drawer
place(whoosh(B["valueUp"][1] - B["valueUp"][0]), B["valueUp"][0], 0.12)
place(thump(0.7, 110, 55), B["valueUp"][1] - 0.02, 0.18)
place(click(), B["confirm"] - 0.03, 0.22)
place(tone([987.77, 1479.98], 0.8, decay=0.25, bright=0.8), B["modalOut"][0], 0.06)
place(tone([1318.5, 1975.5], 0.6, decay=0.18, bright=0.9), B["toCaixa"][1] - 0.02, 0.06, pan=0.2)
place(tick(2400), B["commission"][0] + 0.2, 0.04, pan=-0.3)

# 05 — everything connected: rising ticks as each module locks in
place(whoosh(B["spineIn"][1] - B["spineIn"][0], rise=False, top=3500), B["spineIn"][0], 0.08)
scale = [440, 493.88, 554.37, 659.25, 739.99, 880, 987.77, 1108.73]
for i, t in enumerate(B["modules"]):
    place(tone([scale[i]], 0.35, decay=0.09, bright=0.7), t, 0.06, pan=(-1) ** i * 0.25)
    place(click(2200, 0.5), t, 0.08)
place(whoosh(B["toKpis"][1] - B["toKpis"][0]), B["toKpis"][0], 0.1)

# 06 — the reveal: one low impact and air
place(thump(1.6, 80, 34), B["reveal"][0] + 0.05, 0.45)
place(whoosh(B["reveal"][1] - B["reveal"][0], rise=False, top=5000), B["reveal"][0] + 0.05, 0.14)

# 07 — signature: an open chord (A add9), long and quiet
chord = tone([110, 164.81, 220, 246.94, 329.63, 493.88], DUR - B["lockupOut"][0], attack=0.5, decay=2.6, bright=0.6)
place(np.stack([chord, np.roll(chord, 480)], axis=1), B["lockupOut"][0], 0.22)

# master: small room, soft clip, -1 dBFS peak, tail fade
wet = np.zeros_like(mix)
for d, g in [(0.029, 0.42), (0.041, 0.38), (0.053, 0.33)]:
    k = int(d * SR)
    for ch in range(2):
        y = mix[:, ch].copy()
        for r in range(1, 8):
            off = k * r + ch * 23
            if off >= N:
                break
            y[off:] += mix[:-off, ch] * g ** r
        wet[:, ch] += y
out = np.tanh((mix + wet * 0.05) * 1.15)
out *= np.minimum(1, (N - np.arange(N)) / (0.28 * SR))[:, None]
out /= max(1e-9, np.max(np.abs(out))) / 0.89
with wave.open(sys.argv[2], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((out * 32767).astype("<i2").tobytes())
print("wrote", sys.argv[2])
