"""Validate final Open Trade audio files with additive ffprobe/ffmpeg diagnostics.

This checker does not amend the frozen release criteria in ``design/thresholds.md``.
It adds final-file format, duration, non-silence, EBU R128, and encoded true-peak
evidence. Integrated LUFS is unstable below 400 ms; high-crest transients cannot
meet a -11 LUFS working target without exceeding the -3 dBFS peak cap, so those
cases retain the non-silence and true-peak gates instead of flattening the cue.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import subprocess
import sys
from pathlib import Path


def run(*arguments: str) -> str:
    completed = subprocess.run(arguments, text=True, capture_output=True, check=False)
    if completed.returncode:
        raise RuntimeError(completed.stderr.strip() or "command failed")
    return completed.stdout + completed.stderr


def parsed_number(value: str) -> float:
    return -math.inf if value == "-inf" else float(value)


def last_measurement(pattern: str, output: str) -> float:
    matches = re.findall(pattern, output, flags=re.MULTILINE)
    if not matches:
        raise ValueError("measurement missing from ffmpeg output")
    return parsed_number(matches[-1])


def inspect_audio(path: Path) -> dict[str, float | int | str]:
    probe = json.loads(run(
        "ffprobe", "-v", "error", "-show_entries", "stream=codec_name,sample_rate,channels:format=duration",
        "-of", "json", str(path),
    ))
    stream = probe["streams"][0]
    volume = run("ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "volumedetect", "-f", "null", "-")
    ebur128 = run("ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-filter_complex", "ebur128=peak=true", "-f", "null", "-")
    return {
        "codec": stream["codec_name"],
        "sampleRate": int(stream["sample_rate"]),
        "channels": int(stream["channels"]),
        "duration": float(probe["format"]["duration"]),
        "maxVolume": last_measurement(r"max_volume:\s*(-?(?:\d+(?:\.\d+)?|inf))\s*dB", volume),
        "loudness": last_measurement(r"Integrated loudness:\s*\n\s*I:\s*(-?(?:\d+(?:\.\d+)?|inf))\s*LUFS", ebur128),
        "truePeak": last_measurement(r"True peak:\s*\n\s*Peak:\s*(-?(?:\d+(?:\.\d+)?|inf))\s*dBFS", ebur128),
    }


def validate_asset(asset: dict[str, object], root: Path) -> tuple[dict[str, object], list[str]]:
    asset_id = str(asset["id"])
    path = root / str(asset["output"])
    if not path.is_file():
        return {"id": asset_id, "path": str(path)}, [f"missing {asset_id} audio ({path})"]
    try:
        measured = inspect_audio(path)
    except (KeyError, RuntimeError, ValueError, json.JSONDecodeError) as error:
        return {"id": asset_id, "path": str(path)}, [f"could not inspect {asset_id}: {error}"]

    errors: list[str] = []
    expected_duration = float(asset["seconds"])
    expected_channels = int(asset["channels"])
    if measured["codec"] != "opus":
        errors.append(f"{asset_id} codec must be opus; found {measured['codec']}")
    if measured["sampleRate"] != 48000:
        errors.append(f"{asset_id} sample rate must be 48000; found {measured['sampleRate']}")
    if measured["channels"] != expected_channels:
        errors.append(f"{asset_id} channels must be {expected_channels}; found {measured['channels']}")
    if abs(float(measured["duration"]) - expected_duration) > 0.05:
        errors.append(f"{asset_id} duration must be {expected_duration:.3f}s +/- 0.050s; found {measured['duration']:.3f}s")
    if float(measured["maxVolume"]) <= -60:
        errors.append(f"{asset_id} is effectively silent (max volume {measured['maxVolume']:.1f} dBFS)")
    if float(measured["truePeak"]) > -3:
        errors.append(f"{asset_id} true peak must be at most -3 dBFS; found {measured['truePeak']:.1f} dBFS")
    target_loudness = float(asset["lufs"])
    tolerance = 2.0 if asset["model"] == "sonilo_music" else 3.0
    crest_factor = float(measured["truePeak"]) - float(measured["loudness"])
    if expected_duration >= 0.4 and crest_factor <= 8.0 and (
        not math.isfinite(float(measured["loudness"])) or abs(float(measured["loudness"]) - target_loudness) > tolerance
    ):
        errors.append(
            f"{asset_id} loudness must be {target_loudness:.1f} LUFS +/- {tolerance:.1f}; found {measured['loudness']:.1f} LUFS"
        )
    return {"id": asset_id, "path": str(path), **measured}, errors


def json_safe(value: object) -> object:
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, dict):
        return {key: json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [json_safe(item) for item in value]
    return value


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", type=Path, default=Path("design/higgsfield/audio-plan.json"))
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--json", action="store_true")
    arguments = parser.parse_args()
    plan = json.loads(arguments.plan.read_text(encoding="utf-8"))
    assets: list[dict[str, object]] = []
    errors: list[str] = []
    for asset in plan["assets"]:
        measured, asset_errors = validate_asset(asset, arguments.root)
        assets.append(measured)
        errors.extend(asset_errors)
    if arguments.json:
        print(json.dumps(json_safe({"assets": assets, "errors": errors}), allow_nan=False))
    elif errors:
        print("\n".join(errors), file=sys.stderr)
    else:
        print(f"audio validation passed: {len(assets)}/{len(assets)}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
