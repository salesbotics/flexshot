/**
 * Flexshot service worker — capture orchestration, downloads, editor handoff.
 */

const IMAGE_KEY = 'flexshot_pending_image';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'flexshot-root',
      title: 'Flexshot',
      contexts: ['page', 'selection', 'image']
    });
    chrome.contextMenus.create({
      id: 'CAPTURE_REGION',
      parentId: 'flexshot-root',
      title: 'Capture selected area',
      contexts: ['page', 'selection', 'image']
    });
    chrome.contextMenus.create({
      id: 'CAPTURE_VISIBLE',
      parentId: 'flexshot-root',
      title: 'Capture visible part',
      contexts: ['page', 'selection', 'image']
    });
    chrome.contextMenus.create({
      id: 'CAPTURE_FULLPAGE',
      parentId: 'flexshot-root',
      title: 'Capture full page',
      contexts: ['page', 'selection', 'image']
    });
    chrome.contextMenus.create({
      id: 'OPEN_RECORDER',
      parentId: 'flexshot-root',
      title: 'Record screen…',
      contexts: ['page', 'selection', 'image']
    });
    chrome.contextMenus.create({
      id: 'EXPORT_PDF',
      parentId: 'flexshot-root',
      title: 'Save page as PDF',
      contexts: ['page', 'selection', 'image']
    });
    chrome.contextMenus.create({
      id: 'SHOW_LAUNCHER',
      parentId: 'flexshot-root',
      title: 'Open Flexshot menu',
      contexts: ['page', 'selection', 'image']
    });
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  const map = {
    CAPTURE_REGION: () => startRegionCapture(),
    CAPTURE_VISIBLE: () => captureVisible(),
    CAPTURE_FULLPAGE: () => captureFullPage(),
    OPEN_RECORDER: () => openRecorder(),
    EXPORT_PDF: () => exportWebToPdf(),
    SHOW_LAUNCHER: () => showPageLauncher()
  };
  const run = map[info.menuItemId];
  if (run) run().catch((err) => console.error('Flexshot menu error', err));
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'capture-visible') await captureVisible();
  else if (command === 'capture-region') await startRegionCapture();
  else if (command === 'capture-fullpage') await captureFullPage();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (String(message?.type || '').startsWith('OFFSCREEN_')) {
    return false; // let the offscreen document respond
  }
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
  return true;
});

async function handleMessage(message, sender) {
  // Offscreen document handles these — ignore in the service worker
  if (String(message?.type || '').startsWith('OFFSCREEN_')) {
    return undefined;
  }

  switch (message.type) {
    case 'CAPTURE_VISIBLE':
      return captureVisible();
    case 'CAPTURE_REGION':
      return startRegionCapture();
    case 'CAPTURE_FULLPAGE':
      return captureFullPage();
    case 'REGION_RESULT': {
      const dataUrl = await cropFromVisible(message.rect, sender.tab);
      await openEditor(dataUrl, { title: sender.tab?.title || 'Region' });
      return { ok: true };
    }
    case 'REGION_CANCEL':
      return { ok: true };
    case 'STORE_IMAGE':
      await chrome.storage.session.set({
        [IMAGE_KEY]: {
          dataUrl: message.dataUrl,
          meta: message.meta || {},
          ts: Date.now()
        }
      });
      return { ok: true };
    case 'GET_IMAGE': {
      const data = await chrome.storage.session.get(IMAGE_KEY);
      return { ok: true, payload: data[IMAGE_KEY] || null };
    }
    case 'CLEAR_IMAGE':
      await chrome.storage.session.remove(IMAGE_KEY);
      return { ok: true };
    case 'DOWNLOAD':
      return downloadUrl(message.url, message.filename);
    case 'EXPORT_PDF':
      return exportWebToPdf(message.options);
    case 'OPEN_RECORDER':
      return openRecorder();
    case 'SHOW_LAUNCHER':
      return showPageLauncher();
    case 'GET_ACTIVE_TAB': {
      const tab = await getActiveTab();
      return { ok: true, tab: tab ? { id: tab.id, url: tab.url, title: tab.title } : null };
    }
    default:
      return { ok: false, error: 'Unknown message: ' + message.type };
  }
}

async function showPageLauncher() {
  const tab = await getActiveTab();
  if (!tab?.id) throw new Error('No active tab');
  if (isRestrictedUrl(tab.url)) {
    throw new Error('Open a normal webpage first, then click Flexshot.');
  }
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['src/content/launcher.js']
  });
  return { ok: true };
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function isRestrictedUrl(url = '') {
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('devtools://') ||
    url.startsWith('https://chrome.google.com/webstore') ||
    url.startsWith('https://chromewebstore.google.com')
  );
}

async function captureVisible() {
  const tab = await getActiveTab();
  if (!tab?.id) throw new Error('No active tab');
  if (isRestrictedUrl(tab.url)) {
    throw new Error('Cannot capture this page. Try a normal website.');
  }
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  await openEditor(dataUrl, { title: tab.title || 'Screenshot', mode: 'visible' });
  return { ok: true };
}

async function startRegionCapture() {
  const tab = await getActiveTab();
  if (!tab?.id) throw new Error('No active tab');
  if (isRestrictedUrl(tab.url)) {
    throw new Error('Cannot capture this page. Try a normal website.');
  }
  await chrome.scripting.insertCSS({
    target: { tabId: tab.id },
    files: ['src/content/content.css']
  }).catch(() => {});
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['src/content/region-select.js']
  });
  return { ok: true };
}

