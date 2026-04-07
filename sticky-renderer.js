const tab         = document.getElementById('tab');
const card        = document.getElementById('card');
const tabLabel    = document.getElementById('tab-label');
const tabCount    = document.getElementById('tab-count');
const taskList    = document.getElementById('task-list');
const addInput    = document.getElementById('add-input');
const btnAdd      = document.getElementById('btn-add');
const btnCollapse = document.getElementById('btn-collapse');
const dragHandle  = document.getElementById('drag-handle');

const COLLAPSED_W = 230;
const COLLAPSED_H = 52;
const EXPANDED_W  = 260;
const EXPANDED_H  = 480;

let tasks    = [];
let expanded = false;

// ── Render ────────────────────────────────────────────────
function render() {
  const remaining = tasks.filter((t) => !t.done).length;
  tabCount.textContent = remaining;
  const first = tasks.find((t) => !t.done);
  tabLabel.textContent = first ? first.text : tasks.length ? 'all done ✓' : 'Tasks';

  taskList.innerHTML = '';
  if (tasks.length === 0) {
    taskList.innerHTML = '<div class="empty-state">no tasks yet</div>';
  } else {
    tasks.forEach((task) => {
      const item = document.createElement('div');
      item.className = 'task-item' + (task.done ? ' done' : '');
      item.dataset.id = task.id;
      item.innerHTML = `
        <span class="drag-handle" title="drag to reorder">⠿</span>
        <div class="task-check"><span class="task-check-inner">✓</span></div>
        <span class="task-text">${escHtml(task.text)}</span>
        <button class="btn-del" title="delete">×</button>
      `;
      item.querySelector('.task-check').addEventListener('click', (e) => { e.stopPropagation(); toggleDone(task.id); });
      item.querySelector('.task-text').addEventListener('click', () => toggleDone(task.id));
      item.querySelector('.btn-del').addEventListener('click', (e) => { e.stopPropagation(); deleteTask(task.id); });
      initItemDrag(item, task.id);
      taskList.appendChild(item);
    });
  }
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Task ops ──────────────────────────────────────────────
function addTask() {
  const text = addInput.value.trim();
  if (!text) return;
  tasks.push({ id: Date.now(), text, done: false });
  addInput.value = '';
  save();
  render();
}

function toggleDone(id) {
  tasks = tasks.map((t) => t.id === id ? { ...t, done: !t.done } : t);
  save();
  render();
}

function deleteTask(id) {
  tasks = tasks.filter((t) => t.id !== id);
  save();
  render();
}

function save() {
  window.stickyApi.saveTasks(tasks);
}

// ── Task drag-to-reorder ──────────────────────────────────
let dragId      = null;
let dragEl      = null;
let overEl      = null;
let overPos     = null; // 'above' | 'below'

function initItemDrag(item, id) {
  const handle = item.querySelector('.drag-handle');
  handle.addEventListener('mousedown', (e) => {
    e.stopPropagation(); // don't trigger window drag
    e.preventDefault();
    dragId = id;
    dragEl = item;
    item.classList.add('dragging-item');
    document.addEventListener('mousemove', onItemDragMove);
    document.addEventListener('mouseup', onItemDragUp);
  });
}

function onItemDragMove(e) {
  if (!dragEl) return;
  // Find which task item the cursor is over
  const items = [...taskList.querySelectorAll('.task-item:not(.dragging-item)')];
  let found = null;
  let pos = null;
  for (const el of items) {
    const rect = el.getBoundingClientRect();
    if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
      pos = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
      found = el;
      break;
    }
  }
  // Clear previous indicator
  if (overEl && (overEl !== found || overPos !== pos)) {
    overEl.classList.remove('drag-over-above', 'drag-over-below');
  }
  overEl  = found;
  overPos = pos;
  if (found) found.classList.add(`drag-over-${pos}`);
}

function onItemDragUp() {
  document.removeEventListener('mousemove', onItemDragMove);
  document.removeEventListener('mouseup', onItemDragUp);
  if (dragEl) dragEl.classList.remove('dragging-item');
  if (overEl) overEl.classList.remove('drag-over-above', 'drag-over-below');

  if (overEl && dragId != null) {
    const fromIdx = tasks.findIndex((t) => t.id === dragId);
    const toId    = parseInt(overEl.dataset.id);
    let   toIdx   = tasks.findIndex((t) => t.id === toId);
    if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
      const [moved] = tasks.splice(fromIdx, 1);
      // Recalculate index after splice
      toIdx = tasks.findIndex((t) => t.id === toId);
      const insertAt = overPos === 'above' ? toIdx : toIdx + 1;
      tasks.splice(insertAt, 0, moved);
      save();
      render();
    }
  }

  dragId  = null;
  dragEl  = null;
  overEl  = null;
  overPos = null;
}

// ── Expand / collapse ─────────────────────────────────────
function expand() {
  expanded = true;
  tab.style.display  = 'none';
  card.style.display = 'flex';
  window.stickyApi.resize(EXPANDED_W, EXPANDED_H);
}

function collapse() {
  expanded = false;
  card.style.display = 'none';
  tab.style.display  = 'flex';
  window.stickyApi.resize(COLLAPSED_W, COLLAPSED_H);
}

btnCollapse.addEventListener('click', (e) => {
  e.stopPropagation();
  collapse();
});

document.addEventListener('click', (e) => {
  if (expanded && !card.contains(e.target)) collapse();
});

// ── Drag + click ──────────────────────────────────────────
let dragging   = false;
let didDrag    = false;
let dragStartX = 0;
let dragStartY = 0;

function onDragStart(e) {
  dragging   = true;
  didDrag    = false;
  dragStartX = e.screenX;
  dragStartY = e.screenY;
  e.preventDefault();
}

// Tab handles drag OR click-to-expand
tab.addEventListener('mousedown', onDragStart);
tab.addEventListener('click', (e) => e.stopPropagation());
// Card header handles drag only
dragHandle.addEventListener('mousedown', onDragStart);

window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const dx = e.screenX - dragStartX;
  const dy = e.screenY - dragStartY;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag = true;
  if (didDrag) {
    window.stickyApi.moveBy(dx, dy);
    dragStartX = e.screenX;
    dragStartY = e.screenY;
  }
});

window.addEventListener('mouseup', () => {
  if (!dragging) return;
  const wasDrag = didDrag;
  dragging = false;
  didDrag  = false;
  // Only expand if it was a tap on the tab (not a drag, not the card header)
  if (!wasDrag && !expanded) expand();
});

// ── Add task ──────────────────────────────────────────────
btnAdd.addEventListener('click', addTask);
addInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTask(); });

// ── Init ──────────────────────────────────────────────────
window.stickyApi.getTasks().then((saved) => {
  tasks = saved || [];
  render();
});
