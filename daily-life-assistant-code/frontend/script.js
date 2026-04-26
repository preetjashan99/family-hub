/* ============================================================
   FRONTEND — talks to backend (Node.js + Express) over HTTP.
   Backend stores everything in: backend/data.json
   ============================================================ */

const API_BASE = (location.port === '5500' || location.protocol === 'file:')
  ? 'http://localhost:3000/api'   // open frontend separately, backend on port 3000
  : '/api';                        // when backend serves the frontend itself

document.getElementById('api-url').textContent = API_BASE;

let state = {
  budget: 600,
  tasks: [], notes: [], grocery: [], bills: [], events: []
};
let lastNotificationKeys = new Set();

/* ---------- API helpers ---------- */
async function api(path, options = {}) {
  const opts = { headers: { 'Content-Type': 'application/json' }, ...options };
  if (opts.body && typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body);
  const res = await fetch(API_BASE + path, opts);
  if (!res.ok) throw new Error('API error: ' + res.status);
  return res.status === 204 ? null : res.json();
}

async function loadAll() {
  try {
    const data = await api('/state');
    state = data;
    setStatus(true);
    renderAll();
  } catch (e) {
    setStatus(false);
    console.error('Load failed', e);
  }
}

function setStatus(online) {
  const el = document.getElementById('conn-status');
  el.textContent = online ? '● Connected' : '● Offline';
  el.className = 'conn-status ' + (online ? 'online' : 'offline');
}

/* ---------- Tab navigation ---------- */
document.querySelectorAll('.tabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('page-' + btn.dataset.page).classList.add('active');
  });
});

/* ---------- Phone notifications ---------- */
const notifBtn = document.getElementById('enable-notif');
function updateNotifBtn() {
  if (!('Notification' in window)) {
    notifBtn.textContent = '🔕 Not supported';
    notifBtn.disabled = true;
    return;
  }
  if (Notification.permission === 'granted') {
    notifBtn.textContent = '🔔 Alerts ON';
    notifBtn.classList.add('enabled');
  } else if (Notification.permission === 'denied') {
    notifBtn.textContent = '🔕 Alerts blocked';
  } else {
    notifBtn.textContent = '🔔 Enable Alerts';
  }
}
notifBtn.addEventListener('click', async () => {
  if (!('Notification' in window)) return alert('This browser does not support notifications');
  const perm = await Notification.requestPermission();
  updateNotifBtn();
  if (perm === 'granted') {
    new Notification('Family Hub', { body: 'Alerts are now ON. You will get notified on this device.' });
  }
});
updateNotifBtn();

