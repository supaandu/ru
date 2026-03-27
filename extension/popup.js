const listEl       = document.getElementById('block-list');
const addInput     = document.getElementById('add-input');
const btnAdd       = document.getElementById('btn-add');
const toggleEl     = document.getElementById('toggle-enabled');
const toggleLabel  = document.getElementById('toggle-label');
const statusEl     = document.getElementById('status');

let blockList = [];

// Load state
chrome.runtime.sendMessage({ type: 'get-block-list' }, (res) => {
  blockList = res.blockList;
  toggleEl.checked = res.blockingEnabled;
  toggleLabel.textContent = res.blockingEnabled ? 'on' : 'off';
  renderList();
});

function setLocked(locked) {
  addInput.disabled = locked;
  btnAdd.disabled = locked;
  toggleEl.disabled = locked;
  addInput.placeholder = locked ? 'unlock after session ends' : 'add domain (e.g. twitch.tv)';
  document.querySelectorAll('.btn-remove').forEach((b) => { b.style.pointerEvents = locked ? 'none' : ''; b.style.opacity = locked ? '0.3' : ''; });
}

chrome.storage.local.get('sessionActive', (r) => setLocked(!!r.sessionActive));

// Check if app is connected (live via storage)
function updateStatus(connected) {
  if (connected) {
    statusEl.textContent = 'RU app connected';
    statusEl.className = 'status connected';
  } else {
    statusEl.textContent = 'RU app not detected';
    statusEl.className = 'status';
  }
}

chrome.storage.local.get('wsConnected', (r) => updateStatus(!!r.wsConnected));

function renderList() {
  listEl.innerHTML = '';
  chrome.storage.local.get('sessionActive', (r) => { if (r.sessionActive) setLocked(true); });
  blockList.forEach((domain) => {
    const item = document.createElement('div');
    item.className = 'block-item';
    item.innerHTML = `
      <span class="block-domain">${domain}</span>
      <button class="btn-remove" data-domain="${domain}">×</button>
    `;
    item.querySelector('.btn-remove').addEventListener('click', () => removeDomain(domain));
    listEl.appendChild(item);
  });
}

function saveDomain() {
  const domain = addInput.value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  if (!domain || blockList.includes(domain)) { addInput.value = ''; return; }
  blockList = [...blockList, domain];
  chrome.runtime.sendMessage({ type: 'save-block-list', blockList });
  addInput.value = '';
  renderList();
}

function removeDomain(domain) {
  blockList = blockList.filter((d) => d !== domain);
  chrome.runtime.sendMessage({ type: 'save-block-list', blockList });
  renderList();
}

btnAdd.addEventListener('click', saveDomain);
addInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveDomain(); });

toggleEl.addEventListener('change', () => {
  const enabled = toggleEl.checked;
  toggleLabel.textContent = enabled ? 'on' : 'off';
  chrome.runtime.sendMessage({ type: 'set-blocking-enabled', enabled });
});

// Live-update popup when storage changes (e.g. Electron app updates block list)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.blockList) {
    blockList = changes.blockList.newValue;
    renderList();
  }
  if (area === 'local' && changes.blockingEnabled !== undefined) {
    toggleEl.checked = changes.blockingEnabled.newValue;
    toggleLabel.textContent = changes.blockingEnabled.newValue ? 'on' : 'off';
  }
  if (area === 'local' && changes.wsConnected !== undefined) {
    updateStatus(changes.wsConnected.newValue);
  }
  if (area === 'local' && changes.sessionActive !== undefined) {
    setLocked(changes.sessionActive.newValue);
  }
});
