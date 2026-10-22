/**
 * Renders the finished order as a single PNG image.
 *
 * An editable text message is a scam risk: a customer could change the
 * quantity, the size or the price before sending. The order therefore goes
 * to WhatsApp as a picture — the details are fixed at the moment they are
 * drawn, and the customer can only send the picture.
 *
 * Plain canvas, no libraries: the drawing is simple enough that shipping an
 * image library would cost more than it saves.
 */

const INK = '#171717';
const MUTED = '#6b6b6b';
const PAPER = '#f7f5f0';
const LIME = '#a3e635';

const WIDTH = 900;
const PAD = 56;

interface OrderImageInput {
  /** Short reference printed in the header, e.g. TW-482913. */
  reference: string;
  /** Human date, e.g. "21 Oct 2026, 14:32". */
  dateLabel: string;
  /** The greeting that goes with the message. */
  greeting: string;
  /** Pre-formatted order lines, already priced. */
  lines: string[];
  /** Printed in the footer. */
  footnote: string;
  /**
   * What the QR code opens. It is the picture of the order itself, so the
   * store can scan it and read the order straight away.
   */
  qrPayload: string;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Naive word wrap — good enough for the short lines of an order. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const out: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      out.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) out.push(line);
  return out.length ? out : [''];
}

/**
 * Draws the order card and returns a PNG blob.
 */
export async function renderOrderImage(input: OrderImageInput): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');

  const contentWidth = WIDTH - PAD * 2;

  // --- measure the body first so the card is exactly as tall as it needs ---
  ctx.font = '400 26px "Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
  const bodyLines: string[] = [];
  for (const raw of input.lines) {
    bodyLines.push(...wrap(ctx, raw, contentWidth));
  }

  const headerHeight = 190;
  const bodyLineHeight = 38;
  const bodyHeight = bodyLines.length * bodyLineHeight + 60;
  const greetingHeight = 74;
  const messageBoxHeight = 260;
  const footerHeight = 120;
  const height = headerHeight + greetingHeight + bodyHeight + messageBoxHeight + footerHeight;

  canvas.width = WIDTH;
  canvas.height = height;

  // --- background ---
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, WIDTH, height);

  // --- header ---
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, WIDTH, headerHeight);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 46px "Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('TRIOSWORLD', PAD, 84);

  ctx.fillStyle = LIME;
  ctx.font = '600 24px "Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.fillText('NEW ORDER', PAD, 124);

  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.font = '400 22px "Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.fillText(input.dateLabel, PAD, 160);

  // reference, right aligned
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 26px "Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.fillText(input.reference, WIDTH - PAD, 84);
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.font = '400 22px "Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.fillText('Order reference', WIDTH - PAD, 124);
  ctx.textAlign = 'left';

  // --- the greeting that opens the message ---
  const greetingTop = headerHeight + 48;
  ctx.fillStyle = INK;
  ctx.font = 'italic 500 26px "Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.fillText(`“${input.greeting}”`, PAD, greetingTop);

  // --- body ---
  let y = headerHeight + greetingHeight + 30;
  ctx.fillStyle = INK;
  ctx.font = '400 26px "Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
  for (const line of bodyLines) {
    // The total line is the important one — make it stand out.
    if (line.startsWith('TOTAL')) {
      ctx.font = '700 28px "Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
      ctx.fillStyle = INK;
    }
    ctx.fillText(line, PAD, y);
    y += bodyLineHeight;
    if (line.startsWith('TOTAL')) {
      ctx.font = '400 26px "Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
    }
  }

  // --- message box: the QR code and "this is my order" ---
  const boxTop = headerHeight + greetingHeight + bodyHeight;
  const boxX = PAD;
  const boxW = WIDTH - PAD * 2;
  const boxY = boxTop + 12;

  ctx.fillStyle = '#ffffff';
  roundRect(ctx, boxX, boxY, boxW, messageBoxHeight - 24, 22);
  ctx.fill();
  ctx.strokeStyle = 'rgba(23,23,23,0.14)';
  ctx.lineWidth = 2;
  roundRect(ctx, boxX, boxY, boxW, messageBoxHeight - 24, 22);
  ctx.stroke();

  const qrSize = 180;
  const qrX = boxX + 32;
  const qrY = boxY + 24;
  const qr = await renderQr(input.qrPayload, qrSize);
  if (qr) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16);
    ctx.drawImage(qr, qrX, qrY, qrSize, qrSize);
  }

  const textX = qrX + qrSize + 40;
  ctx.fillStyle = INK;
  ctx.font = '700 30px "Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.fillText('This is my order', textX, qrY + 46);

  ctx.fillStyle = MUTED;
  ctx.font = '400 22px "Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.fillText('Send this on WhatsApp. The store scans', textX, qrY + 88);
  ctx.fillText('the QR to open the order details.', textX, qrY + 120);

  ctx.fillStyle = INK;
  ctx.font = '600 22px "Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.fillText(`Reference: ${input.reference}`, textX, qrY + 162);

  // --- footer ---
  const footerTop = height - footerHeight + 20;
  ctx.strokeStyle = 'rgba(23,23,23,0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, footerTop);
  ctx.lineTo(WIDTH - PAD, footerTop);
  ctx.stroke();

  ctx.fillStyle = MUTED;
  ctx.font = '400 22px "Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.fillText(input.footnote, PAD, footerTop + 46);

  ctx.fillStyle = INK;
  ctx.font = '600 22px "Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.fillText('www.triosworld.in', PAD, footerTop + 84);

  // A small badge so a cropped screenshot still looks like an order.
  ctx.fillStyle = INK;
  roundRect(ctx, WIDTH - PAD - 190, footerTop + 58, 190, 46, 23);
  ctx.fill();
  ctx.fillStyle = LIME;
  ctx.font = '600 20px "Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('VERIFIED ORDER', WIDTH - PAD - 95, footerTop + 88);
  ctx.textAlign = 'left';

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not render the order image'));
    }, 'image/png');
  });
}

/**
 * Renders the QR code. The library is loaded on demand — the picture is only
 * drawn when a customer actually orders, so it never sits in the first paint.
 */
async function renderQr(payload: string, size: number): Promise<HTMLCanvasElement | null> {
  try {
    const { default: QRCode } = await import('qrcode');
    const canvas = document.createElement('canvas');
    await QRCode.toCanvas(canvas, payload, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#171717', light: '#ffffff' },
    });
    return canvas;
  } catch {
    return null;
  }
}
