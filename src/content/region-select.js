/**
 * Region selection overlay — drag to capture a rectangle.
 */
(function () {
  if (window.__flexshotRegionActive) return;
  window.__flexshotRegionActive = true;

  const root = document.createElement('div');
  root.id = 'flexshot-region-root';
  root.innerHTML = `
    <div class="fs-hint">Drag to select · <kbd>Esc</kbd> cancel · <kbd>Enter</kbd> capture</div>
    <div class="fs-dim" data-side="top"></div>
    <div class="fs-dim" data-side="left"></div>
    <div class="fs-dim" data-side="right"></div>
    <div class="fs-dim" data-side="bottom"></div>
    <div class="fs-box" hidden></div>
  `;
  document.documentElement.appendChild(root);

  const box = root.querySelector('.fs-box');
  const dims = {
    top: root.querySelector('[data-side="top"]'),
    left: root.querySelector('[data-side="left"]'),
    right: root.querySelector('[data-side="right"]'),
    bottom: root.querySelector('[data-side="bottom"]')
  };

  let start = null;
  let rect = null;
  let dragging = false;

  function updateDims(r) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!r || r.w < 2 || r.h < 2) {
      dims.top.style.cssText = `left:0;top:0;width:100%;height:100%`;
      dims.left.style.cssText = 'display:none';
      dims.right.style.cssText = 'display:none';
      dims.bottom.style.cssText = 'display:none';
      box.hidden = true;
      return;
    }
    box.hidden = false;
    box.style.cssText = `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px`;
    dims.top.style.cssText = `left:0;top:0;width:100%;height:${r.y}px;display:block`;
    dims.left.style.cssText = `left:0;top:${r.y}px;width:${r.x}px;height:${r.h}px;display:block`;
    dims.right.style.cssText = `left:${r.x + r.w}px;top:${r.y}px;width:${vw - r.x - r.w}px;height:${r.h}px;display:block`;
    dims.bottom.style.cssText = `left:0;top:${r.y + r.h}px;width:100%;height:${vh - r.y - r.h}px;display:block`;
  }

  function normalize(a, b) {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const w = Math.abs(a.x - b.x);
    const h = Math.abs(a.y - b.y);
    return { x, y, w, h };
  }

  function cleanup() {
    window.__flexshotRegionActive = false;
    root.remove();
    window.removeEventListener('keydown', onKey, true);
  }

  function finish() {
    if (!rect || rect.w < 4 || rect.h < 4) {
      cancel();
      return;
    }
    const payload = {
      ...rect,
      devicePixelRatio: window.devicePixelRatio || 1
    };
    cleanup();
    chrome.runtime.sendMessage({ type: 'REGION_RESULT', rect: payload });
  }

  function cancel() {
    cleanup();
    chrome.runtime.sendMessage({ type: 'REGION_CANCEL' });
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      finish();
    }
  }

  root.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragging = true;
    start = { x: e.clientX, y: e.clientY };
    rect = null;
    updateDims(null);
  });

  root.addEventListener('mousemove', (e) => {
    if (!dragging || !start) return;
    rect = normalize(start, { x: e.clientX, y: e.clientY });
    updateDims(rect);
  });

  root.addEventListener('mouseup', (e) => {
    if (!dragging) return;
    dragging = false;
    rect = normalize(start, { x: e.clientX, y: e.clientY });
    updateDims(rect);
    if (rect.w >= 4 && rect.h >= 4) finish();
  });

  window.addEventListener('keydown', onKey, true);
  updateDims(null);
})();
