/**
 * Flexshot annotation editor — draw, shapes, text, crop, blur, export.
 */

const baseCanvas = document.getElementById('baseCanvas');
const drawCanvas = document.getElementById('drawCanvas');
const baseCtx = baseCanvas.getContext('2d');
const drawCtx = drawCanvas.getContext('2d');
const stage = document.getElementById('stage');
const canvasWrap = document.getElementById('canvasWrap');
const textLayer = document.getElementById('textLayer');
const cropOverlay = document.getElementById('cropOverlay');
const emptyEl = document.getElementById('empty');
const docTitle = document.getElementById('docTitle');
const zoomLabel = document.getElementById('zoomLabel');

const strokeColorEl = document.getElementById('strokeColor');
const fillColorEl = document.getElementById('fillColor');
const strokeWidthEl = document.getElementById('strokeWidth');
const filledEl = document.getElementById('filled');
const exportFormatEl = document.getElementById('exportFormat');

let tool = 'pen';
let zoom = 1;
let shapes = [];
let history = [];
let future = [];
let drawing = null;
let selectedId = null;
let numberCounter = 1;
let baseImage = null;
let dragOffset = null;

const HIT_PAD = 6;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function pushHistory() {
  history.push(JSON.stringify({ shapes, numberCounter }));
  if (history.length > 80) history.shift();
  future = [];
}

function restoreSnapshot(snap) {
  const data = JSON.parse(snap);
  shapes = data.shapes;
  numberCounter = data.numberCounter;
  selectedId = null;
  redraw();
}

function undo() {
  if (!history.length) return;
  future.push(JSON.stringify({ shapes, numberCounter }));
  restoreSnapshot(history.pop());
}

function redo() {
  if (!future.length) return;
  history.push(JSON.stringify({ shapes, numberCounter }));
  restoreSnapshot(future.pop());
}

function setTool(next) {
  tool = next;
  document.querySelectorAll('.tool').forEach((b) => {
    b.classList.toggle('active', b.dataset.tool === tool);
  });
  drawCanvas.style.cursor = tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair';
  if (tool === 'crop') startCropMode();
  else endCropMode();
}

document.querySelectorAll('.tool').forEach((btn) => {
  btn.addEventListener('click', () => setTool(btn.dataset.tool));
});

function style() {
  return {
    stroke: strokeColorEl.value,
    fill: fillColorEl.value,
    width: Number(strokeWidthEl.value),
    filled: filledEl.checked
  };
}

function resizeCanvases(w, h) {
  baseCanvas.width = w;
  baseCanvas.height = h;
  drawCanvas.width = w;
  drawCanvas.height = h;
  stage.style.width = w + 'px';
  stage.style.height = h + 'px';
  applyZoom();
}

function applyZoom() {
  stage.style.transform = `scale(${zoom})`;
  zoomLabel.textContent = Math.round(zoom * 100) + '%';
}

function fitZoom() {
  if (!baseImage) return;
  const pad = 48;
  const availW = canvasWrap.clientWidth - pad;
  const availH = canvasWrap.clientHeight - pad;
  zoom = Math.min(1, availW / baseImage.width, availH / baseImage.height);
  applyZoom();
}

async function loadPending() {
  const res = await chrome.runtime.sendMessage({ type: 'GET_IMAGE' });
  if (!res?.ok || !res.payload?.dataUrl) {
    emptyEl.textContent = 'No screenshot loaded. Capture one from the Flexshot popup.';
    return;
  }
  const meta = res.payload.meta || {};
  docTitle.textContent = meta.title || 'Screenshot';
  document.title = `Flexshot — ${meta.title || 'Editor'}`;

  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = res.payload.dataUrl;
  });
  baseImage = img;
  resizeCanvases(img.width, img.height);
  baseCtx.drawImage(img, 0, 0);
  emptyEl.hidden = true;
  fitZoom();
  redraw();
  await chrome.runtime.sendMessage({ type: 'CLEAR_IMAGE' });
}

