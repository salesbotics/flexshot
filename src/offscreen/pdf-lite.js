/**
 * Minimal single/multi-page PDF writer embedding JPEG images (no deps).
 * Output is a data URL: data:application/pdf;base64,...
 */

function escPdf(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function uint8ToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * @param {Array<{jpeg: Uint8Array, width: number, height: number}>} pages
 *   width/height in pixels; placed on A4-ish page scaled to fit width
 */
export function buildJpegPdf(pages, { title = 'Flexshot' } = {}) {
  const encoder = new TextEncoder();
  const objects = [];
  const addObj = (body) => {
    objects.push(body);
    return objects.length;
  };

  const pageWidth = 595.28; // A4 pt
  const pageHeight = 841.89;

  const kids = [];
  const pageObjs = [];

  for (const page of pages) {
    const imgId = addObj(null); // placeholder filled later
    const content = `q\n${pageWidth} 0 0 ${(page.height / page.width) * pageWidth} 0 ${pageHeight - (page.height / page.width) * pageWidth} cm\n/Im0 Do\nQ\n`;
    const contentId = addObj(
      `<< /Length ${content.length} >>\nstream\n${content}endstream`
    );
    const pageId = addObj(
      `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentId} 0 R /Resources << /XObject << /Im0 ${imgId} 0 R >> >> >>`
    );
    // Fix: Parent will be pages object; we'll rewrite after
    pageObjs.push({ pageId, imgId, jpeg: page.jpeg, w: page.width, h: page.height, contentId });
    kids.push(pageId);
  }

  const pagesId = addObj(
    `<< /Type /Pages /Kids [${kids.map((id) => `${id} 0 R`).join(' ')}] /Count ${kids.length} >>`
  );
  const catalogId = addObj(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  const infoId = addObj(
    `<< /Title (${escPdf(title)}) /Producer (Flexshot) /Creator (Flexshot) >>`
  );

  // Fill image objects and fix page Parent refs
  for (const p of pageObjs) {
    const softMask = '';
    objects[p.imgId - 1] =
      `<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`;
    // We'll handle binary separately — use a marker approach
    objects[p.imgId - 1] = { __jpeg: p.jpeg, header: objects[p.imgId - 1] };
    // Rewrite page dict with correct Parent
    objects[p.pageId - 1] =
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${p.contentId} 0 R /Resources << /XObject << /Im0 ${p.imgId} 0 R >> >> >>`;
  }

  // Assemble PDF bytes
  const parts = [];
  const offsets = [0];
  const pushStr = (s) => {
    parts.push(typeof s === 'string' ? encoder.encode(s) : s);
  };

  pushStr('%PDF-1.4\n');

  for (let i = 0; i < objects.length; i++) {
    const objNum = i + 1;
    // compute offset
    let offset = 0;
    for (const part of parts) offset += part.length;
    offsets[objNum] = offset;

    const body = objects[i];
    if (body && body.__jpeg) {
      pushStr(`${objNum} 0 obj\n`);
      // rebuild header properly
      const jpeg = body.__jpeg;
      // Find page dims from matching pageObjs
      const meta = pageObjs.find((p) => p.imgId === objNum);
      const header = `<< /Type /XObject /Subtype /Image /Width ${meta.w} /Height ${meta.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`;
      pushStr(header);
      parts.push(jpeg);
      pushStr('\nendstream\nendobj\n');
    } else {
      pushStr(`${objNum} 0 obj\n${body}\nendobj\n`);
    }
  }

  let xrefOffset = 0;
  for (const part of parts) xrefOffset += part.length;

  let xref = `xref\n0 ${objects.length + 1}\n`;
  xref += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  const trailer =
    `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  pushStr(xref);
  pushStr(trailer);

  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return 'data:application/pdf;base64,' + uint8ToBase64(out);
}

/** Convert a canvas / dataURL image into JPEG Uint8Array via canvas */
export async function dataUrlToJpegBytes(dataUrl, quality = 0.85) {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  const jpegUrl = canvas.toDataURL('image/jpeg', quality);
  const b64 = jpegUrl.split(',')[1];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, width: img.width, height: img.height };
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = dataUrl;
  });
}
