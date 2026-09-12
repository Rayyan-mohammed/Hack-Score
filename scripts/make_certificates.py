"""Render participation certificates from the event's PNG template.

The template carries two placeholders — [STUDENT NAME] on its own line, and a
bold [TEAM NAME] inline inside a sentence. Rather than redraw the artwork, this
keeps every original pixel and swaps only those two runs:

* the name line is cleared and the participant's name drawn on the same
  baseline, centred where the placeholder was;
* for the team name, the sentence is cut into the part before the placeholder
  and the part after it. Both halves are re-pasted, shifted by half the change
  in width, so the line stays centred and the surrounding words keep the
  template's own typography untouched.

Cleared areas are refilled row by row with the background colour sampled from
the same row further left, so the paper's subtle vertical shading survives.

Usage:
    python scripts/make_certificates.py "AstraForge" "ASHI SHARMA" "SAI KRISHNA" ...
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SCRIPTS = Path(__file__).resolve().parent
ROOT = SCRIPTS.parent
TEMPLATE = ROOT / "SIH Jury Appreciation Certificate.png"
FONT_REGULAR = SCRIPTS / "fonts" / "EBGaramond-Regular.ttf"
FONT_BOLD = SCRIPTS / "fonts" / "EBGaramond-Bold.ttf"
OUT_ROOT = ROOT / "certificates"

INK = (28, 47, 79)  # the navy the template's headings are set in

# --- measured from the template, in its own pixels ---------------------------
NAME_BAND = (1600, 1870)      # rows the [STUDENT NAME] line occupies
NAME_BASELINE = 1790          # bottom of the capitals
NAME_CAP_HEIGHT = 147
NAME_CENTRE = 2730            # the name line is centred on the page
NAME_MAX_WIDTH = 3300         # a long name shrinks rather than running wide

PARA_BAND = (2035, 2180)      # rows of the sentence holding [TEAM NAME]
TEAM_LEFT = 2250              # first pixel of "[" in [TEAM NAME]
TEAM_RIGHT = 2891             # first pixel after "]"
TEAM_BASELINE = 2134
TEAM_CAP_HEIGHT = 63
LINE_LEFT = 600               # safe cut either side of the sentence
LINE_RIGHT = 4700


def fit_font(path: Path, cap_height: int) -> ImageFont.FreeTypeFont:
    """Largest size whose capitals measure `cap_height` tall.

    Measured against capitals alone, never the name itself: a descender (the
    g in "AstraForge") would otherwise count toward the height and shrink the
    text well below the placeholder it replaces.
    """
    probe = "HEMAX"
    lo, hi = 10, 400
    best = ImageFont.truetype(str(path), 100)
    while lo <= hi:
        mid = (lo + hi) // 2
        font = ImageFont.truetype(str(path), mid)
        top, bottom = font.getbbox(probe)[1], font.getbbox(probe)[3]
        height = bottom - top
        if height > cap_height:
            hi = mid - 1
        else:
            best = font
            lo = mid + 1
    return best


def clear_band(img: Image.Image, band: tuple[int, int], x0: int, x1: int) -> None:
    """Repaint a strip with each row's own background colour."""
    px = img.load()
    for y in range(*band):
        samples = []
        for x in range(300, 1500, 7):
            r, g, b = px[x, y]
            if r + g + b > 600:  # ignore anything inked
                samples.append((r, g, b))
        if not samples:
            samples = [(253, 250, 242)]
        samples.sort(key=sum)
        fill = samples[len(samples) // 2]
        for x in range(x0, x1):
            px[x, y] = fill


def draw_centred(
    img: Image.Image,
    text: str,
    font: ImageFont.FreeTypeFont,
    centre_x: int,
    baseline: int,
) -> None:
    d = ImageDraw.Draw(img)
    left, top, right, bottom = font.getbbox(text)
    d.text(
        (centre_x - (right - left) / 2 - left, baseline - bottom),
        text,
        font=font,
        fill=INK,
    )


def render(team_name: str, person_name: str) -> Image.Image:
    img = Image.open(TEMPLATE).convert("RGB")

    # 1. The participant's name, always in capitals.
    name = person_name.strip().upper()
    name_font = fit_font(FONT_REGULAR, NAME_CAP_HEIGHT)
    # "KUCHURU SAI KRISHNA REDDY" is far wider than "[STUDENT NAME]" was, so
    # step the size down until it fits the line rather than the margins.
    while name_font.getlength(name) > NAME_MAX_WIDTH and name_font.size > 40:
        name_font = ImageFont.truetype(str(FONT_REGULAR), name_font.size - 2)
    clear_band(img, NAME_BAND, 1000, 4600)
    draw_centred(img, name, name_font, NAME_CENTRE, NAME_BASELINE)

    # 2. The team name inside the sentence. Keep the words either side exactly
    #    as the designer set them; only the placeholder run is re-typeset.
    # Capitals, as the template sets it — and EB Garamond's small x-height
    # makes a mixed-case name look undersized beside the words around it.
    team = team_name.strip().upper()
    team_font = fit_font(FONT_BOLD, TEAM_CAP_HEIGHT)
    bbox = team_font.getbbox(team)
    new_width = bbox[2] - bbox[0]
    delta = new_width - (TEAM_RIGHT - TEAM_LEFT)
    shift = round(delta / 2)

    before = img.crop((LINE_LEFT, PARA_BAND[0], TEAM_LEFT, PARA_BAND[1]))
    after = img.crop((TEAM_RIGHT, PARA_BAND[0], LINE_RIGHT, PARA_BAND[1]))

    clear_band(img, PARA_BAND, LINE_LEFT - abs(shift) - 20, LINE_RIGHT + abs(shift) + 20)
    img.paste(before, (LINE_LEFT - shift, PARA_BAND[0]))
    img.paste(after, (TEAM_RIGHT + delta - shift, PARA_BAND[0]))

    draw_centred(
        img,
        team,
        team_font,
        TEAM_LEFT - shift + new_width / 2,
        TEAM_BASELINE,
    )
    return img


def safe(name: str) -> str:
    return re.sub(r"[^\w.-]+", "_", name.strip()).strip("_") or "certificate"


def main() -> None:
    if len(sys.argv) < 3:
        print(__doc__)
        raise SystemExit(1)

    team_name, people = sys.argv[1], sys.argv[2:]
    out_dir = OUT_ROOT / safe(team_name)
    out_dir.mkdir(parents=True, exist_ok=True)

    for i, person in enumerate(people, start=1):
        img = render(team_name, person)
        path = out_dir / f"{i:02d}_{safe(person.upper())}.png"
        img.save(path, optimize=True)
        print(f"  {path.relative_to(ROOT)}")

    print(f"\n{len(people)} certificate(s) for {team_name} -> {out_dir.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
