/* =====================================================================
 * Laporan & Ekspor • Data Induk & Parameter • Pengguna • Profil • Log
 * ===================================================================== */

/* ===================== LAPORAN & EKSPOR ===================== */
registerPage('laporan', {
  init: function (el) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-x]'); if (!b) return;
      var x = b.dataset.x, pid = ($('#lpProyek', el) || {}).value, th = +(($('#lpTahun', el) || {}).value || 0);
      if (x === 'ppdf' || x === 'pxlsx') { if (!pid) return toast('Pilih perhitungan dulu.', 'warn'); return x === 'ppdf' ? Exporter.proyekPdf(pid, b) : Exporter.proyekXlsx(pid, b); }
      if (x === 'rpdf') return Exporter.rekapPdf(th, b);
      if (x === 'rxlsx') return Exporter.rekapXlsx(th, b);
      if (x === 'db') return Exporter.backupDb(b);
    });
  },
  show: function (el) {
    setTitle('Laporan & Ekspor', 'Laporan');
    var me = App.me;
    var list = (App.proyek || []).filter(function (p) { return me.role !== 'STAKEHOLDER' || p.status === 'Disetujui'; }).sort(function (a, b) { return b.tahun - a.tahun || M.cabangName(a.cabang_id).localeCompare(M.cabangName(b.cabang_id)); });
    var canRekap = me.role !== 'CABANG';
    el.innerHTML = '<div class="grid g-2">' +
      '<div class="card"><div class="card-head"><div><h3>' + ic('file-text') + ' Laporan SROI per Cabang</h3><p>PDF mengikuti tab "Informasi Umum" + lampiran Impact Map. Excel berisi 6 sheet sesuai file standar.</p></div></div><div class="card-pad" style="padding-top:0">' +
      '<div class="field mb"><label>Perhitungan</label><select class="inp" id="lpProyek">' + (list.length ? list.map(function (p) { return '<option value="' + p.proyek_id + '">' + p.tahun + ' — ' + esc(M.cabangName(p.cabang_id)) + ' (' + esc(p.status) + ')</option>'; }).join('') : '<option value="">Belum ada perhitungan</option>') + '</select></div>' +
      '<div class="row"><button class="btn btn-primary" data-x="ppdf">' + ic('download') + ' Unduh PDF</button><button class="btn" data-x="pxlsx">' + ic('download') + ' Unduh Excel</button></div>' +
      '<p class="small muted mt">Perhitungan yang belum Disetujui diberi tanda "SEMENTARA" pada dokumen.</p></div></div>' +
      (canRekap ? '<div class="card"><div class="card-head"><div><h3>' + ic('bar-chart') + ' Rekap Semua Cabang</h3><p>Tabel investasi, impact, PV, rasio, bintang & status; total dan rata-rata tertimbang. Hanya status Disetujui yang dihitung pada total.</p></div></div><div class="card-pad" style="padding-top:0">' +
        '<div class="field mb"><label>Tahun</label><select class="inp" id="lpTahun">' + M.years().map(function (y) { return '<option>' + y + '</option>'; }).join('') + '</select></div>' +
        '<div class="row"><button class="btn btn-primary" data-x="rpdf">' + ic('download') + ' Rekap PDF</button><button class="btn" data-x="rxlsx">' + ic('download') + ' Rekap Excel</button></div></div></div>' : '') +
      '</div>' +
      (me.role === 'ADMIN' ? '<div class="card mt"><div class="card-head"><div><h3>' + ic('database') + ' Cadangan Database</h3><p>Unduh salinan seluruh sheet DharmaImpact_DB (tanpa hash password) sebagai satu file Excel.</p></div><button class="btn" data-x="db">' + ic('download') + ' Unduh Cadangan (.xlsx)</button></div></div>' : '');
  }
});

