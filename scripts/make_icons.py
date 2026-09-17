"""Genera los iconos PNG del PWA (192, 512 y maskable 512)."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "backend" / "web" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

TOP = (59, 130, 246)      # #3b82f6
BOTTOM = (29, 78, 216)    # #1d4ed8
GREEN = (34, 197, 94)     # #22c55e


def font(size):
    for name in ("arialbd.ttf", "Arial Bold.ttf", "segoeuib.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def gradient(size):
    img = Image.new("RGB", (size, size))
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / (size - 1)
        d.line([(0, y), (size, y)], fill=tuple(int(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3)))
    return img


def draw_mark(img, size, scale, rounded):
    """Dibuja una 'N' con una flecha ascendente, centrada."""
    d = ImageDraw.Draw(img)
    f = font(int(size * scale))
    text = "N"
    box = d.textbbox((0, 0), text, font=f)
    tw, th = box[2] - box[0], box[3] - box[1]
    cx, cy = size / 2, size / 2
    d.text((cx - tw / 2 - box[0], cy - th / 2 - box[1]), text, font=f, fill=(255, 255, 255))

    # pequeña flecha ascendente en la esquina inferior derecha
    w = max(3, int(size * 0.05))
    ax, ay = cx + tw * 0.42, cy + th * 0.42
    d.line([(ax - w * 2, ay), (ax, ay - w * 2)], fill=GREEN, width=w)
    d.line([(ax - w * 3, ay - w * 1.2), (ax, ay - w * 2)], fill=GREEN, width=w)


def rounded_icon(size, radius_ratio=0.22):
    base = gradient(size).convert("RGBA")
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(base, (0, 0), mask)
    draw_mark(out, size, 0.56, True)
    return out


def maskable(size):
    base = gradient(size).convert("RGBA")
    draw_mark(base, size, 0.44, False)
    return base


rounded_icon(192).save(OUT / "icon-192.png")
rounded_icon(512).save(OUT / "icon-512.png")
maskable(512).save(OUT / "icon-maskable-512.png")
print("Iconos generados en", OUT)
