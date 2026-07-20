import importlib.util
import json
import os
import subprocess
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

    def build_asset_fixture(self, fixture_root: Path) -> None:
        for relative_path in (
            "design/assets.csv",
            "design/thresholds.md",
            "design/higgsfield/generation-plan.json",
            "design/higgsfield/audio-plan.json",
        ):
            source = ROOT / relative_path
            destination = fixture_root / relative_path
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(source.read_bytes())

        generation_plan = json.loads((fixture_root / "design/higgsfield/generation-plan.json").read_text())
        audio_plan = json.loads((fixture_root / "design/higgsfield/audio-plan.json").read_text())
        for asset in generation_plan["assets"]:
            output = fixture_root / asset["output"]
            output.parent.mkdir(parents=True, exist_ok=True)
            if asset["transparent"]:
                image = Image.new("RGBA", (asset["width"], asset["height"]), (0, 0, 0, 0))
                ImageDraw.Draw(image).rectangle((1, 1, 8, 8), fill=(255, 255, 255, 255))
                image.save(output)
            else:
                Image.new("RGB", (asset["width"], asset["height"]), (23, 21, 17)).save(output, quality=88)

        run_sheet = fixture_root / "src/assets/generated/wallstreet-surfers/runner_run_f15_256x256_g4x4_fps16_loop.png"
        run_sheet.parent.mkdir(parents=True, exist_ok=True)
        runner = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
        ImageDraw.Draw(runner).rectangle((1, 1, 8, 8), fill=(255, 255, 255, 255))
        runner.save(run_sheet)
        for audio in audio_plan["assets"]:
            output = fixture_root / audio["output"]
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_bytes(b"ogg")

        jobs = fixture_root / "design/higgsfield/jobs"
        jobs.mkdir(parents=True, exist_ok=True)
        static_ids = [asset["id"] for asset in generation_plan["assets"]]
        audio_ids = [asset["id"] for asset in audio_plan["assets"]]
        for asset_id in [*static_ids, *audio_ids]:
            for stage in ("request", "complete"):
                (jobs / f"{asset_id}-{stage}.json").write_text("{}")
        for asset_id in [asset["id"] for asset in generation_plan["assets"] if asset["transparent"]]:
            for stage in ("request", "complete"):
                (jobs / f"{asset_id}-remove-bg-a1-{stage}.json").write_text("{}")
        for stage_name in ("ws-run-loop-key-pose", "ws-run-loop-video"):
            for stage in ("request", "complete"):
                (jobs / f"{stage_name}-{stage}.json").write_text("{}")
        for index in range(16):
            for stage in ("request", "complete"):
                (jobs / f"ws-run-loop-frame-{index:04d}-remove-bg-a1-{stage}.json").write_text("{}")
        (jobs / "ws-run-loop-assembly.json").write_text('{"frames":15}')

        all_ids = [*static_ids, "ws-run-loop", *audio_ids]
        review = fixture_root / "design/higgsfield/review.csv"
        review.write_text(
            "id,stage,attempt,model,accepted,inspection,compensation\n"
            + "\n".join(f"{asset_id},final,1,test,true,fixture,none" for asset_id in all_ids)
            + "\n"
        )
        catalog = fixture_root / "src/assets/catalog.ts"
        catalog.parent.mkdir(parents=True, exist_ok=True)
        catalog.write_text(
            "export const ASSET_CATALOG_IDS = [\n"
            + "\n".join(f"  '{asset_id}'," for asset_id in all_ids)
            + "\n] as const;\n"
        )

    def run_asset_validator(self, fixture_root: Path) -> subprocess.CompletedProcess[str]:
        environment = {**os.environ, "OPEN_TRADE_ASSET_ROOT": str(fixture_root)}
        return subprocess.run(
            ["node", str(ROOT / "scripts/assets/validate-assets.mjs")],
            text=True,
            capture_output=True,
            env=environment,
            check=False,
        )

    def test_validator_accepts_genuine_transparent_pngs(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            fixture_root = Path(temporary_directory)
            self.build_asset_fixture(fixture_root)
            result = self.run_asset_validator(fixture_root)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("asset validation passed: 16/16", result.stdout)

    def test_validator_rejects_opaque_rgba_pngs(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            fixture_root = Path(temporary_directory)
            self.build_asset_fixture(fixture_root)
            opaque_icon = fixture_root / "src/assets/generated/wallstreet-surfers/coin.png"
            Image.new("RGBA", (256, 256), (255, 255, 255, 255)).save(opaque_icon)
            result = self.run_asset_validator(fixture_root)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("ws-coin must contain at least one transparent pixel", result.stderr)

    def test_validator_requires_static_and_runner_removal_provenance(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            fixture_root = Path(temporary_directory)
            self.build_asset_fixture(fixture_root)
            (fixture_root / "design/higgsfield/jobs/ws-coin-remove-bg-a1-complete.json").unlink()
            (fixture_root / "design/higgsfield/jobs/ws-run-loop-frame-0015-remove-bg-a1-request.json").unlink()
            result = self.run_asset_validator(fixture_root)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("ws-coin background-removal completion provenance", result.stderr)
            self.assertIn("ws-run-loop frame 0015 background-removal request provenance", result.stderr)

    def test_validator_rejects_catalog_missing_and_extra_ids(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            fixture_root = Path(temporary_directory)
            self.build_asset_fixture(fixture_root)
            catalog = fixture_root / "src/assets/catalog.ts"
            catalog.write_text(
                "export const ASSET_CATALOG_IDS = [\n  'fs-draft-room',\n  'not-a-manifest-id',\n] as const;\n"
            )
            result = self.run_asset_validator(fixture_root)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("asset catalog IDs missing:", result.stderr)
            self.assertIn("asset catalog IDs extra: not-a-manifest-id", result.stderr)

    def test_background_removal_preflight_rejects_15_frames_without_a_paid_call(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            temporary = Path(temporary_directory)
            frames = temporary / "frames"
            frames.mkdir()
            for index in range(15):
                Image.new("RGBA", (8, 8), (0, 0, 0, 0)).save(frames / f"{index:04d}.png")
            paid_call_marker = temporary / "paid-call-marker"
            command = (
                "$ErrorActionPreference = 'Stop'; try { & { function higgsfield { "
                f"New-Item -ItemType File -Path '{paid_call_marker.as_posix()}' | Out-Null; throw 'remote invocation' }}; "
                f"& '{(ROOT / 'scripts/assets/remove-backgrounds.ps1').as_posix()}' "
                f"-FrameRoot '{frames.as_posix()}' -OutputRoot '{(temporary / 'output').as_posix()}' "
                f"-JobsDirectory '{(temporary / 'jobs').as_posix()}' }}; exit 0 }} "
                "catch { Write-Error $_; exit 1 }"
            )
            result = subprocess.run(
                ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
                text=True,
                capture_output=True,
                check=False,
            )
            output = result.stdout + result.stderr
            self.assertNotEqual(result.returncode, 0)
            self.assertRegex(output, r"Expected exactly 16\s+animation frames")
            self.assertFalse(paid_call_marker.exists(), "preflight reached the Higgsfield command")


if __name__ == "__main__":
    unittest.main()