/* ===================== DATA INDUK & PARAMETER ===================== */
registerPage('master', {
  roles: ['ADMIN'],
  init: function (el) {
    this.tab = 'cabang'; this.kpiTh = new Date().getFullYear(); this.kpiCab = ''; this.ctTh = new Date().getFullYear(); this.tgTh = new Date().getFullYear(); this.tgMode = null;
    el.innerHTML = '<div class="tabs" id="mTabs"></div><div id="mBody"></div>';
    var self = this;
    el.addEventListener('click', function (e) {
      var t = e.target.closest('[data-tab]'); if (t) { self.tab = t.dataset.tab; self.render(el); return; }
      var a = e.target.closest('[data-m]'); if (a) self.act(el, a.dataset.m, a);
    });
    el.addEventListener('change', function (e) {
      if (e.target.id === 'kpiTh') { self.kpiTh = +e.target.value; self.kpiRows = null; self.render(el); }
      if (e.target.id === 'kpiCab') { self.kpiCab = e.target.value; self.kpiRows = null; self.render(el); }
      if (e.target.id === 'ctTh') { self.ctTh = +e.target.value; self.render(el); }
      if (e.target.id === 'tgTh') { self.tgTh = +e.target.value; self.tgMode = null; self.render(el); }
      if (e.target.name === 'tgMode') { self.tgMode = e.target.value; var w = $('#tgWrap', el); if (w) w.classList.toggle('mode-cabang', self.tgMode === 'cabang'); }
    });
    el.addEventListener('input', function (e) {
      var k = e.target.dataset.kpi; if (!k) return;
      var p = k.split('|'); self.kpiRows[+p[0]][p[1]] = (p[1] === 'bobot' || p[1] === 'target') ? parseID(e.target.value) : e.target.value; self.kpiTotal(el);
    });
  },
  show: function (el) {
    setTitle('Data Induk & Parameter', 'Administrasi'); this.render(el);
    var self = this; swr('users', 'listUsers', {}, function (d) { App.users = d; if (self.tab === 'cabang') self.render(el); }, { fresh: 60000 });
  },
  render: function (el) {
    var tabs = [['cabang', 'Cabang'], ['ct', 'UMK & Budget'], ['sektor', 'Sektor'], ['program', 'Program'], ['kpi', 'KPI & Bobot'], ['target', 'Target SROI'], ['param', 'Parameter Baku']];
    $('#mTabs', el).innerHTML = tabs.map(function (t) { return '<button data-tab="' + t[0] + '" class="' + (this.tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>'; }, this).join('');
    $('#mBody', el).innerHTML = this['r_' + this.tab]();
  },
  simpleTable: function (title, desc, cols, rows, addLabel, kind) {
    return '<div class="card"><div class="card-head"><div><h3>' + title + '</h3><p>' + desc + '</p></div><button class="btn btn-primary" data-m="add-' + kind + '">' + ic('plus') + ' ' + addLabel + '</button></div><div class="tbl-wrap"><table class="tbl"><thead><tr>' + cols.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '<th class="c">Status</th><th class="c">Aksi</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  },
  r_cabang: function () {
    var akunOf = function (cid) { return (App.users || []).filter(function (u) { return u.role === 'CABANG' && String(u.cabang_id) === String(cid); }); };
    var rows = (App.master.cabang || []).map(function (c) { var ak = akunOf(c.cabang_id); return '<tr><td class="b">' + esc(c.kode) + '</td><td>' + esc(c.nama_cabang) + '</td><td>' + esc(c.lokasi) + '</td><td>' + esc(c.pic || '—') + '</td><td>' + (ak.length ? ak.map(function (u) { return '<span class="badge badge-info" title="' + (isTrue(u.aktif) ? 'Aktif' : 'Nonaktif') + '">' + ic('user') + ' ' + esc(u.username) + '</span>'; }).join(' ') : '<button class="btn btn-xs" data-m="akun-cabang" data-id="' + c.cabang_id + '">' + ic('key') + ' Buat akun</button>') + '</td><td class="c">' + (isTrue(c.aktif) ? '<span class="badge st-Disetujui">Aktif</span>' : '<span class="badge st-Draft">Nonaktif</span>') + '</td><td class="c nowrap"><button class="btn btn-sm" data-m="edit-cabang" data-id="' + c.cabang_id + '">' + ic('edit') + ' Ubah</button> <button class="btn btn-icon btn-sm btn-danger" data-m="del-cabang" data-id="' + c.cabang_id + '" title="Hapus">' + ic('trash') + '</button></td></tr>'; }).join('');
    return this.simpleTable('Cabang', 'Setiap cabang baru otomatis dibuatkan akun login (username = kode cabang). Data yang sudah dipakai tidak dihapus — cukup dinonaktifkan (B1).', ['Kode', 'Nama Cabang', 'Lokasi', 'PIC Koordinator', 'Akun Login'], rows, 'Tambah Cabang', 'cabang');
  },
  r_sektor: function () {
    var rows = (App.master.sektor || []).map(function (s) { return '<tr><td>' + esc(s.nama_sektor) + '</td><td class="c">' + (isTrue(s.aktif) ? '<span class="badge st-Disetujui">Aktif</span>' : '<span class="badge st-Draft">Nonaktif</span>') + '</td><td class="c nowrap"><button class="btn btn-sm" data-m="edit-sektor" data-id="' + s.sektor_id + '">' + ic('edit') + ' Ubah</button> <button class="btn btn-icon btn-sm btn-danger" data-m="del-sektor" data-id="' + s.sektor_id + '" title="Hapus">' + ic('trash') + '</button></td></tr>'; }).join('');
    return this.simpleTable('Sektor Binaan', 'Sektor dipakai untuk KPI per sektor & daftar UMKM.', ['Nama Sektor'], rows, 'Tambah Sektor', 'sektor');
  },
  r_program: function () {
    var rows = (App.master.program || []).slice().sort(function (a, b) { return N(a.urutan) - N(b.urutan); }).map(function (p) { return '<tr><td class="muted">' + esc(p.urutan) + '</td><td class="b">' + esc(p.nama_program) + '</td><td><span class="badge ' + (p.jenis === 'UTAMA' ? 'badge-info' : 'st-Draft') + '">' + esc(p.jenis) + '</span></td><td class="c">' + (isTrue(p.aktif) ? '<span class="badge st-Disetujui">Aktif</span>' : '<span class="badge st-Draft">Nonaktif</span>') + '</td><td class="c nowrap"><button class="btn btn-sm" data-m="edit-program" data-id="' + p.program_id + '">' + ic('edit') + ' Ubah</button> <button class="btn btn-icon btn-sm btn-danger" data-m="del-program" data-id="' + p.program_id + '" title="Hapus">' + ic('trash') + '</button></td></tr>'; }).join('');
    return this.simpleTable('Program', 'Kegiatan di wizard langkah 3 dikelompokkan per program.', ['Urutan', 'Nama Program', 'Jenis'], rows, 'Tambah Program', 'program');
  },
  r_ct: function () {
    var th = this.ctTh, ys = M.years(); if (ys.indexOf(th) < 0) ys.unshift(th); if (ys.indexOf(new Date().getFullYear() + 1) < 0) ys.unshift(new Date().getFullYear() + 1);
    return '<div class="card"><div class="card-head"><div><h3>UMK & Budget per Cabang per Tahun</h3><p>Wajib terisi sebelum cabang bisa membuat perhitungan tahun tersebut (B3).</p></div><select class="inp" id="ctTh" style="width:auto">' + ys.map(function (y) { return '<option' + (y === th ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select></div>' +
      '<div class="tbl-wrap"><table class="tbl edit"><thead><tr><th>Cabang</th><th class="r" style="min-width:180px">UMK (Rp/bulan)</th><th class="r" style="min-width:200px">Budget Program (Rp)</th><th class="c">Aksi</th></tr></thead><tbody>' +
      M.cabangAktif().map(function (c) { var r = M.ct(c.cabang_id, th); return '<tr><td class="b">' + esc(c.nama_cabang) + '<span class="sub">' + esc(c.lokasi || '') + '</span></td><td><input class="inp num money" inputmode="numeric" id="umk_' + c.cabang_id + '" value="' + esc(numIn(r.umk, 0)) + '"></td><td><input class="inp num money" inputmode="numeric" id="bud_' + c.cabang_id + '" value="' + esc(numIn(r.budget_program, 0)) + '"></td><td class="c nowrap"><button class="btn btn-sm btn-primary" data-m="save-ct" data-id="' + c.cabang_id + '">' + ic('save') + ' Simpan</button>' + (r.cabang_id ? ' <button class="btn btn-icon btn-sm btn-danger" data-m="del-ct" data-id="' + c.cabang_id + '" title="Hapus UMK & budget tahun ini">' + ic('trash') + '</button>' : '') + '</td></tr>'; }).join('') +
      '</tbody></table></div></div>';
  },
  r_kpi: function () {
    var th = this.kpiTh, cid = this.kpiCab, ys = M.years(); [new Date().getFullYear() + 1].forEach(function (y) { if (ys.indexOf(y) < 0) ys.unshift(y); });
    var own = M.kpiSet(th, cid), tpl = M.kpiSet(th, ''), usesTpl = cid && !own.length;
    if (!this.kpiRows) this.kpiRows = (own.length ? own : (cid ? tpl : [])).map(function (k) { return { kpi_id: k.kpi_id, nama_kpi: k.nama_kpi, bobot: N(k.bobot), target: k.target === '' ? '' : N(k.target), satuan: k.satuan || '' }; });
    var cabName = cid ? M.cabangName(cid) : 'Template Baku (semua cabang)';
    var used = (App.proyek || []).some(function (p) { return Number(p.tahun) === th && (!cid || String(p.cabang_id) === String(cid)); });
    var overview = '<div class="card mb"><div class="card-head"><div><h3>Status KPI per Cabang — Tahun ' + th + '</h3><p>Cabang tanpa KPI khusus otomatis memakai Template Baku. KPI satu cabang berlaku untuk seluruh sektor binaannya.</p></div></div><div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Cabang</th><th>Sumber KPI</th><th class="r">Jumlah KPI</th><th class="c">Aksi</th></tr></thead><tbody>' +
      '<tr><td class="b">Template Baku</td><td><span class="badge badge-info">Format baku</span></td><td class="r">' + tpl.length + '</td><td class="c"><button class="btn btn-sm' + (!cid ? ' btn-primary' : '') + '" data-m="kpi-pick" data-id="">' + ic('edit') + ' Atur</button></td></tr>' +
      M.cabangAktif().map(function (c) { var o = M.kpiSet(th, c.cabang_id); return '<tr><td>' + esc(c.nama_cabang) + '</td><td>' + (o.length ? '<span class="badge st-Disetujui">KPI khusus cabang</span>' : '<span class="badge st-Draft">Memakai template baku</span>') + '</td><td class="r">' + (o.length || tpl.length) + '</td><td class="c"><button class="btn btn-sm' + (String(cid) === String(c.cabang_id) ? ' btn-primary' : '') + '" data-m="kpi-pick" data-id="' + c.cabang_id + '">' + ic('edit') + ' Atur</button></td></tr>'; }).join('') + '</tbody></table></div></div>';
    return overview + '<div class="card"><div class="card-head"><div><h3>KPI & Bobot — ' + esc(cabName) + ' ' + th + '</h3><p>Σ bobot wajib 100%. Target = target akumulasi cabang (semua sektor); cabang membagi target & realisasinya ke tiap sektor di wizard.</p></div>' +
      '<div class="row"><select class="inp" id="kpiTh" style="width:auto">' + ys.map(function (y) { return '<option' + (y === th ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select>' +
      '<select class="inp" id="kpiCab" style="width:auto"><option value="">Template Baku (semua cabang)</option>' + M.cabangAktif().map(function (c) { return '<option value="' + c.cabang_id + '"' + (String(cid) === String(c.cabang_id) ? ' selected' : '') + '>' + esc(c.nama_cabang) + '</option>'; }).join('') + '</select></div></div>' +
      (usesTpl ? '<div style="padding:0 22px"><div class="banner banner-blue">' + ic('info') + '<div><p style="margin:0">Cabang ini belum punya KPI khusus — isian di bawah adalah salinan Template Baku. Ubah lalu <b>Simpan</b> untuk menjadikannya KPI khusus cabang.</p></div></div></div>' : '') +
      (used ? '<div style="padding:0 22px"><div class="banner banner-amber">' + ic('alert') + '<div><p style="margin:0">Sudah ada perhitungan tahun ' + th + ' yang memakai KPI ini. Mengubah nama/bobot/target aman; menghapus KPI akan menghapus isian KPI tsb di perhitungan Draft saat dibuka. Perhitungan Disetujui tidak terpengaruh (memakai snapshot).</p></div></div></div>' : '') +
      '<div class="tbl-wrap"><table class="tbl edit"><thead><tr><th>No</th><th style="min-width:260px">Nama KPI</th><th class="r" style="min-width:100px">Bobot (%)</th><th class="r" style="min-width:120px">Target</th><th style="min-width:120px">Satuan</th><th class="c">Aksi</th></tr></thead><tbody>' +
      (this.kpiRows.length ? this.kpiRows.map(function (k, i, arr) {
        return '<tr><td class="muted">' + (i + 1) + '</td><td><input class="inp" data-kpi="' + i + '|nama_kpi" value="' + esc(k.nama_kpi) + '" placeholder="Nama KPI"></td><td><input class="inp num" inputmode="decimal" data-kpi="' + i + '|bobot" value="' + esc(numIn(k.bobot, 2)) + '"></td><td><input class="inp num" inputmode="decimal" data-kpi="' + i + '|target" value="' + esc(numIn(k.target, 2)) + '" placeholder="0"></td><td><input class="inp" list="satuanList" data-kpi="' + i + '|satuan" value="' + esc(k.satuan || '') + '" placeholder="UMKM / %"></td>' +
          '<td class="c nowrap"><button class="btn btn-icon btn-sm btn-ghost" data-m="kpi-up" data-i="' + i + '" title="Naik"' + (i ? '' : ' disabled') + '>▲</button><button class="btn btn-icon btn-sm btn-ghost" data-m="kpi-down" data-i="' + i + '" title="Turun"' + (i < arr.length - 1 ? '' : ' disabled') + '>▼</button><button class="btn btn-icon btn-sm btn-ghost" data-m="kpi-del" data-i="' + i + '" title="Hapus" style="color:var(--red-solid)">' + ic('trash') + '</button></td></tr>';
      }).join('') : '<tr><td colspan="6"><div class="empty">Belum ada KPI. Klik <b>Tambah KPI</b> atau salin.</div></td></tr>') +
      '</tbody><tfoot><tr><td></td><td>Total bobot</td><td class="r" id="kpiTot">—</td><td colspan="3"></td></tr></tfoot></table></div>' +
      '<datalist id="satuanList"><option value="UMKM"><option value="%"><option value="Rp"><option value="Orang"><option value="Laporan"><option value="Kegiatan"></datalist>' +
      '<div class="card-foot"><div class="row"><button class="btn btn-sm" data-m="kpi-add">' + ic('plus') + ' Tambah KPI</button>' + (cid ? '<button class="btn btn-sm" data-m="kpi-copy-tpl">' + ic('copy') + ' Salin dari Template Baku</button>' : '') + '<button class="btn btn-sm" data-m="kpi-copy">' + ic('copy') + ' Salin dari ' + (th - 1) + '</button>' +
      (own.length ? '<button class="btn btn-sm btn-danger" data-m="kpi-reset">' + ic('trash') + (cid ? ' Hapus KPI khusus (kembali ke template)' : ' Hapus Template Baku ' + th) + '</button>' : '') + '</div>' +
      '<button class="btn btn-primary" data-m="kpi-save" id="kpiSave">' + ic('save') + ' Simpan KPI</button></div></div>';
  },
  kpiTotal: function (el) {
    var t = (this.kpiRows || []).reduce(function (a, k) { return a + (Number(k.bobot) || 0); }, 0), ok = Math.abs(t - 100) < 0.001;
    var c = $('#kpiTot', el); if (c) { c.textContent = fmtNum(t, 2) + '%'; c.style.color = ok ? '#15803D' : '#DC2626'; }
    var b = $('#kpiSave', el); if (b) b.disabled = !ok || !this.kpiRows.length;
  },
  r_target: function () {
    var th = this.tgTh, ys = M.years(), yn = new Date().getFullYear();
    [yn + 1, th].forEach(function (y) { if (ys.indexOf(y) < 0) ys.push(y); }); ys.sort(function (a, b) { return b - a; });
    var T = (App.master.target_sroi || []).filter(function (r) { return Number(r.tahun) === th; });
    var get = function (k) { var r = T.filter(function (x) { return String(x.cabang_id || '') === k; })[0]; return r ? N(r.target) : 0; };
    var nas = get('NASIONAL'), ser = get(''), perCab = T.some(function (r) { return r.cabang_id && r.cabang_id !== 'NASIONAL'; });
    if (!this.tgMode) this.tgMode = perCab ? 'cabang' : 'seragam';
    var real = {}; (App.proyek || []).forEach(function (p) { if (Number(p.tahun) === th && p.status === 'Disetujui') real[p.cabang_id] = proyekRatio(p); });
    var okL = (App.proyek || []).filter(function (p) { return Number(p.tahun) === th && p.status === 'Disetujui'; }), w = Agg.weighted(okL);
    var inp = function (id, v, ph) { return '<div class="inp-wrap"><input class="inp num" inputmode="decimal" id="' + id + '" value="' + (v ? esc(numIn(v, 2)) : '') + '" placeholder="' + esc(ph || 'mis. 2,50') + '"><span class="post">: 1</span></div>'; };
    return '<div class="card mb"><div class="card-head"><div><h3>' + ic('target') + ' Target SROI Tahun ' + th + '</h3><p>Target rasio SROI tampil sebagai garis/penanda ◆ di grafik dashboard akumulasi & dashboard cabang, serta kolom Target di tabel.</p></div>' +
      '<select class="inp" id="tgTh" style="width:auto">' + ys.map(function (y) { return '<option' + (y === th ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select></div>' +
      '<div class="card-pad" style="padding-top:0"><div class="form-grid" style="grid-template-columns:1fr 1fr">' +
      '<div class="field"><label>Target Nasional (akumulasi seluruh cabang)</label>' + inp('tgNas', nas) + '<span class="hint">Dibandingkan dengan rata-rata tertimbang seluruh cabang yang Disetujui' + (okL.length ? ' — realisasi ' + th + ': <b>' + ratioFmt(w.ratio) + '</b>' : '') + '. Kosong = memakai target seragam.</span></div>' +
      '<div class="field"><label>Cara menetapkan target cabang</label><div class="seg-radio"><label><input type="radio" name="tgMode" value="seragam"' + (this.tgMode === 'seragam' ? ' checked' : '') + '> Seragam untuk semua cabang</label><label><input type="radio" name="tgMode" value="cabang"' + (this.tgMode === 'cabang' ? ' checked' : '') + '> Berbeda per cabang</label></div></div>' +
      '</div></div></div>' +
      '<div class="card' + (this.tgMode === 'cabang' ? ' mode-cabang' : '') + '" id="tgWrap"><div class="card-head"><div><h3>Target Cabang</h3><p class="only-ser">Satu target berlaku untuk semua cabang aktif.</p><p class="only-cab">Isi target tiap cabang. Kolom yang dikosongkan memakai <b>target seragam</b> sebagai cadangan.</p></div></div>' +
      '<div class="card-pad" style="padding-top:0"><div class="field" style="max-width:340px"><label>Target seragam semua cabang</label>' + inp('tgSer', ser) + '</div></div>' +
      '<div class="only-cab tbl-wrap"><table class="tbl edit"><thead><tr><th>Cabang</th><th class="r" style="min-width:170px">Target SROI</th><th class="r">Realisasi ' + th + '</th><th class="c">Capaian</th></tr></thead><tbody>' +
      M.cabangAktif().map(function (c) { var v = get(String(c.cabang_id)), t = v || ser, rr = real[c.cabang_id]; return '<tr><td class="b">' + esc(c.nama_cabang) + '<span class="sub">' + esc(c.kode || '') + '</span></td><td>' + inp('tg_' + c.cabang_id, v, ser ? 'ikut seragam (' + fmtNum(ser, 2) + ')' : 'mis. 2,00') + '</td><td class="r tnum">' + (rr != null ? ratioFmt(rr) : '—') + '</td><td class="c">' + (rr != null && t ? tgtCell(rr, t, true) : '—') + '</td></tr>'; }).join('') +
      '</tbody></table></div>' +
      '<div class="card-foot"><div class="row"><button class="btn btn-sm" data-m="tg-copy">' + ic('copy') + ' Salin dari ' + (th - 1) + '</button>' + (T.length ? '<button class="btn btn-sm btn-danger" data-m="tg-del">' + ic('trash') + ' Hapus target ' + th + '</button>' : '') + '</div><button class="btn btn-primary" data-m="tg-save">' + ic('save') + ' Simpan Target</button></div></div>';
  },
  r_param: function () {
    var rows = (App.master.parameter || []);
    var get = function (k, d) { var r = rows.filter(function (x) { return x.key === k && !x.tahun; })[0]; return r ? r.value : d; };
    return '<div class="card"><div class="card-head"><div><h3>Parameter Baku</h3><p>Perubahan tidak memengaruhi perhitungan yang sudah Disetujui — parameter di-snapshot saat persetujuan (B4).</p></div></div><div class="card-pad" style="padding-top:0"><div class="form-grid">' +
      '<div class="field"><label>Discount rate (%)</label><input class="inp num" id="pDr" value="' + esc(String(get('discount_rate', 5)).replace('.', ',')) + '"><span class="hint">Suku bunga rata-rata BI — dipakai PV (F11, F13)</span></div>' +
      '<div class="field"><label>Hari kerja per bulan</label><input class="inp num" id="pHk" value="' + esc(get('hari_kerja_bulan', 26)) + '"><span class="hint">Pembagi UMK harian (F4)</span></div>' +
      '<div class="field"><label>Rumus rasio</label><select class="inp" id="pRumus"><option value="KLASIK"' + (get('rumus_rasio', 'KLASIK') === 'KLASIK' ? ' selected' : '') + '>KLASIK — PV Impact ÷ PV Investasi (R1)</option><option value="BERSIH"' + (get('rumus_rasio') === 'BERSIH' ? ' selected' : '') + '>BERSIH — (PV Impact − PV Investasi) ÷ PV Investasi</option></select></div>' +
      '<div class="field"><label>Batas bintang</label><input class="inp" id="pBt" value="' + esc(get('bintang_batas', '1;1,5;3;7')) + '"><span class="hint">Format 4 angka dipisah titik koma: &lt;1 ★1 · 1–1,5 ★2 · &gt;1,5–3 ★3 · &gt;3–7 ★4 · &gt;7 ★5</span></div>' +
      '<div class="field"><label>Maks. ukuran berkas (MB)</label><input class="inp num" id="pMb" value="' + esc(get('maks_ukuran_berkas_mb', 10)) + '"></div>' +
      '</div></div><div class="card-foot"><span>Setiap perubahan parameter tercatat di Log Audit.</span><button class="btn btn-primary" data-m="param-save">' + ic('save') + ' Simpan Parameter</button></div></div>';
  },
  after: function () { saveBootCache(); },
  act: async function (el, m, btn) {
    var self = this;
    var forms = {
      cabang: { title: 'Cabang', key: 'cabang_id', action: 'saveCabang', list: 'cabang', fields: [['kode', 'Kode cabang *'], ['nama_cabang', 'Nama cabang *'], ['lokasi', 'Lokasi'], ['pic', 'PIC koordinator']] },
      sektor: { title: 'Sektor', key: 'sektor_id', action: 'saveSektor', list: 'sektor', fields: [['nama_sektor', 'Nama sektor *']] },
      program: { title: 'Program', key: 'program_id', action: 'saveProgram', list: 'program', fields: [['nama_program', 'Nama program *'], ['jenis', 'Jenis', ['UTAMA', 'PENDUKUNG']], ['urutan', 'Urutan']] }
    };
    var mm = m.split('-');
    if ((mm[0] === 'add' || mm[0] === 'edit') && forms[mm[1]]) {
      var F = forms[mm[1]], row = mm[0] === 'edit' ? Object.assign({}, (App.master[F.list] || []).filter(function (x) { return String(x[F.key]) === String(btn.dataset.id); })[0]) : { aktif: true };
      var body = F.fields.map(function (f) { return '<div class="field mb-s"><label>' + f[1] + '</label>' + (f[2] ? '<select class="inp" data-f="' + f[0] + '">' + f[2].map(function (o) { return '<option' + (row[f[0]] === o ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select>' : '<input class="inp" data-f="' + f[0] + '" value="' + esc(row[f[0]] == null ? '' : row[f[0]]) + '">') + '</div>'; }).join('') +
        '<label class="row small"><input type="checkbox" data-f="aktif"' + (isTrue(row.aktif) ? ' checked' : '') + '> Aktif</label>';
      return modal({
        title: (mm[0] === 'add' ? 'Tambah ' : 'Ubah ') + F.title, body: body,
        actions: [{ label: 'Batal', value: null }, {
          label: 'Simpan', cls: 'btn-primary', onClick: async function (bg) {
            $$('[data-f]', bg).forEach(function (i) { row[i.dataset.f] = i.type === 'checkbox' ? i.checked : i.value.trim(); });
            var res = await api(F.action, { row: row });
            if (!res.success) { toast(res.message, 'err'); return false; }
            var lst = App.master[F.list], ix = lst.findIndex(function (x) { return String(x[F.key]) === String(res.data[F.key]); });
            if (ix > -1) lst[ix] = res.data; else lst.push(res.data);
            if (res.users) App.users = res.users;
            self.after(); self.render(el); toast(F.title + ' tersimpan.', 'ok');
            if (res.akun) setTimeout(function () { showAkunCabang(res.akun); }, 50);
          }
        }]
      });
    }
    if (m === 'akun-cabang') {
      var cab0 = M.cabang(btn.dataset.id);
      if (!(await confirmBox('Buat akun login untuk ' + esc(cab0.nama_cabang) + '?', 'Username dibuat dari kode cabang dan password dibuat acak. Password hanya ditampilkan sekali.', 'Buat akun'))) return;
      return withBtn(btn, async function () {
        var res = await api('buatAkunCabang', { cabang_id: btn.dataset.id });
        if (!res.success) return toast(res.message, 'err');
        if (res.users) App.users = res.users;
        self.after(); self.render(el); showAkunCabang(res.data);
      });
    }
    if (m === 'tg-save' || m === 'tg-del' || m === 'tg-copy') {
      var th2 = self.tgTh, mode = self.tgMode, rowsT = [];
      var val = function (id) { var i = $('#' + id, el); return i ? (parseID(i.value) || 0) : 0; };
      var payload;
      if (m === 'tg-copy') {
        var src = (App.master.target_sroi || []).filter(function (r) { return Number(r.tahun) === th2 - 1; });
        if (!src.length) return toast('Target tahun ' + (th2 - 1) + ' belum ada.', 'warn');
        payload = { tahun: th2, nasional: 0, seragam: 0, mode: 'seragam', rows: [] };
        src.forEach(function (r) { if (r.cabang_id === 'NASIONAL') payload.nasional = N(r.target); else if (!r.cabang_id) payload.seragam = N(r.target); else { payload.mode = 'cabang'; payload.rows.push({ cabang_id: r.cabang_id, target: N(r.target) }); } });
      } else if (m === 'tg-del') {
        if (!(await confirmBox('Hapus target SROI ' + th2 + '?', 'Target nasional & seluruh target cabang tahun ini dihapus. Grafik tidak lagi menampilkan target tahun ini.', 'Hapus', 'btn-danger'))) return;
        payload = { tahun: th2, nasional: 0, seragam: 0, mode: 'seragam', rows: [] };
      } else {
        M.cabangAktif().forEach(function (c) { var v = val('tg_' + c.cabang_id); if (v) rowsT.push({ cabang_id: c.cabang_id, target: v }); });
        payload = { tahun: th2, nasional: val('tgNas'), seragam: val('tgSer'), mode: mode, rows: rowsT };
        if (!payload.nasional && !payload.seragam && !(mode === 'cabang' && rowsT.length)) return toast('Isi minimal satu target (nasional, seragam, atau per cabang).', 'warn');
        if (mode === 'cabang' && !payload.seragam && rowsT.length < M.cabangAktif().length) { if (!(await confirmBox('Sebagian cabang belum punya target', 'Cabang yang kosong tidak memiliki target karena target seragam juga kosong. Lanjut simpan?', 'Simpan'))) return; }
      }
      return withBtn(btn, async function () {
        var res = await api('saveTargetSroi', payload);
        if (!res.success) return toast(res.message, 'err');
        App.master.target_sroi = (App.master.target_sroi || []).filter(function (r) { return Number(r.tahun) !== th2; }).concat(res.data);
        self.tgMode = null; self.after(); self.render(el);
        toast(m === 'tg-del' ? 'Target ' + th2 + ' dihapus.' : m === 'tg-copy' ? 'Target ' + (th2 - 1) + ' disalin ke ' + th2 + '.' : 'Target SROI ' + th2 + ' tersimpan.', 'ok');
      });
    }
    if (m === 'save-ct') {
      var cid = btn.dataset.id, umk = parseMoney($('#umk_' + cid, el).value), bud = parseMoney($('#bud_' + cid, el).value);
      return withBtn(btn, async function () {
        var res = await api('saveCabangTahun', { row: { cabang_id: cid, tahun: self.ctTh, umk: umk || 0, budget_program: bud || 0 } });
        if (!res.success) return toast(res.message, 'err');
        var lst = App.master.cabang_tahun, r = lst.filter(function (x) { return String(x.cabang_id) === String(cid) && Number(x.tahun) === self.ctTh; })[0];
        if (r) { r.umk = umk || 0; r.budget_program = bud || 0; } else lst.push({ cabang_id: cid, tahun: self.ctTh, umk: umk || 0, budget_program: bud || 0 });
        self.after(); toast('UMK & budget ' + M.cabangName(cid) + ' ' + self.ctTh + ' tersimpan.', 'ok');
      });
    }
    if (m === 'kpi-pick') { this.kpiCab = btn.dataset.id; this.kpiRows = null; this.render(el); var sc = $('#kpiCab', el); if (sc) sc.scrollIntoView({ block: 'center' }); return; }
    if (m === 'kpi-add') { this.kpiRows.push({ kpi_id: '', nama_kpi: '', bobot: 0, target: '', satuan: 'UMKM' }); return this.render(el); }
    if (m === 'kpi-del') {
      var kd = this.kpiRows[+btn.dataset.i];
      if (kd.nama_kpi && !(await confirmBox('Hapus KPI?', 'KPI <b>' + esc(kd.nama_kpi) + '</b> dihapus dari daftar. Perubahan berlaku setelah Simpan.', 'Hapus', 'btn-danger'))) return;
      this.kpiRows.splice(+btn.dataset.i, 1); return this.render(el);
    }
    if (m === 'kpi-up' || m === 'kpi-down') { var i0 = +btn.dataset.i, j0 = m === 'kpi-up' ? i0 - 1 : i0 + 1, tmp = this.kpiRows[i0]; this.kpiRows[i0] = this.kpiRows[j0]; this.kpiRows[j0] = tmp; return this.render(el); }
    if (m === 'kpi-copy' || m === 'kpi-copy-tpl') {
      var src = m === 'kpi-copy' ? M.kpi(this.kpiTh - 1, this.kpiCab) : M.kpiSet(this.kpiTh, '');
      if (!src.length) return toast(m === 'kpi-copy' ? 'KPI tahun ' + (this.kpiTh - 1) + ' tidak ada.' : 'Template baku tahun ini masih kosong.', 'warn');
      var keepId = m === 'kpi-copy-tpl';
      this.kpiRows = src.map(function (k) { return { kpi_id: keepId ? k.kpi_id : '', nama_kpi: k.nama_kpi, bobot: N(k.bobot), target: k.target === '' ? '' : N(k.target), satuan: k.satuan }; });
      toast('Disalin — periksa lalu Simpan.', 'ok'); return this.render(el);
    }
    if (m === 'kpi-reset') {
      var cn = this.kpiCab ? M.cabangName(this.kpiCab) : 'Template Baku';
      if (!(await confirmBox('Hapus KPI ' + esc(cn) + ' ' + this.kpiTh + '?', this.kpiCab ? 'Cabang ini akan kembali memakai Template Baku.' : 'Cabang yang tidak punya KPI khusus tidak akan memiliki KPI tahun ini.', 'Hapus', 'btn-danger'))) return;
      return withBtn(btn, async function () {
        var res = await api('deleteKpi', { tahun: self.kpiTh, cabang_id: self.kpiCab });
        if (!res.success) return toast(res.message, 'err');
        App.master.kpi = App.master.kpi.filter(function (k) { return !(Number(k.tahun) === self.kpiTh && String(k.cabang_id || '') === String(self.kpiCab)); });
        self.kpiRows = null; self.after(); self.render(el); toast('KPI dihapus.', 'ok');
      });
    }
    if (m === 'kpi-save') {
      var bad = this.kpiRows.filter(function (k) { return !String(k.nama_kpi || '').trim() || !(N(k.target) > 0) || !String(k.satuan || '').trim(); });
      if (bad.length) return toast('Lengkapi nama, target (> 0), dan satuan setiap KPI.', 'warn');
      return withBtn(btn, async function () {
        var res = await api('saveKpi', { tahun: self.kpiTh, cabang_id: self.kpiCab, rows: self.kpiRows });
        if (!res.success) return toast(res.message, 'err');
        App.master.kpi = App.master.kpi.filter(function (k) { return !(Number(k.tahun) === self.kpiTh && String(k.cabang_id || '') === String(self.kpiCab)); }).concat(res.data);
        self.kpiRows = null; self.after(); self.render(el); toast('KPI ' + (self.kpiCab ? M.cabangName(self.kpiCab) : 'Template Baku') + ' ' + self.kpiTh + ' tersimpan.', 'ok');
      });
    }
    if (/^del-(cabang|sektor|program|ct)$/.test(m)) {
      var kind = m === 'del-ct' ? 'cabang_tahun' : m.slice(4), id = btn.dataset.id;
      var label = kind === 'cabang' ? 'cabang ' + M.cabangName(id) + ' beserta akun login-nya' : kind === 'sektor' ? 'sektor ' + M.sektorName(id) : kind === 'program' ? 'program ' + M.programName(id) : 'UMK & budget ' + M.cabangName(id) + ' tahun ' + self.ctTh;
      if (!(await confirmBox('Hapus ' + esc(label) + '?', 'Data yang sudah dipakai di perhitungan tidak bisa dihapus — cukup dinonaktifkan lewat tombol Ubah.', 'Hapus', 'btn-danger'))) return;
      return withBtn(btn, async function () {
        var res = await api('deleteMaster', { kind: kind, id: id, tahun: self.ctTh });
        if (!res.success) return toast(res.message, 'err');
        var mm2 = App.master;
        if (kind === 'cabang') { App.users = (App.users || []).filter(function (u) { return String(u.cabang_id) !== String(id); }); mm2.target_sroi = (mm2.target_sroi || []).filter(function (x) { return String(x.cabang_id) !== String(id); }); mm2.cabang = mm2.cabang.filter(function (x) { return String(x.cabang_id) !== String(id); }); mm2.cabang_tahun = mm2.cabang_tahun.filter(function (x) { return String(x.cabang_id) !== String(id); }); mm2.kpi = mm2.kpi.filter(function (x) { return String(x.cabang_id || '') !== String(id); }); }
        if (kind === 'sektor') mm2.sektor = mm2.sektor.filter(function (x) { return String(x.sektor_id) !== String(id); });
        if (kind === 'program') mm2.program = mm2.program.filter(function (x) { return String(x.program_id) !== String(id); });
        if (kind === 'cabang_tahun') mm2.cabang_tahun = mm2.cabang_tahun.filter(function (x) { return !(String(x.cabang_id) === String(id) && Number(x.tahun) === self.ctTh); });
        self.after(); self.render(el); toast('Data dihapus.', 'ok');
      });
    }
    if (m === 'param-save') {
      var bt = $('#pBt', el).value.trim();
      if (bt.split(';').length !== 4) return toast('Batas bintang harus 4 angka dipisah titik koma.', 'warn');
      var list = [
        { key: 'discount_rate', value: parseID($('#pDr', el).value) || 0, keterangan: 'Suku bunga rata-rata BI (%)' },
        { key: 'hari_kerja_bulan', value: parseID($('#pHk', el).value) || 26, keterangan: 'Pembagi UMK harian' },
        { key: 'rumus_rasio', value: $('#pRumus', el).value, keterangan: 'KLASIK / BERSIH' },
        { key: 'bintang_batas', value: bt, keterangan: 'Batas kategori bintang' },
        { key: 'maks_ukuran_berkas_mb', value: parseID($('#pMb', el).value) || 10, keterangan: 'Batas ukuran per berkas (MB)' }
      ].concat((App.master.parameter || []).filter(function (r) { return r.tahun; }));
      return withBtn(btn, async function () {
        var res = await api('saveParameter', { rows: list });
        if (!res.success) return toast(res.message, 'err');
        App.master.parameter = list; self.after(); toast('Parameter tersimpan.', 'ok');
      });
    }
  }
});
/** Tampilkan username & password akun cabang (sekali saja). */
function showAkunCabang(a) {
  var txt = 'Akun DharmaImpact — ' + a.cabang + '\nUsername: ' + a.username + '\nPassword: ' + a.password;
  modal({ title: 'Akun login cabang dibuat', body:
    '<div class="banner banner-green" style="margin-bottom:12px">' + ic('check-circle') + '<div><b>Akun untuk ' + esc(a.cabang) + ' siap dipakai</b><p>Catat atau salin sekarang — password hanya ditampilkan sekali. Bisa direset kapan saja di menu Pengguna.</p></div></div>' +
    '<div class="cred"><div><span>Username</span><b class="mono">' + esc(a.username) + '</b></div><div><span>Password</span><b class="mono">' + esc(a.password) + '</b></div></div>',
    actions: [{ label: ic('copy') + ' Salin', onClick: function () { try { navigator.clipboard.writeText(txt); toast('Username & password disalin.', 'ok'); } catch (e) { toast('Salin manual dari layar.', 'warn'); } return false; } }, { label: 'Selesai', cls: 'btn-primary', value: true }] });
}
// sinkronkan total bobot setelah render tab KPI
(function () { var orig = App.pages.master.render; App.pages.master.render = function (el) { orig.call(this, el); if (this.tab === 'kpi') this.kpiTotal(el); }; })();

/* ===================== PENGGUNA ===================== */
registerPage('users', {
  roles: ['ADMIN'],
  init: function (el) {
    var self = this;
    el.innerHTML = '<div class="card"><div class="card-head"><div><h3>Pengguna</h3><p>Akun Cabang wajib terhubung ke 1 cabang • Stakeholder maks. 3 akun aktif • Password tersimpan sebagai hash + salt.</p></div><button class="btn btn-primary" data-u="add">' + ic('plus') + ' Tambah Akun</button></div><div class="tbl-wrap"><table class="tbl" id="uTbl"></table></div></div>';
    el.addEventListener('click', function (e) { var b = e.target.closest('[data-u]'); if (b) self.act(el, b.dataset.u, b.dataset.id); });
  },
  show: function (el) {
    setTitle('Pengguna', 'Administrasi'); this.render(el);
    var self = this;
    swr('users', 'listUsers', {}, function (d) { App.users = d; self.render(el); }, { fresh: 60000 });
  },
  render: function (el) {
    var rows = (App.users || []).slice().sort(function (a, b) { return a.role.localeCompare(b.role) || String(a.username).localeCompare(String(b.username)); });
    $('#uTbl', el).innerHTML = '<thead><tr><th>Nama Tampilan</th><th>Username</th><th>Peran</th><th>Cabang</th><th class="hide-sm">Login Terakhir</th><th class="c">Status</th><th class="c">Aksi</th></tr></thead><tbody>' +
      rows.map(function (u) { return '<tr><td><span class="row" style="gap:10px;flex-wrap:nowrap"><span class="avatar" style="width:30px;height:30px;font-size:11px">' + initials(u.nama_tampilan) + '</span><b>' + esc(u.nama_tampilan) + '</b></span></td><td class="tnum">' + esc(u.username) + '</td><td><span class="badge ' + (u.role === 'ADMIN' ? 'badge-info' : u.role === 'STAKEHOLDER' ? 'badge-amber' : 'st-Draft') + '">' + roleLabel(u.role) + '</span></td><td>' + (u.cabang_id ? esc(M.cabangName(u.cabang_id)) : '—') + '</td><td class="hide-sm small muted">' + fmtDate(u.last_login) + '</td><td class="c">' + (isTrue(u.aktif) ? '<span class="badge st-Disetujui">Aktif</span>' : '<span class="badge st-Draft">Nonaktif</span>') + '</td>' +
        '<td class="c nowrap"><button class="btn btn-sm" data-u="edit" data-id="' + u.user_id + '">' + ic('edit') + '</button> <button class="btn btn-sm" data-u="reset" data-id="' + u.user_id + '" title="Reset password">' + ic('key') + '</button> <button class="btn btn-icon btn-sm btn-danger" data-u="del" data-id="' + u.user_id + '" title="Hapus akun">' + ic('trash') + '</button></td></tr>'; }).join('') + '</tbody>';
  },
  act: async function (el, a, id) {
    var self = this;
    if (a === 'del') {
      var ud = App.users.filter(function (x) { return x.user_id === id; })[0];
      if (!(await confirmBox('Hapus akun ' + esc(ud.username) + '?', 'Akun dihapus permanen dan sesinya langsung berakhir. Bila hanya ingin menghentikan sementara, gunakan Ubah → nonaktifkan.', 'Hapus', 'btn-danger'))) return;
      var res = await api('deleteMaster', { kind: 'user', id: id });
      if (!res.success) return toast(res.message, 'err');
      App.users = res.data; saveBootCache(); self.render(el); return toast('Akun dihapus.', 'ok');
    }
    if (a === 'reset') {
      var u0 = App.users.filter(function (x) { return x.user_id === id; })[0];
      return modal({
        title: 'Reset password ' + u0.username, body: '<div class="field"><label>Password baru (min. 8 karakter)</label><input class="inp" id="rpPw" type="text" autocomplete="new-password"></div><p class="small muted">Sesi aktif pengguna ini akan langsung berakhir.</p>',
        actions: [{ label: 'Batal', value: null }, { label: 'Reset', cls: 'btn-primary', onClick: async function (bg) { var res = await api('resetPassword', { user_id: id, password: bg.querySelector('#rpPw').value }); if (!res.success) { toast(res.message, 'err'); return false; } toast(res.message || 'Password direset.', 'ok'); } }]
      });
    }
    var u = a === 'edit' ? Object.assign({}, App.users.filter(function (x) { return x.user_id === id; })[0]) : { role: 'CABANG', aktif: true };
    var body = '<div class="form-grid" style="grid-template-columns:1fr 1fr">' +
      '<div class="field"><label>Nama tampilan</label><input class="inp" data-f="nama_tampilan" value="' + esc(u.nama_tampilan || '') + '"></div>' +
      '<div class="field"><label>Username</label><input class="inp" data-f="username" value="' + esc(u.username || '') + '" autocapitalize="none"></div>' +
      '<div class="field"><label>Peran</label><select class="inp" data-f="role" id="uRole">' + [['ADMIN', 'Super Admin'], ['CABANG', 'Akun Cabang'], ['STAKEHOLDER', 'Stakeholder']].map(function (r) { return '<option value="' + r[0] + '"' + (u.role === r[0] ? ' selected' : '') + '>' + r[1] + '</option>'; }).join('') + '</select></div>' +
      '<div class="field" id="uCabWrap"><label>Cabang</label><select class="inp" data-f="cabang_id"><option value="">— pilih —</option>' + M.cabangAktif().map(function (c) { return '<option value="' + c.cabang_id + '"' + (String(u.cabang_id) === String(c.cabang_id) ? ' selected' : '') + '>' + esc(c.nama_cabang) + '</option>'; }).join('') + '</select></div>' +
      (a === 'add' ? '<div class="field span3"><label>Password awal (min. 8 karakter)</label><input class="inp" id="uPw" type="text" autocomplete="new-password"></div>' : '') +
      '<label class="row small span3"><input type="checkbox" data-f="aktif"' + (isTrue(u.aktif) ? ' checked' : '') + '> Akun aktif</label></div>';
    modal({
      title: a === 'add' ? 'Tambah Akun' : 'Ubah Akun', body: body,
      onOpen: function (bg) { var f = function () { bg.querySelector('#uCabWrap').hidden = bg.querySelector('#uRole').value !== 'CABANG'; }; bg.querySelector('#uRole').onchange = f; f(); },
      actions: [{ label: 'Batal', value: null }, {
        label: 'Simpan', cls: 'btn-primary', onClick: async function (bg) {
          $$('[data-f]', bg).forEach(function (i) { u[i.dataset.f] = i.type === 'checkbox' ? i.checked : i.value.trim(); });
          var res = await api('saveUser', { row: u, password: a === 'add' ? bg.querySelector('#uPw').value : undefined });
          if (!res.success) { toast(res.message, 'err'); return false; }
          App.users = res.data; saveBootCache(); self.render(el); toast('Akun tersimpan.', 'ok');
        }
      }]
    });
  }
});

/* ===================== PROFIL ===================== */
registerPage('profil', {
  init: function (el) {
    el.addEventListener('submit', async function (e) {
      e.preventDefault();
      var o = $('#pwOld', el).value, n1 = $('#pwNew', el).value, n2 = $('#pwNew2', el).value;
      if (n1.length < 8) return toast('Password baru minimal 8 karakter.', 'warn');
      if (n1 !== n2) return toast('Konfirmasi password tidak sama.', 'warn');
      withBtn(e.submitter, async function () {
        var res = await api('changePassword', { old: o, 'new': n1 });
        if (!res.success) return toast(res.message, 'err');
        e.target.reset(); toast('Password berhasil diganti.', 'ok');
      });
    });
  },
  show: function (el) {
    setTitle('Profil & Keamanan', 'Profil');
    var me = App.me;
    el.innerHTML = '<div class="grid g-2"><div class="card card-pad"><div class="row" style="gap:16px"><div class="avatar" style="width:56px;height:56px;font-size:18px">' + initials(me.nama) + '</div><div><h3>' + esc(me.nama) + '</h3><div class="muted">@' + esc(me.username) + ' • ' + roleLabel(me.role) + (me.cabangId ? ' • Cabang ' + esc(M.cabangName(me.cabangId)) : '') + '</div></div></div>' +
      '<div class="mt small muted">Sesi berlaku ' + 8 + ' jam sejak login dan berakhir ' + new Date(App.exp).toLocaleString('id-ID') + '.</div>' +
      '<div class="mt"><button class="btn btn-sm" onclick="Perf.table();toast(\'Tabel performa dicetak di Console (F12).\')">' + ic('bar-chart') + ' Diagnostik kecepatan</button> <button class="btn btn-sm" id="btnClearCache">' + ic('refresh') + ' Muat ulang data</button></div></div>' +
      '<form class="card card-pad"><h3 class="mb-s">Ganti Password</h3><div class="field mb-s"><label>Password lama</label><input class="inp" type="password" id="pwOld" autocomplete="current-password" required></div><div class="field mb-s"><label>Password baru (min. 8 karakter)</label><input class="inp" type="password" id="pwNew" autocomplete="new-password" required></div><div class="field mb"><label>Ulangi password baru</label><input class="inp" type="password" id="pwNew2" autocomplete="new-password" required></div><button class="btn btn-primary" type="submit">' + ic('save') + ' Simpan Password</button></form></div>';
    $('#btnClearCache', el).onclick = function () { refreshBoot(true).then(function () { toast('Data diperbarui dari server.', 'ok'); }); };
  }
});

/* ===================== TAMPILAN APLIKASI ===================== */
var THEME_PRESETS = [
  ['Biru Korporat', '#005AAB', '#0A3D73', '#E8A317'], ['Hijau Hutan', '#15803D', '#14532D', '#EAB308'],
  ['Merah Marun', '#B91C1C', '#5F1A1A', '#F59E0B'], ['Ungu Royal', '#6D28D9', '#3B0764', '#F59E0B'],
  ['Toska', '#0F766E', '#134E4A', '#F59E0B'], ['Kuning Astra', '#C28A00', '#1F2937', '#0EA5E9'], ['Abu Grafit', '#334155', '#0F172A', '#E8A317']
];
registerPage('tampilan', {
  roles: ['ADMIN'],
  init: function (el) {
    var self = this;
    el.addEventListener('input', function (e) {
      var f = e.target.dataset.t; if (!f) return;
      self.draft[f] = e.target.value;
      if (e.target.type === 'color') { var tx = el.querySelector('[data-tx="' + f + '"]'); if (tx) tx.value = e.target.value; }
      self.preview(el);
    });
    el.addEventListener('change', function (e) {
      if (e.target.dataset.tx) { var f = e.target.dataset.tx, v = e.target.value.trim(); if (/^#[0-9a-fA-F]{6}$/.test(v)) { self.draft[f] = v; el.querySelector('[data-t="' + f + '"]').value = v; self.preview(el); } else toast('Format warna harus #RRGGBB, mis. #005AAB', 'warn'); }
      if (e.target.id === 'logoFile') self.readLogo(el, e.target);
    });
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-x]'); if (!b) return;
      var x = b.dataset.x;
      if (x === 'preset') { var pr = THEME_PRESETS[+b.dataset.i]; self.draft.color_primary = pr[1]; self.draft.color_sidebar = pr[2]; self.draft.color_accent = pr[3]; self.render(el); self.preview(el); }
      if (x === 'logo-del') { self.draft.logo = ''; self.render(el); self.preview(el); toast('Logo dihapus dari pratinjau. Klik Simpan untuk menerapkan.', 'ok'); }
      if (x === 'reset') { self.draft = Object.assign({}, THEME_DEFAULT); self.render(el); self.preview(el); toast('Dikembalikan ke bawaan (belum disimpan).', 'ok'); }
      if (x === 'cancel') { self.draft = Object.assign({}, UI); applyTheme(Store.get('ui', {})); self.render(el); }
      if (x === 'save') self.save(el, b);
    });
  },
  show: function (el) { setTitle('Tampilan Aplikasi', 'Administrasi'); this.draft = Object.assign({}, UI); this.render(el); },
  hide: function () { applyTheme(Store.get('ui', {})); },   // batalkan pratinjau yang belum disimpan
  preview: function (el) {
    applyTheme(this.draft);
    var pv = el.querySelector('#tmPrev'); if (pv) pv.innerHTML = this.prevHtml();
  },
  prevHtml: function () {
    var d = this.draft;
    return '<div style="display:flex;border:1px solid var(--border);border-radius:12px;overflow:hidden;min-height:190px">' +
      '<div style="width:42%;background:' + esc(d.color_sidebar) + ';color:#fff;padding:14px"><div class="row" style="flex-wrap:nowrap;gap:8px"><div class="brand-mark' + (d.logo ? ' has-img' : '') + '" style="width:34px;height:34px">' + (d.logo ? '<img src="' + d.logo + '" alt="">' : ic('logo')) + '</div><div style="min-width:0"><b style="font-family:var(--f-head);display:block;font-size:14px;line-height:17px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(d.app_name || '') + '</b><small style="opacity:.85;font-size:11px">' + esc(d.app_sub || '') + '</small></div></div>' +
      '<div style="margin-top:14px;background:' + esc(mixHex(d.color_primary, '#ffffff', 0.1)) + ';border-radius:8px;padding:7px;text-align:center;font-size:12px;font-weight:600">+ Hitung Baru</div><div style="margin-top:10px;background:rgba(255,255,255,.13);border-radius:8px;padding:7px 9px;font-size:12px">Dashboard</div></div>' +
      '<div style="flex:1;padding:14px;background:#F5F7FA"><div style="background:#fff;border:1px solid var(--border);border-radius:10px;padding:12px"><div style="font-size:11px;color:var(--muted);font-weight:600">RASIO SROI</div><div style="font-family:var(--f-head);font-size:24px;font-weight:800;color:' + esc(d.color_primary) + '">2,47 : 1</div><div style="color:' + esc(d.color_accent) + ';font-size:16px">★★★<span style="color:#D7DEE8">★★</span></div></div>' +
      '<div style="margin-top:10px;display:inline-block;background:' + esc(d.color_primary) + ';color:#fff;border-radius:8px;padding:7px 12px;font-size:12px;font-weight:600">Tombol utama</div></div></div>';
  },
  field: function (k, label, max, area, hint) {
    var v = this.draft[k] || '';
    return '<div class="field' + (area ? ' span3' : '') + '"><label>' + label + '</label>' + (area ? '<textarea class="inp" rows="3" maxlength="' + max + '" data-t="' + k + '">' + esc(v) + '</textarea>' : '<input class="inp" maxlength="' + max + '" data-t="' + k + '" value="' + esc(v) + '">') + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</div>';
  },
  color: function (k, label, hint) {
    var v = this.draft[k];
    return '<div class="field"><label>' + label + '</label><div class="row" style="flex-wrap:nowrap;gap:8px"><input type="color" data-t="' + k + '" value="' + esc(v) + '" style="width:48px;height:40px;border:1px solid var(--border);border-radius:8px;padding:3px;background:#fff;cursor:pointer"><input class="inp" data-tx="' + k + '" value="' + esc(v) + '" maxlength="7" style="font-family:monospace"></div><span class="hint">' + hint + '</span></div>';
  },
  render: function (el) {
    var d = this.draft;
    el.innerHTML = '<div class="banner banner-blue">' + ic('info') + '<div><b>Perubahan langsung terlihat sebagai pratinjau</b><p>Klik <b>Simpan Tampilan</b> agar berlaku untuk semua pengguna. Meninggalkan halaman tanpa menyimpan akan membatalkan pratinjau.</p></div></div>' +
      '<div class="grid g-21"><div>' +
      '<div class="card"><div class="card-head"><div><h3>' + ic('image') + ' Logo Aplikasi</h3><p>PNG/JPG/SVG maks. 2 MB — otomatis diperkecil. Kosongkan untuk memakai ikon bawaan.</p></div></div><div class="card-pad" style="padding-top:0"><div class="row" style="gap:16px">' +
      '<div class="brand-mark' + (d.logo ? ' has-img' : '') + '" style="width:72px;height:72px;border:1px solid var(--border);color:var(--primary)">' + (d.logo ? '<img src="' + d.logo + '" alt="Logo">' : ic('logo')) + '</div>' +
      '<div class="row"><label class="btn btn-primary btn-sm">' + ic('upload') + ' Unggah logo<input type="file" id="logoFile" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden></label>' + (d.logo ? '<button class="btn btn-sm btn-danger" data-x="logo-del">' + ic('trash') + ' Hapus logo</button>' : '') + '</div></div></div></div>' +
      '<div class="card mt"><div class="card-head"><div><h3>Identitas & Teks</h3><p>Nama aplikasi tampil di logo sidebar, halaman login, judul tab browser, dan kop laporan.</p></div></div><div class="card-pad" style="padding-top:0"><div class="form-grid" style="grid-template-columns:1fr 1fr">' +
      this.field('app_name', 'Nama aplikasi (tulisan logo)', 40) + this.field('app_sub', 'Sub judul di bawah nama', 60) +
      this.field('org_name', 'Nama organisasi (kop laporan PDF)', 120, false) + this.field('footer', 'Teks footer', 200) +
      this.field('login_title', 'Judul halaman login', 140, true) + this.field('login_desc', 'Deskripsi halaman login', 400, true) + '</div></div></div>' +
      '<div class="card mt"><div class="card-head"><div><h3>' + ic('palette') + ' Warna</h3><p>Pilih tema siap pakai atau atur warna sendiri.</p></div></div><div class="card-pad" style="padding-top:0">' +
      '<div class="chips mb">' + THEME_PRESETS.map(function (p, i) { return '<span class="chip" data-x="preset" data-i="' + i + '"><i style="width:14px;height:14px;border-radius:4px;background:linear-gradient(135deg,' + p[2] + ' 50%,' + p[1] + ' 50%);display:inline-block"></i>' + p[0] + '</span>'; }).join('') + '</div>' +
      '<div class="form-grid">' + this.color('color_primary', 'Warna utama', 'Tombol, angka rasio, tautan, grafik') + this.color('color_sidebar', 'Warna sidebar', 'Menu samping & tema browser HP') + this.color('color_accent', 'Warna aksen', 'Bintang kategori & penanda') + '</div></div></div>' +
      '</div><div><div class="card" style="position:sticky;top:calc(var(--top) + 16px)"><div class="card-head"><div><h3>Pratinjau</h3><p>Gambaran warna & logo</p></div></div><div class="card-pad" style="padding-top:0"><div id="tmPrev">' + this.prevHtml() + '</div>' +
      '<div class="row mt" style="justify-content:flex-end"><button class="btn btn-sm" data-x="reset">' + ic('refresh') + ' Bawaan</button><button class="btn btn-sm" data-x="cancel">Batal</button><button class="btn btn-primary" data-x="save">' + ic('save') + ' Simpan Tampilan</button></div></div></div></div></div>';
  },
  readLogo: function (el, input) {
    var f = input.files[0], self = this; input.value = '';
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) return toast('Ukuran logo maksimal 2 MB.', 'err');
    var rd = new FileReader();
    rd.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 160, w = img.naturalWidth || 160, h = img.naturalHeight || 160, sc = Math.min(1, max / Math.max(w, h));
        var cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(w * sc)); cv.height = Math.max(1, Math.round(h * sc));
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        var url = cv.toDataURL('image/png');
        if (url.length > 44000) url = cv.toDataURL('image/webp', 0.85);
        if (url.length > 44000) return toast('Logo terlalu rumit untuk disimpan. Gunakan gambar yang lebih sederhana.', 'err');
        self.draft.logo = url; self.render(el); self.preview(el); toast('Logo dimuat ke pratinjau. Klik Simpan untuk menerapkan.', 'ok');
      };
      img.onerror = function () { toast('Berkas gambar tidak bisa dibaca.', 'err'); };
      img.src = rd.result;
    };
    rd.readAsDataURL(f);
  },
  save: function (el, btn) {
    var d = this.draft, self = this;
    if (!String(d.app_name || '').trim()) return toast('Nama aplikasi wajib diisi.', 'warn');
    var payload = {}; Object.keys(THEME_DEFAULT).forEach(function (k) { payload[k] = d[k] === THEME_DEFAULT[k] ? '' : (d[k] || ''); });
    return withBtn(btn, async function () {
      var res = await api('saveTampilan', { tampilan: payload });
      if (!res.success) return toast(res.message, 'err');
      Store.set('ui', res.data); applyTheme(res.data); self.draft = Object.assign({}, UI); self.render(el);
      toast('Tampilan disimpan dan berlaku untuk semua pengguna.', 'ok');
    });
  }
});

/* ===================== LOG AUDIT ===================== */
var LOG_LABEL = {
  CATATAN_ADMIN: 'Catatan admin', CATATAN_DIUBAH: 'Ubah catatan', CATATAN_DIHAPUS: 'Hapus catatan', CATATAN_SELESAI: 'Catatan selesai', CATATAN_DIBUKA: 'Catatan dibuka lagi', CATATAN_DITANGGAPI: 'Tanggapan cabang',
  UBAH_DATA: 'Ubah data SROI', BUAT_PROYEK: 'Buat perhitungan', SALIN_PROYEK: 'Salin perhitungan', HAPUS_PROYEK: 'Hapus perhitungan',
  KIRIM: 'Kirim ke pusat', SETUJUI: 'Setujui', KEMBALIKAN: 'Kembalikan revisi', BUKA_KUNCI: 'Buka kunci',
  UNGGAH_BERKAS: 'Unggah berkas', HAPUS_BERKAS: 'Hapus berkas', GANTI_PASSWORD: 'Ganti password', RESET_PASSWORD: 'Reset password',
  BUAT_AKUN: 'Buat akun', UBAH_AKUN: 'Ubah akun', HAPUS_AKUN: 'Hapus akun', UBAH_KPI: 'Ubah KPI', UBAH_TARGET_SROI: 'Ubah target SROI', HAPUS_TARGET_SROI: 'Hapus target SROI', HAPUS_KPI: 'Hapus KPI',
  UBAH_PARAMETER: 'Ubah parameter', UBAH_UMK_BUDGET: 'Ubah UMK & budget', UBAH_TAMPILAN: 'Ubah tampilan', BERSIHKAN_LOG: 'Bersihkan log',
  TAMBAH_CABANG: 'Tambah cabang', UBAH_CABANG: 'Ubah cabang', HAPUS_CABANG: 'Hapus cabang', TAMBAH_SEKTOR: 'Tambah sektor', UBAH_SEKTOR: 'Ubah sektor', HAPUS_SEKTOR: 'Hapus sektor',
  TAMBAH_PROGRAM: 'Tambah program', UBAH_PROGRAM: 'Ubah program', HAPUS_PROGRAM: 'Hapus program', HAPUS_CABANG_TAHUN: 'Hapus UMK & budget'
};
var LOG_GROUP = { sroi: /PROYEK|DATA|KIRIM|SETUJUI|KEMBALIKAN|KUNCI|BERKAS/, akun: /PASSWORD|AKUN/, induk: /KPI|PARAMETER|UMK|CABANG|SEKTOR|PROGRAM|TAMPILAN|LOG/ };
var LOG_HIDE = ['LOGIN', 'LOGOUT', 'LOGIN_LOCKED', 'SLOW'];
registerPage('log', {
  roles: ['ADMIN'],
  init: function (el) {
    var self = this; this.f = { g: '', q: '' };
    el.innerHTML = '<div class="card"><div class="card-head"><div><h3>Log Audit</h3><p>Hanya mencatat perubahan data penting oleh admin maupun cabang: ubah/hapus data SROI, kirim & persetujuan, berkas, password, akun, dan data induk. Login/logout tidak dicatat. Log disimpan maks. 3.000 catatan terbaru.</p></div>' +
      '<div class="row"><div class="search"><span data-icon="search"></span><input class="inp" id="lgQ" placeholder="Cari pengguna/detail…" style="width:200px"></div><select class="inp" id="lgG" style="width:auto"><option value="">Semua jenis</option><option value="sroi">Data SROI</option><option value="akun">Akun & password</option><option value="induk">Data induk & tampilan</option></select>' +
      '<button class="btn btn-sm" id="lgRef">' + ic('refresh') + ' Muat ulang</button><button class="btn btn-sm btn-danger" id="lgClean" title="Hapus catatan login/logout dari versi lama">' + ic('trash') + ' Bersihkan log lama</button></div></div>' +
      '<div class="tbl-wrap" style="max-height:70vh"><table class="tbl compact" id="lgTbl"><tbody><tr><td><div class="skel" style="height:200px"></div></td></tr></tbody></table></div></div>';
    hydrateIcons(el);
    $('#lgRef', el).onclick = function () { self.load(el, true); };
    $('#lgG', el).onchange = function () { self.f.g = this.value; self.draw(el); };
    $('#lgQ', el).oninput = debounce(function () { self.f.q = this.value.toLowerCase(); self.draw(el); }, 200);
    $('#lgClean', el).onclick = async function () {
      if (!(await confirmBox('Bersihkan log lama?', 'Catatan login, logout, dan catatan teknis dari versi sebelumnya akan dihapus untuk menghemat penyimpanan. Catatan perubahan data tetap aman.', 'Bersihkan', 'btn-danger'))) return;
      var b = this; withBtn(b, async function () { var r = await api('cleanLog', {}); if (!r.success) return toast(r.message, 'err'); toast(r.message || 'Log dibersihkan.', 'ok'); self.load(el, true); });
    };
  },
  show: function (el) { setTitle('Log Audit', 'Administrasi'); this.load(el, false); },
  load: function (el, force) { var self = this; swr('log', 'getLog', {}, function (rows) { self.rows = rows; self.draw(el); }, { force: force, fresh: 30000 }); },
  draw: function (el) {
    var f = this.f;
    var userName = function (id) { var u = (App.users || []).filter(function (x) { return x.user_id === id || x.username === id; })[0]; return u ? u.nama_tampilan + (u.role === 'CABANG' ? ' (' + M.cabangName(u.cabang_id) + ')' : u.role === 'ADMIN' ? ' (Admin)' : '') : id; };
    var pName = function (id) { var p = (App.proyek || []).filter(function (x) { return x.proyek_id === id; })[0]; return p ? M.cabangName(p.cabang_id) + ' ' + p.tahun : (id ? '(sudah dihapus)' : ''); };
    var rows = (this.rows || []).filter(function (r) {
      if (LOG_HIDE.indexOf(r.aksi) > -1) return false;
      if (f.g && !LOG_GROUP[f.g].test(r.aksi)) return false;
      if (f.q && (userName(r.user_id) + ' ' + r.detail + ' ' + (LOG_LABEL[r.aksi] || r.aksi) + ' ' + pName(r.proyek_id)).toLowerCase().indexOf(f.q) < 0) return false;
      return true;
    });
    var cls = function (a) { return /SETUJUI/.test(a) ? 'st-Disetujui' : /HAPUS|KEMBALI|KUNCI|RESET/.test(a) ? 'st-Revisi' : /KIRIM|PASSWORD/.test(a) ? 'st-Dikirim' : 'st-Draft'; };
    $('#lgTbl', el).innerHTML = '<thead><tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Perhitungan</th><th>Detail</th></tr></thead><tbody>' + (rows.length ? rows.map(function (r) { return '<tr><td class="small nowrap">' + fmtDate(r.waktu) + '</td><td>' + esc(userName(r.user_id)) + '</td><td><span class="badge ' + cls(r.aksi) + '">' + esc(LOG_LABEL[r.aksi] || r.aksi) + '</span></td><td>' + esc(pName(r.proyek_id)) + '</td><td class="small">' + esc(r.detail) + '</td></tr>'; }).join('') : '<tr><td colspan="5"><div class="empty">Belum ada catatan.</div></td></tr>') + '</tbody>';
  }
});
