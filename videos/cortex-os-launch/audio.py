"""Quiet sound design for the CORTEX.OS trailer, synced to config.mjs → timeline.

A low, warm bed; soft key ticks while the wordmark types; small UI clicks on
every press; a faint confirmation tone when the system responds; one open chord
under the end card. No drops, no risers, no whooshes.

    python3 audio.py timeline.json trailer.wav     (render.mjs writes timeline.json)
"""
import json
import sys
import wave

import numpy as np

cfg = json.load(open(sys.argv[1]))
TL = cfg["timeline"]
SPEED = cfg.get("speed", 1)
DUR = cfg["duration"] / SPEED
SR = 48000
N = int(SR * DUR)
mix = np.zeros((N, 2))
rng = np.random.default_rng(21)


def t_(sec):
    return np.arange(int(sec * SR)) / SR


def at(sec):
    return int(sec / SPEED * SR)


def place(sig, sec, gain=1.0, pan=0.0):
    if sig.ndim == 1:
        sig = np.stack([sig * np.sqrt((1 - pan) / 2), sig * np.sqrt((1 + pan) / 2)], axis=1) * np.sqrt(2)
    i = at(sec)
    j = min(N, i + len(sig))
    if 0 <= i < N:
        mix[i:j] += sig[: j - i] * gain


def onepole(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for n, v in enumerate(x):
        acc = (1 - a) * v + a * acc
        y[n] = acc
    return y


def tick(freq=2600, dec=90):
    t = t_(0.05)
    n = rng.standard_normal(len(t))
    body = np.sin(2 * np.pi * freq * t) * 0.6 + (n - onepole(n, 3000)) * 0.4
    return body * np.exp(-t * dec)


def click():
    t = t_(0.06)
    n = rng.standard_normal(len(t))
    return (np.sin(2 * np.pi * 1450 * t) * 0.5 + (n - onepole(n, 1800)) * 0.5) * np.exp(-t * 120) + \
        np.sin(2 * np.pi * 180 * t) * np.exp(-t * 60) * 0.35


def tone(freqs, sec, attack=0.02, decay=2.5, bright=1.0):
    t = t_(sec)
    s = sum(np.sin(2 * np.pi * f * h * t) / h ** (2.2 / bright) for f in freqs for h in (1, 2, 3))
    env = np.minimum(1, t / attack) * np.exp(-t / decay)
    return s * env / len(freqs)


# ---- bed: a soft, slowly opening A/E fifth, filtered, very low in the mix
t = t_(DUR)
bed = sum(np.sin(2 * np.pi * f * t + p) for f, p in [(55, 0), (82.41, 1.3), (110, 2.1), (164.81, .4)])
bed = onepole(bed * (1 + 0.15 * np.sin(2 * np.pi * 0.21 * t)), 700)
swell = np.clip(t / 1.6, 0, 1) * (1 - np.clip((t - (DUR - 0.5)) / 0.5, 0, 1))
bed_l = bed * swell
place(np.stack([bed_l, np.roll(bed_l, 300)], axis=1), 0, 0.05)

# ---- 01: the wordmark typing itself, then the mark closing
for i in range(9):
    place(tick(2300 + 140 * (i % 3)), TL["typeStart"] + i * TL["typeStep"], 0.05, pan=-0.25 + i * 0.06)
place(tone([220, 329.63], 1.6, attack=0.01, decay=0.5, bright=0.7), TL["markResolve"] + 0.2, 0.09)

# ---- UI presses: one small click each, like a trackpad
for k in ["pressAgenda", "pressStart", "pressSubnav", "pressRow", "pressFechar", "pressConfirm"]:
    place(click(), TL[k], 0.16, pan=0.1)
# the system answering: agenda updates, sale confirmed
place(tone([880, 1318.5], 0.9, attack=0.005, decay=0.25, bright=0.8), TL["result"], 0.05, pan=0.2)
place(tone([987.77, 1479.98], 0.9, attack=0.005, decay=0.25, bright=0.8), TL["numbersUpdate"], 0.05, pan=-0.2)

# ---- 05: open chord under the end card (A add9, spread)
chord = tone([110, 164.81, 220, 246.94, 329.63, 493.88], DUR - TL["lockupOut"][0], attack=0.6, decay=3.5, bright=0.6)
place(np.stack([chord, np.roll(chord, 480)], axis=1), TL["lockupOut"][0], 0.2)

# ---- master: gentle room, glue, -1 dBFS peak
wet = np.zeros_like(mix)
for d, g in [(0.031, 0.45), (0.043, 0.4), (0.057, 0.35)]:
    k = int(d * SR)
    for ch in range(2):
        y = mix[:, ch].copy()
        for r in range(1, 9):
            off = k * r + ch * 29
            if off >= N:
                break
            y[off:] += mix[:-off, ch] * g ** r
        wet[:, ch] += y
out = np.tanh((mix + wet * 0.05) * 1.1)
fade = np.minimum(1, (N - np.arange(N)) / (0.25 * SR))[:, None]
out = out * fade
out /= max(1e-9, np.max(np.abs(out))) / 0.89

with wave.open(sys.argv[2], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((out * 32767).astype("<i2").tobytes())
print("wrote", sys.argv[2])
