// Draws the SIH 2026 participation certificate for one person, in the browser.
//
// A port of scripts/make_certificates.py, using the same measurements taken
// from the designer's template. It keeps every pixel of the artwork and swaps
// only the two placeholders:
//
// * [STUDENT NAME] — cleared, and the person's name drawn in capitals on the
//   same baseline, shrinking if a long name would run wide;
// * [TEAM NAME], inline in a sentence — the words before and after it are
//   re-drawn from the template shifted by half the change in width, so the
//   line stays centred and keeps the template's own typography.
//
// Rendering happens client-side because the names must always be the current
// ones from the database, and a Node server on Vercel cannot run the Python
// generator. Pure module: no React, no server imports.

export const CERTIFICATE_TEMPLATE_URL = "/certificates/sih-2026-participation.jpg";
export const CERTIFICATE_WIDTH = 5463;
export const CERTIFICATE_HEIGHT = 3875;

const FONT_FAMILY = "CertificateGaramond";
const INK = "rgb(28, 47, 79)";

// --- measured from the template, in its own pixels ---------------------------
const NAME_BAND = [1600, 1870] as const;
const NAME_BASELINE = 1790;
const NAME_CAP_HEIGHT = 147;
const NAME_CENTRE = 2730;
const NAME_MAX_WIDTH = 3300;
const NAME_CLEAR = [1000, 4600] as const;
// Clean paper just above and below the name: between "Presented to" and the
// name, and between the name and the paragraph.
const NAME_PAPER_ABOVE = [1562, 1598] as const;
const NAME_PAPER_BELOW = [1880, 1930] as const;

const PARA_BAND = [2035, 2180] as const;
const TEAM_LEFT = 2250;
const TEAM_RIGHT = 2891;
const TEAM_BASELINE = 2134;
const TEAM_CAP_HEIGHT = 63;
const LINE_LEFT = 600;
const LINE_RIGHT = 4700;
// The thin gaps between the sentence and the lines above and below it.
const PARA_PAPER_ABOVE = [2030, 2034] as const;
const PARA_PAPER_BELOW = [2181, 2187] as const;

/**
 * A name as it is printed: in capitals, with no full stops. "MD. Rayyan"
 * becomes "MD RAYYAN" and "G.Vikram" becomes "G VIKRAM" — the dot is replaced
 * by a space so initials never run into the surname. Spelling is otherwise
 * left exactly as the team gave it.
 */
export function printedName(raw: string): string {
  return raw.replace(/\./g, " ").replace(/\s+/g, " ").trim().toUpperCase();
}

/** Everything drawCertificate needs, prepared once per page load. */
export type PreparedTemplate = {
  image: HTMLImageElement;
};

let fontsReady: Promise<void> | null = null;

/** Load EB Garamond once; canvas text silently falls back without it. */
export function loadCertificateFonts(): Promise<void> {
  if (!fontsReady) {
    fontsReady = (async () => {
      const faces = [
        new FontFace(FONT_FAMILY, "url(/fonts/EBGaramond-Regular.ttf)", {
          weight: "400",
        }),
        new FontFace(FONT_FAMILY, "url(/fonts/EBGaramond-Bold.ttf)", {
          weight: "700",
        }),
      ];
      for (const face of faces) {
        await face.load();
        document.fonts.add(face);
      }
    })();
  }
  return fontsReady;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the certificate template."));
    img.src = url;
  });
}

/** Load the template artwork and the certificate font together. */
export async function prepareTemplate(): Promise<PreparedTemplate> {
  const [image] = await Promise.all([
    loadImage(CERTIFICATE_TEMPLATE_URL),
    loadCertificateFonts(),
  ]);
  return { image };
}

function font(weight: 400 | 700, size: number) {
  return `${weight} ${size}px ${FONT_FAMILY}`;
}

/** Largest size whose capitals stand `capHeight` tall — measured on capitals
 *  alone, so a descender in the text never shrinks it. */
function fitSize(ctx: CanvasRenderingContext2D, weight: 400 | 700, capHeight: number) {
  ctx.font = font(weight, 100);
  const ascent = ctx.measureText("HEMAX").actualBoundingBoxAscent;
  return Math.floor((capHeight / ascent) * 100);
}

