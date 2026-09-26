"""Synthesizes the showreel soundtrack: 128 BPM, 32 beats = 15.000 s.
Every hit lines up with a cut or an impact in index.html.  python3 audio.py -> showreel.wav"""
import wave
import numpy as np

SR = 48000
BPM = 128
B = 60 / BPM
DUR = 15.0
N = int(SR * DUR)
rng = np.random.default_rng(3)
mix = np.zeros((N, 2))


def at(beat):
    return int(round(beat * B * SR))


def place(sig, beat, gain=1.0, pan=0.0):
    i = at(beat)
    if sig.ndim == 1:
        sig = np.stack([sig * np.sqrt(0.5 * (1 - pan)), sig * np.sqrt(0.5 * (1 + pan))], axis=1) * np.sqrt(2)
    j = min(N, i + len(sig))
    if i < N:
        mix[i:j] += sig[: j - i] * gain


def t_(sec):
    return np.arange(int(sec * SR)) / SR


def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * np.asarray(cutoff) / SR)
    y = np.zeros_like(x)
    acc = 0.0
    a = np.broadcast_to(a, x.shape)
    for n in range(len(x)):
        acc = (1 - a[n]) * x[n] + a[n] * acc
        y[n] = acc
    return y


def kick(dec=0.32, punch=1.0):
    t = t_(dec * 1.6)
    f = 45 + 140 * np.exp(-t * 32) * punch
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / dec * 2.2)
    click = rng.standard_normal(len(t)) * np.exp(-t * 400) * 0.25
    return np.tanh((body + click) * 1.6)


def snare():
    t = t_(0.28)
    n = rng.standard_normal(len(t))
    n = n - lowpass(n, 900)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30)
    return (n * np.exp(-t * 16) * 0.7 + tone * 0.5)


def hat(open_=False):
    t = t_(0.25 if open_ else 0.06)
    n = rng.standard_normal(len(t))
    n = n - lowpass(n, 7000)
    return n * np.exp(-t * (14 if open_ else 70)) * 0.5


def boom():
    t = t_(1.6)
    f = 30 + 90 * np.exp(-t * 5)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2)
    n = rng.standard_normal(len(t))
    n = lowpass(n, 1500 * np.exp(-t * 3) + 80) * np.exp(-t * 4)
    return np.tanh(s * 1.4 + n * 1.2)


def whoosh(sec, rising=True):
    t = t_(sec)
    u = t / sec
    env = u ** 2.2 if rising else (1 - u) ** 2
    n = rng.standard_normal(len(t))
    cut = 300 + 7000 * (u ** 2 if rising else (1 - u))
    bp = lowpass(n, cut) - lowpass(n, cut * 0.35)
    return bp * env * 2.5


def blip(freq, sec=0.18, shape='tri'):
    t = t_(sec)
    ph = (freq * t) % 1
    w = 4 * np.abs(ph - 0.5) - 1 if shape == 'tri' else np.sign(np.sin(2 * np.pi * freq * t)) * 0.5
    return w * np.exp(-t * 18)


def pluck(freq, sec=2.5, bright=1.0):
    t = t_(sec)
    s = sum(np.sin(2 * np.pi * freq * h * t) / h ** (1.6 / bright) * np.exp(-t * (1.2 + h * 0.9)) for h in range(1, 9))
    return s * 0.6


def saw(freq, t, detune=0.0):
    return 2 * ((freq * (1 + detune) * t) % 1) - 1


# ---- drums ------------------------------------------------------------------
# intro: the ball's impacts
for b, g in [(1, 0.9), (2, 0.75), (3, 0.6), (3.5, 0.3)]:
    place(kick(0.28), b, g)
    place(blip(880 * (1.26 ** (b - 1)), 0.12), b, 0.12, pan=-0.3 + 0.2 * b)
# four-on-the-floor from beat 4 to 28
for b in range(4, 28):
    place(kick(), b, 0.95)
    place(hat(), b + 0.5, 0.35, pan=0.3)
    if b % 2 == 1:
        place(snare(), b, 0.55, pan=-0.1)
    if b >= 20:  # montage: 16ths + open hats
        place(hat(), b + 0.25, 0.18, pan=-0.35)
        place(hat(), b + 0.75, 0.18, pan=0.35)
    if b >= 12 and b % 4 == 3:
        place(hat(True), b + 0.5, 0.25, pan=0.5)
