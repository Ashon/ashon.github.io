#!/usr/bin/env python3
"""Write data/ogcard.json: advance widths of the share card fonts.

layouts/partials/og-wrap.html breaks the share card's title and summary
into lines that fit its column (at spaces), so og-card.html can center
each line and the whole block. It needs each glyph's width: printable
ASCII one by one, and one width for every Hangul syllable (Pretendard
draws them all at the same width). Anything else falls back to a full
em, which errs toward a shorter line.

Widths are in em, rounded up, so a line never comes out wider than
measured. Run it again if the pinned Pretendard version in
layouts/partials/og-fonts.html changes:

    python scripts/og-glyph-widths.py Pretendard-Bold.ttf Pretendard-Medium.ttf

Requires fonttools (scripts/requirements-fonts.txt).
"""

import json
import math
import pathlib
import sys

from fontTools.ttLib import TTFont

REPO = pathlib.Path(__file__).resolve().parent.parent


def em(units: int, upm: int) -> float:
    return math.ceil(units / upm * 10000) / 10000


def widths(path: str) -> dict:
    font = TTFont(path)
    upm = font["head"].unitsPerEm
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]
    advance = lambda cp: hmtx[cmap[cp]][0]
    hangul = {advance(cp) for cp in range(0xAC00, 0xD7A4) if cp in cmap}
    if len(hangul) != 1:
        sys.exit(f"{path}: Hangul syllables are not all one width")
    return {
        "chars": {chr(cp): em(advance(cp), upm) for cp in range(0x20, 0x7F)},
        "hangul": em(hangul.pop(), upm),
        "ascent": em(font["hhea"].ascent, upm),
    }


def main() -> None:
    out = {}
    for path in sys.argv[1:]:
        weight = pathlib.Path(path).stem.split("-")[-1]
        out[weight] = widths(path)
    target = REPO / "data" / "ogcard.json"
    target.parent.mkdir(exist_ok=True)
    target.write_text(json.dumps(out, ensure_ascii=False, indent=1, sort_keys=True) + "\n")
    print(f"wrote {target.relative_to(REPO)}")


if __name__ == "__main__":
    main()
