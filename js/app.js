/* =====================================================================
 * DharmaImpact — BOOT & SESI
 * Sesi tersimpan → tampil instan dari cache perangkat, segarkan di latar.
 * Login = 1 panggilan (token + data layar pertama).
 * ===================================================================== */
function applyBoot(b) {
  App.me = b.me; App.master = b.master; App.proyek = b.proyek || []; if (b.users) App.users = b.users;
}
function showShell() {
  $('#boot').hidden = true; $('#login').hidden = true; $('#shell').hidden = false;
  $('#engVer').textContent = SroiEngine.VERSION;
  buildNav(); route();
}
function showLogin(msg) {
  $('#boot').hidden = true; $('#shell').hidden = true; $('#login').hidden = false;
  var e = $('#lgErr'); if (msg) { e.hidden = false; e.innerHTML = ic('alert') + '<div><p style="margin:0">' + esc(msg) + '</p></div>'; } else e.hidden = true;
  setTimeout(function () { $('#lgUser').focus(); }, 50);
}
/** Segarkan bootstrap di latar; render ulang halaman aktif hanya bila data berubah */
async function refreshBoot(force) {
  var c = Store.get(userKey('boot'), null);
  if (!force && c && Date.now() - c.t < (CFG.FRESH_MS || 60000)) return;
  var res = await api('bootstrap', {});
  if (!res.success) return;
  var oldH = hashStr(JSON.stringify({ m: App.master, p: App.proyek, u: App.users }));
  applyBoot(res.data); App.bootAt = Date.now(); saveBootCache();
  if (hashStr(JSON.stringify({ m: App.master, p: App.proyek, u: App.users })) !== oldH) {
    buildNav();
    var def = App.pages[App.current], el = document.querySelector('.page[data-page="' + App.current + '"]');
    if (def && el && App.current !== 'wizard' && def.show) { var parts = location.hash.replace(/^#\/?/, '').split('/'); def.show(el, parts[1] ? decodeURIComponent(parts[1]) : ''); }
    else if (App.current === 'wizard' && W.data) { W.ctx = ctxForProyek(W.data.proyek); updateCalc(); }
  }
}
function onSessionExpired() {
  if (!App.token) return;
  if (App.current === 'wizard' && typeof hasDirty === 'function' && hasDirty()) saveDraftLocal();
  App.token = ''; Store.del('session');
  showLogin('Sesi berakhir. Silakan login kembali — isian yang belum tersimpan aman di perangkat ini.');
}
async function doLogin(e) {
  e.preventDefault();
  var btn = $('#lgBtn'), u = $('#lgUser').value.trim(), pw = $('#lgPass').value;
  $('#lgErr').hidden = true;
  await withBtn(btn, async function () {
    var res = await api('login', { username: u, password: pw });
    if (!res.success) { showLogin(res.message); return; }
    App.token = res.data.token; App.exp = res.data.expires;
    applyBoot(res.data.boot); App.bootAt = Date.now();
    Store.set('session', { token: App.token, exp: App.exp, userId: App.me.userId });
    saveBootCache();
    $('#lgPass').value = '';
    if (!location.hash || location.hash === '#/') location.hash = '#/' + defaultPage();
    showShell();
    idlePrefetch();
  });
}
async function doLogout(e) {
  if (e) e.preventDefault();
  if (App.current === 'wizard' && hasDirty()) { var ok = await saveNow('logout'); if (!ok && !(await confirmBox('Ada perubahan belum tersimpan', 'Perubahan tetap tersimpan di perangkat ini dan akan muncul lagi saat Anda login. Keluar sekarang?', 'Keluar'))) return; }
  api('logout', {});
  App.token = ''; App.me = null; Store.del('session');
  $('#pages').innerHTML = ''; App.current = ''; W.id = null; W.data = null;
  location.hash = '';
  showLogin();
}
/** Prefetch detail yang paling mungkin dibuka (1 panggilan batch saat idle) */
function idlePrefetch() {
  idle(function () {
    if (!App.me || App.me.role === 'STAKEHOLDER') return;
    var cand = (App.proyek || []).slice().sort(function (a, b) { return b.tahun - a.tahun || String(b.diubah_at).localeCompare(String(a.diubah_at)); });
    if (App.me.role === 'ADMIN') cand = cand.filter(function (p) { return p.status === 'Dikirim'; });
    var ids = cand.slice(0, App.me.role === 'ADMIN' ? 6 : 2).map(function (p) { return p.proyek_id; }).filter(function (id) { return !cachedDetail(id); });
    if (!ids.length) return;
    api('batch', { calls: ids.map(function (id) { return { action: 'getProyek', key: id, data: { proyek_id: id } }; }) }).then(function (res) {
      if (res.success) Object.keys(res.data).forEach(function (id) { if (res.data[id].success) cacheDetail(id, res.data[id].data); });
    });
  }, 1500);
}

document.addEventListener('DOMContentLoaded', function () {
  hydrateIcons();
  loadThemeCached();          // tema & logo tampil seketika dari perangkat
  warmUpServer();
  refreshTheme();             // perbarui tema dari server di latar
  $('#loginForm').addEventListener('submit', doLogin);
  $('#btnLogout').addEventListener('click', doLogout);
  $('#btnBurger').addEventListener('click', function () { document.body.classList.toggle('nav-open'); });
  $('#scrim').addEventListener('click', function () { document.body.classList.remove('nav-open'); });
  $('#btnHitungBaru').addEventListener('click', function () { ProyekUI.openNew(App.me.role === 'CABANG' ? App.me.cabangId : ''); });
  window.addEventListener('hashchange', route);
  window.addEventListener('online', function () { App.online = true; netState(); if (App.current === 'wizard' && hasDirty()) saveNow('online'); });
  window.addEventListener('offline', function () { App.online = false; netState(); });
  var hiddenAt = 0;
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now();
    else if (App.token && Date.now() - hiddenAt > 120000) { warmUpServer(); refreshBoot(true); }
  });

  // Sesi tersimpan → tampil instan dari cache perangkat
  var s = Store.get('session', null);
  if (s && s.token && s.exp > Date.now() + 60000) {
    App.token = s.token; App.exp = s.exp; App.me = { userId: s.userId };
    var c = Store.get(userKey('boot'), null);
    if (c && c.data && c.data.me) {
      applyBoot(c.data); App.bootAt = c.t;
      showShell();
      refreshBoot(false); idlePrefetch();
      return;
    }
    api('bootstrap', {}).then(function (res) {
      if (!res.success) return showLogin(res.data && res.data.code === 'AUTH' ? 'Sesi berakhir. Silakan login kembali.' : res.message);
      applyBoot(res.data); App.bootAt = Date.now(); saveBootCache(); showShell(); idlePrefetch();
    });
    return;
  }
  Store.del('session');
  showLogin();
});
