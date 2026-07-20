import importlib.util
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[2]


def load_module(name: str, relative_path: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative_path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class SpriteToolsTest(unittest.TestCase):
    def test_select_indices_preserves_endpoints_and_has_unique_rounded_values(self):
        select_frames = load_module("select_frames", "scripts/assets/select_frames.py")
        indices = select_frames.select_indices(47, 16)

        self.assertEqual(indices[0], 0)
        self.assertEqual(indices[-1], 46)
        self.assertEqual(len(indices), 16)
        self.assertEqual(len(set(indices)), 16)

    def test_assemble_sheet_uses_union_bounds_bottom_center_and_drops_loop_endpoint(self):
        assemble = load_module("assemble_spritesheet", "scripts/assets/assemble_spritesheet.py")
        with tempfile.TemporaryDirectory() as temporary_directory:
            temporary = Path(temporary_directory)
            frame_paths = []
            for index in range(15):
                box = ((10, 8, 30, 40), (6, 12, 38, 44))[index % 2]
                frame = Image.new("RGBA", (48, 48))
                ImageDraw.Draw(frame).rectangle(box, fill=(255, 255, 255, 255))
                frame_path = temporary / f"frame-{index}.png"
                frame.save(frame_path)
                frame_paths.append(str(frame_path))
            frame_paths.append(frame_paths[0])
            output_path = temporary / "runner_run_f15_256x256_g4x4_fps16_loop.png"

            assemble.assemble_sheet(
                frame_paths,
                str(output_path),
            )

            with Image.open(output_path) as sheet:
                self.assertEqual(sheet.mode, "RGBA")
                self.assertEqual(sheet.size, (1024, 1024))
                self.assertEqual(sheet.getbbox(), (115, 219, 912, 1024))

    def test_assemble_sheet_requires_15_frames_in_a_4_by_4_grid_and_exact_filename(self):
        assemble = load_module("assemble_spritesheet", "scripts/assets/assemble_spritesheet.py")
        with tempfile.TemporaryDirectory() as temporary_directory:
            temporary = Path(temporary_directory)
            frame = Image.new("RGBA", (32, 32), (255, 255, 255, 255))
            frame_paths = []
            for index in range(16):
                frame_path = temporary / f"frame-{index}.png"
                frame.save(frame_path)
                frame_paths.append(str(frame_path))

            wrong_name = temporary / "runner.png"
            with self.assertRaisesRegex(ValueError, "runner_run_f15_256x256_g4x4_fps16_loop.png"):
                assemble.assemble_sheet(frame_paths, str(wrong_name))

            correct_name = temporary / "runner_run_f15_256x256_g4x4_fps16_loop.png"
            assemble.assemble_sheet(frame_paths, str(correct_name))
            with Image.open(correct_name) as sheet:
                self.assertEqual(sheet.size, (1024, 1024))
                self.assertEqual(len(assemble.last_assembled_frames), 15)


if __name__ == "__main__":
    unittest.main()
