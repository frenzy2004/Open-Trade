"""Process accepted Higgsfield images into deterministic shipped assets and review sheets."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageOps


LANCZOS = Image.Resampling.LANCZOS
OFF_BLACK = (23, 21, 17, 255)
WARM_IVORY = (245, 238, 219, 255)


def cover_crop(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    """Cover-crop an image to its exact target dimensions using LANCZOS."""
    return ImageOps.fit(image.convert("RGB"), size, method=LANCZOS, centering=(0.5, 0.5))


def contain_alpha(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    """Contain transparent artwork in an exact alpha PNG canvas without metadata."""
    source = image.convert("RGBA")
    source.thumbnail(size, LANCZOS)
    canvas = Image.new("RGBA", size)
    canvas.alpha_composite(source, ((size[0] - source.width) // 2, (size[1] - source.height) // 2))
    return canvas


def save_image(image: Image.Image, output: Path, background: bool) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    if background:
        image.save(output, format="WEBP", quality=88, method=6)
    else:
        image.save(output, format="PNG", optimize=True)


def contact_sheet(images: list[tuple[str, Path]], output: Path, columns: int = 3) -> None:
    """Write a labelled, metadata-free contact sheet for human review."""
    if not images:
        return
    cell_width, cell_height = 320, 220
    rows = (len(images) + columns - 1) // columns
    sheet = Image.new("RGBA", (columns * cell_width, rows * cell_height), OFF_BLACK)
    for index, (_, image_path) in enumerate(images):
        with Image.open(image_path) as image:
            preview = image.convert("RGBA")
            preview.thumbnail((cell_width - 24, cell_height - 24), LANCZOS)
            x = (index % columns) * cell_width + (cell_width - preview.width) // 2
            y = (index // columns) * cell_height + (cell_height - preview.height) // 2
            sheet.alpha_composite(preview, (x, y))
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, format="PNG", optimize=True)


def compose_icon(coin_path: Path, output: Path, size: int) -> None:
    with Image.open(coin_path) as coin:
        icon = Image.new("RGBA", (size, size), OFF_BLACK)
        inset = max(12, size // 8)
        ivory_field = Image.new("RGBA", (size - 2 * inset, size - 2 * inset), WARM_IVORY)
        icon.alpha_composite(ivory_field, (inset, inset))
        coin_art = contain_alpha(coin, (size - 4 * inset, size - 4 * inset))
        icon.alpha_composite(coin_art, (2 * inset, 2 * inset))
        output.parent.mkdir(parents=True, exist_ok=True)
        icon.save(output, format="PNG", optimize=True)


def source_for(asset_id: str, raw_root: Path) -> Path:
    matches = sorted(raw_root.glob(f"{asset_id}.*"))
    if not matches:
        raise FileNotFoundError(f"Missing raw source for {asset_id} under {raw_root}")
    return matches[0]


def process(plan_path: Path, background_root: Path, alpha_root: Path, inspection_root: Path) -> None:
    plan = json.loads(plan_path.read_text(encoding="utf-8"))
    backgrounds: list[tuple[str, Path]] = []
    runner_kit: list[tuple[str, Path]] = []
    for asset in plan["assets"]:
        raw_root = background_root if asset["kind"] == "background" else alpha_root
        with Image.open(source_for(asset["id"], raw_root)) as raw:
            if asset["kind"] == "background":
                processed = cover_crop(raw, (asset["width"], asset["height"]))
                save_image(processed, Path(asset["output"]), background=True)
                backgrounds.append((asset["id"], Path(asset["output"])))
            else:
                processed = contain_alpha(raw, (asset["width"], asset["height"]))
                save_image(processed, Path(asset["output"]), background=False)
                runner_kit.append((asset["id"], Path(asset["output"])))

    coin = next(path for asset_id, path in runner_kit if asset_id == "ws-coin")
    compose_icon(coin, Path("public/icons/open-trade-192.png"), 192)
    compose_icon(coin, Path("public/icons/open-trade-512.png"), 512)
    contact_sheet(backgrounds, inspection_root / "backgrounds.png")
    contact_sheet(runner_kit, inspection_root / "runner-kit.png")
    contact_sheet([(asset_id, path) for asset_id, path in runner_kit if asset_id == "ws-runner-avatar"], inspection_root / "runner-scale.png", 1)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", type=Path, default=Path("design/higgsfield/generation-plan.json"))
    parser.add_argument("--background-root", type=Path, default=Path("work/higgsfield/raw/static"))
    parser.add_argument("--alpha-root", type=Path, default=Path("work/higgsfield/raw/alpha"))
    parser.add_argument("--inspection-root", type=Path, default=Path("work/higgsfield/inspection"))
    arguments = parser.parse_args()
    process(arguments.plan, arguments.background_root, arguments.alpha_root, arguments.inspection_root)


if __name__ == "__main__":
    main()
