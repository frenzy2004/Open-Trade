"""Deterministic cleanup for partial-alpha magenta background-removal spill."""

from __future__ import annotations

from PIL import Image


def remove_magenta_key_spill(image: Image.Image) -> Image.Image:
    """Clear only partial-alpha magenta key spill without mutating the source image."""
    cleaned = image.convert("RGBA").copy()
    pixels = cleaned.load()
    for y in range(cleaned.height):
        for x in range(cleaned.width):
            red, green, blue, alpha = pixels[x, y]
            if 0 < alpha < 255 and red > 120 and blue > 100 and min(red, blue) - green > 50:
                pixels[x, y] = (0, 0, 0, 0)
    return cleaned
