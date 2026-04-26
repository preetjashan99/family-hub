/* ============================================================
   BACKEND — Node.js + Express server
   - Stores all family data in a plain JSON file: data.json
   - Exposes a REST API at /api/...
   - Also serves the frontend (../frontend) so you can run
     everything with one command:    node server.js
   ============================================================ */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, 'data.json');
// -------- Telegram Notifications --------
const TELEGRAM_TOKEN = '8714763287:AAGhv_mYzm6S9U_IOZT7GuebPj8JYnDFoDM';
const TELEGRAM_CHAT_ID = '8138319443';

async function sendTelegram(message) {
  try {
    const https = require('https');
    const text = encodeURIComponent(message);
    https.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=${text}`);
  } catch(e) { console.log('Telegram error:', e); }
}

function checkAndNotify() {
  const data = readData();
  const now = new Date();
  data.bills.forEach(b => {
    if (b.paid) return;
    const diff = (new Date(b.due) - now) / 86400000;
    if (diff <= 1 && diff >= 0) sendTelegram(`⚠️ Family Hub: ${b.name} bill $${b.amount} kal due hai!`);
    if (diff < 0) sendTelegram(`🚨 Family Hub: ${b.name} bill OVERDUE hai! $${b.amount}`);
  });
  data.tasks.forEach(t => {
    if (t.done || !t.due) return;
    const diff = (new Date(t.due) - now) / 86400000;
    if (diff <= 1 && diff >= 0) sendTelegram(`📚 Family Hub: Task "${t.title}" kal due hai!`);
  });
  data.grocery.forEach(g => {
    if (g.low && !g.purchased) sendTelegram(`🛒 Family Hub: ${g.name} khatam hon wala hai!`);
  });
}

setInterval(checkAndNotify, 3600000); // har 1 ghante baad check

/* ---------- Middlewares ---------- */
app.use(cors());                                       // allow frontend from anywhere
app.use(express.json());                               // parse JSON bodies
app.use(express.static(path.join(__dirname, '../frontend'))); // serve frontend

/* ---------- Storage helpers ----------
   Data is saved on DISK in data.json so the teacher can OPEN
   that file and SEE exactly what the backend has stored. */
function defaultState() {
  const today = new Date();
  const addDays = n => {
    const d = new Date(today); d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  return {
    budget: 600,
    nextId: 100,
    tasks: [
      { id: 1, title: 'Math chapter 5 practice', subject: 'Mathematics', priority: 'high',   due: addDays(1), done: false },
      { id: 2, title: 'History essay draft',     subject: 'History',     priority: 'medium', due: addDays(3), done: false },
      { id: 3, title: 'Read English novel ch 3', subject: 'English',     priority: 'low',    due: addDays(7), done: false }
    ],
    notes: [
      { id: 1, title: 'Photosynthesis summary', subject: 'Biology',     content: 'Plants convert sunlight + CO2 + water into glucose and oxygen.' },
      { id: 2, title: 'Pythagorean identities', subject: 'Mathematics', content: 'sin²+cos²=1; 1+tan²=sec²; 1+cot²=csc².' }
    ],
    grocery: [
      { id: 1, name: 'Milk',        qty: 2, unit: 'gallon', cat: 'dairy',   price: 4.50, purchased: false, low: true  },
      { id: 2, name: 'Eggs',        qty: 1, unit: 'dozen',  cat: 'dairy',   price: 3.99, purchased: true,  low: false },
      { id: 3, name: 'Bread',       qty: 2, unit: 'loaf',   cat: 'bakery',  price: 2.75, purchased: false, low: false },
      { id: 4, name: 'Bananas',     qty: 6, unit: 'pcs',    cat: 'produce', price: 0.30, purchased: true,  low: false },
      { id: 5, name: 'Cooking oil', qty: 1, unit: 'bottle', cat: 'pantry',  price: 8.50, purchased: false, low: true  },
      { id: 6, name: 'Rice',        qty: 1, unit: 'bag',    cat: 'pantry',  price: 12.00,purchased: true,  low: false }
    ],
    bills: [
      { id: 1, name: 'Electricity',   amount: 145.00, cat: 'utility',   due: addDays(2),   paid: false, recurring: true },
      { id: 2, name: 'Internet',      amount: 65.00,  cat: 'utility',   due: addDays(5),   paid: false, recurring: true },
      { id: 3, name: 'Water',         amount: 38.50,  cat: 'utility',   due: addDays(-2),  paid: false, recurring: true },
      { id: 4, name: 'Car insurance', amount: 220.00, cat: 'insurance', due: addDays(12),  paid: false, recurring: true },
      { id: 5, name: 'Gas',           amount: 72.30,  cat: 'utility',   due: addDays(-15), paid: true,  recurring: true }
    ],
    events: [
      { id: 1, title: 'Parent-teacher meeting', start: addDays(1) + 'T17:00', member: 'family',  desc: 'School meeting' },
      { id: 2, title: 'Soccer practice',         start: addDays(2) + 'T16:00', member: 'student', desc: 'Bring water bottle' },
      { id: 3, title: 'Grocery shopping',        start: addDays(3) + 'T10:00', member: 'mother',  desc: 'Weekly run' },
      { id: 4, title: 'Bill review',             start: addDays(4) + 'T19:00', member: 'father',  desc: 'Sort out monthly bills' },
      { id: 5, title: 'Family movie night',      start: addDays(6) + 'T20:00', member: 'family',  desc: 'Pick something everyone likes' }
    ]
  };
}

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const seed = defaultState();
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
    return seed;
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}
function nextId(data) {
  data.nextId = (data.nextId || 100) + 1;
  return data.nextId;
}

/* ---------- API ROUTES ---------- */

// Health check
app.get('/api/healthz', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Get the entire state
app.get('/api/state', (req, res) => res.json(loadData()));

// ---- TASKS ----
app.post('/api/tasks', (req, res) => {
  const data = loadData();
  const t = { id: nextId(data), done: false, ...req.body };
  data.tasks.push(t); saveData(data);
  res.status(201).json(t);
});
app.patch('/api/tasks/:id', (req, res) => {
  const data = loadData();
  const t = data.tasks.find(x => x.id === +req.params.id);
  if (!t) return res.status(404).json({ error: 'not found' });
  Object.assign(t, req.body); saveData(data); res.json(t);
});
app.delete('/api/tasks/:id', (req, res) => {
  const data = loadData();
  data.tasks = data.tasks.filter(x => x.id !== +req.params.id);
  saveData(data); res.status(204).end();
});

// ---- NOTES ----
app.post('/api/notes', (req, res) => {
  const data = loadData();
  const n = { id: nextId(data), ...req.body };
  data.notes.push(n); saveData(data);
  res.status(201).json(n);
});
app.delete('/api/notes/:id', (req, res) => {
  const data = loadData();
  data.notes = data.notes.filter(x => x.id !== +req.params.id);
  saveData(data); res.status(204).end();
});

// ---- GROCERY ----
app.post('/api/grocery', (req, res) => {
  const data = loadData();
  const g = { id: nextId(data), purchased: false, low: false, ...req.body };
  data.grocery.push(g); saveData(data);
  res.status(201).json(g);
});
app.patch('/api/grocery/:id', (req, res) => {
  const data = loadData();
  const g = data.grocery.find(x => x.id === +req.params.id);
  if (!g) return res.status(404).json({ error: 'not found' });
  Object.assign(g, req.body); saveData(data); res.json(g);
});
app.delete('/api/grocery/:id', (req, res) => {
  const data = loadData();
  data.grocery = data.grocery.filter(x => x.id !== +req.params.id);
  saveData(data); res.status(204).end();
});

// ---- BILLS ----
app.post('/api/bills', (req, res) => {
  const data = loadData();
  const b = { id: nextId(data), paid: false, recurring: false, ...req.body };
  data.bills.push(b); saveData(data);
  res.status(201).json(b);
});
app.patch('/api/bills/:id', (req, res) => {
  const data = loadData();
  const b = data.bills.find(x => x.id === +req.params.id);
  if (!b) return res.status(404).json({ error: 'not found' });
  Object.assign(b, req.body); saveData(data); res.json(b);
});
app.delete('/api/bills/:id', (req, res) => {
  const data = loadData();
  data.bills = data.bills.filter(x => x.id !== +req.params.id);
  saveData(data); res.status(204).end();
});

// ---- EVENTS ----
app.post('/api/events', (req, res) => {
  const data = loadData();
  const e = { id: nextId(data), ...req.body };
  data.events.push(e); saveData(data);
  res.status(201).json(e);
});
app.delete('/api/events/:id', (req, res) => {
  const data = loadData();
  data.events = data.events.filter(x => x.id !== +req.params.id);
  saveData(data); res.status(204).end();
});

// ---- BUDGET ----
app.put('/api/budget', (req, res) => {
  const data = loadData();
  data.budget = +req.body.amount || data.budget;
  saveData(data);
  res.json({ budget: data.budget });
});

/* ---------- Start server ---------- */
app.listen(PORT, '0.0.0.0', () => {
  console.log('===========================================');
  console.log('   Family Hub backend is running');
  console.log('   API:      http://localhost:' + PORT + '/api');
  console.log('   Frontend: http://localhost:' + PORT + '/');
  console.log('   Storage:  ' + DATA_FILE);
  console.log('===========================================');
});
