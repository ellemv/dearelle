/**
 * My Diary — GitHub Pages Edition
 * Storage: localStorage (no database, no server)
 * Entries are stored as JSON in localStorage under key "diary_entries"
 */

const STORAGE_KEY = 'diary_entries';
let entries = [];
let currentId = null;
let editingId = null;

// ─── INIT ────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  loadEntries();
  renderList();
  showPanel('welcome');

  // Word count live update
  document.getElementById('editor-body').addEventListener('input', updateWordCount);

  // Default date to today when opening editor
  setTodayDate();
});

// ─── STORAGE ─────────────────────────────────────────────
function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    entries = raw ? JSON.parse(raw) : [];
  } catch {
    entries = [];
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// ─── RENDER LIST ─────────────────────────────────────────
function renderList() {
  const list = document.getElementById('entry-list');
  const q = document.getElementById('search').value.toLowerCase().trim();

  let filtered = entries.slice().sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id);

  if (q) {
    filtered = filtered.filter(e =>
      e.title.toLowerCase().includes(q) ||
      e.body.toLowerCase().includes(q) ||
      (e.mood || '').toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-list">${q ? 'No results found.' : 'No entries yet.\nClick "+ New Entry" to begin.'}</div>`;
    return;
  }

  list.innerHTML = filtered.map(e => `
    <div class="entry-item ${e.id === currentId ? 'active' : ''}" onclick="viewEntry(${e.id})">
      <div class="entry-item-title">${escHtml(e.title || 'Untitled')}</div>
      <div class="entry-item-date">${formatDate(e.date)}</div>
      <div class="entry-item-preview">${escHtml(plainText(e.body).slice(0, 60))}</div>
    </div>
  `).join('');
}

// ─── VIEW ENTRY ──────────────────────────────────────────
function viewEntry(id) {
  const entry = entries.find(e => e.id === id);
  if (!entry) return;
  currentId = id;
  editingId = null;

  document.getElementById('view-title').textContent = entry.title || 'Untitled';
  document.getElementById('view-date').textContent = formatDate(entry.date);
  const moodEl = document.getElementById('view-mood');
  if (entry.mood) {
    moodEl.textContent = entry.mood;
    moodEl.style.display = 'inline';
  } else {
    moodEl.style.display = 'none';
  }

  document.getElementById('view-body').innerHTML = marked.parse(entry.body || '');

  showPanel('viewer-panel');
  renderList();
  closeSidebar();
}

// ─── EDITOR ──────────────────────────────────────────────
function openEditor(id = null) {
  editingId = id;
  const entry = id ? entries.find(e => e.id === id) : null;

  document.getElementById('editor-title').value = entry ? entry.title : '';
  document.getElementById('editor-date').value  = entry ? entry.date  : todayISO();
  document.getElementById('editor-mood').value  = entry ? (entry.mood || '') : '';
  document.getElementById('editor-body').value  = entry ? entry.body  : '';

  updateWordCount();
  showPanel('editor-panel');
  document.getElementById('editor-title').focus();
  closeSidebar();
}

function editCurrent() {
  if (currentId) openEditor(currentId);
}

function cancelEdit() {
  if (currentId) {
    viewEntry(currentId);
  } else {
    showPanel('welcome');
  }
}

function saveEntry() {
  const title = document.getElementById('editor-title').value.trim();
  const date  = document.getElementById('editor-date').value || todayISO();
  const mood  = document.getElementById('editor-mood').value.trim();
  const body  = document.getElementById('editor-body').value.trim();

  if (!title && !body) {
    toast('Write something first ✦');
    return;
  }

  if (editingId) {
    const idx = entries.findIndex(e => e.id === editingId);
    if (idx !== -1) {
      entries[idx] = { ...entries[idx], title, date, mood, body, updatedAt: Date.now() };
      currentId = editingId;
    }
  } else {
    const newEntry = {
      id: Date.now(),
      title: title || 'Untitled',
      date,
      mood,
      body,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    entries.push(newEntry);
    currentId = newEntry.id;
  }

  editingId = null;
  saveEntries();
  renderList();
  viewEntry(currentId);
  toast('Entry saved ✦');
}

// ─── DELETE ──────────────────────────────────────────────
function deleteConfirm() {
  const entry = entries.find(e => e.id === currentId);
  if (!entry) return;
  document.getElementById('modal-text').textContent =
    `Delete "${entry.title || 'Untitled'}"? This cannot be undone.`;
  document.getElementById('modal-confirm').onclick = deleteEntry;
  document.getElementById('modal-overlay').classList.add('open');
}

function deleteEntry() {
  entries = entries.filter(e => e.id !== currentId);
  currentId = null;
  saveEntries();
  renderList();
  closeModal();
  showPanel('welcome');
  toast('Entry deleted');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

// ─── EXPORT / IMPORT ─────────────────────────────────────
function exportAll() {
  if (entries.length === 0) { toast('No entries to export'); return; }
  const data = JSON.stringify(entries, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `diary-backup-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Backup downloaded ✦');
}

function importAll(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) throw new Error('Invalid format');
      // Merge: avoid duplicate IDs
      const existingIds = new Set(entries.map(x => x.id));
      const newOnes = imported.filter(x => !existingIds.has(x.id));
      entries = [...entries, ...newOnes];
      saveEntries();
      renderList();
      toast(`Imported ${newOnes.length} entries ✦`);
    } catch {
      toast('Import failed — invalid file');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

// ─── PANELS ──────────────────────────────────────────────
function showPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ─── SIDEBAR (mobile) ────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
}

// ─── HELPERS ─────────────────────────────────────────────
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function setTodayDate() {
  const el = document.getElementById('editor-date');
  if (el && !el.value) el.value = todayISO();
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    });
  } catch { return iso; }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function plainText(md) {
  return (md || '').replace(/[#*`>_\[\]()!~]/g, '').replace(/\s+/g, ' ').trim();
}

function updateWordCount() {
  const body = document.getElementById('editor-body').value;
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  document.getElementById('char-count').textContent = `${words} word${words !== 1 ? 's' : ''}`;
}

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}a
