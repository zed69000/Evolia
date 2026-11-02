# Repère les cris dans un enregistrement : les passages nettement plus forts que le fond, pour choisir où couper.
# Usage : python tools/sfx/segments.py fichier.mp3 …
import array
import math
import subprocess
import sys

FFMPEG = r'C:\Users\salzamora\AppData\Roaming\Python\Python312\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe'
RATE, WIN = 16000, 0.05


def envelope(path):
    raw = subprocess.run([FFMPEG, '-v', 'quiet', '-i', path, '-ac', '1', '-ar', str(RATE), '-f', 'f32le', '-'], capture_output=True).stdout
    a = array.array('f', raw)
    n = int(RATE * WIN)
    return [20 * math.log10(math.sqrt(sum(x * x for x in a[i:i + n]) / n) + 1e-9) for i in range(0, len(a) - n, n)]


def segments(env, drop=14, gap=0.35, least=0.15):
    top = sorted(env)[int(len(env) * 0.98)]
    floor = sorted(env)[int(len(env) * 0.3)]
    th = max(top - drop, floor + 6)
    out, start, last = [], None, None
    for i, v in enumerate(env):
        t = i * WIN
        if v >= th:
            if start is None or t - last > gap:
                if start is not None and last - start >= least: out.append((start, last + WIN))
                start = t
            last = t
    if start is not None and last - start >= least: out.append((start, last + WIN))
    return top, floor, out


if __name__ == '__main__':
    for p in sys.argv[1:]:
        env = envelope(p)
        top, floor, segs = segments(env)
        print(f'{p}: {len(env) * WIN:.1f} s, crête {top:.0f} dB, fond {floor:.0f} dB, {len(segs)} cris :',
              ' '.join(f'{a:.2f}-{b:.2f}' for a, b in segs[:12]))
