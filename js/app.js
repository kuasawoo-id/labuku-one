/* ============================================================
   LABUKU One v2 — js/app.js · by Ahzani Labs
   Frontend GitHub Pages → backend GAS lewat fetch() (lihat js/config.js)
   SPA instan: 1x bootstrap → semua halaman dirender lokal,
   cache localStorage (stale-while-revalidate), optimistic UI,
   kompres foto di browser, foto hanya disimpan di dalam PDF.
   ============================================================ */
'use strict';

// ── 1. Util dasar ────────────────────────────────────────────
// Alamat backend diambil dari js/config.js (const GAS_URL)
const API_URL = String(typeof GAS_URL !== 'undefined' ? GAS_URL : '').trim();
const BOOT = {};
const NS = 'l1_' + (function (s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); })(API_URL) + '_';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { const n = Number(v); return isFinite(n) ? n : 0; };
const nowIso = () => new Date().toISOString();
const isWide = () => window.matchMedia('(min-width:768px)').matches;

const store = {
  get(k, d = null) { try { const v = localStorage.getItem(NS + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(NS + k); } catch (e) {} }
};

const MEM = {};
const IDB = {
  _db: null,
  open() {
    if (!this._db) this._db = new Promise((res, rej) => {
      try {
        const r = indexedDB.open('labuku1', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('foto');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      } catch (e) { rej(e); }
    });
    return this._db;
  },
  async get(k) {
    if (MEM[k]) return MEM[k];
    try {
      const db = await this.open();
      return await new Promise(res => {
        const q = db.transaction('foto').objectStore('foto').get(NS + k);
        q.onsuccess = () => res(q.result || null);
        q.onerror = () => res(null);
      });
    } catch (e) { return null; }
  },
  async set(k, v) { MEM[k] = v; try { const db = await this.open(); db.transaction('foto', 'readwrite').objectStore('foto').put(v, NS + k); } catch (e) {} },
  async del(k) { delete MEM[k]; try { const db = await this.open(); db.transaction('foto', 'readwrite').objectStore('foto').delete(NS + k); } catch (e) {} }
};

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BLN = BULAN.map(b => b.slice(0, 3));
function tgl(s, short) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s ? String(s) : '-';
  return (+m[3]) + ' ' + (short ? BLN : BULAN)[+m[2] - 1] + ' ' + m[1];
}
function waktuLog(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso || '-';
  return d.getDate() + ' ' + BLN[d.getMonth()] + ' ' + d.getFullYear() + ' · ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
function today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function twOf(s) { const m = String(s || '').match(/^\d{4}-(\d{2})/); return m ? String(Math.ceil(+m[1] / 3)) : '1'; }
function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
}
function initials(n) { const p = String(n || '?').split(',')[0].replace(/[^A-Za-z\s]/g, ' ').trim().split(/\s+/); return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
function firstName(n) { const s = String(n || '').split(',')[0].trim().split(/\s+/); return s.length > 1 && s[0].length <= 3 ? s[0] + ' ' + s[1] : s[0]; }
function decodeTok(t) {
  try { const b = String(t).split('.')[0].replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(decodeURIComponent(escape(atob(b)))); } catch (e) { return null; }
}
function pdfId(url) { const m = String(url || '').match(/\/d\/([\w-]{20,})/) || String(url || '').match(/[?&]id=([\w-]{20,})/); return m ? m[1] : null; }
function randPin() { const a = new Uint32Array(1); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : (a[0] = Math.random() * 1e9); return String(a[0] % 1000000).padStart(6, '0'); }

// ── 2. State ────────────────────────────────────────────────
const S = {
  token: null, kuaToken: null, me: null, isAdmin: false, kua: {},
  tahun: [], bd: [], lap: [], peg: [], tahunId: null,
  page: null, open: {}, f: { tw: '', st: '', q: '' }, tf: { tw: '', st: 'belum' }, skpMode: 'saya',
  draft: null, pending: {}, pinFor: null, pinVal: '', pinBusy: false
};

const isDone = l => l.Status === 'FINAL' || l.Status === 'REVISI';
const linkOf = l => l.PdfUrl || l.LinkUrl || '';
const bdById = id => S.bd.find(b => b.ID === id);
const lapById = id => S.lap.find(l => l.ID === id);
const pegById = id => S.peg.find(p => p.ID === id) || (S.me && S.me.ID === id ? S.me : null);
const tahunById = id => S.tahun.find(t => t.ID === id);
const tahunLabel = () => (tahunById(S.tahunId) || {}).Tahun || '-';
const myBD = () => S.bd.filter(b => b.PegawaiID === S.me.ID && b.TahunID === S.tahunId);
const sumberLabel = s => (s === 'LINK' ? 'Link Drive' : s === 'UPLOAD' ? 'PDF unggahan' : 'Dibuat di aplikasi');

// ── 3. Server ───────────────────────────────────────────────
// Pengganti google.script.run: POST {fn, args} ke doPost GAS.
// Content-Type text/plain wajib agar tidak memicu CORS preflight.
function gs(fn, ...args) {
  if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(API_URL)) {
    return Promise.reject(new Error('GAS_URL di js/config.js belum diisi dengan URL /exec yang benar.'));
  }
  return fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ fn: fn, args: args })
  })
    .catch(() => { throw new Error('Tidak dapat terhubung ke server. Periksa koneksi internet, atau pastikan Web App di-deploy dengan akses "Siapa saja".'); })
    .then(res => {
      if (!res.ok) throw new Error('Server merespons ' + res.status + '. Coba lagi sebentar.');
      return res.json().catch(() => { throw new Error('Respons server tidak valid. Pastikan Kode.gs versi API sudah di-deploy.'); });
    })
    .then(r => {
      if (r && r.success) return r.data;
      const e = new Error((r && r.message) || 'Terjadi kesalahan.');
      e.data = r && r.data;
      throw e;
    });
}
function api(action, data) {
  return gs('api', S.token, action, data || {}).catch(e => {
    if (e.data && e.data.auth === false) sessionExpired(e.message);
    throw e;
  });
}

// ── 4. UI primitives ────────────────────────────────────────
function toast(msg, type) {
  const el = document.createElement('div');
  el.className = 'toast ' + (type || '');
  const ic = type === 'bad' ? 'x-circle-fill' : type === 'warn' ? 'exclamation-circle-fill' : 'check-circle-fill';
  el.innerHTML = `<i class="bi bi-${ic}"></i><span>${esc(msg)}</span>`;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(8px)'; setTimeout(() => el.remove(), 260); }, type === 'bad' ? 4800 : 2600);
}

let sheetEl = null;
function openSheet(o) {
  closeSheet(true);
  const bd = document.createElement('div');
  bd.className = 'backdrop';
  const sh = document.createElement('div');
  sh.className = 'sheet' + (o.wide ? ' wide' : '');
  sh.setAttribute('role', 'dialog');
  sh.setAttribute('aria-modal', 'true');
  sh.innerHTML = `<div class="sheet-grab"></div>
    <div class="sheet-head"><h3>${esc(o.title || '')}</h3><button class="icon-btn" data-act="closeSheet" aria-label="Tutup"><i class="bi bi-x-lg"></i></button></div>
    <div class="sheet-body">${o.body || ''}</div>${o.foot ? `<div class="sheet-foot">${o.foot}</div>` : ''}`;
  bd.addEventListener('click', () => closeSheet());
  document.body.append(bd, sh);
  requestAnimationFrame(() => { bd.classList.add('on'); sh.classList.add('on'); });
  sheetEl = { bd, sh, onClose: o.onClose };
  if (o.onOpen) o.onOpen(sh);
  const f = sh.querySelector('[autofocus]');
  if (f && isWide()) setTimeout(() => f.focus(), 220);
  return sh;
}
function closeSheet(instant) {
  if (!sheetEl) return;
  const { bd, sh, onClose } = sheetEl;
  sheetEl = null;
  if (onClose) onClose();
  if (instant === true) { bd.remove(); sh.remove(); return; }
  bd.classList.remove('on'); sh.classList.remove('on');
  setTimeout(() => { bd.remove(); sh.remove(); }, 280);
}
function sheetBody(html) { if (sheetEl) sheetEl.sh.querySelector('.sheet-body').innerHTML = html; }
function confirmBox(msg, okLabel, danger) {
  return new Promise(res => {
    let done = false;
    openSheet({
      title: 'Konfirmasi',
      body: `<p class="muted" style="margin:4px 0 6px">${esc(msg)}</p>`,
      foot: `<button class="btn btn-ghost" data-act="closeSheet">Batal</button><button class="btn ${danger ? 'btn-danger' : 'btn-pri'}" id="cfOk">${esc(okLabel || 'Ya, lanjutkan')}</button>`,
      onOpen: sh => { sh.querySelector('#cfOk').onclick = () => { done = true; closeSheet(); res(true); }; },
      onClose: () => { if (!done) res(false); }
    });
  });
}
function busy(on, msg) {
  let el = $('#busy');
  if (!el) {
    el = document.createElement('div');
    el.id = 'busy';
    el.innerHTML = '<div class="busy-card"><div class="spinner"></div><div id="busyMsg"></div></div>';
    document.body.appendChild(el);
  }
  $('#busyMsg').textContent = msg || 'Memproses…';
  el.classList.toggle('on', !!on);
}
function btnLoad(btn, on, label) {
  if (!btn) return;
  if (on) { btn.dataset.html = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spin"></span>${esc(label || 'Memproses…')}`; }
  else { btn.disabled = false; if (btn.dataset.html) btn.innerHTML = btn.dataset.html; }
}
async function copyText(text, btn) {
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { ok = document.execCommand('copy'); } catch (_) {}
    ta.remove();
  }
  if (!ok) return toast('Gagal menyalin. Tekan lama untuk menyalin manual.', 'bad');
  if (btn && btn.classList.contains('copy-btn')) {
    const o = btn.innerHTML;
    btn.classList.add('done'); btn.innerHTML = '<i class="bi bi-check2"></i><span>Tersalin</span>';
    setTimeout(() => { btn.classList.remove('done'); btn.innerHTML = o; }, 1400);
  } else toast('Disalin ke clipboard');
}
function empty(icon, title, sub, extra) {
  return `<div class="empty"><span class="ic muted-bg"><i class="bi bi-${icon}"></i></span><b>${esc(title)}</b>${sub ? `<p>${esc(sub)}</p>` : ''}${extra || ''}</div>`;
}
function chipSet(act, opts, cur) {
  return opts.map(([v, l]) => `<button class="chip ${v === cur ? 'on' : ''}" data-act="${act}" data-v="${v}">${esc(l)}</button>`).join('');
}
function statusTag(l) {
  if (l.Status === 'DRAFT') return '<span class="tag warn">Draft</span>';
  if (l.Status === 'REVISI') return '<span class="tag warn">Revisi</span>';
  return '<span class="tag ok">Final</span>';
}
function barCls(p) { return p >= 100 ? 'ok' : p >= 50 ? '' : p > 0 ? 'warn' : 'bad'; }
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  store.set('theme', t);
  const m = document.querySelector('meta[name=theme-color]');
  if (m) m.content = t === 'dark' ? '#0E1320' : '#F5F6F8';
}

// Kompres foto di browser (maks 1280px, JPEG 72%) → ±150–300 KB
function compressImage(file, max = 1280, q = 0.72) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight;
      const s = Math.min(1, max / Math.max(w, h));
      w = Math.round(w * s); h = Math.round(h * s);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const x = c.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', q));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Format foto tidak didukung: ' + file.name)); };
    img.src = url;
  });
}
function readB64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.onerror = () => rej(new Error('Gagal membaca file.'));
    r.readAsDataURL(file);
  });
}
function sizeKB(list) { return Math.round(list.reduce((s, d) => s + d.length * 0.75, 0) / 1024); }

// ── 5. Data lokal (optimistic) ──────────────────────────────
function persist() {
  if (!S.me) return;
  store.set('boot_' + S.me.ID, { me: S.me, isAdmin: S.isAdmin, kua: S.kua, tahun: S.tahun, bd: S.bd, lap: S.lap, peg: S.peg, t: Date.now() });
}
function applyBoot(b) {
  S.me = b.me; S.isAdmin = !!b.isAdmin; S.kua = b.kua || {};
  S.tahun = b.tahun || []; S.bd = b.bd || []; S.lap = b.lap || []; S.peg = b.peg || [];
  if (!S.tahunId || !tahunById(S.tahunId)) {
    const a = S.tahun.find(t => t.Aktif === 'Y') || S.tahun.slice().sort((x, y) => y.Tahun.localeCompare(x.Tahun))[0];
    S.tahunId = a ? a.ID : null;
  }
  if (S.kua.nama) BOOT.namaKua = S.kua.nama;
  persist();
}
function upsertLocal(rec) {
  const i = S.lap.findIndex(l => l.ID === rec.ID);
  if (i >= 0) S.lap[i] = Object.assign({}, S.lap[i], rec); else S.lap.unshift(rec);
  persist();
}
function removeLocal(id) { S.lap = S.lap.filter(l => l.ID !== id); persist(); }
function upsertBDLocal(rec) {
  const i = S.bd.findIndex(b => b.ID === rec.ID);
  if (i >= 0) S.bd[i] = Object.assign({}, S.bd[i], rec); else S.bd.push(rec);
  persist();
}
function softRefresh() {
  if (!S.me) return;
  if (S.page === 'laporan' && $('#lapList')) { renderLapList(); renderLapDetail(); }
  else if (S.page !== 'form') renderPage();
}
/** Simpan laporan di latar belakang. UI sudah diperbarui lebih dulu. */
function syncSave(id, payload, prev) {
  const p = api('saveLaporan', payload)
    .then(r => { upsertLocal(r); return r; })
    .catch(e => {
      if (prev) upsertLocal(prev); else removeLocal(id);
      toast('Gagal menyimpan ke server: ' + e.message, 'bad');
      throw e;
    })
    .finally(() => { delete S.pending[id]; persist(); softRefresh(); });
  p.catch(() => {});
  S.pending[id] = p;
  return p;
}

