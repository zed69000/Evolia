# Icônes Android du jeu, à partir de public/assets/icon-512.png (le logo sur papier crème).
#   python tools/app/make_icon.py
# Écrit tools/app/android-res/mipmap-*/ic_launcher.png (carré arrondi) et ic_launcher_round.png (rond).
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "public" / "assets" / "icon-512.png"
OUT = ROOT / "tools" / "app" / "android-res"
SIZES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}

logo = Image.open(SRC).convert("RGBA")
for density, n in SIZES.items():
    big = logo.resize((n * 4, n * 4), Image.LANCZOS)
    for name, radius in (("ic_launcher", n * 4 // 5), ("ic_launcher_round", n * 2)):
        mask = Image.new("L", big.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, big.width - 1, big.height - 1), radius=radius, fill=255)
        icon = Image.new("RGBA", big.size, (0, 0, 0, 0))
        icon.paste(big, (0, 0), mask)
        folder = OUT / f"mipmap-{density}"
        folder.mkdir(parents=True, exist_ok=True)
        icon.resize((n, n), Image.LANCZOS).save(folder / f"{name}.png")
print("icônes écrites dans", OUT)
