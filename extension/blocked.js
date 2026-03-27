const params  = new URLSearchParams(location.search);
const siteUrl = params.get('site') || '';
const mode    = params.get('mode') || 'soft';

// Show site hostname
try {
  document.getElementById('site-name').textContent = new URL(siteUrl).hostname;
} catch {}

if (mode === 'hard') {
  document.getElementById('soft-content').style.display = 'none';
  document.getElementById('hard-content').style.display = 'flex';
} else {
  // Soft mode
  const input    = document.getElementById('first-step');
  const btnStart = document.getElementById('btn-start');
  const btnBypass = document.getElementById('btn-bypass');

  input.focus();

  input.addEventListener('input', () => {
    btnStart.disabled = input.value.trim().length === 0;
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) launchRU();
  });

  btnStart.addEventListener('click', launchRU);

  btnBypass.addEventListener('click', () => {
    if (siteUrl) location.href = siteUrl;
  });

  function launchRU() {
    const firstStep = input.value.trim();
    if (!firstStep) return;
    chrome.runtime.sendMessage({ type: 'get-state' }, (res) => {
      if (!res || !res.wsConnected) {
        btnStart.textContent = 'Open the RU app first';
        btnStart.disabled = false;
        setTimeout(() => {
          btnStart.textContent = 'Start session';
          btnStart.disabled = input.value.trim().length === 0;
        }, 2500);
        return;
      }
      btnStart.disabled = true;
      btnStart.textContent = 'Launching...';
      chrome.runtime.sendMessage({ type: 'launch-ru', firstStep }, () => {
        window.close();
      });
    });
  }
}