// ── 6. Statistik (dihitung lokal, tanpa server) ─────────────
function calcStats(pid, tid) {
  const bds = S.bd.filter(b => b.PegawaiID === pid && b.TahunID === tid);
  const laps = S.lap.filter(l => l.PegawaiID === pid && l.TahunID === tid);
  const done = laps.filter(isDone);
  const tw = [1, 2, 3, 4].map(t => ({ tw: t, target: 0, real: 0 }));
  let target = 0, realCap = 0;
  const per = bds.map(b => {
    const r = { b, tw: [], target: 0, real: 0, laps: done.filter(l => l.BuktiDukungID === b.ID) };
    for (let t = 1; t <= 4; t++) {
      const tg = num(b['TW' + t]);
      const rl = r.laps.filter(l => +l.TW === t).length;
      r.tw.push({ tg, rl });
      r.target += tg; r.real += rl;
      tw[t - 1].target += tg; tw[t - 1].real += rl;
      realCap += Math.min(rl, tg);
    }
    target += r.target;
    r.pct = r.target ? Math.min(100, Math.round(r.real / r.target * 100)) : 0;
    return r;
  });
  return {
    bds, laps, done, per, tw, target, realCap,
    draft: laps.filter(l => l.Status === 'DRAFT' || l.Status === 'REVISI'),
    luar: done.filter(l => l.Sumber !== 'APP'),
    real: done.length,
    pct: target ? Math.round(realCap / target * 100) : 0
  };
}

// ── 7. Auth flow ────────────────────────────────────────────
function brandLock() {
  return `<div class="brand-lock"><div class="logo">L1</div><div><b>LABUKU One</b><small>${BOOT.namaKua ? 'KUA ' + esc(BOOT.namaKua) : 'Buku Kinerja ASN KUA'}</small></div></div>`;
}
function authShell(inner, wide) {
  $('#screen-app').hidden = true;
  const a = $('#screen-auth');
  a.hidden = false;
  a.innerHTML = `<div class="auth"><div class="auth-card ${wide ? 'wide' : ''}">${brandLock()}${inner}</div><div class="auth-foot">LABUKU One v${esc(BOOT.version || '')} · by Ahzani Labs</div></div>`;
}
function fld(label, name, opt = {}) {
  const req = opt.req ? ' <span class="req">*</span>' : '';
  const attrs = `class="inp" name="${name}" ${opt.type ? `type="${opt.type}"` : ''} ${opt.ph ? `placeholder="${esc(opt.ph)}"` : ''} ${opt.attrs || ''}`;
  const input = opt.textarea ? `<textarea ${attrs} rows="${opt.rows || 3}">${esc(opt.value || '')}</textarea>` : `<input ${attrs} value="${esc(opt.value || '')}">`;
  return `<div class="field"><label>${label}${req}</label>${input}${opt.hint ? `<div class="hint">${opt.hint}</div>` : ''}</div>`;
}
function pwFld(label, name, opt = {}) {
  return `<div class="field"><label>${label}${opt.req ? ' <span class="req">*</span>' : ''}</label><div class="pw-wrap"><input class="inp" type="password" name="${name}" ${opt.attrs || ''} placeholder="${esc(opt.ph || '')}"><button type="button" class="icon-btn" data-act="togglePw" aria-label="Lihat"><i class="bi bi-eye"></i></button></div>${opt.hint ? `<div class="hint">${opt.hint}</div>` : ''}</div>`;
}

function renderSetup() {
  authShell(`<h2>Siapkan LABUKU One</h2><p class="sub">Cukup sekali. Semua data tersimpan di Google Drive akun KUA ini, di folder “LABUKU One by Ahzani Labs”.</p>
    ${BOOT.setupOpen ? '' : `<div class="note warn mb"><i class="bi bi-lock"></i><div>Setup masih terkunci. Buka editor Apps Script, jalankan fungsi <b>bukaSetup</b>, lalu muat ulang halaman ini.</div></div>`}
    <form id="fSetup" autocomplete="off">
      <div class="form-sec">Identitas KUA</div>
      ${fld('Nama KUA (kecamatan)', 'namaKua', { req: true, ph: 'Slahung' })}
      ${fld('Kabupaten / Kota', 'kabupaten', { req: true, ph: 'Kabupaten Ponorogo' })}
      ${fld('Alamat kantor', 'alamat', { ph: 'Jl. … (untuk kop PDF)' })}
      <div class="form-sec">Akun KUA — dipakai semua pegawai</div>
      <div class="row2">${fld('Username', 'username', { req: true, ph: 'kuaslahung', attrs: 'autocapitalize="none"' })}${pwFld('Password', 'password', { req: true, ph: 'min. 6 karakter' })}</div>
      <div class="form-sec">Kepala KUA (admin)</div>
      ${fld('Nama lengkap', 'nama', { req: true, ph: 'Nama beserta gelar' })}
      <div class="row2">${fld('NIP', 'nip', { attrs: 'inputmode="numeric"' })}${fld('Jabatan', 'jabatan', { value: 'Kepala KUA' })}</div>
      ${fld('PIN pribadi (6 digit)', 'pin', { req: true, type: 'password', attrs: 'inputmode="numeric" maxlength="6" pattern="[0-9]*"', hint: 'Dipakai bersama nama untuk masuk.' })}
      <button class="btn btn-pri btn-block" type="submit" ${BOOT.setupOpen ? '' : 'disabled'}><i class="bi bi-rocket-takeoff"></i> Siapkan aplikasi</button>
    </form>`, true);
  $('#fSetup').onsubmit = async e => {
    const d = Object.fromEntries(new FormData(e.target));
    if (!/^\d{6}$/.test(d.pin)) return toast('PIN harus 6 digit angka.', 'warn');
    const b = e.target.querySelector('button[type=submit]');
    btnLoad(b, true, 'Menyiapkan Drive & database…');
    try {
      const r = await gs('apiSetup', d);
      BOOT.configured = true; BOOT.namaKua = d.namaKua; BOOT.setupOpen = false;
      store.set('bootinfo', Object.assign({}, BOOT));
      S.kuaToken = r.kuaToken; store.set('kua', r.kuaToken); store.set('names', r.names);
      onLoggedIn(r.token, r.boot);
      toast('LABUKU One siap digunakan. Tambahkan pegawai di menu Pegawai.');
    } catch (err) { toast(err.message, 'bad'); btnLoad(b, false); }
  };
}

function renderLoginKua() {
  S.pinFor = null;
  authShell(`<h2>Masuk akun KUA</h2><p class="sub">Gunakan username dan password KUA dari Kepala KUA.</p>
    <form id="fKua" autocomplete="on">
      ${fld('Username', 'u', { attrs: 'autocapitalize="none" autocomplete="username" autofocus' })}
      ${pwFld('Password', 'p', { attrs: 'autocomplete="current-password"' })}
      <button class="btn btn-pri btn-block" type="submit">Lanjut <i class="bi bi-arrow-right"></i></button>
    </form>`);
  $('#fKua').onsubmit = async e => {
    const d = Object.fromEntries(new FormData(e.target));
    if (!d.u || !d.p) return toast('Isi username dan password.', 'warn');
    const b = e.target.querySelector('button[type=submit]');
    btnLoad(b, true, 'Memeriksa…');
    try {
      const r = await gs('apiLoginKua', d.u, d.p);
      S.kuaToken = r.kuaToken; store.set('kua', r.kuaToken); store.set('names', r.names);
      if (r.namaKua) BOOT.namaKua = r.namaKua;
      renderNames(r.names);
    } catch (err) { toast(err.message, 'bad'); btnLoad(b, false); }
  };
}

function renderNames(names) {
  S.pinFor = null;
  const last = store.get('last');
  const rank = p => (p.ID === last ? 0 : p.Role === 'admin' ? 1 : 2);
  const list = (names || []).slice().sort((a, b) => rank(a) - rank(b) || a.Nama.localeCompare(b.Nama));
  authShell(`<h2>Siapa Anda?</h2><p class="sub">Pilih nama Anda, lalu masukkan PIN.</p>
    ${list.length > 6 ? `<div class="search mb"><i class="bi bi-search"></i><input class="inp" placeholder="Cari nama…" data-in="nameQ"></div>` : ''}
    <div class="names" id="nameList">${list.length ? list.map(p => `
      <button class="name-btn" data-act="pickName" data-id="${p.ID}" data-q="${esc((p.Nama + ' ' + (p.Jabatan || '')).toLowerCase())}">
        <span class="avatar">${esc(initials(p.Nama))}</span>
        <span class="grow"><b>${esc(p.Nama)}</b><small>${esc(p.Jabatan || (p.Role === 'admin' ? 'Kepala KUA' : 'ASN'))}${p.ID === last ? ' · terakhir masuk' : ''}</small></span>
        <i class="bi bi-chevron-right muted"></i>
      </button>`).join('') : '<div class="pad"><div class="spinner"></div></div>'}
    </div>
    <button class="link-btn" data-act="forgetDevice">Bukan KUA ini? Ganti akun KUA</button>`);
  S._names = list;
}

