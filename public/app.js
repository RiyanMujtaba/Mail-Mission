// ── Demo data ──────────────────────────────────────────────────
const DEMO_EMAILS = [
  { id: 'demo_1', subject: 'Q2 Budget Approval Needed ASAP', from: 'Sarah Chen <sarah@company.com>', date: 'Tue, 1 Apr 2025 09:14:00', snippet: 'Hi, the finance team needs your sign-off on the Q2 budget by end of day Friday. Total is $142,000. Please review the attached sheet and confirm.', unread: true },
  { id: 'demo_2', subject: 'Re: Client Proposal — Westfield Group', from: 'James Okafor <james@westfield.com>', date: 'Tue, 1 Apr 2025 08:45:00', snippet: 'Thanks for sending that over. We reviewed the proposal and have a few questions. Can we hop on a call Thursday at 3pm? Let me know if that works.', unread: true },
  { id: 'demo_3', subject: 'Your invoice #4521 is overdue', from: 'Billing <billing@softwaretool.io>', date: 'Mon, 31 Mar 2025 17:00:00', snippet: 'Invoice #4521 for $299 was due on March 28th. Please pay to avoid service interruption. Payment link enclosed.', unread: true },
  { id: 'demo_4', subject: 'Team standup notes — March 31', from: 'Notion Bot <no-reply@notion.so>', date: 'Mon, 31 Mar 2025 10:00:00', snippet: 'Here are the notes from today\'s standup. Action items: deploy hotfix by Wednesday, review PR #88 from Ali, update roadmap doc before Friday all-hands.', unread: false },
  { id: 'demo_5', subject: 'Interview candidate — Thursday 2pm', from: 'HR <hr@company.com>', date: 'Mon, 31 Mar 2025 09:20:00', snippet: 'We have a candidate for the senior dev role scheduled Thursday at 2pm. Please confirm your availability and review the attached CV before the interview.', unread: true },
  { id: 'demo_6', subject: 'Your AWS bill is $1,240 this month', from: 'AWS Billing <billing@amazon.com>', date: 'Sun, 30 Mar 2025 06:00:00', snippet: 'Your estimated AWS charges for March 2025 are $1,240.00. This is 38% higher than last month. Review your usage in the console.', unread: false },
  { id: 'demo_7', subject: 'PR #88 needs your review', from: 'GitHub <noreply@github.com>', date: 'Sat, 29 Mar 2025 16:33:00', snippet: 'Ali Hassan opened pull request #88: "Fix race condition in auth middleware". 3 files changed, 47 additions. Awaiting your review.', unread: false },
];

const DEMO_TASKS = [
  { id: 'dt_1', title: 'Approve Q2 budget by Friday', detail: 'Finance team needs sign-off on $142,000 Q2 budget. Review the sheet and confirm before EOD Friday.', from: 'Sarah Chen', fromEmail: 'sarah@company.com', priority: 'HIGH', category: 'DEADLINE', deadline: 'Friday EOD', emailSubject: 'Q2 Budget Approval Needed ASAP', completed: false },
  { id: 'dt_2', title: 'Reply to Westfield — confirm Thursday call', detail: 'James Okafor from Westfield wants to discuss the proposal on Thursday at 3pm. Confirm if you\'re available.', from: 'James Okafor', fromEmail: 'james@westfield.com', priority: 'HIGH', category: 'REPLY', deadline: 'Thursday 3pm', emailSubject: 'Re: Client Proposal — Westfield Group', completed: false },
  { id: 'dt_3', title: 'Pay overdue invoice #4521 — $299', detail: 'Invoice is 3 days overdue. Pay via the link in the email to avoid service interruption.', from: 'Billing @ SoftwareTool', fromEmail: 'billing@softwaretool.io', priority: 'HIGH', category: 'ACTION', deadline: 'Overdue', emailSubject: 'Your invoice #4521 is overdue', completed: false },
  { id: 'dt_4', title: 'Review CV and confirm interview slot', detail: 'Senior dev candidate interview is Thursday 2pm. Confirm availability with HR and read the attached CV beforehand.', from: 'HR Team', fromEmail: 'hr@company.com', priority: 'MEDIUM', category: 'DEADLINE', deadline: 'Thursday 2pm', emailSubject: 'Interview candidate — Thursday 2pm', completed: false },
  { id: 'dt_5', title: 'Review PR #88 from Ali Hassan', detail: 'Auth middleware race condition fix. 3 files, 47 additions. Standup notes also flag this as a priority action item.', from: 'GitHub / Ali Hassan', fromEmail: 'noreply@github.com', priority: 'MEDIUM', category: 'REVIEW', deadline: 'Wednesday', emailSubject: 'PR #88 needs your review', completed: false },
  { id: 'dt_6', title: 'Investigate AWS bill spike (+38%)', detail: 'March AWS bill is $1,240 — 38% higher than last month. Check the console for unusual usage before it compounds.', from: 'AWS Billing', fromEmail: 'billing@amazon.com', priority: 'MEDIUM', category: 'ACTION', deadline: null, emailSubject: 'Your AWS bill is $1,240 this month', completed: false },
  { id: 'dt_7', title: 'Update roadmap doc before Friday all-hands', detail: 'Standup notes flag roadmap doc update as required before the Friday all-hands meeting.', from: 'Notion Bot', fromEmail: 'no-reply@notion.so', priority: 'LOW', category: 'ACTION', deadline: 'Friday', emailSubject: 'Team standup notes — March 31', completed: false },
];

