const iconWrap = document.getElementById('icon-wrap');
const card     = document.getElementById('card');
const quitBtn  = document.getElementById('btn-quit');

let expanded = false;

function updateDisplay(stats) {
  document.getElementById('score').textContent   = stats.score;
  document.getElementById('score-bar').style.width = stats.score + '%';
  document.getElementById('starts').textContent  = stats.starts;
  document.getElementById('minutes').textContent = stats.minutes;
  document.getElementById('speed').textContent   = stats.speed !== null ? stats.speed : '—';
  document.getElementById('bails').textContent   = stats.bails;
}

async function loadStats() {
  const stats = await window.statusApi.getStats();
  updateDisplay(stats);
}

// Live updates pushed from main when a sprint/block completes
window.statusApi.onStatsUpdate((stats) => {
  if (expanded) updateDisplay(stats);
});

function expand() {
  expanded = true;
  card.style.display = 'block';
  window.statusApi.setClickThrough(false);
  loadStats();
}

function collapse() {
  expanded = false;
  card.style.display = 'none';
  // Transparent areas pass clicks through when collapsed
  window.statusApi.setClickThrough(true);
}

// Drag + click detection on icon
let dragStartX = 0, dragStartY = 0, dragging = false, didDrag = false;
let clickThrough = true; // current state

function setClickThrough(on) {
  if (clickThrough === on) return;
  clickThrough = on;
  window.statusApi.setClickThrough(on);
}

iconWrap.addEventListener('mousedown', (e) => {
  dragging = true;
  didDrag = false;
  dragStartX = e.screenX;
  dragStartY = e.screenY;
  setClickThrough(false); // keep receiving events during drag
  e.preventDefault();
});

window.addEventListener('mousemove', (e) => {
  if (dragging) {
    const dx = e.screenX - dragStartX;
    const dy = e.screenY - dragStartY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag = true;
    if (didDrag) {
      window.statusApi.moveBy(dx, dy);
      dragStartX = e.screenX;
      dragStartY = e.screenY;
    }
    return;
  }

  if (expanded) return;

  // Toggle click-through based on whether cursor is over the icon
  const rect = iconWrap.getBoundingClientRect();
  const over = e.clientX >= rect.left && e.clientX <= rect.right &&
               e.clientY >= rect.top  && e.clientY <= rect.bottom;
  setClickThrough(!over);
});

window.addEventListener('mouseup', () => {
  if (dragging && !didDrag) {
    if (expanded) collapse();
    else expand();
  }
  dragging = false;
  // Restore correct click-through state after drag ends
  if (!expanded) setClickThrough(true);
});

// Click outside card collapses it
document.addEventListener('click', (e) => {
  if (expanded && !card.contains(e.target) && !iconWrap.contains(e.target)) {
    collapse();
  }
});

quitBtn.addEventListener('click', () => {
  window.statusApi.quitApp();
});

// --- Block list ---
let blockList = [];
let blocksOpen = false;
const sectionHeader = document.getElementById('section-header');
const blocksSection = document.getElementById('blocks-section');
const blockListEl   = document.getElementById('block-list-el');
const blockAddInput = document.getElementById('block-add-input');
const btnAddDomain  = document.getElementById('btn-add-domain');
const sectionArrow  = document.getElementById('section-arrow');
const blockCount    = document.getElementById('block-count');

async function loadBlockList() {
  blockList = await window.statusApi.getBlockList();
  renderBlockList();
}

function renderBlockList() {
  blockCount.textContent = `(${blockList.length})`;
  blockListEl.innerHTML = '';
  blockList.forEach((domain) => {
    const item = document.createElement('div');
    item.className = 'block-item';
    item.innerHTML = `<span class="block-domain">${domain}</span><button class="btn-remove" data-d="${domain}">×</button>`;
    item.querySelector('.btn-remove').addEventListener('click', () => removeDomain(domain));
    blockListEl.appendChild(item);
  });
}

function removeDomain(domain) {
  blockList = blockList.filter((d) => d !== domain);
  window.statusApi.saveBlockList(blockList);
  renderBlockList();
}

function addDomain() {
  const raw = blockAddInput.value.trim().toLowerCase()
    .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  if (!raw || blockList.includes(raw)) { blockAddInput.value = ''; return; }
  blockList = [...blockList, raw];
  window.statusApi.saveBlockList(blockList);
  blockAddInput.value = '';
  renderBlockList();
}

sectionHeader.addEventListener('click', () => {
  blocksOpen = !blocksOpen;
  blocksSection.style.display = blocksOpen ? 'flex' : 'none';
  sectionArrow.textContent = blocksOpen ? '˅' : '›';
  if (blocksOpen) loadBlockList();
});

btnAddDomain.addEventListener('click', addDomain);
blockAddInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addDomain(); });

function setBlockListLocked(locked) {
  const label = document.getElementById('block-list-lock');
  blockAddInput.disabled = locked;
  btnAddDomain.disabled = locked;
  blockAddInput.placeholder = locked ? 'unlock after session ends' : 'e.g. twitch.tv';
  if (label) label.style.display = locked ? 'block' : 'none';
  document.querySelectorAll('.btn-remove').forEach((b) => { b.style.pointerEvents = locked ? 'none' : ''; b.style.opacity = locked ? '0.3' : ''; });
}

window.statusApi.onSessionState((active) => setBlockListLocked(active));

window.statusApi.onBlockListUpdated((list) => {
  blockList = list;
  if (blocksOpen) renderBlockList();
});

