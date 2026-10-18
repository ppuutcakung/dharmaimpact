/* =====================================================================
 * Daftar Perhitungan SROI, Hitung Baru / Salin, Persetujuan
 * ===================================================================== */
function summaryOf(p) { var o = {}; ['proyek_id', 'cabang_id', 'tahun', 'nama_program', 'status', 'catatan_revisi', 'hasil_total_investasi', 'hasil_pv_investasi', 'hasil_total_impact', 'hasil_pv_impact', 'hasil_rasio', 'hasil_rasio_bersih', 'hasil_bintang', 'hasil_sebaran', 'hasil_error', 'hasil_sektor', 'hasil_umkm', 'hasil_resmi', 'dikirim_at', 'disetujui_at', 'disetujui_oleh', 'diubah_oleh', 'diubah_at', 'dibuat_at', 'rev'].forEach(function (k) { o[k] = p[k]; }); return o; }

var ProyekUI = {
  openNew: function (cabangId) {
    var me = App.me, yNow = new Date().getFullYear();
    var years = M.years().filter(function (y) { return y >= yNow - 3; });
    if (years.indexOf(yNow) < 0) years.unshift(yNow);
    var cabOpts = M.cabangAktif().map(function (c) { return '<option value="' + c.cabang_id + '"' + (String(c.cabang_id) === String(cabangId || me.cabangId) ? ' selected' : '') + '>' + esc(c.nama_cabang) + '</option>'; }).join('');
    var body = (me.role === 'ADMIN' ? '<div class="field mb-s"><label>Cabang</label><select class="inp" id="nCab">' + cabOpts + '</select></div>' : '') +
      '<div class="field mb-s"><label>Tahun perhitungan</label><select class="inp" id="nTh">' + years.map(function (y) { return '<option' + (y === yNow ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select></div>' +
      '<div class="field mb-s"><label>Mulai dari</label><select class="inp" id="nSrc"></select><span class="hint">Salin struktur (stakeholder, kegiatan, UMKM, outcome) tanpa angka realisasi — PRD C11.</span></div>' +
      '<div id="nInfo"></div>';
    modal({
      title: 'Hitung SROI Baru', body: body,
      onOpen: function (bg) {
        var upd = function () {
          var cid = me.role === 'ADMIN' ? bg.querySelector('#nCab').value : me.cabangId, th = +bg.querySelector('#nTh').value;
          var prev = (App.proyek || []).filter(function (p) { return String(p.cabang_id) === String(cid) && Number(p.tahun) !== th; }).sort(function (a, b) { return b.tahun - a.tahun; });
          bg.querySelector('#nSrc').innerHTML = '<option value="">Formulir kosong</option>' + prev.map(function (p) { return '<option value="' + p.proyek_id + '">Salin dari ' + p.tahun + ' — ' + esc(p.nama_program) + '</option>'; }).join('');
          var ct = M.ct(cid, th), dup = (App.proyek || []).some(function (p) { return String(p.cabang_id) === String(cid) && Number(p.tahun) === th; });
          var msg = dup ? ['banner-red', 'Perhitungan cabang ini untuk tahun ' + th + ' sudah ada.'] :
            (!N(ct.umk) || !N(ct.budget_program)) ? ['banner-amber', 'UMK & budget cabang tahun ' + th + ' belum diatur Super Admin. Perhitungan belum bisa dibuat.'] :
            !M.kpi(th).length ? ['banner-amber', 'KPI tahun ' + th + ' belum diatur di Data Induk.'] :
            ['banner-blue', 'Budget ' + rp(ct.budget_program) + ' • UMK ' + rp(ct.umk) + ' • ' + M.kpi(th).length + ' KPI'];
          bg.querySelector('#nInfo').innerHTML = '<div class="banner ' + msg[0] + '" style="margin:6px 0 0">' + ic('info') + '<div><p style="margin:0">' + esc(msg[1]) + '</p></div></div>';
          bg.querySelector('#nGo').disabled = msg[0] !== 'banner-blue';
        };
        bg.addEventListener('change', upd); upd();
      },
      actions: [{ label: 'Batal', value: null }, {
        label: ic('plus') + ' Buat Perhitungan', cls: 'btn-primary', id: 'nGo', onClick: async function (bg) {
          var cid = me.role === 'ADMIN' ? bg.querySelector('#nCab').value : me.cabangId, th = +bg.querySelector('#nTh').value, src = bg.querySelector('#nSrc').value;
          var res = src ? await api('copyProyek', { source_id: src, tahun: th }) : await api('createProyek', { cabang_id: cid, tahun: th });
          if (!res.success) { toast(res.message, 'err'); return false; }
          cacheDetail(res.data.proyek.proyek_id, res.data);
          upsertSummary(summaryOf(res.data.proyek));
          toast('Perhitungan ' + th + ' dibuat.', 'ok');
          go('wizard', res.data.proyek.proyek_id);
          return true;
        }
      }]
    });
  }
};

/* ===================== DAFTAR PERHITUNGAN ===================== */
registerPage('proyek', {
  roles: ['ADMIN', 'CABANG'],
  init: function (el) {
    this.f = { tahun: '', cabang: '', status: '' };
    el.innerHTML = '<div class="card"><div class="card-head"><div><h3>Daftar Perhitungan SROI</h3><p>Satu perhitungan = satu cabang × satu tahun</p></div><div class="row">' +
      '<select class="inp" id="pTh" style="width:auto"></select>' + (App.me.role === 'ADMIN' ? '<select class="inp" id="pCab" style="width:auto"></select>' : '') +
      '<select class="inp" id="pSt" style="width:auto"><option value="">Semua status</option><option>Draft</option><option>Dikirim</option><option>Perlu Revisi</option><option>Disetujui</option></select>' +
      '<button class="btn btn-primary" data-act="new">' + ic('plus') + ' Hitung Baru</button></div></div><div class="tbl-wrap"><table class="tbl" id="pTbl"></table></div></div>';
    var self = this;
    el.addEventListener('change', function (e) { if (e.target.id === 'pTh') self.f.tahun = e.target.value; if (e.target.id === 'pCab') self.f.cabang = e.target.value; if (e.target.id === 'pSt') self.f.status = e.target.value; self.render(el); });
    el.addEventListener('click', async function (e) {
      var t = e.target.closest('[data-act]'); if (!t) return;
      if (t.dataset.act === 'new') ProyekUI.openNew();
      if (t.dataset.act === 'open') go('wizard', t.dataset.id);
      if (t.dataset.act === 'del') {
        if (!(await confirmBox('Hapus perhitungan?', 'Perhitungan Draft beserta seluruh isinya akan dihapus permanen.', 'Hapus', 'btn-danger'))) return;
        withBtn(t, async function () {
          var res = await api('deleteProyek', { proyek_id: t.dataset.id });
          if (!res.success) return toast(res.message, 'err');
          App.proyek = App.proyek.filter(function (p) { return p.proyek_id !== t.dataset.id; }); saveBootCache(); self.render(el); toast('Perhitungan dihapus.', 'ok');
        });
      }
    });
  },
  show: function (el) {
    setTitle('Perhitungan SROI', 'Daftar Perhitungan');
    $('#pTh', el).innerHTML = '<option value="">Semua tahun</option>' + M.years().map(function (y) { return '<option>' + y + '</option>'; }).join('');
    $('#pTh', el).value = this.f.tahun;
    if ($('#pCab', el)) { $('#pCab', el).innerHTML = '<option value="">Semua cabang</option>' + M.cabangAktif().map(function (c) { return '<option value="' + c.cabang_id + '">' + esc(c.nama_cabang) + '</option>'; }).join(''); $('#pCab', el).value = this.f.cabang; }
    this.render(el);
  },
  render: function (el) {
    var f = this.f;
    var rows = (App.proyek || []).filter(function (p) { return (!f.tahun || String(p.tahun) === f.tahun) && (!f.cabang || String(p.cabang_id) === f.cabang) && (!f.status || p.status === f.status); })
      .sort(function (a, b) { return b.tahun - a.tahun || String(b.diubah_at).localeCompare(String(a.diubah_at)); });
    $('#pTbl', el).innerHTML = '<thead><tr><th>Tahun</th><th>Cabang</th><th>Nama Program</th><th class="r">Rasio</th><th>Bintang</th><th class="c">Status</th><th class="hide-sm">Diubah</th><th class="c">Aksi</th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (p) {
        var hx = N(p.hasil_pv_investasi) > 0, edit = ['Draft', 'Perlu Revisi'].indexOf(p.status) > -1;
        return '<tr><td class="b">' + p.tahun + '</td><td>' + esc(M.cabangName(p.cabang_id)) + '</td><td><a class="link" data-act="open" data-id="' + p.proyek_id + '">' + esc(p.nama_program) + '</a>' + (N(p.hasil_error) && edit ? '<span class="sub text-red">' + p.hasil_error + ' kesalahan validasi</span>' : '') + '</td>' +
          '<td class="r tnum b text-primary">' + (hx ? ratioFmt(N(p.hasil_rasio)) : '—') + '</td><td>' + (hx ? starsHtml(p.hasil_bintang, 'sm') : '—') + '</td><td class="c">' + badge(p.status) + '</td><td class="hide-sm small muted">' + fmtDate(p.diubah_at) + '<span class="sub">' + esc(p.diubah_oleh || '') + '</span></td>' +
          '<td class="c nowrap"><button class="btn btn-sm ' + (edit ? 'btn-primary' : '') + '" data-act="open" data-id="' + p.proyek_id + '">' + ic(edit ? 'edit' : 'eye') + (edit ? ' Isi' : ' Lihat') + '</button>' + (App.me.role === 'ADMIN' && p.status === 'Draft' ? ' <button class="btn btn-icon btn-sm btn-danger" data-act="del" data-id="' + p.proyek_id + '" title="Hapus">' + ic('trash') + '</button>' : '') + '</td></tr>';
      }).join('') : '<tr><td colspan="8"><div class="empty">' + ic('calculator') + '<div>Belum ada perhitungan. Klik <b>Hitung Baru</b> untuk memulai.</div></div></td></tr>') + '</tbody>';
  }
});