const DEMO_BRIEF = `• Urgent: Q2 budget ($142K) needs your sign-off by Friday — Sarah Chen is waiting on you.
• Client call: Westfield Group wants Thursday 3pm to discuss the proposal — reply to confirm.
• Overdue payment: Invoice #4521 for $299 is 3 days late, risk of service cut-off.
• AWS costs jumped 38% this month — worth a quick audit before it goes higher.`;

// ── State ──────────────────────────────────────────────────────
let state = {
  tasks:     [],
  emails:    [],
  promos:    [],
  brief:     '',
  filter:    'all',
  activeTab: 'tasks',
  scanning:  false,
  demoMode:  false,
  modalTaskId: null
};

// ── Init ───────────────────────────────────────────────────────
async function init() {
  // Demo mode: no server needed
  if (sessionStorage.getItem('demoMode') === '1') {
    launchDemo();
    return;
  }

  const params = new URLSearchParams(location.search);
  if (params.get('error')) showLoginError(params.get('error'));
  history.replaceState({}, '', '/');

  const { authenticated, user, betaAuthorized } = await api('/api/status');
  if (!authenticated) return showScreen('login');

  showScreen('dashboard');
  document.getElementById('user-email').textContent = user.email;

  if (!betaAuthorized) {
    document.getElementById('btn-grant-perms').style.display = 'inline-flex';
  }

  const cached = await api('/api/cache');
  if (cached) applyResult(cached);
}

// ── Demo mode ──────────────────────────────────────────────────
function launchDemo() {
  state.demoMode = true;
  sessionStorage.setItem('demoMode', '1');

  showScreen('dashboard');
  document.getElementById('demo-banner').classList.remove('hidden');
  document.getElementById('user-email').textContent = 'demo@mailmission.app';

  const btn = document.getElementById('btn-scan');
  btn.disabled    = true;
  btn.textContent = '⟳ SCANNING...';

  switchPage('tasks');
  showState('tasks', 'loading');
  snapProgress(0);
  setLoadingStep('[1/2] Connecting to demo inbox...');
  animateProgress(50, 2000);
  startLoadingMessages();

  setTimeout(() => {
    setLoadingStep('[2/2] AI extracting tasks...');
    animateProgress(97, 3000);
  }, 2000);

  setTimeout(() => {
    stopLoadingMessages();
    snapProgress(100);
    updateLoadingMsg({ icon: '🎬', text: 'Lights, camera, action items...' });
    setLoadingStep('[2/2] Done ✓');

    setTimeout(() => {
      state.emails = DEMO_EMAILS;
      applyResult({
        tasks:        DEMO_TASKS,
        brief:        DEMO_BRIEF,
        promos:       [],
        scannedCount: DEMO_EMAILS.length,
        timestamp:    new Date().toISOString()
      });
      document.getElementById('inbox-badge').textContent = DEMO_EMAILS.length;
      document.getElementById('scan-hint').textContent = '// Demo data loaded';
      btn.disabled    = false;
      btn.textContent = '⟳ SCAN INBOX';
    }, 400);
  }, 5200);
}

// ── Theme ──────────────────────────────────────────────────────
function setTheme(name) {
  const t = name || 'retro';
  document.body.setAttribute('data-theme', t);
  localStorage.setItem('mm_theme', t);
  document.querySelectorAll('.theme-dot').forEach(d =>
    d.classList.toggle('active', d.dataset.theme === t)
  );
}

document.addEventListener('DOMContentLoaded', () => {
  setTheme(localStorage.getItem('mm_theme') || 'retro');
  document.querySelectorAll('.theme-dot').forEach(dot =>
    dot.addEventListener('click', () => setTheme(dot.dataset.theme))
  );
});

// ── Screens ────────────────────────────────────────────────────
function showScreen(name) {
  document.getElementById('login-screen').classList.toggle('hidden', name !== 'login');
  document.getElementById('dashboard').classList.toggle('hidden', name !== 'dashboard');
}

// ── API helper ─────────────────────────────────────────────────
async function api(url, opts = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error('Non-JSON response from', url, ':', text.slice(0, 200));
    throw new Error('Server error — check the terminal for details');
  }
}

