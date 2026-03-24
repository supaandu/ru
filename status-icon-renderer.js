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
  // Full window is interactive when expanded
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
