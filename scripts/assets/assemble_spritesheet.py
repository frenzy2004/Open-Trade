"""Assemble a bottom-anchored runner spritesheet from transparent frames."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageChops

try:
    from key_spill_cleanup import remove_magenta_key_spill
except ImportError:
    from scripts.assets.key_spill_cleanup import remove_magenta_key_spill


EXPECTED_FILENAME = "runner_run_f15_256x256_g4x4_fps16_loop.png"
last_assembled_frames: list[str] = []


def _images_match(first: Image.Image, second: Image.Image) -> bool:
    return first.size == second.size and ImageChops.difference(first, second).getbbox() is None


def _union_bounds(images: list[Image.Image]) -> tuple[int, int, int, int]:
    boxes = [image.getchannel("A").getbbox() for image in images]
    if any(box is None for box in boxes):
        raise ValueError("every frame must contain visible alpha art")
    visible_boxes = [box for box in boxes if box is not None]
    return (
        min(box[0] for box in visible_boxes),
        min(box[1] for box in visible_boxes),
        max(box[2] for box in visible_boxes),
        max(box[3] for box in visible_boxes),
    )


def _contain(image: Image.Image, cell_size: tuple[int, int]) -> Image.Image:
    maximum_width, maximum_height = cell_size
    scale = min(maximum_width / image.width, maximum_height / image.height, 1)
    if scale == 1:
        return image
    return image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)


def assemble_sheet(
    frame_paths: list[str],
    output_path: str,
    cell_size: tuple[int, int] = (256, 256),
    columns: int = 4,
    rows: int = 4,
    fps: int = 16,
    loop: bool = True,
) -> None:
    """Union-crop, bottom-center, drop duplicate loop endpoint, and save RGBA PNG."""
    output = Path(output_path)
    if output.name != EXPECTED_FILENAME:
        raise ValueError(f"spritesheet filename must be {EXPECTED_FILENAME}")
    if cell_size != (256, 256) or columns != 4 or rows != 4 or fps != 16:
        raise ValueError("runner sheet must use 256x256 cells, a 4x4 grid, and 16 fps")
    if not loop:
        raise ValueError("runner sheet must be a looping animation")

    source_images = [Image.open(path).convert("RGBA") for path in frame_paths]
    try:
        if len(source_images) < 2 or not _images_match(source_images[0], source_images[-1]):
            raise ValueError("loop input must repeat its first frame as the final frame")
        images = [remove_magenta_key_spill(image) for image in source_images[:-1]]
        if len(images) != 15:
            raise ValueError("runner sheet requires 16 selected frames that reduce to 15 unique loop frames")
        bounds = _union_bounds(images)
        cell_width, cell_height = cell_size
        sheet = Image.new("RGBA", (cell_width * columns, cell_height * rows))
        for index, image in enumerate(images):
            cropped = _contain(image.crop(bounds), cell_size)
            position_x = (index % columns) * cell_width + (cell_width - cropped.width) // 2
            position_y = (index // columns) * cell_height + cell_height - cropped.height
            sheet.alpha_composite(cropped, (position_x, position_y))
        output.parent.mkdir(parents=True, exist_ok=True)
        remove_magenta_key_spill(sheet).save(output, format="PNG", optimize=True)
        global last_assembled_frames
        last_assembled_frames = list(frame_paths[:-1])
    finally:
        for image in source_images:
            image.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("frame_directory", type=Path)
    parser.add_argument("output_path", type=Path)
    parser.add_argument("--frame-count", type=int, default=16)
    parser.add_argument("--cell-width", type=int, default=256)
    parser.add_argument("--cell-height", type=int, default=256)
    parser.add_argument("--columns", type=int, default=4)
    parser.add_argument("--rows", type=int, default=4)
    parser.add_argument("--fps", type=int, default=16)
    parser.add_argument("--loop", action="store_true")
    arguments = parser.parse_args()
    paths = sorted(arguments.frame_directory.glob("*.png"))
    if len(paths) != arguments.frame_count:
        raise ValueError(f"expected {arguments.frame_count} frames; found {len(paths)}")
    assemble_sheet(
        [str(path) for path in paths],
        str(arguments.output_path),
        (arguments.cell_width, arguments.cell_height),
        arguments.columns,
        arguments.rows,
        arguments.fps,
        arguments.loop,
    )


if __name__ == "__main__":
    main()