function redraw() {
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  for (const s of shapes) drawShape(drawCtx, s, s.id === selectedId);
  if (drawing) drawShape(drawCtx, drawing, false);
}

function drawShape(ctx, s, highlight) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (s.type === 'pen' || s.type === 'highlighter') {
    ctx.globalAlpha = s.type === 'highlighter' ? 0.35 : 1;
    ctx.strokeStyle = s.stroke;
    ctx.lineWidth = s.width;
    ctx.beginPath();
    s.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
  } else if (s.type === 'line' || s.type === 'arrow') {
    ctx.strokeStyle = s.stroke;
    ctx.lineWidth = s.width;
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
    if (s.type === 'arrow') drawArrowHead(ctx, s);
  } else if (s.type === 'rect') {
    const { x, y, w, h } = normalizeRect(s.x1, s.y1, s.x2, s.y2);
    if (s.filled) {
      ctx.fillStyle = hexAlpha(s.fill, 0.25);
      ctx.fillRect(x, y, w, h);
    }
    ctx.strokeStyle = s.stroke;
    ctx.lineWidth = s.width;
    ctx.strokeRect(x, y, w, h);
  } else if (s.type === 'ellipse') {
    const { x, y, w, h } = normalizeRect(s.x1, s.y1, s.x2, s.y2);
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
    if (s.filled) {
      ctx.fillStyle = hexAlpha(s.fill, 0.25);
      ctx.fill();
    }
    ctx.strokeStyle = s.stroke;
    ctx.lineWidth = s.width;
    ctx.stroke();
  } else if (s.type === 'text') {
    ctx.fillStyle = s.stroke;
    ctx.font = `${s.fontSize || 22}px "IBM Plex Sans", sans-serif`;
    wrapText(ctx, s.text || '', s.x, s.y, s.maxWidth || 320, s.fontSize || 22);
  } else if (s.type === 'number') {
    const r = s.radius || 16;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fillStyle = s.stroke;
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${Math.round(r * 1.1)}px "IBM Plex Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(s.n), s.x, s.y + 0.5);
  } else if (s.type === 'blur') {
    const { x, y, w, h } = normalizeRect(s.x1, s.y1, s.x2, s.y2);
    applyPixelate(ctx, x, y, w, h, s.block || 12);
  }

  if (highlight) {
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#00c4b4';
    ctx.lineWidth = 1;
    const b = bounds(s);
    if (b) ctx.strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
  }
  ctx.restore();
}

function drawArrowHead(ctx, s) {
  const angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
  const len = 12 + s.width * 1.5;
  ctx.beginPath();
  ctx.moveTo(s.x2, s.y2);
  ctx.lineTo(s.x2 - len * Math.cos(angle - 0.4), s.y2 - len * Math.sin(angle - 0.4));
  ctx.moveTo(s.x2, s.y2);
  ctx.lineTo(s.x2 - len * Math.cos(angle + 0.4), s.y2 - len * Math.sin(angle + 0.4));
  ctx.stroke();
}