async function cropFromVisible(rect, tab) {
  const t = tab || (await getActiveTab());
  const dataUrl = await chrome.tabs.captureVisibleTab(t.windowId, { format: 'png' });
  const dpr = rect.devicePixelRatio || 1;
  const sx = Math.round(rect.x * dpr);
  const sy = Math.round(rect.y * dpr);
  const sw = Math.round(rect.w * dpr);
  const sh = Math.round(rect.h * dpr);

  // Crop via offscreen document canvas
  await ensureOffscreen();
  const result = await chrome.runtime.sendMessage({
    type: 'OFFSCREEN_CROP',
    dataUrl,
    sx,
    sy,
    sw,
    sh
  });
  if (!result?.ok) throw new Error(result?.error || 'Crop failed');
  return result.dataUrl;
}

async function captureFullPage() {
  const tab = await getActiveTab();
  if (!tab?.id) throw new Error('No active tab');
  if (isRestrictedUrl(tab.url)) {
    throw new Error('Cannot capture this page. Try a normal website.');
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['src/content/fullpage-capture.js']
  });

  const pageInfo = await chrome.tabs.sendMessage(tab.id, { type: 'FULLPAGE_PREPARE' });
  if (!pageInfo?.ok) throw new Error(pageInfo?.error || 'Full page prepare failed');

  const { totalWidth, totalHeight, viewportHeight, dpr } = pageInfo;
  const slices = await collectPageSlices(tab, pageInfo);

  await ensureOffscreen();
  const stitched = await chrome.runtime.sendMessage({
    type: 'OFFSCREEN_STITCH',
    slices,
    width: Math.round(totalWidth * dpr),
    height: Math.round(totalHeight * dpr),
    viewportHeight: Math.round(viewportHeight * dpr)
  });
  if (!stitched?.ok) throw new Error(stitched?.error || 'Stitch failed');
  await openEditor(stitched.dataUrl, { title: tab.title || 'Full page', mode: 'fullpage' });
  return { ok: true };
}

async function collectPageSlices(tab, pageInfo) {
  const { totalHeight, viewportHeight, dpr } = pageInfo;
  const slices = [];
  let y = 0;
  let index = 0;

  while (y < totalHeight) {
    const remaining = totalHeight - y;
    const scrollY = remaining < viewportHeight
      ? Math.max(0, totalHeight - viewportHeight)
      : y;
    await chrome.tabs.sendMessage(tab.id, { type: 'FULLPAGE_SCROLL', y: scrollY });
    await delay(200);
    const shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    const drawH = Math.round(Math.min(viewportHeight, remaining) * dpr);
    const srcOffset = remaining < viewportHeight
      ? Math.round((viewportHeight - remaining) * dpr)
      : 0;
    slices.push({
      dataUrl: shot,
      y: Math.round(y * dpr),
      height: drawH,
      srcOffset
    });
    y += viewportHeight;
    index += 1;
    if (index > 80) break;
  }

  await chrome.tabs.sendMessage(tab.id, { type: 'FULLPAGE_RESTORE' }).catch(() => {});
  return slices;
}

async function openEditor(dataUrl, meta = {}) {
  await chrome.storage.session.set({
    [IMAGE_KEY]: { dataUrl, meta, ts: Date.now() }
  });
  await chrome.tabs.create({
    url: chrome.runtime.getURL('src/editor/editor.html')
  });
}

async function openRecorder() {
  await chrome.tabs.create({
    url: chrome.runtime.getURL('src/record/recorder.html')
  });
  return { ok: true };
}

async function downloadUrl(url, filename) {
  const id = await chrome.downloads.download({
    url,
    filename: filename || 'flexshot-download',
    saveAs: true
  });
  return { ok: true, id };
}

async function exportWebToPdf(options = {}) {
  const tab = await getActiveTab();
  if (!tab?.id) throw new Error('No active tab');
  if (isRestrictedUrl(tab.url)) {
    throw new Error('Cannot export this page. Try a normal website.');
  }

  // Capture full page then convert to multi-page PDF via offscreen
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['src/content/fullpage-capture.js']
  });

  const pageInfo = await chrome.tabs.sendMessage(tab.id, { type: 'FULLPAGE_PREPARE' });
  if (!pageInfo?.ok) throw new Error(pageInfo?.error || 'Prepare failed');

  const { totalWidth, totalHeight, viewportHeight, dpr } = pageInfo;
  const slices = await collectPageSlices(tab, pageInfo);

  await ensureOffscreen();
  const pdf = await chrome.runtime.sendMessage({
    type: 'OFFSCREEN_PDF',
    slices,
    width: Math.round(totalWidth * dpr),
    height: Math.round(totalHeight * dpr),
    viewportHeight: Math.round(viewportHeight * dpr),
    title: options.title || tab.title || 'page'
  });
  if (!pdf?.ok) throw new Error(pdf?.error || 'PDF failed');
  const filename = sanitizeFilename(options.filename || tab.title || 'flexshot') + '.pdf';
  await downloadUrl(pdf.dataUrl, filename);
  return { ok: true };
}

function sanitizeFilename(name) {
  return String(name).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 80) || 'flexshot';
}

async function ensureOffscreen() {
  const existed = await chrome.offscreen.hasDocument?.();
  if (existed) return;
  try {
    await chrome.offscreen.createDocument({
      url: 'src/offscreen/offscreen.html',
      reasons: ['BLOBS', 'DOM_SCRAPING'],
      justification: 'Canvas crop, stitch screenshots, and build PDF blobs'
    });
    await delay(50);
  } catch (e) {
    // Already exists race
    if (!String(e.message || e).includes('Already')) throw e;
  }
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
