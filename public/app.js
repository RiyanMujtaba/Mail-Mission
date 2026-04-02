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

  const { authenticated, user } = await api('/api/status');
  if (!authenticated) return showScreen('login');

  showScreen('dashboard');
  document.getElementById('user-email').textContent = user.email;

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

  // Simulate scan with a loading animation
  const btn = document.getElementById('btn-scan');
  btn.disabled = true;
  btn.textContent = '⟳ SCANNING...';
  showState('tasks', 'loading');
  setLoadingText('LOADING DEMO INBOX...');

  let progress = 0;
  const interval = setInterval(() => {
    progress += 18;
    setLoadingProgress(progress);
    if (progress >= 40)  setLoadingText('RUNNING AI ANALYSIS...');
    if (progress >= 80)  setLoadingText('EXTRACTING TASKS...');
    if (progress >= 100) {
      clearInterval(interval);
      setTimeout(() => {
        applyResult({
          tasks:        DEMO_TASKS,
          brief:        DEMO_BRIEF,
          scannedCount: DEMO_EMAILS.length,
          timestamp:    new Date().toISOString()
        });
        state.emails = DEMO_EMAILS;
        document.getElementById('inbox-badge').textContent = DEMO_EMAILS.length;
        renderInbox();
        document.getElementById('scan-hint').textContent = '// Demo data loaded';
        btn.disabled    = false;
        btn.textContent = '⟳ SCAN INBOX';
      }, 300);
    }
  }, 120);
}

// ── Screens ────────────────────────────────────────────────────
function showScreen(name) {
  document.getElementById('login-screen').classList.toggle('hidden', name !== 'login');
  document.getElementById('dashboard').classList.toggle('hidden', name !== 'dashboard');
}