# snare roll into the logo
for k in range(8):
    place(snare(), 27 + k / 8, 0.12 + 0.05 * k)

# ---- impacts & transitions ---------------------------------------------------
for b in [4, 8, 12, 16, 20, 24]:
    place(boom(), b, 0.55)
place(boom(), 28, 1.0)
for b, L in [(4, 0.5), (8, 0.9), (12, 0.6), (16, 0.7), (24, 0.5)]:
    place(whoosh(L * B), b - L, 0.5, pan=0.2)
place(whoosh(2 * B), 26, 0.8)          # long riser into the logo
place(whoosh(0.6, rising=False), 16, 0.4, pan=-0.4)  # white burn tail

# montage: a pitched blip on every cut (A minor pentatonic run)
pent = [440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66]
for i, f in enumerate(pent):
    place(blip(f, 0.2, 'sq'), 20 + i / 2, 0.12, pan=(-1) ** i * 0.5)

# data scene: counter ticks
for k in range(24):
    place(blip(2400 + 90 * (k % 6), 0.03), 24 + k / 8, 0.06 * (1 - k / 30), pan=0.4)

# ---- bass (sidechained to the kick) + pad -----------------------------------
chords = {4: (55.00, [220, 261.63, 329.63]), 8: (43.65, [174.61, 220, 261.63]),
          12: (65.41, [196, 261.63, 329.63]), 16: (49.00, [196, 246.94, 293.66]),
          20: (55.00, [220, 261.63, 329.63]), 24: (43.65, [174.61, 220, 261.63])}
for b, (root, notes) in chords.items():
    L = 4 * B
    t = t_(L)
    duck = 1 - 0.85 * np.exp(-((t % B) * 14))
    bass = np.tanh(2.2 * (np.sin(2 * np.pi * root * t) + 0.35 * np.sin(4 * np.pi * root * t)))
    bass = lowpass(bass, 400) * duck
    place(bass, b, 0.45)
    pad = sum(saw(f, t, d) for f in notes for d in (-0.004, 0.004)) / 6
    pad = lowpass(pad, 900 + 500 * np.sin(np.pi * t / L)) * (0.6 + 0.4 * duck)
    env = np.minimum(1, t / 0.08) * np.minimum(1, (L - t) / 0.08)
    place(np.stack([pad * env, np.roll(pad, 240) * env], axis=1), b, 0.22)

# ---- the resolve: sub drop + A minor add9 bloom + ball "ding" ----------------
t = t_(DUR - 28 * B)
sub = np.sin(2 * np.pi * 55 * t) * np.exp(-t * 1.4)
place(sub, 28, 0.6)
for f, p in [(220, -0.4), (261.63, 0.3), (329.63, -0.2), (493.88, 0.4), (659.25, 0)]:
    place(pluck(f, len(t) / SR, 1.3), 28, 0.22, pan=p)
place(pluck(1760, 1.6, 2.0), 30, 0.28, pan=0.2)     # the full stop lands
place(pluck(2637, 1.0, 2.0), 31, 0.16, pan=-0.2)    # it blinks lime

# ---- master: simple stereo reverb, glue, normalise ---------------------------
wet = np.zeros_like(mix)
for d, g in [(0.029, 0.5), (0.037, 0.45), (0.041, 0.42), (0.053, 0.38)]:
    k = int(d * SR)
    for ch in range(2):
        y = mix[:, ch].copy()
        for rep in range(1, 12):
            off = k * rep + ch * 37
            if off >= N:
                break
            y[off:] += mix[:-off, ch] * g ** rep
        wet[:, ch] += y
wet = wet - np.stack([lowpass(wet[:, c], 250) for c in range(2)], axis=1)
out = mix + wet * 0.06
out = np.tanh(out * 1.2)
fade = np.minimum(1, (N - np.arange(N)) / (0.15 * SR))[:, None]
out = out * fade
out /= np.max(np.abs(out)) / 0.89

with wave.open('showreel.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((out * 32767).astype('<i2').tobytes())
print('wrote showreel.wav', out.shape)
