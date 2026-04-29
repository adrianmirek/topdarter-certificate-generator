import type { CertificateAIPromptInput } from "../../types";
import sharp from "sharp";
import { readFileSync } from "fs";
import { join } from "path";

// Embedded at module load time so the font is available inside Vercel's
// read-only serverless sandbox without any filesystem writes.
const FONT_BASE64 = readFileSync(
  join(__dirname, "../../fonts/Inter.ttf")
).toString("base64");
const FONT_FAMILY = "Inter";

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

async function fetchTemplateBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch certificate template (${response.status}): ${url}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function tryFetchTemplateBuffer(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

async function detectTextRect(buffer: Buffer): Promise<Rect> {
  const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  function isPureRed(r: number, g: number, b: number): boolean {
    return r > 220 && g < 30 && b < 30 && r - g > 180 && r - b > 180;
  }

  const rowLeft: (number | null)[] = Array(height).fill(null);
  const rowRight: (number | null)[] = Array(height).fill(null);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      if (isPureRed(data[idx], data[idx + 1], data[idx + 2])) {
        if (rowLeft[y] === null) rowLeft[y] = x;
        rowRight[y] = x;
      }
    }
  }

  const MIN_SPAN = width * 0.1;
  const borderRows: number[] = [];
  for (let y = 0; y < height; y++) {
    const left = rowLeft[y];
    const right = rowRight[y];
    if (left !== null && right !== null && right - left >= MIN_SPAN) {
      borderRows.push(y);
    }
  }

  console.log(
    `[detectTextRect] ${width}x${height} - ${borderRows.length} border rows, MIN_SPAN=${Math.round(MIN_SPAN)}px`
  );

  if (borderRows.length === 0) {
    throw new Error(
      "No red text-area rectangle found in certificate template. " +
        "Draw exactly one #FF0000 rectangle where player name and stats should appear."
    );
  }

  const TOLERANCE = Math.round(width * 0.05);
  const rects: Rect[] = [];
  const firstRow = borderRows[0];

  let gTop = firstRow;
  let gBottom = firstRow;
  let gLeft = rowLeft[firstRow] ?? 0;
  let gRight = rowRight[firstRow] ?? 0;

  const flush = () =>
    rects.push({
      left: gLeft,
      top: gTop,
      width: gRight - gLeft + 1,
      height: gBottom - gTop + 1,
    });

  for (let i = 1; i < borderRows.length; i++) {
    const y = borderRows[i];
    const l = rowLeft[y] ?? gLeft;
    const r = rowRight[y] ?? gRight;

    if (y - borderRows[i - 1] <= 6 && Math.abs(l - gLeft) <= TOLERANCE && Math.abs(r - gRight) <= TOLERANCE) {
      gBottom = y;
      gLeft = Math.min(gLeft, l);
      gRight = Math.max(gRight, r);
    } else {
      flush();
      gTop = y;
      gBottom = y;
      gLeft = l;
      gRight = r;
    }
  }
  flush();

  console.log(
    `[detectTextRect] ${rects.length} rectangle(s):`,
    rects.map((r) => `(${r.left},${r.top}) ${r.width}x${r.height}`)
  );

  return rects.sort((a, b) => b.width * b.height - a.width * a.height)[0];
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function fitFontSize(text: string, maxPx: number, idealSize: number): number {
  const estimated = text.length * idealSize * 0.62;
  if (estimated <= maxPx) return idealSize;
  return Math.max(10, Math.floor(idealSize * (maxPx / estimated)));
}

async function overlayText(
  baseBuf: Buffer,
  originalRect: Rect,
  displayName: string,
  statsLine: string
): Promise<Buffer> {
  const rect = originalRect;
  const { width, height } = rect;
  const usableWidth = Math.floor(width * 0.92);
  const cx = Math.floor(width / 2);

  const NAME_REFERENCE = "Steyer Sebastian";
  const nameFontIdeal = Math.max(14, Math.floor(height * 0.5));
  const nameFont = fitFontSize(NAME_REFERENCE, usableWidth, nameFontIdeal);

  const statsFontIdeal = Math.max(10, Math.floor(nameFont * 0.5));
  const statsFont = statsLine ? fitFontSize(statsLine, usableWidth, statsFontIdeal) : 0;

  const nameLineH = Math.floor(nameFont * 1.15);
  const GAP = Math.max(6, Math.floor(height * 0.04));
  const statsLineH = statsLine ? Math.floor(statsFont * 1.15) : 0;
  const totalH = nameLineH + (statsLine ? GAP + statsLineH : 0);

  const TOP_BIAS = Math.floor(height * 0.1);
  const blockTop = Math.max(4, Math.floor((height - totalH) / 2) - TOP_BIAS);
  const nameY = blockTop + Math.floor(nameLineH / 2);
  const statsY = statsLine ? blockTop + nameLineH + GAP + Math.floor(statsLineH / 2) : 0;

  const statsEl = statsLine
    ? `<text x="${cx}" y="${statsY}" text-anchor="middle" dominant-baseline="middle" font-family="${FONT_FAMILY}" font-size="${statsFont}" fill="#333333">${escapeXml(statsLine)}</text>`
    : "";

  const fontFace = `@font-face { font-family: '${FONT_FAMILY}'; src: url('data:font/truetype;base64,${FONT_BASE64}') format('truetype'); }`;

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" overflow="hidden"><defs><style>${fontFace}</style></defs><text x="${cx}" y="${nameY}" text-anchor="middle" dominant-baseline="middle" font-family="${FONT_FAMILY}" font-size="${nameFont}" font-weight="bold" fill="#1a1a1a">${escapeXml(displayName)}</text>${statsEl}</svg>`;

  return sharp(baseBuf)
    .composite([{ input: Buffer.from(svg), left: rect.left, top: rect.top }])
    .webp()
    .toBuffer();
}

export async function generateCertificateImage(input: CertificateAIPromptInput): Promise<ArrayBuffer> {
  const [detectionBufferOrNull, templateBuffer] = await Promise.all([
    tryFetchTemplateBuffer(input.watermark_detection_image_url),
    fetchTemplateBuffer(input.watermark_image_url),
  ]);

  const detectionBuffer = detectionBufferOrNull ?? templateBuffer;
  if (!detectionBufferOrNull) {
    console.warn(
      "[certificateImageGenerator] watermark-red-rectangle.webp not found, falling back to watermark.webp for detection."
    );
  }

  const textRect = await detectTextRect(detectionBuffer);

  const statParts: string[] = [];
  if (input.stats.average_score != null) statParts.push(`AVG: ${input.stats.average_score.toFixed(2)}`);
  if (input.stats.high_finish) statParts.push(`HF: ${input.stats.high_finish}`);
  if (input.stats.best_leg) statParts.push(`BL: ${input.stats.best_leg}`);
  if (input.stats.score_140_count) statParts.push(`140+: ${input.stats.score_140_count}`);
  if (input.stats.score_170_count) statParts.push(`170+: ${input.stats.score_170_count}`);
  const statsLine = statParts.join("  ");

  const finalBuffer = await overlayText(templateBuffer, textRect, input.display_name, statsLine);
  const slice = finalBuffer.buffer.slice(finalBuffer.byteOffset, finalBuffer.byteOffset + finalBuffer.byteLength);
  return slice as ArrayBuffer;
}
