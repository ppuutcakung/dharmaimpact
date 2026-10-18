/* =====================================================================
 * DharmaImpact — CORE
 * state • storage (SWR) • api tahan jaringan • router SPA • UI helpers
 * Pola: gas-instant-ux-pro (Prinsip 0–10)
 * ===================================================================== */
var CFG = window.DI_CONFIG || {};
var App = { token: '', exp: 0, me: null, master: null, proyek: [], users: [], bootAt: 0, pages: {}, current: '', online: true };
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

/* ---------------- Storage (namespace per user + versi skema) ---------------- */
var LS_PREFIX = 'di:v1:';
var Store = {
  get: function (k, d) { try { var v = localStorage.getItem(LS_PREFIX + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set: function (k, v) {
    var s = JSON.stringify(v);
    try { localStorage.setItem(LS_PREFIX + k, s); }
    catch (e) {   // kuota penuh → buang cache detail lama milik user lain/lama, coba sekali lagi
      Object.keys(localStorage).filter(function (x) { return x.indexOf(LS_PREFIX + 'u:') === 0 && x.indexOf(':pd:') > 0; }).forEach(function (x) { localStorage.removeItem(x); });
      try { localStorage.setItem(LS_PREFIX + k, s); } catch (e2) { }
    }
  },
  del: function (k) { try { localStorage.removeItem(LS_PREFIX + k); } catch (e) { } }
};
function userKey(k) { return 'u:' + (App.me ? App.me.userId : 'anon') + ':' + k; }
function hashStr(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h + ':' + s.length; }

/* ---------------- Pengukur performa (Perf.table() di console) ---------------- */
var Perf = {
  rows: [],
  add: function (action, total, server) { this.rows.push({ action: action, total: total, server: server == null ? null : server, net: server != null ? total - server : null }); if (this.rows.length > 200) this.rows.shift(); },
  table: function () { console.table(this.rows.slice(-30)); }
};

/* ---------------- API (timeout, retry baca, reqId tulis, tunggu online) ---------------- */
var READ_ACTIONS = /^(getTampilan|bootstrap|batch|getMaster|listProyek|getRekap|getDashboard|getProyek|getLaporanProyek|listUsers|getLog|exportDatabase)$/;
var _inflight = 0;
function netState() {
  var d = $('#netDot'); if (!d) return;
  d.className = 'net-dot' + (!App.online ? ' off' : _inflight ? ' busy' : '');
  d.title = !App.online ? 'Offline / server tidak terjangkau' : _inflight ? 'Menyinkronkan…' : 'Tersambung';
}
function uid(p) { return (p || '') + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 7); }
async function apiOnce(action, data, timeout, reqId) {
  var ctrl = new AbortController(), timer = setTimeout(function () { ctrl.abort(); }, timeout), t0 = performance.now();
  try {
    var res = await fetch(CFG.GAS_URL, {
      method: 'POST', redirect: 'follow', cache: 'no-store', signal: ctrl.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },      // hindari CORS preflight
      body: JSON.stringify({ action: action, token: App.token || '', reqId: reqId, data: data || {} })
    });
    var text = await res.text();
    try { var j = JSON.parse(text); Perf.add(action, Math.round(performance.now() - t0), j.ms); App.online = true; return j; }
    catch (e) { return { success: false, network: true, retryable: res.status >= 500 || res.status === 429, message: 'Server membalas HTTP ' + res.status + ' (bukan JSON). Periksa URL /exec & izin deployment.' }; }
  } catch (err) {
    return { success: false, network: true, retryable: true, message: err.name === 'AbortError' ? 'Server terlalu lama merespons.' : 'Koneksi ke server terputus.' };
  } finally { clearTimeout(timer); }
}
async function api(action, data, opt) {
  opt = opt || {};
  if (!CFG.GAS_URL || CFG.GAS_URL.indexOf('GANTI_') > -1) return { success: false, message: 'URL backend belum diisi di js/config.js.' };
  var isRead = READ_ACTIONS.test(action) || action === 'login';
  var reqId = isRead ? '' : (opt.reqId || (crypto.randomUUID ? crypto.randomUUID() : uid('r')));
  var tries = action === 'login' ? 2 : isRead ? 3 : 3, res;
  _inflight++; netState();
  try {
    for (var i = 0; i < tries; i++) {
      if (i) { await sleep(1200 * i); if (navigator.onLine === false) await waitOnline(15000); }
      res = await apiOnce(action, data, isRead ? (i ? 40000 : 25000) : 90000, reqId);
      if (res.success || !res.retryable) break;
    }
  } finally { _inflight--; }
  if (!res.success && res.network) App.online = false;
  netState();
  if (!res.success && res.data && res.data.code === 'AUTH' && action !== 'login') onSessionExpired();
  return res;
}
function idle(fn, ms) { if (window.requestIdleCallback) requestIdleCallback(fn, { timeout: (ms || 1000) + 2000 }); else setTimeout(fn, ms || 1000); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function waitOnline(ms) { return new Promise(function (r) { if (navigator.onLine !== false) return r(); var t = setTimeout(done, ms); function done() { clearTimeout(t); removeEventListener('online', done); r(); } addEventListener('online', done); }); }
function warmUpServer() { if (CFG.GAS_URL && CFG.GAS_URL.indexOf('GANTI_') < 0) fetch(CFG.GAS_URL + '?ping=' + Date.now(), { mode: 'no-cors', cache: 'no-store' }).catch(function () { }); }

/** SWR: render dari cache seketika, segarkan bila lewat batas kesegaran, render ulang hanya bila berubah */
async function swr(key, action, payload, render, opt) {
  opt = opt || {};
  var fresh = opt.fresh == null ? (CFG.FRESH_MS || 60000) : opt.fresh;
  var c = Store.get(userKey(key), null);
  if (c) render(c.data, true);
  if (c && !opt.force && Date.now() - c.t < fresh) return { success: true, data: c.data, cached: true };
  var res = await api(action, payload);
  if (res.success) {
    var h = hashStr(JSON.stringify(res.data));
    Store.set(userKey(key), { t: Date.now(), h: h, data: res.data });
    if (!c || c.h !== h) render(res.data, false);
  } else if (!c && opt.onError) opt.onError(res);
  return res;
}

/* ---------------- Format angka (Indonesia) ---------------- */
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function N(v) { return SroiEngine.n(v); }
function fmtNum(v, d) { var x = Number(v) || 0; return x.toLocaleString('id-ID', { minimumFractionDigits: d || 0, maximumFractionDigits: d == null ? 0 : d }); }
function rp(v) { var x = Math.round(Number(v) || 0); return (x < 0 ? '−Rp ' : 'Rp ') + Math.abs(x).toLocaleString('id-ID'); }
function rpShort(v) {
  var x = Number(v) || 0, a = Math.abs(x), s = x < 0 ? '−' : '';
  if (a >= 1e12) return s + 'Rp ' + fmtNum(a / 1e12, 2) + ' T';
  if (a >= 1e9) return s + 'Rp ' + fmtNum(a / 1e9, 2) + ' M';
  if (a >= 1e6) return s + 'Rp ' + fmtNum(a / 1e6, 1) + ' jt';
  return rp(x);
}
function pctFmt(frac, d) { return fmtNum((Number(frac) || 0) * 100, d == null ? 1 : d) + '%'; }
function ratioFmt(r) { return fmtNum(r, 2) + ' : 1'; }
function starsHtml(n, cls) { n = Number(n) || 0; var s = ''; for (var i = 1; i <= 5; i++) s += i <= n ? '★' : '<span class="off">★</span>'; return '<span class="stars ' + (cls || '') + '" title="Bintang ' + n + '">' + s + '</span>'; }
function stClass(st) { return st === 'Disetujui' ? 'st-Disetujui' : st === 'Dikirim' ? 'st-Dikirim' : st === 'Perlu Revisi' ? 'st-Revisi' : st === 'Draft' ? 'st-Draft' : 'st-Belum'; }
function badge(st) { return '<span class="badge ' + stClass(st) + '">' + esc(st || 'Belum Mulai') + '</span>'; }
/** Rupiah: hanya angka bulat — titik & koma selalu dianggap pemisah ribuan. "9.820.000" / "9,820,000" / "Rp 9.820.000" → 9820000 */
function parseMoney(s) {
  var neg = /^\s*[-−]/.test(String(s == null ? '' : s));
  var d = String(s == null ? '' : s).replace(/[^\d]/g, '');
  if (!d) return '';
  var x = Number(d); return isFinite(x) ? (neg ? -x : x) : '';
}
/** Angka desimal format Indonesia: koma = desimal, titik = ribuan. Bila keduanya ada, pemisah terakhir = desimal. */
function parseID(s) {
  s = String(s == null ? '' : s).trim().replace(/[^\d,.\-]/g, '');
  if (!s) return '';
  var lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
  if (lc > -1 && ld > -1) {                          // dua jenis pemisah: yang terakhir = desimal
    if (lc > ld) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (lc > -1) {                             // hanya koma
    s = (s.match(/,/g) || []).length > 1 ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (ld > -1) {                             // hanya titik
    if ((s.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
  }
  var x = Number(s); return isFinite(x) ? x : '';
}
function parseNum(s, kind) { return kind === 'money' ? parseMoney(s) : parseID(s); }
/** Format rupiah langsung saat mengetik (titik ribuan) dengan posisi kursor tetap */
function liveMoney(inp) {
  var v = inp.value, pos = inp.selectionStart == null ? v.length : inp.selectionStart;
  var digitsBefore = v.slice(0, pos).replace(/[^\d]/g, '').length;
  var n = parseMoney(v);
  var out = n === '' ? '' : Number(n).toLocaleString('id-ID', { maximumFractionDigits: 0 });
  if (out === v) return;
  inp.value = out;
  var i = 0, seen = 0;
  while (i < out.length && seen < digitsBefore) { if (/\d/.test(out[i])) seen++; i++; }
  try { inp.setSelectionRange(i, i); } catch (e) { }
}
document.addEventListener('input', function (e) { var t = e.target; if (t && t.classList && t.classList.contains('money')) liveMoney(t); }, true);
function numIn(v, d) { if (v === '' || v == null) return ''; var x = Number(v); if (!isFinite(x)) return ''; return x.toLocaleString('id-ID', { maximumFractionDigits: d == null ? 2 : d }); }
function initials(s) { return String(s || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase(); }
function fmtDate(s) {
  if (!s) return '—'; var d = new Date(String(s).replace(' ', 'T')); if (isNaN(d)) return esc(s);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) + (String(s).length > 10 ? ', ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '');
}
function debounce(fn, ms) { var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); }; }

/* ---------------- Toast & Modal ---------------- */
function toast(msg, type, ms) {
  var el = document.createElement('div');
  el.className = 'toast ' + (type || '');
  el.innerHTML = ic(type === 'err' ? 'alert' : type === 'warn' ? 'alert' : 'check-circle') + '<div>' + esc(msg) + '</div>';
  $('#toasts').appendChild(el);
  setTimeout(function () { el.style.opacity = '0'; el.style.transition = 'opacity .2s'; setTimeout(function () { el.remove(); }, 220); }, ms || (type === 'err' ? 5000 : 2800));
}
/** modal({title, body(html), wide, actions:[{label, cls, value, id}], onOpen(el)}) → Promise(value) */
function modal(o) {
  return new Promise(function (resolve) {
    var bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = '<div class="modal' + (o.wide ? ' wide' : '') + '" role="dialog" aria-modal="true"><div class="modal-h"><h3>' + esc(o.title) + '</h3><button class="btn btn-icon btn-ghost btn-sm" data-v="__x">' + ic('x') + '</button></div>' +
      '<div class="modal-b">' + (o.body || '') + '</div>' +
      (o.actions === false ? '' : '<div class="modal-f">' + (o.actions || [{ label: 'Tutup', value: null }]).map(function (a, i) { return '<button class="btn ' + (a.cls || '') + '" data-i="' + i + '"' + (a.id ? ' id="' + a.id + '"' : '') + '>' + a.label + '</button>'; }).join('') + '</div>') + '</div>';
    $('#modalRoot').appendChild(bg);
    var close = function (v) { bg.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    var onKey = function (e) { if (e.key === 'Escape') close(null); };
    document.addEventListener('keydown', onKey);
    bg.addEventListener('click', async function (e) {
      if (e.target === bg) return close(null);
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.v === '__x') return close(null);
      if (b.dataset.i == null) return;
      var a = (o.actions || [{ value: null }])[+b.dataset.i];
      if (a.onClick) {
        var old = b.innerHTML; b.disabled = true; b.innerHTML = '<span class="spinner"></span>' + old;
        var r = await a.onClick(bg); b.disabled = false; b.innerHTML = old;
        if (r === false) return; return close(r === undefined ? a.value : r);
      }
      close(a.value);
    });
    hydrateIcons(bg);
    var f = bg.querySelector('input,select,textarea'); if (f) setTimeout(function () { f.focus(); }, 30);
    if (o.onOpen) o.onOpen(bg);
  });
}
function confirmBox(title, msg, okLabel, cls) {
  return modal({ title: title, body: '<p style="margin:0">' + msg + '</p>', actions: [{ label: 'Batal', value: false }, { label: okLabel || 'Ya, lanjutkan', cls: cls || 'btn-primary', value: true }] });
}
function promptBox(title, label, okLabel, cls, required) {
  return modal({
    title: title, body: '<div class="field"><label>' + esc(label) + '</label><textarea class="inp" id="pbText" rows="4"></textarea></div>',
    actions: [{ label: 'Batal', value: null }, {
      label: okLabel || 'Simpan', cls: cls || 'btn-primary', onClick: function (bg) {
        var v = bg.querySelector('#pbText').value.trim();
        if (required && !v) { toast('Isian wajib diisi.', 'warn'); return false; }
        return v;
      }
    }]
  });
}
async function withBtn(btn, fn) {
  if (!btn) return fn();
  var old = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spinner"' + (btn.classList.contains('btn-primary') || btn.classList.contains('btn-success') ? '' : ' style="border-color:#cbd5e1;border-top-color:#005aab"') + '></span>' + old;
  try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = old; }
}

/* ---------------- Lazy-load pustaka (hanya saat ekspor) ---------------- */
var _scripts = {};
function loadScript(src) {
  if (_scripts[src]) return _scripts[src];
  return (_scripts[src] = new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { delete _scripts[src]; rej(new Error('Gagal memuat ' + src)); }; document.head.appendChild(s); }));
}

/* ---------------- Data induk: lookup ---------------- */
var M = {
  cabang: function (id) { return (App.master.cabang || []).filter(function (c) { return String(c.cabang_id) === String(id); })[0] || {}; },
  cabangName: function (id) { return M.cabang(id).nama_cabang || '—'; },
  cabangAktif: function () { return (App.master.cabang || []).filter(function (c) { return isTrue(c.aktif); }); },
  sektor: function (id) { return (App.master.sektor || []).filter(function (s) { return String(s.sektor_id) === String(id); })[0] || {}; },
  sektorName: function (id) { return M.sektor(id).nama_sektor || '—'; },
  sektorAktif: function () { return (App.master.sektor || []).filter(function (s) { return isTrue(s.aktif); }); },
  program: function () { return (App.master.program || []).filter(function (p) { return isTrue(p.aktif); }).sort(function (a, b) { return N(a.urutan) - N(b.urutan); }); },
  programName: function (id) { var p = (App.master.program || []).filter(function (x) { return x.program_id === id; })[0]; return p ? p.nama_program : '—'; },
  /** KPI berlaku utk cabang+tahun: KPI khusus cabang, bila tidak ada → template baku */
  kpi: function (th, cid) { var own = M.kpiSet(th, cid || ''); return own.length || !cid ? own : M.kpiSet(th, ''); },
  kpiSet: function (th, cid) { return (App.master.kpi || []).filter(function (k) { return Number(k.tahun) === Number(th) && String(k.cabang_id || '') === String(cid || ''); }).sort(function (a, b) { return N(a.urutan) - N(b.urutan); }); },
  ct: function (cid, th) { return (App.master.cabang_tahun || []).filter(function (r) { return String(r.cabang_id) === String(cid) && Number(r.tahun) === Number(th); })[0] || {}; },
  params: function (th) {
    var p = {};
    (App.master.parameter || []).forEach(function (r) { if (!r.tahun) p[r.key] = r.value; });
    (App.master.parameter || []).forEach(function (r) { if (Number(r.tahun) === Number(th)) p[r.key] = r.value; });
    return p;
  },
  param: function (key, d) { var r = (App.master.parameter || []).filter(function (x) { return x.key === key && !x.tahun; })[0]; return r ? r.value : d; },
  engineCtx: function (p) { var ct = M.ct(p.cabang_id, p.tahun); return { params: M.params(p.tahun), umk: ct.umk, budget: ct.budget_program, kpiMaster: M.kpi(p.tahun, p.cabang_id), sektor: App.master.sektor }; },
  years: function () {
    var ys = {}; var y = new Date().getFullYear(); ys[y] = 1; ys[y - 1] = 1;
    (App.proyek || []).forEach(function (p) { ys[p.tahun] = 1; });
    (App.master.kpi || []).forEach(function (k) { ys[k.tahun] = 1; });
    return Object.keys(ys).map(Number).filter(Boolean).sort(function (a, b) { return b - a; });
  }
};
function isTrue(v) { return v === true || String(v).toUpperCase() === 'TRUE' || v === 1 || String(v) === '1' || String(v).toUpperCase() === 'Y'; }
function roleLabel(r) { return r === 'ADMIN' ? 'Super Admin' : r === 'CABANG' ? 'Akun Cabang' : 'Stakeholder'; }
function upsertSummary(p) {
  var i = App.proyek.findIndex(function (x) { return x.proyek_id === p.proyek_id; });
  if (i > -1) App.proyek[i] = Object.assign({}, App.proyek[i], p); else App.proyek.push(p);
  saveBootCache();
  updateNavBadges();
}
function saveBootCache() { Store.set(userKey('boot'), { t: App.bootAt, data: { me: App.me, master: App.master, proyek: App.proyek, users: App.users } }); }

/* ---------------- Detail proyek: SWR + LRU (6 terakhir) ---------------- */
function cacheDetail(id, data) {
  Store.set(userKey('pd:' + id), { t: Date.now(), h: hashStr(JSON.stringify(data)), data: data });
  var idx = Store.get(userKey('pd:idx'), []).filter(function (x) { return x !== id; }); idx.unshift(id);
  idx.slice(6).forEach(function (old) { Store.del(userKey('pd:' + old)); });
  Store.set(userKey('pd:idx'), idx.slice(0, 6));
}
function cachedDetail(id) { var c = Store.get(userKey('pd:' + id), null); return c ? c.data : null; }
async function fetchDetail(id, force) {
  var c = Store.get(userKey('pd:' + id), null);
  if (c && !force && Date.now() - c.t < (CFG.FRESH_MS || 60000)) return { success: true, data: c.data, cached: true };
  var res = await api('getProyek', { proyek_id: id });
  if (res.success) cacheDetail(id, res.data);
  return res;
}

/* ---------------- Router SPA (halaman tetap hidup) ---------------- */
function registerPage(name, def) { App.pages[name] = Object.assign({ roles: ['ADMIN', 'CABANG', 'STAKEHOLDER'] }, def); }
function go(name, param) { var h = '#/' + name + (param ? '/' + encodeURIComponent(param) : ''); if (location.hash === h) route(); else location.hash = h; }
function defaultPage() { return App.me && App.me.role === 'CABANG' ? 'cabang' : 'dashboard'; }
function route() {
  if (!App.me) return;
  var parts = location.hash.replace(/^#\/?/, '').split('/');
  var name = parts[0], param = parts[1] ? decodeURIComponent(parts[1]) : '';
  var def = App.pages[name];
  if (!def || def.roles.indexOf(App.me.role) < 0) { name = defaultPage(); def = App.pages[name]; param = ''; history.replaceState(null, '', '#/' + name); }
  if (App.current && App.current !== name && App.pages[App.current].hide) App.pages[App.current].hide();
  var el = document.querySelector('.page[data-page="' + name + '"]');
  if (!el) { el = document.createElement('section'); el.className = 'page page-' + name; el.dataset.page = name; $('#pages').appendChild(el); def.init && def.init(el); }
  $$('.page').forEach(function (p) { p.hidden = p !== el; });
  App.current = name;
  $$('#nav a, #bottomnav a').forEach(function (a) { a.classList.toggle('active', a.dataset.page === name || (a.dataset.alt || '').split(',').indexOf(name) > -1); });
  document.body.classList.remove('nav-open');
  def.show && def.show(el, param);
  window.scrollTo(0, 0);
}
function setTitle(title, crumb, extra) {
  $('#pageTitle').innerHTML = esc(title) + (extra || '');
  $('#crumb').innerHTML = esc(window.UI ? UI.app_name : 'DharmaImpact') + ' / <b>' + esc(crumb || title) + '</b>';
  document.title = title + ' — ' + (window.UI ? UI.app_name : 'DharmaImpact');
}

/* ---------------- Navigasi per peran ---------------- */
var NAV = {
  ADMIN: [['dashboard', 'Dashboard Akumulasi', 'layout-dashboard'], ['cabang', 'Dashboard Cabang', 'building'], ['proyek', 'Perhitungan SROI', 'calculator', 'wizard'],
    ['persetujuan', 'Persetujuan', 'clipboard-check'], ['laporan', 'Laporan & Ekspor', 'file-text'], '|Administrasi', ['master', 'Data Induk & Parameter', 'sliders'], ['users', 'Pengguna', 'users'], ['tampilan', 'Tampilan Aplikasi', 'palette'], ['log', 'Log Audit', 'history']],
  CABANG: [['cabang', 'Dashboard Cabang', 'layout-dashboard'], ['proyek', 'Perhitungan SROI', 'calculator', 'wizard'], ['laporan', 'Laporan & Ekspor', 'file-text']],
  STAKEHOLDER: [['dashboard', 'Dashboard Akumulasi', 'layout-dashboard'], ['cabang', 'Ringkasan Cabang', 'building', 'wizard'], ['laporan', 'Laporan & Ekspor', 'file-text']]
};
function buildNav() {
  var items = NAV[App.me.role];
  $('#nav').innerHTML = items.map(function (it) {
    if (typeof it === 'string') return '<div class="nav-sep">' + esc(it.slice(1)) + '</div>';
    return '<a href="#/' + it[0] + '" data-page="' + it[0] + '" data-alt="' + (it[3] || '') + '">' + ic(it[2]) + '<span>' + esc(it[1]) + '</span>' + (it[0] === 'persetujuan' ? '<span class="badge-n" id="navBadge" hidden>0</span>' : '') + '</a>';
  }).join('');
  var bn = items.filter(function (x) { return typeof x !== 'string'; }).slice(0, 4);
  $('#bottomnav').innerHTML = bn.map(function (it) { return '<a href="#/' + it[0] + '" data-page="' + it[0] + '" data-alt="' + (it[3] || '') + '">' + ic(it[2]) + '<span>' + esc(it[1].split(' ')[0] === 'Dashboard' ? 'Dashboard' : it[1].split(' ')[0]) + '</span></a>'; }).join('') +
    '<a href="#" id="bnMore">' + ic('menu') + '<span>Menu</span></a>';
  $('#bnMore').onclick = function (e) { e.preventDefault(); document.body.classList.add('nav-open'); };
  $('#ctaWrap').hidden = App.me.role === 'STAKEHOLDER';
  var me = App.me;
  $('#sideName').textContent = me.nama; $('#sideRole').textContent = roleLabel(me.role) + (me.cabangId ? ' • ' + M.cabangName(me.cabangId) : '');
  $('#topName').textContent = me.nama; $('#topSub').textContent = me.role === 'CABANG' ? 'Cabang ' + M.cabangName(me.cabangId) : roleLabel(me.role);
  $('#sideAvatar').textContent = $('#topAvatar').textContent = initials(me.nama);
  $('#chipRole').innerHTML = ic('lock') + ' ' + esc(roleLabel(me.role));
  updateNavBadges();
}
function updateNavBadges() {
  var b = $('#navBadge'); if (!b) return;
  var n = (App.proyek || []).filter(function (p) { return p.status === 'Dikirim'; }).length;
  b.textContent = n; b.hidden = !n;
}

/* =====================================================================
 * TEMA & IDENTITAS APLIKASI (diatur Super Admin di menu Tampilan Aplikasi)
 * Disimpan di perangkat (tanpa login) agar halaman login pun langsung bertema.
 * ===================================================================== */
var THEME_DEFAULT = {
  app_name: 'DharmaImpact', app_sub: 'SROI Management', org_name: 'Pusat Pendampingan UMKM',
  login_title: 'Satu mesin hitung SROI untuk seluruh cabang binaan.',
  login_desc: 'Isi data program, lihat rasio Social Return on Investment langsung saat mengetik, kirim ke pusat, dan cetak laporan siap arsip — tanpa rumus manual.',
  footer: 'Sistem Pengukuran Dampak Sosial Program Pembinaan UMKM',
  color_primary: '#005AAB', color_sidebar: '#0A3D73', color_accent: '#E8A317', logo: ''
};
var UI = Object.assign({}, THEME_DEFAULT);
function hexRgb(h) { h = String(h || '').replace('#', ''); if (h.length !== 6) return null; return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function mixHex(h, to, t) { var a = hexRgb(h), b = hexRgb(to); if (!a || !b) return h; return '#' + a.map(function (v, i) { return ('0' + Math.round(v + (b[i] - v) * t).toString(16)).slice(-2); }).join(''); }
function applyTheme(t) {
  UI = Object.assign({}, THEME_DEFAULT);
  Object.keys(t || {}).forEach(function (k) { if (t[k] !== undefined && t[k] !== null && String(t[k]) !== '') UI[k] = t[k]; });
  var P = UI.color_primary, S = UI.color_sidebar, A = UI.color_accent, r = document.documentElement.style;
  r.setProperty('--primary', P); r.setProperty('--primary-hover', mixHex(P, '#000000', 0.18)); r.setProperty('--primary-dark', mixHex(P, '#000000', 0.3));
  r.setProperty('--primary-soft', mixHex(P, '#ffffff', 0.42)); r.setProperty('--primary-tint', mixHex(P, '#ffffff', 0.92)); r.setProperty('--primary-line', mixHex(P, '#ffffff', 0.75));
  r.setProperty('--primary-deep', S); r.setProperty('--cta', mixHex(P, '#ffffff', 0.1)); r.setProperty('--amber', A);
  if (window.PALETTE) { PALETTE[0] = P; PALETTE[5] = mixHex(P, '#000000', 0.3); PALETTE[3] = A; }
  var meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', S);
  document.querySelectorAll('.brand').forEach(function (b) {
    var mark = b.querySelector('.brand-mark'), nm = b.querySelector('b'), sb = b.querySelector('small');
    if (mark) { mark.classList.toggle('has-img', !!UI.logo); mark.innerHTML = UI.logo ? '<img src="' + UI.logo + '" alt="Logo">' : ic('logo'); }
    if (nm) nm.textContent = UI.app_name; if (sb) sb.textContent = UI.app_sub;
  });
  var lt = document.getElementById('loginTitle'), ld = document.getElementById('loginDesc'), ft = document.getElementById('footTxt'), fa = document.getElementById('footApp'), bl = document.getElementById('bootName');
  if (lt) lt.textContent = UI.login_title; if (ld) ld.textContent = UI.login_desc; if (ft) ft.textContent = UI.footer; if (fa) fa.textContent = UI.app_name; if (bl) bl.textContent = UI.app_name;
  var fav = document.querySelector('link[rel="icon"]'); if (fav && UI.logo) fav.setAttribute('href', UI.logo);
  CFG.APP_NAME = UI.app_name; CFG.ORG_NAME = UI.org_name;
}
function loadThemeCached() { var t = Store.get('ui', null); applyTheme(t || {}); }
async function refreshTheme() {
  var res = await api('getTampilan', {});
  if (res.success) { var h = hashStr(JSON.stringify(res.data)); if (h !== hashStr(JSON.stringify(Store.get('ui', {})))) { Store.set('ui', res.data); applyTheme(res.data); } }
}
