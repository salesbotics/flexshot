/**
 * On-page capture bar — large, obvious buttons like Awesome Screenshot's launcher.
 */
(function () {
  const ROOT_ID = 'flexshot-launcher-root';
  if (document.getElementById(ROOT_ID)) {
    document.getElementById(ROOT_ID).style.display = 'flex';
    return;
  }

  const css = `
    #${ROOT_ID} {
      all: initial;
      position: fixed !important;
      top: 16px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      z-index: 2147483646 !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 8px !important;
      width: min(420px, calc(100vw - 24px)) !important;
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif !important;
      box-sizing: border-box !important;
    }
    #${ROOT_ID} * { box-sizing: border-box !important; font-family: inherit !important; }
    #${ROOT_ID} .fs-card {
      background: #fff !important;
      color: #15202b !important;
      border: 1px solid #d5dee8 !important;
      border-radius: 16px !important;
      box-shadow: 0 18px 50px rgba(15, 23, 32, 0.28) !important;
      overflow: hidden !important;
    }
    #${ROOT_ID} .fs-head {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      padding: 12px 14px !important;
      border-bottom: 1px solid #e7eef5 !important;
      background: #f7fafc !important;
    }
    #${ROOT_ID} .fs-brand {
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      font-weight: 700 !important;
      font-size: 15px !important;
      color: #15202b !important;
    }
    #${ROOT_ID} .fs-brand img {
      width: 22px !important;
      height: 22px !important;
      border-radius: 6px !important;
    }
    #${ROOT_ID} .fs-close {
      border: none !important;
      background: #eef2f6 !important;
      color: #405464 !important;
      width: 30px !important;
      height: 30px !important;
      border-radius: 8px !important;
      cursor: pointer !important;
      font-size: 18px !important;
      line-height: 1 !important;
    }
    #${ROOT_ID} .fs-tabs {
      display: grid !important;
      grid-template-columns: 1fr 1fr !important;
      gap: 6px !important;
      padding: 10px 10px 0 !important;
    }
    #${ROOT_ID} .fs-tab {
      border: 1px solid #d8e1ea !important;
      background: #fff !important;
      color: #5b6b79 !important;
      border-radius: 10px !important;
      padding: 10px !important;
      font-weight: 700 !important;
      font-size: 13px !important;
      cursor: pointer !important;
    }
    #${ROOT_ID} .fs-tab.active {
      background: #e6f8f5 !important;
      border-color: #00a897 !important;
      color: #00a897 !important;
    }
    #${ROOT_ID} .fs-body { padding: 10px !important; }
    #${ROOT_ID} .fs-btn {
      width: 100% !important;
      display: flex !important;
      align-items: center !important;
      gap: 12px !important;
      text-align: left !important;
      border: 1px solid #d8e1ea !important;
      background: #fff !important;
      border-radius: 12px !important;
      padding: 12px !important;
      margin-bottom: 8px !important;
      cursor: pointer !important;
      color: #15202b !important;
    }
    #${ROOT_ID} .fs-btn:hover {
      border-color: #00a897 !important;
      background: #f3fffc !important;
    }
    #${ROOT_ID} .fs-ico {
      width: 40px !important;
      height: 40px !important;
      border-radius: 10px !important;
      display: grid !important;
      place-items: center !important;
      font-size: 18px !important;
      flex: 0 0 auto !important;
    }
    #${ROOT_ID} .fs-ico.a { background: #eaf1ff !important; }
    #${ROOT_ID} .fs-ico.b { background: #e6f8f5 !important; }
    #${ROOT_ID} .fs-ico.c { background: #f0eeff !important; }
    #${ROOT_ID} .fs-ico.d { background: #ffe8eb !important; }
    #${ROOT_ID} .fs-ico.e { background: #fff4e5 !important; }
    #${ROOT_ID} .fs-btn strong {
      display: block !important;
      font-size: 14px !important;
      font-weight: 700 !important;
      margin-bottom: 2px !important;
      color: #15202b !important;
    }
    #${ROOT_ID} .fs-btn small {
      display: block !important;
      font-size: 12px !important;
      color: #5b6b79 !important;
    }
    #${ROOT_ID} .fs-pane { display: none !important; }
    #${ROOT_ID} .fs-pane.active { display: block !important; }
    #${ROOT_ID} .fs-hint {
      text-align: center !important;
      font-size: 11px !important;
      color: #7a8b99 !important;
      padding: 0 10px 10px !important;
    }
  `;

  const style = document.createElement('style');
  style.textContent = css;

  const root = document.createElement('div');
  root.id = ROOT_ID;
  const iconUrl = chrome.runtime.getURL('icons/icon48.png');

  root.innerHTML = `
    <div class="fs-card">
      <div class="fs-head">
        <div class="fs-brand">
          <img src="${iconUrl}" alt="" />
          Flexshot
        </div>
        <button type="button" class="fs-close" aria-label="Close">×</button>
      </div>
      <div class="fs-tabs">
        <button type="button" class="fs-tab active" data-pane="shot">Screenshot</button>
        <button type="button" class="fs-tab" data-pane="rec">Record</button>
      </div>
      <div class="fs-body">
        <div class="fs-pane active" data-pane="shot">
          <button type="button" class="fs-btn" data-cmd="CAPTURE_REGION">
            <span class="fs-ico a">⬚</span>
            <span><strong>Selected area</strong><small>Drag to capture a region</small></span>
          </button>
          <button type="button" class="fs-btn" data-cmd="CAPTURE_VISIBLE">
            <span class="fs-ico b">▣</span>
            <span><strong>Visible part</strong><small>Capture what you see</small></span>
          </button>
          <button type="button" class="fs-btn" data-cmd="CAPTURE_FULLPAGE">
            <span class="fs-ico c">📄</span>
            <span><strong>Full page</strong><small>Capture the whole page</small></span>
          </button>
          <button type="button" class="fs-btn" data-cmd="EXPORT_PDF">
            <span class="fs-ico e">⇩</span>
            <span><strong>Web → PDF</strong><small>Download page as PDF</small></span>
          </button>
        </div>
        <div class="fs-pane" data-pane="rec">
          <button type="button" class="fs-btn" data-cmd="OPEN_RECORDER">
            <span class="fs-ico d">●</span>
            <span><strong>Screen record</strong><small>Video + microphone / tab audio</small></span>
          </button>
        </div>
      </div>
      <div class="fs-hint">Then annotate with pen, text, arrows, blur &amp; crop</div>
    </div>
  `;

  document.documentElement.appendChild(style);
  document.documentElement.appendChild(root);

  function close() {
    root.remove();
    style.remove();
  }

  root.querySelector('.fs-close').addEventListener('click', close);

  root.querySelectorAll('.fs-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const pane = tab.dataset.pane;
      root.querySelectorAll('.fs-tab').forEach((t) => t.classList.toggle('active', t === tab));
      root.querySelectorAll('.fs-pane').forEach((p) => {
        p.classList.toggle('active', p.dataset.pane === pane);
      });
    });
  });

  root.querySelectorAll('[data-cmd]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const type = btn.dataset.cmd;
      btn.style.opacity = '0.6';
      try {
        const res = await chrome.runtime.sendMessage({ type });
        if (!res || res.ok === false) {
          alert((res && res.error) || 'Flexshot action failed');
          btn.style.opacity = '1';
          return;
        }
        close();
      } catch (err) {
        alert(err.message || String(err));
        btn.style.opacity = '1';
      }
    });
  });

  document.addEventListener(
    'keydown',
    function onKey(e) {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', onKey, true);
      }
    },
    true
  );
})();