function renderPin(p) {
  S.pinFor = p; S.pinVal = ''; S.pinBusy = false;
  authShell(`<button class="back-link" data-act="backNames"><i class="bi bi-chevron-left"></i> Ganti nama</button>
    <div class="pin-who"><span class="avatar lg">${esc(initials(p.Nama))}</span><b>${esc(p.Nama)}</b><small>${esc(p.Jabatan || '')}</small></div>
    <p class="sub center">Masukkan PIN 6 digit</p>
    <div class="pin-dots" id="pinDots">${'<i></i>'.repeat(6)}</div>
    <div class="keypad">
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button class="key" data-act="pinKey" data-k="${n}">${n}</button>`).join('')}
      <button class="key ghost" data-act="pinKey" data-k="clr" aria-label="Kosongkan"><i class="bi bi-x-lg"></i></button>
      <button class="key" data-act="pinKey" data-k="0">0</button>
      <button class="key ghost" data-act="pinKey" data-k="del" aria-label="Hapus"><i class="bi bi-backspace"></i></button>
    </div>
    <p class="hint center">Lupa PIN? Tanyakan ke Kepala KUA.</p>`);
}
function paintPin() { $$('#pinDots i').forEach((d, i) => d.classList.toggle('on', i < S.pinVal.length)); }
async function submitPin() {
  const p = S.pinFor, dots = $('#pinDots');
  S.pinBusy = true; dots.classList.add('wait');
  try {
    const r = await gs('apiLoginPin', S.kuaToken, p.ID, S.pinVal);
    store.set('last', p.ID);
    onLoggedIn(r.token, r.boot);
  } catch (e) {
    S.pinBusy = false; S.pinVal = '';
    if (e.data && e.data.kua) { store.del('kua'); renderLoginKua(); toast(e.message, 'warn'); return; }
    dots.classList.remove('wait'); dots.classList.remove('shake'); void dots.offsetWidth; dots.classList.add('shake');
    paintPin(); toast(e.message, 'bad');
  }
}
function onLoggedIn(token, boot) {
  S.token = token; store.set('sess', token); S.pinFor = null;
  enterApp(boot);
}
function toNames() {
  const k = store.get('kua'), kt = k && decodeTok(k);
  if (!(kt && kt.exp > Date.now())) { renderLoginKua(); return; }
  S.kuaToken = k;
  renderNames(store.get('names', []));
  gs('apiPegawaiList', k).then(r => {
    store.set('names', r.names);
    if (!S.pinFor && !S.me && $('#nameList')) renderNames(r.names);
  }).catch(e => { if (e.data && e.data.kua) { store.del('kua'); renderLoginKua(); } });
}
function sessionExpired(msg) {
  if (!S.token) return;
  if (S.me) store.del('boot_' + S.me.ID);
  store.del('sess');
  S.token = null; S.me = null; S.page = null; S.open = {};
  closeSheet(true); busy(false);
  toast(msg || 'Sesi berakhir.', 'warn');
  toNames();
}
function logout(forget) {
  if (S.me) store.del('boot_' + S.me.ID);
  store.del('sess');
  Object.assign(S, { token: null, me: null, page: null, open: {}, draft: null });
  $('#view').innerHTML = '';
  if (forget) { store.del('kua'); store.del('names'); store.del('last'); S.kuaToken = null; renderLoginKua(); }
  else toNames();
}

// ── 8. App shell & router ───────────────────────────────────
const NAV = [
  { id: 'beranda', icon: 'house', label: 'Beranda', short: 'Beranda' },
  { id: 'laporan', icon: 'journal-text', label: 'Laporan Saya', short: 'Laporan' },
  { id: 'realisasi', icon: 'bar-chart', label: 'Realisasi', short: 'Realisasi' },
  { id: 'skp', icon: 'layout-split', label: 'Laporan SKP', short: 'SKP' },
  { id: 'bd', icon: 'bullseye', label: 'Bukti Dukung & Target', short: 'Target' },
  { id: 'tim', icon: 'people', label: 'Tim & Klaim', short: 'Tim', admin: true },
  { id: 'pegawai', icon: 'person-badge', label: 'Pegawai', short: 'Pegawai', admin: true },
  { id: 'kua', icon: 'building-gear', label: 'Pengaturan KUA', short: 'KUA', admin: true },
  { id: 'log', icon: 'clock-history', label: 'Log Aktivitas', short: 'Log', admin: true },
  { id: 'akun', icon: 'person-circle', label: 'Akun', short: 'Akun' }
];
const navDef = id => NAV.find(n => n.id === id);

function tahunChip() { return `<button class="chip chip-sm" data-act="pickTahun"><i class="bi bi-calendar3"></i> ${esc(tahunLabel())} <i class="bi bi-chevron-down"></i></button>`; }
const PAGES = {
  beranda: { title: 'Beranda', render: renderBeranda, actions: tahunChip },
  laporan: { title: 'Laporan Saya', render: renderLaporan, actions: tahunChip },
  form: { title: () => (S.draft && S.draft.isEdit ? 'Ubah Laporan' : 'Laporan Kegiatan'), render: renderForm, parent: 'laporan' },
  realisasi: { title: 'Realisasi', render: renderRealisasi, actions: tahunChip, parent: 'akun' },
  skp: { title: 'Laporan SKP', render: renderSKP, actions: tahunChip, parent: () => (S.isAdmin ? 'akun' : null) },
  bd: { title: 'Bukti Dukung & Target', render: renderBD, actions: tahunChip, parent: 'akun' },
  akun: { title: 'Akun', render: renderAkun },
  tim: { title: 'Tim & Klaim', render: renderTim, actions: tahunChip, admin: true },
  pegawai: { title: 'Pegawai', render: renderPegawai, admin: true, parent: 'akun' },
  kua: { title: 'Pengaturan KUA', render: renderKua, admin: true, parent: 'akun' },
  log: { title: 'Log Aktivitas', render: renderLog, admin: true, parent: 'akun', actions: () => '<button class="icon-btn" data-act="logRefresh" aria-label="Muat ulang"><i class="bi bi-arrow-clockwise"></i></button>' }
};
const val = v => (typeof v === 'function' ? v() : v);

function enterApp(boot) {
  applyBoot(boot);
  $('#screen-auth').hidden = true;
  $('#screen-auth').innerHTML = '';
  $('#screen-app').hidden = false;
  buildNav();
  go(S.page && PAGES[S.page] && S.page !== 'form' ? S.page : 'beranda');
}
function revalidate() {
  api('bootstrap').then(b => {
    applyBoot(b);
    buildNav();
    if (S.page !== 'form' && !sheetEl) softRefresh();
  }).catch(() => {});
}
function buildNav() {
  if (!S.me) return;
  const items = NAV.filter(n => !n.admin || S.isAdmin);
  const btn = n => `<button class="sn" data-nav="${n.id}" data-act="nav" title="${esc(n.label)}"><i class="bi bi-${n.icon}"></i><span class="l">${esc(n.label)}</span><span class="s">${esc(n.short)}</span></button>`;
  $('#nav-side').innerHTML = `
    <div class="side-brand"><div class="logo sm">L1</div><div class="t"><b>LABUKU One</b><small>KUA ${esc(S.kua.nama || '')}</small></div></div>
    <button class="side-new" data-act="newMenu"><i class="bi bi-plus-lg"></i><span>Tambah</span></button>
    <div class="side-items">
      ${items.filter(n => !n.admin && n.id !== 'akun').map(btn).join('')}
      ${S.isAdmin ? '<div class="side-sec">Kepala KUA</div>' + items.filter(n => n.admin).map(btn).join('') : ''}
    </div>
    <button class="side-user" data-act="nav" data-nav="akun" title="Akun"><span class="avatar">${esc(initials(S.me.Nama))}</span><span class="t"><b>${esc(S.me.Nama)}</b><small>${esc(S.me.Jabatan || '')}</small></span></button>`;
  const fourth = S.isAdmin ? 'tim' : 'skp';
  $('#nav-bottom').innerHTML = ['beranda', 'laporan', '+', fourth, 'akun'].map(id => {
    if (id === '+') return '<div class="nb-wrap"><button class="nb-fab" data-act="newMenu" aria-label="Tambah hasil kerja"><i class="bi bi-plus-lg"></i></button></div>';
    const n = navDef(id);
    return `<button class="nb" data-bnav="${n.id}" data-act="nav" data-nav="${n.id}"><i class="bi bi-${n.icon}"></i><span>${esc(n.short)}</span></button>`;
  }).join('');
}
function go(page) {
  const def = PAGES[page];
  if (!def || (def.admin && !S.isAdmin)) page = 'beranda';
  S.page = page;
  let sec = $('#pg-' + page);
  if (!sec) { sec = document.createElement('section'); sec.className = 'page'; sec.id = 'pg-' + page; $('#view').appendChild(sec); }
  $$('#view > .page').forEach(p => p.classList.toggle('on', p === sec));
  const sideKey = page === 'form' ? 'laporan' : page;
  const bottomKeys = ['beranda', 'laporan', S.isAdmin ? 'tim' : 'skp', 'akun'];
  const bottomKey = page === 'form' ? 'laporan' : bottomKeys.includes(page) ? page : 'akun';
  $$('#nav-side [data-nav]').forEach(b => b.classList.toggle('on', b.dataset.nav === sideKey));
  $$('#nav-bottom [data-bnav]').forEach(b => b.classList.toggle('on', b.dataset.bnav === bottomKey));
  renderPage();
  window.scrollTo(0, 0);
}
function renderPage() {
  if (!S.me || !S.page) return;
  const def = PAGES[S.page];
  const sec = $('#pg-' + S.page);
  if (!sec) return;
  $('#pageTitle').textContent = val(def.title);
  const par = val(def.parent);
  $('#btnBack').hidden = !(S.page === 'form' || (!isWide() && (par || S.open[S.page])));
  $('#appbarActions').innerHTML = def.actions ? def.actions() : '';
  def.render(sec);
}
function back() {
  const def = PAGES[S.page];
  if (S.page !== 'form' && !isWide() && S.open[S.page]) { S.open[S.page] = null; renderPage(); window.scrollTo(0, 0); return; }
  go(val(def.parent) || 'beranda');
}

// ── 9. Halaman: Beranda ─────────────────────────────────────
function stat(icon, tone, v, l) { return `<div class="stat"><span class="stat-ic ${tone}"><i class="bi bi-${icon}"></i></span><div><div class="v">${v}</div><div class="l">${l}</div></div></div>`; }
function twChart(tw) {
  const now = twOf(today());
  const max = Math.max(1, ...tw.map(t => Math.max(t.target, t.real)));
  return `<div class="twc-wrap">${tw.map(t => `
    <div class="twc ${String(t.tw) === now ? 'now' : ''}">
      <div class="twc-v">${t.real}/${t.target}</div>
      <div class="twc-bar"><i class="tg" style="height:${t.target / max * 100}%"></i><i class="rl" style="height:${Math.min(t.real, max) / max * 100}%"></i></div>
      <div class="twc-l">TW ${t.tw}</div>
    </div>`).join('')}</div>
    <div class="legend"><span><i style="background:var(--surface-2)"></i>Target</span><span><i style="background:var(--brand)"></i>Realisasi</span></div>`;
}
function progRow(r) {
  return `<div class="prog"><div class="prog-h"><span class="t">${esc(r.b.Nama)}</span><span class="v">${r.real}/${r.target}</span></div>
    <div class="bar"><i class="${barCls(r.pct)}" style="width:${r.pct}%"></i></div>
    <div class="prog-m"><span class="tag ${r.b.Jenis === 'Utama' ? 'brand' : 'info'}">${esc(r.b.Jenis)}</span><span>${r.pct}%</span></div></div>`;
}
function lapItem(l, on) {
  const b = bdById(l.BuktiDukungID);
  const ic = l.Sumber === 'LINK' ? ['link-45deg', 'info'] : l.Sumber === 'UPLOAD' ? ['file-earmark-arrow-up', 'info'] : isDone(l) ? ['file-earmark-check', 'ok'] : ['pencil-square', 'warn'];
  return `<button class="item ${on ? 'on' : ''}" data-act="openLap" data-id="${l.ID}">
    <span class="ic ${ic[1]}"><i class="bi bi-${ic[0]}"></i></span>
    <span class="body"><span class="t">${esc(l.Uraian || '(tanpa uraian)')}</span>
      <span class="m"><span>${esc(b ? b.Nama : '-')}</span></span>
      <span class="m"><span><i class="bi bi-calendar3"></i> ${tgl(l.Tanggal, true)}</span><span>TW ${esc(l.TW)}</span>${statusTag(l)}${l.Klaim === 'Y' ? '<span class="tag brand"><i class="bi bi-flag-fill"></i> Diklaim</span>' : ''}${S.pending[l.ID] ? '<span class="tag muted"><i class="bi bi-cloud-arrow-up"></i> Sinkron</span>' : ''}</span>
    </span></button>`;
}
function renderBeranda(sec) {
  const st = calcStats(S.me.ID, S.tahunId);
  const h = new Date().getHours();
  const greet = h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
  const sisa = Math.max(0, st.target - st.realCap);
  const msg = !st.bds.length ? 'Atur bukti dukung & target untuk mulai mengukur capaian.' : sisa === 0 ? 'Seluruh target tahun ini tercapai.' : `Masih ${sisa} target yang perlu dipenuhi.`;
  let team = '';
  if (S.isAdmin) {
    const staff = S.peg.filter(p => p.ID !== S.me.ID && p.Status === 'Aktif');
    const bel = S.lap.filter(l => l.PegawaiID !== S.me.ID && l.TahunID === S.tahunId && isDone(l) && l.Klaim !== 'Y').length;
    team = `<div class="team-card"><span class="ic brand"><i class="bi bi-people"></i></span><div class="grow"><b>${staff.length} pegawai · ${bel} hasil kerja belum diklaim</b><small>Tandai hasil kerja staf agar masuk rekap SKP Anda.</small></div><button class="btn btn-pri btn-sm" data-act="nav" data-nav="tim">Buka</button></div>`;
  }
  sec.innerHTML = `
    <div class="hello"><div><div class="muted small">${greet},</div><h2>${esc(firstName(S.me.Nama))}</h2><div class="muted small">${esc(S.me.Jabatan || '')}${S.me.Jabatan ? ' · ' : ''}KUA ${esc(S.kua.nama || '')}</div></div><span class="avatar lg">${esc(initials(S.me.Nama))}</span></div>
    <div class="dash"><div class="dash-main">
      <div class="hero"><div class="ring" style="--p:${st.pct}"><b>${st.pct}<small>%</small></b></div>
        <div class="hero-t"><span class="hero-l">Capaian kinerja ${esc(tahunLabel())}</span><span class="hero-v">${st.real} hasil kerja final</span><span class="hero-s">${esc(msg)}</span></div></div>
      <div class="grid g4 mt">${stat('patch-check', 'ok', st.real, 'Final')}${stat('hourglass-split', 'warn', st.draft.length, 'Draft/revisi')}${stat('link-45deg', 'info', st.luar.length, 'Link & unggahan')}${stat('bullseye', 'brand', st.target, 'Total target')}</div>
      ${team}
      <div class="sec-title">Capaian per triwulan</div>
      <div class="card card-pad">${twChart(st.tw)}</div>
    </div><div class="dash-side">
      <div class="sec-title">Perlu difinalisasi ${st.draft.length ? '<button class="link-btn" data-act="nav" data-nav="laporan">Semua</button>' : ''}</div>
      ${st.draft.length ? `<div class="list">${st.draft.slice(0, 5).map(l => lapItem(l)).join('')}</div>` : `<div class="card">${empty('check2-all', 'Tidak ada draft', 'Semua laporan sudah final.')}</div>`}
      <div class="sec-title">Progres bukti dukung ${st.per.length ? '<button class="link-btn" data-act="nav" data-nav="realisasi">Detail</button>' : ''}</div>
      ${st.per.length ? `<div class="card">${st.per.map(progRow).join('')}</div>` : `<div class="card">${empty('bullseye', 'Belum ada bukti dukung', 'Tambahkan RHK beserta target triwulan.', '<button class="btn btn-soft btn-sm" data-act="nav" data-nav="bd">Atur bukti dukung</button>')}</div>`}
    </div></div>`;
}

// ── 10. Halaman: Laporan (list ⇆ detail) ────────────────────
function renderLaporan(sec) {
  sec.innerHTML = `<div class="split ${S.open.laporan ? 'show-detail' : ''}">
    <div class="pane-list">
      <div class="search"><i class="bi bi-search"></i><input class="inp" placeholder="Cari uraian, bukti dukung, lokasi…" value="${esc(S.f.q)}" data-in="lapQ"></div>
      <div class="chips">${chipSet('lapTw', [['', 'Semua TW'], ['1', 'TW 1'], ['2', 'TW 2'], ['3', 'TW 3'], ['4', 'TW 4']], S.f.tw)}</div>
      <div class="chips mb">${chipSet('lapSt', [['', 'Semua'], ['DRAFT', 'Draft'], ['DONE', 'Final'], ['LUAR', 'Link & unggahan']], S.f.st)}</div>
      <div id="lapList"></div>
    </div>
    <div class="pane-detail" id="lapDetail"></div></div>`;
  renderLapList(); renderLapDetail();
}
function lapFiltered() {
  const q = S.f.q.trim().toLowerCase();
  return S.lap.filter(l => l.PegawaiID === S.me.ID && l.TahunID === S.tahunId)
    .filter(l => !S.f.tw || String(l.TW) === S.f.tw)
    .filter(l => !S.f.st || (S.f.st === 'DRAFT' ? !isDone(l) || l.Status === 'REVISI' : S.f.st === 'DONE' ? isDone(l) : l.Sumber !== 'APP'))
    .filter(l => { if (!q) return true; const b = bdById(l.BuktiDukungID); return [l.Uraian, l.Lokasi, l.Realisasi, b && b.Nama].join(' ').toLowerCase().includes(q); })
    .sort((a, b) => (b.Tanggal || '').localeCompare(a.Tanggal || '') || (b.UpdatedAt || '').localeCompare(a.UpdatedAt || ''));
}
function renderLapList() {
  const el = $('#lapList');
  if (!el) return;
  const items = lapFiltered();
  const filtered = S.f.q || S.f.tw || S.f.st;
  el.innerHTML = items.length
    ? `<div class="list-meta">${items.length} hasil kerja · tahun ${esc(tahunLabel())}</div><div class="list">${items.map(l => lapItem(l, l.ID === S.open.laporan)).join('')}</div>`
    : `<div class="card">${empty('journal-x', filtered ? 'Tidak ada yang cocok' : 'Belum ada laporan', filtered ? 'Ubah filter atau kata kunci.' : 'Ketuk tombol + untuk menambah hasil kerja.', filtered ? '' : '<button class="btn btn-pri btn-sm" data-act="newMenu"><i class="bi bi-plus-lg"></i> Tambah</button>')}</div>`;
}
function renderLapDetail() {
  const el = $('#lapDetail');
  if (!el) return;
  const l = lapById(S.open.laporan);
  el.innerHTML = l ? lapDetailHtml(l) : '<div class="placeholder"><i class="bi bi-journal-text"></i><p>Pilih laporan untuk melihat detail.</p></div>';
}
function lapDetailHtml(l) {
  const b = bdById(l.BuktiDukungID), link = linkOf(l), own = l.PegawaiID === S.me.ID;
  const waktu = l.WaktuMulai ? l.WaktuMulai + (l.WaktuSelesai ? '–' + l.WaktuSelesai : '') : '';
  const acts = [];
  if (own && l.Sumber === 'APP') {
    if (l.Status === 'DRAFT') acts.push(`<button class="btn btn-pri btn-sm" data-act="editLap" data-id="${l.ID}" data-step="2"><i class="bi bi-file-earmark-pdf"></i> Foto & finalisasi</button>`, `<button class="btn btn-ghost btn-sm" data-act="editLap" data-id="${l.ID}" data-step="1"><i class="bi bi-pencil"></i> Ubah</button>`);
    if (l.Status === 'REVISI') acts.push(`<button class="btn btn-pri btn-sm" data-act="editLap" data-id="${l.ID}" data-step="2"><i class="bi bi-arrow-repeat"></i> Finalisasi ulang</button>`, `<button class="btn btn-ghost btn-sm" data-act="editLap" data-id="${l.ID}" data-step="1"><i class="bi bi-pencil"></i> Ubah</button>`);
    if (l.Status === 'FINAL') acts.push(`<button class="btn btn-ghost btn-sm" data-act="editLap" data-id="${l.ID}" data-step="1"><i class="bi bi-pencil-square"></i> Revisi</button>`);
  }
  if (own && l.Sumber === 'LINK') acts.push(`<button class="btn btn-ghost btn-sm" data-act="editLink" data-id="${l.ID}"><i class="bi bi-pencil"></i> Ubah</button>`);
  if (num(l.Versi) > 0 && l.Sumber !== 'LINK') acts.push(`<button class="btn btn-ghost btn-sm" data-act="versi" data-id="${l.ID}"><i class="bi bi-clock-history"></i> Riwayat versi</button>`);
  if ((own && (l.Status === 'DRAFT' || l.Sumber === 'LINK')) || S.isAdmin) acts.push(`<button class="btn btn-bad btn-sm" data-act="delLap" data-id="${l.ID}"><i class="bi bi-trash3"></i> Hapus</button>`);
  return `<div class="card card-pad">
    <div class="detail-head"><div class="tags">${statusTag(l)}<span class="tag muted">${sumberLabel(l.Sumber)}</span><span class="tag muted">TW ${esc(l.TW)}</span>${num(l.Versi) > 0 && l.Sumber === 'APP' ? `<span class="tag muted">v${esc(l.Versi)}</span>` : ''}${l.Klaim === 'Y' ? '<span class="tag brand"><i class="bi bi-flag-fill"></i> Diklaim Kepala KUA</span>' : ''}</div>
      <h3>${esc(b ? b.Nama : '-')}</h3><div class="muted small">${tgl(l.Tanggal)}${waktu ? ' · ' + esc(waktu) : ''}${l.Lokasi ? ' · ' + esc(l.Lokasi) : ''}</div></div>
    ${l.Status === 'REVISI' ? '<div class="note warn mt"><i class="bi bi-exclamation-circle"></i><div>Ada perubahan yang belum difinalisasi. PDF aktif masih versi sebelumnya.</div></div>' : ''}
    <dl class="kv"><div><dt>Uraian / keterangan</dt><dd>${esc(l.Uraian)}</dd></div>${l.Realisasi ? `<div><dt>Realisasi</dt><dd>${esc(l.Realisasi)}</dd></div>` : ''}${l.SumberData ? `<div><dt>Sumber data</dt><dd>${esc(l.SumberData)}</dd></div>` : ''}</dl>
    ${link ? `<div class="linkbox"><i class="bi bi-${l.Sumber === 'LINK' ? 'link-45deg' : 'file-earmark-pdf'}"></i><div class="grow"><div class="k">${l.Sumber === 'LINK' ? 'Tautan hasil kerja' : 'PDF bukti dukung'}</div><div class="v trunc">${esc(link)}</div></div></div>
      <div class="btn-row mt-s"><button class="copy-btn" data-act="copy" data-copy="${esc(link)}"><i class="bi bi-clipboard"></i><span>Salin link</span></button><a class="btn btn-ghost btn-sm" href="${esc(link)}" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right"></i> Buka</a>${pdfId(link) ? `<button class="btn btn-ghost btn-sm" data-act="preview" data-url="${esc(link)}"><i class="bi bi-eye"></i> Pratinjau</button>` : ''}</div>` : ''}
    ${acts.length ? `<div class="btn-row actions">${acts.join('')}</div>` : ''}
  </div>`;
}

// ── 11. Form laporan kegiatan (3 langkah) ───────────────────
const FORM_FIELDS = ['BuktiDukungID', 'TW', 'Tanggal', 'WaktuMulai', 'WaktuSelesai', 'Lokasi', 'Uraian', 'Realisasi', 'SumberData'];
async function startForm(l, step) {
  if (!l && !myBD().length) { needBD(); return; }
  const saved = !l ? store.get('formDraft') : null;
  const base = {};
  if (l) FORM_FIELDS.forEach(k => { base[k] = l[k] || ''; });
  else if (saved && saved.Uraian) Object.assign(base, saved);
  else Object.assign(base, { BuktiDukungID: (myBD()[0] || {}).ID || '', TW: twOf(today()), Tanggal: today(), WaktuMulai: '', WaktuSelesai: '', Lokasi: '', Uraian: '', Realisasi: '', SumberData: '' });
  if (!bdById(base.BuktiDukungID) && myBD()[0]) base.BuktiDukungID = myBD()[0].ID;
  S.draft = { ID: l ? l.ID : null, isEdit: !!l, step: step || 1, data: base, photos: [] };
  if (l) { const ph = await IDB.get('ph_' + l.ID); if (ph) S.draft.photos = ph; }
  if (!l && saved && saved.Uraian) toast('Isian sebelumnya dipulihkan.', 'warn');
  go('form');
}
function renderForm(sec) {
  const d = S.draft;
  if (!d) { go('laporan'); return; }
  sec.innerHTML = `<div class="form-wrap"><div class="steps">${['Detail kegiatan', 'Foto', 'Finalisasi'].map((s, i) => `<div class="step ${i + 1 === d.step ? 'on' : ''} ${i + 1 < d.step ? 'done' : ''}"><span>${i + 1}. ${s}</span></div>`).join('')}</div><div id="formBody"></div></div>`;
  const fb = $('#formBody');
  if (d.step === 1) formStep1(fb); else if (d.step === 2) formStep2(fb); else formStep3(fb);
}
function bdOptions(sel) { return myBD().map(b => `<option value="${b.ID}" ${b.ID === sel ? 'selected' : ''}>${esc(b.Jenis)} — ${esc(b.Nama)}</option>`).join(''); }
function formStep1(el) {
  const x = S.draft.data;
  el.innerHTML = `<div class="card card-pad">
    <div class="field"><label>Bukti dukung <span class="req">*</span></label><select class="inp" name="BuktiDukungID" data-in="fd">${bdOptions(x.BuktiDukungID)}</select><div class="hint">Tahun ${esc(tahunLabel())} · <a href="#" data-act="nav" data-nav="bd">Kelola bukti dukung</a></div></div>
    <div class="row2"><div class="field"><label>Tanggal <span class="req">*</span></label><input type="date" class="inp" name="Tanggal" value="${esc(x.Tanggal)}" data-in="fd"></div>
      <div class="field"><label>Triwulan <span class="req">*</span></label><div class="seg" id="segTw">${[1, 2, 3, 4].map(n => `<button type="button" class="${String(n) === String(x.TW) ? 'on' : ''}" data-act="fdTw" data-v="${n}">${n}</button>`).join('')}</div></div></div>
    <div class="row2"><div class="field"><label>Mulai</label><input type="time" class="inp" name="WaktuMulai" value="${esc(x.WaktuMulai)}" data-in="fd"></div><div class="field"><label>Selesai</label><input type="time" class="inp" name="WaktuSelesai" value="${esc(x.WaktuSelesai)}" data-in="fd"></div></div>
    <div class="field"><label>Tempat / lokasi</label><input class="inp" name="Lokasi" value="${esc(x.Lokasi)}" placeholder="Aula KUA, Desa …" data-in="fd"></div>
    <div class="field"><label>Uraian kegiatan <span class="req">*</span></label><textarea class="inp" name="Uraian" rows="4" placeholder="Apa yang dilakukan, bersama siapa, hasilnya apa…" data-in="fd">${esc(x.Uraian)}</textarea></div>
    <div class="row2"><div class="field"><label>Realisasi <span class="req">*</span></label><input class="inp" name="Realisasi" value="${esc(x.Realisasi)}" placeholder="1 dokumen laporan" data-in="fd"></div>
      <div class="field"><label>Sumber data</label><input class="inp" name="SumberData" value="${esc(x.SumberData)}" placeholder="Arsip KUA, SIMKAH" data-in="fd"></div></div>
  </div>
  <div class="form-actions"><button class="btn btn-ghost" data-act="formCancel">Batal</button><button class="btn btn-pri" data-act="formNext1">Simpan & lanjut <i class="bi bi-arrow-right"></i></button></div>`;
}
function formStep2(el) {
  const ph = S.draft.photos;
  el.innerHTML = `<div class="card card-pad"><h3 class="h3">Foto dokumentasi</h3>
    <p class="muted small m0">Maksimal 4 foto. Foto dikompres otomatis dan hanya disimpan di dalam PDF, tidak sebagai file terpisah di Drive.</p>
    <div class="photos">${ph.map((p, i) => `<div class="ph"><img src="${p}" alt="Foto ${i + 1}"><span class="n">${i + 1}</span><button data-act="phDel" data-i="${i}" aria-label="Hapus foto"><i class="bi bi-x-lg"></i></button></div>`).join('')}
      ${ph.length < 4 ? '<label class="ph-add"><input type="file" accept="image/&#42;" multiple hidden data-ch="phAdd"><i class="bi bi-camera"></i><span>Tambah foto</span></label>' : ''}</div>
    <div class="hint">${ph.length}/4 foto${ph.length ? ' · ±' + sizeKB(ph) + ' KB setelah kompres' : ''}</div></div>
  <div class="form-actions"><button class="btn btn-ghost" data-act="formStep" data-v="1"><i class="bi bi-arrow-left"></i> Kembali</button><button class="btn btn-pri" data-act="formStep" data-v="3">${ph.length ? 'Lanjut' : 'Lewati foto'} <i class="bi bi-arrow-right"></i></button></div>`;
}
function formStep3(el) {
  const x = S.draft.data, b = bdById(x.BuktiDukungID), th = b ? tahunById(b.TahunID) : null;
  const waktu = x.WaktuMulai ? x.WaktuMulai + (x.WaktuSelesai ? '–' + x.WaktuSelesai : '') : '-';
  el.innerHTML = `<div class="card card-pad"><h3 class="h3">Periksa sebelum finalisasi</h3>
    <dl class="kv"><div><dt>Bukti dukung</dt><dd>${esc(b ? b.Nama : '-')}</dd></div><div><dt>Tanggal · waktu · TW</dt><dd>${tgl(x.Tanggal)} · ${esc(waktu)} · TW ${esc(x.TW)}</dd></div>
      ${x.Lokasi ? `<div><dt>Tempat</dt><dd>${esc(x.Lokasi)}</dd></div>` : ''}<div><dt>Uraian</dt><dd>${esc(x.Uraian)}</dd></div><div><dt>Realisasi</dt><dd>${esc(x.Realisasi)}</dd></div>${x.SumberData ? `<div><dt>Sumber data</dt><dd>${esc(x.SumberData)}</dd></div>` : ''}</dl>
    ${S.draft.photos.length ? `<div class="photos sm">${S.draft.photos.map(p => `<div class="ph"><img src="${p}" alt=""></div>`).join('')}</div>` : '<p class="hint">Tanpa foto dokumentasi.</p>'}
  </div>
  <div class="note mt"><i class="bi bi-folder2"></i><div>PDF disimpan di Drive KUA: <b>${esc(S.me.Nama)} › ${esc(th ? th.Tahun : '')} › ${esc(b ? b.Nama : '')} › TW ${esc(x.TW)}</b>. Proses ±10–30 detik.</div></div>
  <div class="form-actions"><button class="btn btn-ghost" data-act="formStep" data-v="2" aria-label="Kembali"><i class="bi bi-arrow-left"></i></button><button class="btn btn-soft" data-act="formDraftDone">Simpan draft</button><button class="btn btn-pri" data-act="formFinal"><i class="bi bi-file-earmark-pdf"></i> Finalisasi</button></div>`;
}

// ── 12. Halaman: Realisasi ──────────────────────────────────
function renderRealisasi(sec) {
  const st = calcStats(S.me.ID, S.tahunId);
  sec.innerHTML = `<div class="hero mb"><div class="ring" style="--p:${st.pct}"><b>${st.pct}<small>%</small></b></div><div class="hero-t"><span class="hero-l">Realisasi ${esc(tahunLabel())}</span><span class="hero-v">${st.realCap} dari ${st.target} target terpenuhi</span><span class="hero-s">${st.real} hasil kerja final · ${st.per.length} bukti dukung</span></div></div>
    ${st.per.length ? st.per.map(r => `<div class="card card-pad mb">
      <div class="row-between"><div class="grow"><span class="tag ${r.b.Jenis === 'Utama' ? 'brand' : 'info'}">${esc(r.b.Jenis)}</span><h3 class="h3 mt-s">${esc(r.b.Nama)}</h3><div class="muted small">${r.real} dari ${r.target} ${esc(r.b.Satuan || '')}</div></div><div class="big">${r.pct}%</div></div>
      <div class="bar mt-s"><i class="${barCls(r.pct)}" style="width:${r.pct}%"></i></div>
      <div class="tw-grid">${r.tw.map((t, i) => `<div class="tw-cell ${t.tg > 0 && t.rl >= t.tg ? 'met' : ''}"><small>TW ${i + 1}</small><b>${t.rl}</b><span>dari ${t.tg}</span></div>`).join('')}</div>
      ${r.laps.length ? `<details class="more"><summary><i class="bi bi-chevron-down"></i> Lihat ${r.laps.length} hasil kerja</summary>${r.laps.slice().sort((a, b) => (a.Tanggal || '').localeCompare(b.Tanggal || '')).map(l => `<div class="mini-row"><span class="grow"><b>${tgl(l.Tanggal, true)}</b> · TW ${esc(l.TW)} · ${esc(l.Uraian)}</span>${linkOf(l) ? `<button class="copy-btn" data-act="copy" data-copy="${esc(linkOf(l))}"><i class="bi bi-clipboard"></i><span>Link</span></button>` : ''}</div>`).join('')}</details>` : ''}
    </div>`).join('') : `<div class="card">${empty('bar-chart', 'Belum ada data realisasi', 'Tambahkan bukti dukung & target terlebih dahulu.', '<button class="btn btn-soft btn-sm" data-act="nav" data-nav="bd">Atur bukti dukung</button>')}</div>`}`;
}

// ── 13. Halaman: Laporan SKP (side-by-side copy) ────────────
function skpGroups() {
  const mine = S.me.ID;
  const done = S.lap.filter(l => l.TahunID === S.tahunId && isDone(l));
  const groups = myBD().map(b => ({ id: b.ID, b, entries: done.filter(l => l.PegawaiID === mine && l.BuktiDukungID === b.ID) }));
  if (S.isAdmin && S.skpMode === 'gabung') {
    const myIds = new Set(groups.map(g => g.id));
    groups.forEach(g => { g.entries = g.entries.concat(done.filter(l => l.PegawaiID !== mine && l.Klaim === 'Y' && l.KlaimKe === g.id)); });
    const un = done.filter(l => l.PegawaiID !== mine && l.Klaim === 'Y' && !myIds.has(l.KlaimKe));
    if (un.length) groups.push({ id: '_un', b: { Nama: 'Klaim belum dipetakan ke RHK', Jenis: 'Klaim' }, entries: un });
  }
  groups.forEach(g => g.entries.sort((a, b) => (a.Tanggal || '').localeCompare(b.Tanggal || '')));
  return groups;
}
function renderSKP(sec) {
  const groups = skpGroups();
  const sel = S.open.skp && groups.find(g => g.id === S.open.skp) ? S.open.skp : null;
  if (!sel) S.open.skp = null;
  const cur = sel ? groups.find(g => g.id === sel) : (isWide() ? groups[0] : null);
  sec.innerHTML = `
    ${S.isAdmin ? `<div class="seg mb">${[['saya', 'Milik saya'], ['gabung', 'Gabungan + klaim staf']].map(([v, l]) => `<button class="${S.skpMode === v ? 'on' : ''}" data-act="skpMode" data-v="${v}">${l}</button>`).join('')}</div>` : ''}
    <div class="note mb"><i class="bi bi-layout-split"></i><div>Buka e-Kinerja di tab atau jendela lain, lalu salin isian dari sini satu per satu.</div></div>
    <div class="split ${sel ? 'show-detail' : ''}">
      <div class="pane-list"><div class="list">${groups.length ? groups.map(g => `
        <button class="item ${cur && cur.id === g.id ? 'on' : ''}" data-act="skpOpen" data-id="${g.id}">
          <span class="ic ${g.b.Jenis === 'Utama' ? 'brand' : g.b.Jenis === 'Klaim' ? 'warn' : 'info'}"><i class="bi bi-${g.id === '_un' ? 'flag' : 'bullseye'}"></i></span>
          <span class="body"><span class="t">${esc(g.b.Nama)}</span><span class="m"><span>${esc(g.b.Jenis)}</span><span>${g.entries.length} bukti</span></span></span>
          <i class="bi bi-chevron-right muted"></i></button>`).join('') : `<div class="card">${empty('bullseye', 'Belum ada bukti dukung', 'Tambahkan bukti dukung untuk tahun ini.')}</div>`}</div></div>
      <div class="pane-detail">${cur ? skpDetail(cur) : '<div class="placeholder"><i class="bi bi-layout-split"></i><p>Pilih bukti dukung.</p></div>'}</div>
    </div>`;
}
function skpDetail(g) {
  const all = g.entries.map((l, i) => `${i + 1}. ${l.Uraian}${l.PegawaiID !== S.me.ID ? ' (' + ((pegById(l.PegawaiID) || {}).Nama || 'staf') + ')' : ''} — ${linkOf(l)}`).join('\n');
  return `<div class="card card-pad"><span class="tag muted">${esc(g.b.Jenis)}</span><h3 class="h3 mt-s">${esc(g.b.Nama)}</h3>
      <p class="muted small" style="margin:4px 0 10px">${g.entries.length} bukti dukung final · tahun ${esc(tahunLabel())}</p>
      ${g.entries.length ? `<button class="copy-btn" data-act="copy" data-copy="${esc(all)}"><i class="bi bi-clipboard"></i><span>Salin semua tautan</span></button>` : ''}</div>
    ${g.entries.length ? g.entries.map((l, i) => skpEntry(l, i)).join('') : `<div class="card mt-s">${empty('inbox', 'Belum ada bukti final', 'Finalisasi laporan atau tambahkan link untuk bukti dukung ini.')}</div>`}`;
}
function copyRow(k, v) {
  return `<div class="copy-row"><div class="grow"><div class="k">${k}</div><div class="v">${v ? esc(v) : '<span class="muted">-</span>'}</div></div>${v ? `<button class="copy-btn" data-act="copy" data-copy="${esc(v)}"><i class="bi bi-clipboard"></i><span>Salin</span></button>` : ''}</div>`;
}
function skpEntry(l, i) {
  const own = l.PegawaiID === S.me.ID, p = pegById(l.PegawaiID);
  return `<div class="card card-pad mt-s"><div class="entry-h"><span class="num">${i + 1}</span><span class="muted small">${tgl(l.Tanggal, true)} · TW ${esc(l.TW)}${own ? '' : ` · <b>${esc(p ? p.Nama : 'Staf')}</b>`}</span></div>
    ${copyRow('Keterangan', l.Uraian)}${copyRow('Realisasi', l.Realisasi)}${copyRow('Sumber data', l.SumberData)}${copyRow('Tautan bukti', linkOf(l))}</div>`;
}

// ── 14. Halaman: Bukti dukung & target ──────────────────────
function renderBD(sec) {
  const list = myBD();
  sec.innerHTML = `<div class="row-between mb"><p class="muted small m0">Bukti dukung = rencana hasil kerja (RHK) beserta target jumlah per triwulan, tahun ${esc(tahunLabel())}.</p><button class="btn btn-pri btn-sm" data-act="bdEdit"><i class="bi bi-plus-lg"></i> Tambah</button></div>
    ${list.length ? `<div class="list">${list.map(b => {
      const tot = [1, 2, 3, 4].reduce((s, t) => s + num(b['TW' + t]), 0);
      const used = S.lap.filter(l => l.BuktiDukungID === b.ID).length;
      return `<button class="item" data-act="bdEdit" data-id="${b.ID}"><span class="ic ${b.Jenis === 'Utama' ? 'brand' : 'info'}"><i class="bi bi-bullseye"></i></span>
        <span class="body"><span class="t">${esc(b.Nama)}</span><span class="m"><span class="tag ${b.Jenis === 'Utama' ? 'brand' : 'info'}">${esc(b.Jenis)}</span><span>Target ${tot} ${esc(b.Satuan || '')}</span><span>${used} laporan</span></span>
        <span class="tw-mini">${[1, 2, 3, 4].map(t => `<span>TW${t} <b>${num(b['TW' + t])}</b></span>`).join('')}</span></span><i class="bi bi-pencil muted"></i></button>`;
    }).join('')}</div>` : `<div class="card">${empty('bullseye', 'Belum ada bukti dukung', 'Tambahkan sesuai SKP Anda tahun ini.')}</div>`}`;
}

// ── 15. Halaman: Akun ───────────────────────────────────────
function mi(icon, title, sub, act, extra) {
  return `<button class="mi ${extra && extra.cls ? extra.cls : ''}" data-act="${act}" ${extra && extra.nav ? `data-nav="${extra.nav}"` : ''}><span class="mi-ic"><i class="bi bi-${icon}"></i></span><span class="grow"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span><i class="bi bi-chevron-right muted"></i></button>`;
}
function renderAkun(sec) {
  const m = S.me;
  const dark = document.documentElement.dataset.theme === 'dark';
  const navs = ['realisasi', 'bd'].concat(S.isAdmin ? ['skp', 'pegawai', 'kua', 'log'] : []);
  sec.innerHTML = `<div class="card card-pad profile"><span class="avatar xl">${esc(initials(m.Nama))}</span><div class="grow"><h3 class="h3">${esc(m.Nama)}</h3><div class="muted small">${esc(m.Jabatan || '-')}</div><div class="muted small">NIP ${esc(m.NIP || '-')}</div><span class="tag ${S.isAdmin ? 'brand' : 'info'} mt-s">${S.isAdmin ? 'Kepala KUA · Admin' : 'ASN'} · KUA ${esc(S.kua.nama || '')}</span></div></div>
    <div class="menu card mt only-mobile">${navs.map(id => { const n = navDef(id); return mi(n.icon, n.label, '', 'nav', { nav: id }); }).join('')}</div>
    <div class="menu card mt">${mi('person-gear', 'Ubah profil', 'Nama, NIP, jabatan', 'editProfil')}${mi('key', 'Ganti PIN', 'PIN 6 digit untuk masuk', 'gantiPin')}${mi('file-earmark-zip', 'Cadangkan data saya', 'Unduh folder Anda dalam bentuk ZIP', 'backup')}</div>
    <div class="menu card mt"><div class="mi"><span class="mi-ic"><i class="bi bi-moon-stars"></i></span><span class="grow"><b>Mode gelap</b></span><label class="sw"><input type="checkbox" data-ch="theme" ${dark ? 'checked' : ''}><span></span></label></div>
      ${mi('box-arrow-right', 'Keluar', 'Kembali ke pilihan nama', 'logout')}${mi('phone', 'Lupakan perangkat ini', 'Keluar juga dari akun KUA', 'forget', { cls: 'mi-danger' })}</div>
    <p class="foot-brand">LABUKU One v${esc(BOOT.version || '')} · by Ahzani Labs</p>`;
}

// ── 16. Halaman Kepala KUA: Tim & Klaim ─────────────────────
function staffList() { return S.peg.filter(p => p.ID !== S.me.ID && p.Status === 'Aktif').sort((a, b) => a.Nama.localeCompare(b.Nama)); }
function renderTim(sec) {
  const staff = staffList();
  const sel = S.open.tim && staff.find(p => p.ID === S.open.tim) ? S.open.tim : null;
  if (!sel) S.open.tim = null;
  const waiting = p => S.lap.some(l => l.PegawaiID === p.ID && l.TahunID === S.tahunId && isDone(l) && l.Klaim !== 'Y');
  const cur = sel ? pegById(sel) : (isWide() ? (staff.find(waiting) || staff[0]) : null);
  sec.innerHTML = `<div class="split ${sel ? 'show-detail' : ''}"><div class="pane-list">
    <div class="note mb"><i class="bi bi-flag"></i><div>Tandai hasil kerja staf sebagai <b>diklaim</b> agar masuk rekap Laporan SKP gabungan Anda.</div></div>
    ${staff.length ? `<div class="list">${staff.map(p => {
      const ls = S.lap.filter(l => l.PegawaiID === p.ID && l.TahunID === S.tahunId && isDone(l));
      const bel = ls.filter(l => l.Klaim !== 'Y').length;
      const st = calcStats(p.ID, S.tahunId);
      return `<button class="item ${cur && cur.ID === p.ID ? 'on' : ''}" data-act="timOpen" data-id="${p.ID}"><span class="avatar">${esc(initials(p.Nama))}</span>
        <span class="body"><span class="t">${esc(p.Nama)}</span><span class="m"><span>${esc(p.Jabatan || '-')}</span></span><span class="bar"><i class="${barCls(st.pct)}" style="width:${st.pct}%"></i></span>
        <span class="m"><span>${ls.length} final · ${st.pct}%</span>${bel ? `<span class="tag warn">${bel} belum diklaim</span>` : ls.length ? '<span class="tag ok">Semua diklaim</span>' : ''}</span></span></button>`;
    }).join('')}</div>` : `<div class="card">${empty('people', 'Belum ada staf', 'Tambahkan pegawai terlebih dahulu.', '<button class="btn btn-soft btn-sm" data-act="nav" data-nav="pegawai">Kelola pegawai</button>')}</div>`}
  </div><div class="pane-detail">${cur ? timDetail(cur) : '<div class="placeholder"><i class="bi bi-people"></i><p>Pilih pegawai.</p></div>'}</div></div>`;
}
function timFiltered(p) {
  let ls = S.lap.filter(l => l.PegawaiID === p.ID && l.TahunID === S.tahunId && isDone(l));
  const cnt = { all: ls.length, belum: ls.filter(l => l.Klaim !== 'Y').length };
  if (S.tf.st === 'belum') ls = ls.filter(l => l.Klaim !== 'Y');
  else if (S.tf.st === 'klaim') ls = ls.filter(l => l.Klaim === 'Y');
  if (S.tf.tw) ls = ls.filter(l => String(l.TW) === S.tf.tw);
  ls.sort((a, b) => (a.Tanggal || '').localeCompare(b.Tanggal || ''));
  return { ls, cnt };
}
function timDetail(p) {
  const { ls, cnt } = timFiltered(p);
  const groups = [];
  ls.forEach(l => {
    let g = groups.find(x => x.id === l.BuktiDukungID);
    if (!g) { const b = bdById(l.BuktiDukungID); g = { id: l.BuktiDukungID, name: b ? b.Nama : 'Lainnya', items: [] }; groups.push(g); }
    g.items.push(l);
  });
  const all = ls.map((l, i) => `${i + 1}. ${(bdById(l.BuktiDukungID) || {}).Nama || ''} — ${l.Uraian}: ${linkOf(l)}`).join('\n');
  const opts = myBD();
  return `<div class="card card-pad"><div class="row gap"><span class="avatar lg">${esc(initials(p.Nama))}</span><div class="grow"><h3 class="h3">${esc(p.Nama)}</h3><div class="muted small">${esc(p.Jabatan || '-')} · NIP ${esc(p.NIP || '-')}</div></div></div>
      <div class="chips">${chipSet('timSt', [['belum', `Belum diklaim (${cnt.belum})`], ['klaim', 'Diklaim'], ['', `Semua (${cnt.all})`]], S.tf.st)}</div>
      <div class="chips">${chipSet('timTw', [['', 'Semua TW'], ['1', 'TW 1'], ['2', 'TW 2'], ['3', 'TW 3'], ['4', 'TW 4']], S.tf.tw)}</div>
      <div class="btn-row mt">${ls.length ? `<button class="copy-btn" data-act="copy" data-copy="${esc(all)}"><i class="bi bi-clipboard"></i><span>Salin semua link</span></button>` : ''}
        ${ls.some(l => l.Klaim !== 'Y') ? `<button class="btn btn-soft btn-sm" data-act="klaimAll" data-id="${p.ID}"><i class="bi bi-flag"></i> Klaim semua yang tampil</button>` : ''}
        <button class="btn btn-ghost btn-sm" data-act="backup" data-pid="${p.ID}"><i class="bi bi-file-earmark-zip"></i> ZIP</button></div></div>
    ${ls.length ? groups.map(g => `<div class="sec-title">${esc(g.name)}</div>${g.items.map(l => timEntry(l, opts)).join('')}`).join('') : `<div class="card mt-s">${empty('inbox', 'Tidak ada hasil kerja', 'Belum ada laporan final pada filter ini.')}</div>`}`;
}
function timEntry(l, opts) {
  const link = linkOf(l), on = l.Klaim === 'Y';
  return `<div class="card card-pad mt-s ${on ? 'entry claimed' : ''}">
    <div class="entry-h"><span class="muted small">${tgl(l.Tanggal, true)} · TW ${esc(l.TW)} · ${sumberLabel(l.Sumber)}</span></div>
    <div class="entry-t">${esc(l.Uraian)}</div>${l.Realisasi ? `<div class="muted small">Realisasi: ${esc(l.Realisasi)}</div>` : ''}
    ${link ? `<div class="linkbox"><i class="bi bi-link-45deg"></i><div class="grow v trunc">${esc(link)}</div><button class="copy-btn" data-act="copy" data-copy="${esc(link)}"><i class="bi bi-clipboard"></i><span>Salin</span></button><a class="icon-btn sm" href="${esc(link)}" target="_blank" rel="noopener" aria-label="Buka"><i class="bi bi-box-arrow-up-right"></i></a></div>` : ''}
    <div class="klaim-row"><label class="sw"><input type="checkbox" data-ch="klaim" data-id="${l.ID}" ${on ? 'checked' : ''}><span></span></label>
      <span class="small"><b>${on ? 'Diklaim' : 'Klaim'}</b>${on && l.KlaimAt ? ' · ' + tgl(String(l.KlaimAt).slice(0, 10), true) : ''}</span>
      ${on ? `<select class="inp inp-sm" data-ch="klaimKe" data-id="${l.ID}"><option value="">Petakan ke RHK saya…</option>${opts.map(b => `<option value="${b.ID}" ${b.ID === l.KlaimKe ? 'selected' : ''}>${esc(b.Nama)}</option>`).join('')}</select>` : ''}</div>
  </div>`;
}

// ── 17. Halaman Kepala KUA: Pegawai ─────────────────────────
function renderPegawai(sec) {
  const list = S.peg.slice().sort((a, b) => (a.Status === 'Aktif' ? 0 : 1) - (b.Status === 'Aktif' ? 0 : 1) || (a.Role === 'admin' ? 0 : 1) - (b.Role === 'admin' ? 0 : 1) || a.Nama.localeCompare(b.Nama));
  sec.innerHTML = `<div class="row-between mb"><p class="muted small m0">${list.filter(p => p.Status === 'Aktif').length} pegawai aktif. PIN tercatat di sini agar pegawai yang lupa tetap bisa dibantu masuk.</p><button class="btn btn-pri btn-sm" data-act="pegEdit"><i class="bi bi-person-plus"></i> Tambah</button></div>
    <div class="list">${list.map(p => `<div class="item"><span class="avatar">${esc(initials(p.Nama))}</span>
      <span class="body"><span class="t">${esc(p.Nama)}</span><span class="m"><span>${esc(p.Jabatan || '-')}</span>${p.Role === 'admin' ? '<span class="tag brand">Kepala KUA</span>' : ''}${p.Status !== 'Aktif' ? '<span class="tag muted">Nonaktif</span>' : ''}</span>
      <span class="m"><span class="pin-chip" data-pin="${esc(p.PIN || '')}">PIN <b class="pin-v">••••••</b></span><button class="link-btn" data-act="pinShow">Lihat</button></span></span>
      <button class="icon-btn" data-act="pegEdit" data-id="${p.ID}" aria-label="Ubah"><i class="bi bi-pencil"></i></button></div>`).join('')}</div>`;
}

// ── 18. Halaman Kepala KUA: Pengaturan KUA ──────────────────
function renderKua(sec) {
  const k = S.kua;
  const years = S.tahun.slice().sort((a, b) => b.Tahun.localeCompare(a.Tahun));
  sec.innerHTML = `<div class="grid g-md-2">
    <div class="card card-pad"><h3 class="h3">Identitas KUA</h3><p class="muted small">Tampil pada kop PDF laporan.</p>
      <form id="fKuaId">${fld('Nama KUA (kecamatan)', 'namaKua', { req: true, value: k.nama })}${fld('Kabupaten / Kota', 'kabupaten', { value: k.kabupaten })}${fld('Alamat kantor', 'alamat', { value: k.alamat })}${fld('Kota tanda tangan', 'kota', { value: k.kota, ph: 'Kosongkan = nama kabupaten' })}</form>
      <button class="btn btn-pri btn-block" data-act="kuaSave">Simpan identitas</button></div>
    <div class="card card-pad"><h3 class="h3">Akun KUA</h3><p class="muted small">Username saat ini: <b>${esc(k.username || '-')}</b>. Mengubah username/password mengeluarkan semua perangkat.</p>
      <form id="fKuaAcc" autocomplete="off">${fld('Username baru', 'newUsername', { ph: 'Kosongkan jika tetap', attrs: 'autocapitalize="none"' })}${pwFld('Password baru', 'newPassword', { ph: 'min. 6 karakter' })}${pwFld('Ulangi password baru', 'newPassword2')}${pwFld('Password KUA saat ini', 'currentPassword', { req: true })}</form>
      <button class="btn btn-ink btn-block" data-act="kuaAcc">Ubah akun KUA</button></div>
    <div class="card card-pad"><div class="row-between"><h3 class="h3">Tahun kinerja</h3><button class="btn btn-soft btn-sm" data-act="tahunAdd"><i class="bi bi-plus-lg"></i> Tahun</button></div>
      <div class="list mt-s">${years.map(t => `<div class="item"><span class="ic ${t.Aktif === 'Y' ? 'ok' : 'muted-bg'}"><i class="bi bi-calendar3"></i></span><span class="body"><span class="t">${esc(t.Tahun)}</span><span class="m">${t.Aktif === 'Y' ? '<span class="tag ok">Aktif</span>' : '<span>Tidak aktif</span>'}</span></span>
        ${t.Aktif !== 'Y' ? `<button class="btn btn-ghost btn-sm" data-act="tahunAktif" data-id="${t.ID}">Jadikan aktif</button><button class="icon-btn" data-act="tahunDel" data-id="${t.ID}" aria-label="Hapus"><i class="bi bi-trash3"></i></button>` : ''}</div>`).join('')}</div>
      <p class="hint">Tahun aktif menjadi tahun bawaan di semua perangkat.</p></div>
    <div class="card card-pad"><h3 class="h3">Penyimpanan</h3><p class="muted small">Semua file tersimpan di Google Drive akun KUA, folder “LABUKU One by Ahzani Labs”. Buka saat login dengan akun Google KUA.</p>
      <div class="btn-row"><a class="btn btn-ghost btn-sm" href="${esc(k.rootUrl || '#')}" target="_blank" rel="noopener"><i class="bi bi-folder2-open"></i> Folder Drive</a><a class="btn btn-ghost btn-sm" href="${esc(k.dbUrl || '#')}" target="_blank" rel="noopener"><i class="bi bi-table"></i> Database</a></div></div>
  </div>`;
}

// ── 19. Halaman Kepala KUA: Log ─────────────────────────────
function renderLog(sec) {
  sec.innerHTML = '<div class="pad"><div class="spinner"></div></div>';
  api('getLog').then(list => {
    if (S.page !== 'log') return;
    sec.innerHTML = list.length ? `<div class="list">${list.map(l => `<div class="item"><span class="ic ${/HAPUS|BATAL/.test(l.Aksi) ? 'bad' : /KLAIM|FINAL/.test(l.Aksi) ? 'ok' : 'info'}"><i class="bi bi-activity"></i></span>
      <span class="body"><span class="t">${esc(l.Nama)} <span class="tag muted">${esc(l.Aksi)}</span></span>${l.Detail ? `<span class="m">${esc(l.Detail)}</span>` : ''}<span class="m">${waktuLog(l.Waktu)}</span></span></div>`).join('')}</div>` : `<div class="card">${empty('clock-history', 'Belum ada aktivitas', '')}</div>`;
  }).catch(e => { sec.innerHTML = `<div class="card">${empty('exclamation-circle', 'Gagal memuat log', e.message)}</div>`; });
}

// ── 20. Sheet forms ─────────────────────────────────────────
function needBD() {
  openSheet({
    title: 'Belum ada bukti dukung',
    body: `<p class="muted">Tahun ${esc(tahunLabel())} belum memiliki bukti dukung. Tambahkan dulu bukti dukung (RHK) beserta target triwulan agar hasil kerja dihitung sebagai realisasi.</p>`,
    foot: '<button class="btn btn-ghost" data-act="closeSheet">Nanti</button><button class="btn btn-pri" data-act="bdEdit">Tambah bukti dukung</button>'
  });
}
function extFormHtml(kind, l) {
  const x = l || { BuktiDukungID: (myBD()[0] || {}).ID, TW: twOf(today()), Tanggal: today(), Uraian: '', Realisasi: '1 dokumen', SumberData: '', LinkUrl: '' };
  return `<form id="fExt" autocomplete="off">
    <div class="field"><label>Bukti dukung <span class="req">*</span></label><select class="inp" name="BuktiDukungID">${bdOptions(x.BuktiDukungID)}</select></div>
    <div class="row2"><div class="field"><label>Tanggal <span class="req">*</span></label><input type="date" class="inp" name="Tanggal" value="${esc(x.Tanggal)}"></div>
      <div class="field"><label>Triwulan</label><select class="inp" name="TW">${[1, 2, 3, 4].map(n => `<option value="${n}" ${String(n) === String(x.TW) ? 'selected' : ''}>TW ${n}</option>`).join('')}</select></div></div>
    ${fld('Keterangan singkat isi', 'Uraian', { req: true, textarea: true, rows: 2, value: x.Uraian, ph: 'Mis. Notulen rapat koordinasi penyuluh Juli 2026' })}
    ${kind === 'link'
      ? fld('Link Google Drive', 'LinkUrl', { req: true, type: 'url', value: x.LinkUrl, ph: 'https:\/\/drive.google.com/…', hint: 'Pastikan akses link diatur “Siapa saja yang memiliki link” agar Kepala KUA dan penilai dapat membukanya.' })
      : '<div class="field"><label>File PDF <span class="req">*</span></label><input type="file" class="inp" name="file" accept="application/pdf,.pdf"><div class="hint">Maksimal 10 MB. Disimpan di folder Anda pada Drive KUA.</div></div>'}
    <div class="row2">${fld('Realisasi', 'Realisasi', { value: x.Realisasi })}${fld('Sumber data', 'SumberData', { value: x.SumberData })}</div>
  </form>`;
}
function readExt() {
  const form = $('#fExt');
  const d = Object.fromEntries(new FormData(form));
  delete d.file;
  if (!d.BuktiDukungID) { toast('Pilih bukti dukung.', 'warn'); return null; }
  if (!d.Uraian || !d.Uraian.trim()) { toast('Isi keterangan singkat.', 'warn'); return null; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.Tanggal || '')) { toast('Tanggal belum diisi.', 'warn'); return null; }
  return d;
}
function pegForm(p) {
  const x = p || { Nama: '', NIP: '', Jabatan: '', Role: 'user', Status: 'Aktif', PIN: randPin() };
  return `<form id="fPeg" autocomplete="off">
    ${fld('Nama lengkap', 'Nama', { req: true, value: x.Nama, ph: 'Nama beserta gelar' })}
    <div class="row2">${fld('NIP', 'NIP', { value: x.NIP, attrs: 'inputmode="numeric"' })}${fld('Jabatan', 'Jabatan', { value: x.Jabatan, attrs: 'list="jabList"', ph: 'Penghulu' })}</div>
    <datalist id="jabList"><option>Kepala KUA</option><option>Penghulu</option><option>Penyuluh Agama Islam</option><option>Pelaksana</option><option>Penata Layanan Operasional</option><option>Pengadministrasi Perkantoran</option></datalist>
    <div class="row2"><div class="field"><label>Peran</label><select class="inp" name="Role"><option value="user" ${x.Role !== 'admin' ? 'selected' : ''}>ASN</option><option value="admin" ${x.Role === 'admin' ? 'selected' : ''}>Kepala KUA (admin)</option></select></div>
      <div class="field"><label>Status</label><select class="inp" name="Status"><option ${x.Status === 'Aktif' ? 'selected' : ''}>Aktif</option><option ${x.Status === 'Nonaktif' ? 'selected' : ''}>Nonaktif</option></select></div></div>
    <div class="field"><label>PIN (6 digit) <span class="req">*</span></label><div class="pw-wrap"><input class="inp" name="PIN" value="${esc(x.PIN || '')}" inputmode="numeric" maxlength="6" pattern="[0-9]*"><button type="button" class="icon-btn" data-act="pinRand" aria-label="Acak PIN"><i class="bi bi-shuffle"></i></button></div><div class="hint">Pegawai dapat menggantinya sendiri di menu Akun.</div></div>
  </form>`;
}

// ── 21. Aksi (event delegation) ─────────────────────────────
const ACT = {
  closeSheet: () => closeSheet(),
  back: () => back(),
  nav: ds => { closeSheet(true); go(ds.nav); },
  togglePw: (ds, el) => { const i = el.parentElement.querySelector('input'); const show = i.type === 'password'; i.type = show ? 'text' : 'password'; el.innerHTML = `<i class="bi bi-eye${show ? '-slash' : ''}"></i>`; },
  copy: (ds, el) => copyText(ds.copy, el),
  preview: ds => {
    const id = pdfId(ds.url);
    openSheet({ title: 'Pratinjau PDF', wide: true, body: `<div class="pv"><iframe src="https:\/\/drive.google.com/file/d/${esc(id)}/preview" allow="autoplay"></iframe></div>`, foot: `<a class="btn btn-ghost" href="${esc(ds.url)}" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right"></i> Buka di Drive</a>` });
  },

  // Auth
  pickName: ds => { const p = (S._names || []).find(x => x.ID === ds.id); if (p) renderPin(p); },
  backNames: () => renderNames(store.get('names', [])),
  forgetDevice: () => { store.del('kua'); store.del('names'); S.kuaToken = null; renderLoginKua(); },
  pinKey: ds => {
    if (!S.pinFor || S.pinBusy) return;
    if (ds.k === 'del') S.pinVal = S.pinVal.slice(0, -1);
    else if (ds.k === 'clr') S.pinVal = '';
    else if (S.pinVal.length < 6) S.pinVal += ds.k;
    paintPin();
    if (S.pinVal.length === 6) submitPin();
  },

  // Tahun
  pickTahun: () => {
    const ys = S.tahun.slice().sort((a, b) => b.Tahun.localeCompare(a.Tahun));
    openSheet({ title: 'Pilih tahun kinerja', body: `<div class="opt-list">${ys.map(t => `<button class="opt" data-act="setTahun" data-id="${t.ID}"><span class="ic ${t.ID === S.tahunId ? 'brand' : 'muted-bg'}"><i class="bi bi-calendar3"></i></span><span><b>${esc(t.Tahun)}</b><small>${t.Aktif === 'Y' ? 'Tahun aktif' : '&nbsp;'}</small></span>${t.ID === S.tahunId ? '<i class="bi bi-check2"></i>' : ''}</button>`).join('')}</div>` });
  },
  setTahun: ds => { S.tahunId = ds.id; S.open = {}; closeSheet(); renderPage(); },

  // Tambah
  newMenu: () => {
    if (!myBD().length) return needBD();
    openSheet({
      title: 'Tambah hasil kerja',
      body: `<div class="opt-list">
        <button class="opt" data-act="newLap"><span class="ic brand"><i class="bi bi-journal-plus"></i></span><span><b>Laporan kegiatan</b><small>Isi uraian & foto, PDF dibuat otomatis</small></span><i class="bi bi-chevron-right muted"></i></button>
        <button class="opt" data-act="newLink"><span class="ic info"><i class="bi bi-link-45deg"></i></span><span><b>Tempel link Drive</b><small>Hasil kerja yang dibuat di luar aplikasi</small></span><i class="bi bi-chevron-right muted"></i></button>
        <button class="opt" data-act="newUpload"><span class="ic ok"><i class="bi bi-file-earmark-arrow-up"></i></span><span><b>Unggah PDF</b><small>File PDF hasil kerja, maksimal 10 MB</small></span><i class="bi bi-chevron-right muted"></i></button>
      </div>`
    });
  },
  newLap: () => { closeSheet(true); startForm(null, 1); },
  newLink: () => openSheet({ title: 'Tempel link hasil kerja', body: extFormHtml('link'), foot: '<button class="btn btn-ghost" data-act="closeSheet">Batal</button><button class="btn btn-pri" data-act="saveLink">Simpan</button>' }),
  editLink: ds => { const l = lapById(ds.id); if (l) openSheet({ title: 'Ubah link hasil kerja', body: extFormHtml('link', l), foot: `<button class="btn btn-ghost" data-act="closeSheet">Batal</button><button class="btn btn-pri" data-act="saveLink" data-id="${l.ID}">Simpan</button>` }); },
  saveLink: ds => {
    const d = readExt();
    if (!d) return;
    if (!/^https?:\/\/\S+$/i.test((d.LinkUrl || '').trim())) return toast('Link harus diawali https:\/\/', 'warn');
    d.LinkUrl = d.LinkUrl.trim();
    const id = ds.id || uuid(), ex = lapById(id), b = bdById(d.BuktiDukungID);
    const rec = Object.assign({}, ex || {}, d, { ID: id, PegawaiID: S.me.ID, TahunID: b.TahunID, Sumber: 'LINK', Status: 'FINAL', UpdatedAt: nowIso() });
    if (!ex) Object.assign(rec, { CreatedAt: rec.UpdatedAt, Versi: '0', Klaim: '', PdfUrl: '' });
    const prev = ex ? Object.assign({}, ex) : null;
    upsertLocal(rec);
    closeSheet();
    S.open.laporan = id;
    if (S.page === 'laporan') renderPage(); else go('laporan');
    toast('Link tersimpan.');
    syncSave(id, Object.assign({ ID: id, Sumber: 'LINK' }, d), prev);
  },
  newUpload: () => openSheet({ title: 'Unggah PDF hasil kerja', body: extFormHtml('upload'), foot: '<button class="btn btn-ghost" data-act="closeSheet">Batal</button><button class="btn btn-pri" data-act="saveUpload"><i class="bi bi-cloud-arrow-up"></i> Unggah</button>' }),
  saveUpload: async (ds, btn) => {
    const file = $('#fExt [name=file]').files[0];
    const d = readExt();
    if (!d) return;
    if (!file) return toast('Pilih file PDF.', 'warn');
    if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) return toast('File harus PDF.', 'warn');
    if (file.size > 10 * 1024 * 1024) return toast('Ukuran PDF maksimal 10 MB.', 'warn');
    btnLoad(btn, true, 'Mengunggah…');
    try {
      const b64 = await readB64(file);
      const r = await api('uploadPdf', { meta: d, b64, name: file.name });
      upsertLocal(r);
      closeSheet();
      S.open.laporan = r.ID;
      if (S.page === 'laporan') renderPage(); else go('laporan');
      toast('PDF terunggah ke Drive KUA.');
    } catch (e) { toast(e.message, 'bad'); btnLoad(btn, false); }
  },

  // Laporan
  openLap: ds => {
    S.open.laporan = ds.id;
    if (S.page !== 'laporan') { go('laporan'); return; }
    if (isWide()) { renderLapList(); renderLapDetail(); } else { renderPage(); window.scrollTo(0, 0); }
  },
  lapTw: (ds, el) => { S.f.tw = ds.v; $$('[data-act=lapTw]').forEach(b => b.classList.toggle('on', b === el)); renderLapList(); },
  lapSt: (ds, el) => { S.f.st = ds.v; $$('[data-act=lapSt]').forEach(b => b.classList.toggle('on', b === el)); renderLapList(); },
  editLap: ds => { const l = lapById(ds.id); if (l) startForm(l, +ds.step || 1); },
  delLap: async ds => {
    const l = lapById(ds.id);
    if (!l) return;
    const final = isDone(l) && l.Sumber !== 'LINK';
    if (!await confirmBox(final ? 'Hapus hasil kerja final ini beserta semua versi PDF-nya?' : 'Hapus hasil kerja ini?', 'Hapus', true)) return;
    const prev = Object.assign({}, l);
    removeLocal(l.ID);
    S.open.laporan = null;
    IDB.del('ph_' + l.ID);
    renderPage();
    api('deleteLaporan', { id: l.ID }).then(() => toast('Terhapus.')).catch(e => { upsertLocal(prev); softRefresh(); toast(e.message, 'bad'); });
  },
  versi: async ds => {
    openSheet({ title: 'Riwayat versi PDF', body: '<div class="pad"><div class="spinner"></div></div>' });
    try {
      const list = await api('getVersi', { id: ds.id });
      sheetBody(list.length ? `<div class="list">${list.map(v => `<div class="item"><span class="ic ${v.Status === 'Active' ? 'ok' : 'muted-bg'}"><i class="bi bi-file-earmark-pdf"></i></span>
        <span class="body"><span class="t">Versi ${esc(v.Versi)} ${v.Status === 'Active' ? '<span class="tag ok">Aktif</span>' : '<span class="tag muted">Arsip</span>'}</span><span class="m">${waktuLog(v.CreatedAt)}</span>
        <span class="btn-row mt-s"><button class="copy-btn" data-act="copy" data-copy="${esc(v.PdfUrl)}"><i class="bi bi-clipboard"></i><span>Salin link</span></button><button class="btn btn-ghost btn-sm" data-act="preview" data-url="${esc(v.PdfUrl)}"><i class="bi bi-eye"></i> Pratinjau</button></span></span></div>`).join('')}</div>` : empty('file-earmark', 'Belum ada versi', ''));
    } catch (e) { closeSheet(); toast(e.message, 'bad'); }
  },

  // Form
  fdTw: (ds, el) => { S.draft.data.TW = ds.v; $$('#segTw button').forEach(b => b.classList.toggle('on', b === el)); saveFormDraft(); },
  formStep: ds => { S.draft.step = +ds.v; renderPage(); window.scrollTo(0, 0); },
  formCancel: async () => {
    if (!S.draft.isEdit && S.draft.data.Uraian && !await confirmBox('Buang isian laporan ini?', 'Buang', true)) return;
    if (!S.draft.isEdit) store.del('formDraft');
    const id = S.draft.ID; S.draft = null;
    if (id) S.open.laporan = id;
    go('laporan');
  },
  formNext1: () => {
    const x = S.draft.data;
    if (!x.BuktiDukungID || !x.Tanggal || !String(x.Uraian).trim() || !String(x.Realisasi).trim()) return toast('Lengkapi kolom bertanda *.', 'warn');
    const id = S.draft.ID || uuid(), ex = lapById(id), b = bdById(x.BuktiDukungID);
    const rec = Object.assign({}, ex || {}, x, { ID: id, PegawaiID: S.me.ID, TahunID: b.TahunID, Sumber: 'APP', Status: ex ? (isDone(ex) ? 'REVISI' : ex.Status) : 'DRAFT', UpdatedAt: nowIso() });
    if (!ex) Object.assign(rec, { CreatedAt: rec.UpdatedAt, Versi: '0', Klaim: '' });
    const prev = ex ? Object.assign({}, ex) : null;
    upsertLocal(rec);
    S.draft.ID = id; S.draft.isEdit = true;
    store.del('formDraft');
    syncSave(id, Object.assign({ ID: id }, x), prev);
    S.draft.step = 2;
    renderPage(); window.scrollTo(0, 0);
  },
  phDel: ds => { S.draft.photos.splice(+ds.i, 1); if (S.draft.ID) IDB.set('ph_' + S.draft.ID, S.draft.photos.slice()); renderPage(); },
  formDraftDone: () => { const id = S.draft.ID; S.draft = null; S.open.laporan = id; toast('Draft tersimpan. Foto tetap tersimpan di perangkat ini.'); go('laporan'); },
  formFinal: async () => {
    const id = S.draft.ID;
    busy(true, 'Menyimpan data…');
    try {
      if (S.pending[id]) await S.pending[id];
      busy(true, 'Menyusun PDF… mohon tunggu');
      const r = await api('finalize', { id, photos: S.draft.photos });
      upsertLocal(r);
      await IDB.del('ph_' + id);
      S.draft = null; S.open.laporan = id;
      busy(false);
      toast('Final. PDF tersimpan di Drive KUA.');
      go('laporan');
    } catch (e) { busy(false); toast(e.message, 'bad'); }
  },

  // SKP
  skpMode: ds => { S.skpMode = ds.v; S.open.skp = null; renderPage(); },
  skpOpen: ds => { S.open.skp = ds.id; renderPage(); if (!isWide()) window.scrollTo(0, 0); },

  // Bukti dukung
  bdEdit: ds => {
    if (!S.tahunId) return toast('Belum ada tahun kinerja. Minta Kepala KUA menambahkannya.', 'warn');
    const b = ds.id ? bdById(ds.id) : null;
    const x = b || { Nama: '', Jenis: 'Utama', Satuan: 'Dokumen', TW1: '', TW2: '', TW3: '', TW4: '' };
    openSheet({
      title: b ? 'Ubah bukti dukung' : 'Tambah bukti dukung',
      body: `<form id="fBD">${fld('Nama bukti dukung / RHK', 'Nama', { req: true, textarea: true, rows: 2, value: x.Nama, ph: 'Mis. Laporan bimbingan perkawinan' })}
        <div class="row2"><div class="field"><label>Jenis</label><select class="inp" name="Jenis"><option ${x.Jenis !== 'Tambahan' ? 'selected' : ''}>Utama</option><option ${x.Jenis === 'Tambahan' ? 'selected' : ''}>Tambahan</option></select></div>${fld('Satuan', 'Satuan', { value: x.Satuan, ph: 'Dokumen' })}</div>
        <div class="field"><label>Target per triwulan</label><div class="tw-inputs">${[1, 2, 3, 4].map(t => `<div><label>TW ${t}</label><input class="inp" type="number" min="0" inputmode="numeric" name="TW${t}" value="${esc(x['TW' + t])}" placeholder="0"></div>`).join('')}</div></div></form>`,
      foot: `${b ? `<button class="btn btn-bad" data-act="bdDel" data-id="${b.ID}" aria-label="Hapus"><i class="bi bi-trash3"></i></button>` : ''}<button class="btn btn-ghost" data-act="closeSheet">Batal</button><button class="btn btn-pri" data-act="bdSave" data-id="${b ? b.ID : ''}">Simpan</button>`
    });
  },
  bdSave: ds => {
    const d = Object.fromEntries(new FormData($('#fBD')));
    if (!d.Nama.trim()) return toast('Nama wajib diisi.', 'warn');
    const id = ds.id || uuid(), ex = bdById(id);
    const rec = Object.assign({}, ex || {}, d, { ID: id, PegawaiID: S.me.ID, TahunID: ex ? ex.TahunID : S.tahunId, UpdatedAt: nowIso() });
    [1, 2, 3, 4].forEach(t => { rec['TW' + t] = String(Math.max(0, Math.floor(num(rec['TW' + t])))); });
    if (!ex) rec.CreatedAt = rec.UpdatedAt;
    const prev = ex ? Object.assign({}, ex) : null;
    upsertBDLocal(rec);
    closeSheet(); renderPage(); toast('Bukti dukung tersimpan.');
    api('saveBD', rec).then(r => { upsertBDLocal(r); }).catch(e => {
      if (prev) upsertBDLocal(prev); else { S.bd = S.bd.filter(x => x.ID !== id); persist(); }
      softRefresh(); toast('Gagal menyimpan: ' + e.message, 'bad');
    });
  },
  bdDel: async ds => {
    const used = S.lap.filter(l => l.BuktiDukungID === ds.id).length;
    if (used) return toast(`Masih dipakai ${used} laporan.`, 'warn');
    if (!await confirmBox('Hapus bukti dukung ini?', 'Hapus', true)) return;
    const prev = bdById(ds.id);
    S.bd = S.bd.filter(b => b.ID !== ds.id); persist(); renderPage();
    api('deleteBD', { id: ds.id }).then(() => toast('Terhapus.')).catch(e => { if (prev) upsertBDLocal(prev); softRefresh(); toast(e.message, 'bad'); });
  },

  // Akun
  editProfil: () => openSheet({
    title: 'Ubah profil',
    body: `<form id="fProf">${fld('Nama lengkap', 'Nama', { req: true, value: S.me.Nama })}${fld('NIP', 'NIP', { value: S.me.NIP, attrs: 'inputmode="numeric"' })}${fld('Jabatan', 'Jabatan', { value: S.me.Jabatan })}</form>`,
    foot: '<button class="btn btn-ghost" data-act="closeSheet">Batal</button><button class="btn btn-pri" data-act="saveProfil">Simpan</button>'
  }),
  saveProfil: async (ds, btn) => {
    const d = Object.fromEntries(new FormData($('#fProf')));
    if (!d.Nama.trim()) return toast('Nama wajib diisi.', 'warn');
    btnLoad(btn, true, 'Menyimpan…');
    try {
      const r = await api('saveProfil', d);
      S.me = Object.assign({}, S.me, r);
      const i = S.peg.findIndex(p => p.ID === r.ID); if (i >= 0) S.peg[i] = Object.assign({}, S.peg[i], r);
      persist(); buildNav(); closeSheet(); renderPage(); toast('Profil diperbarui.');
    } catch (e) { toast(e.message, 'bad'); btnLoad(btn, false); }
  },
  gantiPin: () => openSheet({
    title: 'Ganti PIN',
    body: `<form id="fPin">${fld('PIN lama', 'oldPin', { type: 'password', attrs: 'inputmode="numeric" maxlength="6" pattern="[0-9]*"' })}${fld('PIN baru', 'newPin', { type: 'password', attrs: 'inputmode="numeric" maxlength="6" pattern="[0-9]*"' })}${fld('Ulangi PIN baru', 'newPin2', { type: 'password', attrs: 'inputmode="numeric" maxlength="6" pattern="[0-9]*"', hint: 'PIN tercatat oleh Kepala KUA untuk membantu jika Anda lupa.' })}</form>`,
    foot: '<button class="btn btn-ghost" data-act="closeSheet">Batal</button><button class="btn btn-pri" data-act="savePin">Simpan PIN</button>'
  }),
  savePin: async (ds, btn) => {
    const d = Object.fromEntries(new FormData($('#fPin')));
    if (!/^\d{6}$/.test(d.newPin)) return toast('PIN baru harus 6 digit angka.', 'warn');
    if (d.newPin !== d.newPin2) return toast('Ulangan PIN tidak sama.', 'warn');
    btnLoad(btn, true, 'Menyimpan…');
    try {
      const r = await api('changePin', d);
      S.token = r.token; store.set('sess', r.token);
      closeSheet(); toast('PIN berhasil diganti.');
    } catch (e) { toast(e.message, 'bad'); btnLoad(btn, false); }
  },
  backup: async ds => {
    const pid = ds.pid || null;
    const who = pid ? (pegById(pid) || {}).Nama : 'Anda';
    if (!await confirmBox(`Siapkan ZIP berisi folder ${who} (PDF bukti dukung + daftar laporan)?`, 'Siapkan ZIP')) return;
    busy(true, 'Menyiapkan ZIP…');
    try {
      const r = await api('backup', pid ? { pid } : {});
      busy(false);
      openSheet({
        title: 'ZIP siap diunduh',
        body: `<p class="muted">${esc(r.name)} · ${(r.size / 1048576).toFixed(1)} MB · ${r.files} file</p><a class="btn btn-pri btn-block" href="${esc(r.url)}" target="_blank" rel="noopener"><i class="bi bi-download"></i> Unduh ZIP</a><p class="hint">Tautan otomatis dihapus ±2 jam setelah dibuat.</p>`
      });
    } catch (e) { busy(false); toast(e.message, 'bad'); }
  },
  logout: () => logout(false),
  forget: async () => { if (await confirmBox('Keluar dan lupakan akun KUA di perangkat ini?', 'Ya, lupakan', true)) logout(true); },

  // Tim & klaim
  timOpen: ds => { S.open.tim = ds.id; renderPage(); if (!isWide()) window.scrollTo(0, 0); },
  timSt: ds => { S.tf.st = ds.v; if (!S.open.tim && staffList()[0]) S.open.tim = isWide() ? staffList()[0].ID : null; renderPage(); },
  timTw: ds => { S.tf.tw = ds.v; if (!S.open.tim && staffList()[0]) S.open.tim = isWide() ? staffList()[0].ID : null; renderPage(); },
  klaimAll: async ds => {
    const p = pegById(ds.id);
    const ids = timFiltered(p).ls.filter(l => l.Klaim !== 'Y').map(l => l.ID);
    if (!ids.length) return;
    if (!await confirmBox(`Klaim ${ids.length} hasil kerja ${p.Nama}?`, 'Klaim semua')) return;
    const now = nowIso(), prev = ids.map(id => Object.assign({}, lapById(id)));
    ids.forEach(id => Object.assign(lapById(id), { Klaim: 'Y', KlaimAt: now }));
    persist(); renderPage();
    api('klaimBatch', { ids, klaim: true }).then(r => toast(`${r.ids.length} hasil kerja diklaim.`)).catch(e => { prev.forEach(o => upsertLocal(o)); renderPage(); toast(e.message, 'bad'); });
  },

  // Pegawai
  pinShow: (ds, el) => {
    const chip = el.previousElementSibling, v = chip.querySelector('.pin-v');
    const hidden = v.textContent === '••••••';
    v.textContent = hidden ? chip.dataset.pin : '••••••';
    el.textContent = hidden ? 'Sembunyikan' : 'Lihat';
  },
  pinRand: () => { const i = $('#fPeg [name=PIN]'); if (i) i.value = randPin(); },
  pegEdit: ds => {
    const p = ds.id ? pegById(ds.id) : null;
    openSheet({ title: p ? 'Ubah pegawai' : 'Tambah pegawai', body: pegForm(p), foot: `<button class="btn btn-ghost" data-act="closeSheet">Batal</button><button class="btn btn-pri" data-act="pegSave" data-id="${p ? p.ID : ''}">Simpan</button>` });
  },
  pegSave: async (ds, btn) => {
    const d = Object.fromEntries(new FormData($('#fPeg')));
    if (!d.Nama.trim()) return toast('Nama wajib diisi.', 'warn');
    if (!/^\d{6}$/.test(d.PIN)) return toast('PIN harus 6 digit angka.', 'warn');
    if (ds.id) d.ID = ds.id;
    btnLoad(btn, true, 'Menyimpan…');
    try {
      const r = await api('savePegawai', d);
      const i = S.peg.findIndex(p => p.ID === r.peg.ID);
      if (i >= 0) S.peg[i] = r.peg; else S.peg.push(r.peg);
      if (r.peg.ID === S.me.ID) {
        S.me = Object.assign({}, S.me, r.peg);
        if (r.token) { S.token = r.token; store.set('sess', r.token); }
        if (r.peg.Role !== 'admin') { persist(); closeSheet(); toast('Peran Anda diubah. Silakan masuk kembali.', 'warn'); logout(false); return; }
      }
      persist(); closeSheet(); renderPage(); toast(ds.id ? 'Pegawai diperbarui.' : 'Pegawai ditambahkan & folder Drive dibuat.');
    } catch (e) { toast(e.message, 'bad'); btnLoad(btn, false); }
  },

  // KUA
  kuaSave: async (ds, btn) => {
    const d = Object.fromEntries(new FormData($('#fKuaId')));
    if (!d.namaKua.trim()) return toast('Nama KUA wajib diisi.', 'warn');
    btnLoad(btn, true, 'Menyimpan…');
    try {
      const r = await api('saveKua', d);
      S.kua = Object.assign({}, S.kua, r.kua); BOOT.namaKua = S.kua.nama;
      persist(); buildNav(); go('kua'); toast('Identitas KUA disimpan.');
    } catch (e) { toast(e.message, 'bad'); btnLoad(btn, false); }
  },
  kuaAcc: async (ds, btn) => {
    const d = Object.fromEntries(new FormData($('#fKuaAcc')));
    if (!d.newUsername && !d.newPassword) return toast('Isi username atau password baru.', 'warn');
    if (d.newPassword && d.newPassword.length < 6) return toast('Password minimal 6 karakter.', 'warn');
    if (d.newPassword !== d.newPassword2) return toast('Ulangan password tidak sama.', 'warn');
    if (!d.currentPassword) return toast('Isi password KUA saat ini.', 'warn');
    if (!await confirmBox('Semua perangkat lain akan keluar dan harus masuk ulang. Lanjutkan?', 'Ubah akun', true)) return;
    btnLoad(btn, true, 'Menyimpan…');
    try {
      const r = await api('saveKua', { newUsername: d.newUsername, newPassword: d.newPassword, currentPassword: d.currentPassword });
      S.kua = Object.assign({}, S.kua, r.kua);
      if (r.kuaToken) { S.kuaToken = r.kuaToken; store.set('kua', r.kuaToken); }
      if (r.token) { S.token = r.token; store.set('sess', r.token); }
      persist(); go('kua'); toast('Akun KUA diperbarui.');
    } catch (e) { toast(e.message, 'bad'); btnLoad(btn, false); }
  },
  tahunAdd: () => openSheet({
    title: 'Tambah tahun kinerja',
    body: `<form id="fTh">${fld('Tahun', 'Tahun', { type: 'number', value: String(new Date().getFullYear() + 1), attrs: 'inputmode="numeric" min="2020" max="2099"' })}<label class="row gap small"><input type="checkbox" name="Aktif" value="Y"> Jadikan tahun aktif</label></form>`,
    foot: '<button class="btn btn-ghost" data-act="closeSheet">Batal</button><button class="btn btn-pri" data-act="tahunSave">Simpan</button>'
  }),
  tahunSave: async (ds, btn) => {
    const d = Object.fromEntries(new FormData($('#fTh')));
    btnLoad(btn, true, 'Menyimpan…');
    try {
      S.tahun = await api('saveTahun', { Tahun: d.Tahun, Aktif: d.Aktif === 'Y' ? 'Y' : 'N' });
      if (d.Aktif === 'Y') S.tahunId = (S.tahun.find(t => t.Aktif === 'Y') || {}).ID || S.tahunId;
      persist(); closeSheet(); renderPage(); toast('Tahun disimpan.');
    } catch (e) { toast(e.message, 'bad'); btnLoad(btn, false); }
  },
  tahunAktif: async (ds, btn) => {
    const t = tahunById(ds.id);
    btnLoad(btn, true, '…');
    try { S.tahun = await api('saveTahun', { ID: t.ID, Tahun: t.Tahun, Aktif: 'Y' }); S.tahunId = t.ID; S.open = {}; persist(); renderPage(); toast(`Tahun ${t.Tahun} aktif.`); }
    catch (e) { toast(e.message, 'bad'); btnLoad(btn, false); }
  },
  tahunDel: async ds => {
    if (!await confirmBox('Hapus tahun kinerja ini?', 'Hapus', true)) return;
    try { S.tahun = await api('deleteTahun', { id: ds.id }); persist(); renderPage(); toast('Tahun dihapus.'); }
    catch (e) { toast(e.message, 'bad'); }
  },
  logRefresh: () => renderPage()
};

