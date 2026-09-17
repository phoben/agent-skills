#!/usr/bin/env python3
"""Generate a 512x512 market icon for the repo-user-manual skill."""
from PIL import Image, ImageDraw

S = 512
SS = 4  # supersample factor
N = S * SS


def rounded_rect(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def main():
    img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # gradient background (rounded square)
    top = (43, 108, 255, 255)
    bottom = (22, 165, 240, 255)
    bg = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bg)
    rounded_rect(bd, [0, 0, N - 1, N - 1], radius=int(N * 0.22), fill=(0, 0, 0, 255))
    grad = Image.new("RGBA", (N, N))
    gd = ImageDraw.Draw(grad)
    for y in range(N):
        t = y / (N - 1)
        gd.line(
            [(0, y), (N, y)],
            fill=(
                int(top[0] + (bottom[0] - top[0]) * t),
                int(top[1] + (bottom[1] - top[1]) * t),
                int(top[2] + (bottom[2] - top[2]) * t),
                255,
            ),
        )
    bg.putalpha(bd.im)
    img.paste(grad, (0, 0), bg)

    # white document sheet with folded corner
    x0, y0, x1, y1 = int(N * 0.24), int(N * 0.16), int(N * 0.76), int(N * 0.84)
    fold = int(N * 0.14)
    sheet = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sheet)
    sd.polygon(
        [
            (x0, y0),
            (x1 - fold, y0),
            (x1, y0 + fold),
            (x1, y1),
            (x0, y1),
        ],
        fill=(255, 255, 255, 255),
    )
    # folded corner
    sd.polygon(
        [(x1 - fold, y0), (x1, y0 + fold), (x1 - fold, y0 + fold)],
        fill=(176, 205, 252, 255),
    )
    img.paste(sheet, (0, 0), sheet)

    # text lines on the sheet (blue bars)
    ld = ImageDraw.Draw(img)
    bar_x0, bar_x1 = int(N * 0.32), int(N * 0.62)
    y = int(N * 0.32)
    h = int(N * 0.038)
    gap = int(N * 0.085)
    for i, ratio in enumerate([1.0, 0.86, 0.94, 0.6]):
        w = int((bar_x1 - bar_x0) * ratio)
        ld.rounded_rectangle(
            [bar_x0, y, bar_x0 + w, y + h],
            radius=h // 2,
            fill=(43, 108, 255, 255) if i < 3 else (150, 178, 240, 255),
        )
        y += gap

    # magnifying glass (discovery) bottom-right over the sheet
    cx, cy = int(N * 0.66), int(N * 0.68)
    r = int(N * 0.135)
    lw = int(N * 0.045)
    ld.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 255, 255, 255), width=lw)
    ld.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(22, 130, 240, 255), width=lw)
    inner = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    idr = ImageDraw.Draw(inner)
    idr.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(43, 108, 255, 60))
    img.alpha_composite(inner)
    hl = int(N * 0.115)
    ld.line(
        [(cx + int(r * 0.72), cy + int(r * 0.72)), (cx + r + hl, cy + r + hl)],
        fill=(255, 255, 255, 255),
        width=lw + int(N * 0.012),
        joint="curve",
    )
    ld.line(
        [(cx + int(r * 0.72), cy + int(r * 0.72)), (cx + r + hl, cy + r + hl)],
        fill=(22, 130, 240, 255),
        width=lw,
        joint="curve",
    )

    img = img.resize((S, S), Image.LANCZOS)
    img.convert("RGB").save(r"E:\Develop\agent-skills\dist\icon-512.png", "PNG", optimize=True)


if __name__ == "__main__":
    main()
