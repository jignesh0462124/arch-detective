"""Generate Archon raster brand assets from the canonical shield geometry."""

from __future__ import annotations

from math import comb
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
BRAND = PUBLIC / "brand"
INK = "#111111"
ORANGE = "#ff5600"
CREAM = "#f5f1ec"
WHITE = "#ffffff"
MUTED = "#626260"
HAIRLINE = "#d3cec6"


def bezier(points: list[tuple[float, float]], steps: int = 18) -> list[tuple[float, float]]:
    degree = len(points) - 1
    result: list[tuple[float, float]] = []
    for index in range(steps + 1):
        value = index / steps
        x = sum(
            comb(degree, item)
            * ((1 - value) ** (degree - item))
            * (value**item)
            * point[0]
            for item, point in enumerate(points)
        )
        y = sum(
            comb(degree, item)
            * ((1 - value) ** (degree - item))
            * (value**item)
            * point[1]
            for item, point in enumerate(points)
        )
        result.append((x, y))
    return result


def shield_points() -> list[tuple[float, float]]:
    return [
        (32, 5),
        (10, 16),
        (10, 32),
        *bezier([(10, 32), (10, 45.2), (19.2, 56.8), (32, 60)])[1:],
        *bezier([(32, 60), (44.8, 56.8), (54, 45.2), (54, 32)])[1:],
        (54, 16),
    ]


def draw_mark(
    image: Image.Image,
    box: tuple[float, float, float, float],
    shield_color: str,
    accent_color: str = ORANGE,
) -> None:
    draw = ImageDraw.Draw(image, "RGBA")
    x, y, width, height = box
    scale = min(width, height) / 64
    offset_x = x + (width - 64 * scale) / 2
    offset_y = y + (height - 64 * scale) / 2

    def point(px: float, py: float) -> tuple[int, int]:
        return (round(offset_x + px * scale), round(offset_y + py * scale))

    outline = [point(px, py) for px, py in shield_points()]
    fill_alpha = 20 if shield_color == WHITE else 16
    rgb = (255, 255, 255) if shield_color == WHITE else (17, 17, 17)
    transparent_canvas = image.mode == "RGBA" and image.getpixel((0, 0))[3] == 0
    if transparent_canvas:
        shield_fill = (*rgb, fill_alpha)
    elif shield_color == WHITE:
        shield_fill = (36, 36, 36, 255)
    else:
        shield_fill = (238, 238, 238, 255)
    draw.polygon(outline, fill=shield_fill)
    draw.line(
        outline + [outline[0]],
        fill=shield_color,
        width=max(1, round(3 * scale)),
        joint="curve",
    )

    stroke = max(1, round(3.5 * scale))
    for start, end in [
        ((20, 33), (28, 33)),
        ((36, 33), (44, 33)),
        ((32, 21), (32, 29)),
        ((32, 37), (32, 45)),
    ]:
        draw.line(
            [point(*start), point(*end)],
            fill=accent_color,
            width=stroke,
        )
    center_x, center_y = point(32, 33)
    radius = max(1, round(3.25 * scale))
    draw.ellipse(
        (center_x - radius, center_y - radius, center_x + radius, center_y + radius),
        fill=accent_color,
    )


def downsample(image: Image.Image, size: tuple[int, int], destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.resize(size, Image.Resampling.LANCZOS).save(destination, optimize=True)


def make_icon(size: int, destination: Path, transparent: bool = False) -> None:
    multiplier = 4
    canvas = Image.new(
        "RGBA",
        (size * multiplier, size * multiplier),
        (0, 0, 0, 0) if transparent else INK,
    )
    draw = ImageDraw.Draw(canvas)
    if not transparent:
        draw.rounded_rectangle(
            (0, 0, size * multiplier - 1, size * multiplier - 1),
            radius=round(size * multiplier * 0.18),
            fill=INK,
        )
    inset = size * multiplier * (0.1 if transparent else 0.18)
    draw_mark(
        canvas,
        (inset, inset, size * multiplier - 2 * inset, size * multiplier - 2 * inset),
        INK if transparent else WHITE,
    )
    downsample(canvas, (size, size), destination)


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    name = "segoeuib.ttf" if bold else "segoeui.ttf"
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / name), size=size)