function applyPixelate(ctx, x, y, w, h, block) {
  if (w < 2 || h < 2 || !baseImage) return;
  const sx = Math.max(0, Math.floor(x));
  const sy = Math.max(0, Math.floor(y));
  const sw = Math.min(baseCanvas.width - sx, Math.floor(w));
  const sh = Math.min(baseCanvas.height - sy, Math.floor(h));
  if (sw < 1 || sh < 1) return;

  // Sample from composed base + previous blurs via temporary
  const tmp = document.createElement('canvas');
  tmp.width = baseCanvas.width;
  tmp.height = baseCanvas.height;
  const tctx = tmp.getContext('2d');
  tctx.drawImage(baseCanvas, 0, 0);
  // Only pixelate from base image region for consistency
  const imgData = baseCtx.getImageData(sx, sy, sw, sh);
  const out = ctx.createImageData(sw, sh);
  for (let py = 0; py < sh; py += block) {
    for (let px = 0; px < sw; px += block) {
      const i = ((py * sw) + px) * 4;
      const r = imgData.data[i];
      const g = imgData.data[i + 1];
      const b = imgData.data[i + 2];
      for (let by = 0; by < block && py + by < sh; by++) {
        for (let bx = 0; bx < block && px + bx < sw; bx++) {
          const j = (((py + by) * sw) + (px + bx)) * 4;
          out.data[j] = r;
          out.data[j + 1] = g;
          out.data[j + 2] = b;
          out.data[j + 3] = 255;
        }
      }
    }
  }
  ctx.putImageData(out, sx, sy);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const lines = text.split('\n');
  let cy = y;
  for (const line of lines) {
    const words = line.split(' ');
    let cur = '';
    for (const word of words) {
      const test = cur ? cur + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && cur) {
        ctx.fillText(cur, x, cy);
        cur = word;
        cy += lineHeight * 1.25;
      } else cur = test;
    }
    ctx.fillText(cur, x, cy);
    cy += lineHeight * 1.25;
  }
}

function normalizeRect(x1, y1, x2, y2) {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);
  return { x, y, w, h };
}

function hexAlpha(hex, a) {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function pointer(e) {
  const rect = drawCanvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) / zoom,
    y: (e.clientY - rect.top) / zoom
  };
}

function bounds(s) {
  if (s.type === 'pen' || s.type === 'highlighter') {
    if (!s.points?.length) return null;
    const xs = s.points.map((p) => p.x);
    const ys = s.points.map((p) => p.y);
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      w: Math.max(...xs) - Math.min(...xs),
      h: Math.max(...ys) - Math.min(...ys)
    };
  }
  if (['line', 'arrow', 'rect', 'ellipse', 'blur'].includes(s.type)) {
    const r = normalizeRect(s.x1, s.y1, s.x2, s.y2);
    return r;
  }
  if (s.type === 'text') {
    return { x: s.x, y: s.y - (s.fontSize || 22), w: s.maxWidth || 200, h: (s.fontSize || 22) * 3 };
  }
  if (s.type === 'number') {
    const r = s.radius || 16;
    return { x: s.x - r, y: s.y - r, w: r * 2, h: r * 2 };
  }
  return null;
}

function hitTest(x, y) {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i];
    const b = bounds(s);
    if (!b) continue;
    if (x >= b.x - HIT_PAD && x <= b.x + b.w + HIT_PAD && y >= b.y - HIT_PAD && y <= b.y + b.h + HIT_PAD) {
      return s;
    }
  }
  return null;
}

drawCanvas.addEventListener('mousedown', (e) => {
  if (!baseImage || e.button !== 0) return;
  const p = pointer(e);
  const st = style();

  if (tool === 'select') {
    const hit = hitTest(p.x, p.y);
    selectedId = hit?.id || null;
    if (hit) {
      pushHistory();
      dragOffset = { id: hit.id, ox: p.x, oy: p.y };
    }
    redraw();
    return;
  }

  if (tool === 'eraser') {
    const hit = hitTest(p.x, p.y);
    if (hit) {
      pushHistory();
      shapes = shapes.filter((s) => s.id !== hit.id);
      selectedId = null;
      redraw();
    }
    return;
  }

  if (tool === 'text') {
    placeText(p.x, p.y);
    return;
  }

  if (tool === 'number') {
    pushHistory();
    shapes.push({
      id: uid(),
      type: 'number',
      x: p.x,
      y: p.y,
      n: numberCounter++,
      stroke: st.stroke,
      radius: 10 + st.width * 1.5
    });
    redraw();
    return;
  }

  if (tool === 'pen' || tool === 'highlighter') {
    drawing = {
      id: uid(),
      type: tool,
      stroke: st.stroke,
      width: tool === 'highlighter' ? Math.max(12, st.width * 3) : st.width,
      points: [p]
    };
    return;
  }

  if (['line', 'arrow', 'rect', 'ellipse', 'blur'].includes(tool)) {
    drawing = {
      id: uid(),
      type: tool,
      x1: p.x,
      y1: p.y,
      x2: p.x,
      y2: p.y,
      stroke: st.stroke,
      fill: st.fill,
      width: st.width,
      filled: st.filled,
      block: 10 + Math.floor(st.width)
    };
  }
});

