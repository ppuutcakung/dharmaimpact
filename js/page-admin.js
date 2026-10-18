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
    this.tab = 'cabang'; this.kpiTh = new Date().getFullYear(); this.ctTh = new Date().getFullYear();
    el.innerHTML = '<div class="tabs" id="mTabs"></div><div id="mBody"></div>';
    var self = this;
    el.addEventListener('click', function (e) {
      var t = e.target.closest('[data-tab]'); if (t) { self.tab = t.dataset.tab; self.render(el); return; }
      var a = e.target.closest('[data-m]'); if (a) self.act(el, a.dataset.m, a);
    });
    el.addEventListener('change', function (e) {
      if (e.target.id === 'kpiTh') { self.kpiTh = +e.target.value; self.kpiRows = null; self.render(el); }
      if (e.target.id === 'ctTh') { self.ctTh = +e.target.value; self.render(el); }
    });
    el.addEventListener('input', function (e) {
      var k = e.target.dataset.kpi; if (!k) return;
      var p = k.split('|'); self.kpiRows[+p[0]][p[1]] = p[1] === 'bobot' ? parseID(e.target.value) : e.target.value; self.kpiTotal(el);
    });
  },
  show: function (el) { setTitle('Data Induk & Parameter', 'Administrasi'); this.render(el); },
  render: function (el) {
    var tabs = [['cabang', 'Cabang'], ['ct', 'UMK & Budget'], ['sektor', 'Sektor'], ['program', 'Program'], ['kpi', 'KPI & Bobot'], ['param', 'Parameter Baku']];
    $('#mTabs', el).innerHTML = tabs.map(function (t) { return '<button data-tab="' + t[0] + '" class="' + (this.tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>'; }, this).join('');
    $('#mBody', el).innerHTML = this['r_' + this.tab]();
  },
  simpleTable: function (title, desc, cols, rows, addLabel, kind) {
    return '<div class="card"><div class="card-head"><div><h3>' + title + '</h3><p>' + desc + '</p></div><button class="btn btn-primary" data-m="add-' + kind + '">' + ic('plus') + ' ' + addLabel + '</button></div><div class="tbl-wrap"><table class="tbl"><thead><tr>' + cols.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '<th class="c">Status</th><th class="c">Aksi</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  },
  r_cabang: function () {
    var rows = (App.master.cabang || []).map(function (c) { return '<tr><td class="b">' + esc(c.kode) + '</td><td>' + esc(c.nama_cabang) + '</td><td>' + esc(c.lokasi) + '</td><td>' + esc(c.pic || '—') + '</td><td class="c">' + (isTrue(c.aktif) ? '<span class="badge st-Disetujui">Aktif</span>' : '<span class="badge st-Draft">Nonaktif</span>') + '</td><td class="c"><button class="btn btn-sm" data-m="edit-cabang" data-id="' + c.cabang_id + '">' + ic('edit') + ' Ubah</button></td></tr>'; }).join('');
    return this.simpleTable('Cabang', 'Data yang sudah dipakai tidak dihapus — cukup dinonaktifkan (B1).', ['Kode', 'Nama Cabang', 'Lokasi', 'PIC Koordinator'], rows, 'Tambah Cabang', 'cabang');
  },
  r_sektor: function () {
    var rows = (App.master.sektor || []).map(function (s) { return '<tr><td>' + esc(s.nama_sektor) + '</td><td class="c">' + (isTrue(s.aktif) ? '<span class="badge st-Disetujui">Aktif</span>' : '<span class="badge st-Draft">Nonaktif</span>') + '</td><td class="c"><button class="btn btn-sm" data-m="edit-sektor" data-id="' + s.sektor_id + '">' + ic('edit') + ' Ubah</button></td></tr>'; }).join('');
    return this.simpleTable('Sektor Binaan', 'Sektor dipakai untuk KPI per sektor & daftar UMKM.', ['Nama Sektor'], rows, 'Tambah Sektor', 'sektor');
  },
  r_program: function () {
    var rows = (App.master.program || []).slice().sort(function (a, b) { return N(a.urutan) - N(b.urutan); }).map(function (p) { return '<tr><td class="muted">' + esc(p.urutan) + '</td><td class="b">' + esc(p.nama_program) + '</td><td><span class="badge ' + (p.jenis === 'UTAMA' ? 'badge-info' : 'st-Draft') + '">' + esc(p.jenis) + '</span></td><td class="c">' + (isTrue(p.aktif) ? '<span class="badge st-Disetujui">Aktif</span>' : '<span class="badge st-Draft">Nonaktif</span>') + '</td><td class="c"><button class="btn btn-sm" data-m="edit-program" data-id="' + p.program_id + '">' + ic('edit') + ' Ubah</button></td></tr>'; }).join('');
    return this.simpleTable('Program', 'Kegiatan di wizard langkah 3 dikelompokkan per program.', ['Urutan', 'Nama Program', 'Jenis'], rows, 'Tambah Program', 'program');
  },
  r_ct: function () {
    var th = this.ctTh, ys = M.years(); if (ys.indexOf(th) < 0) ys.unshift(th); if (ys.indexOf(new Date().getFullYear() + 1) < 0) ys.unshift(new Date().getFullYear() + 1);
    return '<div class="card"><div class="card-head"><div><h3>UMK & Budget per Cabang per Tahun</h3><p>Wajib terisi sebelum cabang bisa membuat perhitungan tahun tersebut (B3).</p></div><select class="inp" id="ctTh" style="width:auto">' + ys.map(function (y) { return '<option' + (y === th ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select></div>' +
      '<div class="tbl-wrap"><table class="tbl edit"><thead><tr><th>Cabang</th><th class="r" style="min-width:180px">UMK (Rp/bulan)</th><th class="r" style="min-width:200px">Budget Program (Rp)</th><th class="c">Aksi</th></tr></thead><tbody>' +
      M.cabangAktif().map(function (c) { var r = M.ct(c.cabang_id, th); return '<tr><td class="b">' + esc(c.nama_cabang) + '<span class="sub">' + esc(c.lokasi || '') + '</span></td><td><input class="inp num" inputmode="decimal" id="umk_' + c.cabang_id + '" value="' + esc(numIn(r.umk, 0)) + '"></td><td><input class="inp num" inputmode="decimal" id="bud_' + c.cabang_id + '" value="' + esc(numIn(r.budget_program, 0)) + '"></td><td class="c"><button class="btn btn-sm btn-primary" data-m="save-ct" data-id="' + c.cabang_id + '">' + ic('save') + ' Simpan</button></td></tr>'; }).join('') +
      '</tbody></table></div></div>';
  },
  r_kpi: function () {
    var th = this.kpiTh, ys = M.years(); [new Date().getFullYear() + 1].forEach(function (y) { if (ys.indexOf(y) < 0) ys.unshift(y); });
    if (!this.kpiRows) this.kpiRows = M.kpi(th).map(function (k) { return { kpi_id: k.kpi_id, nama_kpi: k.nama_kpi, bobot: N(k.bobot), satuan: k.satuan }; });
    var used = (App.proyek || []).some(function (p) { return Number(p.tahun) === th; });
    return '<div class="card"><div class="card-head"><div><h3>KPI & Bobot Tahun ' + th + '</h3><p>Σ bobot wajib 100% — tombol simpan nonaktif bila belum (B2). Bobot dipakai otomatis di wizard (R8).</p></div><div class="row"><select class="inp" id="kpiTh" style="width:auto">' + ys.map(function (y) { return '<option' + (y === th ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select><button class="btn" data-m="kpi-copy">' + ic('copy') + ' Salin dari ' + (th - 1) + '</button></div></div>' +
      (used ? '<div style="padding:0 22px"><div class="banner banner-amber">' + ic('alert') + '<div><p style="margin:0">Sudah ada perhitungan tahun ' + th + '. Mengubah nama boleh; menghapus KPI akan menghapus isian target/realisasinya di perhitungan Draft saat dibuka.</p></div></div></div>' : '') +
      '<div class="tbl-wrap"><table class="tbl edit"><thead><tr><th>No</th><th style="min-width:260px">Nama KPI</th><th class="r" style="min-width:110px">Bobot (%)</th><th style="min-width:120px">Satuan</th><th></th></tr></thead><tbody>' +
      this.kpiRows.map(function (k, i) { return '<tr><td class="muted">' + (i + 1) + '</td><td><input class="inp" data-kpi="' + i + '|nama_kpi" value="' + esc(k.nama_kpi) + '"></td><td><input class="inp num" inputmode="decimal" data-kpi="' + i + '|bobot" value="' + esc(numIn(k.bobot, 2)) + '"></td><td><input class="inp" data-kpi="' + i + '|satuan" value="' + esc(k.satuan || '') + '"></td><td class="act"><button class="btn btn-icon btn-sm btn-ghost" data-m="kpi-del" data-i="' + i + '" style="color:var(--red-solid)">' + ic('trash') + '</button></td></tr>'; }).join('') +
      '</tbody><tfoot><tr><td></td><td>Total bobot</td><td class="r" id="kpiTot">—</td><td colspan="2"></td></tr></tfoot></table></div>' +
      '<div class="card-foot"><button class="btn btn-sm" data-m="kpi-add">' + ic('plus') + ' Tambah KPI</button><button class="btn btn-primary" data-m="kpi-save" id="kpiSave">' + ic('save') + ' Simpan KPI ' + th + '</button></div></div>';
  },
  kpiTotal: function (el) {
    var t = (this.kpiRows || []).reduce(function (a, k) { return a + (Number(k.bobot) || 0); }, 0), ok = Math.abs(t - 100) < 0.001;
    var c = $('#kpiTot', el); if (c) { c.textContent = fmtNum(t, 2) + '%'; c.style.color = ok ? '#15803D' : '#DC2626'; }
    var b = $('#kpiSave', el); if (b) b.disabled = !ok || !this.kpiRows.length;
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
            self.after(); self.render(el); toast(F.title + ' tersimpan.', 'ok');
          }
        }]
      });
    }
    if (m === 'save-ct') {
      var cid = btn.dataset.id, umk = parseID($('#umk_' + cid, el).value), bud = parseID($('#bud_' + cid, el).value);
      return withBtn(btn, async function () {
        var res = await api('saveCabangTahun', { row: { cabang_id: cid, tahun: self.ctTh, umk: umk || 0, budget_program: bud || 0 } });
        if (!res.success) return toast(res.message, 'err');
        var lst = App.master.cabang_tahun, r = lst.filter(function (x) { return String(x.cabang_id) === String(cid) && Number(x.tahun) === self.ctTh; })[0];
        if (r) { r.umk = umk || 0; r.budget_program = bud || 0; } else lst.push({ cabang_id: cid, tahun: self.ctTh, umk: umk || 0, budget_program: bud || 0 });
        self.after(); toast('UMK & budget ' + M.cabangName(cid) + ' ' + self.ctTh + ' tersimpan.', 'ok');
      });
    }
    if (m === 'kpi-add') { this.kpiRows.push({ kpi_id: '', nama_kpi: '', bobot: 0, satuan: 'UMKM' }); return this.render(el); }
    if (m === 'kpi-del') { this.kpiRows.splice(+btn.dataset.i, 1); return this.render(el); }
    if (m === 'kpi-copy') {
      var src = M.kpi(this.kpiTh - 1); if (!src.length) return toast('KPI tahun ' + (this.kpiTh - 1) + ' tidak ada.', 'warn');
      this.kpiRows = src.map(function (k) { return { kpi_id: '', nama_kpi: k.nama_kpi, bobot: N(k.bobot), satuan: k.satuan }; }); toast('Disalin — periksa lalu simpan.', 'ok'); return this.render(el);
    }
    if (m === 'kpi-save') {
      if (this.kpiRows.some(function (k) { return !String(k.nama_kpi || '').trim(); })) return toast('Nama KPI tidak boleh kosong.', 'warn');
      return withBtn(btn, async function () {
        var res = await api('saveKpi', { tahun: self.kpiTh, rows: self.kpiRows });
        if (!res.success) return toast(res.message, 'err');
        App.master.kpi = App.master.kpi.filter(function (k) { return Number(k.tahun) !== self.kpiTh; }).concat(res.data);
        self.kpiRows = null; self.after(); self.render(el); toast('KPI ' + self.kpiTh + ' tersimpan.', 'ok');
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
        '<td class="c nowrap"><button class="btn btn-sm" data-u="edit" data-id="' + u.user_id + '">' + ic('edit') + '</button> <button class="btn btn-sm" data-u="reset" data-id="' + u.user_id + '" title="Reset password">' + ic('key') + '</button></td></tr>'; }).join('') + '</tbody>';
  },
  act: function (el, a, id) {
    var self = this;
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

/* ===================== LOG AUDIT ===================== */
registerPage('log', {
  roles: ['ADMIN'],
  init: function (el) { el.innerHTML = '<div class="card"><div class="card-head"><div><h3>Log Audit</h3><p>300 aktivitas terakhir: kirim, setujui, kembalikan, buka kunci, ubah parameter, akun, login.</p></div><button class="btn btn-sm" id="lgRef">' + ic('refresh') + ' Muat ulang</button></div><div class="tbl-wrap" style="max-height:70vh"><table class="tbl compact" id="lgTbl"><tbody><tr><td><div class="skel" style="height:200px"></div></td></tr></tbody></table></div></div>'; var self = this; $('#lgRef', el).onclick = function () { self.load(el, true); }; },
  show: function (el) { setTitle('Log Audit', 'Administrasi'); this.load(el, false); },
  load: function (el, force) {
    var userName = function (id) { var u = (App.users || []).filter(function (x) { return x.user_id === id || x.username === id; })[0]; return u ? u.nama_tampilan : id; };
    var pName = function (id) { var p = (App.proyek || []).filter(function (x) { return x.proyek_id === id; })[0]; return p ? M.cabangName(p.cabang_id) + ' ' + p.tahun : (id || ''); };
    swr('log', 'getLog', {}, function (rows) {
      $('#lgTbl', el).innerHTML = '<thead><tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Perhitungan</th><th>Detail</th></tr></thead><tbody>' + (rows.length ? rows.map(function (r) { return '<tr><td class="small nowrap">' + fmtDate(r.waktu) + '</td><td>' + esc(userName(r.user_id)) + '</td><td><span class="badge ' + (/SETUJUI/.test(r.aksi) ? 'st-Disetujui' : /KEMBALI|KUNCI|LOCK/.test(r.aksi) ? 'st-Revisi' : /KIRIM/.test(r.aksi) ? 'st-Dikirim' : 'st-Draft') + '">' + esc(r.aksi) + '</span></td><td>' + esc(pName(r.proyek_id)) + '</td><td class="small">' + esc(r.detail) + '</td></tr>'; }).join('') : '<tr><td colspan="5"><div class="empty">Belum ada log.</div></td></tr>') + '</tbody>';
    }, { force: force, fresh: 30000 });
  }
});
