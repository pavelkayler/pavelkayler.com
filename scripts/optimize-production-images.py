#!/usr/bin/env python3
from __future__ import annotations

import os
from pathlib import Path
from tempfile import NamedTemporaryFile

from PIL import Image, ImageOps

ROOT = Path("dist/i.wfolio.ru")
MIN_BYTES = 1536 * 1024
MAX_EDGE = 4096
JPEG_QUALITY = 91
MIN_SAVINGS_RATIO = 0.05


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

    if not candidates:
        print("No oversized production JPEG files need optimization.")
        return

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


if __name__ == "__main__":
    main()
