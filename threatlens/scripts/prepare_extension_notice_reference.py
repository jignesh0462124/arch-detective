"""Rasterize approved non-identifying excerpts of the supplied two-page notice.

This deliberately does not copy the PDF, full email or its metadata. Output is
flattened PNG, not an overlay that could reveal underlying cropped content.
Run only against the reviewed reference; visually approve both images before use.
"""
from pathlib import Path
import argparse

import fitz


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    document = fitz.open(args.source)
    if len(document) != 2:
        raise ValueError("Expected the reviewed two-page reference")
    args.output.mkdir(parents=True, exist_ok=True)
    # Fractional bounds exclude the entire Gmail header, item name/ID, mail URL,
    # routing reference, timestamps, and footer from the inspected source.
    for page_number, bounds in enumerate(((.16, .535, .94, .94), (.16, .035, .94, .35))):
        page = document[page_number]
        rect = page.rect
        clip = fitz.Rect(bounds[0] * rect.width, bounds[1] * rect.height,
                         bounds[2] * rect.width, bounds[3] * rect.height)
        page.get_pixmap(matrix=fitz.Matrix(2, 2), clip=clip, alpha=False).save(
            args.output / f"chrome-blue-argon-reference-{page_number + 1}.png")
    print("Prepared two cropped reference images; visual privacy review is required.")


if __name__ == "__main__":
    main()