function pushPhoneNotification(title, body, key) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (lastNotificationKeys.has(key)) return;
  lastNotificationKeys.add(key);
  try {
    new Notification(title, { body, icon: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="%23f59e0b"/><text x="50%25" y="56%25" text-anchor="middle" fill="white" font-size="34" font-family="Arial" font-weight="bold">F</text></svg>' });
  } catch (e) { console.warn(e); }
  // vibrate on mobile if supported
  if ('vibrate' in navigator) navigator.vibrate([200, 80, 200]);
}

/* ---------- Render: dashboard ---------- */
function renderDashboard() {
  const pendingTasks = state.tasks.filter(t => !t.done).length;
  const groceryToBuy = state.grocery.filter(g => !g.purchased).length;
  const lowStock     = state.grocery.filter(g => g.low && !g.purchased).length;
  const now = new Date();
  const inWeek = new Date(); inWeek.setDate(inWeek.getDate() + 7);
  const billsWeek = state.bills.filter(b => !b.paid && new Date(b.due) >= now && new Date(b.due) <= inWeek).length;
  const eventsWeek = state.events.filter(e => new Date(e.start) >= now && new Date(e.start) <= inWeek).length;

  document.getElementById('stat-tasks').textContent = pendingTasks;
  document.getElementById('stat-grocery').textContent = groceryToBuy;
  document.getElementById('stat-bills').textContent = billsWeek;
  document.getElementById('stat-events').textContent = eventsWeek;
  document.getElementById('stat-grocery-hint').textContent = lowStock + ' low-stock';

  const spent = state.grocery.filter(g => g.purchased).reduce((s, g) => s + g.price * g.qty, 0);
  const overdue = state.bills.filter(b => !b.paid && new Date(b.due) < now);
  const lowItems = state.grocery.filter(g => g.low && !g.purchased);
  const ins = [];

  if (spent > state.budget * 0.8) {
    ins.push({ tone: 'alert', title: 'Ghar da kharcha zyada ho reha',
      msg: 'You\'ve spent $' + spent.toFixed(2) + ' of your $' + state.budget.toFixed(2) + ' monthly budget — over 80%.' });
  } else if (spent < state.budget * 0.3) {
    ins.push({ tone: 'good', title: 'You\'re under budget',
      msg: 'Only $' + spent.toFixed(2) + ' spent so far — within your $' + state.budget.toFixed(2) + ' budget.' });
  }
  if (lowItems.length > 0) {
    ins.push({ tone: 'alert', title: lowItems[0].name + ' khatam hon wala hai',
      msg: lowItems.length === 1
        ? lowItems[0].name + ' is running low. Add it to your shopping list.'
        : lowItems.length + ' items running low: ' + lowItems.map(i => i.name).join(', ') + '.' });
  }
  if (overdue.length > 0) {
    ins.push({ tone: 'alert', title: 'Overdue bills',
      msg: overdue.length + ' bill' + (overdue.length > 1 ? 's are' : ' is') + ' past due. Pay them to avoid late fees.' });
  }
  const dueSoonTasks = state.tasks.filter(t => !t.done && t.due && new Date(t.due) <= new Date(now.getTime() + 2*86400000) && new Date(t.due) >= now);
  if (dueSoonTasks.length > 0) {
    ins.push({ tone: 'neutral', title: 'Study deadlines approaching',
      msg: dueSoonTasks.length + ' task' + (dueSoonTasks.length > 1 ? 's are' : ' is') + ' due in the next 48 hours.' });
  }
  if (ins.length === 0) ins.push({ tone: 'good', title: 'Everything looks calm', msg: 'No alerts right now. Enjoy the breathing room.' });

  document.getElementById('insights').innerHTML = ins.map(i =>
    '<div class="insight ' + i.tone + '"><strong>' + escapeHtml(i.title) + '</strong><span>' + escapeHtml(i.msg) + '</span></div>'
  ).join('');
}

/* ---------- Render: student ---------- */
function renderTasks() {
  const list = document.getElementById('task-list');
  if (!state.tasks.length) { list.innerHTML = empty('No tasks yet'); return; }
  list.innerHTML = state.tasks.map(t => `
    <li class="${t.done ? 'done' : ''}">
      <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleTask(${t.id})" />
      <div class="item-text">
        <strong>${escapeHtml(t.title)}</strong>
        <div class="item-meta">${escapeHtml(t.subject)}${t.due ? ' • due ' + t.due : ''}</div>
      </div>
      <span class="badge ${t.priority}">${t.priority}</span>
      <button class="delete" onclick="del('tasks', ${t.id})" title="Delete">×</button>
    </li>`).join('');
}
function renderNotes() {
  const list = document.getElementById('note-list');
  if (!state.notes.length) { list.innerHTML = empty('No notes saved yet'); return; }
  list.innerHTML = state.notes.map(n => `
    <li>
      <div class="item-text">
        <strong>${escapeHtml(n.title)}</strong>
        <div class="item-meta">${escapeHtml(n.subject)}</div>
        <div style="margin-top:6px;font-size:14px">${escapeHtml(n.content)}</div>
      </div>
      <button class="delete" onclick="del('notes', ${n.id})" title="Delete">×</button>
    </li>`).join('');
}

/* ---------- Render: mother ---------- */
function renderGrocery() {
  document.getElementById('grocery-count').textContent = state.grocery.filter(g => !g.purchased).length;
  document.getElementById('grocery-low').textContent   = state.grocery.filter(g => g.low && !g.purchased).length;
  const spent = state.grocery.filter(g => g.purchased).reduce((s, g) => s + g.price * g.qty, 0);
  const remaining = Math.max(0, state.budget - spent);
  document.getElementById('budget-total').textContent = state.budget.toFixed(2);
  document.getElementById('budget-spent').textContent = spent.toFixed(2);
  document.getElementById('budget-remaining').textContent = remaining.toFixed(2);
  document.getElementById('budget-progress').style.width = Math.min(100, (spent / state.budget) * 100) + '%';

  const list = document.getElementById('grocery-list');
  if (!state.grocery.length) { list.innerHTML = empty('Empty list'); return; }
  list.innerHTML = state.grocery.map(g => `
    <li class="${g.purchased ? 'done' : ''}">
      <input type="checkbox" ${g.purchased ? 'checked' : ''} onchange="toggleGrocery(${g.id})" />
      <div class="item-text">
        <strong>${escapeHtml(g.name)}</strong>
        <div class="item-meta">${g.qty} ${escapeHtml(g.unit)} • ${escapeHtml(g.cat)} • $${(g.price * g.qty).toFixed(2)}</div>
      </div>
      ${g.low ? '<span class="badge high">Low</span>' : ''}
      <button class="delete" onclick="del('grocery', ${g.id})" title="Delete">×</button>
    </li>`).join('');
}

/* ---------- Render: father ---------- */
function renderBills() {
  const now = new Date();
  const inWeek = new Date(); inWeek.setDate(inWeek.getDate() + 7);
  const due = state.bills.filter(b => !b.paid).reduce((s, b) => s + b.amount, 0);
  const week = state.bills.filter(b => !b.paid && new Date(b.due) >= now && new Date(b.due) <= inWeek).length;
  const overdue = state.bills.filter(b => !b.paid && new Date(b.due) < now).length;
  document.getElementById('bills-due-total').textContent = due.toFixed(2);
  document.getElementById('bills-week').textContent = week;
  document.getElementById('bills-overdue').textContent = overdue;

  const list = document.getElementById('bill-list');
  if (!state.bills.length) { list.innerHTML = empty('No bills tracked'); return; }
  list.innerHTML = state.bills.map(b => {
    const overdueFlag = !b.paid && new Date(b.due) < now;
    const status = b.paid ? '<span class="badge paid">Paid</span>' :
                   overdueFlag ? '<span class="badge overdue">Overdue</span>' :
                   '<span class="badge due">Due</span>';
    return `
    <li class="${b.paid ? 'done' : ''}">
      <input type="checkbox" ${b.paid ? 'checked' : ''} onchange="togglePaid(${b.id})" />
      <div class="item-text">
        <strong>${escapeHtml(b.name)}</strong> — $${b.amount.toFixed(2)}
        <div class="item-meta">${escapeHtml(b.cat)} • due ${b.due}${b.recurring ? ' • recurring' : ''}</div>
      </div>
      ${status}
      <button class="delete" onclick="del('bills', ${b.id})" title="Delete">×</button>
    </li>`;
  }).join('');
}

/* ---------- Render: calendar ---------- */
const memberColors = { family:'var(--amber)', student:'var(--sage)', mother:'var(--rose)', father:'var(--blue)' };
const memberBg     = { family:'#fff7e6', student:'#ecf3ee', mother:'#fce8eb', father:'#e7eef7' };
function renderEvents() {
  const list = document.getElementById('event-list');
  const sorted = [...state.events].sort((a, b) => new Date(a.start) - new Date(b.start));
  if (!sorted.length) { list.innerHTML = '<div style="color:var(--muted)">No events scheduled.</div>'; return; }
  list.innerHTML = sorted.map(e => {
    const d = new Date(e.start);
    return `
    <div class="calendar-event" style="border-left-color:${memberColors[e.member]||'var(--amber)'};background:${memberBg[e.member]||'#fff7e6'}">
      <div>
        <strong>${escapeHtml(e.title)}</strong>
        ${e.desc ? '<div class="item-meta">' + escapeHtml(e.desc) + '</div>' : ''}
        <div class="event-time">${d.toLocaleString([], { weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })} • ${e.member}</div>
      </div>
      <button class="delete" onclick="del('events', ${e.id})" title="Delete">×</button>
    </div>`;
  }).join('');
}

/* ---------- Render: notifications ---------- */
function renderNotifications() {
  const now = new Date();
  const notes = [];
  for (const b of state.bills) {
    if (b.paid) continue;
    const diff = (new Date(b.due) - now) / 86400000;
    if (diff < 0)        notes.push({ tone:'alert',   key:'bill-over-' + b.id, title:'Overdue: ' + b.name, msg:'$' + b.amount.toFixed(2) + ' was due ' + Math.ceil(-diff) + ' day(s) ago.' });
    else if (diff <= 7)  notes.push({ tone: diff <= 2 ? 'alert' : 'neutral', key:'bill-soon-' + b.id, title: b.name + ' due soon', msg:'$' + b.amount.toFixed(2) + ' due in ' + Math.ceil(diff) + ' day(s).' });
  }
  for (const g of state.grocery) {
    if (g.low && !g.purchased) notes.push({ tone:'alert', key:'low-' + g.id, title: g.name + ' running low', msg:'Time to restock ' + g.name + '.' });
  }
  for (const t of state.tasks) {
    if (t.done || !t.due) continue;
    const diff = (new Date(t.due) - now) / 86400000;
    if (diff < 0)       notes.push({ tone:'alert',  key:'task-over-' + t.id, title:'Overdue task: ' + t.title, msg: t.subject + ' task is past due.' });
    else if (diff <= 2) notes.push({ tone:'neutral', key:'task-soon-' + t.id, title: t.title + ' due soon', msg:'Due in ' + Math.ceil(diff*24) + ' hours.' });
  }
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
  for (const e of state.events) {
    const d = new Date(e.start);
    if (d >= today && d < tomorrow) notes.push({ tone:'good', key:'ev-' + e.id, title:'Today: ' + e.title, msg: d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) + ' — ' + (e.desc || 'Family event') });
  }

  const list = document.getElementById('notification-list');
  if (!notes.length) { list.innerHTML = '<div style="color:var(--muted)">No notifications right now. Everything looks calm.</div>'; return; }
  list.innerHTML = notes.map(n =>
    '<div class="insight ' + n.tone + '"><strong>' + escapeHtml(n.title) + '</strong><span>' + escapeHtml(n.msg) + '</span></div>'
  ).join('');

  // Push to phone (only new ones)
  notes.filter(n => n.tone === 'alert').forEach(n => pushPhoneNotification(n.title, n.msg, n.key));
}

