"""Select evenly spaced animation frames while preserving both endpoints."""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path


def select_indices(total: int, count: int) -> list[int]:
    """Return unique rounded linspace indices including 0 and total - 1."""
    if count < 1:
        raise ValueError("count must be at least one")
    if total < count:
        raise ValueError("total frame count must be at least the requested count")
    if count == 1:
        return [0]
    indices = [round(index * (total - 1) / (count - 1)) for index in range(count)]
    if len(set(indices)) != count:
        raise ValueError("rounded selection produced duplicate indices")
    return indices


def select_frames(input_directory: Path, output_directory: Path, count: int) -> list[Path]:
    """Copy selected PNG frames in stable source order and return their destinations."""
    source_paths = sorted(input_directory.glob("*.png"))
    indices = select_indices(len(source_paths), count)
    output_directory.mkdir(parents=True, exist_ok=True)
    selected_paths: list[Path] = []
    for destination_index, source_index in enumerate(indices):
        destination = output_directory / f"{destination_index:04d}.png"
        shutil.copy2(source_paths[source_index], destination)
        selected_paths.append(destination)
    return selected_paths


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_directory", type=Path)
    parser.add_argument("output_directory", type=Path)
    parser.add_argument("--count", type=int, default=16)
    arguments = parser.parse_args()
    select_frames(arguments.input_directory, arguments.output_directory, arguments.count)


if __name__ == "__main__":
    main()
