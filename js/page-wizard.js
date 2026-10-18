/* =====================================================================
 * WIZARD PERHITUNGAN SROI — 8 langkah, hitung real-time di browser
 * Simpan otomatis tiap 30 dtk & saat pindah langkah, draf lokal anti-hilang
 * ===================================================================== */
var STEPS = [
  { n: 1, t: 'Informasi Umum', s: 'Data program & stakeholder' },
  { n: 2, t: 'Budget & KPI', s: 'Target & realisasi per sektor' },
  { n: 3, t: 'Kegiatan & UMKM', s: 'Kegiatan, daftar UMKM, kehadiran' },
  { n: 4, t: 'Biaya', s: 'Investasi per stakeholder' },
  { n: 5, t: 'Omset & Net Profit', s: 'Kenaikan net profit UMKM' },
  { n: 6, t: 'Proksi Manfaat', s: 'Benchmark & manfaat stakeholder' },
  { n: 7, t: 'Impact Map', s: 'Outcome, proksi, penyesuaian' },
  { n: 8, t: 'Ringkasan & Kirim', s: 'Validasi, berkas, pengiriman' }
];
var ROW_KEY = { stakeholder: 'sh_id', kegiatan: 'kegiatan_id', umkm: 'umkm_id', biaya: 'biaya_id', omset: 'umkm_id', benchmark: 'bm_id', manfaat: 'mf_id', outcome: 'outcome_id' };
var PERAN = ['Pelaksana', 'Penerima Manfaat', 'Sponsor', 'Mitra'];
var KELOMPOK_BIAYA = ['Waktu & Tenaga', 'Komitmen Fee', 'Implementasi', 'Prasarana', 'Lainnya'];
var JENIS_BERKAS = ['Kuisioner/Wawancara', 'Foto Kegiatan', 'Data Omset', 'Lembar Pengesahan', 'Lainnya'];
var TIP = {
  dw: 'Deadweight (DW): porsi hasil yang tetap akan terjadi walaupun tanpa program. Isi 0% bila tidak ada.',
  ds: 'Displacement (DS): porsi hasil yang hanya memindahkan manfaat dari pihak/tempat lain. Isi 0% bila tidak ada.',
  at: 'Attribution (AT): porsi hasil yang disumbang pihak lain di luar program. Isi 0% bila tidak ada.',
  do: 'Drop-off (DO): penurunan dampak per tahun setelah tahun pertama (dipakai bila durasi > 1 tahun).',
  porsi: 'Porsi sumber proksi yang dipakai outcome ini. Satu sumber maksimal terpakai 100% di seluruh outcome (aturan R4).',
  margin: 'Margin profit (%) UMKM untuk mengubah kenaikan omset menjadi kenaikan net profit (F6).'
};
function tip(k) { return '<span class="help" tabindex="0" data-tip="' + esc(TIP[k]) + '">?</span>'; }

var W = { id: null, data: null, res: null, step: 1, ro: false, dirty: {}, ver: 0, infoDirty: 0, saving: false, again: false, lastSaved: '', saveErr: '', timer: null, el: null, sektors: [] };

registerPage('wizard', {
  init: function (el) {
    W.el = el;
    el.innerHTML = '<div id="wzWrap"></div>';
    el.addEventListener('input', onWzInput);
    el.addEventListener('change', onWzChange);
    el.addEventListener('focusout', onWzBlur);
    el.addEventListener('click', onWzClick);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && App.current === 'wizard') saveNow('hide'); });
    window.addEventListener('beforeunload', function (e) { if (App.current === 'wizard' && hasDirty()) { saveNow('unload'); e.preventDefault(); e.returnValue = ''; } });
  },
  show: function (el, param) {
    var parts = String(param || '').split(':'), id = parts[0], step = Number(parts[1]) || 0;
    if (!id) return go('proyek');
    clearInterval(W.timer);
    W.timer = setInterval(function () { if (hasDirty()) saveNow('auto'); }, CFG.AUTOSAVE_MS || 30000);
    if (W.id === id && W.data) { if (step) W.step = step; renderWizard(); refreshDetail(id); return; }
    if (W.id && W.id !== id && hasDirty()) saveNow('switch');
    W.id = id; W.step = step || 1; W.unlockOpen = false; W.unlockNotes = []; W.dirty = {}; W.infoDirty = 0; W.lastSaved = ''; W.saveErr = '';
    var c = cachedDetail(id), draft = Store.get(userKey('wd:' + id), null);
    if (draft && draft.data && (!c || N(draft.rev) >= N(c.proyek.rev))) {
      W.data = draft.data; (draft.dirty || []).forEach(function (s) { W.dirty[s] = ++W.ver; }); W.infoDirty = draft.info ? ++W.ver : 0;
    } else W.data = c ? JSON.parse(JSON.stringify(c)) : null;
    if (W.data) { prepData(); renderWizard(); }
    else $('#wzWrap', el).innerHTML = skeletonWz();
    refreshDetail(id);
  },
  hide: function () { clearInterval(W.timer); if (hasDirty()) saveNow('leave'); }
});
function skeletonWz() { return '<div class="skel" style="height:34px;width:40%;margin-bottom:16px"></div><div class="skel" style="height:52px;margin-bottom:18px"></div><div class="wz-body"><div class="skel" style="height:420px"></div><div class="skel hide-sm" style="height:300px"></div></div>'; }
async function refreshDetail(id) {
  var res = await fetchDetail(id, !!W.data);
  if (W.id !== id) return;
  if (!res.success) { if (!W.data) $('#wzWrap', W.el).innerHTML = '<div class="card"><div class="empty">' + ic('alert') + '<p>' + esc(res.message) + '</p><button class="btn btn-primary" onclick="refreshDetail(\'' + esc(id) + '\')">' + ic('refresh') + ' Coba lagi</button></div></div>'; return; }
  if (hasDirty()) { // jangan timpa isian lokal; perbarui status saja
    var sp = res.data.proyek; ['status', 'catatan_revisi', 'dikirim_at', 'disetujui_at', 'disetujui_oleh', 'rev'].forEach(function (k) { W.data.proyek[k] = sp[k]; });
    W.data.berkas = res.data.berkas; prepData(); renderWizard(); return;
  }
  var changed = !W.data || hashStr(JSON.stringify(res.data)) !== hashStr(JSON.stringify(stripLocal(W.data)));
  if (changed) { W.data = JSON.parse(JSON.stringify(res.data)); prepData(); renderWizard(); }
}
function stripLocal(d) { return d; }
function hasDirty() { return W.infoDirty || Object.keys(W.dirty).length > 0; }

/** Normalisasi data setelah dimuat */
function prepData() {
  var d = W.data, p = d.proyek, me = App.me, st = p.status, editable = st === 'Draft' || st === 'Perlu Revisi';
  W.ro = me.role !== 'CABANG' || !editable;   // input/ubah/hapus data hanya hak cabang; admin & stakeholder mode baca
  ['stakeholder', 'kpi', 'kegiatan', 'umkm', 'kehadiran', 'biaya', 'omset', 'benchmark', 'manfaat', 'outcome', 'berkas'].forEach(function (k) { if (!Array.isArray(d[k])) d[k] = []; });
  W.ctx = ctxForProyek(p);
  var kpis = kpiList().map(function (k) { return k.kpi_id; });
  if (kpis.length) { var before = d.kpi.length; d.kpi = d.kpi.filter(function (r) { return kpis.indexOf(r.kpi_id) > -1; }); if (d.kpi.length !== before && !W.ro) markDirty('kpi', true); }
  var sek = {}; d.kpi.forEach(function (r) { if (r.sektor_id !== 'ALL') sek[r.sektor_id] = 1; }); d.umkm.forEach(function (u) { if (u.sektor_id) sek[u.sektor_id] = 1; });
  W.sektors = (App.master.sektor || []).map(function (s) { return s.sektor_id; }).filter(function (s) { return sek[s]; });
  if (p.sektor_dihitung == null) p.sektor_dihitung = '';
  d.outcome.forEach(pkList);
  ensureKpiRows(); ensureOmsetRows();
  compute();
}
function ensureKpiRows() {
  var d = W.data, have = {}; d.kpi.forEach(function (r) { have[r.kpi_id + '~' + r.sektor_id] = 1; });
  kpiList().forEach(function (k) { ['ALL'].concat(W.sektors).forEach(function (s) { if (!have[k.kpi_id + '~' + s]) d.kpi.push({ kpi_id: k.kpi_id, sektor_id: s, target: '', realisasi: '' }); }); });
}
/** Komponen proksi outcome (array yang bisa diedit) */
function pkList(o) {
  if (!Array.isArray(o.proksi_list)) {
    o.proksi_list = SroiEngine.proksiOf(o).map(function (c) { return { jenis: c.jenis, ref: c.ref, porsi: c.porsi, nilai: c.nilai == null ? '' : c.nilai, notes: c.notes || (c.jenis === 'MANUAL' ? (o.proxy_notes || '') : ''), dw: c.dw === '' ? 0 : c.dw, ds: c.ds === '' ? 0 : c.ds, at: c.at === '' ? 0 : c.at, 'do': c['do'] === '' ? 0 : c['do'] }; });
  }
  o.proksi_list.forEach(function (c) { ['dw', 'ds', 'at', 'do'].forEach(function (f) { if (c[f] === undefined) c[f] = (o[f] === undefined || o[f] === '' ? 0 : o[f]); }); });
  if (!o.proksi_list.length) o.proksi_list.push(newPk());
  return o.proksi_list;
}
function newPk() { return { jenis: '', ref: '', porsi: 100, nilai: '', notes: '', dw: 0, ds: 0, at: 0, 'do': 0 }; }
function kpiList() { return ((W.ctx && W.ctx.kpiMaster) || []).slice().sort(function (a, b) { return N(a.urutan) - N(b.urutan); }); }
function dihitungList() { return String(W.data.proyek.sektor_dihitung || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean); }
function setDihitung(list) { W.data.proyek.sektor_dihitung = W.sektors.filter(function (s) { return list.indexOf(s) > -1; }).join(','); markDirty('info'); }
function ensureOmsetRows() {
  var d = W.data, have = {}; d.omset.forEach(function (o) { have[o.umkm_id] = 1; });
  var add = false;
  d.umkm.forEach(function (u) { if (!have[u.umkm_id]) { d.omset.push({ umkm_id: u.umkm_id, omset_sebelum: '', omset_sesudah: '', margin_profit: '', dw: 0, ds: 0, at: 0, 'do': 0 }); add = true; } });
  var ids = d.umkm.map(function (u) { return u.umkm_id; }), n0 = d.omset.length;
  d.omset = d.omset.filter(function (o) { return ids.indexOf(o.umkm_id) > -1; });
  if ((add || n0 !== d.omset.length) && !W.ro) markDirty('omset', true);
}
function compute() { W.res = SroiEngine.compute(W.data, W.ctx); }
function markDirty(sec, silent) {
  if (sec === 'info') W.infoDirty = ++W.ver; else W.dirty[sec] = ++W.ver;
  if (!silent) { saveDraftLocal(); setSaveInd(); }
}
var saveDraftLocal = debounce(function () {
  if (!W.id || !hasDirty()) return;
  Store.set(userKey('wd:' + W.id), { t: Date.now(), rev: W.data.proyek.rev, data: W.data, dirty: Object.keys(W.dirty), info: !!W.infoDirty });
}, 600);

/* ---------------- Render kerangka ---------------- */
function renderWizard() {
  var d = W.data, p = d.proyek, r = W.res, me = App.me;
  setTitle('Wizard SROI — ' + M.cabangName(p.cabang_id) + ' ' + p.tahun, 'Perhitungan SROI', ' ' + badge(p.status));
  var errSteps = {}; r.errors.forEach(function (e) { errSteps[e.step] = 1; });
  var banner = '';
  if (p.status === 'Perlu Revisi' && p.catatan_revisi) banner = '<div class="banner banner-red">' + ic('alert') + '<div><b>Catatan revisi dari pusat</b><p>' + esc(p.catatan_revisi) + '</p></div></div>';
  else if (p.status === 'Dikirim') banner = '<div class="banner banner-amber">' + ic('lock') + '<div><b>Terkirim — menunggu verifikasi pusat</b><p>Data terkunci sejak ' + fmtDate(p.dikirim_at) + '.' + (me.role === 'ADMIN' ? ' Periksa lalu putuskan di langkah 8.' : '') + '</p></div>' + (me.role === 'ADMIN' && W.step !== 8 ? '<div class="act"><button class="btn btn-primary btn-sm" data-go="8">Ke keputusan</button></div>' : '') + '</div>';
  else if (p.status === 'Disetujui' && me.role === 'ADMIN' && W.unlockOpen) banner = '<div class="banner banner-amber">' + ic('unlock') + '<div><b>Kunci dibuka — catatan admin aktif</b><p>Tulis catatan revisi di langkah 1–7 bila perlu, lalu klik <b>Kembalikan untuk Revisi</b> di langkah 8. Selama belum dikembalikan, laporan tetap terkunci untuk cabang.</p></div><div class="act"><button class="btn btn-sm" data-relock>' + ic('lock') + ' Kunci Kembali</button>' + (W.step !== 8 ? '<button class="btn btn-danger btn-sm" data-go="8">' + ic('refresh') + ' Kembalikan untuk Revisi →</button>' : '') + '</div></div>';
  else if (p.status === 'Disetujui') banner = '<div class="banner banner-green">' + ic('lock') + '<div><b>Disetujui & terkunci</b><p>Disetujui ' + fmtDate(p.disetujui_at) + ' oleh ' + esc(p.disetujui_oleh || 'Super Admin') + '. ' +
    (me.role === 'CABANG' ? 'Laporan ini hanya bisa dilihat — tidak bisa diubah atau dihapus. Bila perlu perubahan, pusat akan membuka kunci dan mengembalikannya untuk revisi.' : me.role === 'ADMIN' ? 'Bila perlu perubahan, buka kunci lalu kembalikan ke cabang untuk revisi.' : 'Hasil resmi dihitung ulang oleh server.') + '</p></div>' +
    (me.role === 'ADMIN' && !W.unlockOpen ? '<div class="act"><button class="btn btn-warn btn-sm" data-unlock>' + ic('unlock') + ' Buka Kunci</button></div>' : '') + '</div>';
  $('#wzWrap', W.el).innerHTML =
    '<div class="wz-head"><button class="btn btn-icon btn-sm" data-back title="Kembali">' + ic('chevron-left') + '</button><div class="grow" style="min-width:0"><h2>' + esc(p.nama_program || 'Perhitungan SROI') + '</h2><div class="small muted">Cabang ' + esc(M.cabangName(p.cabang_id)) + ' • Tahun ' + p.tahun + ' • Budget ' + rp(W.ctx.budget) + ' • UMK ' + rp(W.ctx.umk) + '</div></div>' +
    '<span class="save-ind" id="saveInd"></span>' + (!W.ro ? '<button class="btn btn-sm" data-save>' + ic('save') + ' Simpan</button>' : '') + '</div>' + banner +
    notesBanner() +
    '<div class="stepper" id="stepper">' + STEPS.map(function (s) { var nc = openNotes(s.n).length; return '<button data-step="' + s.n + '" class="' + (s.n === W.step ? 'on' : '') + (errSteps[s.n] ? ' err' : '') + '" title="' + esc(s.s) + '"><i>' + s.n + '</i><span>' + esc(s.t) + '</span>' + (nc ? '<b class="nb" title="' + nc + ' catatan admin terbuka">' + nc + '</b>' : '') + '</button>'; }).join('') + '</div>' +
    '<div class="wz-body"><div class="wz-main' + (W.ro ? ' wz-ro' : '') + '" id="wzMain"></div><aside class="panel" id="panel"></aside></div>' +
    '<div class="panel-mobile" id="panelM"></div>';
  renderStep();
  setSaveInd();
  var on = $('#stepper .on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' });
}
function renderStep() {
  var main = $('#wzMain'); if (!main) return;
  main.innerHTML = notesHtml(W.step) + STEP_RENDER[W.step]() +
    '<div class="wz-nav"><button class="btn" data-go="' + (W.step - 1) + '"' + (W.step === 1 ? ' disabled' : '') + '>' + ic('chevron-left') + ' Sebelumnya</button>' +
    (W.step < 8 ? '<button class="btn btn-primary" data-go="' + (W.step + 1) + '">Berikutnya<span class="nx">: ' + esc(STEPS[W.step].t) + '</span> ' + ic('chevron-right') + '</button>' : '<span></span>') + '</div>';
  if (W.ro) $$('input,select,textarea', main).forEach(function (x) { if (!x.closest('.ro-ok')) x.disabled = true; });
  $$('textarea', main).forEach(autoGrow);
  updateCalc();
}
function goStep(n) {
  n = Math.max(1, Math.min(8, n)); if (n === W.step) return;
  if (hasDirty()) saveNow('step');
  W.step = n;
  history.replaceState(null, '', '#/wizard/' + encodeURIComponent(W.id) + ':' + n);
  $$('#stepper button').forEach(function (b) { b.classList.toggle('on', +b.dataset.step === n); });
  renderStep(); window.scrollTo(0, 0);
}

