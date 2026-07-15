/**
 * Full-page scroll helpers for stitch / PDF capture.
 */
(function () {
  if (window.__flexshotFullpageInstalled) return;
  window.__flexshotFullpageInstalled = true;

  let saved = null;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'FULLPAGE_PREPARE') {
      try {
        saved = {
          scrollX: window.scrollX,
          scrollY: window.scrollY,
          overflow: document.documentElement.style.overflow
        };
        document.documentElement.style.overflow = 'hidden';

        const totalWidth = Math.max(
          document.documentElement.scrollWidth,
          document.body?.scrollWidth || 0,
          document.documentElement.clientWidth
        );
        const totalHeight = Math.max(
          document.documentElement.scrollHeight,
          document.body?.scrollHeight || 0,
          document.documentElement.clientHeight
        );
        sendResponse({
          ok: true,
          totalWidth,
          totalHeight,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          dpr: window.devicePixelRatio || 1
        });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
      return true;
    }

    if (message.type === 'FULLPAGE_SCROLL') {
      window.scrollTo(0, message.y);
      sendResponse({ ok: true, y: window.scrollY });
      return true;
    }

    if (message.type === 'FULLPAGE_RESTORE') {
      if (saved) {
        document.documentElement.style.overflow = saved.overflow || '';
        window.scrollTo(saved.scrollX, saved.scrollY);
        saved = null;
      }
      sendResponse({ ok: true });
      return true;
    }
  });
})();
