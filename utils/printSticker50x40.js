export function printSticker50x40({ title="", size="", brand="", sku="", qrDataUrl="" }) {
  const iframe = document.createElement("iframe");
  Object.assign(iframe.style, { position:"fixed", right:0, bottom:0, width:0, height:0, border:0 });
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow.document;
  const esc = (s) => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

  doc.open();
  doc.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Print 50x40</title>
<style>
  /* One physical page only */
  @page { size: 50mm 40mm; margin: 0; }

  @media print {
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 50mm !important;
      height: 40mm !important;   /* exactly one page tall */
      overflow: hidden !important;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
  }

  /* Page container WITHOUT page-break-after */
  .page {
    width: 50mm;
    height: 40mm;
    box-sizing: border-box;
    overflow: hidden;
    /* page-break-after: always;  <-- REMOVED to prevent blank 2nd page */
    break-after: avoid-page;
  }

  /* Safety box slightly smaller than paper to defeat rounding/driver quirks */
  .safe {
    width: 49mm;              /* raise to 49.4 if you want it bigger */
    height: 39mm;             /* raise to 39.4 if you want it bigger */
    box-sizing: border-box;
    padding: 1.2mm 2mm 1.2mm 2mm;
    display: flex;
    align-items: center;
    gap: 1.4mm;
  }

  .qr   { width: 22mm; height: 22mm; object-fit: contain; image-rendering: pixelated; flex: 0 0 auto; }
  .text { display:flex; flex-direction:column; line-height:1.05; font-family:-apple-system, Segoe UI, Roboto, Arial, Helvetica, "Noto Sans", sans-serif; color:#000; user-select:none; overflow:hidden; }
  .title { font-size:10px; font-weight:700; }
  .line  { font-size:9px;  font-weight:500; }
  .sku   { font-size:9px;  font-weight:600; margin-top:0.5mm; }
</style>
</head>
<body>
  <div class="page">
    <div class="safe">
      ${qrDataUrl ? `<img class="qr" src="${qrDataUrl}" alt="QR" />` : `<div class="qr"></div>`}
      <div class="text">
        ${title ? `<div class="title">${esc(title)}</div>` : ""}
        ${size  ? `<div class="line">${esc(size)}</div>` : ""}
        ${brand ? `<div class="line">${esc(brand)}</div>` : ""}
        ${sku   ? `<div class="sku">${esc(sku)}</div>`   : ""}
      </div>
    </div>
  </div>
  <script>
    window.onload = function () {
      setTimeout(function () {
        window.focus();
        window.print();
        setTimeout(function(){ window.close && window.close(); }, 100);
      }, 30);
    };
  </script>
</body>
</html>`);
  doc.close();

  setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 4000);
}
