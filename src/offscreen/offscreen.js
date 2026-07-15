/**
 * Offscreen document — crop, stitch, PDF build.
 */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handle(message)
    .then(sendResponse)
    .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
  return true;
});

async function handle(message) {
  switch (message.type) {
    case 'OFFSCREEN_CROP':
      return crop(message);
    case 'OFFSCREEN_STITCH':
      return stitch(message);
    case 'OFFSCREEN_PDF':
      return buildPdf(message);
    default:
      return { ok: false, error: 'Unhandled: ' + message.type };
  }
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = dataUrl;
  });
}

async function crop({ dataUrl, sx, sy, sw, sh }) {
  const img = await loadImage(dataUrl);
  const w = Math.max(1, Math.min(sw, img.width - sx));
  const h = Math.max(1, Math.min(sh, img.height - sy));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, sx, sy, w, h, 0, 0, w, h);
  return { ok: true, dataUrl: canvas.toDataURL('image/png') };
}

async function stitch({ slices, width, height, viewportHeight }) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const slice of slices) {
    const img = await loadImage(slice.dataUrl);
    const drawH = slice.height || Math.min(viewportHeight, canvas.height - slice.y);
    const srcY = slice.srcOffset || 0;
    const srcH = Math.min(img.height - srcY, drawH);
    ctx.drawImage(img, 0, srcY, img.width, srcH, 0, slice.y, width, srcH);
  }

  // Prefer PNG for editor quality; cap size by falling back to JPEG if huge
  let dataUrl;
  try {
    dataUrl = canvas.toDataURL('image/png');
    if (dataUrl.length > 25_000_000) {
      dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    }
  } catch {
    dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  }
  return { ok: true, dataUrl };
}

async function buildPdf({ slices, width, height, viewportHeight, title }) {
  // First stitch into one image
  const stitched = await stitch({ slices, width, height, viewportHeight });
  if (!stitched.ok) return stitched;

  const img = await loadImage(stitched.dataUrl);
  const { jsPDF } = window.jspdf;
  // A4 portrait in mm
  const pdf = new jsPDF({ orientation: img.width > img.height ? 'l' : 'p', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  // Scale image to page width
  const imgWmm = pageW;
  const imgHmm = (img.height / img.width) * pageW;
  const pages = Math.max(1, Math.ceil(imgHmm / pageH));

  // Draw page-sized slices from the big canvas
  const pageCanvas = document.createElement('canvas');
  const scale = img.width / pageW; // px per mm
  pageCanvas.width = img.width;
  pageCanvas.height = Math.round(pageH * scale);
  const pctx = pageCanvas.getContext('2d');

  for (let i = 0; i < pages; i++) {
    if (i > 0) pdf.addPage();
    const srcY = Math.round(i * pageH * scale);
    const srcH = Math.min(pageCanvas.height, img.height - srcY);
    pctx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
    pctx.fillStyle = '#ffffff';
    pctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    pctx.drawImage(img, 0, srcY, img.width, srcH, 0, 0, img.width, srcH);
    const sliceUrl = pageCanvas.toDataURL('image/jpeg', 0.85);
    const drawH = (srcH / img.width) * pageW;
    pdf.addImage(sliceUrl, 'JPEG', 0, 0, pageW, drawH);
  }

  const dataUrl = pdf.output('datauristring');
  return { ok: true, dataUrl, title };
}