// ── Scan inbox ─────────────────────────────────────────────────
async function scanInbox() {
  if (state.demoMode) { launchDemo(); return; }
  if (state.scanning) return;
  state.scanning = true;

  const btn   = document.getElementById('btn-scan');
  const limit = document.getElementById('email-limit').value;

  btn.disabled    = true;
  btn.textContent = '⟳ SCANNING...';

  switchPage('tasks');
  showState('tasks', 'loading');
  snapProgress(0);
  setLoadingStep(`[1/2] Connecting to Gmail...`);

  try {
    // Step 1 — fetch emails, bar crawls 0→48% while waiting
    animateProgress(48, 5000);
    const { emails, error: emailErr } = await api(`/api/emails?limit=${limit}`);
    if (emailErr) throw new Error(emailErr);

    state.emails = emails || [];
    document.getElementById('inbox-badge').textContent = state.emails.length;
    renderInbox();

    snapProgress(50);
    setLoadingStep(`[1/2] Got ${state.emails.length} emails ✓`);
    await sleep(250);

    if (!state.emails.length) {
      showState('tasks', 'empty');
      return;
    }

    // Step 2 — AI, bar crawls 50→97% over 60s (never stops before AI finishes), fun texts play
    setLoadingStep(`[2/2] AI is reading your ${state.emails.length} emails...`);
    startLoadingMessages();
    animateProgress(97, 60000);

    const result = await api('/api/analyze', {
      method: 'POST',
      body:   JSON.stringify({ emails: state.emails })
    });

    if (result.error) throw new Error(result.error);

    stopLoadingMessages();
    snapProgress(100);
    updateLoadingMsg({ icon: '🎬', text: 'Lights, camera, action items...' });
    setLoadingStep('[2/2] Done ✓');
    await sleep(450);

    applyResult(result);

    document.getElementById('scan-hint').textContent =
      `// Last scan: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  } catch (err) {
    stopLoadingMessages();
    showState('tasks', 'error');
    document.getElementById('error-msg').textContent = err.message || 'Something went wrong.';
  } finally {
    stopProgressAnimation();
    state.scanning  = false;
    btn.disabled    = false;
    btn.textContent = '⟳ SCAN INBOX';
  }
}

function applyResult(result) {
  state.tasks  = result.tasks  || [];
  state.brief  = result.brief  || '';
  state.promos = result.promos || [];

  updateStats(result.scannedCount || state.emails.length);
  recordStat('scanned', result.scannedCount || state.emails.length);
  renderTasks();
  renderBrief(result);
  renderInbox();
}

// ── Render tasks ───────────────────────────────────────────────
function renderTasks() {
  const container  = document.getElementById('tasks-container');
  const filterBar  = document.getElementById('filter-bar');
  const badge      = document.getElementById('tasks-badge');

  const pending    = state.tasks.filter(t => !t.completed).length;
  badge.textContent = pending;

  if (!state.tasks.length) {
    showState('tasks', 'empty');
    return;
  }

  showState('tasks', 'list');
  filterBar.style.display = 'flex';

  // Completed tasks are HIDDEN unless the ✅ DONE filter is active
  let filtered;
  if (state.filter === 'completed') {
    filtered = state.tasks.filter(t => t.completed);
  } else if (state.filter === 'all') {
    filtered = state.tasks.filter(t => !t.completed);
  } else {
    filtered = state.tasks.filter(t => t.priority === state.filter && !t.completed);
  }

  const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  filtered.sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3));

  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state" style="padding:40px 20px">
      <div class="empty-icon">🔍</div>
      <div class="empty-title">NO TASKS IN THIS FILTER</div>
    </div>`;
    return;
  }

  container.innerHTML = filtered.map((task, i) => taskCard(task, i)).join('');

  // Attach events
  container.querySelectorAll('.task-card').forEach(card => {
    const id = card.dataset.id;
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('task-done-btn')) return;
      openModal(id);
    });
  });

  container.querySelectorAll('.task-done-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDone(btn.dataset.id);
    });
  });
}

function taskCard(task, i = 0) {
  const priorityLabel = { HIGH: '!! HIGH', MEDIUM: '! MED', LOW: '– LOW' }[task.priority] || task.priority;
  const isDone = task.completed;
  return `
    <div class="task-card priority-${task.priority} ${isDone ? 'completed' : ''}" data-id="${task.id}" style="animation-delay:${i * 0.06}s">
      <span class="task-priority-icon">${priorityLabel}</span>
      <div class="task-body">
        <div class="task-title">${escHtml(task.title)}</div>
        <div class="task-detail">${escHtml(task.detail)}</div>
        <div class="task-meta">
          <span class="task-from">▶ ${escHtml(task.from)}</span>
          <span class="task-cat">${task.category}</span>
          ${task.deadline ? `<span class="task-deadline">⏰ ${escHtml(task.deadline)}</span>` : ''}
        </div>
      </div>
      <button class="task-done-btn ${isDone ? 'is-done' : ''}" data-id="${task.id}">
        ${isDone ? '✓ DONE' : 'DONE'}
      </button>
    </div>`;
}