// ── API helper ─────────────────────────────────────────────────
async function api(url, opts = {}) {
  const res  = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  return res.json();
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

  showState('tasks', 'loading');
  setLoadingText('CONNECTING TO GMAIL...');
  setLoadingProgress(15);

  try {
    // Step 1 — fetch emails
    setLoadingText('FETCHING EMAILS...');
    setLoadingProgress(30);
    const { emails, error: emailErr } = await api(`/api/emails?limit=${limit}`);
    if (emailErr) throw new Error(emailErr);

    state.emails = emails || [];
    document.getElementById('inbox-badge').textContent = state.emails.length;
    renderInbox();

    if (!state.emails.length) {
      showState('tasks', 'empty');
      return;
    }

    // Step 2 — AI analysis
    setLoadingText(`ANALYZING ${state.emails.length} EMAILS WITH AI...`);
    setLoadingProgress(60);

    const result = await api('/api/analyze', {
      method: 'POST',
      body:   JSON.stringify({ emails: state.emails })
    });

    if (result.error) throw new Error(result.error);

    setLoadingProgress(100);
    await sleep(300);

    applyResult(result);

    // Update scan hint
    const now = new Date();
    document.getElementById('scan-hint').textContent =
      `// Last scan: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  } catch (err) {
    showState('tasks', 'error');
    document.getElementById('error-msg').textContent = err.message || 'Something went wrong.';
  } finally {
    state.scanning  = false;
    btn.disabled    = false;
    btn.textContent = '⟳ SCAN INBOX';
  }
}

function applyResult(result) {
  state.tasks = result.tasks || [];
  state.brief = result.brief || '';

  updateStats(result.scannedCount || state.emails.length);
  renderTasks();
  renderBrief(result);
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

  let filtered = state.tasks;
  if (state.filter === 'completed') {
    filtered = state.tasks.filter(t => t.completed);
  } else if (state.filter !== 'all') {
    filtered = state.tasks.filter(t => t.priority === state.filter && !t.completed);
  }

  // Sort: incomplete first, then HIGH → MEDIUM → LOW
  const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  filtered.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
  });

  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state" style="padding:40px 20px">
      <div class="empty-icon">🔍</div>
      <div class="empty-title">NO TASKS IN THIS FILTER</div>
    </div>`;
    return;
  }

  container.innerHTML = filtered.map(task => taskCard(task)).join('');

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

function taskCard(task) {
  const priorityLabel = { HIGH: '!! HIGH', MEDIUM: '! MED', LOW: '– LOW' }[task.priority] || task.priority;
  const isDone = task.completed;
  return `
    <div class="task-card priority-${task.priority} ${isDone ? 'completed' : ''}" data-id="${task.id}">
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

// ── Toggle done ────────────────────────────────────────────────
async function toggleDone(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;

  task.completed = !task.completed;

  if (!state.demoMode) {
    const endpoint = task.completed ? `/api/tasks/${id}/complete` : `/api/tasks/${id}/undo`;
    await api(endpoint, { method: 'POST' });
  }

  renderTasks();
  updateStats();

  // Update modal done button if open
  if (state.modalTaskId === id) {
    const btn = document.getElementById('modal-done-btn');
    btn.textContent = task.completed ? '✓ DONE' : '✓ MARK DONE';
    btn.classList.toggle('done', task.completed);
  }
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
  document.getElementById('brief-body').textContent = result.brief;
}

// ── Render inbox ───────────────────────────────────────────────
function renderInbox() {
  const list = document.getElementById('inbox-list');
  const ph   = document.getElementById('inbox-placeholder');

  if (!state.emails.length) { ph.classList.remove('hidden'); list.innerHTML = ''; return; }
  ph.classList.add('hidden');

  list.innerHTML = state.emails.map(e => `
    <div class="inbox-item">
      <div class="inbox-subject">
        ${e.unread ? '<span class="unread-dot"></span>' : ''}
        ${escHtml(e.subject)}
      </div>
      <div class="inbox-meta">${escHtml(e.from)} &nbsp;·&nbsp; ${escHtml(e.date)}</div>
      <div class="inbox-snippet">${escHtml(e.snippet)}</div>
    </div>
  `).join('');
}

// ── Stats ──────────────────────────────────────────────────────
function updateStats(scanned) {
  if (scanned !== undefined)
    document.getElementById('stat-scanned').textContent = scanned;
  const total = state.tasks.length;
  const done  = state.tasks.filter(t => t.completed).length;
  document.getElementById('stat-tasks').textContent = total;
  document.getElementById('stat-done').textContent  = done;
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

function setLoadingProgress(pct) {
  document.getElementById('loading-fill').style.width = pct + '%';
}

// ── Tabs ───────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    state.activeTab = btn.dataset.tab;
  });
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
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector('[data-tab="agent"]').classList.add('active');
  document.getElementById('tab-agent').classList.add('active');
  document.getElementById('agent-placeholder').classList.add('hidden');
  document.getElementById('agent-running').classList.remove('hidden');
  document.getElementById('agent-log-list').innerHTML = '';

  try {
    const result = await api('/api/beta/run', {
      method: 'POST',
      body: JSON.stringify({ emails: state.emails, permissions: perms })
    });

    document.getElementById('agent-running').classList.add('hidden');

    const log = result.log || [];
    document.getElementById('agent-badge').textContent = log.length;

    if (!log.length) {
      document.getElementById('agent-log-list').innerHTML = `
        <div class="placeholder-state">
          <div class="placeholder-icon">✅</div>
          <div class="placeholder-title">NOTHING TO DO</div>
          <div class="placeholder-sub">No actions were needed based on your permissions.</div>
        </div>`;
    } else {
      renderAgentLog(log);
    }

  } catch (err) {
    document.getElementById('agent-running').classList.add('hidden');
    document.getElementById('agent-log-list').innerHTML = `
      <div class="error-state">
        <div class="error-icon">⚠</div>
        <div class="error-msg">${err.message || 'Agent failed. Make sure Gmail permissions are granted.'}</div>
      </div>`;
  } finally {
    btn.disabled    = false;
    btn.textContent = '⚡ RUN AGENT';
  }
}

function renderAgentLog(log) {
  const icons   = { draft_reply: '✍️', archive: '📦', mark_read: '👁', error: '⚠️' };
  const labels  = { draft_reply: 'DRAFTED REPLY', archive: 'ARCHIVED', mark_read: 'MARKED READ', error: 'ERROR' };

  document.getElementById('agent-log-list').innerHTML = log.map(entry => `
    <div class="log-item">
      <div class="log-icon">${icons[entry.action] || '•'}</div>
      <div class="log-body">
        <span class="log-action ${entry.action}">${labels[entry.action] || entry.action}</span>
        <div class="log-subject">${escHtml(entry.subject)}</div>
        <div class="log-reason">${escHtml(entry.reason)}</div>
        ${entry.preview ? `<div class="log-preview">"${escHtml(entry.preview)}..."</div>` : ''}
      </div>
    </div>
  `).join('');
}

// ── Start ──────────────────────────────────────────────────────
init();