/* ===================== PERSETUJUAN (Super Admin) ===================== */
registerPage('persetujuan', {
  roles: ['ADMIN'],
  init: function (el) {
    this.f = { tab: 'Dikirim', tahun: '', cabang: '' };
    el.innerHTML = '<div class="card"><div class="card-head"><div><h3>Antrean Persetujuan</h3><p>Periksa perhitungan cabang, lalu setujui atau kembalikan untuk revisi.</p></div><div class="row"><select class="inp" id="aTh" style="width:auto"></select><select class="inp" id="aCab" style="width:auto"></select></div></div>' +
      '<div style="padding:0 22px"><div class="tabs" id="aTabs" style="margin-bottom:0"></div></div><div class="tbl-wrap"><table class="tbl" id="aTbl"></table></div></div>';
    var self = this;
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tab]'); if (b) { self.f.tab = b.dataset.tab; self.render(el); }
      var o = e.target.closest('[data-open]'); if (o) go('wizard', o.dataset.open + ':8');
    });
    el.addEventListener('change', function (e) { if (e.target.id === 'aTh') self.f.tahun = e.target.value; if (e.target.id === 'aCab') self.f.cabang = e.target.value; self.render(el); });
  },
  show: function (el) {
    setTitle('Persetujuan', 'Review Pipeline');
    $('#aTh', el).innerHTML = '<option value="">Semua tahun</option>' + M.years().map(function (y) { return '<option>' + y + '</option>'; }).join(''); $('#aTh', el).value = this.f.tahun;
    $('#aCab', el).innerHTML = '<option value="">Semua cabang</option>' + M.cabangAktif().map(function (c) { return '<option value="' + c.cabang_id + '">' + esc(c.nama_cabang) + '</option>'; }).join(''); $('#aCab', el).value = this.f.cabang;
    this.render(el);
    // prefetch detail perhitungan yang menunggu (1 panggilan batch saat idle)
    var ids = (App.proyek || []).filter(function (p) { return p.status === 'Dikirim' && !cachedDetail(p.proyek_id); }).slice(0, 8).map(function (p) { return p.proyek_id; });
    if (ids.length) idle(function () {
      api('batch', { calls: ids.map(function (id) { return { action: 'getProyek', key: id, data: { proyek_id: id } }; }) }).then(function (res) { if (res.success) Object.keys(res.data).forEach(function (id) { if (res.data[id].success) cacheDetail(id, res.data[id].data); }); });
    }, 800);
  },
  render: function (el) {
    var f = this.f, all = (App.proyek || []).filter(function (p) { return (!f.tahun || String(p.tahun) === f.tahun) && (!f.cabang || String(p.cabang_id) === f.cabang); });
    var cnt = function (s) { return all.filter(function (p) { return !s || p.status === s; }).length; };
    $('#aTabs', el).innerHTML = [['Dikirim', 'Menunggu'], ['Perlu Revisi', 'Perlu Revisi'], ['Disetujui', 'Disetujui'], ['Draft', 'Draft'], ['', 'Semua']].map(function (t) { return '<button data-tab="' + t[0] + '" class="' + (f.tab === t[0] ? 'on' : '') + '">' + t[1] + ' (' + cnt(t[0]) + ')</button>'; }).join('');
    var rows = all.filter(function (p) { return !f.tab || p.status === f.tab; }).sort(function (a, b) { return String(b.dikirim_at || b.diubah_at).localeCompare(String(a.dikirim_at || a.diubah_at)); });
    $('#aTbl', el).innerHTML = '<thead><tr><th>Cabang</th><th>Tahun</th><th class="r">Investasi (PV)</th><th class="r">Manfaat (PV)</th><th class="r">Rasio</th><th class="c">Status</th><th class="hide-sm">Dikirim</th><th class="c">Aksi</th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (p) {
        var hx = N(p.hasil_pv_investasi) > 0;
        return '<tr><td class="b">' + esc(M.cabangName(p.cabang_id)) + '<span class="sub">' + esc(p.nama_program) + '</span></td><td>' + p.tahun + '</td><td class="r tnum">' + (hx ? rp(p.hasil_pv_investasi) : '—') + '</td><td class="r tnum text-green">' + (hx ? rp(p.hasil_pv_impact) : '—') + '</td><td class="r tnum b text-primary">' + (hx ? ratioFmt(N(p.hasil_rasio)) : '—') + '</td><td class="c">' + badge(p.status) + '</td><td class="hide-sm small muted">' + fmtDate(p.dikirim_at) + '</td>' +
          '<td class="c"><button class="btn btn-sm ' + (p.status === 'Dikirim' ? 'btn-primary' : '') + '" data-open="' + p.proyek_id + '">' + ic('eye') + (p.status === 'Dikirim' ? ' Periksa' : ' Lihat') + '</button></td></tr>';
      }).join('') : '<tr><td colspan="8"><div class="empty">' + ic('clipboard-check') + '<div>Tidak ada perhitungan pada status ini.</div></div></td></tr>') + '</tbody>';
  }
});