const DONE_QUIPS = [
  "Touch grass. You've earned it. 🌱",
  "One less email haunting you. 👻",
  "CEO behavior. Respect. 📈",
  "Boom. Deleted from existence. 💥",
  "Your future self just nodded. 🙏",
  "Task slain. You're built different. ⚔️",
  "Go hydrate. You deserve it. 💧",
  "The emails fear you now. 😤",
  "Done before it even had a chance. ⚡",
  "Inbox zero is coming for you. 📭",
  "That email never stood a chance. 💀",
  "Absolutely destroyed. Well played. 🎮",
];

// ── Toggle done ────────────────────────────────────────────────
async function toggleDone(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;

  const wasCompleted = task.completed;
  task.completed = !task.completed;

  if (!state.demoMode) {
    const endpoint = task.completed ? `/api/tasks/${id}/complete` : `/api/tasks/${id}/undo`;
    await api(endpoint, { method: 'POST', body: JSON.stringify({ emailSubject: task.emailSubject }) });
  }

  if (task.completed && !wasCompleted) {
    showToast(DONE_QUIPS[Math.floor(Math.random() * DONE_QUIPS.length)]);
    recordStat('completed');
  }

  renderTasks();
  updateStats();

  if (state.modalTaskId === id) {
    closeModal();
  }
}

function showToast(msg) {
  let toast = document.getElementById('done-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'done-toast';
    toast.className = 'done-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.remove('toast-out');
  toast.classList.add('toast-in');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove('toast-in');
    toast.classList.add('toast-out');
  }, 2800);
}

// ── Modal ──────────────────────────────────────────────────────
function openModal(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;

  state.modalTaskId = id;

  const priorityColors = { HIGH: '#ff3c3c', MEDIUM: '#ffb300', LOW: '#39ff14' };
  const priorEl = document.getElementById('modal-priority');
  priorEl.textContent = task.priority;
  priorEl.style.background = (priorityColors[task.priority] || '#fff') + '22';
  priorEl.style.color = priorityColors[task.priority] || '#fff';

  document.getElementById('modal-title').textContent    = task.title;
  document.getElementById('modal-detail').textContent   = task.detail;
  document.getElementById('modal-from').textContent     = `${task.from}${task.fromEmail ? ' <' + task.fromEmail + '>' : ''}`;
  document.getElementById('modal-subject').textContent  = task.emailSubject || '—';
  document.getElementById('modal-category').textContent = task.category;

  const dlRow = document.getElementById('modal-deadline-row');
  if (task.deadline) {
    document.getElementById('modal-deadline').textContent = task.deadline;
    dlRow.style.display = 'flex';
  } else {
    dlRow.style.display = 'none';
  }

  const doneBtn = document.getElementById('modal-done-btn');
  doneBtn.textContent = task.completed ? '✓ DONE' : '✓ MARK DONE';
  doneBtn.classList.toggle('done', task.completed);

  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  state.modalTaskId = null;
}

// ── Render brief ───────────────────────────────────────────────
function renderBrief(result) {
  if (!result.brief) return;

  document.getElementById('brief-placeholder').classList.add('hidden');
  const panel = document.getElementById('brief-content');
  panel.classList.remove('hidden');

  const ts = result.timestamp ? new Date(result.timestamp) : new Date();
  document.getElementById('brief-time').textContent =
    ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  // Render brief with styled sections
  const lines = result.brief.split('\n');
  document.getElementById('brief-body').innerHTML = lines.map(line => {
    if (line.startsWith('⚡') || line.startsWith('📬')) {
      return `<div class="brief-section-title">${escHtml(line)}</div>`;
    }
    if (line.startsWith('•')) {
      const isHigh = line.includes('🔴');
      const isMed  = line.includes('🟡');
      return `<div class="brief-line ${isHigh ? 'brief-high' : isMed ? 'brief-med' : ''}">${escHtml(line)}</div>`;
    }
    return line ? `<div class="brief-line">${escHtml(line)}</div>` : '';
  }).join('');
}

// ── Render inbox ───────────────────────────────────────────────
function renderInbox() {
  const list = document.getElementById('inbox-list');
  const ph   = document.getElementById('inbox-placeholder');

  if (!state.emails.length && !state.promos.length) {
    ph.classList.remove('hidden'); list.innerHTML = ''; return;
  }
  ph.classList.add('hidden');

  const emailCard = e => `
    <div class="inbox-item">
      <div class="inbox-subject-row">
        <div class="inbox-subject">
          ${e.unread ? '<span class="unread-dot"></span>' : ''}
          ${escHtml(e.subject)}
        </div>
        <div class="inbox-date">${escHtml(fmtDate(e.date))}</div>
      </div>
      <div class="inbox-meta">${escHtml(e.from)}</div>
      <div class="inbox-snippet">${escHtml(e.snippet)}</div>
    </div>`;

  const promoSection = state.promos.length ? `
    <div class="promo-section" id="promo-section">
      <button class="promo-toggle" id="promo-toggle" onclick="togglePromos()">
        <span>📢 PROMOTIONS</span>
        <span class="promo-count">${state.promos.length}</span>
        <span class="promo-arrow" id="promo-arrow">▶</span>
      </button>
      <div class="promo-list hidden" id="promo-list">
        ${state.promos.map(emailCard).join('')}
      </div>
    </div>` : '';

  list.innerHTML = state.emails.map(emailCard).join('') + promoSection;
}