const IN = {
  nameQ: el => { const q = el.value.trim().toLowerCase(); $$('#nameList .name-btn').forEach(b => { b.hidden = q && !b.dataset.q.includes(q); }); },
  lapQ: el => { clearTimeout(IN._t); IN._t = setTimeout(() => { S.f.q = el.value; renderLapList(); }, 160); },
  fd: el => {
    if (!S.draft) return;
    S.draft.data[el.name] = el.value;
    if (el.name === 'Tanggal' && el.value) {
      S.draft.data.TW = twOf(el.value);
      $$('#segTw button').forEach(b => b.classList.toggle('on', b.dataset.v === S.draft.data.TW));
    }
    saveFormDraft();
  }
};
function saveFormDraft() { if (S.draft && !S.draft.isEdit) store.set('formDraft', S.draft.data); }

const CH = {
  theme: el => applyTheme(el.checked ? 'dark' : 'light'),
  phAdd: async el => {
    const room = 4 - S.draft.photos.length;
    const files = Array.from(el.files || []).slice(0, room);
    el.value = '';
    if (!files.length) return;
    busy(true, 'Mengompres foto…');
    try {
      for (const f of files) S.draft.photos.push(await compressImage(f));
      if (S.draft.ID) IDB.set('ph_' + S.draft.ID, S.draft.photos.slice());
    } catch (e) { toast(e.message, 'bad'); }
    busy(false);
    renderPage();
  },
  klaim: el => { const l = lapById(el.dataset.id); if (l) setKlaim(l, el.checked, el.checked ? (l.KlaimKe || '') : ''); },
  klaimKe: el => { const l = lapById(el.dataset.id); if (l) setKlaim(l, true, el.value); }
};
function setKlaim(l, on, ke) {
  const prev = { Klaim: l.Klaim, KlaimKe: l.KlaimKe, KlaimAt: l.KlaimAt };
  Object.assign(l, { Klaim: on ? 'Y' : '', KlaimKe: on ? ke : '', KlaimAt: on ? (l.KlaimAt || nowIso()) : '' });
  persist();
  if (!on || prev.Klaim !== 'Y') renderPage();
  api('toggleKlaim', { id: l.ID, klaim: on, klaimKe: ke })
    .then(r => { Object.assign(l, r); persist(); })
    .catch(e => { Object.assign(l, prev); persist(); renderPage(); toast(e.message, 'bad'); });
}