window.addEventListener('mousemove', (e) => {
  if (dragOffset && tool === 'select') {
    const p = pointer(e);
    const s = shapes.find((sh) => sh.id === dragOffset.id);
    if (!s) return;
    const dx = p.x - dragOffset.ox;
    const dy = p.y - dragOffset.oy;
    dragOffset.ox = p.x;
    dragOffset.oy = p.y;
    moveShape(s, dx, dy);
    redraw();
    return;
  }
  if (!drawing) return;
  const p = pointer(e);
  if (drawing.points) {
    drawing.points.push(p);
  } else {
    drawing.x2 = p.x;
    drawing.y2 = p.y;
  }
  redraw();
});

window.addEventListener('mouseup', () => {
  if (dragOffset) {
    dragOffset = null;
    return;
  }
  if (!drawing) return;
  pushHistory();
  shapes.push(drawing);
  drawing = null;
  redraw();
});

function moveShape(s, dx, dy) {
  if (s.points) {
    s.points.forEach((pt) => {
      pt.x += dx;
      pt.y += dy;
    });
  }
  if ('x1' in s) {
    s.x1 += dx;
    s.y1 += dy;
    s.x2 += dx;
    s.y2 += dy;
  }
  if ('x' in s && s.type !== 'pen') {
    s.x += dx;
    s.y += dy;
  }
}

function placeText(x, y) {
  const ta = document.createElement('textarea');
  ta.placeholder = 'Type…';
  ta.style.left = x + 'px';
  ta.style.top = y + 'px';
  ta.style.color = strokeColorEl.value;
  ta.style.fontSize = Math.max(14, Number(strokeWidthEl.value) * 4) + 'px';
  textLayer.appendChild(ta);
  ta.focus();

  const commit = () => {
    const text = ta.value.trim();
    ta.remove();
    if (!text) return;
    pushHistory();
    shapes.push({
      id: uid(),
      type: 'text',
      x,
      y: y + Number(ta.style.fontSize.replace('px', '')),
      text,
      stroke: strokeColorEl.value,
      fontSize: Number(ta.style.fontSize.replace('px', '')),
      maxWidth: Math.max(120, ta.offsetWidth)
    });
    redraw();
  };
  ta.addEventListener('blur', commit);
  ta.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      ta.value = '';
      ta.blur();
    }
    if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) {
      ev.preventDefault();
      ta.blur();
    }
  });
}

/* Crop */
let cropState = null;

function startCropMode() {
  cropOverlay.hidden = false;
  cropOverlay.innerHTML = '<div class="box" hidden></div><div style="position:absolute;top:12px;left:50%;transform:translateX(-50%);background:#0a1622;color:#e8f7f5;padding:8px 12px;border-radius:8px;font-size:12px;z-index:5">Drag crop area · Enter apply · Esc cancel</div>';
  const box = cropOverlay.querySelector('.box');
  let start = null;
  let rect = null;

  const onDown = (e) => {
    const r = drawCanvas.getBoundingClientRect();
    start = { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom };
    rect = null;
  };
  const onMove = (e) => {
    if (!start) return;
    const r = drawCanvas.getBoundingClientRect();
    const cur = { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom };
    rect = normalizeRect(start.x, start.y, cur.x, cur.y);
    box.hidden = false;
    box.style.left = rect.x + 'px';
    box.style.top = rect.y + 'px';
    box.style.width = rect.w + 'px';
    box.style.height = rect.h + 'px';
  };
  const onUp = () => {
    start = null;
  };
  const onKey = (e) => {
    if (e.key === 'Escape') {
      setTool('pen');
    }
    if (e.key === 'Enter' && rect && rect.w > 4 && rect.h > 4) {
      applyCrop(rect);
      setTool('pen');
    }
  };

  cropState = { onDown, onMove, onUp, onKey };
  cropOverlay.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  window.addEventListener('keydown', onKey);
}