/* ---------------- Helpers render input ---------------- */
function attrB(sec, id, f) { return ' data-b="' + sec + '|' + esc(id) + '|' + f + '"'; }
function inText(sec, id, f, v, ph, cls) { return '<input class="inp ' + (cls || '') + '"' + attrB(sec, id, f) + ' value="' + esc(v) + '" placeholder="' + esc(ph || '') + '">'; }
function inNum(sec, id, f, v, kind, ph) {
  var cls = kind === 'pct' ? 'pct' : kind === 'money' ? 'num money' : 'num';
  var inp = '<input class="inp ' + cls + '" inputmode="' + (kind === 'money' ? 'numeric' : 'decimal') + '" data-k="' + (kind || 'money') + '"' + attrB(sec, id, f) + ' value="' + esc(numIn(v, kind === 'money' ? 0 : 2)) + '" placeholder="' + (ph || (kind === 'pct' ? '0' : '0')) + '">';
  if (kind === 'pct') return '<div class="inp-wrap">' + inp + '<span class="post">%</span></div>';
  return inp;
}
function inSel(sec, id, f, v, opts, rr, ph) {
  return '<select class="inp"' + attrB(sec, id, f) + (rr ? ' data-rr="1"' : '') + '>' + (ph != null ? '<option value="">' + esc(ph) + '</option>' : '') + opts.map(function (o) { var val = Array.isArray(o) ? o[0] : o, lb = Array.isArray(o) ? o[1] : o; return '<option value="' + esc(val) + '"' + (String(val) === String(v) ? ' selected' : '') + '>' + esc(lb) + '</option>'; }).join('') + '</select>';
}
function calcCell(key, left) { return '<div class="calc' + (left ? ' left' : '') + '" data-c="' + key + '">—</div>'; }
function shOpts() { return W.data.stakeholder.map(function (s) { return [s.sh_id, s.nama || '(tanpa nama)']; }); }
function sektorOpts() { return M.sektorAktif().map(function (s) { return [s.sektor_id, s.nama_sektor]; }); }
function delBtn(sec, id) { return '<button class="btn btn-icon btn-sm btn-ghost ed" data-del="' + sec + '|' + esc(id) + '" title="Hapus baris" style="color:var(--red-solid)">' + ic('trash') + '</button>'; }
function addBtn(sec, label, extra) { return '<button class="btn btn-sm ed" data-add="' + sec + '"' + (extra || '') + '>' + ic('plus') + ' ' + esc(label) + '</button>'; }
function cardSec(title, desc, right, body, formula) {
  return '<div class="card"><div class="card-head"><div><h3>' + title + (formula ? ' <span class="formula">' + esc(formula) + '</span>' : '') + '</h3>' + (desc ? '<p>' + desc + '</p>' : '') + '</div><div class="row">' + (right || '') + '</div></div>' + body + '</div>';
}
function kegLabel(g) { return (g.nama_kegiatan || '(kegiatan)') + ' — ' + M.programName(g.program_id); }