function togglePromos() {
  const body  = document.getElementById('promo-list');
  const arrow = document.getElementById('promo-arrow');
  if (!body) return;
  body.classList.toggle('hidden');
  arrow.textContent = body.classList.contains('hidden') ? '▶' : '▼';
}

// ── Stats ──────────────────────────────────────────────────────
function updateStats(scanned) {
  if (scanned !== undefined) flashStat('stat-scanned', scanned);
  const total = state.tasks.length;
  const done  = state.tasks.filter(t => t.completed).length;
  flashStat('stat-tasks', total);
  flashStat('stat-done', done);
}

function flashStat(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = val;
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
}

// ── Fun loading messages ───────────────────────────────────────
const LOADING_MSGS = [
  { icon: '🕺', text: 'Moonwalking through your inbox...' },
  { icon: '🍳', text: 'Cooking up your task list...' },
  { icon: '🔍', text: 'Snooping through your emails...' },
  { icon: '🧠', text: 'Teaching the AI to read...' },
  { icon: '☕', text: 'Grabbing a coffee while scanning...' },
  { icon: '🚀', text: 'Launching into your inbox...' },
  { icon: '🎯', text: 'Hunting for action items...' },
  { icon: '🧹', text: 'Sweeping through the clutter...' },
  { icon: '🎪', text: 'Juggling your emails...' },
  { icon: '🕵️', text: 'Investigating suspicious emails...' },
  { icon: '🏋️', text: 'Heavy lifting in progress...' },
  { icon: '🎸', text: 'Rocking through your inbox...' },
  { icon: '🧩', text: 'Putting the pieces together...' },
  { icon: '⚡', text: 'Zapping through 25 emails...' },
  { icon: '🤖', text: 'Convincing the robots to help...' },
  { icon: '🦅', text: 'Eagle-eyeing your inbox...' },
  { icon: '🧃', text: 'Squeezing out the important stuff...' },
  { icon: '📡', text: 'Receiving transmissions...' },
  { icon: '🎭', text: 'Performing inbox surgery...' },
];

let loadingInterval = null;

function startLoadingMessages() {
  // Shuffle so every scan feels different
  const shuffled = [...LOADING_MSGS].sort(() => Math.random() - 0.5);
  let idx = 0;
  updateLoadingMsg(shuffled[idx]);
  loadingInterval = setInterval(() => {
    idx = (idx + 1) % shuffled.length;
    const el = document.getElementById('loading-text');
    if (el) el.style.opacity = '0';
    setTimeout(() => {
      updateLoadingMsg(shuffled[idx]);
      if (el) el.style.opacity = '1';
    }, 300);
  }, 2000);
}

function stopLoadingMessages() {
  clearInterval(loadingInterval);
  loadingInterval = null;
}

function updateLoadingMsg(msg) {
  const el   = document.getElementById('loading-text');
  const icon = document.getElementById('loading-icon');
  if (el)   el.textContent   = msg.text;
  if (icon) icon.textContent = msg.icon;
}

// ── Loading helpers ────────────────────────────────────────────
function showState(tab, stateKey) {
  const map = {
    loading:     'tasks-loading',
    empty:       'tasks-empty',
    error:       'tasks-error',
    list:        'tasks-list',
    placeholder: 'tasks-placeholder'
  };
  ['loading','empty','error','list','placeholder'].forEach(k => {
    const el = document.getElementById(map[k]);
    if (el) el.classList.toggle('hidden', k !== stateKey);
  });
}

function setLoadingText(txt) {
  document.getElementById('loading-text').textContent = txt;
}

// ── Progress bar (RAF-driven smooth crawl) ─────────────────────
let _raf = null;
let _currentPct = 0;

function snapProgress(pct) {
  stopProgressAnimation();
  _currentPct = pct;
  const fill = document.getElementById('loading-fill');
  const pctEl = document.getElementById('loading-pct');
  if (fill) { fill.classList.remove('scanning'); fill.style.width = pct + '%'; }
  if (pctEl) pctEl.textContent = Math.round(pct) + '%';
}

function animateProgress(targetPct, durationMs) {
  stopProgressAnimation();
  const fill = document.getElementById('loading-fill');
  const pctEl = document.getElementById('loading-pct');
  if (fill) fill.classList.remove('scanning');
  const startPct = _currentPct;
  const startTime = performance.now();

  function tick(now) {
    const t = Math.min((now - startTime) / durationMs, 1);
    const eased = t < 1 ? 1 - Math.pow(1 - t, 3) : 1; // ease-out cubic
    _currentPct = startPct + (targetPct - startPct) * eased;
    if (fill) fill.style.width = _currentPct + '%';
    if (pctEl) pctEl.textContent = Math.round(_currentPct) + '%';
    if (t < 1) _raf = requestAnimationFrame(tick);
  }
  _raf = requestAnimationFrame(tick);
}

