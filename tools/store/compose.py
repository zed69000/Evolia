# Assemble les captures Google Play (1080 x 1920) : le fond légendé (raw/fond-N.png, rendu depuis shot.html)
# et l'écran du jeu (raw/*.png, 1080 x 2338) posé dans un téléphone blanc à coins arrondis, avec une ombre douce.
#   python tools/store/compose.py
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

PLAY = Path(__file__).resolve().parents[2] / 'store' / 'play'
ORDER = ['1-marche.png', '4-parcelles.png', '2-especes.png', '3-fiche.png', '5-cabane.png', '6-cadeau.png']
W, H = 669, 1448            # écran dans le téléphone
X, Y, R, BORDER = (1080 - W) // 2, 410, 64, 12


def rounded(size, r):
    m = Image.new('L', size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=r, fill=255)
    return m


for n, name in enumerate(ORDER, 1):
    bg = Image.open(PLAY / 'raw' / f'fond-{n}.png').convert('RGB')
    shot = Image.open(PLAY / 'raw' / name).convert('RGB')
    shot = shot.resize((W, round(shot.height * W / shot.width)), Image.LANCZOS).crop((0, 0, W, H))
    # Ombre portée, puis le cadre blanc et son liseré, puis l'écran.
    shadow = Image.new('RGBA', bg.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((X - 16, Y + 14, X + W + 16, Y + H + 44), radius=R + 16, fill=(40, 60, 30, 70))
    bg = Image.alpha_composite(bg.convert('RGBA'), shadow.filter(ImageFilter.GaussianBlur(28)))
    ImageDraw.Draw(bg).rounded_rectangle((X - BORDER - 4, Y - BORDER - 4, X + W + BORDER + 3, Y + H + BORDER + 3), radius=R + BORDER + 4, fill=(228, 220, 196, 255))
    ImageDraw.Draw(bg).rounded_rectangle((X - BORDER, Y - BORDER, X + W + BORDER - 1, Y + H + BORDER - 1), radius=R + BORDER, fill=(255, 255, 255, 255))
    bg.paste(shot, (X, Y), rounded((W, H), R))
    bg.convert('RGB').save(PLAY / f'screenshot-{n}.png')
print('captures écrites dans', PLAY)
