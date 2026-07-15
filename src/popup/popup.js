/* Flexshot popup — tabbed Capture / Record / More (Awesome Screenshot-style) */

(function () {
  const statusEl = document.getElementById('status');
  const tabs = [...document.querySelectorAll('.tab')];
  const panels = {
    capture: document.getElementById('panel-capture'),
    record: document.getElementById('panel-record'),
    more: document.getElementById('panel-more')
  };
  const buttons = [...document.querySelectorAll('[data-cmd]')];
  const pageBarBtn = document.getElementById('btnPageBar');

  const TAB_KEY = 'flexshot_last_tab';

  function setStatus(text, isError) {
    statusEl.hidden = !text;
    statusEl.textContent = text || '';
    statusEl.classList.toggle('error', !!isError);
  }

  function setBusy(busy) {
    buttons.forEach((b) => {
      b.disabled = busy;
    });
    if (pageBarBtn) pageBarBtn.disabled = busy;
  }

  function showTab(name) {
    tabs.forEach((t) => {
      const on = t.dataset.tab === name;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    Object.keys(panels).forEach((key) => {
      const panel = panels[key];
      const on = key === name;
      panel.classList.toggle('active', on);
      panel.hidden = !on;
    });
    try {
      chrome.storage.local.set({ [TAB_KEY]: name });
    } catch (_) {}
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => showTab(tab.dataset.tab));
  });

  chrome.storage.local.get(TAB_KEY, (data) => {
    if (data && data[TAB_KEY] && panels[data[TAB_KEY]]) {
      showTab(data[TAB_KEY]);
    }
  });

  async function run(type) {
    setBusy(true);
    const labels = {
      CAPTURE_REGION: 'Open the page and drag to select…',
      CAPTURE_VISIBLE: 'Capturing visible area…',
      CAPTURE_FULLPAGE: 'Capturing full page…',
      OPEN_RECORDER: 'Opening recorder…',
      EXPORT_PDF: 'Building PDF…',
      SHOW_LAUNCHER: 'Opening capture bar on page…'
    };
    setStatus(labels[type] || 'Working…');

    try {
      const res = await chrome.runtime.sendMessage({ type });
      if (!res || res.ok === false) {
        throw new Error((res && res.error) || 'Action failed');
      }

      if (type === 'CAPTURE_REGION' || type === 'SHOW_LAUNCHER') {
        setStatus(type === 'SHOW_LAUNCHER' ? 'Capture bar is on the page' : 'Drag on the page to select');
        setTimeout(() => window.close(), 180);
        return;
      }
      if (type === 'EXPORT_PDF') {
        setStatus('PDF download started');
        setBusy(false);
        return;
      }
      setStatus('Done');
      setTimeout(() => window.close(), 160);
    } catch (err) {
      setStatus(err.message || String(err), true);
      setBusy(false);
    }
  }

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => run(btn.dataset.cmd));
  });

  if (pageBarBtn) {
    pageBarBtn.addEventListener('click', () => run('SHOW_LAUNCHER'));
  }
})();