/* ---------- Mutations ---------- */
window.del = async (type, id) => { await api('/' + type + '/' + id, { method: 'DELETE' }); loadAll(); };
window.toggleTask = async id => {
  const t = state.tasks.find(x => x.id === id);
  await api('/tasks/' + id, { method: 'PATCH', body: { done: !t.done } });
  loadAll();
};
window.toggleGrocery = async id => {
  const g = state.grocery.find(x => x.id === id);
  await api('/grocery/' + id, { method: 'PATCH', body: { purchased: !g.purchased } });
  loadAll();
};
window.togglePaid = async id => {
  const b = state.bills.find(x => x.id === id);
  await api('/bills/' + id, { method: 'PATCH', body: { paid: !b.paid } });
  loadAll();
};

document.getElementById('add-task').addEventListener('click', async () => {
  const title = val('task-title');
  if (!title) return alert('Please enter a task title');
  await api('/tasks', { method: 'POST', body: {
    title, subject: val('task-subject') || 'General',
    priority: val('task-priority'), due: val('task-due')
  }});
  ['task-title','task-subject','task-due'].forEach(clear);
  loadAll();
});

document.getElementById('add-note').addEventListener('click', async () => {
  const title = val('note-title');
  const content = val('note-content');
  if (!title || !content) return alert('Please enter title and content');
  await api('/notes', { method: 'POST', body: {
    title, subject: val('note-subject') || 'General', content
  }});
  ['note-title','note-subject','note-content'].forEach(clear);
  loadAll();
});

