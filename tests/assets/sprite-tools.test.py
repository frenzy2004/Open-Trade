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
                (jobs / f"{asset_id}-a1-{stage}.json").write_text("{}")
        for asset_id in [asset["id"] for asset in generation_plan["assets"] if asset["transparent"]]:
            for stage in ("request", "complete"):
                (jobs / f"{asset_id}-remove-bg-a1-{stage}.json").write_text("{}")
        for stage_name in ("ws-run-loop-key-pose", "ws-run-loop-video"):
            for stage in ("request", "complete"):
                (jobs / f"{stage_name}-a1-{stage}.json").write_text("{}")
        for index in range(16):
            for stage in ("request", "complete"):
                (jobs / f"ws-run-loop-frame-{index:04d}-remove-bg-a1-{stage}.json").write_text("{}")
        (jobs / "ws-run-loop-assembly-a1.json").write_text('{"frames":15}')

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
                cwd=temporary,
                check=False,
            )
            output = result.stdout + result.stderr
            self.assertNotEqual(result.returncode, 0)
            self.assertRegex(output, r"Expected exactly 16\s+animation frames")
            self.assertFalse(paid_call_marker.exists(), "preflight reached the Higgsfield command")

    def test_runner_video_prompt_includes_the_exact_style_formula(self):
        style = (ROOT / "design/style-formula.txt").read_text(encoding="utf-8").rstrip("\r\n")
        result = subprocess.run(
            [
                "powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
                f"Import-Module '{(ROOT / 'scripts/assets/runner-tools.psm1').as_posix()}'; "
                f"New-RunnerVideoPrompt -StyleFormula (Get-Content -Raw '{(ROOT / 'design/style-formula.txt').as_posix()}').TrimEnd()",
            ],
            text=True,
            capture_output=True,
            check=False,
        )
        expected = (
            f"{style} fast forward sprint cycle in place. Camera locked, no camera movement, no zoom, "
            "subject stays fully in frame, plain static background. The character performs ONLY this action; "
            "nothing else happens. The subject keeps facing the same direction for the entire video - never turns "
            "around, never rotates toward or away from the camera, no head turns past the shoulder."
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.rstrip("\r\n"), expected)

    def test_runner_endpoint_helper_replaces_frame_0015_and_assembly_succeeds(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            temporary = Path(temporary_directory)
            frames = temporary / "alpha"
            frames.mkdir()
            for index in range(16):
                frame = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
                ImageDraw.Draw(frame).rectangle((index % 8, 1, index % 8 + 4, 12), fill=(255, 255, 255, 255))
                frame.save(frames / f"{index:04d}.png")
            before = (frames / "0015.png").read_bytes()
            result = subprocess.run(
                [
                    "powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
                    f"Import-Module '{(ROOT / 'scripts/assets/runner-tools.psm1').as_posix()}'; "
                    f"Set-RunnerLoopEndpoint -FrameDirectory '{frames.as_posix()}'",
                ],
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertNotEqual(before, (frames / "0015.png").read_bytes())
            self.assertEqual((frames / "0000.png").read_bytes(), (frames / "0015.png").read_bytes())
            output = temporary / "runner_run_f15_256x256_g4x4_fps16_loop.png"
            assembled = subprocess.run(
                ["python", str(ROOT / "scripts/assets/assemble_spritesheet.py"), str(frames), str(output), "--loop"],
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(assembled.returncode, 0, assembled.stderr)

    def test_validator_accepts_an_accepted_second_attempt(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            fixture_root = Path(temporary_directory)
            self.build_asset_fixture(fixture_root)
            jobs = fixture_root / "design/higgsfield/jobs"
            for stage in ("request", "complete"):
                (jobs / f"ws-run-loop-key-pose-a1-{stage}.json").rename(jobs / f"ws-run-loop-key-pose-a2-{stage}.json")
                (jobs / f"ws-run-loop-video-a1-{stage}.json").rename(jobs / f"ws-run-loop-video-a2-{stage}.json")
            for index in range(16):
                for stage in ("request", "complete"):
                    (jobs / f"ws-run-loop-frame-{index:04d}-remove-bg-a1-{stage}.json").rename(
                        jobs / f"ws-run-loop-frame-{index:04d}-remove-bg-a2-{stage}.json"
                    )
            (jobs / "ws-run-loop-assembly-a1.json").rename(jobs / "ws-run-loop-assembly-a2.json")
            review = fixture_root / "design/higgsfield/review.csv"
            review.write_text(review.read_text().replace("ws-run-loop,final,1", "ws-run-loop,final,2"))
            result = self.run_asset_validator(fixture_root)
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_validator_rejects_an_accepted_third_attempt(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            fixture_root = Path(temporary_directory)
            self.build_asset_fixture(fixture_root)
            review = fixture_root / "design/higgsfield/review.csv"
            review.write_text(review.read_text().replace("ws-coin,final,1", "ws-coin,final,3"))
            result = self.run_asset_validator(fixture_root)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("ws-coin accepted review attempt must be 1 or 2", result.stderr)

    def test_process_images_uses_each_static_asset_review_selected_attempt(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            temporary = Path(temporary_directory)
            plan_path = temporary / "design/higgsfield/generation-plan.json"
            plan_path.parent.mkdir(parents=True)
            plan_path.write_bytes((ROOT / "design/higgsfield/generation-plan.json").read_bytes())
            plan = json.loads(plan_path.read_text())
            background_root = temporary / "raw/static"
            alpha_root = temporary / "raw/alpha"
            review_path = temporary / "design/higgsfield/review.csv"
            review_path.parent.mkdir(parents=True, exist_ok=True)
            review_rows = ["id,stage,attempt,model,accepted,inspection,compensation"]
            for asset in plan["assets"]:
                accepted_attempt = 2 if asset["id"] in {"fs-draft-room", "ws-coin"} else 1
                review_rows.append(f"{asset['id']},final,{accepted_attempt},test,true,fixture,none")
                for attempt, color in ((1, (220, 20, 20, 255)), (2, (20, 220, 20, 255))):
                    raw_root = alpha_root if asset["transparent"] else background_root
                    source = raw_root / f"attempt-{attempt}" / f"{asset['id']}.png"
                    source.parent.mkdir(parents=True, exist_ok=True)
                    image = Image.new("RGBA", (64, 64), color)
                    image.save(source)
            review_path.write_text("\n".join(review_rows) + "\n")
            result = subprocess.run(
                [
                    "python", str(ROOT / "scripts/assets/process-images.py"), "--plan", str(plan_path),
                    "--background-root", str(background_root), "--alpha-root", str(alpha_root),
                    "--review", str(review_path), "--inspection-root", str(temporary / "inspection"),
                ],
                text=True,
                capture_output=True,
                cwd=temporary,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            with Image.open(temporary / "src/assets/generated/fanstocks/draft-room.webp") as image:
                red, green, _ = image.convert("RGB").getpixel((0, 0))
                self.assertGreater(green, red)
            with Image.open(temporary / "src/assets/generated/wallstreet-surfers/coin.png") as image:
                red, green, _, _ = image.getpixel((128, 128))
                self.assertGreater(green, red)

    def test_normalize_audio_uses_review_selected_attempt_directories(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            temporary = Path(temporary_directory)
            plan_path = temporary / "design/higgsfield/audio-plan.json"
            plan_path.parent.mkdir(parents=True)
            plan_path.write_bytes((ROOT / "design/higgsfield/audio-plan.json").read_bytes())
            plan = json.loads(plan_path.read_text())
            review_path = temporary / "design/higgsfield/review.csv"
            review_rows = ["id,stage,attempt,model,accepted,inspection,compensation"]
            raw_root = temporary / "raw/audio"
            expected_inputs = []
            for asset in plan["assets"]:
                attempt = 2 if asset["id"] == "arcade-loop" else 1
                review_rows.append(f"{asset['id']},final,{attempt},test,true,fixture,none")
                for candidate in (1, 2):
                    source = raw_root / f"attempt-{candidate}" / f"{asset['id']}.wav"
                    source.parent.mkdir(parents=True, exist_ok=True)
                    source.write_bytes(f"{asset['id']}-attempt-{candidate}".encode())
                expected_inputs.append(raw_root / f"attempt-{attempt}" / f"{asset['id']}.wav")
            review_path.write_text("\n".join(review_rows) + "\n")
            marker = temporary / "ffmpeg-inputs.txt"
            command = (
                f"function ffmpeg {{ Add-Content -Path '{marker.as_posix()}' -Value ($args -join '|'); $global:LASTEXITCODE=0 }}; "
                f"& '{(ROOT / 'scripts/assets/normalize-audio.ps1').as_posix()}' -PlanPath '{plan_path.as_posix()}' "
                f"-RawDirectory '{raw_root.as_posix()}' -ReviewPath '{review_path.as_posix()}'"
            )
            result = subprocess.run(
                ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
                text=True,
                capture_output=True,
                cwd=temporary,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            calls = marker.read_text()
            for expected_input in expected_inputs:
                self.assertIn(str(expected_input), calls)
            self.assertNotIn(str(raw_root / "attempt-1/arcade-loop.wav"), calls)

    def test_asset_runtime_requirements_are_pinned(self):
        self.assertEqual(
            (ROOT / "requirements-assets.txt").read_text(encoding="utf-8"),
            "Pillow==12.3.0\nnumpy==2.5.1\n",
        )

    def test_higgsfield_response_tools_accept_exact_cli_shapes_and_prefer_result_url(self):
        result = subprocess.run(
            [
                "powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
                f"Import-Module '{(ROOT / 'scripts/assets/higgsfield-job-tools.psm1').as_posix()}'; "
                "Write-Output (Get-HiggsfieldJobId -JsonText @('[', '  \"ba919da5-687d-46c6-962c-472511ffa018\"', ']')); "
                "Write-Output (Get-HiggsfieldResultUrl -JsonText @('{', '  \"status\": \"completed\",', '  \"result_url\": \"https://full.example/result\",', '  \"min_result_url\": \"https://min.example/result\"', '}')); "
                "Write-Output (Get-HiggsfieldJobId -JsonText '{\"job_id\":\"legacy-job\"}'); "
                "Write-Output (Get-HiggsfieldResultUrl -JsonText '{\"output\":{\"url\":\"https://legacy.example/result\"}}')",
            ],
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.splitlines(), ["ba919da5-687d-46c6-962c-472511ffa018", "https://full.example/result", "legacy-job", "https://legacy.example/result"])

    def test_static_and_audio_resume_with_complete_raw_data_without_higgsfield_calls(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            temporary = Path(temporary_directory)
            jobs = temporary / "jobs"
            jobs.mkdir()
            static_plan = temporary / "static-plan.json"
            static_plan.write_text(
                '{"styleFormulaFile":"style.txt","assets":[{"id":"fm-boardroom","kind":"background","model":"nano_banana_flash","description":"fixture","aspectRatio":"16:9","resolution":"1k","transparent":false,"width":1280,"height":720,"output":"unused.webp"}]}'
            )
            style_path = temporary / "style.txt"
            style_path.write_text("fixture style")
            audio_plan = temporary / "audio-plan.json"
            audio_plan.write_text(
                '{"assets":[{"id":"market-success","model":"seed_audio","prompt":"fixture","seconds":0.7,"channels":1,"lufs":-11,"output":"unused.ogg"}]}'
            )
            complete = '{\n  "status": "completed",\n  "result_url": "https://full.example/result",\n  "min_result_url": "https://min.example/result"\n}'
            (jobs / "fm-boardroom-a1-request.json").write_text('[\n  "fm-boardroom-job"\n]')
            (jobs / "fm-boardroom-a1-complete.json").write_text(complete)
            (jobs / "market-success-a1-request.json").write_text('[\n  "market-success-job"\n]')
            (jobs / "market-success-a1-complete.json").write_text(complete)
            static_raw = temporary / "raw/static/attempt-1"
            audio_raw = temporary / "raw/audio/attempt-1"
            static_raw.mkdir(parents=True)
            audio_raw.mkdir(parents=True)
            (static_raw / "fm-boardroom.webp").write_bytes(b"already-downloaded")
            (audio_raw / "market-success.wav").write_bytes(b"already-downloaded")
            paid_marker = temporary / "paid-call-marker"
            command = (
                "$ErrorActionPreference = 'Stop'; "
                f"function higgsfield {{ New-Item -ItemType File -Path '{paid_marker.as_posix()}' | Out-Null; throw 'paid call' }}; "
                f"function Invoke-WebRequest {{ New-Item -ItemType File -Path '{paid_marker.as_posix()}' | Out-Null; throw 'download call' }}; "
                f"& '{(ROOT / 'scripts/assets/generate-static.ps1').as_posix()}' -PlanPath '{static_plan.as_posix()}' -StylePath '{style_path.as_posix()}' -JobsDirectory '{jobs.as_posix()}' -RawDirectory '{(temporary / 'raw/static').as_posix()}' -Attempt 1; "
                f"& '{(ROOT / 'scripts/assets/generate-audio.ps1').as_posix()}' -PlanPath '{audio_plan.as_posix()}' -JobsDirectory '{jobs.as_posix()}' -RawDirectory '{(temporary / 'raw/audio').as_posix()}' -Attempt 1"
            )
            result = subprocess.run(
                ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertFalse(paid_marker.exists(), "resume path attempted a Higgsfield create/wait or raw download")

    def test_runner_stage_resume_recovers_completion_without_duplicate_creates(self):
        states = {
            "request_only": (False, False, 2, 2),
            "request_completion": (True, False, 0, 2),
            "request_raw": (False, True, 2, 0),
            "full": (True, True, 0, 0),
        }
        for name, (has_completion, has_raw, expected_waits, expected_downloads) in states.items():
            with self.subTest(state=name), tempfile.TemporaryDirectory() as temporary_directory:
                temporary = Path(temporary_directory)
                jobs = temporary / "jobs"
                animation = temporary / "animation/attempt-1"
                alpha = temporary / "frames/attempt-1/alpha"
                jobs.mkdir()
                animation.mkdir(parents=True)
                alpha.mkdir(parents=True)
                avatar = temporary / "avatar.png"
                frame_source = temporary / "frame.png"
                Image.new("RGBA", (16, 16), (255, 255, 255, 255)).save(avatar)
                Image.new("RGBA", (16, 16), (255, 255, 255, 255)).save(frame_source)
                complete = '{"status":"completed","result_url":"https://full.example/result","min_result_url":"https://min.example/result"}'
                for stage, job_id, raw_name in (
                    ("ws-run-loop-key-pose", "flux-job", "run-pose.png"),
                    ("ws-run-loop-video", "seedance-job", "run.mp4"),
                ):
                    (jobs / f"{stage}-a1-request.json").write_text(f'["{job_id}"]')
                    if has_completion:
                        (jobs / f"{stage}-a1-complete.json").write_text(complete)
                    if has_raw:
                        (animation / raw_name).write_bytes(f"existing-{raw_name}".encode())
                for index in range(16):
                    stem = f"ws-run-loop-frame-{index:04d}-remove-bg-a1"
                    (jobs / f"{stem}-request.json").write_text(f'["remove-{index}"]')
                    (jobs / f"{stem}-complete.json").write_text(complete)
                    Image.new("RGBA", (16, 16), (255, 255, 255, 255)).save(alpha / f"{index:04d}.png")
                call_log = temporary / "calls.txt"
                call_log.write_text("")
                command = (
                    "$ErrorActionPreference = 'Stop'; "
                    f"$callLog = '{call_log.as_posix()}'; $frameSource = '{frame_source.as_posix()}'; "
                    "function higgsfield { if ($args[1] -ne 'wait') { Add-Content $callLog 'create'; throw 'duplicate create' }; Add-Content $callLog 'wait'; Write-Output '{\"status\":\"completed\",\"result_url\":\"https://full.example/result\",\"min_result_url\":\"https://min.example/result\"}'; $global:LASTEXITCODE=0 }; "
                    "function Invoke-WebRequest { Add-Content $callLog 'download'; $index = [Array]::IndexOf($args, '-OutFile'); Set-Content -Path $args[$index + 1] -Value 'downloaded'; }; "
                    "function ffmpeg { $template = $args[$args.Count - 1]; $directory = Split-Path -Parent $template; New-Item -ItemType Directory -Force -Path $directory | Out-Null; foreach ($index in 1..16) { Copy-Item $frameSource (Join-Path $directory ('{0:D4}.png' -f $index)) }; $global:LASTEXITCODE=0 }; "
                    f"& '{(ROOT / 'scripts/assets/generate-runner.ps1').as_posix()}' -AvatarPath '{avatar.as_posix()}' -StylePath '{(ROOT / 'design/style-formula.txt').as_posix()}' "
                    f"-JobsDirectory '{jobs.as_posix()}' -AnimationRoot '{(temporary / 'animation').as_posix()}' -FramesRoot '{(temporary / 'frames').as_posix()}' "
                    f"-OutputPath '{(temporary / 'runner_run_f15_256x256_g4x4_fps16_loop.png').as_posix()}' -Attempt 1"
                )
                result = subprocess.run(
                    ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
                    text=True,
                    capture_output=True,
                    check=False,
                )
                calls = call_log.read_text().splitlines()
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertNotIn("create", calls)
                self.assertEqual(calls.count("wait"), expected_waits)
                self.assertEqual(calls.count("download"), expected_downloads)
                self.assertTrue((jobs / "ws-run-loop-key-pose-a1-complete.json").exists())
                self.assertTrue((jobs / "ws-run-loop-video-a1-complete.json").exists())
                self.assertTrue((temporary / "runner_run_f15_256x256_g4x4_fps16_loop.png").exists())

    def test_background_removal_resume_skips_higgsfield_and_download_for_complete_raw_frames(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            temporary = Path(temporary_directory)
            frames = temporary / "selected"
            alpha = temporary / "alpha"
            jobs = temporary / "jobs"
            frames.mkdir()
            alpha.mkdir()
            jobs.mkdir()
            complete = '{"status":"completed","result_url":"https://full.example/result","min_result_url":"https://min.example/result"}'
            for index in range(16):
                Image.new("RGBA", (8, 8), (255, 255, 255, 255)).save(frames / f"{index:04d}.png")
                Image.new("RGBA", (8, 8), (255, 255, 255, 255)).save(alpha / f"{index:04d}.png")
                stem = f"ws-run-loop-frame-{index:04d}-remove-bg-a1"
                (jobs / f"{stem}-request.json").write_text(f'["remove-{index}"]')
                (jobs / f"{stem}-complete.json").write_text(complete)
            paid_marker = temporary / "paid-call-marker"
            command = (
                "$ErrorActionPreference = 'Stop'; "
                f"function higgsfield {{ New-Item -ItemType File -Path '{paid_marker.as_posix()}' | Out-Null; throw 'paid call' }}; "
                f"function Invoke-WebRequest {{ New-Item -ItemType File -Path '{paid_marker.as_posix()}' | Out-Null; throw 'download call' }}; "
                f"& '{(ROOT / 'scripts/assets/remove-backgrounds.ps1').as_posix()}' -FrameRoot '{frames.as_posix()}' -OutputRoot '{alpha.as_posix()}' "
                f"-ProvenancePrefix 'ws-run-loop-frame' -JobsDirectory '{jobs.as_posix()}' -Attempt 1"
            )
            result = subprocess.run(
                ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertFalse(paid_marker.exists(), "background removal resume issued a paid call or download")


if __name__ == "__main__":
    unittest.main()
