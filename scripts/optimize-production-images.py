#!/usr/bin/env python3
from __future__ import annotations

import os
from pathlib import Path
from tempfile import NamedTemporaryFile

from PIL import Image, ImageOps

DIST = Path("dist")
ROOT = DIST / "media/images"
MIN_BYTES = 512 * 1024
MAX_EDGE = 4096
JPEG_QUALITY = 89
WEBP_QUALITY = 86
WEBP_METHOD = 6
MIN_SAVINGS_RATIO = 0.05
TEXT_SUFFIXES = {".js", ".html", ".css", ".json"}
HERO_GLOB = "home/hero-slide-01-*.png"


def mib(value: int) -> str:
    return f"{value / 1024 / 1024:.1f} MiB"


def optimize_jpeg(path: Path) -> tuple[bool, int, int, tuple[int, int], tuple[int, int]]:
    before = path.stat().st_size

    with Image.open(path) as source:
        original_size = source.size
        image = ImageOps.exif_transpose(source)

        if image.mode not in {"RGB", "L"}:
            image = image.convert("RGB")

        if max(image.size) > MAX_EDGE:
            image.thumbnail((MAX_EDGE, MAX_EDGE), Image.Resampling.LANCZOS)

        output_size = image.size
        icc_profile = source.info.get("icc_profile")

        with NamedTemporaryFile(
            prefix=f".{path.name}.", suffix=".optimized.jpg", dir=path.parent, delete=False
        ) as handle:
            temp_path = Path(handle.name)

        try:
            save_options = {
                "format": "JPEG",
                "quality": JPEG_QUALITY,
                "optimize": True,
                "progressive": True,
            }
            if icc_profile:
                save_options["icc_profile"] = icc_profile

            image.save(temp_path, **save_options)
            after = temp_path.stat().st_size

            if after >= before or (before - after) / before < MIN_SAVINGS_RATIO:
                temp_path.unlink(missing_ok=True)
                return False, before, before, original_size, original_size

            os.replace(temp_path, path)
            return True, before, after, original_size, output_size
        except Exception:
            temp_path.unlink(missing_ok=True)
            raise


def make_webp(path: Path) -> tuple[Path | None, int, int]:
    before = path.stat().st_size
    output = path.with_suffix(".webp")

    with Image.open(path) as source:
        image = ImageOps.exif_transpose(source)
        if image.mode not in {"RGB", "RGBA"}:
            image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
        icc_profile = source.info.get("icc_profile")
        save_options = {
            "format": "WEBP",
            "quality": WEBP_QUALITY,
            "method": WEBP_METHOD,
        }
        if icc_profile:
            save_options["icc_profile"] = icc_profile
        image.save(output, **save_options)

    after = output.stat().st_size
    if after >= before:
        output.unlink(missing_ok=True)
        return None, before, before
    return output, before, after


def replace_production_references(replacements: dict[str, str]) -> dict[str, int]:
    hits = {source: 0 for source in replacements}
    for path in DIST.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        text = path.read_text("utf-8", errors="ignore")
        updated = text
        for source, target in replacements.items():
            count = updated.count(source)
            if count:
                hits[source] += count
                updated = updated.replace(source, target)
        if updated != text:
            path.write_text(updated, "utf-8")
    return hits


def optimize_hero() -> None:
    replacements: dict[str, str] = {}
    total_before = 0
    total_after = 0

    for source in sorted(ROOT.glob(HERO_GLOB)):
        output, before, after = make_webp(source)
        total_before += before
        total_after += after
        if output is None:
            print(f"Keeping PNG reference because WebP was not smaller: {source.relative_to(DIST)}")
            continue
        source_relative = source.relative_to(DIST).as_posix()
        output_relative = output.relative_to(DIST).as_posix()
        replacements[source_relative] = output_relative
        print(f"Hero WebP: {source_relative}: {mib(before)} -> {mib(after)}")

    if not replacements:
        return

    hits = replace_production_references(replacements)
    missing = [source for source, count in hits.items() if count == 0]
    if missing:
        raise SystemExit(f"Generated hero WebP was not wired into production bundle: {', '.join(missing)}")

    saved = total_before - total_after
    print(
        f"Production hero WebP enabled for {len(replacements)} variants; "
        f"candidate bytes={mib(total_before)} -> {mib(total_after)}, saved={mib(saved)}."
    )


def main() -> None:
    if not ROOT.is_dir():
        raise SystemExit(f"Production image directory not found: {ROOT}")

    candidates = sorted(
        (
            path
            for path in ROOT.rglob("*")
            if path.is_file()
            and path.suffix.lower() in {".jpg", ".jpeg"}
            and path.stat().st_size >= MIN_BYTES
        ),
        key=lambda path: path.stat().st_size,
        reverse=True,
    )

    if candidates:
        total_before = sum(path.stat().st_size for path in candidates)
        total_after = total_before
        changed = 0
        resized = 0

        print(
            f"Optimizing {len(candidates)} production JPEGs >= {mib(MIN_BYTES)} "
            f"with quality={JPEG_QUALITY}, max edge={MAX_EDGE}px."
        )

        for index, path in enumerate(candidates, 1):
            did_change, before, after, original_size, output_size = optimize_jpeg(path)
            if did_change:
                changed += 1
                total_after -= before - after
                if output_size != original_size:
                    resized += 1
                print(
                    f"[{index}/{len(candidates)}] {path.relative_to(ROOT.parent)}: "
                    f"{mib(before)} -> {mib(after)}; "
                    f"{original_size[0]}x{original_size[1]} -> {output_size[0]}x{output_size[1]}"
                )

        saved = total_before - total_after
        print(
            f"Production JPEG optimization complete: changed={changed}/{len(candidates)}, "
            f"resized={resized}, candidate bytes={mib(total_before)} -> {mib(total_after)}, "
            f"saved={mib(saved)}."
        )
    else:
        print("No production JPEG files need optimization.")

    optimize_hero()


if __name__ == "__main__":
    main()
