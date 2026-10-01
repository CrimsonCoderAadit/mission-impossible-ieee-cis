#!/usr/bin/env python3
"""Extract film chapters, publish their manifest, and archive source videos."""

import argparse
import json
import tempfile
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHAPTERS = ("descent", "infiltration", "extraction")

VARIANTS = [
    ("desktop", 1280, 72),
    ("mobile", 720, 62),
]


def find_ffmpeg():
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        pass
    static = ROOT / "node_modules" / "ffmpeg-static" / "ffmpeg"
    if static.exists():
        return str(static)
    on_path = shutil.which("ffmpeg")
    if on_path:
        return on_path
    sys.exit("ffmpeg not found: pip install imageio-ffmpeg or npm i -D ffmpeg-static")


def find_source(name):
    for folder in ("source", "assets"):
        candidate = ROOT / folder / f"{name}.mp4"
        if candidate.exists():
            return candidate
    sys.exit(f"{name}.mp4 not found in source/ or assets/")


def run(ffmpeg, *args):
    subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def folder_size(path):
    return sum(f.stat().st_size for f in path.iterdir() if f.is_file())


def find_upscaler(model):
    folder = ROOT / "tools" / "realesrgan"
    binary = folder / "realesrgan-ncnn-vulkan"
    models = folder / "models"
    if not binary.is_file():
        sys.exit(f"Real-ESRGAN not found: extract the macOS release into {folder}")
    if not list(models.glob(f"{model}*.param")):
        sys.exit(f"Model {model} not found in {models}")
    return binary, models


def encode_upscaled(frames, target, desktop_quality, desktop_only=False):
    from PIL import Image

    variants = [("desktop", 2400, desktop_quality), ("mobile", 1080, 78)]
    if desktop_only:
        variants = variants[:1]
    for variant, width, quality in variants:
        out = target / variant
        out.mkdir(parents=True, exist_ok=True)
        for index, frame in enumerate(frames, 1):
            with Image.open(frame) as image:
                image = image.convert("RGB")
                height = max(1, round(image.height * width / image.width))
                image.resize((width, height), Image.Resampling.LANCZOS).save(
                    out / f"frame_{index:03d}.webp", quality=quality, method=6)
    if not desktop_only:
        with Image.open(frames[0]) as image:
            image.convert("RGB").save(target / "poster.jpg", quality=88)