document.getElementById('add-grocery').addEventListener('click', async () => {
  const name = val('g-name');
  if (!name) return alert('Please enter an item name');
  await api('/grocery', { method: 'POST', body: {
    name,
    qty: parseInt(val('g-qty')) || 1,
    unit: val('g-unit') || 'pcs',
    cat: val('g-cat') || 'other',
    price: parseFloat(val('g-price')) || 0,
    low: document.getElementById('g-low').checked,
    purchased: false
  }});
  ['g-name','g-qty','g-unit','g-cat','g-price'].forEach(clear);
  document.getElementById('g-qty').value = '1';
  document.getElementById('g-low').checked = false;
  loadAll();
});

document.getElementById('set-budget').addEventListener('click', async () => {
  const v = parseFloat(val('budget-input'));
  if (!v || v <= 0) return alert('Enter a valid budget');
  await api('/budget', { method: 'PUT', body: { amount: v } });
  clear('budget-input');
  loadAll();
});

document.getElementById('add-bill').addEventListener('click', async () => {
  const name = val('b-name');
  const amount = parseFloat(val('b-amount'));
  const due = val('b-due');
  if (!name || !amount || !due) return alert('Please fill all bill fields');
  await api('/bills', { method: 'POST', body: {
    name, amount,
    cat: val('b-cat') || 'other',
    due,
    recurring: document.getElementById('b-rec').checked,
    paid: false
  }});
  ['b-name','b-amount','b-cat','b-due'].forEach(clear);
  document.getElementById('b-rec').checked = false;
  loadAll();
});

document.getElementById('add-event').addEventListener('click', async () => {
  const title = val('ev-title');
  const start = val('ev-start');
  if (!title || !start) return alert('Please fill title and start time');
  await api('/events', { method: 'POST', body: {
    title, start,
    member: val('ev-member'),
    desc: val('ev-desc')
  }});
  ['ev-title','ev-start','ev-desc'].forEach(clear);
  loadAll();
});

/* ---------- Utilities ---------- */
function val(id) { return document.getElementById(id).value.trim(); }
function clear(id) { document.getElementById(id).value = ''; }
function empty(msg) { return '<li><span class="item-text" style="color:var(--muted)">' + msg + '</span></li>'; }
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function renderAll() {
  renderDashboard(); renderTasks(); renderNotes();
  renderGrocery(); renderBills(); renderEvents(); renderNotifications();
}

/* ---------- Initial load + periodic refresh ---------- */
loadAll();
setInterval(loadAll, 15000);  // refresh every 15s so multi-device stays in sync
