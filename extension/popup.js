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

// Check if app is connected
chrome.runtime.sendMessage({ type: 'get-state' }, (res) => {
  if (chrome.runtime.lastError || res === undefined) return;
  statusEl.textContent = 'RU app connected';
  statusEl.className = 'status connected';
});

function renderList() {
  listEl.innerHTML = '';
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
  if (area === 'sync' && changes.blockList) {
    blockList = changes.blockList.newValue;
    renderList();
  }
  if (area === 'sync' && changes.blockingEnabled !== undefined) {
    toggleEl.checked = changes.blockingEnabled.newValue;
    toggleLabel.textContent = changes.blockingEnabled.newValue ? 'on' : 'off';
  }
});
