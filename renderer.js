const container     = document.getElementById('main-container');
const attentionText = document.getElementById('attention-text');
const distractingNote = document.getElementById('distracting-note');
const postHeading   = document.getElementById('post-heading');
const betweenDump   = document.getElementById('between-dump');
const btnStartedYes = document.getElementById('btn-started-yes');
const btnStartedNo  = document.getElementById('btn-started-no');
const btnYes        = document.getElementById('btn-yes');
const btnNo         = document.getElementById('btn-no');
const postTaskCheck  = document.getElementById('post-task-check');
const postResistance = document.getElementById('post-resistance');
const postRetry      = document.getElementById('post-retry');
const widgetTask     = document.getElementById('widget-task');
const welcomeNudge   = document.getElementById('welcome-nudge');

const NUDGES = [
  'RU overwhelmed? Start small.',
  'RU feeling resistance? Start anyway.',
  'RU stuck? You already started.',
  'RU distracted? Just 90 seconds.',
  'RU tired? Small step.'
];

let reminderTimeout = null;

const screens = {
  welcome:  document.getElementById('screen-welcome'),
  sprint:   document.getElementById('screen-sprint'),
  post:     document.getElementById('screen-post'),
  momentum: document.getElementById('screen-momentum'),
  between:  document.getElementById('screen-between'),
  custom:   document.getElementById('screen-custom'),
  review:   document.getElementById('screen-review'),
};

let timerInterval    = null;
let hideTimeout      = null;
let fadeLocked       = false;
let inWidgetMode     = false;
let session          = {};
let currentBlockDuration = null;
let activeTimerTotal    = 0;
let activeTimerElapsed  = 0;
let reminderCooldown    = false;

// --- Screen transitions ---
function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// --- Timer ---
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function updateTimerDisplays(seconds) {
  const formatted = formatTime(seconds);
  document.querySelectorAll('.timer-display').forEach((el) => {
    el.textContent = formatted;
  });
}

function startTimer(seconds, onComplete) {
  let remaining = seconds;
  activeTimerTotal   = seconds;
  activeTimerElapsed = 0;
  updateTimerDisplays(remaining);
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    remaining--;
    activeTimerElapsed = seconds - remaining;
    updateTimerDisplays(remaining);
    if (remaining <= 10) {
      fadeLocked = true;
      showWidget();
    }
    if (remaining <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      fadeLocked = false;
      onComplete();
    }
  }, 1000);
}

// --- Auto-fade widget ---
function scheduleHide() {
  clearTimeout(hideTimeout);
  if (fadeLocked) return;
  hideTimeout = setTimeout(() => {
    container.style.opacity = '0.1';
  }, 3000);
}

function showWidget() {
  clearTimeout(hideTimeout);
  container.style.opacity = '1';
  if (!fadeLocked) scheduleHide();
}

window.api.onCursorProximity((near) => {
  if (near) showWidget();
});

// --- Widget helpers ---

// Initial start: timer already running, just transition to widget UI
function enterWidgetMode() {
  session.attentionText = attentionText.value.trim();
  session.firstStepMs = Date.now() - new Date(session.timestamp).getTime();
  widgetTask.textContent = session.attentionText;
  showScreen('sprint');
  inWidgetMode = true;
  document.body.classList.add('widget');
  container.style.transition = 'none';
  container.style.opacity = '0';
  window.api.hideStatusIcon();
  window.api.startSession();
  window.api.setWidgetMode().then(() => {
    container.style.transition = '';
    showWidget();
  });
}

function exitWidgetMode() {
  clearTimeout(hideTimeout);
  container.style.opacity = '1';
  document.body.classList.remove('widget');
  window.api.setNormalMode();
  window.api.showStatusIcon();
  inWidgetMode = false;
}

// Retries/subsequent blocks: restart timer + enter widget
function enterWidget(screenName, seconds, onDone) {
  showScreen(screenName);
  inWidgetMode = true;
  document.body.classList.add('widget');
  container.style.transition = 'none';
  container.style.opacity = '0';
  window.api.hideStatusIcon();
  window.api.setWidgetMode().then(() => {
    container.style.transition = '';
    showWidget();
  });
  startTimer(seconds, () => {
    exitWidgetMode();
    onDone();
  });
}

// --- Tap button helpers ---
function selectedTap(rowId) {
  const active = document.querySelector(`#${rowId} .tap-btn.active`);
  return active ? parseInt(active.dataset.val) : null;
}

function selectedFriction() {
  const active = document.querySelector('.friction-btn.active');
  return active ? active.dataset.val : null;
}

