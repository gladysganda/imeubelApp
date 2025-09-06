// utils/tspl.js
/**
 * Build a 50x40 mm TSPL label with QR on the left and text on the right.
 * Tune XY if you want tiny nudges later.
 */
export function buildTspl50x40(product = {}) {
  const title   = (product?.name || "").toString();
  const size    = (product?.sizes || "").toString();
  const brand   = (product?.brand || "").toString();
  const barcode = (product?.barcode || "").toString();
  const qrData  = barcode || title || " ";

  // --- geometry (dots) ---
  // TSPL on most 203 dpi labelers: 1 mm ≈ 8 dots.
  const mm = (n) => Math.round(n * 8);
  const W   = mm(50);     // width  in dots: 400
  const H   = mm(40);     // height in dots: 320
  const GAP = mm(2);      // 2 mm gap (unused if continuous, safe to keep)

  // layout (left QR, right text)
  const qrX = mm(3);       // 3 mm from left
  const qrY = mm(3);       // 3 mm from top
  const qrCell = 6;        // QR cell size (try 5–8 if you need)
  // right-column text start
  const tX = mm(28);       // ~ 28 mm so QR + 2mm gutter
  const line = mm(5);      // ≈ 5 mm line height
  const tY1 = mm(3);
  const tY2 = tY1 + line;
  const tY3 = tY2 + line;
  const tY4 = tY3 + line;

  // TSPL program
  const lines = [
    `SIZE 50 mm,40 mm`,
    `GAP ${GAP},0`,
    `DIRECTION 1`,
    `REFERENCE 0,0`,
    `CLS`,

    // QR code (version auto, ECC L)
    `QRCODE ${qrX},${qrY},L,${qrCell},A,0,"${escapeTspl(qrData)}"`,

    // TEXT: FONT 0 (TSPL’s 8x12), X-mul,Y-mul=1
    title   ? `TEXT ${tX},${tY1},"0",0,1,1,"${escapeTspl(title)}"`   : ``,
    size    ? `TEXT ${tX},${tY2},"0",0,1,1,"${escapeTspl(size)}"`    : ``,
    brand   ? `TEXT ${tX},${tY3},"0",0,1,1,"${escapeTspl(brand)}"`   : ``,
    barcode ? `TEXT ${tX},${tY4},"0",0,1,1,"${escapeTspl(barcode)}"` : ``,

    `PRINT 1,1`,
  ].filter(Boolean);

  // TSPL expects CRLF
  return lines.join(`\r\n`) + `\r\n`;
}

function escapeTspl(s) {
  return String(s).replace(/"/g, `'`);
}