/**
 * Repaint a placeholder band with the paper that surrounds it.
 *
 * The paper is not flat — it is lighter towards the centre of the sheet — so
 * a single colour per row leaves a visible pale box. Instead the clean strip
 * of paper just above the band is stretched down over it, and the strip just
 * below is blended in at half strength. Both keep the sheet's horizontal
 * shading exactly, and together they bridge any change from top to bottom.
 */
function clearBand(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  band: readonly [number, number],
  x0: number,
  x1: number,
  above: readonly [number, number],
  below: readonly [number, number],
) {
  const w = x1 - x0;
  const h = band[1] - band[0];
  ctx.globalAlpha = 1;
  ctx.drawImage(image, x0, above[0], w, above[1] - above[0], x0, band[0], w, h);
  ctx.globalAlpha = 0.5;
  ctx.drawImage(image, x0, below[0], w, below[1] - below[0], x0, band[0], w, h);
  ctx.globalAlpha = 1;
}

/** Put the ink of `text` centred on `centreX`, sitting on `baseline`. */
function drawCentred(
  ctx: CanvasRenderingContext2D,
  text: string,
  centreX: number,
  baseline: number,
) {
  const m = ctx.measureText(text);
  const inkWidth = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
  ctx.fillText(text, centreX - inkWidth / 2 + m.actualBoundingBoxLeft, baseline);
}

/**
 * Draw one person's certificate into `ctx`, at `scale` of the template's size
 * (1 for a download, smaller for an on-screen preview).
 */
export function drawCertificate(
  ctx: CanvasRenderingContext2D,
  prepared: PreparedTemplate,
  person: { name: string; team: string },
  scale = 1,
) {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.drawImage(prepared.image, 0, 0);

  // 1. The person's name, in capitals.
  const name = printedName(person.name);
  let nameSize = fitSize(ctx, 400, NAME_CAP_HEIGHT);
  ctx.font = font(400, nameSize);
  while (ctx.measureText(name).width > NAME_MAX_WIDTH && nameSize > 40) {
    nameSize -= 2;
    ctx.font = font(400, nameSize);
  }
  clearBand(
    ctx,
    prepared.image,
    NAME_BAND,
    NAME_CLEAR[0],
    NAME_CLEAR[1],
    NAME_PAPER_ABOVE,
    NAME_PAPER_BELOW,
  );
  ctx.fillStyle = INK;
  drawCentred(ctx, name, NAME_CENTRE, NAME_BASELINE);

  // 2. The team name inside the sentence, in capitals as the template sets it.
  const team = printedName(person.team);
  ctx.font = font(700, fitSize(ctx, 700, TEAM_CAP_HEIGHT));
  const tm = ctx.measureText(team);
  const newWidth = tm.actualBoundingBoxLeft + tm.actualBoundingBoxRight;
  const delta = newWidth - (TEAM_RIGHT - TEAM_LEFT);
  const shift = Math.round(delta / 2);
  const [pTop, pBottom] = PARA_BAND;
  const bandH = pBottom - pTop;

  clearBand(
    ctx,
    prepared.image,
    PARA_BAND,
    LINE_LEFT - Math.abs(shift) - 20,
    LINE_RIGHT + Math.abs(shift) + 20,
    PARA_PAPER_ABOVE,
    PARA_PAPER_BELOW,
  );
  // The words before and after the placeholder, straight from the template.
  ctx.drawImage(
    prepared.image,
    LINE_LEFT, pTop, TEAM_LEFT - LINE_LEFT, bandH,
    LINE_LEFT - shift, pTop, TEAM_LEFT - LINE_LEFT, bandH,
  );
  ctx.drawImage(
    prepared.image,
    TEAM_RIGHT, pTop, LINE_RIGHT - TEAM_RIGHT, bandH,
    TEAM_RIGHT + delta - shift, pTop, LINE_RIGHT - TEAM_RIGHT, bandH,
  );

  ctx.fillStyle = INK;
  drawCentred(ctx, team, TEAM_LEFT - shift + newWidth / 2, TEAM_BASELINE);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** File-name-safe version of a person's name. */
export function certificateFileName(index: number, name: string) {
  const safe = printedName(name).replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "");
  return `${String(index).padStart(2, "0")}_${safe || "CERTIFICATE"}`;
}