function stopProgressAnimation() {
  if (_raf) { cancelAnimationFrame(_raf); _raf = null; }
}

function setLoadingStep(msg) {
  const el = document.getElementById('loading-step');
  if (el) el.textContent = msg;
}

// ── Page navigation ────────────────────────────────────────────
const PAGE_MAP = {
  tasks: 'tab-tasks', brief: 'tab-brief', inbox: 'tab-inbox',
  agent: 'tab-agent', stats: 'page-stats', games: 'page-games'
};

function switchPage(name) {
  document.querySelectorAll('.sb-item').forEach(i => i.classList.toggle('active', i.dataset.page === name));
  document.querySelectorAll('.page-panel').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(PAGE_MAP[name]);
  if (el) el.classList.add('active');
  state.activeTab = name;
  if (name === 'stats') renderStats();
}

document.querySelectorAll('.sb-item').forEach(btn => {
  btn.addEventListener('click', () => switchPage(btn.dataset.page));
});

// BETA section toggle
document.getElementById('sb-beta-toggle')?.addEventListener('click', () => {
  const body  = document.getElementById('sb-beta-body');
  const arrow = document.getElementById('sb-beta-arrow');
  body.classList.toggle('hidden');
  if (arrow) arrow.style.transform = body.classList.contains('hidden') ? '' : 'rotate(90deg)';
});

// ── Filters ────────────────────────────────────────────────────
document.addEventListener('click', (e) => {
  const f = e.target.closest('.filter');
  if (!f) return;
  document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
  f.classList.add('active');
  state.filter = f.dataset.filter;
  renderTasks();
});

// ── Scan button ────────────────────────────────────────────────
document.getElementById('btn-scan')?.addEventListener('click', () => {
  if (state.demoMode) { launchDemo(); return; }
  scanInbox();
});
document.getElementById('btn-retry')?.addEventListener('click', () => {
  if (state.demoMode) { launchDemo(); return; }
  scanInbox();
});

// ── Demo button ────────────────────────────────────────────────
document.getElementById('btn-demo')?.addEventListener('click', () => {
  sessionStorage.setItem('demoMode', '1');
  launchDemo();
});

// Exit demo — works without server
document.querySelector('[href="/auth/logout"]')?.addEventListener('click', (e) => {
  if (state.demoMode) {
    e.preventDefault();
    sessionStorage.removeItem('demoMode');
    location.reload();
  }
});

// ── Modal events ───────────────────────────────────────────────
document.getElementById('modal-close')?.addEventListener('click', closeModal);
document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});
document.getElementById('modal-done-btn')?.addEventListener('click', () => {
  if (state.modalTaskId) toggleDone(state.modalTaskId);
});

// ── Keyboard shortcuts ─────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
  if (e.key === 's' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT') {
    scanInbox();
  }
});

// ── Helpers ────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function fmtDate(d) { try { const dt = new Date(d); return dt.toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }); } catch { return d||''; } }

function showLoginError(err) {
  const messages = {
    access_denied: 'Gmail access was denied. Please try again.',
    auth_failed:   'Authentication failed. Check your Google credentials.'
  };
  const note = document.querySelector('.login-note');
  if (note) {
    note.style.color = '#ff3c3c';
    note.textContent = messages[err] || 'Login error. Please try again.';
  }
}

// ── Server-check: intercept /auth links when no server running ──
function isFileProtocol() { return location.protocol === 'file:'; }

document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href^="/auth"]');
  if (!link) return;
  if (isFileProtocol()) {
    e.preventDefault();
    if (state.demoMode && link.href.includes('logout')) {
      sessionStorage.removeItem('demoMode');
      location.reload();
      return;
    }
    document.getElementById('server-notice').classList.remove('hidden');
  }
});

document.getElementById('notice-close')?.addEventListener('click', () => {
  document.getElementById('server-notice').classList.add('hidden');
});

// Also intercept the main Connect Gmail button on login screen when file://
document.querySelector('.btn-connect')?.addEventListener('click', (e) => {
  if (isFileProtocol()) {
    e.preventDefault();
    document.getElementById('server-notice').classList.remove('hidden');
  }
});

// ── BETA Agent ─────────────────────────────────────────────────
document.getElementById('btn-agent')?.addEventListener('click', runAgent);