function endCropMode() {
  cropOverlay.hidden = true;
  if (!cropState) return;
  cropOverlay.removeEventListener('mousedown', cropState.onDown);
  window.removeEventListener('mousemove', cropState.onMove);
  window.removeEventListener('mouseup', cropState.onUp);
  window.removeEventListener('keydown', cropState.onKey);
  cropState = null;
}

function applyCrop(rect) {
  pushHistory();
  const exportCanvas = flatten();
  const w = Math.floor(rect.w);
  const h = Math.floor(rect.h);
  const cropped = document.createElement('canvas');
  cropped.width = w;
  cropped.height = h;
  cropped.getContext('2d').drawImage(exportCanvas, rect.x, rect.y, w, h, 0, 0, w, h);

  const img = new Image();
  img.onload = () => {
    baseImage = img;
    shapes = [];
    history = [];
    future = [];
    numberCounter = 1;
    resizeCanvases(w, h);
    baseCtx.clearRect(0, 0, w, h);
    baseCtx.drawImage(img, 0, 0);
    redraw();
    fitZoom();
  };
  img.src = cropped.toDataURL('image/png');
}

function flatten() {
  const out = document.createElement('canvas');
  out.width = baseCanvas.width;
  out.height = baseCanvas.height;
  const ctx = out.getContext('2d');
  ctx.drawImage(baseCanvas, 0, 0);
  // draw shapes onto export (without selection highlight)
  const prevSelected = selectedId;
  selectedId = null;
  for (const s of shapes) drawShape(ctx, s, false);
  selectedId = prevSelected;
  return out;
}

async function download() {
  const format = exportFormatEl.value || 'png';
  const mime = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
  const quality = format === 'png' ? undefined : 0.92;
  const canvas = flatten();
  const dataUrl = canvas.toDataURL(mime, quality);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `flexshot_${stamp}.${format === 'jpeg' ? 'jpg' : format}`;
  await chrome.runtime.sendMessage({ type: 'DOWNLOAD', url: dataUrl, filename });
}

async function copyImage() {
  const canvas = flatten();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  document.getElementById('hint').textContent = 'Copied to clipboard';
  setTimeout(() => {
    document.getElementById('hint').textContent = 'Draw, mark, and type on your capture — then download';
  }, 1800);
}

document.getElementById('btnDownload').addEventListener('click', () => download().catch(alert));
document.getElementById('btnCopy').addEventListener('click', () => copyImage().catch((e) => alert(e.message)));
document.getElementById('btnUndo').addEventListener('click', undo);
document.getElementById('btnRedo').addEventListener('click', redo);
document.getElementById('zoomIn').addEventListener('click', () => {
  zoom = Math.min(3, zoom + 0.1);
  applyZoom();
});
document.getElementById('zoomOut').addEventListener('click', () => {
  zoom = Math.max(0.2, zoom - 0.1);
  applyZoom();
});
document.getElementById('zoomFit').addEventListener('click', fitZoom);

window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    redo();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    download();
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selectedId && document.activeElement?.tagName !== 'TEXTAREA') {
      pushHistory();
      shapes = shapes.filter((s) => s.id !== selectedId);
      selectedId = null;
      redraw();
    }
  }
});

loadPending().catch((err) => {
  emptyEl.hidden = false;
  emptyEl.textContent = err.message || 'Failed to load image';
});
