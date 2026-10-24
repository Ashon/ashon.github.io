#!/usr/bin/env python3
"""Subset Pretendard to the glyphs this site actually uses.

Run between two Hugo builds (see .github/workflows/hugo.yml):

    hugo --minify -d /tmp/charscan              # pass 1: render every page
    python scripts/subset-fonts.py /tmp/charscan
    hugo --minify                                # pass 2: fingerprints the fonts

Pass 1's HTML is the exact character set readers will see (post text,
titles, UI strings, inline script strings, typographer quotes). Each
weight is cut down to those glyphs plus printable ASCII and written to
assets/fonts/, where layouts/partials/head.html picks it up through
Hugo's asset pipeline. Without those files (plain `hugo server`), the
head partial falls back to the full Pretendard files on the CDN.

Pretendard is licensed under the SIL OFL 1.1 with the Reserved Font
Name "Pretendard". A subset is a Modified Version, so the family is
renamed to "Lifestack Sans"; the copyright and license name records
are kept.

Sources are pinned to one release and checked against jsDelivr's
SHA-256 digests before use. Requires fonttools and brotli
(scripts/requirements-fonts.txt).
"""

import argparse
import base64
import hashlib
import html
import pathlib
import sys
import urllib.request

from fontTools import subset
from fontTools.ttLib import TTFont

VERSION = "1.3.9"
BASE_URL = f"https://cdn.jsdelivr.net/npm/pretendard@{VERSION}/dist/web/static/woff2"

# weight -> (source file, base64 SHA-256 as published by data.jsdelivr.com)
SOURCES = {
    400: ("Pretendard-Regular.woff2", "+thT9/R8bIsQMXHnGT+glXCM3NcIUKcdk6pTeeimHWM="),
    500: ("Pretendard-Medium.woff2", "0DSBMw7roGWatbh/Jc61BKNd43fdkKDQq6KYLrLQXiw="),
    600: ("Pretendard-SemiBold.woff2", "yGP3an3lwd3B7Ysvp5SWRTB3RZLE8xQHqE4qKuk/F/A="),
}

FAMILY = "Lifestack Sans"
OUT_NAME = "lifestack-sans-{weight}.woff2"

# Name records that carry the family name; everything else (copyright,
# version, license text and URL) is left untouched.
FAMILY_NAME_IDS = {1, 3, 4, 6, 16, 17, 18, 21, 22}

REPO = pathlib.Path(__file__).resolve().parent.parent


def fetch(name: str, digest: str, cache: pathlib.Path) -> pathlib.Path:
    path = cache / name
    if not path.exists():
        cache.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(f"{BASE_URL}/{name}", timeout=60) as resp:
            data = resp.read()
        path.write_bytes(data)
    actual = base64.b64encode(hashlib.sha256(path.read_bytes()).digest()).decode()
    if actual != digest:
        path.unlink()
        sys.exit(f"subset-fonts: checksum mismatch for {name} (got {actual})")
    return path


def site_characters(html_dir: pathlib.Path) -> str:
    pages = list(html_dir.rglob("*.html"))
    if not pages:
        sys.exit(f"subset-fonts: no HTML under {html_dir}; run the first Hugo build")
    chars = {chr(c) for c in range(0x20, 0x7F)}
    for page in pages:
        chars |= set(html.unescape(page.read_text(encoding="utf-8")))
    return "".join(sorted(c for c in chars if c.isprintable() or c == " "))


def rename_family(font: TTFont) -> None:
    for record in font["name"].names:
        if record.nameID not in FAMILY_NAME_IDS:
            continue
        text = record.toUnicode()
        # PostScript names (ID 6) and unique IDs may not contain spaces.
        alias = FAMILY.replace(" ", "") if record.nameID in (3, 6) else FAMILY
        record.string = text.replace("Pretendard", alias)


def build(source: pathlib.Path, text: str, out: pathlib.Path) -> int:
    options = subset.Options()
    options.flavor = "woff2"
    options.hinting = False  # browsers rasterize without TrueType hints
    options.name_IDs = ["*"]  # keep copyright/license records
    options.name_languages = ["*"]
    font = subset.load_font(str(source), options)
    subsetter = subset.Subsetter(options)
    subsetter.populate(text=text)
    subsetter.subset(font)
    rename_family(font)
    subset.save_font(font, str(out), options)
    return len(font.getGlyphOrder())


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("html_dir", type=pathlib.Path, help="output of the first Hugo build")
    parser.add_argument("--out", type=pathlib.Path, default=REPO / "assets" / "fonts")
    parser.add_argument("--cache", type=pathlib.Path, default=REPO / "resources" / "_fonts")
    args = parser.parse_args()

    text = site_characters(args.html_dir)
    args.out.mkdir(parents=True, exist_ok=True)
    print(f"subset-fonts: {len(text)} characters from {args.html_dir}")
    for weight, (name, digest) in SOURCES.items():
        source = fetch(name, digest, args.cache)
        out = args.out / OUT_NAME.format(weight=weight)
        glyphs = build(source, text, out)
        print(f"  {weight}: {source.stat().st_size // 1024} KB -> "
              f"{out.stat().st_size // 1024} KB ({glyphs} glyphs)")


if __name__ == "__main__":
    main()