async function runAgent() {
  if (!state.emails.length) {
    alert('Scan your inbox first, then run the agent.');
    return;
  }

  const perms = {};
  document.querySelectorAll('.beta-perm').forEach(cb => {
    perms[cb.dataset.perm] = cb.checked;
  });

  if (!perms.draft_replies && !perms.auto_archive && !perms.mark_read) {
    alert('Enable at least one permission above before running the agent.');
    return;
  }

  const btn = document.getElementById('btn-agent');
  btn.disabled    = true;
  btn.textContent = '⚙ RUNNING...';

  // Switch to agent tab
  switchPage('agent');
  document.getElementById('agent-placeholder').classList.add('hidden');
  document.getElementById('agent-running').classList.remove('hidden');
  document.getElementById('agent-log-list').innerHTML = '';

  try {
    const result = await api('/api/beta/run', {
      method: 'POST',
      body: JSON.stringify({ emails: state.emails, permissions: perms })
    });

    document.getElementById('agent-running').classList.add('hidden');

    if (result.error) throw new Error(result.error);

    const log = result.log || [];
    const acted = log.filter(e => e.action !== 'none').length;
    document.getElementById('agent-badge').textContent = acted || log.length;

    if (!log.length) {
      document.getElementById('agent-log-list').innerHTML = `
        <div class="placeholder-state">
          <div class="placeholder-icon">📭</div>
          <div class="placeholder-title">NO EMAILS SENT</div>
          <div class="placeholder-sub">Make sure you've scanned your inbox first, then run the agent.</div>
        </div>`;
    } else {
      renderAgentLog(log);
    }

  } catch (err) {
    document.getElementById('agent-running').classList.add('hidden');
    const isPermError = err.message?.toLowerCase().includes('permission') || err.message?.toLowerCase().includes('insufficien') || err.message?.toLowerCase().includes('403');
    if (isPermError) {
      document.getElementById('btn-grant-perms').style.display = 'inline-flex';
    }
    document.getElementById('agent-log-list').innerHTML = `
      <div class="error-state">
        <div class="error-icon">⚠</div>
        <div class="error-msg">${isPermError ? 'Gmail needs extra permissions to draft replies. Click GRANT PERMISSIONS FIRST above.' : (err.message || 'Agent failed.')}</div>
      </div>`;
  } finally {
    btn.disabled    = false;
    btn.textContent = '⚡ RUN AGENT';
  }
}

function renderAgentLog(log) {
  const icons  = { proposed_reply: '✍️', draft_reply: '✍️', archive: '📦', mark_read: '👁', none: '–', error: '⚠️' };
  const labels = { proposed_reply: 'REPLY READY', draft_reply: 'DRAFTED', archive: 'ARCHIVED', mark_read: 'MARKED READ', none: 'SKIPPED', error: 'ERROR' };

  document.getElementById('agent-log-list').innerHTML = log.map((entry, i) => `
    <div class="log-item" id="log-item-${i}" style="animation-delay:${i * 0.07}s">
      <div class="log-icon">${icons[entry.action] || '•'}</div>
      <div class="log-body">
        <span class="log-action ${entry.action}">${labels[entry.action] || entry.action}</span>
        <div class="log-subject">${escHtml(entry.subject)}</div>
        <div class="log-reason">${escHtml(entry.from || '')}${entry.date ? ' · ' + escHtml(fmtDate(entry.date)) : ''} — ${escHtml(entry.reason)}</div>
        ${entry.preview ? `<div class="log-preview">${escHtml(entry.preview)}</div>` : ''}
        ${entry.action === 'proposed_reply' ? `
          <div class="log-actions" id="log-actions-${i}">
            <button class="btn-create-draft" data-idx="${i}"
              data-email-id="${escHtml(entry.emailId||'')}"
              data-thread-id="${escHtml(entry.threadId||'')}"
              data-to="${escHtml(entry.toAddr||'')}"
              data-subject="${escHtml(entry.subject||'')}"
              data-reply="${escHtml(entry.preview||'')}">📝 CREATE DRAFT</button>
            <span class="send-status" id="draft-status-${i}"></span>
          </div>` : ''}
        ${entry.action === 'draft_reply' && entry.draftId ? `
          <div class="log-actions">
            <button class="btn-send-draft" data-draft-id="${entry.draftId}">📤 SEND NOW</button>
            <span class="send-status" id="send-status-${entry.draftId}"></span>
          </div>` : ''}
      </div>
    </div>
  `).join('');

  // Wire CREATE DRAFT buttons — creates draft only when user clicks
  document.querySelectorAll('.btn-create-draft').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx      = btn.dataset.idx;
      const statusEl = document.getElementById(`draft-status-${idx}`);
      btn.disabled   = true;
      btn.textContent = '⏳ CREATING...';
      try {
        const result = await api('/api/beta/draft', {
          method: 'POST',
          body: JSON.stringify({
            emailId:   btn.dataset.emailId,
            threadId:  btn.dataset.threadId,
            toAddr:    btn.dataset.to,
            subject:   btn.dataset.subject,
            replyText: btn.dataset.reply
          })
        });
        if (result.error) throw new Error(result.error);
        // Swap to SEND NOW button
        const actionsEl = document.getElementById(`log-actions-${idx}`);
        actionsEl.innerHTML = `
          <button class="btn-send-draft" data-draft-id="${result.draftId}">📤 SEND NOW</button>
          <span class="send-status" id="send-status-${result.draftId}">Draft saved in Gmail</span>`;
        document.getElementById(`send-status-${result.draftId}`).style.color = 'var(--green)';
        // Wire the new send button
        actionsEl.querySelector('.btn-send-draft').addEventListener('click', sendDraftHandler);
      } catch (err) {
        btn.disabled    = false;
        btn.textContent = '📝 CREATE DRAFT';
        statusEl.textContent = 'Failed: ' + err.message;
        statusEl.style.color = 'var(--red)';
      }
    });
  });

  // Wire existing SEND NOW buttons (for already-drafted entries)
  document.querySelectorAll('.btn-send-draft').forEach(btn => btn.addEventListener('click', sendDraftHandler));
}

