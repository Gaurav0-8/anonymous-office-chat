'use strict';
/* =============================================================
   PROTIVITI PROJECT TRACKER — Main Application
   Standalone vanilla JS SPA. No framework, no backend needed.
   Data persists in localStorage.
   ============================================================= */

// ─── CONSTANTS ────────────────────────────────────────────────
const CATS_KEY  = 'prot_cats_v1';
const REQS_KEY  = 'prot_reqs_v1';
const AUTH_KEY  = 'prot_auth_v1';
const ADMIN_PW  = 'Tracker-Protiviti@123';
const GOOGLE_ID = '925088269180-vt0u3glirlq5k27mr0kau2n14b46t2tv.apps.googleusercontent.com';
const DAY_W     = 30;   // px per Gantt day column

// ─── STATE ────────────────────────────────────────────────────
const S = {
  auth:       null,   // { role:'admin'|'user', user:{name,email,picture?} }
  cats:       [],     // categories with tasks[]
  requests:   [],     // change requests
  adminOpen:  false,
  activeTab:  'tasks', // 'tasks' | 'requests' | 'categories'
  modal:      null,   // { type, data }
};

// ─── DATE HELPERS ─────────────────────────────────────────────
const addDays  = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + +n); return d.toISOString().split('T')[0]; };
const calcDue  = (start, dur) => addDays(start, dur);
const diffDays = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
const today    = () => new Date().toISOString().split('T')[0];
const fmtD     = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'2-digit'}) : '—';
const uid      = () => 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const esc      = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

// ─── STORAGE ──────────────────────────────────────────────────
function boot() {
  const raw = localStorage.getItem(CATS_KEY);
  if (raw) {
    S.cats = JSON.parse(raw);
  } else {
    S.cats = INITIAL_DATA.map(cat => ({
      ...cat,
      tasks: cat.tasks.map(t => ({ ...t, dueDate: calcDue(t.startDate, t.duration) }))
    }));
    saveCats();
  }
  const rRaw = localStorage.getItem(REQS_KEY);
  S.requests = rRaw ? JSON.parse(rRaw) : [];
  const aRaw = localStorage.getItem(AUTH_KEY);
  S.auth = aRaw ? JSON.parse(aRaw) : null;
}
const saveCats = () => localStorage.setItem(CATS_KEY, JSON.stringify(S.cats));
const saveReqs = () => localStorage.setItem(REQS_KEY, JSON.stringify(S.requests));
const saveAuth = () => S.auth ? localStorage.setItem(AUTH_KEY, JSON.stringify(S.auth)) : localStorage.removeItem(AUTH_KEY);

// ─── DATA HELPERS ─────────────────────────────────────────────
const findCat  = id => S.cats.find(c => c.id === id);
const findTask = (catId, taskId) => findCat(catId)?.tasks.find(t => t.id === taskId);
const pendingCount = () => S.requests.filter(r => r.status === 'pending').length;

// ─── ADMIN CRUD ───────────────────────────────────────────────
function updateTask(catId, taskId, patch) {
  const t = findTask(catId, taskId);
  if (!t) return;
  Object.assign(t, patch);
  if ('startDate' in patch || 'duration' in patch) t.dueDate = calcDue(t.startDate, t.duration);
  saveCats(); render();
}

function addTaskTo(catId, data) {
  const cat = findCat(catId);
  if (!cat) return;
  const maxRow = cat.tasks.reduce((m, t) => Math.max(m, t.rowId), 0);
  cat.tasks.push({ id: uid(), rowId: maxRow + 1, dueDate: calcDue(data.startDate, data.duration), ...data });
  saveCats(); render();
}

function removeTask(catId, taskId, skipConfirm) {
  if (!skipConfirm && !confirm('Delete this task?')) return;
  const cat = findCat(catId);
  if (!cat) return;
  cat.tasks = cat.tasks.filter(t => t.id !== taskId);
  cat.tasks.forEach((t, i) => (t.rowId = i + 1));
  saveCats(); render();
}

function addCat(name, color) {
  S.cats.push({ id: uid(), name, color: color || '#6b7280', tasks: [] });
  saveCats(); render();
}
function updateCat(catId, patch) {
  const c = findCat(catId);
  if (c) { Object.assign(c, patch); saveCats(); render(); }
}
function removeCat(catId) {
  if (!confirm('Delete this category and ALL its tasks?')) return;
  S.cats = S.cats.filter(c => c.id !== catId);
  saveCats(); render();
}