function initTapRow(rowId) {
  const btns = document.querySelectorAll(`#${rowId} .tap-btn`);
  btns.forEach((btn) => {
    btn.addEventListener('click', () => {
      btns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

function clearTapRow(rowId) {
  document.querySelectorAll(`#${rowId} .tap-btn`).forEach((b) => b.classList.remove('active'));
}

const TAP_ROWS = ['tap-resist-before', 'tap-between-focus', 'tap-focus-quality', 'tap-clarity'];
TAP_ROWS.forEach(initTapRow);

document.querySelectorAll('.friction-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.friction-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// --- Commit current block ---
function commitBlock(isFirstSprint = false) {
  session.blocks.push({
    durationMin: currentBlockDuration,
    focusRating: selectedTap('tap-between-focus'),
    thoughts: betweenDump.value.trim() || null,
  });
  window.api.addStats({
    minutes: currentBlockDuration || 0,
    firstStepMs: isFirstSprint ? (session.firstStepMs || null) : null,
  });
  currentBlockDuration = null;
  clearTapRow('tap-between-focus');
  betweenDump.value = '';
}

// --- Session reset ---
function resetSession() {
  clearInterval(timerInterval);
  clearTimeout(hideTimeout);
  clearTimeout(reminderTimeout);
  timerInterval        = null;
  hideTimeout          = null;
  fadeLocked           = false;
  inWidgetMode         = false;
  activeTimerTotal     = 0;
  activeTimerElapsed   = 0;
  reminderCooldown     = false;
  container.style.opacity    = '1';
  container.style.transition = '';
  document.body.classList.remove('widget');
  currentBlockDuration = null;
  widgetTask.textContent = '';
  session = {
    timestamp: new Date().toISOString(),
    started: true,
    completed: false,
    attentionText: '',
    firstStepMs: null,
    startedTask: null,
    resistanceBefore: null,
    frictionReason: null,
    blocks: [],
    review: { ruHelped: null, focusQuality: null, mentalClarity: null, distractingNote: '' },
  };
  attentionText.value   = '';
  distractingNote.value = '';
  betweenDump.value     = '';
  TAP_ROWS.forEach(clearTapRow);
  document.querySelectorAll('.friction-btn').forEach((b) => b.classList.remove('active'));
  btnStartedYes.classList.remove('active');
  btnStartedNo.classList.remove('active');
  btnYes.classList.remove('active');
  btnNo.classList.remove('active');
  postTaskCheck.style.display  = '';
  postResistance.style.display = 'none';
  postRetry.style.display      = 'none';
  welcomeNudge.textContent = NUDGES[Math.floor(Math.random() * NUDGES.length)];
  showScreen('welcome');
  setTimeout(() => attentionText.focus(), 100);

  // Timer starts immediately — sprint begins on R+U press
  currentBlockDuration = 1.5;
  startTimer(90, () => {
    session.sessionDate = new Date().toDateString();
    commitBlock(true);
    session.completed = true;
    if (inWidgetMode) exitWidgetMode();
    if (session.attentionText) {
      postHeading.textContent = `RU able to start "${session.attentionText}"?`;
      showPostTaskCheck();
    } else {
      showPostResistance();
    }
    showScreen('post');
  });
}

// --- Post-sprint sub-section helpers ---
function showPostTaskCheck() {
  postTaskCheck.style.display  = '';
  postResistance.style.display = 'none';
  postRetry.style.display      = 'none';
}

function showPostResistance() {
  postTaskCheck.style.display  = 'none';
  postResistance.style.display = '';
  postRetry.style.display      = 'none';
}

function showPostRetry() {
  postTaskCheck.style.display  = 'none';
  postResistance.style.display = 'none';
  postRetry.style.display      = '';
}

// --- Button handlers ---

// Command prompt: Enter to start
attentionText.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    enterWidgetMode();
  }
});

document.getElementById('btn-not-now').addEventListener('click', () => {
  window.api.addStats({ bails: 1 });
  window.api.saveSession(session);
  window.api.closeOverlay();
});

btnStartedYes.addEventListener('click', () => {
  session.startedTask = true;
  btnStartedYes.classList.add('active');
  btnStartedNo.classList.remove('active');
  showPostResistance();
});

btnStartedNo.addEventListener('click', () => {
  session.startedTask = false;
  btnStartedNo.classList.add('active');
  btnStartedYes.classList.remove('active');
  showPostRetry();
});

document.getElementById('btn-retry-90').addEventListener('click', () => {
  session.frictionReason = selectedFriction();
  currentBlockDuration = 1.5;
  enterWidget('sprint', 90, () => {
    commitBlock();
    showPostResistance();
    showScreen('post');
  });
});

document.getElementById('btn-give-up').addEventListener('click', () => {
  window.api.saveSession(session);
  window.api.closeOverlay();
});

document.getElementById('btn-3min').addEventListener('click', () => {
  session.resistanceBefore = selectedTap('tap-resist-before');
  currentBlockDuration = 3;
  enterWidget('momentum', 180, () => {
    clearTapRow('tap-between-focus');
    showScreen('between');
  });
});

document.getElementById('btn-done-post').addEventListener('click', () => {
  session.resistanceBefore = selectedTap('tap-resist-before');
  showScreen('review');
});

document.querySelectorAll('.dur-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    commitBlock();
    currentBlockDuration = parseInt(btn.dataset.min);
    enterWidget('custom', currentBlockDuration * 60, () => {
      clearTapRow('tap-between-focus');
      showScreen('between');
    });
  });
});

document.getElementById('btn-end-session').addEventListener('click', () => {
  commitBlock();
  showScreen('review');
});

btnYes.addEventListener('click', () => {
  session.review.ruHelped = true;
  btnYes.classList.add('active');
  btnNo.classList.remove('active');
});

btnNo.addEventListener('click', () => {
  session.review.ruHelped = false;
  btnNo.classList.add('active');
  btnYes.classList.remove('active');
});

document.getElementById('btn-review-done').addEventListener('click', () => {
  session.review.focusQuality   = selectedTap('tap-focus-quality');
  session.review.mentalClarity  = selectedTap('tap-clarity');
  session.review.distractingNote = distractingNote.value.trim();
  window.api.addStats({ starts: 1 });
  window.api.saveSession(session);
  window.api.closeOverlay();
});

// --- RU reminder ---
window.api.onPreFillTask((text) => {
  if (text) {
    attentionText.value = text;
    attentionText.dispatchEvent(new Event('input'));
  }
});

window.api.onRuTriggered(() => {
  if (!timerInterval || reminderCooldown) return;
  const pct = activeTimerTotal > 0 ? (activeTimerElapsed / activeTimerTotal) * 100 : 0;
  window.api.showReminder(pct);
  reminderCooldown = true;
  setTimeout(() => { reminderCooldown = false; }, 45000);
});

window.api.onResetSession(() => resetSession());
resetSession();