async function sendDraftHandler() {
  const btn      = this;
  const draftId  = btn.dataset.draftId;
  const statusEl = document.getElementById(`send-status-${draftId}`);
  btn.disabled   = true;
  btn.textContent = '⏳ SENDING...';
  try {
    await api(`/api/beta/send/${draftId}`, { method: 'POST' });
    btn.textContent = '✅ SENT';
    if (statusEl) { statusEl.textContent = 'Sent!'; statusEl.style.color = 'var(--green)'; }
  } catch (err) {
    btn.disabled    = false;
    btn.textContent = '📤 SEND NOW';
    if (statusEl) { statusEl.textContent = 'Failed to send'; statusEl.style.color = 'var(--red)'; }
  }
}

// ── Stats (localStorage) ───────────────────────────────────────
function getStats() {
  try { return JSON.parse(localStorage.getItem('mm_stats')) || { days:{}, allTime:{completed:0,scanned:0}, streak:0, lastUsed:null }; }
  catch { return { days:{}, allTime:{completed:0,scanned:0}, streak:0, lastUsed:null }; }
}
function saveStats(s) { localStorage.setItem('mm_stats', JSON.stringify(s)); }

function recordStat(type, value = 1) {
  const s = getStats();
  const today = new Date().toISOString().slice(0,10);
  if (!s.days[today]) s.days[today] = { completed:0, scanned:0 };
  if (type === 'scanned') {
    s.days[today].scanned = value;
    s.allTime.scanned = (s.allTime.scanned||0) + 1;
    const yesterday = new Date(Date.now()-86400000).toISOString().slice(0,10);
    s.streak = (!s.lastUsed || s.lastUsed < yesterday) ? 1 : (s.lastUsed === yesterday) ? (s.streak||0)+1 : (s.streak||1);
    s.lastUsed = today;
  } else {
    s.days[today].completed += value;
    s.allTime.completed = (s.allTime.completed||0) + value;
  }
  saveStats(s);
}

function renderStats() {
  const s = getStats();
  const today = new Date().toISOString().slice(0,10);
  const todayD = s.days[today] || { completed:0, scanned:0 };

  let weekDone = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.now()-i*86400000).toISOString().slice(0,10);
    weekDone += s.days[d]?.completed || 0;
  }

  let bestDay = 0;
  Object.values(s.days).forEach(d => { if ((d.completed||0) > bestDay) bestDay = d.completed; });

  const total = s.allTime.completed || 0;
  const rank    = total >= 200 ? '👑 LEGEND'      : total >= 100 ? '🔥 ELITE AGENT'  : total >= 50 ? '⚡ FIELD AGENT' : total >= 10 ? '🎯 OPERATIVE' : '🌱 ROOKIE';
  const rankSub = total >= 200 ? 'The inbox fears you.' : total >= 100 ? 'You are unstoppable.' : total >= 50 ? 'Getting things done.' : total >= 10 ? 'Building the habit.' : 'Every mission starts here.';

  const days7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now()-i*86400000);
    days7.push({ label: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()], count: s.days[d.toISOString().slice(0,10)]?.completed||0, today: i===0 });
  }
  const maxBar = Math.max(...days7.map(d => d.count), 1);

  document.getElementById('stats-page-inner').innerHTML = `
    <div class="stats-header">// MISSION STATS //</div>
    <div class="stats-rank">
      <div class="stats-rank-label">${rank}</div>
      <div class="stats-rank-sub">${rankSub}</div>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><span class="stat-card-num">${todayD.completed}</span><div class="stat-card-label">Tasks Today</div></div>
      <div class="stat-card"><span class="stat-card-num">${weekDone}</span><div class="stat-card-label">This Week</div></div>
      <div class="stat-card"><span class="stat-card-num">${total}</span><div class="stat-card-label">All Time</div></div>
      <div class="stat-card"><span class="stat-card-num">${s.allTime.scanned||0}</span><div class="stat-card-label">Scans Run</div></div>
      <div class="stat-card"><span class="stat-card-num">${bestDay}</span><div class="stat-card-label">Best Day</div></div>
      <div class="stat-card"><span class="stat-card-num">${s.streak||0}🔥</span><div class="stat-card-label">Day Streak</div></div>
    </div>
    <div class="stats-chart-title">// LAST 7 DAYS //</div>
    <div class="stats-chart">
      ${days7.map(d => `<div class="chart-col"><div class="chart-bar${d.today?' today':''}" style="height:${Math.max((d.count/maxBar)*100,3)}%"></div><div class="chart-day">${d.label}</div></div>`).join('')}
    </div>`;
}

// ── Start ──────────────────────────────────────────────────────
init();
