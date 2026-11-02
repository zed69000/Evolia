# Prépare les cris du jeu à partir des enregistrements d'origine (art/audio-sources/bsb/<id>.mp3, BigSoundBank, CC0) :
# découpe, mono, fondus, volume à -16 LUFS (crête -1,5 dBTP, en deux passes pour ne pas « pomper »), MP3 léger.
# Usage : python tools/sfx/prepare.py <racine du dépôt>
import json
import re
import subprocess
import sys

FFMPEG = r'C:\Users\salzamora\AppData\Roaming\Python\Python312\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe'

# Nom dans le jeu, n° BigSoundBank, début et fin (s).
CUTS = [
    ('merle-1', '3483', 0.30, 2.10), ('merle-2', '3484', 0.80, 2.90), ('merle-3', '3485', 0.50, 1.50),
    ('rougegorge-1', '1667', 0.25, 2.00), ('rougegorge-2', '1668', 0.65, 2.45), ('rougegorge-3', '1670', 0.20, 2.90),
    ('fauvette-1', '3466', 1.85, 6.30), ('rossignol-1', '3087', 0.25, 2.90),
    ('hirondelle-1', '1016', 0.00, 3.35), ('hirondelle-2', '1015', 16.80, 19.60), ('hirondelle-3', '1015', 10.80, 14.40),
    ('hulotte-1', '1763', 0.10, 1.00), ('hulotte-2', '1764', 0.10, 1.00), ('hulotte-3', '1763', 5.15, 6.45),
    ('effraie-1', '1400', 0.25, 1.75), ('effraie-2', '1400', 4.85, 6.70),
    ('corneille-1', '3462', 0.00, 1.95), ('corneille-2', '3461', 0.00, 0.60),
    ('grenouille-1', '0997', 1.05, 3.30), ('grenouille-2', '0997', 15.65, 17.05), ('grenouille-3', '0819', 5.35, 9.75),
    ('crapaud-1', '1053', 8.00, 13.00),
    ('grillon-1', '1020', 0.20, 3.00), ('grillon-2', '1020', 15.00, 17.50),
    ('sauterelle-1', '3089', 5.00, 8.00), ('sauterelle-2', '3089', 16.00, 19.00),
    ('poule-1', '0282', 0.40, 2.55), ('poule-2', '0282', 4.00, 5.25), ('poule-3', '1039', 2.75, 4.65), ('poule-4', '0975', 16.10, 17.50),
    ('coq-1', '0440', 0.10, 2.20), ('coq-2', '0283', 0.00, 2.40),
    ('chien-1', '2954', 0.00, 0.70), ('chien-2', '2954', 2.40, 3.10), ('chien-3', '0916', 3.75, 4.55),
    ('chat-1', '1889', 1.20, 2.65), ('chat-2', '1890', 0.75, 2.05), ('chat-3', '0494', 0.00, 0.50),
    ('canard-1', '0276', 0.25, 2.20), ('canard-2', '0276', 5.30, 6.35), ('canard-3', '0276', 17.80, 20.80),
    ('bourdon-1', '1000', 1.50, 4.50),
]


def run(args):
    return subprocess.run([FFMPEG, '-hide_banner', '-nostdin', '-y', *args], capture_output=True, text=True, encoding='utf8', errors='ignore')


# Cris très « pointus » (un coup de bec, un aboiement) : la crête empêche d'atteindre -16 LUFS ; on l'écrête
# d'abord doucement avec un limiteur, sans quoi ils sonneraient bien plus bas que les autres.
PEAKY = {'canard-1', 'canard-2', 'canard-3', 'chien-1', 'chien-2', 'chien-3', 'poule-1', 'poule-2', 'poule-3', 'hirondelle-2'}


def main(root):
    for name, sid, a, b in CUTS:
        src, out = f'{root}/art/audio-sources/bsb/{sid}.mp3', f'{root}/public/sfx/{name}.mp3'
        d = b - a
        fades = f'afade=t=in:d=0.015,afade=t=out:st={d - 0.04:.3f}:d=0.04'
        if name in PEAKY: fades += ',alimiter=limit=0.25:attack=2:release=60:level=false'
        meas = run(['-ss', str(a), '-to', str(b), '-i', src, '-ac', '1', '-af', f'{fades},loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'])
        m = json.loads(re.findall(r'\{[^{}]*\}', meas.stderr)[-1])
        ln = (f"loudnorm=I=-16:TP=-2:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
              f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
        r = run(['-ss', str(a), '-to', str(b), '-i', src, '-ac', '1', '-af', f'{fades},{ln}', '-ar', '44100', '-c:a', 'libmp3lame', '-q:a', '6', out])
        if r.returncode: print("echec", name, r.stderr[-300:])
        else: print(f'{name:<14} {d:4.1f} s  {m["input_i"]:>6} LUFS -> -16')


main(sys.argv[1])