// ─── CHANGE REQUESTS ──────────────────────────────────────────
function submitReq(catId, taskId, taskTitle, field, oldVal, newVal) {
  S.requests.push({
    id: uid(), catId, taskId, taskTitle, field,
    oldValue: oldVal, newValue: newVal,
    requestedBy: S.auth.user,
    requestedAt: new Date().toISOString(),
    status: 'pending',
  });
  saveReqs(); render();
  toast('Request submitted — waiting for admin approval', 'success');
}

function approveReq(reqId) {
  const req = S.requests.find(r => r.id === reqId);
  if (!req || req.status !== 'pending') return;
  updateTask(req.catId, req.taskId, { [req.field]: Number(req.newValue) });
  req.status = 'approved';
  saveReqs(); render();
  toast('Request approved ✅', 'success');
}

function rejectReq(reqId) {
  const req = S.requests.find(r => r.id === reqId);
  if (!req) return;
  req.status = 'rejected';
  saveReqs(); render();
  toast('Request rejected', 'info');
}

// ─── AUTH ─────────────────────────────────────────────────────
function loginAdmin(pw) {
  if (pw !== ADMIN_PW) return false;
  S.auth = { role: 'admin', user: { name: 'Admin', email: 'admin@protiviti.com' } };
  saveAuth(); render(); return true;
}
function loginGoogle(credential) {
  try {
    const payload = JSON.parse(atob(credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    S.auth = { role: 'user', user: { name: payload.name, email: payload.email, picture: payload.picture } };
    saveAuth(); render(); return true;
  } catch { return false; }
}
function logout() {
  S.auth = null; S.adminOpen = false; saveAuth(); render();
}

// ─── GANTT CALCULATIONS ───────────────────────────────────────
function dateRange() {
  let min = null, max = null;
  for (const cat of S.cats)
    for (const t of cat.tasks) {
      if (!t.startDate) continue;
      if (!min || t.startDate < min) min = t.startDate;
      const due = t.dueDate || t.startDate;
      if (!max || due > max) max = due;
    }
  if (!min) { const td = today(); return { min: addDays(td, -3), max: addDays(td, 30) }; }
  return { min: addDays(min, -3), max: addDays(max, 7) };
}
function allDays(min, max) {
  const days = [];
  let cur = new Date(min + 'T00:00:00');
  const end = new Date(max + 'T00:00:00');
  while (cur <= end) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
  return days;
}
function byMonth(days) {
  const months = []; let cur = null;
  for (const d of days) {
    const key = d.getFullYear() + '-' + d.getMonth();
    if (!cur || cur.key !== key) { cur = { key, label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), count: 0 }; months.push(cur); }
    cur.count++;
  }
  return months;
}

// ─── STATUS HELPERS ───────────────────────────────────────────
const STATUS_GRAD = {
  'Done':        '#16a34a,#22c55e',
  'Delayed':     '#b91c1c,#ef4444',
  'In Progress': '#1d4ed8,#3b82f6',
  'Blocked':     '#b45309,#f59e0b',
  'Not Started': '#374151,#6b7280',
};
const sGrad  = s => STATUS_GRAD[s] || '#374151,#6b7280';
const sCls   = s => 's-' + (s || 'Not-Started').replace(/\s+/g, '-');

// ─── RENDER: LANDING ──────────────────────────────────────────
function renderLanding() {
  document.getElementById('app').innerHTML = `
<div class="landing fade-in">
  <div class="landing-hero">
    <div class="landing-icon">📊</div>
    <h1>Protiviti Project Tracker</h1>
    <p>Internal Gantt Chart &amp; Task Management System</p>
  </div>

  <div class="landing-cards">
    <!-- ADMIN CARD -->
    <div class="auth-card">
      <div class="auth-card-hdr">
        <div class="auth-icon admin">🔐</div>
        <div>
          <h2>Admin Login</h2>
          <p>Full control: add, edit, delete, approve</p>
        </div>
      </div>
      <div class="fg">
        <label>Admin Password</label>
        <input id="adminPw" type="password" class="inp" placeholder="Enter admin password" autocomplete="off">
      </div>
      <div id="adminErr" style="display:none" class="err-msg"></div>
      <button id="adminLoginBtn" class="btn-prim">🔓 Sign In as Admin</button>
    </div>

    <!-- USER CARD -->
    <div class="auth-card">
      <div class="auth-card-hdr">
        <div class="auth-icon user">👤</div>
        <div>
          <h2>User Login</h2>
          <p>View tracker &amp; submit change requests</p>
        </div>
      </div>
      <p style="color:var(--text-2);font-size:.83rem;line-height:1.7">
        Sign in with your Google account. You can view all tasks and request edits to
        <strong style="color:var(--text)">Duration</strong> and <strong style="color:var(--text)">Progress %</strong>
        — changes go to the admin for approval.
      </p>
      <div id="gsiBtn"></div>
    </div>
  </div>

  <p class="landing-footer">tracker.gauravmathur.in &nbsp;·&nbsp; Protiviti Internal Tool</p>
</div>`;

  // Admin login
  const btn = document.getElementById('adminLoginBtn');
  const inp = document.getElementById('adminPw');
  const err = document.getElementById('adminErr');
  btn.addEventListener('click', () => {
    if (!loginAdmin(inp.value)) {
      err.textContent = 'Incorrect password. Please try again.';
      err.style.display = 'block';
      inp.classList.remove('error-shake');
      void inp.offsetWidth; // reflow
      inp.classList.add('error-shake');
    }
  });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') btn.click(); });

  // Google Sign-In
  waitForGoogle(() => {
    google.accounts.id.initialize({ client_id: GOOGLE_ID, callback: r => loginGoogle(r.credential) });
    google.accounts.id.renderButton(document.getElementById('gsiBtn'),
      { theme: 'outline', size: 'large', type: 'standard', text: 'sign_in_with', width: 260 });
  });
}

function waitForGoogle(cb, tries = 0) {
  if (window.google?.accounts) { cb(); return; }
  if (tries < 20) setTimeout(() => waitForGoogle(cb, tries + 1), 300);
}

// ─── RENDER: HEADER ───────────────────────────────────────────
function renderHeader() {
  const { role, user } = S.auth;
  const pc = pendingCount();
  const av = user.picture
    ? `<img src="${esc(user.picture)}" class="u-avatar" alt="">`
    : `<div class="u-avatar-ph">${esc(user.name[0].toUpperCase())}</div>`;
  return `
<header class="top-header">
  <div class="brand">
    <div class="brand-icon">📊</div>
    <div><div class="brand-name">Protiviti</div><div class="brand-sub">Project Tracker</div></div>
  </div>
  <div class="h-spacer"></div>
  ${role === 'admin' ? `
  <button class="h-btn${S.adminOpen ? ' on' : ''}" id="hdrAdminBtn">
    ⚙️ Admin Panel${pc > 0 ? `<span class="badge">${pc}</span>` : ''}
  </button>` : ''}
  <div class="user-chip">
    ${av}
    <span class="u-name">${esc(user.name)}</span>
    ${role === 'admin' ? '<span class="role-badge">Admin</span>' : ''}
  </div>
  <button class="btn-out" id="hdrLogout">Sign Out</button>
</header>`;
}

// ─── RENDER: GANTT LEFT ───────────────────────────────────────
function renderGanttLeft() {
  const isAdmin = S.auth.role === 'admin';
  let html = `
<div class="g-left" id="gLeft">
<div class="g-col-hdr">
  <div class="c c-id">ID</div>
  <div class="c c-ttl">Task Title</div>
  <div class="c c-own">Owner</div>
  <div class="c c-st">Start</div>
  <div class="c c-due">Due</div>
  <div class="c c-dur">Dur</div>
  <div class="c c-prog">Prog%</div>
  <div class="c c-stat">Status</div>
  ${isAdmin ? '<div class="c c-act">Act</div>' : ''}
</div>`;

  for (const cat of S.cats) {
    html += `
<div class="g-cat-row">
  <span class="cat-lbl" style="background:${cat.color}1a;color:${cat.color}">${esc(cat.name)}</span>
  <span style="flex:1"></span>
  ${isAdmin ? `<div class="cat-acts">
    <button class="icon-btn" onclick="openModal('addTask',{catId:'${cat.id}'})" title="Add task">＋</button>
    <button class="icon-btn edit" onclick="openModal('editCat',{catId:'${cat.id}'})" title="Edit">✏</button>
    <button class="icon-btn del" onclick="removeCat('${cat.id}')" title="Delete">⌫</button>
  </div>` : ''}
</div>`;

    if (!cat.tasks.length) {
      html += `<div class="g-task-row" style="justify-content:center;color:var(--text-3);font-size:.75rem;font-style:italic">No tasks${isAdmin ? ' — click ＋ to add' : ''}</div>`;
    }

    for (const t of cat.tasks) {
      html += `
<div class="g-task-row">
  <div class="c c-id"><span class="row-id">${t.rowId}</span></div>
  <div class="c c-ttl" title="${esc(t.title)}">${esc(t.title)}</div>
  <div class="c c-own" title="${esc(t.owner)}">${esc(t.owner)}</div>
  <div class="c c-st">${fmtD(t.startDate)}</div>
  <div class="c c-due">${fmtD(t.dueDate)}</div>
  <div class="c c-dur">${isAdmin
    ? `<span>${t.duration}d</span>`
    : `<span class="editable-wrap">${t.duration}d<button class="req-btn" title="Request change" onclick="openModal('durReq',{catId:'${cat.id}',taskId:'${t.id}'})">✎</button></span>`}
  </div>
  <div class="c c-prog">${isAdmin
    ? `<span class="prog-val">${t.progress}%</span>`
    : `<span class="editable-wrap"><span class="prog-val">${t.progress}%</span><button class="req-btn" title="Request change" onclick="openModal('progReq',{catId:'${cat.id}',taskId:'${t.id}'})">✎</button></span>`}
  </div>
  <div class="c c-stat"><span class="s-badge ${sCls(t.status)}">${esc(t.status)}</span></div>
  ${isAdmin ? `<div class="c c-act" style="display:flex;gap:2px;justify-content:center">
    <button class="icon-btn edit" onclick="openModal('editTask',{catId:'${cat.id}',taskId:'${t.id}'})" title="Edit">✏</button>
    <button class="icon-btn del"  onclick="removeTask('${cat.id}','${t.id}')" title="Delete">⌫</button>
  </div>` : ''}
</div>`;
    }
  }

  html += '</div>';
  return html;
}

// ─── RENDER: GANTT RIGHT ──────────────────────────────────────
function renderGanttRight() {
  const { min, max } = dateRange();
  const days   = allDays(min, max);
  const months = byMonth(days);
  const td     = today();
  const totalW = days.length * DAY_W;
  const todayX = td >= min && td <= max ? diffDays(min, td) * DAY_W + DAY_W / 2 : -9999;

  const monthHdr = months.map(m =>
    `<div class="g-month-cell" style="width:${m.count * DAY_W}px">${m.label}</div>`).join('');

  const dayHdr = days.map(d => {
    const ds  = d.toISOString().split('T')[0];
    const cls = ds === td ? ' today' : (d.getDay() === 0 || d.getDay() === 6) ? ' wknd' : '';
    return `<div class="g-day-cell${cls}">${d.getDate()}</div>`;
  }).join('');

  let rows = '';
  for (const cat of S.cats) {
    // Category spacer row
    rows += `<div class="g-cat-bar-row" style="width:${totalW}px">
      <div class="today-line" style="left:${todayX}px"></div></div>`;

    if (!cat.tasks.length) {
      rows += `<div class="g-task-bar-row" style="width:${totalW}px">
        <div class="today-line" style="left:${todayX}px"></div></div>`;
    }

    for (const t of cat.tasks) {
      const leftPx  = Math.max(0, diffDays(min, t.startDate)) * DAY_W;
      const widthPx = Math.max(t.duration * DAY_W, 4);
      const progPx  = (t.progress / 100) * widthPx;
      const [c1, c2] = sGrad(t.status).split(',');
      const showLbl  = t.duration >= 2;

      rows += `
<div class="g-task-bar-row" style="width:${totalW}px">
  <div class="today-line" style="left:${todayX}px"></div>
  <div class="g-bar" style="left:${leftPx}px;width:${widthPx}px;background:linear-gradient(90deg,${c1},${c2})"
       title="${esc(t.title)} · ${t.duration}d · ${t.progress}%">
    <div class="g-bar-prog" style="width:${progPx}px"></div>
    ${showLbl ? `<span class="g-bar-lbl">${esc(t.title)}</span>` : ''}
  </div>
</div>`;
    }
  }

  return `
<div class="g-right" id="gRight">
  <div class="g-date-hdr">
    <div class="g-month-row">${monthHdr}</div>
    <div class="g-day-row">${dayHdr}</div>
  </div>
  <div class="g-rows">${rows}</div>
</div>`;
}

// ─── RENDER: ADMIN PANEL ──────────────────────────────────────
function renderAdminPanel() {
  if (!S.adminOpen) return '';

  let body = '';
  if (S.activeTab === 'tasks')      body = tabTasks();
  else if (S.activeTab === 'requests')  body = tabRequests();
  else if (S.activeTab === 'categories') body = tabCategories();

  const pc = pendingCount();
  return `
<div class="overlay" id="panelOverlay"></div>
<div class="admin-panel">
  <div class="panel-hdr">
    <span style="font-size:19px">⚙️</span>
    <span class="panel-title">Admin Panel</span>
    <button class="panel-close" onclick="toggleAdmin()">✕</button>
  </div>
  <div class="panel-tabs">
    <button class="p-tab${S.activeTab==='tasks'?' on':''}"      onclick="setTab('tasks')">📋 Tasks</button>
    <button class="p-tab${S.activeTab==='requests'?' on':''}"   onclick="setTab('requests')">
      🔔 Requests${pc > 0 ? `<span class="badge" style="margin-left:5px">${pc}</span>` : ''}</button>
    <button class="p-tab${S.activeTab==='categories'?' on':''}" onclick="setTab('categories')">🗂 Categories</button>
  </div>
  <div class="panel-body">${body}</div>
</div>`;
}

function tabTasks() {
  const secs = S.cats.map(cat => `
<div class="cat-section">
  <div class="cat-sec-hdr">
    <div class="cat-dot" style="background:${cat.color}"></div>
    <span class="cat-sec-title">${esc(cat.name)}</span>
    <span style="color:var(--text-3);font-size:.72rem">${cat.tasks.length} task${cat.tasks.length!==1?'s':''}</span>
    <button class="btn-add" style="margin-left:8px" onclick="openModal('addTask',{catId:'${cat.id}'})">＋ Add Task</button>
  </div>
  ${cat.tasks.length ? `
  <table class="atbl">
    <thead><tr>
      <th>#</th><th>Title</th><th>Owner</th><th>Start</th><th>Due</th>
      <th>Dur</th><th>Prog%</th><th>Status</th><th></th>
    </tr></thead>
    <tbody>
      ${cat.tasks.map(t => `<tr>
        <td style="color:var(--text-3)">${t.rowId}</td>
        <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(t.title)}">${esc(t.title)}</td>
        <td style="color:var(--text-2);max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.owner)}</td>
        <td>${fmtD(t.startDate)}</td><td>${fmtD(t.dueDate)}</td>
        <td>${t.duration}d</td><td>${t.progress}%</td>
        <td><span class="s-badge ${sCls(t.status)}" style="font-size:.62rem">${esc(t.status)}</span></td>
        <td><div style="display:flex;gap:3px">
          <button class="icon-btn edit" onclick="openModal('editTask',{catId:'${cat.id}',taskId:'${t.id}'})" title="Edit">✏</button>
          <button class="icon-btn del"  onclick="removeTask('${cat.id}','${t.id}')" title="Delete">⌫</button>
        </div></td>
      </tr>`).join('')}
    </tbody>
  </table>` : `<div style="padding:14px;color:var(--text-3);font-size:.78rem;text-align:center">No tasks — click ＋ Add Task</div>`}
</div>`).join('');

  return `<div class="sec-bar"><h3>All Tasks</h3>
    <button class="btn-add" onclick="openModal('addCat',{})">＋ New Category</button></div>${secs}`;
}

function tabRequests() {
  const sorted = [...S.requests].sort((a, b) => {
    const pr = x => x.status === 'pending' ? 0 : 1;
    return pr(a) - pr(b) || new Date(b.requestedAt) - new Date(a.requestedAt);
  });
  if (!sorted.length) return `<div class="empty"><div class="ei">📭</div><h4>No change requests yet</h4>
    <p>When users submit edit requests, they appear here for review.</p></div>`;

  return sorted.map(req => {
    const u  = req.requestedBy;
    const av = u.picture
      ? `<img src="${esc(u.picture)}" class="req-av" alt="">`
      : `<div class="req-av-ph">${esc(u.name[0].toUpperCase())}</div>`;
    const fldLabel = req.field === 'duration' ? 'Duration' : 'Progress';
    const unit     = req.field === 'duration' ? 'd' : '%';
    const time     = new Date(req.requestedAt).toLocaleString('en-IN',
      { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    return `
<div class="req-card ${req.status}">
  <div class="req-user">
    ${av}
    <div><div class="req-nm">${esc(u.name)}</div><div class="req-em">${esc(u.email)}</div></div>
    <div class="ml-auto">
      ${req.status !== 'pending' ? `<span class="res-badge ${req.status}">${req.status}</span>` : ''}
    </div>
  </div>
  <div class="req-det">
    <div class="req-ttl">📌 ${esc(req.taskTitle)}</div>
    <div class="req-chg">
      <span>${fldLabel}:</span>
      <span class="req-old">${req.oldValue}${unit}</span>
      <span>→</span>
      <span class="req-new">${req.newValue}${unit}</span>
    </div>
  </div>
  <div class="req-time">🕐 ${time}</div>
  ${req.status === 'pending' ? `<div class="req-acts">
    <button class="btn-approve" onclick="approveReq('${req.id}')">✅ Approve</button>
    <button class="btn-reject"  onclick="rejectReq('${req.id}')">❌ Reject</button>
  </div>` : ''}
</div>`;
  }).join('');
}

function tabCategories() {
  return `
<div class="sec-bar"><h3>Manage Categories</h3>
  <button class="btn-add" onclick="openModal('addCat',{})">＋ Add Category</button>
</div>
${S.cats.map(cat => `
<div class="cat-mgr-item">
  <div class="cat-clr-preview" style="background:${cat.color}"></div>
  <span class="cat-mgr-name">${esc(cat.name)}</span>
  <span class="cat-mgr-cnt">${cat.tasks.length} task${cat.tasks.length!==1?'s':''}</span>
  <div style="display:flex;gap:3px">
    <button class="icon-btn edit" onclick="openModal('editCat',{catId:'${cat.id}'})" title="Edit">✏</button>
    <button class="icon-btn del"  onclick="removeCat('${cat.id}')" title="Delete">⌫</button>
  </div>
</div>`).join('')}`;
}

// ─── RENDER: MODALS ───────────────────────────────────────────
function renderModal() {
  if (!S.modal) return '';
  const { type, data } = S.modal;
  const wrapModal = (icon, title, body, footer) => `
<div class="modal-overlay" id="modalOverlay">
<div class="modal">
  <div class="modal-hdr">
    <span style="font-size:17px">${icon}</span>
    <span class="modal-title">${title}</span>
    <button class="panel-close" onclick="closeModal()">✕</button>
  </div>
  <div class="modal-body">${body}</div>
  <div class="modal-ftr">${footer}</div>
</div></div>`;

  const STATUS_OPTS = ['Not Started','In Progress','Done','Delayed','Blocked']
    .map(s => `<option value="${s}">${s}</option>`).join('');

  if (type === 'addTask') {
    const catOpts = S.cats.map(c =>
      `<option value="${c.id}"${c.id === data.catId ? ' selected' : ''}>${esc(c.name)}</option>`).join('');
    return wrapModal('➕', 'Add New Task', `
<div class="fg"><label>Category</label><select id="mCat" class="inp">${catOpts}</select></div>
<div class="fg"><label>Task Title *</label><input id="mTitle" class="inp" placeholder="Task title" required></div>
<div class="fg"><label>Task Owner</label><input id="mOwner" class="inp" placeholder="Owner name(s)"></div>
<div class="form-row">
  <div class="fg"><label>Start Date *</label><input id="mStart" type="date" class="inp" value="${today()}"></div>
  <div class="fg"><label>Duration (days) *</label><input id="mDur" type="number" class="inp" value="5" min="1" max="999"></div>
</div>
<div class="form-row">
  <div class="fg"><label>Progress %</label><input id="mProg" type="number" class="inp" value="0" min="0" max="100"></div>
  <div class="fg"><label>Status</label><select id="mStatus" class="inp">${STATUS_OPTS}</select></div>
</div>`,
    `<button class="btn-sec" onclick="closeModal()">Cancel</button>
     <button class="btn-sub" onclick="submitAddTask()">Add Task</button>`);
  }

  if (type === 'editTask') {
    const cat  = findCat(data.catId);
    const task = findTask(data.catId, data.taskId);
    if (!task) return '';
    const catOpts = S.cats.map(c =>
      `<option value="${c.id}"${c.id === data.catId ? ' selected' : ''}>${esc(c.name)}</option>`).join('');
    const stOpts = STATUS_OPTS.replace(`value="${task.status}"`, `value="${task.status}" selected`);
    return wrapModal('✏️', 'Edit Task', `
<div class="fg"><label>Category</label><select id="mCat" class="inp">${catOpts}</select></div>
<div class="fg"><label>Task Title *</label><input id="mTitle" class="inp" value="${esc(task.title)}" required></div>
<div class="fg"><label>Task Owner</label><input id="mOwner" class="inp" value="${esc(task.owner)}"></div>
<div class="form-row">
  <div class="fg"><label>Start Date *</label><input id="mStart" type="date" class="inp" value="${task.startDate}"></div>
  <div class="fg"><label>Duration (days) *</label><input id="mDur" type="number" class="inp" value="${task.duration}" min="1" max="999"></div>
</div>
<div class="form-row">
  <div class="fg"><label>Progress %</label><input id="mProg" type="number" class="inp" value="${task.progress}" min="0" max="100"></div>
  <div class="fg"><label>Status</label><select id="mStatus" class="inp">${stOpts}</select></div>
</div>
<p style="color:var(--text-3);font-size:.72rem">⚡ Due date auto-calculates from Start Date + Duration</p>`,
    `<button class="btn-sec" onclick="closeModal()">Cancel</button>
     <button class="btn-sub" onclick="submitEditTask('${data.catId}','${data.taskId}')">Save Changes</button>`);
  }

  if (type === 'addCat') {
    return wrapModal('🗂', 'Add Category', `
<div class="fg"><label>Category Name *</label><input id="mCatName" class="inp" placeholder="e.g. Backend, QA..."></div>
<div class="fg"><label>Colour</label><input id="mCatColor" type="color" class="inp" value="#5046e4" style="height:44px;padding:4px 8px;cursor:pointer"></div>`,
    `<button class="btn-sec" onclick="closeModal()">Cancel</button>
     <button class="btn-sub" onclick="submitAddCat()">Add Category</button>`);
  }

  if (type === 'editCat') {
    const cat = findCat(data.catId);
    if (!cat) return '';
    return wrapModal('✏️', 'Edit Category', `
<div class="fg"><label>Category Name *</label><input id="mCatName" class="inp" value="${esc(cat.name)}"></div>
<div class="fg"><label>Colour</label><input id="mCatColor" type="color" class="inp" value="${cat.color}" style="height:44px;padding:4px 8px;cursor:pointer"></div>`,
    `<button class="btn-danger" onclick="removeCat('${cat.id}');closeModal()">Delete Category</button>
     <button class="btn-sec" onclick="closeModal()">Cancel</button>
     <button class="btn-sub" onclick="submitEditCat('${data.catId}')">Save</button>`);
  }

  if (type === 'durReq') {
    const task = findTask(data.catId, data.taskId);
    if (!task) return '';
    return wrapModal('📝', 'Request Duration Change', `
<div class="info-box"><div class="lbl">Task</div><div class="val">${esc(task.title)}</div></div>
<div class="form-row">
  <div class="fg"><label>Current Duration</label>
    <input class="inp" value="${task.duration} days" disabled style="opacity:.5"></div>
  <div class="fg"><label>New Duration (days) *</label>
    <input id="mNewDur" type="number" class="inp" value="${task.duration}" min="1" max="999" autofocus></div>
</div>
<p style="color:var(--text-2);font-size:.78rem">⚡ Due date will update automatically once admin approves.</p>`,
    `<button class="btn-sec" onclick="closeModal()">Cancel</button>
     <button class="btn-sub" onclick="submitDurReq('${data.catId}','${data.taskId}')">Submit Request</button>`);
  }

  if (type === 'progReq') {
    const task = findTask(data.catId, data.taskId);
    if (!task) return '';
    return wrapModal('📊', 'Request Progress Update', `
<div class="info-box"><div class="lbl">Task</div><div class="val">${esc(task.title)}</div></div>
<div class="form-row">
  <div class="fg"><label>Current Progress</label>
    <input class="inp" value="${task.progress}%" disabled style="opacity:.5"></div>
  <div class="fg"><label>New Progress (0–100) *</label>
    <input id="mNewProg" type="number" class="inp" value="${task.progress}" min="0" max="100" autofocus></div>
</div>`,
    `<button class="btn-sec" onclick="closeModal()">Cancel</button>
     <button class="btn-sub" onclick="submitProgReq('${data.catId}','${data.taskId}')">Submit Request</button>`);
  }

  return '';
}

// ─── MODAL SUBMISSIONS ────────────────────────────────────────
function submitAddTask() {
  const catId = document.getElementById('mCat').value;
  const title = document.getElementById('mTitle').value.trim();
  const start = document.getElementById('mStart').value;
  const dur   = parseInt(document.getElementById('mDur').value);
  if (!title) { toast('Task title is required', 'error'); return; }
  if (!start) { toast('Start date is required', 'error'); return; }
  if (!dur || dur < 1) { toast('Duration must be ≥ 1', 'error'); return; }
  addTaskTo(catId, {
    title, owner: document.getElementById('mOwner').value.trim(),
    startDate: start, duration: dur,
    progress: parseInt(document.getElementById('mProg').value) || 0,
    status: document.getElementById('mStatus').value,
  });
  closeModal();
  toast('Task added!', 'success');
}

function submitEditTask(oldCatId, taskId) {
  const newCatId = document.getElementById('mCat').value;
  const title    = document.getElementById('mTitle').value.trim();
  const start    = document.getElementById('mStart').value;
  const dur      = parseInt(document.getElementById('mDur').value);
  if (!title) { toast('Task title is required', 'error'); return; }
  if (!start) { toast('Start date is required', 'error'); return; }
  if (!dur || dur < 1) { toast('Duration must be ≥ 1', 'error'); return; }
  const patch = {
    title, owner: document.getElementById('mOwner').value.trim(),
    startDate: start, duration: dur,
    progress: parseInt(document.getElementById('mProg').value) || 0,
    status: document.getElementById('mStatus').value,
  };
  if (newCatId !== oldCatId) {
    // Move: remove from old cat, add to new cat
    const t = findTask(oldCatId, taskId);
    const snapshot = { ...t, ...patch };
    removeTask(oldCatId, taskId, true);
    addTaskTo(newCatId, snapshot);
  } else {
    updateTask(oldCatId, taskId, patch);
  }
  closeModal();
  toast('Task updated!', 'success');
}

function submitAddCat() {
  const name = document.getElementById('mCatName').value.trim();
  if (!name) { toast('Category name is required', 'error'); return; }
  addCat(name, document.getElementById('mCatColor').value);
  closeModal();
  toast('Category added!', 'success');
}

function submitEditCat(catId) {
  const name = document.getElementById('mCatName').value.trim();
  if (!name) { toast('Category name is required', 'error'); return; }
  updateCat(catId, { name, color: document.getElementById('mCatColor').value });
  closeModal();
  toast('Category updated!', 'success');
}

function submitDurReq(catId, taskId) {
  const task   = findTask(catId, taskId);
  const newVal = parseInt(document.getElementById('mNewDur').value);
  if (!newVal || newVal < 1) { toast('Duration must be ≥ 1', 'error'); return; }
  if (newVal === task.duration) { toast('No change detected', 'info'); return; }
  submitReq(catId, taskId, task.title, 'duration', task.duration, newVal);
  closeModal();
}

function submitProgReq(catId, taskId) {
  const task   = findTask(catId, taskId);
  const newVal = parseInt(document.getElementById('mNewProg').value);
  if (isNaN(newVal) || newVal < 0 || newVal > 100) { toast('Progress must be 0–100', 'error'); return; }
  if (newVal === task.progress) { toast('No change detected', 'info'); return; }
  submitReq(catId, taskId, task.title, 'progress', task.progress, newVal);
  closeModal();
}

// ─── UI ACTIONS (called from inline onclick) ──────────────────
function toggleAdmin() { S.adminOpen = !S.adminOpen; render(); }
function setTab(tab)   { S.activeTab = tab; render(); }
function openModal(type, data) { S.modal = { type, data }; render(); }
function closeModal()  { S.modal = null; render(); }

// ─── SCROLL SYNC ──────────────────────────────────────────────
function syncScroll() {
  const L = document.getElementById('gLeft');
  const R = document.getElementById('gRight');
  if (!L || !R) return;
  let busy = false;
  L.addEventListener('scroll', () => { if (!busy) { busy = true; R.scrollTop = L.scrollTop; busy = false; } });
  R.addEventListener('scroll', () => { if (!busy) { busy = true; L.scrollTop = R.scrollTop; busy = false; } });
}

// ─── TOAST ────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const tc = document.getElementById('toastContainer');
  if (!tc) return;
  const el = Object.assign(document.createElement('div'), { className: `toast ${type}`, textContent: msg });
  tc.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; }, 2600);
  setTimeout(() => el.remove(), 3100);
}

// ─── MASTER RENDER ────────────────────────────────────────────
function render() {
  const app = document.getElementById('app');
  if (!S.auth) { renderLanding(); return; }

  app.innerHTML = `
<div class="main-layout fade-in">
  ${renderHeader()}
  <div class="gantt-board">
    ${renderGanttLeft()}
    ${renderGanttRight()}
  </div>
  ${renderAdminPanel()}
  ${renderModal()}
</div>`;

  // Header buttons
  document.getElementById('hdrLogout').addEventListener('click', logout);
  const ab = document.getElementById('hdrAdminBtn');
  if (ab) ab.addEventListener('click', toggleAdmin);

  // Panel overlay click-outside
  const po = document.getElementById('panelOverlay');
  if (po) po.addEventListener('click', toggleAdmin);

  // Modal overlay click-outside
  const mo = document.getElementById('modalOverlay');
  if (mo) mo.addEventListener('click', e => { if (e.target === mo) closeModal(); });

  // Escape key
  document.onkeydown = e => { if (e.key === 'Escape') { if (S.modal) closeModal(); else if (S.adminOpen) toggleAdmin(); } };

  syncScroll();
}

// ─── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  boot();
  render();
});