// ── 22. Bootstrap aplikasi ──────────────────────────────────
function bindGlobal() {
  document.addEventListener('submit', e => e.preventDefault(), true);
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = ACT[el.dataset.act];
    if (!fn) return;
    e.preventDefault();
    fn(el.dataset, el, e);
  });
  document.addEventListener('input', e => { const el = e.target.closest('[data-in]'); if (el && IN[el.dataset.in]) IN[el.dataset.in](el, e); });
  document.addEventListener('change', e => { const el = e.target.closest('[data-ch]'); if (el && CH[el.dataset.ch]) CH[el.dataset.ch](el, e); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sheetEl) closeSheet();
    if (S.pinFor && !$('#screen-auth').hidden && !sheetEl) {
      if (/^\d$/.test(e.key)) ACT.pinKey({ k: e.key });
      else if (e.key === 'Backspace') ACT.pinKey({ k: 'del' });
    }
  });
  window.addEventListener('scroll', () => { const b = $('#appbar'); if (b) b.classList.toggle('scrolled', window.scrollY > 4); }, { passive: true });
  const mq = window.matchMedia('(min-width:768px)');
  const onMq = () => { if (S.me && S.page !== 'form') renderPage(); };
  if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
}

// Info awal (dulu disuntikkan GAS ke HTML) kini diambil lewat API apiBoot.
// Disimpan di perangkat agar pembukaan berikutnya tetap instan.
function start() {
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(store.get('theme', prefersDark ? 'dark' : 'light'));
  bindGlobal();
  const cachedBoot = store.get('bootinfo');
  if (cachedBoot) { runBoot(cachedBoot); refreshBootInfo(cachedBoot); return; }
  gs('apiBoot')
    .then(b => { store.set('bootinfo', b); runBoot(b); })
    .catch(e => renderOffline(e.message));
}
function refreshBootInfo(old) {
  gs('apiBoot').then(b => {
    store.set('bootinfo', b);
    const changed = b.configured !== old.configured || b.setupOpen !== old.setupOpen;
    Object.assign(BOOT, b);
    if (changed && !S.me) runBoot(b);
  }).catch(() => {});
}
function renderOffline(msg) {
  authShell(`<h2>Tidak dapat memuat</h2><p class="sub">${esc(msg)}</p><button class="btn btn-pri btn-block" type="button" onclick="location.reload()"><i class="bi bi-arrow-clockwise"></i> Coba lagi</button>`);
}
function runBoot(b) {
  Object.assign(BOOT, b);
  document.title = BOOT.namaKua ? 'LABUKU One · KUA ' + BOOT.namaKua : 'LABUKU One';
  if (!BOOT.configured) { renderSetup(); return; }
  const sess = store.get('sess'), st = sess && decodeTok(sess);
  if (st && st.exp > Date.now()) {
    S.token = sess; S.kuaToken = store.get('kua');
    const cached = store.get('boot_' + st.pid);
    if (cached) { enterApp(cached); revalidate(); return; }   // tampil instan dari cache, segarkan di latar
    authShell('<div class="pad center"><div class="spinner"></div><p class="sub" style="margin-top:12px">Memuat data…</p></div>');
    api('bootstrap').then(enterApp).catch(() => { if (S.token) { store.del('sess'); S.token = null; } toNames(); });
    return;
  }
  toNames();
}

start();