/* ---------------- 8 LANGKAH ---------------- */
var STEP_RENDER = {
  1: function () {
    var p = W.data.proyek, I = function (f, lb, ph, cls) { return '<div class="field ' + (cls || '') + '"><label>' + lb + '</label>' + inText('info', '', f, p[f], ph) + '</div>'; };
    var D = function (f, lb) { return '<div class="field"><label>' + lb + '</label><input type="date" class="inp"' + attrB('info', '', f) + ' value="' + esc(p[f]) + '"></div>'; };
    var T = function (f, lb, ph) { return '<div class="field span3"><label>' + lb + '</label><textarea class="inp"' + attrB('info', '', f) + ' placeholder="' + esc(ph || '') + '">' + esc(p[f]) + '</textarea></div>'; };
    var sh = W.data.stakeholder;
    return cardSec('A. Data Program', 'Padanan tab "Informasi Umum" Excel standar', '',
      '<div class="card-pad" style="padding-top:0"><div class="form-grid">' +
      I('nama_program', 'Nama Program *', 'Program PPU Cakung 2026', 'span2') + '<div class="field"><label>Metode Penilaian</label>' + inSel('info', '', 'metode', p.metode, ['Evaluasi', 'Peramalan']) + '</div>' +
      I('nama_project', 'Nama Project', '') + I('project_owner', 'Project Owner', '') + I('lokasi', 'Lokasi', '') +
      I('gmaps_url', 'Tautan Google Maps', 'https://maps.google.com/…', 'span2') + D('tgl_pengukuran', 'Tanggal Pengukuran') +
      D('periode_awal', 'Periode Program — Awal') + D('periode_akhir', 'Periode Program — Akhir') + I('doc_number', 'Document Number', 'SROI/CKG/2026/001') +
      I('mitra_pelaksana', 'Mitra Pelaksana', '') + I('pic_mitra', 'PIC Mitra Pelaksana', '') + I('hp_pic', 'No. HP PIC', '08…') +
      I('mitra_penilai', 'Mitra Penilai', '') + I('tim_leader_penilai', 'Tim Leader Penilai', '') + I('hp_penilai', 'No. HP Penilai', '08…') +
      I('doc_rev', 'Revisi Dokumen (Rev.)', '0') +
      T('tujuan', 'Tujuan Program', 'Tujuan utama program pembinaan…') + T('aktivitas', 'Aktivitas Utama', 'Ringkasan aktivitas…') +
      T('penjelasan_kualitatif', 'Penjelasan Kualitatif Hasil SROI', 'Interpretasi hasil untuk laporan…') + '</div></div>') +
      cardSec('B. Stakeholder', 'Minimal 1 Pelaksana dan 1 Penerima Manfaat. Kelompok sektor opsional — dipakai untuk memecah proksi per sektor.',
        (sh.length ? '' : '<button class="btn btn-sm ed" data-preset-sh>' + ic('layers') + ' Isi contoh standar</button>') + addBtn('stakeholder', 'Tambah stakeholder'),
        '<div class="tbl-wrap"><table class="tbl edit"><thead><tr><th style="min-width:190px">Nama Stakeholder</th><th style="min-width:160px">Peran</th><th style="min-width:160px">Kelompok Sektor</th><th style="min-width:240px">Alasan Penyertaan</th><th></th></tr></thead><tbody>' +
        (sh.length ? sh.map(function (s) {
          return '<tr><td>' + inText('stakeholder', s.sh_id, 'nama', s.nama, 'mis. UMKM Kuliner') + '</td><td>' + inSel('stakeholder', s.sh_id, 'peran', s.peran, PERAN, false, '— pilih —') + '</td>' +
            '<td>' + inSel('stakeholder', s.sh_id, 'kelompok_sektor', s.kelompok_sektor, sektorOpts(), false, 'Semua sektor') + '</td><td>' + inText('stakeholder', s.sh_id, 'alasan_penyertaan', s.alasan_penyertaan, '') + '</td><td class="act">' + delBtn('stakeholder', s.sh_id) + '</td></tr>';
        }).join('') : '<tr><td colspan="5"><div class="empty">Belum ada stakeholder.</div></td></tr>') + '</tbody></table></div>');
  },

  2: function () {
    var th = W.data.proyek.tahun, kpis = kpiList(), secs = W.sektors, kpiMap = {}, dh = dihitungList();
    W.data.kpi.forEach(function (r) { kpiMap[r.kpi_id + '~' + r.sektor_id] = r; });
    var B = 'border-left:1px solid var(--border)';
    var info = '<div class="grid g-3 mb" style="gap:14px"><div class="card card-pad"><div class="lbl-s">Budget Program (data induk)</div><div class="calc mt-s" style="font-size:18px;font-weight:700">' + ic('lock') + rp(W.ctx.budget) + '</div></div>' +
      '<div class="card card-pad"><div class="lbl-s">UMK Cabang ' + th + '</div><div class="calc mt-s" style="font-size:18px;font-weight:700">' + ic('lock') + rp(W.ctx.umk) + '</div></div>' +
      '<div class="card card-pad"><div class="lbl-s">Total Bobot KPI Cabang</div><div class="calc mt-s" style="font-size:18px;font-weight:700">' + ic('lock') + fmtNum(W.res.bobotTotal, 2) + '%</div></div></div>';
    if (!kpis.length) return info + cardSec('KPI Cabang', '', '', '<div class="empty">KPI cabang tahun ' + th + ' belum diatur Super Admin.</div>');
    // A. KPI cabang (akumulasi)
    var a = cardSec('A. Capaian KPI Cabang (akumulasi semua sektor)', 'Bobot, target, dan satuan dikunci dari data induk. Isi <b>realisasi akumulasi</b> seluruh sektor. Proksi cabang = (realisasi ÷ target) × budget × bobot.', '',
      '<div class="tbl-wrap"><table class="tbl edit"><thead><tr><th>No</th><th style="min-width:200px">KPI</th><th class="r">Bobot</th><th class="r">Target</th><th>Satuan</th><th class="r th-short">Realisasi</th><th class="r">Capaian</th><th class="r" style="min-width:140px">Proksi Cabang</th></tr></thead><tbody>' +
      kpis.map(function (k, i) {
        var r = kpiMap[k.kpi_id + '~ALL'] || {};
        return '<tr><td class="muted">' + (i + 1) + '</td><td class="b">' + esc(k.nama_kpi) + '</td><td class="r tnum">' + fmtNum(k.bobot, 2) + '%</td><td class="r tnum b">' + (N(k.target) ? fmtNum(k.target, 2) : '<span class="text-red">belum diatur</span>') + '</td><td>' + esc(k.satuan || '') + '</td>' +
          '<td class="td-short">' + inNum('kpi', k.kpi_id + '~ALL', 'realisasi', r.realisasi, 'dec') + '</td><td class="r tnum" data-c="cap|' + k.kpi_id + '">—</td><td>' + calcCell('f2c|' + k.kpi_id) + '</td></tr>';
      }).join('') + '</tbody><tfoot><tr><td colspan="7">Total proksi KPI cabang</td><td class="r" data-c="f2cTot|">—</td></tr></tfoot></table></div>', 'Langkah 1');
    // B. sektor binaan
    var chips = M.sektorAktif().map(function (s) { var on = secs.indexOf(s.sektor_id) > -1; return '<span class="chip ' + (on ? 'on' : '') + '" data-sek="' + s.sektor_id + '">' + (on ? ic('check') : ic('plus')) + esc(s.nama_sektor) + '</span>'; }).join('');
    var b = cardSec('B. Sektor Binaan Cabang', 'Pilih <b>semua</b> sektor binaan cabang agar pembagian bobot & budget adil. Sektor UMKM di langkah 3 otomatis ikut.', '', '<div class="card-pad" style="padding-top:0"><div class="chips">' + chips + '</div></div>');
    // C. breakdown
    var head1 = '<tr><th rowspan="2" style="min-width:190px">KPI</th><th rowspan="2" class="r">Target / Realisasi Cabang</th>' + secs.map(function (s) { return '<th colspan="3" class="c" style="' + B + '">' + esc(M.sektorName(s)) + (dh.indexOf(s) > -1 ? ' ✓' : '') + '</th>'; }).join('') + '<th rowspan="2" class="c" style="' + B + '">Cek Σ Sektor</th></tr>';
    var head2 = '<tr>' + secs.map(function () { return '<th class="r" style="' + B + '">Target</th><th class="r">Realisasi</th><th class="r">Proksi (F2)</th>'; }).join('') + '</tr>';
    var body = kpis.map(function (k) {
      var m = kpiMap[k.kpi_id + '~ALL'] || {};
      return '<tr><td class="b">' + esc(k.nama_kpi) + '<span class="sub">' + esc(k.satuan || '') + (/%/.test(k.satuan || '') ? ' • per sektor tidak dijumlah' : '') + '</span></td><td class="r tnum small nowrap" data-c="mtr|' + k.kpi_id + '">—</td>' + secs.map(function (s) {
        var key = k.kpi_id + '~' + s, r = kpiMap[key] || {};
        return '<td style="' + B + ';min-width:90px">' + inNum('kpi', key, 'target', r.target, 'dec') + '</td><td style="min-width:90px">' + inNum('kpi', key, 'realisasi', r.realisasi, 'dec') + '</td><td style="min-width:120px">' + calcCell('f2|' + key) + '</td>';
      }).join('') + '<td class="c" style="' + B + ';min-width:120px" data-c="chk|' + k.kpi_id + '">—</td></tr>';
    }).join('');
    var foot = '<tr><td colspan="2">Total proksi per sektor</td>' + secs.map(function (s) { return '<td colspan="3" class="r" style="' + B + '" data-c="sekTot|' + s + '">—</td>'; }).join('') + '<td class="r" data-c="f3all|">—</td></tr>' +
      '<tr><td colspan="2">Proporsi sektor (F17)</td>' + secs.map(function (s) { return '<td colspan="3" class="r" data-c="f17|' + s + '">—</td>'; }).join('') + '<td></td></tr>';
    var c = cardSec('C. Breakdown KPI per Sektor', 'Bagi target & realisasi cabang ke tiap sektor. Untuk satuan selain %, jumlah semua sektor <b>wajib sama</b> dengan angka cabang. F1 = bobot × (target sektor ÷ Σ target); F2 = (realisasi ÷ target) × budget × F1.', '',
      secs.length ? '<div class="tbl-wrap"><table class="tbl edit"><thead>' + head1 + head2 + '</thead><tbody>' + body + '</tbody><tfoot>' + foot + '</tfoot></table></div>' : '<div class="empty">Pilih sektor binaan di bagian B.</div>', 'Langkah 2 • F1, F2, F17');
    // D. sektor dihitung
    var dChips = secs.map(function (s) { var on = dh.indexOf(s) > -1; return '<span class="chip ' + (on ? 'on' : '') + '" data-dh="' + s + '">' + (on ? ic('check') : ic('plus')) + esc(M.sektorName(s)) + ' <span class="tnum muted" data-c="sekTot|' + s + '">—</span></span>'; }).join('');
    var dd = cardSec('D. Sektor yang Dihitung dalam SROI', 'Sesuai arahan pusat — hanya proksi sektor terpilih yang masuk nilai proksi KPI (F3) di Impact Map. Sektor lain tetap ikut menentukan pembagian bobot.', '',
      '<div class="card-pad" style="padding-top:0">' + (secs.length ? '<div class="chips">' + dChips + '</div><div class="grid g-2 mt-s"><div><div class="lbl-s">Proksi KPI semua sektor</div><div class="calc mt-s" data-c="f3all|">—</div></div><div><div class="lbl-s">Proksi KPI sektor dihitung (F3)</div><div class="calc mt-s" style="font-weight:700" data-c="f3tot|">—</div></div></div>' : '<div class="muted small">Belum ada sektor binaan.</div>') + '</div>', 'Langkah 3 • F3');
    return info + a + b + c + dd;
  },

  3: function () {
    var d = W.data, progs = M.program(), shO = shOpts();
    var kegHtml = progs.map(function (pg) {
      var rows = d.kegiatan.filter(function (g) { return g.program_id === pg.program_id; });
      return '<tr class="grp"><td colspan="7"><span class="row" style="position:sticky;left:8px;display:inline-flex"><span>' + esc(pg.nama_program) + ' <span class="badge ' + (pg.jenis === 'UTAMA' ? 'badge-info' : 'st-Draft') + '" style="height:20px">' + esc(pg.jenis) + '</span></span>' + addBtn('kegiatan', 'Tambah kegiatan', ' data-prog="' + pg.program_id + '"') + '</span></td></tr>' +
        rows.map(function (g) {
          return '<tr><td>' + inText('kegiatan', g.kegiatan_id, 'nama_kegiatan', g.nama_kegiatan, 'Nama kegiatan') + '</td><td>' + inText('kegiatan', g.kegiatan_id, 'waktu', g.waktu, 'Mar 2026') + '</td><td style="width:90px">' + inNum('kegiatan', g.kegiatan_id, 'durasi_hari', g.durasi_hari, 'dec') + '</td>' +
            '<td style="min-width:140px">' + inNum('kegiatan', g.kegiatan_id, 'biaya', g.biaya, 'money') + '</td><td style="min-width:150px">' + inSel('kegiatan', g.kegiatan_id, 'sh_pembiaya_id', g.sh_pembiaya_id, shO, false, '— penanggung —') + '</td>' +
            '<td style="width:110px">' + inNum('kegiatan', g.kegiatan_id, 'jumlah_peserta', g.jumlah_peserta, 'dec', String((W.res.kegiatanStat[g.kegiatan_id] || {}).hadir || 0)) + '</td><td class="act">' + delBtn('kegiatan', g.kegiatan_id) + '</td></tr>';
        }).join('');
    }).join('');
    var um = d.umkm, kg = d.kegiatan, hm = {};
    d.kehadiran.forEach(function (h) { hm[h.umkm_id + '|' + h.kegiatan_id] = h.jumlah; });
    var matrix = um.length && kg.length ? '<div class="tbl-wrap" style="max-height:520px"><table class="tbl matrix"><thead><tr><th>UMKM</th>' + kg.map(function (g) { return '<th class="vert" title="' + esc(kegLabel(g)) + '">' + esc(trunc(g.nama_kegiatan || '(kegiatan)', 26)) + '<div class="tiny muted" style="font-weight:400">' + esc(trunc(M.programName(g.program_id), 14)) + '</div>' + (W.ro ? '' : '<button class="btn btn-xs btn-ghost ed" data-hall="' + g.kegiatan_id + '" title="Isi 1 untuk semua UMKM">✓ semua</button>') + '</th>'; }).join('') + '<th class="r">Total</th></tr></thead><tbody>' +
      um.map(function (u) { return '<tr><td><b>' + esc(u.nama_umkm || '(UMKM)') + '</b><span class="sub">' + esc(M.sektorName(u.sektor_id)) + '</span></td>' + kg.map(function (g) { var v = hm[u.umkm_id + '|' + g.kegiatan_id]; return '<td><input class="inp' + (N(v) > 0 ? ' on' : '') + '" inputmode="numeric" data-h="' + u.umkm_id + '|' + g.kegiatan_id + '" value="' + (N(v) > 0 ? N(v) : '') + '"></td>'; }).join('') + '<td class="r b" data-c="hRow|' + u.umkm_id + '">—</td></tr>'; }).join('') +
      '</tbody><tfoot><tr><td>Jumlah hadir</td>' + kg.map(function (g) { return '<td class="c" data-c="kegH|' + g.kegiatan_id + '">—</td>'; }).join('') + '<td></td></tr></tfoot></table></div>'
      : '<div class="empty">Isi daftar kegiatan dan UMKM terlebih dahulu untuk menampilkan matriks kehadiran.</div>';
    return cardSec('A. Kegiatan per Program', 'Biaya kegiatan otomatis masuk Total Investasi stakeholder penanggungnya (R2). Peserta bisa diisi langsung; bila dikosongkan, otomatis memakai jumlah hadir dari matriks kehadiran (angka abu-abu).', '',
      '<div class="tbl-wrap"><table class="tbl edit"><thead><tr><th style="min-width:200px">Nama Kegiatan</th><th style="min-width:110px">Waktu</th><th class="r">Durasi (hari)</th><th class="r">Biaya (Rp)</th><th>Penanggung Biaya</th><th class="r">Peserta</th><th></th></tr></thead><tbody>' + kegHtml + '</tbody></table></div>') +
      cardSec('B. Daftar UMKM Binaan', um.length + ' UMKM terdaftar. Data omset di langkah 5 mengikuti daftar ini.', '<button class="btn btn-sm ed" data-paste-umkm>' + ic('copy') + ' Tempel dari Excel</button>' + addBtn('umkm', 'Tambah UMKM'),
        '<div class="tbl-wrap" style="max-height:440px"><table class="tbl edit"><thead><tr><th>No</th><th style="min-width:220px">Nama UMKM</th><th style="min-width:170px">Sektor</th><th style="min-width:150px">Status Khusus</th><th></th></tr></thead><tbody>' +
        (um.length ? um.map(function (u, i) { return '<tr><td class="muted">' + (i + 1) + '</td><td>' + inText('umkm', u.umkm_id, 'nama_umkm', u.nama_umkm, 'Nama UMKM') + '</td><td>' + inSel('umkm', u.umkm_id, 'sektor_id', u.sektor_id, sektorOpts(), true, '— sektor —') + '</td><td>' + inSel('umkm', u.umkm_id, 'status_khusus', u.status_khusus, ['Naik Kelas', 'Mandiri'], false, '—') + '</td><td class="act">' + delBtn('umkm', u.umkm_id) + '</td></tr>'; }).join('') : '<tr><td colspan="5"><div class="empty">Belum ada UMKM.</div></td></tr>') + '</tbody></table></div>') +
      cardSec('C. Matriks Kehadiran UMKM', 'Isi berapa kali UMKM hadir di tiap kegiatan (kosong = tidak hadir).', '', matrix);
  },

  4: function () {
    var d = W.data, kgO = [['*', 'Semua kegiatan']].concat(d.kegiatan.map(function (g) { return [g.kegiatan_id, kegLabel(g)]; }));
    if (!d.stakeholder.length) return cardSec('Biaya per Stakeholder', '', '', '<div class="empty">Tambahkan stakeholder di langkah 1 terlebih dahulu.</div>');
    var cards = d.stakeholder.map(function (s) {
      var rows = d.biaya.filter(function (b) { return b.sh_id === s.sh_id; });
      var kegRows = d.kegiatan.filter(function (g) { return g.sh_pembiaya_id === s.sh_id && N(g.biaya); });
      return cardSec(esc(s.nama || '(tanpa nama)') + ' <span class="badge st-Draft" style="height:20px">' + esc(s.peran || '—') + '</span>', '', addBtn('biaya', 'Tambah biaya', ' data-sh="' + s.sh_id + '"'),
        '<div class="tbl-wrap"><table class="tbl edit"><thead><tr><th style="min-width:150px">Kelompok</th><th style="min-width:170px">Komponen</th><th style="min-width:150px">Metode</th><th style="min-width:280px">Rincian</th><th class="r" style="min-width:140px">Nilai (Rp)</th><th style="min-width:140px">Keterangan</th><th></th></tr></thead><tbody>' +
        rows.map(function (b) {
          var m = b.metode || 'MANUAL', det;
          if (m === 'QTY_X_TARIF') det = '<div class="row" style="flex-wrap:nowrap;gap:6px"><div style="width:90px">' + inNum('biaya', b.biaya_id, 'qty', b.qty, 'dec', 'Qty') + '</div><span class="muted">×</span><div class="grow">' + inNum('biaya', b.biaya_id, 'tarif', b.tarif, 'money', 'Tarif') + '</div></div>';
          else if (m === 'WAKTU_TENAGA') det = inSel('biaya', b.biaya_id, 'kegiatan_id', b.kegiatan_id || '*', kgO) + '<div class="tiny muted mt-s">F4: durasi × peserta ÷ ' + fmtNum(SroiEngine.parseParams(W.ctx.params).hk) + ' × UMK</div>';
          else det = inNum('biaya', b.biaya_id, 'nilai', b.nilai, 'money', 'Nilai rupiah');
          return '<tr><td>' + inSel('biaya', b.biaya_id, 'kelompok', b.kelompok, KELOMPOK_BIAYA) + '</td><td>' + inText('biaya', b.biaya_id, 'komponen', b.komponen, 'Komponen biaya') + '</td>' +
            '<td>' + inSel('biaya', b.biaya_id, 'metode', m, [['MANUAL', 'Manual'], ['QTY_X_TARIF', 'Qty × Tarif'], ['WAKTU_TENAGA', 'Waktu & Tenaga (F4)']], true) + '</td><td>' + det + '</td><td>' + calcCell('biaya|' + b.biaya_id) + '</td>' +
            '<td>' + inText('biaya', b.biaya_id, 'keterangan', b.keterangan, '') + '</td><td class="act">' + delBtn('biaya', b.biaya_id) + '</td></tr>';
        }).join('') +
        (kegRows.length ? '<tr class="grp"><td colspan="4">' + ic('lock') + ' Biaya kegiatan dari langkah 3 (' + kegRows.length + ' kegiatan)</td><td class="r" data-c="shKeg|' + s.sh_id + '">—</td><td colspan="2"></td></tr>' : '') +
        (!rows.length && !kegRows.length ? '<tr><td colspan="7"><div class="empty" style="padding:16px">Belum ada biaya untuk stakeholder ini.</div></td></tr>' : '') +
        '</tbody><tfoot><tr><td colspan="4">Subtotal ' + esc(s.nama || '') + '</td><td class="r" data-c="shSub|' + s.sh_id + '">—</td><td colspan="2"></td></tr></tfoot></table></div>');
    }).join('');
    return '<div class="banner banner-blue">' + ic('info') + '<div><b>Semua biaya otomatis masuk Total Investasi (R2)</b><p>Tidak ada pilihan range — setiap baris biaya dan biaya kegiatan dijumlahkan mesin.</p></div></div>' + cards +
      '<div class="card card-pad mt"><div class="grid g-2"><div><div class="lbl-s">Total Investasi (F12)</div><div class="calc mt-s" style="font-size:20px;font-weight:700" data-c="inv|">—</div></div><div><div class="lbl-s">PV Investasi (F13) = Total ÷ (1 + r)</div><div class="calc mt-s" style="font-size:20px;font-weight:700" data-c="pvinv|">—</div></div></div></div>';
  },

  5: function () {
    var d = W.data, om = {}; d.omset.forEach(function (o) { om[o.umkm_id] = o; });
    if (!d.umkm.length) return cardSec('Omset & Net Profit UMKM', '', '', '<div class="empty">Daftar UMKM masih kosong. Isi di langkah 3.</div>');
    return (W.ro ? '' : cardSec('Isi cepat untuk semua UMKM', 'Opsional — terapkan margin & faktor penyesuaian yang sama ke semua baris, lalu sesuaikan per UMKM bila perlu.', '',
      '<div class="card-pad ro-hide" style="padding-top:0"><div class="row ed" style="align-items:flex-end">' +
      ['margin_profit', 'dw', 'ds', 'at', 'do'].map(function (f) { return '<div class="field" style="width:120px"><label>' + (f === 'margin_profit' ? 'Margin ' + tip('margin') : f.toUpperCase() + ' ' + tip(f)) + '</label><div class="inp-wrap"><input class="inp pct" inputmode="decimal" id="bulk_' + f + '" placeholder="—"><span class="post">%</span></div></div>'; }).join('') +
      '<button class="btn" data-bulk-omset>' + ic('copy') + ' Terapkan ke semua</button></div></div>')) +
      cardSec('Kenaikan Net Profit per UMKM', 'F6 = (omset sesudah − sebelum) × margin; F7 = F6 × (1−DW)(1−DS)(1−AT)(1−DO); F8 = Σ F7 semua UMKM (R6, R7).', '',
        '<div class="tbl-wrap" style="max-height:560px"><table class="tbl edit"><thead><tr><th style="min-width:170px">UMKM</th><th class="r" style="min-width:140px">Omset Sebelum</th><th class="r" style="min-width:140px">Omset Sesudah</th><th class="r th-short">Margin ' + tip('margin') + '</th><th class="r" style="min-width:130px">∆ Net Profit (F6)</th>' +
        ['dw', 'ds', 'at', 'do'].map(function (f) { return '<th class="r th-short">' + f.toUpperCase() + ' ' + tip(f) + '</th>'; }).join('') + '<th class="r" style="min-width:130px">Impact (F7)</th></tr></thead><tbody>' +
        d.umkm.map(function (u) {
          var o = om[u.umkm_id] || {};
          return '<tr><td><b>' + esc(u.nama_umkm || '(UMKM)') + '</b><span class="sub">' + esc(M.sektorName(u.sektor_id)) + '</span></td><td>' + inNum('omset', u.umkm_id, 'omset_sebelum', o.omset_sebelum, 'money') + '</td><td>' + inNum('omset', u.umkm_id, 'omset_sesudah', o.omset_sesudah, 'money') + '</td>' +
            '<td class="td-short">' + inNum('omset', u.umkm_id, 'margin_profit', o.margin_profit, 'pct') + '</td><td>' + calcCell('f6|' + u.umkm_id) + '</td>' +
            ['dw', 'ds', 'at', 'do'].map(function (f) { return '<td class="td-short">' + inNum('omset', u.umkm_id, f, o[f], 'pct') + '</td>'; }).join('') + '<td>' + calcCell('f7|' + u.umkm_id) + '</td></tr>';
        }).join('') + '</tbody><tfoot><tr><td colspan="9">Proksi Net Profit Total (F8)</td><td class="r" data-c="f8|">—</td></tr></tfoot></table></div>', 'F6–F8');
  },

  6: function () {
    var d = W.data, kgO = d.kegiatan.map(function (g) { return [g.kegiatan_id, kegLabel(g)]; });
    var bm = d.benchmark, mf = d.manfaat;
    var lab = { SELISIH: ['Nilai sebelum', 'Nilai sesudah'], PERSEN: ['Nilai dasar (Rp)', 'Persentase'], MANUAL: ['Nilai (Rp)', '—'] };
    return cardSec('A. Benchmark Pelatihan & Pendampingan', 'F5 = Σ(biaya expert × peserta) − Σ(biaya internal × peserta). Peserta otomatis dari kehadiran bila kegiatan dipilih.', addBtn('benchmark', 'Tambah benchmark'),
      '<div class="tbl-wrap"><table class="tbl edit"><thead><tr><th style="min-width:220px">Kegiatan</th><th class="r" style="min-width:140px">Biaya Internal / Peserta</th><th style="min-width:160px">Nama Expert / Pembanding</th><th class="r" style="min-width:140px">Biaya Expert / Peserta</th><th class="r" style="min-width:100px">Peserta</th><th class="r" style="min-width:140px">Benefit (F5)</th><th></th></tr></thead><tbody>' +
      (bm.length ? bm.map(function (b) {
        return '<tr><td>' + inSel('benchmark', b.bm_id, 'kegiatan_id', b.kegiatan_id, kgO, true, '— tanpa kegiatan (isi peserta manual) —') + '</td><td>' + inNum('benchmark', b.bm_id, 'biaya_internal_per_peserta', b.biaya_internal_per_peserta, 'money') + '</td>' +
          '<td>' + inText('benchmark', b.bm_id, 'nama_expert', b.nama_expert, 'Lembaga pembanding') + '</td><td>' + inNum('benchmark', b.bm_id, 'biaya_expert_per_peserta', b.biaya_expert_per_peserta, 'money') + '</td>' +
          '<td>' + (b.kegiatan_id ? calcCell('bmP|' + b.bm_id) : inNum('benchmark', b.bm_id, 'jumlah_peserta', b.jumlah_peserta, 'dec')) + '</td><td>' + calcCell('bm|' + b.bm_id) + '</td><td class="act">' + delBtn('benchmark', b.bm_id) + '</td></tr>';
      }).join('') : '<tr><td colspan="7"><div class="empty" style="padding:16px">Belum ada benchmark.</div></td></tr>') + '</tbody><tfoot><tr><td colspan="5">Total Benefit Benchmark (F5)</td><td class="r" data-c="f5|">—</td><td></td></tr></tfoot></table></div>', 'F5') +
      cardSec('B. Manfaat Stakeholder Lain', 'Mis. UT, FIF, mitra. Satu baris hanya boleh dipakai satu outcome (R5).', addBtn('manfaat', 'Tambah manfaat'),
        '<div class="tbl-wrap"><table class="tbl edit"><thead><tr><th style="min-width:160px">Stakeholder</th><th style="min-width:180px">Parameter Manfaat</th><th style="min-width:150px">Metode</th><th class="r" style="min-width:140px">Nilai A</th><th class="r" style="min-width:130px">Nilai B</th><th class="r" style="min-width:140px">Hasil</th><th style="min-width:140px">Keterangan</th><th></th></tr></thead><tbody>' +
        (mf.length ? mf.map(function (m) {
          var met = m.metode || 'SELISIH', L = lab[met] || lab.MANUAL;
          return '<tr><td>' + inSel('manfaat', m.mf_id, 'sh_id', m.sh_id, shOpts(), false, '— pilih —') + '</td><td>' + inText('manfaat', m.mf_id, 'parameter', m.parameter, 'mis. Penghematan biaya CSR') + '</td>' +
            '<td>' + inSel('manfaat', m.mf_id, 'metode', met, [['SELISIH', 'Selisih (sesudah − sebelum)'], ['PERSEN', 'Persen (nilai × %)'], ['MANUAL', 'Manual']], true) + '</td>' +
            '<td><div class="tiny muted" style="margin-bottom:2px">' + L[0] + '</div>' + inNum('manfaat', m.mf_id, 'nilai_a', m.nilai_a, 'money') + '</td>' +
            '<td><div class="tiny muted" style="margin-bottom:2px">' + L[1] + '</div>' + (met === 'MANUAL' ? '<div class="calc">—</div>' : met === 'PERSEN' ? inNum('manfaat', m.mf_id, 'nilai_b', m.nilai_b, 'pct') : inNum('manfaat', m.mf_id, 'nilai_b', m.nilai_b, 'money')) + '</td>' +
            '<td><div class="tiny muted" style="margin-bottom:2px">&nbsp;</div>' + calcCell('mf|' + m.mf_id) + '</td><td>' + inText('manfaat', m.mf_id, 'keterangan', m.keterangan, '') + '</td><td class="act">' + delBtn('manfaat', m.mf_id) + '</td></tr>';
        }).join('') : '<tr><td colspan="8"><div class="empty" style="padding:16px">Belum ada manfaat stakeholder.</div></td></tr>') + '</tbody></table></div>');
  },

  7: function () {
    var d = W.data, kpis = kpiList();
    var JENIS = [['KPI_BUDGET', 'KPI × Budget (F3)'], ['BENCHMARK', 'Benchmark (F5)'], ['NET_PROFIT', 'Net Profit UMKM (F8)'], ['MANFAAT_SH', 'Manfaat Stakeholder'], ['MANUAL', 'Manual']];
    var cards = d.outcome.map(function (o, i) {
      var list = pkList(o);
      var comps = list.map(function (c, ci) {
        var key = o.outcome_id + '~' + ci, j = c.jenis, refs = String(c.ref || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
        var chip = function (val, label) { var on = refs.indexOf(val) > -1; return '<span class="chip ' + (on ? 'on' : '') + '" data-ref="' + key + '|' + esc(val) + '">' + (on ? ic('check') : '') + esc(label) + '</span>'; };
        var src = '';
        if (j === 'KPI_BUDGET') src = chip('ALL', 'Semua KPI') + kpis.map(function (k) { return chip(k.kpi_id, k.nama_kpi); }).join('');
        else if (j === 'BENCHMARK') src = '<div class="src-grp"><span class="src-l">Benchmark</span>' + chip('ALL', 'Semua benchmark') + d.benchmark.map(function (b, x) { return chip(b.bm_id, '#' + (x + 1) + ' ' + (b.nama_expert || 'Benchmark')); }).join('') + '</div>' + sekChips(chip, refs, 'Semua sektor', 'Peserta benchmark dihitung dari kehadiran UMKM sektor terpilih (langkah 3).');
        else if (j === 'NET_PROFIT') src = '<div class="src-grp"><span class="src-l">Sektor UMKM</span>' + chip('ALL', 'Semua sektor (' + d.umkm.length + ' UMKM)') + sekList().map(function (x) { return chip('SEK:' + x.id, x.nama + ' (' + x.n + ' UMKM)'); }).join('') + '</div><div class="src-hint">Pilih satu atau beberapa sektor — nilai Net Profit hanya dari UMKM sektor terpilih.' + (function () { var sh = d.stakeholder.filter(function (x) { return x.sh_id === o.sh_id; })[0]; return sh && sh.kelompok_sektor ? ' Stakeholder ini berkelompok sektor <b>' + esc(M.sektorName(sh.kelompok_sektor)) + '</b>, jadi hanya UMKM sektor itu yang dihitung.' : ''; })() + '</div>';
        else if (j === 'MANFAAT_SH') src = d.manfaat.length ? d.manfaat.map(function (m, x) { return chip(m.mf_id, '#' + (x + 1) + ' ' + (m.parameter || 'Manfaat')); }).join('') : '<span class="small muted">Tabel manfaat stakeholder (langkah 6) masih kosong.</span>';
        else if (j === 'MANUAL') src = '<span class="small muted">Isi nilai proksi dan catatan sumbernya.</span>';
        else src = '<span class="small muted">Pilih jenis proksi terlebih dahulu.</span>';
        return '<div class="pk-row"><div class="pk-head"><span class="pk-no">Proksi ' + (ci + 1) + '</span>' + (list.length > 1 ? '<button class="btn btn-icon btn-sm btn-ghost ed" data-delpk="' + key + '" title="Hapus jenis proksi ini" style="color:var(--red-solid)">' + ic('trash') + '</button>' : '') + '</div>' +
          '<div class="pk-grid">' +
          '<div class="field pk-j"><label>Jenis proksi *</label>' + inSel('pk', key, 'jenis', j, JENIS, true, '— pilih jenis proksi —') + '</div>' +
          '<div class="field"><label>Porsi ' + tip('porsi') + '</label>' + inNum('pk', key, 'porsi', c.porsi === '' || c.porsi == null ? 100 : c.porsi, 'pct') + '</div>' +
          '<div class="field"><label>Nilai proksi</label>' + (j === 'MANUAL' ? inNum('pk', key, 'nilai', c.nilai, 'money') : calcCell('pkNilai|' + key)) + '</div>' +
          '<div class="field"><label>Setelah porsi</label>' + calcCell('pkNP|' + key) + '</div>' +
          '<div class="field pk-full"><label>Sumber proksi</label><div class="chips">' + src + '</div></div>' +
          '<div class="field pk-full"><label>Catatan sumber proksi' + (j === 'MANUAL' ? ' *' : '') + '</label>' + inText('pk', key, 'notes', c.notes, 'Referensi / dasar nilai proksi') + '</div>' +
          ['dw', 'ds', 'at', 'do'].map(function (f) { return '<div class="field"><label>' + f.toUpperCase() + ' ' + tip(f) + '</label>' + inNum('pk', key, f, c[f], 'pct') + '</div>'; }).join('') +
          '<div class="field pk-full pk-imp"><span>Impact proksi ' + (ci + 1) + ' (tahun 1)</span>' + calcCell('pkImp|' + key) + '</div>' +
          '</div></div>';
      }).join('');
      var sh = d.stakeholder.filter(function (s) { return s.sh_id === o.sh_id; })[0];
      return '<div class="oc-card"><div class="oc-head"><span class="oc-num">' + (i + 1) + '</span><b class="grow">' + esc(sh ? sh.nama : 'Outcome baru') + (sh && sh.kelompok_sektor ? ' <span class="badge st-Draft" style="height:20px">' + esc(M.sektorName(sh.kelompok_sektor)) + '</span>' : '') + (list.length > 1 ? ' <span class="badge badge-info" style="height:20px">' + list.length + ' jenis proksi</span>' : '') + '</b>' +
        '<span class="small muted">Impact tahun 1</span><span class="calc" style="min-height:32px" data-c="ocImpact|' + o.outcome_id + '">—</span>' + delBtn('outcome', o.outcome_id) + '</div>' +
        '<div class="oc-grid">' +
        '<div class="field"><label>Stakeholder *</label>' + inSel('outcome', o.outcome_id, 'sh_id', o.sh_id, shOpts(), true, '— pilih —') + '</div>' +
        '<div class="field"><label>Input terkait</label>' + inText('outcome', o.outcome_id, 'input_ref', o.input_ref, 'mis. Biaya pelatihan') + '</div>' +
        '<div class="field s2"><label>Output ringkas</label>' + inText('outcome', o.outcome_id, 'output_ringkas', o.output_ringkas, 'mis. 30 UMKM mengikuti pelatihan') + '</div>' +
        '<div class="field s2"><label>Deskripsi outcome</label>' + inText('outcome', o.outcome_id, 'deskripsi_outcome', o.deskripsi_outcome, 'Perubahan yang dialami stakeholder') + '</div>' +
        '<div class="field"><label>Indikator sebelum</label>' + inText('outcome', o.outcome_id, 'indikator_sebelum', o.indikator_sebelum, '') + '</div>' +
        '<div class="field"><label>Indikator sesudah</label>' + inText('outcome', o.outcome_id, 'indikator_sesudah', o.indikator_sesudah, '') + '</div>' +
        '<div class="field s2"><label>Sumber informasi</label>' + inText('outcome', o.outcome_id, 'sumber_informasi', o.sumber_informasi, 'Kuisioner, wawancara, data omset') + '</div>' +
        '<div class="field"><label>Durasi (tahun)</label>' + inNum('outcome', o.outcome_id, 'durasi_tahun', o.durasi_tahun || 1, 'dec') + '</div>' +
        '<div class="field"><label>Mulai</label>' + inSel('outcome', o.outcome_id, 'mulai', o.mulai || 1, [[1, 'Saat aktivitas'], [2, 'Setelah aktivitas']]) + '</div>' +
        '<div class="field s4"><label>Proksi outcome — bisa lebih dari satu jenis (R3: setiap outcome memakai sumber proksinya sendiri)</label>' + comps +
        '<div class="row between"><button class="btn btn-sm ed" data-addpk="' + o.outcome_id + '">' + ic('plus') + ' Tambah jenis proksi</button><span class="row small" style="gap:8px"><b>Total nilai proksi</b><span class="calc" style="min-height:32px" data-c="ocNilai|' + o.outcome_id + '">—</span><b>Total impact</b><span class="calc" style="min-height:32px" data-c="ocImpact|' + o.outcome_id + '">—</span></span></div></div>' +
        '<div class="field s2"><label>Catatan umum outcome</label>' + inText('outcome', o.outcome_id, 'proxy_notes', o.proxy_notes, 'Opsional') + '</div>' +
        '<div class="field s2"><label>PV impact (seluruh durasi)</label>' + calcCell('ocPv|' + o.outcome_id) + '</div>' +
        '</div></div>';
    }).join('');
    return cardSec('Pemakaian Sumber Proksi', 'Setiap sumber maksimal 100% di seluruh outcome & jenis proksi (R4/R5). Merah = terhitung dobel, perhitungan tidak bisa dikirim.', '', '<div class="card-pad" style="padding-top:0" data-c="usage|"></div>') +
      cardSec('Impact Map', 'Satu outcome bisa memakai beberapa jenis proksi, masing-masing dengan DW/DS/AT/DO sendiri. F9 = Σ[(nilai proksi × porsi) × (1−DW)(1−DS)(1−AT)(1−DO)] per proksi; F10 tahun berikutnya × (1−DO) per proksi; F11 PV = Σ impact ÷ (1+r)^n.', addBtn('outcome', 'Tambah outcome'),
        '<div class="card-pad" style="padding-top:0">' + (cards || '<div class="empty">Belum ada outcome. Klik <b>Tambah outcome</b>.</div>') + '</div>', 'F9–F11');
  },

  8: function () {
    var r = W.res, d = W.data, p = d.proyek, me = App.me;
    var editable = (p.status === 'Draft' || p.status === 'Perlu Revisi') && me.role === 'CABANG';
    var segs = r.sebaran.map(function (s) { return { label: s.nama, value: s.nilai }; });
    var vl = r.errors.map(function (e) { return '<div class="v e" data-go="' + e.step + '">' + ic('alert') + '<span>' + esc(e.msg) + '</span><span class="stp">Langkah ' + e.step + ' →</span></div>'; }).join('') +
      r.warnings.map(function (e) { return '<div class="v w" data-go="' + e.step + '">' + ic('info') + '<span>' + esc(e.msg) + '</span><span class="stp">Langkah ' + e.step + ' →</span></div>'; }).join('');
    var actions = '';
    if (editable) actions = '<button class="btn" data-save>' + ic('save') + ' Simpan sekarang</button><button class="btn btn-primary" data-submit' + (r.errors.length ? ' disabled title="Perbaiki kesalahan validasi dulu"' : '') + '>' + ic('send') + ' Kirim ke Pusat</button>';
    if (me.role === 'ADMIN' && p.status === 'Dikirim') actions = '<button class="btn btn-danger" data-return>' + ic('refresh') + ' Kembalikan untuk Revisi</button><button class="btn btn-success" data-approve>' + ic('check-circle') + ' Setujui & Kunci</button>';
    if (me.role === 'ADMIN' && p.status === 'Disetujui') actions = W.unlockOpen
      ? '<button class="btn" data-relock>' + ic('lock') + ' Kunci Kembali</button><button class="btn btn-danger" data-return>' + ic('refresh') + ' Kembalikan untuk Revisi</button>'
      : '<button class="btn btn-warn" data-unlock>' + ic('unlock') + ' Buka Kunci</button>';
    var canUpload = editable;
    var berkas = d.berkas || [];
    return '<div class="grid g-4 kpis" style="gap:14px">' +
      '<div class="card kpi hl"><div class="lbl">Rasio SROI (' + esc(r.params.rumus) + ')</div><div class="val big">' + ratioFmt(r.rasio) + '</div><div class="foot"><span>Klasik ' + fmtNum(r.rasioKlasik, 2) + '</span><span>Bersih ' + fmtNum(r.rasioBersih, 2) + '</span></div></div>' +
      '<div class="card kpi"><div class="lbl">Kategori</div><div style="margin-top:10px">' + starsHtml(r.bintang, 'lg') + '</div><div class="foot"><span class="b" style="color:var(--text)">' + esc(r.bintangLabel) + '</span><span class="badge badge-info">Bintang ' + r.bintang + '</span></div></div>' +
      '<div class="card kpi"><div class="lbl">Investasi</div><div class="val" title="' + rp(r.pvInvestasi) + '">' + rp(r.pvInvestasi) + '</div><div class="foot"><span>PV</span><span>Nominal ' + rp(r.totalInvestasi) + '</span></div></div>' +
      '<div class="card kpi"><div class="lbl">Impact</div><div class="val green">' + rp(r.pvImpact) + '</div><div class="foot"><span>PV</span><span>Nominal ' + rp(r.totalImpact) + '</span></div></div></div>' +
      '<div class="grid g-21 mt"><div>' +
      cardSec('Validasi sebelum dikirim', r.errors.length ? '<span class="text-red b">' + r.errors.length + ' kesalahan</span> memblokir pengiriman • ' + r.warnings.length + ' peringatan' : '<span class="text-green b">Tidak ada kesalahan</span> • ' + r.warnings.length + ' peringatan (tidak memblokir)', '',
        '<div class="card-pad" style="padding-top:0"><div class="vlist">' + (vl || '<div class="v" style="background:#F0FDF4;color:#166534">' + ic('check-circle') + ' Semua validasi lolos.</div>') + '</div></div>') +
      cardSec('Berkas Pendukung', 'PDF, JPG/PNG, XLS/XLSX, DOCX • maks. ' + fmtNum(M.param('maks_ukuran_berkas_mb', 10)) + ' MB per berkas', '',
        '<div class="card-pad" style="padding-top:0">' + (canUpload ? '<div class="dropzone mb-s"><div class="row" style="justify-content:center"><select class="inp" id="bkJenis" style="width:auto">' + JENIS_BERKAS.map(function (j) { return '<option>' + j + '</option>'; }).join('') + '</select><label class="btn btn-primary btn-sm">' + ic('upload') + ' Pilih & unggah berkas<input type="file" id="bkFile" hidden accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.docx"></label></div><div class="small mt-s" id="bkMsg">Berkas disimpan di Google Drive folder ' + p.tahun + '/' + esc(M.cabang(p.cabang_id).kode || '') + '.</div></div>' : '') +
        (me.role === 'STAKEHOLDER' ? '<div class="muted small">Berkas pendukung tidak ditampilkan untuk peran Stakeholder.</div>' : berkas.length ? berkas.map(function (b) {
          return '<div class="file-row"><div class="file-ic">' + ic('paperclip') + '</div><div class="grow" style="min-width:0"><a href="' + esc(b.url) + '" target="_blank" rel="noopener" class="b">' + esc(b.nama_file) + '</a><div class="small muted">' + esc(b.jenis) + ' • ' + fmtNum(N(b.ukuran) / 1024, 0) + ' KB • ' + esc(b.diunggah_oleh) + ' • ' + fmtDate(b.waktu) + '</div></div>' + (canUpload ? '<button class="btn btn-icon btn-sm btn-ghost" data-delberkas="' + b.berkas_id + '" style="color:var(--red-solid)">' + ic('trash') + '</button>' : '') + '</div>';
        }).join('') : '<div class="muted small">Belum ada berkas.</div>') + '</div>') +
      '</div><div>' +
      cardSec('Sebaran Manfaat (F16)', 'Porsi PV impact per stakeholder', '', '<div class="card-pad" style="padding-top:0">' + Charts.donut(segs, { title: 'PV Impact', value: rpShort(r.pvImpact) }) + '<div class="mt-s">' + Charts.legend(segs) + '</div></div>') +
      cardSec('Laporan', 'Ekspor dokumen siap arsip', '', '<div class="card-pad ro-ok" style="padding-top:0"><div class="row"><button class="btn" data-exp="pdf">' + ic('file-text') + ' PDF</button><button class="btn" data-exp="xlsx">' + ic('download') + ' Excel (6 sheet)</button></div><p class="small muted mt-s">Ekspor memakai data terakhir di layar ini.</p></div>') +
      '</div></div>' +
      (actions ? '<div class="card card-pad mt row between' + (W.unlockOpen && p.status === 'Disetujui' ? ' unlock-open' : '') + '" id="decideCard"><div><b>' + (me.role === 'ADMIN' && p.status === 'Dikirim' ? 'Keputusan Super Admin' : p.status === 'Disetujui' ? (W.unlockOpen ? ic('unlock') + ' Kunci dibuka — kembalikan ke cabang untuk revisi?' : ic('lock') + ' Perhitungan disetujui & terkunci') : 'Kirim ke kantor pusat') + '</b><div class="small muted">' + (me.role === 'ADMIN' && p.status === 'Dikirim' ? 'Server akan menghitung ulang dengan SroiEngine dan menyimpan snapshot parameter.' : p.status === 'Disetujui' ? (W.unlockOpen ? 'Klik <b>Kembalikan untuk Revisi</b> dan tulis arahan pusat. Status menjadi Perlu Revisi, cabang bisa mengubah data, dan hasilnya keluar dari dashboard akumulasi sampai disetujui ulang. Klik <b>Kunci Kembali</b> bila batal.' : 'Cabang tidak bisa mengubah maupun menghapus laporan ini. Bila ada perubahan dari pusat, klik <b>Buka Kunci</b>.') : 'Setelah dikirim, data terkunci sampai pusat memutuskan.') + '</div></div><div class="row">' + actions + '</div></div>' : '');
  }
};

/* ---------------- Nilai sel hitung ---------------- */
function calcText(type, key) {
  var r = W.res, d = W.data;
  switch (type) {
    case 'f2': var ps = key.split('~'), kp = r.kpi.perKpi.filter(function (k) { return k.kpi_id === ps[0]; })[0]; var c = kp && kp.perSektor.filter(function (s) { return s.sektor_id === ps[1]; })[0]; return c ? rp(c.f2) : '—';
    case 'f3': var k3 = r.kpi.perKpi.filter(function (k) { return k.kpi_id === key; })[0]; return k3 ? rp(k3.total) : '—';
    case 'f3tot': return rp(r.kpi.total);
    case 'f3all': return rp(r.kpi.totalSemua);
    case 'f2c': var kc = r.kpi.perKpi.filter(function (k) { return k.kpi_id === key; })[0]; return kc ? rp(kc.proksiCabang) : '—';
    case 'f2cTot': return rp(r.kpi.totalCabang);
    case 'mtr': var km = r.kpi.perKpi.filter(function (k) { return k.kpi_id === key; })[0]; return km ? fmtNum(km.targetCabang, 2) + ' / ' + fmtNum(km.realisasiCabang, 2) : '—';
    case 'cap': var kp2 = r.kpi.perKpi.filter(function (k) { return k.kpi_id === key; })[0]; return kp2 && kp2.targetCabang ? pctFmt(kp2.capaian, 1) : '—';
    case 'chk': var kk = r.kpi.perKpi.filter(function (k) { return k.kpi_id === key; })[0]; if (!kk) return '—'; if (kk.isPct) return 'rata-rata'; return (Math.abs(kk.selisihTarget) < 1e-9 && Math.abs(kk.selisihReal) < 1e-9) ? '✓ Sesuai' : '⚠ T ' + fmtNum(kk.target, 2) + ' • R ' + fmtNum(kk.realisasi, 2);
    case 'sekTot': var t = 0; r.kpi.perKpi.forEach(function (k) { k.perSektor.forEach(function (s) { if (s.sektor_id === key) t += s.f2; }); }); return rp(t);
    case 'f17': return pctFmt(r.kpi.proporsiSektor[key] || 0, 2);
    case 'kegP': return fmtNum((r.kegiatanStat[key] || {}).peserta || 0);
    case 'kegU': return fmtNum((r.kegiatanStat[key] || {}).umkm || 0);
    case 'kegH': return fmtNum((r.kegiatanStat[key] || {}).hadir || 0);
    case 'hRow': var s = 0; d.kehadiran.forEach(function (h) { if (h.umkm_id === key) s += N(h.jumlah); }); return fmtNum(s);
    case 'biaya': return rp(r.biaya[key] || 0);
    case 'shKeg': var sk = 0; d.kegiatan.forEach(function (g) { if (g.sh_pembiaya_id === key) sk += N(g.biaya); }); return rp(sk);
    case 'shSub': var it = r.investasiPerSh.filter(function (x) { return x.sh_id === key; })[0]; return rp(it ? it.nilai : 0);
    case 'inv': return rp(r.totalInvestasi);
    case 'pvinv': return rp(r.pvInvestasi);
    case 'f6': return rp((r.omset[key] || {}).f6 || 0);
    case 'f7': return rp((r.omset[key] || {}).f7 || 0);
    case 'f8': return rp(r.netProfit);
    case 'bmP': return fmtNum((r.benchmark[key] || {}).peserta || 0);
    case 'bm': return rp((r.benchmark[key] || {}).nilai || 0);
    case 'f5': return rp(r.benchmarkTotal);
    case 'mf': return rp(r.manfaat[key] || 0);
    case 'ocNilai': return rp((r.outcome[key] || {}).nilai_porsi || 0);
    case 'pkImp': var ki = key.split('~'), ohi = r.outcome[ki[0]] || {}; return rp(((ohi.komponen || [])[+ki[1]] || {}).impact || 0);
    case 'pkNilai': case 'pkNP': var kp3 = key.split('~'), oh = r.outcome[kp3[0]] || {}, cc = (oh.komponen || [])[+kp3[1]] || {}; return rp(type === 'pkNilai' ? cc.nilai || 0 : cc.nilaiPorsi || 0);
    case 'ocImpact': return rp((r.outcome[key] || {}).impact || 0);
    case 'ocPv': var o = r.outcome[key] || {}; return rp(o.pv || 0) + ((o.impactTahun || []).length > 1 ? ' (' + o.impactTahun.length + ' th)' : '');
  }
  return '—';
}
function updateCalc() {
  compute();
  var main = $('#wzMain'); if (!main) return;
  $$('[data-c]', main).forEach(function (el) {
    var p = el.dataset.c.split('|'), t = p[0], k = p.slice(1).join('|');
    if (t === 'usage') { el.innerHTML = usageHtml(el); return; }
    el.textContent = calcText(t, k);
    if (t === 'chk') el.style.color = /⚠/.test(el.textContent) ? 'var(--red-solid)' : '#15803D';
  });
  $$('input[data-b$="|jumlah_peserta"]', main).forEach(function (el) { var id = el.dataset.b.split('|')[1]; el.placeholder = String((W.res.kegiatanStat[id] || {}).hadir || 0); });
  updatePanel();
}
/** Pemakaian sumber proksi: kartu ringkas, maks. 5 baris per halaman; sumber yang terhitung dobel (merah) selalu di depan. */
var USAGE_ROWS = 5, USAGE_MINW = 200, USAGE_GAP = 8;
function usageCols(el) { var w = (el && el.clientWidth) || 900; return Math.max(1, Math.floor((w + USAGE_GAP) / (USAGE_MINW + USAGE_GAP))); }
function usageHtml(el) {
  var u = W.res.usage, keys = Object.keys(u);
  if (el && !el._ro && window.ResizeObserver) { el._uw = el.clientWidth; el._ro = new ResizeObserver(debounce(function () { if (el.isConnected && el.clientWidth !== el._uw) { el._uw = el.clientWidth; el.innerHTML = usageHtml(el); } }, 80)); el._ro.observe(el); }
  if (!keys.length) return '<div class="muted small">Belum ada sumber proksi yang dipakai.</div>';
  var list = keys.map(function (k, i) { var x = u[k]; return { k: k, x: x, i: i, over: x.porsi > 100.0001 }; });
  list.sort(function (a, b) { return (b.over - a.over) || (a.over ? b.x.porsi - a.x.porsi : a.i - b.i); });
  var nOver = list.filter(function (o) { return o.over; }).length, cols = usageCols(el), per = cols * USAGE_ROWS, pages = Math.max(1, Math.ceil(list.length / per));
  var pg = Math.min(Math.max(1, W.usagePage || 1), pages); W.usagePage = pg;
  var items = list.slice((pg - 1) * per, pg * per);
  var head = '<div class="usage-head"><span><b>' + list.length + '</b> sumber proksi dipakai</span>' +
    (nOver ? '<span class="text-red b">' + ic('alert') + ' ' + nOver + ' terhitung dobel — ditampilkan paling depan</span>' : '<span class="text-green b">' + ic('check-circle') + ' Semua sumber ≤ 100%</span>') + '</div>';
  var grid = '<div class="usage" style="grid-template-columns:repeat(' + cols + ',minmax(0,1fr))">' + items.map(function (o) {
    var x = o.x;
    return '<div class="u' + (o.over ? ' over' : '') + '" title="' + esc(x.label) + ' — ' + fmtNum(x.porsi, 1) + '%"><div class="u1"><b>' + esc(String(x.label).replace(/^net profit\s+/i, '')) + '</b><span class="' + (o.over ? 'text-red' : 'text-green') + '">' + fmtNum(x.porsi, 1) + '%</span></div><div class="u2"><small>' + esc(String(x.group).replace(/_/g, ' ')) + '</small><div class="bar"><i style="width:' + Math.min(100, x.porsi) + '%"></i></div></div></div>';
  }).join('') + '</div>';
  var pager = '';
  if (pages > 1) {
    var btn = function (n, lbl, dis, on) { return '<button class="pg' + (on ? ' on' : '') + '" data-upage="' + n + '"' + (dis ? ' disabled' : '') + '>' + lbl + '</button>'; };
    var nums = [], add = function (n) { if (nums.indexOf(n) < 0 && n >= 1 && n <= pages) nums.push(n); };
    add(1); for (var i = pg - 1; i <= pg + 1; i++) add(i); add(pages); nums.sort(function (a, b) { return a - b; });
    var parts = [], prev = 0; nums.forEach(function (n) { if (n - prev > 1) parts.push('<span class="pg-gap">…</span>'); parts.push(btn(n, n, false, n === pg)); prev = n; });
    pager = '<div class="usage-pager"><span class="tiny muted">Menampilkan ' + ((pg - 1) * per + 1) + '–' + Math.min(pg * per, list.length) + ' dari ' + list.length + '</span><div class="row" style="gap:4px">' + btn(pg - 1, '‹', pg === 1) + parts.join('') + btn(pg + 1, '›', pg === pages) + '</div></div>';
  }
  return head + grid + pager;
}
function updatePanel() {
  var r = W.res, pn = $('#panel'), pm = $('#panelM'); if (!pn) return;
  var top = r.sebaran.slice(0, 4);
  pn.innerHTML = '<h4><span class="live"></span>Hasil Real-Time</h4><div class="small muted">Rasio SROI (' + esc(r.params.rumus) + ')</div><div class="ratio">' + fmtNum(r.rasio, 2) + '<span style="font-size:18px;color:var(--muted)"> : 1</span></div>' +
    '<div style="margin:4px 0 12px">' + starsHtml(r.bintang) + ' <span class="small b">' + esc(r.bintangLabel) + '</span></div>' +
    '<div class="pv"><span>Total Investasi (PV)</span><b>' + rp(r.pvInvestasi) + '</b></div><div class="pv"><span>Total Impact (PV)</span><b class="text-green">' + rp(r.pvImpact) + '</b></div>' +
    '<div class="pv"><span>Rasio bersih</span><b>' + fmtNum(r.rasioBersih, 2) + '</b></div>' +
    (function () { var pp = W.data.proyek, t = M.targetCabang(pp.tahun, pp.cabang_id); return t ? '<div class="pv"><span>' + ic('target') + ' Target SROI ' + pp.tahun + '</span><b class="' + (r.rasio >= t ? 'text-green' : '') + '">' + fmtNum(t, 2) + (r.rasio >= t ? ' ✓' : ' (' + pctFmt(r.rasio / t, 0) + ')') + '</b></div>' : ''; })() +
    '<div class="val-box" data-go="8">' + (r.errors.length ? '<span class="text-red b">' + ic('alert') + ' ' + r.errors.length + ' kesalahan</span>' : '<span class="text-green b">' + ic('check-circle') + ' Validasi lolos</span>') + '<span class="muted">' + r.warnings.length + ' peringatan</span></div>' +
    (top.length ? '<div class="mini"><div class="small b" style="color:var(--primary-dark)">Sebaran manfaat</div>' + top.map(function (s) { return '<div class="mrow"><div class="row between"><span>' + esc(trunc(s.nama, 22)) + '</span><b>' + pctFmt(s.porsi, 0) + '</b></div><div class="bar"><i style="width:' + (s.porsi * 100) + '%"></i></div></div>'; }).join('') + '</div>' : '');
  pm.innerHTML = '<div><small>Rasio SROI</small><div class="pm-r">' + fmtNum(r.rasio, 2) + ' : 1</div></div><div>' + starsHtml(r.bintang, 'sm') + '<small>' + esc(r.bintangLabel) + '</small></div><div class="grow"></div><div class="r"><small>PV Impact</small><b>' + rpShort(r.pvImpact) + '</b></div><div class="r"><small>Validasi</small><b>' + (r.errors.length ? '⚠ ' + r.errors.length : '✓') + '</b></div>';
  $$('#stepper button').forEach(function (b) { var n = +b.dataset.step; b.classList.toggle('err', r.errors.some(function (e) { return e.step === n; })); });
}
function setSaveInd() {
  var el = $('#saveInd'); if (!el) return;
  if (W.ro) { el.className = 'save-ind'; el.innerHTML = ic('lock') + ' Mode baca'; return; }
  if (W.saving) { el.className = 'save-ind'; el.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px"></span> Menyimpan…'; return; }
  if (W.saveErr) { el.className = 'save-ind err'; el.innerHTML = ic('alert') + ' Gagal simpan — tersimpan di perangkat'; el.title = W.saveErr; return; }
  if (hasDirty()) { el.className = 'save-ind'; el.innerHTML = ic('clock') + ' Belum tersimpan'; return; }
  el.className = 'save-ind ok'; el.innerHTML = ic('check') + ' Tersimpan' + (W.lastSaved ? ' ' + W.lastSaved : ' ✓');
}

/* ---------------- Event: input ---------------- */
function findRow(sec, id) {
  var d = W.data;
  if (sec === 'info') return d.proyek;
  if (sec === 'pk') { var pp = id.split('~'), oo = d.outcome.filter(function (x) { return x.outcome_id === pp[0]; })[0]; return oo ? pkList(oo)[+pp[1]] : null; }
  if (sec === 'kpi') { var p = id.split('~'); var r = d.kpi.filter(function (x) { return x.kpi_id === p[0] && x.sektor_id === p[1]; })[0]; if (!r) { r = { kpi_id: p[0], sektor_id: p[1], target: '', realisasi: '' }; d.kpi.push(r); } return r; }
  var k = ROW_KEY[sec]; return (d[sec] || []).filter(function (x) { return String(x[k]) === String(id); })[0];
}
var calcSoon = (function () { var q = false; return function () { if (q) return; q = true; requestAnimationFrame(function () { q = false; updateCalc(); }); }; })();
function onWzInput(e) {
  var t = e.target;
  if (W.ro) return;
  if (t.dataset.h) {
    var ps = t.dataset.h.split('|'), v = parseID(t.value), list = W.data.kehadiran;
    var row = list.filter(function (h) { return h.umkm_id === ps[0] && h.kegiatan_id === ps[1]; })[0];
    if (v === '' || v <= 0) { if (row) W.data.kehadiran = list.filter(function (h) { return h !== row; }); t.classList.remove('on'); }
    else { if (row) row.jumlah = v; else list.push({ umkm_id: ps[0], kegiatan_id: ps[1], jumlah: v }); t.classList.add('on'); }
    markDirty('kehadiran'); calcSoon(); return;
  }
  if (!t.dataset.b) return;
  var b = t.dataset.b.split('|'), sec = b[0], id = b[1], f = b[2], r = findRow(sec, id);
  if (!r) return;
  r[f] = t.dataset.k ? parseNum(t.value, t.dataset.k) : t.value;
  markDirty(sec === 'pk' ? 'outcome' : sec);
  if (sec === 'info' && f === 'nama_program') { var h = $('.wz-head h2'); if (h) h.textContent = t.value || 'Perhitungan SROI'; }
  calcSoon();
}
function onWzChange(e) {
  var t = e.target;
  if (t.id === 'bkFile') return uploadBerkas(t);
  if (t.tagName !== 'SELECT' || !t.dataset.b || W.ro) return;
  onWzInput(e);
  var b = t.dataset.b.split('|');
  if (b[0] === 'biaya' && b[2] === 'metode') { var r = findRow('biaya', b[1]); if (t.value === 'WAKTU_TENAGA') { r.kelompok = 'Waktu & Tenaga'; if (!r.kegiatan_id) r.kegiatan_id = '*'; } }
  if (b[0] === 'pk' && b[2] === 'jenis') { var pc = findRow('pk', b[1]); pc.ref = (t.value === 'NET_PROFIT' || t.value === 'KPI_BUDGET' || t.value === 'BENCHMARK') ? 'ALL' : ''; }
  if (b[0] === 'outcome' && b[2] === 'jenis_proksi') { var o = findRow('outcome', b[1]); o.ref_proksi = (t.value === 'NET_PROFIT' || t.value === 'KPI_BUDGET' || t.value === 'BENCHMARK') ? 'ALL' : ''; }
  if (b[0] === 'umkm' && b[2] === 'sektor_id' && t.value && W.sektors.indexOf(t.value) < 0) { W.sektors.push(t.value); sortSektors(); ensureKpiRows(); markDirty('kpi'); setDihitung(dihitungList().concat([t.value])); }
  if (t.dataset.rr) { var y = window.scrollY; renderStep(); window.scrollTo(0, y); }
}
function onWzBlur(e) {
  var t = e.target; if (!t.dataset || !t.dataset.k || W.ro) return;
  var v = parseNum(t.value, t.dataset.k); t.value = numIn(v, t.dataset.k === 'money' ? 0 : 2);
}
function sortSektors() { var ord = (App.master.sektor || []).map(function (s) { return s.sektor_id; }); W.sektors.sort(function (a, b) { return ord.indexOf(a) - ord.indexOf(b); }); }

/* ---------------- Event: klik ---------------- */
function rerender() { var y = window.scrollY; renderStep(); window.scrollTo(0, y); }
async function onWzClick(e) {
  var t = e.target.closest('button,[data-go],[data-sek],[data-dh],[data-ref],[data-back]'); if (!t) return;
  var ds = t.dataset, d = W.data;
  if (ds.back !== undefined) { history.length > 1 ? history.back() : go(App.me.role === 'CABANG' ? 'cabang' : 'proyek'); return; }
  if (ds.step) return goStep(+ds.step);
  if (ds.go) return goStep(+ds.go);
  if (ds.save !== undefined) return saveNow('manual', t);
  if (ds.exp) return ds.exp === 'pdf' ? Exporter.proyekPdf(W.id, t, W.data) : Exporter.proyekXlsx(W.id, t, W.data);
  if (ds.submit !== undefined) return submitNow(t);
  if (ds.approve !== undefined) return decide('approve', t);
  if (ds['return'] !== undefined) return decide('return', t);
  if (ds.unlock !== undefined) { W.unlockOpen = true; W.unlockNotes = []; renderWizard(); toast('Kunci dibuka — catatan admin di langkah 1–7 aktif.', 'ok'); var dc = $('#decideCard'); if (dc) dc.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  if (ds.relock !== undefined) return relock(t);
  if (ds.delberkas) return deleteBerkas(ds.delberkas, t);
  if (ds.note) return noteAction(ds.note, ds.id, t);
  if (ds.upage) { W.usagePage = +ds.upage; var ue = $('[data-c="usage|"]'); if (ue) ue.innerHTML = usageHtml(ue); return; }
  if (W.ro) return;
  if (ds.sek) {
    var sid = ds.sek, i = W.sektors.indexOf(sid);
    if (i > -1) {
      var used = d.umkm.some(function (u) { return u.sektor_id === sid; });
      if (used) return toast('Sektor ini dipakai UMKM di langkah 3. Ubah sektor UMKM dulu.', 'warn');
      var filled = d.kpi.some(function (r) { return r.sektor_id === sid && (N(r.target) || N(r.realisasi)); });
      if (filled && !(await confirmBox('Hapus sektor?', 'Target & realisasi sektor ' + esc(M.sektorName(sid)) + ' akan dihapus.', 'Hapus', 'btn-danger'))) return;
      W.sektors.splice(i, 1); d.kpi = d.kpi.filter(function (r) { return r.sektor_id !== sid; });
      setDihitung(dihitungList().filter(function (x) { return x !== sid; }));
    } else { W.sektors.push(sid); sortSektors(); ensureKpiRows(); setDihitung(dihitungList().concat([sid])); }
    markDirty('kpi'); return rerender();
  }
  if (ds.dh) { var cur = dihitungList(), ix2 = cur.indexOf(ds.dh); if (ix2 > -1) cur.splice(ix2, 1); else cur.push(ds.dh); setDihitung(cur); return rerender(); }
  if (ds.ref) {
    var pr = ds.ref.split('|'), o = findRow('pk', pr[0]), val = pr[1];
    var refs = String(o.ref || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    var isSek = function (x) { return x.indexOf('SEK:') === 0; }, sekR = refs.filter(isSek), idR = refs.filter(function (x) { return !isSek(x); });
    if (o.jenis === 'NET_PROFIT') {   // "Semua sektor" ↔ sektor tertentu saling meniadakan
      if (val === 'ALL') refs = ['ALL'];
      else { var ixs = sekR.indexOf(val); if (ixs > -1) sekR.splice(ixs, 1); else sekR.push(val); refs = sekR.length ? sekR : ['ALL']; }
    } else if (isSek(val)) {   // filter sektor (benchmark) — tidak mengubah pilihan benchmark
      if (val === 'SEK:ALL') sekR = []; else { var ix2 = sekR.indexOf(val); if (ix2 > -1) sekR.splice(ix2, 1); else sekR.push(val); }
      refs = idR.concat(sekR);
    } else {
      if (val === 'ALL') idR = idR.indexOf('ALL') > -1 ? [] : ['ALL'];
      else { idR = idR.filter(function (x) { return x !== 'ALL'; }); var ix = idR.indexOf(val); if (ix > -1) idR.splice(ix, 1); else idR.push(val); }
      refs = idR.concat(sekR);
    }
    o.ref = refs.join(','); markDirty('outcome'); return rerender();
  }
  if (ds.addpk) { var oa = findRow('outcome', ds.addpk); pkList(oa).push(newPk()); markDirty('outcome'); return rerender(); }
  if (ds.delpk) { var dp = ds.delpk.split('~'), od = findRow('outcome', dp[0]); pkList(od).splice(+dp[1], 1); markDirty('outcome'); return rerender(); }
  if (ds.add) return addRow(ds.add, ds);
  if (ds.del) return delRow(ds.del);
  if (ds.presetSh !== undefined) {
    var cbn = M.cabangName(d.proyek.cabang_id);
    d.stakeholder = [['PPU ' + cbn, 'Pelaksana', 'Pelaksana program pembinaan'], ['United Tractors', 'Sponsor', 'Pemberi dana CSR'], ['YDBA', 'Mitra', 'Mitra pembinaan'], ['UMKM Binaan', 'Penerima Manfaat', 'Penerima manfaat langsung']]
      .map(function (x) { return { sh_id: uid('SH'), nama: x[0], peran: x[1], alasan_penyertaan: x[2], kelompok_sektor: '' }; });
    markDirty('stakeholder'); return rerender();
  }
  if (ds.pasteUmkm !== undefined) return pasteUmkm();
  if (ds.hall) { d.umkm.forEach(function (u) { var h = d.kehadiran.filter(function (x) { return x.umkm_id === u.umkm_id && x.kegiatan_id === ds.hall; })[0]; if (!h) d.kehadiran.push({ umkm_id: u.umkm_id, kegiatan_id: ds.hall, jumlah: 1 }); }); markDirty('kehadiran'); return rerender(); }
  if (ds.bulkOmset !== undefined) {
    var vals = {}; ['margin_profit', 'dw', 'ds', 'at', 'do'].forEach(function (f) { var v = parseID($('#bulk_' + f).value); if (v !== '') vals[f] = v; });
    if (!Object.keys(vals).length) return toast('Isi minimal satu nilai untuk diterapkan.', 'warn');
    d.omset.forEach(function (o) { Object.assign(o, vals); }); markDirty('omset'); toast('Diterapkan ke ' + d.omset.length + ' UMKM.', 'ok'); return rerender();
  }
}
function addRow(sec, ds) {
  var d = W.data, firstPM = (d.stakeholder.filter(function (s) { return s.peran === 'Penerima Manfaat'; })[0] || d.stakeholder[0] || {}).sh_id || '';
  var pel = (d.stakeholder.filter(function (s) { return s.peran === 'Pelaksana'; })[0] || {}).sh_id || '';
  var rows = {
    stakeholder: { sh_id: uid('SH'), nama: '', peran: '', alasan_penyertaan: '', kelompok_sektor: '' },
    kegiatan: { kegiatan_id: uid('KG'), program_id: ds.prog, nama_kegiatan: '', waktu: '', durasi_hari: 1, biaya: '', sh_pembiaya_id: pel, keterangan: '', jumlah_peserta: '' },
    umkm: { umkm_id: uid('UM'), nama_umkm: '', sektor_id: W.sektors[0] || '', status_khusus: '' },
    biaya: { biaya_id: uid('BY'), sh_id: ds.sh, kelompok: 'Implementasi', komponen: '', metode: 'MANUAL', kegiatan_id: '', qty: '', tarif: '', nilai: '', keterangan: '' },
    benchmark: { bm_id: uid('BM'), kegiatan_id: '', biaya_internal_per_peserta: '', nama_expert: '', biaya_expert_per_peserta: '', jumlah_peserta: '' },
    manfaat: { mf_id: uid('MF'), sh_id: '', parameter: '', metode: 'SELISIH', nilai_a: '', nilai_b: '', nilai_hasil: '', keterangan: '' },
    outcome: { outcome_id: uid('OC'), sh_id: firstPM, input_ref: '', output_ringkas: '', deskripsi_outcome: '', indikator_sebelum: '', indikator_sesudah: '', sumber_informasi: '', durasi_tahun: 1, mulai: 1, jenis_proksi: '', ref_proksi: '', porsi_proksi: 100, nilai_proksi: '', proxy_notes: '', dw: 0, ds: 0, at: 0, 'do': 0, proksi_list: [newPk()] }
  };
  var r = rows[sec]; if (!r) return;
  d[sec].push(r); markDirty(sec);
  if (sec === 'umkm') ensureOmsetRows(), markDirty('omset');
  rerender();
  var inp = $('[data-b^="' + sec + '|' + r[ROW_KEY[sec]] + '|"]'); if (inp) inp.focus();
}
async function delRow(spec) {
  var p = spec.split('|'), sec = p[0], id = p[1], d = W.data, k = ROW_KEY[sec];
  if (sec === 'stakeholder') {
    var used = d.biaya.some(function (b) { return b.sh_id === id; }) || d.outcome.some(function (o) { return o.sh_id === id; }) || d.manfaat.some(function (m) { return m.sh_id === id; });
    if (used && !(await confirmBox('Hapus stakeholder?', 'Stakeholder ini dipakai di biaya/manfaat/outcome. Baris biaya miliknya ikut terhapus.', 'Hapus', 'btn-danger'))) return;
    d.biaya = d.biaya.filter(function (b) { return b.sh_id !== id; }); markDirty('biaya');
  }
  if (sec === 'kegiatan') { d.kehadiran = d.kehadiran.filter(function (h) { return h.kegiatan_id !== id; }); d.benchmark.forEach(function (b) { if (b.kegiatan_id === id) b.kegiatan_id = ''; }); d.biaya.forEach(function (b) { if (b.kegiatan_id === id) b.kegiatan_id = '*'; }); markDirty('kehadiran'); markDirty('benchmark'); markDirty('biaya'); }
  if (sec === 'umkm') { d.kehadiran = d.kehadiran.filter(function (h) { return h.umkm_id !== id; }); markDirty('kehadiran'); }
  if (sec === 'benchmark' || sec === 'manfaat') d.outcome.forEach(function (o) { pkList(o).forEach(function (c) { c.ref = String(c.ref || '').split(',').filter(function (x) { return x.trim() !== id; }).join(','); }); });
  d[sec] = d[sec].filter(function (r) { return String(r[k]) !== String(id); });
  if (sec === 'umkm') ensureOmsetRows();
  markDirty(sec); if (sec === 'benchmark' || sec === 'manfaat') markDirty('outcome');
  rerender();
}
function pasteUmkm() {
  modal({
    title: 'Tempel daftar UMKM', wide: true,
    body: '<p class="small muted" style="margin-top:0">Salin dua kolom dari Excel (Nama UMKM, Sektor) lalu tempel di sini. Satu UMKM per baris. Sektor dicocokkan dengan nama sektor di data induk.</p><textarea class="inp" id="pasteTxt" rows="10" placeholder="Warung Bu Sri\tKuliner&#10;Bengkel Jaya\tBengkel Roda 4"></textarea>',
    actions: [{ label: 'Batal', value: null }, {
      label: 'Tambahkan', cls: 'btn-primary', onClick: function (bg) {
        var lines = bg.querySelector('#pasteTxt').value.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
        var sek = M.sektorAktif(), added = 0;
        lines.forEach(function (l) {
          var c = l.split(/\t|;/), nm = (c[0] || '').trim(); if (!nm) return;
          var s = sek.filter(function (x) { return x.nama_sektor.toLowerCase() === String(c[1] || '').trim().toLowerCase(); })[0];
          W.data.umkm.push({ umkm_id: uid('UM'), nama_umkm: nm, sektor_id: s ? s.sektor_id : '', status_khusus: '' });
          if (s && W.sektors.indexOf(s.sektor_id) < 0) { W.sektors.push(s.sektor_id); W.data.proyek.sektor_dihitung = dihitungList().concat([s.sektor_id]).join(','); W.infoDirty = ++W.ver; }
          added++;
        });
        sortSektors(); ensureKpiRows(); ensureOmsetRows(); markDirty('umkm'); markDirty('omset'); markDirty('kpi'); rerender();
        toast(added + ' UMKM ditambahkan.', 'ok');
      }
    }]
  });
}

/* ---------------- Simpan / kirim / keputusan ---------------- */
function buildPayload() {
  var d = W.data, r = W.res, secs = {}, sentVer = {};
  Object.keys(W.dirty).forEach(function (s) {
    sentVer[s] = W.dirty[s];
    var rows = JSON.parse(JSON.stringify(d[s] || []));
    if (s === 'outcome') rows.forEach(function (o) {
      var h = r.outcome[o.outcome_id] || {}, pl = Array.isArray(o.proksi_list) ? o.proksi_list : [];
      o.jenis_proksi = pl.length > 1 ? 'CAMPURAN' : (pl[0] || {}).jenis || '';
      o.ref_proksi = pl.length === 1 ? (pl[0].ref || '') : '';
      o.porsi_proksi = pl.length === 1 ? pl[0].porsi : '';
      ['dw', 'ds', 'at', 'do'].forEach(function (f) { o[f] = pl.length === 1 ? pl[0][f] : ''; });
      o.nilai_proksi = Math.round(h.nilai_porsi || 0); o.impact = Math.round(h.impact || 0);
      o.proksi_list = JSON.stringify(pl);
    });
    if (s === 'manfaat') rows.forEach(function (m) { m.nilai_hasil = Math.round(r.manfaat[m.mf_id] || 0); });
    if (s === 'biaya') rows.forEach(function (b) { if (b.metode !== 'MANUAL') b.nilai = Math.round(r.biaya[b.biaya_id] || 0); });
    if (s === 'benchmark') rows.forEach(function (b) { if (b.kegiatan_id) b.jumlah_peserta = (r.benchmark[b.bm_id] || {}).peserta || 0; });
    if (s === 'kpi') rows = rows.filter(function (k) { return k.target !== '' || k.realisasi !== ''; });
    secs[s] = rows;
  });
  var hasil = SroiEngine.summary(r);
  hasil.hasil_sektor = (r.kpi.dihitung || []).join(','); hasil.hasil_umkm = d.umkm.length;
  var info = null; if (W.infoDirty) { info = {}; ['nama_program', 'project_owner', 'lokasi', 'gmaps_url', 'tgl_pengukuran', 'periode_awal', 'periode_akhir', 'mitra_pelaksana', 'pic_mitra', 'hp_pic', 'tujuan', 'nama_project', 'aktivitas', 'metode', 'mitra_penilai', 'tim_leader_penilai', 'hp_penilai', 'penjelasan_kualitatif', 'doc_number', 'doc_rev', 'sektor_dihitung'].forEach(function (k) { info[k] = d.proyek[k]; }); }
  return { payload: { proyek_id: W.id, sections: secs, info: info, hasil: hasil }, sentVer: sentVer, infoVer: W.infoDirty, hasil: hasil };
}
async function saveNow(reason, btn) {
  if (W.ro || !W.id) return true;
  if (!hasDirty()) { if (reason === 'manual') { toast('Semua perubahan sudah tersimpan.', 'ok'); } return true; }
  if (W.saving) { W.again = true; return W.savingP; }
  W.saving = true; setSaveInd();
  var id = W.id, b = buildPayload();
  W.savingP = (async function () {
    var res = await api('saveProyekBagian', b.payload);
    W.saving = false;
    if (W.id !== id) return res.success;
    if (res.success) {
      Object.keys(b.sentVer).forEach(function (s) { if (W.dirty[s] === b.sentVer[s]) delete W.dirty[s]; });
      if (W.infoDirty === b.infoVer) W.infoDirty = 0;
      W.data.proyek.rev = res.data.rev; W.data.proyek.diubah_at = res.data.diubah_at; W.data.proyek.diubah_oleh = App.me.nama;
      Object.assign(W.data.proyek, b.hasil);
      W.saveErr = ''; W.lastSaved = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      cacheDetail(id, W.data);
      if (!hasDirty()) Store.del(userKey('wd:' + id)); else saveDraftLocal();
      upsertSummary(summaryOf(W.data.proyek));
      if (reason === 'manual') toast('Perubahan tersimpan.', 'ok');
    } else {
      W.saveErr = res.message; saveDraftLocal();
      if (res.data && res.data.code === 'LOCKED') { toast(res.message, 'err'); refreshDetail(id); }
      else if (reason === 'manual') toast('Gagal menyimpan: ' + res.message, 'err');
    }
    setSaveInd();
    if (W.again) { W.again = false; return saveNow('again'); }
    return res.success;
  })();
  if (btn) return withBtn(btn, function () { return W.savingP; });
  return W.savingP;
}
async function submitNow(btn) {
  if (W.res.errors.length) return toast('Masih ada kesalahan validasi.', 'err');
  if (!(await confirmBox('Kirim ke kantor pusat?', 'Rasio sementara <b>' + ratioFmt(W.res.rasio) + '</b>. Setelah dikirim, data terkunci sampai Super Admin memutuskan.', ic('send') + ' Kirim'))) return;
  await withBtn(btn, async function () {
    var ok = await saveNow('submit'); if (!ok) return toast('Simpan gagal, pengiriman dibatalkan: ' + W.saveErr, 'err');
    var res = await api('submitProyek', { proyek_id: W.id });
    if (!res.success) { toast(res.message, 'err'); if (res.data && res.data.errors) showServerErrors(res.data.errors); return; }
    applyStatus(res.data); toast('Terkirim ke pusat. Terima kasih!', 'ok');
  });
}
async function decide(kind, btn) {
  var payload = { proyek_id: W.id }, action;
  if (kind === 'approve') { if (!(await confirmBox('Setujui perhitungan?', 'Server menghitung ulang dengan SroiEngine, menyimpan snapshot hasil & parameter, lalu mengunci data.', ic('check') + ' Setujui', 'btn-success'))) return; action = 'approveProyek'; }
  var wasApproved = W.data.proyek.status === 'Disetujui';
  if (kind === 'return') {
    var c = await promptBox(wasApproved ? 'Kembalikan laporan yang sudah disetujui untuk revisi' : 'Kembalikan untuk revisi', wasApproved ? 'Arahan perubahan dari pusat untuk cabang (wajib, tercatat di log)' : 'Catatan revisi untuk cabang (wajib)', 'Kembalikan', 'btn-danger', true);
    if (!c) return;
    if (wasApproved) { payload.alasan = c; action = 'unlockProyek'; } else { payload.catatan = c; action = 'returnProyek'; }
  }
  if (kind === 'unlock') { var a = await promptBox('Buka kunci perhitungan', 'Alasan membuka kunci (wajib, tercatat di log)', 'Buka kunci', 'btn-warn', true); if (!a) return; payload.alasan = a; action = 'unlockProyek'; }
  await withBtn(btn, async function () {
    var res = await api(action, payload);
    if (!res.success) { toast(res.message, 'err'); if (res.data && res.data.errors) showServerErrors(res.data.errors); return; }
    W.unlockOpen = false; W.unlockNotes = [];
    applyStatus(res.data);
    toast(kind === 'approve' ? 'Perhitungan disetujui & dikunci.' : wasApproved ? 'Kunci dibuka & dikembalikan ke cabang untuk revisi.' : 'Dikembalikan ke cabang untuk revisi.', 'ok');
  });
}
function applyStatus(patch) {
  if (patch.status === 'Perlu Revisi' && patch.catatan_revisi === undefined && patch.status) patch.catatan_revisi = W.data.proyek.catatan_revisi;
  Object.assign(W.data.proyek, patch);
  if (patch.status === 'Dikirim') W.data.proyek.dikirim_at = patch.dikirim_at || new Date().toISOString();
  cacheDetail(W.id, W.data); upsertSummary(summaryOf(W.data.proyek));
  prepData(); renderWizard();
  fetchDetail(W.id, true).then(function (r) { if (r.success && W.id === r.data.proyek.proyek_id && !hasDirty()) { W.data = JSON.parse(JSON.stringify(r.data)); prepData(); renderWizard(); upsertSummary(summaryOf(W.data.proyek)); } });
}
function showServerErrors(list) {
  modal({ title: 'Kesalahan validasi (server)', body: '<div class="vlist">' + list.map(function (e) { return '<div class="v e">' + ic('alert') + '<span>' + esc(e.msg) + '</span><span class="stp">Langkah ' + e.step + '</span></div>'; }).join('') + '</div>' });
}

/* ---------------- Berkas ---------------- */
function uploadBerkas(input) {
  var f = input.files[0]; if (!f) return;
  var max = N(M.param('maks_ukuran_berkas_mb', 10)) || 10, msg = $('#bkMsg');
  if (f.size > max * 1024 * 1024) { input.value = ''; msg.innerHTML = '<span class="text-red b">Ditolak: ' + esc(f.name) + ' berukuran ' + fmtNum(f.size / 1048576, 1) + ' MB (maks. ' + max + ' MB).</span>'; return toast('Ukuran berkas melebihi ' + max + ' MB.', 'err'); }
  var mimeMap = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  var ext = f.name.split('.').pop().toLowerCase(), mime = mimeMap[ext];
  if (!mime) { input.value = ''; return toast('Format tidak didukung.', 'err'); }
  var rd = new FileReader();
  msg.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;vertical-align:middle"></span> Mengunggah ' + esc(f.name) + '…';
  rd.onload = async function () {
    var b64 = String(rd.result).split(',')[1], id = W.id;
    var res = await api('uploadBerkas', { proyek_id: id, jenis: $('#bkJenis').value, nama: f.name, mime: mime, b64: b64 });
    input.value = '';
    if (!res.success) { msg.innerHTML = '<span class="text-red b">' + esc(res.message) + '</span>'; return toast(res.message, 'err'); }
    if (W.id !== id) return;
    W.data.berkas.push(res.data); cacheDetail(id, W.data); compute(); rerender(); toast('Berkas diunggah.', 'ok');
  };
  rd.readAsDataURL(f);
}
async function deleteBerkas(bid, btn) {
  if (!(await confirmBox('Hapus berkas?', 'Berkas akan dipindahkan ke sampah Google Drive.', 'Hapus', 'btn-danger'))) return;
  withBtn(btn, async function () {
    var res = await api('deleteBerkas', { berkas_id: bid });
    if (!res.success) return toast(res.message, 'err');
    W.data.berkas = W.data.berkas.filter(function (b) { return b.berkas_id !== bid; }); cacheDetail(W.id, W.data); compute(); rerender();
  });
}


/* =====================================================================
 * CATATAN ADMIN per langkah — admin menulis (mode baca data), cabang menanggapi
 * ===================================================================== */
var NOTE_STEPS = 7;   // catatan admin hanya untuk langkah isian cabang (1–7)
/** Catatan admin berlaku selama proses revisi/verifikasi: belum Disetujui, atau admin sedang membuka kunci. */
function notesActive() { var p = W.data && W.data.proyek; return !!p && (p.status !== 'Disetujui' || (App.me.role === 'ADMIN' && !!W.unlockOpen)); }
function allNotes() { if (!notesActive()) return []; return ((W.data && W.data.catatan) || []).filter(function (c) { return Number(c.step) >= 1 && Number(c.step) <= NOTE_STEPS; }); }
function stepNotes(n) { return allNotes().filter(function (c) { return Number(c.step) === n; }).sort(function (a, b) { return String(a.dibuat_at).localeCompare(String(b.dibuat_at)); }); }
function openNotes(n) { return stepNotes(n).filter(function (c) { return c.status !== 'Selesai'; }); }
function notesBanner() {
  var open = allNotes().filter(function (c) { return c.status !== 'Selesai'; });
  if (!open.length) return '';
  var steps = {}; open.forEach(function (c) { steps[c.step] = (steps[c.step] || 0) + 1; });
  var links = Object.keys(steps).sort().map(function (n) { return '<button class="btn btn-xs" data-go="' + n + '">Langkah ' + n + ' (' + steps[n] + ')</button>'; }).join(' ');
  return App.me.role === 'CABANG'
    ? '<div class="banner banner-amber">' + ic('info') + '<div><b>' + open.length + ' catatan perbaikan dari pusat belum ditindaklanjuti</b><p>Perbaiki datanya, lalu klik <b>Konfirmasi sudah dikerjakan</b>. Catatan yang sudah dikonfirmasi otomatis hilang dari langkah.</p><div class="row mt-s" style="gap:6px">' + links + '</div></div></div>'
    : '<div class="banner banner-blue">' + ic('info') + '<div><b>' + open.length + ' catatan Anda masih terbuka</b><div class="row mt-s" style="gap:6px">' + links + '</div></div></div>';
}
function noteItem(c, role) {
  var done = c.status === 'Selesai';
  var head = '<div class="row between" style="gap:8px"><span class="row" style="gap:8px"><span class="badge ' + (done ? 'st-Disetujui' : 'st-Dikirim') + '">' + (done ? 'Sudah diperbaiki' : 'Perlu ditindaklanjuti') + '</span><span class="small muted">' + esc(c.dibuat_oleh || 'Admin') + ' • ' + fmtDate(c.dibuat_at) + (c.diubah_at ? ' (diubah)' : '') + '</span></span>';
  var acts = '';
  if (role === 'ADMIN') acts = '<span class="row" style="gap:4px"><button class="btn btn-xs" data-note="edit" data-id="' + c.catatan_id + '">' + ic('edit') + ' Ubah</button><button class="btn btn-xs" data-note="' + (done ? 'reopen' : 'close') + '" data-id="' + c.catatan_id + '">' + (done ? 'Buka lagi' : ic('check') + ' Selesai') + '</button><button class="btn btn-xs btn-danger" data-note="del" data-id="' + c.catatan_id + '">' + ic('trash') + '</button></span>';
  head += acts + '</div>';
  var body = '<div class="note-isi">' + esc(c.isi).replace(/\n/g, '<br>') + '</div>';
  var resp = c.tanggapan || c.ditanggapi_at ? '<div class="note-resp">' + ic('send') + '<div><b>Tanggapan cabang</b> <span class="small muted">' + esc(c.ditanggapi_oleh || '') + ' • ' + fmtDate(c.ditanggapi_at) + '</span><div>' + esc(c.tanggapan || '(tanpa keterangan)') + '</div></div></div>' : '';
  var form = '';
  if (role === 'CABANG') form = '<div class="row mt-s" style="align-items:flex-end"><input class="inp grow" id="resp_' + c.catatan_id + '" placeholder="Keterangan perbaikan untuk admin (opsional)" maxlength="1000"><button class="btn btn-sm btn-success" data-note="done" data-id="' + c.catatan_id + '">' + ic('check') + ' Konfirmasi sudah dikerjakan</button></div>';
  return '<div class="note' + (done ? ' done' : '') + '">' + head + body + resp + form + '</div>';
}
function notesHtml(step) {
  var role = App.me.role, list = stepNotes(step);
  if (role === 'STAKEHOLDER' || step > NOTE_STEPS) return '';
  if (!notesActive()) return role === 'ADMIN' ? '<div class="notes-off ro-ok">' + ic('lock') + '<span>Catatan admin tidak berlaku — laporan sudah <b>Disetujui</b>. Catatan hanya aktif selama proses revisi/verifikasi.</span><button class="btn btn-xs" data-unlock>' + ic('unlock') + ' Buka Kunci untuk revisi</button></div>' : '';
  if (role === 'CABANG') list = list.filter(function (c) { return c.status !== 'Selesai'; });   // yang sudah dikonfirmasi disembunyikan
  if (role === 'CABANG' && !list.length) return '';
  var title = role === 'ADMIN' ? 'Catatan Admin — Langkah ' + step : 'Catatan Perbaikan dari Pusat — Langkah ' + step;
  var form = role === 'ADMIN' ? '<div class="note-new"><textarea class="inp" id="noteNew" rows="3" maxlength="1500" placeholder="Tulis catatan perbaikan untuk cabang pada langkah ini…"></textarea><div class="row" style="justify-content:flex-end"><button class="btn btn-primary btn-sm" data-note="add">' + ic('send') + ' Kirim catatan ke cabang</button></div></div>' : '';
  return '<div class="card notes-card ro-ok' + (role === 'CABANG' ? ' notes-cabang' : '') + '"><div class="card-head"><div><h3>' + ic(role === 'ADMIN' ? 'edit' : 'info') + ' ' + esc(title) + '</h3><p>' + (role === 'ADMIN' ? 'Data cabang hanya bisa dilihat. Catatan langsung muncul di akun cabang pada langkah ini.' : 'Kerjakan catatan berikut, lalu klik Konfirmasi sudah dikerjakan — catatan akan hilang dari langkah ini.') + '</p></div>' + (list.length ? '<span class="badge ' + (openNotes(step).length ? 'st-Dikirim' : 'st-Disetujui') + '">' + (role === 'CABANG' ? list.length + ' perlu dikerjakan' : openNotes(step).length + ' terbuka / ' + list.length + ' catatan') + '</span>' : '') + '</div>' +
    '<div class="card-pad" style="padding-top:0">' + (list.length ? list.map(function (c) { return noteItem(c, role); }).join('') : '<div class="small muted mb-s">Belum ada catatan pada langkah ini.</div>') + form + '</div></div>';
}
function applyNote(row, removeId) {
  var list = W.data.catatan = W.data.catatan || [];
  if (removeId) W.data.catatan = list.filter(function (c) { return c.catatan_id !== removeId; });
  else { var i = list.findIndex(function (c) { return c.catatan_id === row.catatan_id; }); if (i > -1) list[i] = row; else list.push(row); }
  cacheDetail(W.id, W.data);
  upsertSummary({ proyek_id: W.id, catatan_terbuka: W.data.catatan.filter(function (c) { return c.status !== 'Selesai'; }).length });
  var y = window.scrollY; renderWizard(); window.scrollTo(0, y);
}
async function noteAction(kind, id, btn) {
  if (kind === 'add') {
    var isi = ($('#noteNew') || {}).value || '';
    if (!isi.trim()) return toast('Tulis isi catatan dulu.', 'warn');
    return withBtn(btn, async function () { var r = await api('addCatatan', { proyek_id: W.id, step: W.step, isi: isi, saatBukaKunci: !!W.unlockOpen }); if (!r.success) return toast(r.message, 'err'); if (W.unlockOpen) W.unlockNotes.push(r.data.catatan_id); applyNote(r.data); toast('Catatan terkirim ke cabang.', 'ok'); });
  }
  var c = allNotes().filter(function (x) { return x.catatan_id === id; })[0]; if (!c) return;
  if (kind === 'edit') {
    var v = await modal({ title: 'Ubah catatan', body: '<textarea class="inp" id="noteEd" rows="5" maxlength="1500">' + esc(c.isi) + '</textarea>', actions: [{ label: 'Batal', value: null }, { label: 'Simpan', cls: 'btn-primary', onClick: function (bg) { var t = bg.querySelector('#noteEd').value.trim(); if (!t) { toast('Isi catatan wajib diisi.', 'warn'); return false; } return t; } }] });
    if (!v) return;
    var r1 = await api('updateCatatan', { catatan_id: id, isi: v, saatBukaKunci: !!W.unlockOpen }); if (!r1.success) return toast(r1.message, 'err'); return applyNote(r1.data);
  }
  if (kind === 'del') {
    if (!(await confirmBox('Hapus catatan?', 'Catatan akan hilang dari akun cabang.', 'Hapus', 'btn-danger'))) return;
    return withBtn(btn, async function () { var r = await api('deleteCatatan', { catatan_id: id }); if (!r.success) return toast(r.message, 'err'); applyNote(null, id); toast('Catatan dihapus.', 'ok'); });
  }
  if (kind === 'close' || kind === 'reopen') return withBtn(btn, async function () { var r = await api('updateCatatan', { catatan_id: id, saatBukaKunci: !!W.unlockOpen, status: kind === 'close' ? 'Selesai' : 'Terbuka' }); if (!r.success) return toast(r.message, 'err'); applyNote(r.data); });
  if (kind === 'done' || kind === 'undo') {
    var tg = kind === 'done' ? (($('#resp_' + id) || {}).value || '') : c.tanggapan;
    if (kind === 'done' && !(await confirmBox('Konfirmasi catatan sudah dikerjakan?', 'Catatan <b>"' + esc(String(c.isi).slice(0, 120)) + '"</b> akan ditandai selesai dan hilang dari tampilan langkah ' + c.step + '. Admin tetap bisa melihatnya beserta keterangan Anda.', ic('check') + ' Konfirmasi', 'btn-success'))) return;
    return withBtn(btn, async function () { var r = await api('tanggapiCatatan', { catatan_id: id, tanggapan: tg, selesai: kind === 'done' }); if (!r.success) return toast(r.message, 'err'); applyNote(r.data); toast(kind === 'done' ? 'Catatan dikonfirmasi sudah dikerjakan.' : 'Tanda selesai dibatalkan.', 'ok'); });
  }
}

/** Kunci kembali tanpa mengembalikan: catatan yang ditulis selama kunci dibuka dihapus (laporan tetap Disetujui). */
async function relock(btn) {
  var ids = (W.unlockNotes || []).filter(function (id) { return ((W.data.catatan) || []).some(function (c) { return c.catatan_id === id; }); });
  if (ids.length && !(await confirmBox('Kunci kembali?', ids.length + ' catatan yang Anda tulis selama kunci dibuka akan <b>dihapus</b>, karena laporan tetap Disetujui dan tidak dikembalikan ke cabang.', ic('lock') + ' Kunci & hapus catatan', 'btn-danger'))) return;
  await withBtn(btn, async function () {
    for (var i = 0; i < ids.length; i++) { var r = await api('deleteCatatan', { catatan_id: ids[i] }); if (r.success) W.data.catatan = W.data.catatan.filter(function (c) { return c.catatan_id !== ids[i]; }); }
    W.unlockOpen = false; W.unlockNotes = [];
    cacheDetail(W.id, W.data); var y = window.scrollY; renderWizard(); window.scrollTo(0, y);
    toast(ids.length ? 'Dikunci kembali — ' + ids.length + ' catatan sementara dihapus.' : 'Dikunci kembali — tidak ada perubahan.', 'ok');
  });
}

/** Sektor yang ada di daftar UMKM (langkah 3) beserta jumlah UMKM-nya. */
function sekList() {
  var m = {}, order = (App.master.sektor || []).map(function (x) { return x.sektor_id; });
  (W.data.umkm || []).forEach(function (u) { var k = u.sektor_id || ''; if (!k) return; m[k] = (m[k] || 0) + 1; });
  return Object.keys(m).sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); }).map(function (k) { return { id: k, nama: M.sektorName(k), n: m[k] }; });
}
/** Chip filter sektor untuk proksi Benchmark. */
function sekChips(chip, refs, allLbl, hint) {
  var sl = sekList(); if (!sl.length) return '<div class="src-hint">Belum ada UMKM bersektor di langkah 3 — benchmark dihitung untuk semua peserta.</div>';
  var anySek = refs.some(function (x) { return x.indexOf('SEK:') === 0; });
  var allChip = '<span class="chip ' + (!anySek ? 'on' : '') + '" data-ref="' + chip('', '').match(/data-ref="([^|]*)\|/)[1] + '|SEK:ALL">' + (!anySek ? ic('check') : '') + esc(allLbl) + '</span>';
  return '<div class="src-grp"><span class="src-l">Sektor UMKM</span>' + allChip + sl.map(function (x) { return chip('SEK:' + x.id, x.nama + ' (' + x.n + ' UMKM)'); }).join('') + '</div><div class="src-hint">' + hint + '</div>';
}

/** Kolom tulisan memanjang ke bawah mengikuti isi (tinggi awal tetap seperti semula). */
function autoGrow(ta) {
  if (!ta || ta.tagName !== 'TEXTAREA') return;
  if (!ta._minH) ta._minH = ta.offsetHeight || 0;
  ta.style.height = 'auto';
  var h = Math.max(ta._minH, ta.scrollHeight + 2);
  ta.style.height = h + 'px';
}
document.addEventListener('input', function (e) { if (e.target && e.target.tagName === 'TEXTAREA' && e.target.closest('#wzMain, .notes-card, .modal')) autoGrow(e.target); });