def make_social() -> None:
    scale = 2
    canvas = Image.new("RGB", (1200 * scale, 630 * scale), CREAM)
    draw = ImageDraw.Draw(canvas)

    def rect(box: tuple[int, int, int, int], **kwargs: object) -> None:
        draw.rounded_rectangle(tuple(value * scale for value in box), **kwargs)

    rect((48, 48, 1152, 582), radius=8, fill=WHITE, outline=HAIRLINE, width=3)
    rect((96, 104, 240, 248), radius=32, fill=INK)
    draw_mark(canvas, (136 * scale, 144 * scale, 64 * scale, 64 * scale), WHITE)

    draw.text((96 * scale, 292 * scale), "Archon", font=load_font(72 * scale, True), fill=INK)
    draw.text(
        (99 * scale, 389 * scale),
        "Agentic compliance & threat modeling",
        font=load_font(25 * scale),
        fill=MUTED,
    )
    draw.text(
        (99 * scale, 429 * scale),
        "for production systems.",
        font=load_font(25 * scale),
        fill=MUTED,
    )
    draw.rectangle((96 * scale, 524 * scale, 112 * scale, 528 * scale), fill=ORANGE)
    draw.text((124 * scale, 510 * scale), "AUDIT ENGINE", font=load_font(15 * scale, True), fill=MUTED)

    rect((678, 138, 1056, 478), radius=8, fill=INK)
    draw.text((710 * scale, 171 * scale), "AUDIT PIPELINE", font=load_font(16 * scale), fill="#b8b8b5")
    orange_width = 4 * scale
    draw.line(
        [(731 * scale, 244 * scale), (731 * scale, 400 * scale), (1001 * scale, 400 * scale)],
        fill=ORANGE,
        width=orange_width,
    )
    nodes = [(731, 244), (731, 322), (731, 400), (866, 400), (1001, 400)]
    for node_x, node_y in nodes:
        radius = 9 * scale
        draw.ellipse(
            (
                node_x * scale - radius,
                node_y * scale - radius,
                node_x * scale + radius,
                node_y * scale + radius,
            ),
            fill=ORANGE,
        )
    for label, position in [("Ingest", (758, 232)), ("Analyze", (758, 310))]:
        draw.text(
            (position[0] * scale, position[1] * scale),
            label,
            font=load_font(18 * scale, True),
            fill=WHITE,
        )
    for label, position in [("Map", (708, 432)), ("Verify", (840, 432)), ("Report", (970, 432))]:
        draw.text(
            (position[0] * scale, position[1] * scale),
            label,
            font=load_font(16 * scale, True),
            fill=WHITE,
        )
    downsample(canvas, (1200, 630), PUBLIC / "og-image.png")


def make_logo_sheet() -> None:
    canvas = Image.new("RGB", (1600, 1000), CREAM)
    draw = ImageDraw.Draw(canvas)
    draw.text((96, 76), "Archon identity system", font=load_font(52, True), fill=INK)
    draw.text((98, 145), "Shielded analysis. Precise audit signal.", font=load_font(24), fill=MUTED)
    panels = [
        ((96, 232, 536, 672), WHITE, INK, "Primary / light"),
        ((580, 232, 1020, 672), INK, WHITE, "Primary / dark"),
        ((1064, 232, 1504, 672), WHITE, INK, "Monochrome"),
    ]
    for index, (box, background, shield, label) in enumerate(panels):
        draw.rounded_rectangle(box, radius=4, fill=background, outline=HAIRLINE, width=1)
        draw_mark(canvas, (box[0] + 120, box[1] + 90, 200, 200), shield, INK if index == 2 else ORANGE)
        draw.text(
            (box[0] + 32, box[3] - 62),
            label,
            font=load_font(18, True),
            fill=WHITE if background == INK else INK,
        )
    draw.text((96, 750), "ARCHON", font=load_font(86, True), fill=INK)
    draw.rectangle((98, 865, 128, 871), fill=ORANGE)
    draw.text((148, 845), "AUDIT ENGINE", font=load_font(22, True), fill=MUTED)
    draw.text((1064, 790), "#111111", font=load_font(18, True), fill=INK)
    draw.text((1064, 830), "#FF5600", font=load_font(18, True), fill=ORANGE)
    draw.text((1064, 870), "#F5F1EC", font=load_font(18, True), fill=MUTED)
    canvas.save(BRAND / "archon-logo-sheet.png", optimize=True)


def main() -> None:
    BRAND.mkdir(parents=True, exist_ok=True)
    make_icon(32, PUBLIC / "favicon.png")
    make_icon(180, PUBLIC / "apple-touch-icon.png")
    make_icon(192, PUBLIC / "icon-192.png")
    make_icon(512, PUBLIC / "icon-512.png")
    make_icon(512, ROOT / "docs" / "logo.png", transparent=True)
    make_social()
    make_logo_sheet()
    print("Generated Archon raster brand assets.")


if __name__ == "__main__":
    main()