def upscale_chapter(ffmpeg, binary, models, model, source, work):
    raw = work / "raw"
    upscaled = work / "upscaled"
    raw.mkdir(parents=True)
    upscaled.mkdir()
    run(ffmpeg, "-i", str(source), "-vf", "select='not(mod(n\\,2))'",
        "-vsync", "vfr", str(raw / "frame_%03d.png"))
    originals = sorted(raw.glob("frame_*.png"))
    if not originals:
        sys.exit(f"No frames extracted from {source}")
    # x4plus has a fixed 4x network; -s 2 corrupts tile stitching in this release.
    scale = 4 if model == "realesrgan-x4plus" else 2
    subprocess.run([str(binary), "-i", str(raw), "-o", str(upscaled),
                    "-m", str(models), "-n", model, "-s", str(scale), "-f", "png"],
                   check=True)
    frames = sorted(upscaled.glob("frame_*.png"))
    if [f.name for f in originals] != [f.name for f in frames]:
        sys.exit(f"Upscaled frame count/names mismatch for {source}")
    from PIL import Image

    for original, frame in zip(originals, frames):
        with Image.open(original) as before, Image.open(frame) as after:
            if after.size != (before.width * scale, before.height * scale):
                sys.exit(f"Expected {scale}x upscale: {frame} has size {after.size}")
            if scale == 4:
                resized = after.resize((before.width * 2, before.height * 2),
                                       Image.Resampling.LANCZOS)
        if scale == 4:
            resized.save(frame)
    return frames


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("chapters", nargs="*", help="Default: all three chapters")
    parser.add_argument("--upscale", action="store_true", help="Use local Real-ESRGAN at 2x")
    parser.add_argument("--upscale-model", default="realesr-animevideov3",
                        choices=("realesr-animevideov3", "realesrgan-x4plus"))
    args = parser.parse_args()
    names = args.chapters or list(CHAPTERS)
    if len(names) != len(set(names)):
        parser.error("chapters must not be repeated")
    if args.upscale:
        try:
            from PIL import Image
        except ImportError:
            sys.exit("Pillow not found: pip install Pillow")
        binary, models = find_upscaler(args.upscale_model)
    if any(name not in CHAPTERS for name in names):
        parser.error("chapters must be descent, infiltration, or extraction")
    sources = {name: find_source(name) for name in names}
    ffmpeg = find_ffmpeg()
    assets = ROOT / "assets"
    with tempfile.TemporaryDirectory(dir=assets, prefix=".film-") as staging:
        staging = Path(staging)
        upscaled_frames = {}
        for chapter, source in sources.items():
            print(f"Processing {chapter}...", flush=True)
            if args.upscale:
                frames = upscale_chapter(ffmpeg, binary, models, args.upscale_model,
                                         source, staging / "work" / chapter)
                upscaled_frames[chapter] = frames
                encode_upscaled(frames, staging / chapter, 86)
                continue
            for variant, width, quality in VARIANTS:
                out = staging / chapter / variant
                out.mkdir(parents=True)
                run(ffmpeg, "-i", str(source),
                    "-vf", f"select='not(mod(n\\,2))',scale={width}:-2",
                    "-vsync", "vfr", "-c:v", "libwebp", "-quality", str(quality),
                    str(out / "frame_%03d.webp"))
                if not any(out.glob("frame_*.webp")):
                    sys.exit(f"No frames extracted for {chapter}/{variant}")
            run(ffmpeg, "-i", str(source), "-frames:v", "1", "-q:v", "3",
                str(staging / chapter / "poster.jpg"))
        desktop_quality = 86
        if args.upscale:
            total = sum(folder_size((staging if chapter in sources else assets)
                                    / chapter / "desktop") for chapter in CHAPTERS)
            print(f"Desktop total at quality 86: {total / 1_000_000:.2f} MB", flush=True)
            for chapter in sources:
                folder = staging / chapter
                print(f"{chapter} at quality 86: desktop "
                      f"{folder_size(folder / 'desktop') / 1_000_000:.2f} MB, "
                      f"mobile {folder_size(folder / 'mobile') / 1_000_000:.2f} MB", flush=True)
            if total > 25_000_000:
                desktop_quality = 80
                for chapter, frames in upscaled_frames.items():
                    encode_upscaled(frames, staging / chapter, desktop_quality, desktop_only=True)
                total = sum(folder_size((staging if chapter in sources else assets)
                                        / chapter / "desktop") for chapter in CHAPTERS)
                print(f"Desktop total at quality 80: {total / 1_000_000:.2f} MB", flush=True)
        for chapter in sources:
            target = assets / chapter
            target.mkdir(exist_ok=True)
            for variant, _, _ in VARIANTS:
                out = target / variant
                if out.exists():
                    shutil.rmtree(out)
                shutil.move(str(staging / chapter / variant), str(out))
            shutil.copy2(staging / chapter / "poster.jpg", target / "poster.jpg")
            if chapter == "descent":
                shutil.copy2(target / "poster.jpg", assets / "hero-poster.jpg")

    previous = assets / "film" / "manifest.json"
    old_chapters = {c["name"]: c for c in json.loads(previous.read_text())["chapters"]} if previous.exists() else {}
    chapters = []
    for chapter in CHAPTERS:
        folder = assets / chapter
        count = len(list((folder / "desktop").glob("frame_*.webp")))
        if count != len(list((folder / "mobile").glob("frame_*.webp"))):
            sys.exit(f"Frame count mismatch for {chapter}")
        chapters.append({"name": chapter, "frameCount": count,
                         "desktop": f"assets/{chapter}/desktop",
                         "mobile": f"assets/{chapter}/mobile",
                         "poster": f"assets/{chapter}/poster.jpg"})
        entry = chapters[-1]
        if args.upscale and chapter in sources:
            entry.update({"upscaleModel": args.upscale_model, "upscaleScale": 2,
                          "desktopWidth": 2400, "desktopQuality": desktop_quality,
                          "mobileWidth": 1080, "mobileQuality": 78, "posterQuality": 88})
        elif chapter not in sources:
            for key, value in old_chapters.get(chapter, {}).items():
                if key not in entry:
                    entry[key] = value
        if not count:
            print(f"{chapter}: missing source; no frames published")
            continue
        for variant, _, _ in VARIANTS:
            print(f"{chapter}/{variant}: {count} frames, {folder_size(folder / variant) / 1_000_000:.2f} MB")
        print(f"{chapter}/poster: {(folder / 'poster.jpg').stat().st_size / 1000:.0f} KB")
    manifest = assets / "film" / "manifest.json"
    manifest.parent.mkdir(exist_ok=True)
    pending = manifest.with_suffix(".tmp")
    pending.write_text(json.dumps({"chapters": chapters}, indent=2) + "\n")
    pending.replace(manifest)
    archive = ROOT / "source"
    archive.mkdir(exist_ok=True)
    for video in assets.glob("*.mp4"):
        target = archive / video.name
        if target.exists():
            if video.read_bytes() != target.read_bytes():
                sys.exit(f"Refusing to overwrite different source: {target}")
            video.unlink()
        else:
            shutil.move(str(video), str(target))


if __name__ == "__main__":
    main()
