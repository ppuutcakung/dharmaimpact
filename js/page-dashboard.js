/* =====================================================================
 * Dashboard Akumulasi (Admin/Stakeholder) & Dashboard Cabang
 * Semua agregasi dihitung di browser dari ringkasan proyek (instan).
 * ===================================================================== */
var Agg = {
  sebaran: function (list) {
    var m = {};
    list.forEach(function (p) {
      var arr = []; try { arr = JSON.parse(p.hasil_sebaran || '[]'); } catch (e) { }
      arr.forEach(function (s) { var k = String(s.n || '—').trim(); m[k] = (m[k] || 0) + (Number(s.v) || 0); });
    });
    var segs = Object.keys(m).map(function (k) { return { label: k, value: m[k] }; }).sort(function (a, b) { return b.value - a.value; });
    if (segs.length > 6) { var rest = segs.slice(5).reduce(function (a, s) { return a + s.value; }, 0); segs = segs.slice(0, 5).concat([{ label: 'Lainnya', value: rest }]); }
    return segs;
  },
  weighted: function (list) {
    var imp = 0, inv = 0, nominalInv = 0, nominalImp = 0, umkm = 0;
    list.forEach(function (p) { imp += N(p.hasil_pv_impact); inv += N(p.hasil_pv_investasi); nominalInv += N(p.hasil_total_investasi); nominalImp += N(p.hasil_total_impact); umkm += N(p.hasil_umkm); });
    return { pvImpact: imp, pvInvestasi: inv, totalInvestasi: nominalInv, totalImpact: nominalImp, umkm: umkm, ratio: inv > 0 ? imp / inv : 0 };
  },
  trend: function (list, tgtFn) {
    var by = {};
    list.filter(function (p) { return p.status === 'Disetujui'; }).forEach(function (p) { (by[p.tahun] = by[p.tahun] || []).push(p); });
    return Object.keys(by).sort().map(function (y) { return { x: String(y), y: Agg.weighted(by[y]).ratio, t: tgtFn ? tgtFn(+y) : 0 }; });
  },
  bintangOf: function (r) { return SroiEngine.bintang(r, SroiEngine.parseParams(M.params(new Date().getFullYear())).batas); }
};
function proyekRatio(p) { var r = N(p.hasil_rasio); return r; }
/** Blok target SROI di kartu KPI: target, capaian %, bilah progres. */
function tgtHtml(ratio, target, has, label) {
  if (!target) return '<div class="tgt none">' + ic('target') + '<span>' + esc(label || 'Target') + ' belum ditetapkan</span></div>';
  var pc = has ? ratio / target : 0, okT = has && ratio >= target;
  return '<div class="tgt ' + (has ? (okT ? 'ok' : 'no') : '') + '"><div class="row between"><span class="row" style="gap:5px">' + ic('target') + esc(label || 'Target') + ' <b>' + ratioFmt(target) + '</b></span><span class="b">' + (has ? (okT ? '✓ Tercapai ' : '') + pctFmt(pc, 0) : 'Belum ada hasil') + '</span></div><div class="progress"><i style="width:' + Math.min(100, pc * 100) + '%"></i></div></div>';
}
/** Keterangan analisa singkat di bawah grafik tren. */
function trendNote(tr, lbl, tLbl) {
  if (!tr.length) return '';
  var last = tr[tr.length - 1], prev = tr[tr.length - 2], out = [];
  out.push('<b>' + esc(lbl) + ' ' + esc(last.x) + ': ' + ratioFmt(last.y) + '</b>');
  if (last.t) out.push(last.y >= last.t ? '<span class="ok">✓ ' + pctFmt(last.y / last.t, 0) + ' dari ' + esc(tLbl) + ' ' + fmtNum(last.t, 2) + ' (tercapai)</span>' : '<span class="warn">' + pctFmt(last.y / last.t, 0) + ' dari ' + esc(tLbl) + ' ' + fmtNum(last.t, 2) + '</span>');
  else out.push('<span class="muted">' + esc(tLbl.charAt(0).toUpperCase() + tLbl.slice(1)) + ' belum ditetapkan</span>');
  if (prev) { var dd = last.y - prev.y; out.push('<span class="' + (dd >= 0 ? 'ok' : 'warn') + '">' + (dd >= 0 ? '▲ naik ' : '▼ turun ') + fmtNum(Math.abs(dd), 2) + ' dari ' + esc(prev.x) + '</span>'); }
  out.push(last.y >= 1 ? 'Setiap Rp1 investasi menghasilkan ±Rp' + fmtNum(last.y, 2) + ' manfaat sosial.' : '<span class="warn">Masih di bawah titik impas 1,00.</span>');
  return out.join(' <i>•</i> ');
}
/** Keterangan analisa umum (akumulasi) di bawah grafik SROI per cabang — tidak menyebut cabang tertentu. */
function barNote(rows, o) {
  o = o || {};
  if (!rows.length) return '';
  var vals = rows.map(function (r) { return r.value; }), withT = rows.filter(function (r) { return r.target; });
  var hit = withT.filter(function (r) { return r.value >= r.target; }).length, ok1 = rows.filter(function (r) { return r.value >= 1; }).length;
  var out = ['<b>' + rows.length + (o.aktif ? ' dari ' + o.aktif : '') + ' cabang</b> sudah disetujui'];
  if (o.avg != null) out.push('Rata-rata tertimbang <b>' + ratioFmt(o.avg) + '</b>');
  if (rows.length > 1) out.push('Rentang rasio ' + fmtNum(Math.min.apply(null, vals), 2) + ' – ' + fmtNum(Math.max.apply(null, vals), 2));
  out.push('<span class="' + (ok1 === rows.length ? 'ok' : 'warn') + '">' + ok1 + ' dari ' + rows.length + ' cabang di atas titik impas</span>');
  if (withT.length) out.push('<span class="' + (hit === withT.length ? 'ok' : 'warn') + '">' + hit + ' dari ' + withT.length + ' cabang mencapai target</span>');
  else out.push('<span class="muted">Target cabang belum ditetapkan</span>');
  return out.join(' <i>•</i> ');
}
function tgtCell(ratio, target, has) {
  if (!target) return '<span class="muted">—</span>';
  return '<span class="tnum">' + fmtNum(target, 2) + '</span>' + (has ? (ratio >= target ? ' <span class="tchip ok" title="Target tercapai">✓</span>' : ' <span class="tchip no" title="Capaian terhadap target">' + pctFmt(ratio / target, 0) + '</span>') : '');
}

/* ===================== DASHBOARD AKUMULASI ===================== */
registerPage('dashboard', {
  roles: ['ADMIN', 'STAKEHOLDER'],
  init: function (el) {
    var f = Store.get(userKey('f:dash'), {});
    this.f = { tahun: f.tahun || 0, sektor: f.sektor || '', tab: 'all', q: '' };
    el.innerHTML =
      '<div class="card card-pad mb row" style="padding:14px 18px">' + ic('sliders') + '<span class="muted small b">Filter Data:</span>' +
      '<select class="inp" id="dTahun" style="width:auto;min-width:130px"></select>' +
      '<select class="inp" id="dSektor" style="width:auto;min-width:200px"></select>' +
      '<span class="grow"></span><button class="btn" id="dRekap">' + ic('download') + ' Ekspor Rekap (XLSX / PDF)</button></div>' +
      '<div class="grid g-5 kpis" id="dCards"></div>' +
      '<div class="grid g-21 mt"><div class="card flex-col"><div class="card-head"><div><h3 id="dBarT">SROI per Cabang</h3><p>Urutan rasio dampak tertinggi ke terendah (hanya yang Disetujui)</p></div><div class="row small"><span class="row" style="gap:6px"><i class="dot" style="color:var(--primary)"></i>Rasio aktual</span><span class="row text-red" style="gap:6px">— Titik impas (1,00)</span><span class="row" style="gap:6px;color:#B45309"><i class="tmark"></i>Target cabang</span></div></div><div class="card-pad chart-col bar-col" style="padding-top:4px"><div id="dBar"></div><div class="chart-note" id="dBarNote"></div></div></div>' +
      '<div class="card"><div class="card-head"><div><h3>Sebaran Manfaat Stakeholder</h3><p id="dDonutSub">Akumulasi nilai dampak (PV)</p></div>' + ic('pie-chart') + '</div><div class="card-pad" style="padding-top:4px" id="dDonut"></div></div></div>' +
      '<div class="card mt"><div class="card-head"><div><h3>Tren Rasio SROI Nasional vs Target</h3><p>Rata-rata tertimbang (Σ PV Impact ÷ Σ PV Investasi) per tahun • ◆ target nasional</p></div></div><div class="card-pad" style="padding-top:0"><div class="chart-box" id="dLine" style="height:260px"></div><div class="chart-note" id="dLineNote"></div></div></div>' +
      '<div class="card mt"><div class="card-head"><div><h3>Ringkasan Kinerja per Cabang</h3><p>Investasi & manfaat seluruh cabang aktif pada tahun terpilih</p></div>' +
      '<div class="row"><div class="search"><span data-icon="search"></span><input class="inp" id="dQ" placeholder="Cari cabang atau PIC…" style="width:220px"></div><div class="seg" id="dTabs"></div></div></div>' +
      '<div class="tbl-wrap"><table class="tbl" id="dTbl"></table></div><div class="card-foot" id="dFoot"></div></div>';
    hydrateIcons(el);
    var self = this;
    $('#dTahun', el).onchange = function () { self.f.tahun = +this.value; self.saveF(); self.render(el); };
    $('#dSektor', el).onchange = function () { self.f.sektor = this.value; self.saveF(); self.render(el); };
    $('#dQ', el).oninput = debounce(function () { self.f.q = this.value.toLowerCase(); self.renderTable(el); }, 200);
    $('#dRekap', el).onclick = function () { go('laporan'); };
    $('#dTabs', el).onclick = function (e) { var b = e.target.closest('button'); if (!b) return; self.f.tab = b.dataset.t; self.renderTable(el); };
    $('#dTbl', el).onclick = function (e) { var a = e.target.closest('[data-open]'); if (a) go('wizard', a.dataset.open); var c = e.target.closest('[data-cab]'); if (c) go('cabang', c.dataset.cab); };
  },
  saveF: function () { Store.set(userKey('f:dash'), { tahun: this.f.tahun, sektor: this.f.sektor }); },
  show: function (el) {
    setTitle('Dashboard Akumulasi Nasional', 'Konsolidasi ' + M.cabangAktif().length + ' Cabang');
    var ys = M.years();
    if (!this.f.tahun || ys.indexOf(this.f.tahun) < 0) {
      var withData = (App.proyek || []).filter(function (p) { return p.status === 'Disetujui'; }).map(function (p) { return Number(p.tahun); });
      this.f.tahun = withData.length ? Math.max.apply(null, withData) : ys[0];
    }
    $('#dTahun', el).innerHTML = ys.map(function (y) { return '<option value="' + y + '">Tahun: ' + y + '</option>'; }).join('');
    $('#dTahun', el).value = this.f.tahun;
    $('#dSektor', el).innerHTML = '<option value="">Sektor: Semua Sektor</option>' + M.sektorAktif().map(function (s) { return '<option value="' + s.sektor_id + '">Sektor: ' + esc(s.nama_sektor) + '</option>'; }).join('');
    $('#dSektor', el).value = this.f.sektor;
    this.render(el);
  },
  data: function () {
    var f = this.f;
    var list = (App.proyek || []).filter(function (p) { return !f.sektor || String(p.hasil_sektor || '').split(',').indexOf(f.sektor) > -1; });
    return { all: list, year: list.filter(function (p) { return Number(p.tahun) === f.tahun; }) };
  },
  render: function (el) {
    var d = this.data(), ok = d.year.filter(function (p) { return p.status === 'Disetujui'; }), w = Agg.weighted(ok);
    var prevOk = d.all.filter(function (p) { return Number(p.tahun) === this.f.tahun - 1 && p.status === 'Disetujui'; }, this), wp = Agg.weighted(prevOk);
    var cab = M.cabangAktif(), bin = Agg.bintangOf(w.ratio);
    var delta = prevOk.length && wp.ratio ? w.ratio - wp.ratio : null, waiting = d.year.filter(function (p) { return p.status === 'Dikirim'; }).length;
    var growth = prevOk.length && wp.pvImpact ? (w.pvImpact - wp.pvImpact) / wp.pvImpact : null;
    $('#dCards', el).innerHTML =
      '<div class="card kpi hl"><div class="lbl">Rata-rata SROI Nasional ' + ic('trending-up') + '</div><div class="val big">' + (ok.length ? ratioFmt(w.ratio) : '—') + '</div>' + tgtHtml(w.ratio, M.targetNasional(this.f.tahun), ok.length > 0, 'Target nasional') + '<div class="foot"><span>Tertimbang dari ' + ok.length + ' cabang</span>' + (delta == null ? '' : '<span class="trend ' + (delta < 0 ? 'down' : delta === 0 ? 'flat' : '') + '">' + (delta >= 0 ? '+' : '') + fmtNum(delta, 2) + ' vs ' + (this.f.tahun - 1) + '</span>') + '</div></div>' +
      '<div class="card kpi"><div class="lbl">Kategori Dampak ' + ic('star') + '</div><div class="val">' + (ok.length ? 'Bintang ' + bin : '—') + '</div><div>' + (ok.length ? starsHtml(bin, 'md') : '') + '</div><div class="foot"><span>' + esc(ok.length ? SroiEngine.LABEL_BINTANG[bin] : 'Belum ada data disetujui') + '</span></div></div>' +
      '<div class="card kpi"><div class="lbl">Total Investasi (PV) ' + ic('wallet') + '</div><div class="val">' + rp(w.pvInvestasi) + '</div><div class="foot"><span>Nominal ' + rpShort(w.totalInvestasi) + '</span><span class="text-primary b">Akumulasi</span></div></div>' +
      '<div class="card kpi"><div class="lbl">Total Nilai Manfaat (PV) ' + ic('hand-coins') + '</div><div class="val green">' + rp(w.pvImpact) + '</div><div class="foot">' + (growth == null ? '<span>Dari ' + fmtNum(w.umkm) + ' UMKM binaan</span>' : '<span class="trend ' + (growth < 0 ? 'down' : '') + '">' + (growth >= 0 ? '+' : '') + pctFmt(growth) + ' YoY</span><span>' + fmtNum(w.umkm) + ' UMKM</span>') + '</div></div>' +
      '<div class="card kpi"><div class="lbl">Status Persetujuan ' + ic('clipboard-check') + '</div><div class="val">' + ok.length + ' / ' + cab.length + '<span class="small muted" style="font-family:var(--f-body);font-weight:600;margin-left:8px">' + pctFmt(cab.length ? ok.length / cab.length : 0, 0) + '</span></div><div class="progress"><i style="width:' + (cab.length ? ok.length / cab.length * 100 : 0) + '%"></i></div><div class="foot"><span>' + waiting + ' cabang menunggu validasi</span>' + (waiting ? '<i class="dot" style="color:#E8A317"></i>' : '') + '</div></div>';

    $('#dBarT', el).textContent = 'SROI per Cabang (Tahun ' + this.f.tahun + ')';
    var thY = this.f.tahun;
    var rows = ok.map(function (p) { var r = proyekRatio(p), t = M.targetCabang(thY, p.cabang_id); return { label: M.cabangName(p.cabang_id), value: r, target: t, color: r < 1 ? '#DC2626' : tp(), note: r < 1 ? '(Defisit)' : (t && r >= t ? '✓' : '') }; }).sort(function (a, b) { return b.value - a.value; });
    ChartFit.mount($('#dBar', el), function (w) { return Charts.barH(rows, { ref: 1, refLabel: 'Titik impas (1,00)', fmt: function (v) { return fmtNum(v, 2); }, pw: w }); });
    $('#dBarNote', el).innerHTML = barNote(rows, { aktif: cab.length, avg: ok.length ? w.ratio : null });
    var segs = Agg.sebaran(ok);
    var tot = segs.reduce(function (a, s) { return a + s.value; }, 0);
    $('#dDonutSub', el).textContent = 'Alokasi nilai dampak bersih dari ' + rpShort(tot);
    $('#dDonut', el).innerHTML = '<div class="donut-wrap">' + Charts.donut(segs, { title: 'Total Manfaat', value: rpShort(tot) }) + Charts.legend(segs) + '</div>';
    var tr = Agg.trend(d.all, M.targetNasional), hasT = tr.some(function (p) { return p.t; });
    ChartFit.mount($('#dLine', el), function (w, h) { return Charts.line(tr, hasT ? { target: 1, targetLabel: 'Titik impas 1,00', pw: w, ph: h } : { target: 1.5, targetLabel: 'Batas bintang 3 (>1,5) • target nasional belum ditetapkan', pw: w, ph: h }); });
    $('#dLineNote', el).innerHTML = trendNote(tr, 'Rasio nasional', 'target nasional');
    this.renderTable(el);
  },
  renderTable: function (el) {
    var f = this.f, d = this.data();
    var byCab = {}; d.year.forEach(function (p) { byCab[p.cabang_id] = p; });
    var rows = M.cabangAktif().map(function (c) { return { c: c, p: byCab[c.cabang_id] || null }; });
    var cnt = { all: rows.length, ok: 0, rev: 0 };
    rows.forEach(function (r) { var s = r.p ? r.p.status : ''; if (s === 'Disetujui') cnt.ok++; else if (s === 'Dikirim' || s === 'Perlu Revisi') cnt.rev++; });
    $('#dTabs', el).innerHTML = [['all', 'Semua (' + cnt.all + ')'], ['ok', 'Disetujui (' + cnt.ok + ')'], ['rev', 'Review (' + cnt.rev + ')']].map(function (t) { return '<button data-t="' + t[0] + '" class="' + (f.tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>'; }).join('');
    rows = rows.filter(function (r) {
      var s = r.p ? r.p.status : '';
      if (f.tab === 'ok' && s !== 'Disetujui') return false;
      if (f.tab === 'rev' && s !== 'Dikirim' && s !== 'Perlu Revisi') return false;
      if (f.q && (r.c.nama_cabang + ' ' + (r.c.pic || '') + ' ' + r.c.kode).toLowerCase().indexOf(f.q) < 0) return false;
      return true;
    }).sort(function (a, b) { return (b.p ? proyekRatio(b.p) : -1) - (a.p ? proyekRatio(a.p) : -1); });
    var okList = rows.filter(function (r) { return r.p && r.p.status === 'Disetujui'; }).map(function (r) { return r.p; }), w = Agg.weighted(okList);
    var dotCol = { Disetujui: '#16A34A', Dikirim: '#E8A317', 'Perlu Revisi': '#DC2626', Draft: '#94A3B8' };
    var canOpen = function (p) { return p && (App.me.role === 'ADMIN' || p.status === 'Disetujui'); };
    $('#dTbl', el).innerHTML = '<thead><tr><th>Cabang</th><th class="hide-sm">PIC Koordinator</th><th class="r">UMKM</th><th class="r">Investasi PV (Rp)</th><th class="r">Nilai Manfaat PV (Rp)</th><th class="r">Rasio SROI</th><th class="r">Target</th><th>Bintang</th><th class="c">Status</th><th class="c">Aksi</th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (r) {
        var p = r.p, rr = p ? proyekRatio(p) : 0, has = p && N(p.hasil_pv_investasi) > 0;
        return '<tr><td><span class="row" style="gap:8px"><i class="dot" style="color:' + (p ? dotCol[p.status] : '#CBD5E1') + '"></i><a class="link" data-cab="' + r.c.cabang_id + '">' + esc(r.c.nama_cabang) + '</a></span></td>' +
          '<td class="hide-sm">' + esc(r.c.pic || '—') + '</td><td class="r tnum">' + (p ? fmtNum(p.hasil_umkm) : '—') + '</td>' +
          '<td class="r tnum">' + (has ? fmtNum(p.hasil_pv_investasi) : '—') + '</td><td class="r tnum ' + (has && rr < 1 ? 'text-red' : 'text-green') + '">' + (has ? fmtNum(p.hasil_pv_impact) : '—') + '</td>' +
          '<td class="r tnum b ' + (has && rr < 1 ? 'text-red' : 'text-primary') + '" style="font-size:15px">' + (has ? ratioFmt(rr) : '—') + '</td><td class="r nowrap">' + tgtCell(rr, M.targetCabang(f.tahun, r.c.cabang_id), has && p.status === 'Disetujui') + '</td><td>' + (has ? starsHtml(p.hasil_bintang, 'sm') : '—') + '</td>' +
          '<td class="c">' + badge(p ? p.status : '') + (p && p.status !== 'Disetujui' && has ? '<span class="sub tiny">sementara</span>' : '') + '</td>' +
          '<td class="c">' + (canOpen(p) ? '<button class="btn btn-icon btn-ghost btn-sm" data-open="' + p.proyek_id + '" title="Lihat perhitungan">' + ic('eye') + '</button>' : '—') + '</td></tr>';
      }).join('') : '<tr><td colspan="10"><div class="empty">Tidak ada cabang yang cocok dengan filter.</div></td></tr>') + '</tbody>' +
      '<tfoot><tr><td colspan="2">TOTAL KONSOLIDASI (' + okList.length + ' disetujui)</td><td class="r tnum">' + fmtNum(w.umkm) + '</td><td class="r tnum">' + rp(w.pvInvestasi) + '</td><td class="r tnum">' + rp(w.pvImpact) + '</td><td class="r tnum">' + (okList.length ? ratioFmt(w.ratio) : '—') + '</td><td class="r nowrap">' + tgtCell(w.ratio, M.targetNasional(f.tahun), okList.length > 0) + '</td><td>' + (okList.length ? starsHtml(Agg.bintangOf(w.ratio), 'sm') : '') + '</td><td colspan="2"></td></tr></tfoot>';
    $('#dFoot', el).innerHTML = '<span>Menampilkan <b>' + rows.length + '</b> dari ' + M.cabangAktif().length + ' cabang aktif • Akumulasi hanya menghitung status <b>Disetujui</b></span><span class="text-green b">' + ic('check-circle') + ' Rumus terkunci SroiEngine v' + SroiEngine.VERSION + '</span>';
  }
});

/* ===================== DASHBOARD CABANG ===================== */
registerPage('cabang', {
  init: function (el) {
    el.innerHTML = '<div id="cbBody"></div>';
    var self = this;
    el.addEventListener('click', function (e) {
      var t = e.target.closest('[data-act]'); if (!t) return;
      var a = t.dataset.act;
      if (a === 'open') go('wizard', t.dataset.id);
      if (a === 'new') ProyekUI.openNew(self.cid);
      if (a === 'pdf') Exporter.proyekPdf(t.dataset.id, t);
    });
    el.addEventListener('change', function (e) { if (e.target.id === 'cbSel') go('cabang', e.target.value); });
  },
  show: function (el, param) {
    var me = App.me;
    var cid = me.role === 'CABANG' ? me.cabangId : (param || Store.get(userKey('lastCab'), '') || (M.cabangAktif()[0] || {}).cabang_id);
    this.cid = cid;
    if (me.role !== 'CABANG') Store.set(userKey('lastCab'), cid);
    var cb = M.cabang(cid);
    setTitle('Dashboard SROI Cabang ' + (cb.nama_cabang || ''), 'Dashboard Cabang', cb.nama_cabang ? ' <span class="chip-role" style="display:inline-flex"><i class="dot"></i>' + esc(cb.kode || '') + '</span>' : '');
    this.render(el, cid);
  },
  render: function (el, cid) {
    var me = App.me, cb = M.cabang(cid);
    var list = (App.proyek || []).filter(function (p) { return String(p.cabang_id) === String(cid); }).sort(function (a, b) { return b.tahun - a.tahun; });
    if (me.role === 'STAKEHOLDER') list = list.filter(function (p) { return p.status === 'Disetujui'; });
    var cur = list[0] || null, yNow = new Date().getFullYear();
    var prevOk = list.filter(function (p) { return cur && p.tahun < cur.tahun && p.status === 'Disetujui'; })[0];
    var canEdit = me.role === 'CABANG';   // admin & stakeholder hanya melihat
    var sel = me.role !== 'CABANG' ? '<div class="card card-pad mb row" style="padding:12px 18px">' + ic('building') + '<span class="small muted b">Pilih cabang:</span><select class="inp" id="cbSel" style="width:auto;min-width:220px">' + M.cabangAktif().map(function (c) { return '<option value="' + c.cabang_id + '"' + (String(c.cabang_id) === String(cid) ? ' selected' : '') + '>' + esc(c.nama_cabang) + '</option>'; }).join('') + '</select></div>' : '';
    if (!cur) {
      $('#cbBody', el).innerHTML = sel + '<div class="card"><div class="empty" style="padding:56px 20px">' + ic('calculator') + '<h3 style="margin:6px 0">Belum ada perhitungan SROI</h3><p class="muted">Cabang ' + esc(cb.nama_cabang || '') + ' belum memiliki perhitungan.</p>' + (canEdit ? '<button class="btn btn-primary mt-s" data-act="new">' + ic('plus') + ' Buat Perhitungan Tahun ' + yNow + '</button>' : '') + '</div></div>';
      return;
    }
    var r = proyekRatio(cur), has = N(cur.hasil_pv_investasi) > 0;
    var delta = prevOk && has ? r - proyekRatio(prevOk) : null;
    var segs = []; try { segs = JSON.parse(cur.hasil_sebaran || '[]').map(function (s) { return { label: s.n, value: Number(s.v) || 0 }; }); } catch (e) { }
    var tot = segs.reduce(function (a, s) { return a + s.value; }, 0);
    var ct = M.ct(cid, cur.tahun), budget = N(ct.budget_program);
    var bin = Number(cur.hasil_bintang) || 0;
    var stInfo = {
      Draft: ['banner-blue', 'Perhitungan masih Draft', 'Lengkapi 8 langkah wizard lalu kirim ke pusat untuk diverifikasi.'],
      'Perlu Revisi': ['banner-red', 'Perlu Revisi dari Pusat', 'Catatan: ' + (cur.catatan_revisi || '—')],
      Dikirim: ['banner-amber', 'Dikirim — menunggu verifikasi pusat', 'Dikirim ' + fmtDate(cur.dikirim_at) + '. Data terkunci sampai Super Admin memutuskan.'],
      Disetujui: ['banner-green', 'Disetujui & terkunci', 'Disetujui ' + fmtDate(cur.disetujui_at) + ' oleh ' + (cur.disetujui_oleh || 'Super Admin') + '. Hasil masuk dashboard akumulasi.']
    }[cur.status] || ['banner-blue', cur.status, ''];
    var flowIdx = cur.status === 'Disetujui' ? 2 : cur.status === 'Dikirim' ? 1 : 0;
    var trend = Agg.trend(list, function (y) { return M.targetCabang(y, cid); }), tgtCur = M.targetCabang(cur.tahun, cid);
    $('#cbBody', el).innerHTML = sel +
      '<div class="banner ' + stInfo[0] + '">' + ic(cur.status === 'Disetujui' ? 'check-circle' : cur.status === 'Perlu Revisi' ? 'alert' : 'clock') + '<div><b>Status Tahun ' + cur.tahun + ': ' + esc(stInfo[1]) + '</b><p>' + esc(stInfo[2]) + '</p></div><div class="act">' +
      (canEdit && (cur.status === 'Draft' || cur.status === 'Perlu Revisi') ? '<button class="btn btn-primary btn-sm" data-act="open" data-id="' + cur.proyek_id + '">' + ic('edit') + ' Lanjutkan Wizard</button>' : '<button class="btn btn-sm" data-act="open" data-id="' + cur.proyek_id + '">' + ic('eye') + ' Lihat Perhitungan</button>') +
      (canEdit && cur.tahun < yNow && !list.some(function (p) { return p.tahun === yNow; }) ? '<button class="btn btn-sm" data-act="new">' + ic('plus') + ' Buat ' + yNow + '</button>' : '') + '</div></div>' +
      (N(cur.catatan_terbuka) ? '<div class="banner banner-amber">' + ic('edit') + '<div><b>' + N(cur.catatan_terbuka) + ' catatan perbaikan dari pusat ' + (me.role === 'CABANG' ? 'perlu ditindaklanjuti' : 'masih terbuka') + '</b><p>Buka perhitungan untuk melihat catatan pada tiap langkah.</p></div><div class="act"><button class="btn btn-sm" data-act="open" data-id="' + cur.proyek_id + '">Lihat catatan</button></div></div>' : '') +
      '<div class="grid g-4 kpis">' +
      '<div class="card kpi hl"><div class="lbl">Rasio SROI Cabang (' + cur.tahun + ') ' + ic('trending-up') + '</div><div class="val big">' + (has ? ratioFmt(r) : '—') + '</div>' + tgtHtml(r, tgtCur, has, 'Target ' + cur.tahun) + '<div class="foot">' + (delta == null ? '<span>' + (cur.hasil_resmi === 'Y' ? 'Hasil resmi server' : 'Hasil sementara') + '</span>' : '<span class="trend ' + (delta < 0 ? 'down' : '') + '">' + (delta >= 0 ? '+' : '') + fmtNum(delta, 2) + ' vs ' + prevOk.tahun + '</span>') + '<span>Rumus ' + esc(String(M.params(cur.tahun).rumus_rasio || 'KLASIK')) + '</span></div></div>' +
      '<div class="card kpi"><div class="lbl">Kategori Kinerja SROI ' + ic('star') + '</div><div style="margin-top:10px">' + starsHtml(bin, 'lg') + '</div><div class="foot"><span class="b" style="color:var(--text)">' + esc(SroiEngine.LABEL_BINTANG[bin] || '—') + '</span><span class="badge badge-info">Bintang ' + bin + '</span></div></div>' +
      '<div class="card kpi"><div class="lbl">Total Investasi (PV) ' + ic('wallet') + '</div><div class="val">' + rp(cur.hasil_pv_investasi) + '</div><div class="foot"><span>Budget program</span><span class="text-primary b">' + (budget ? pctFmt(N(cur.hasil_total_investasi) / budget) + ' dari ' + rpShort(budget) : '—') + '</span></div></div>' +
      '<div class="card kpi"><div class="lbl">Total Manfaat (PV) ' + ic('hand-coins') + '</div><div class="val green">' + rp(cur.hasil_pv_impact) + '</div><div class="foot"><span>' + fmtNum(cur.hasil_umkm) + ' UMKM binaan</span><span>Nominal ' + rpShort(cur.hasil_total_impact) + '</span></div></div></div>' +
      '<div class="card mt"><div class="card-head"><div><h3>Alur Pelaporan & Pengesahan SROI ' + esc(cb.nama_cabang || '') + '</h3><p>Siklus tahun ' + cur.tahun + ' • Terakhir diperbarui ' + fmtDate(cur.diubah_at) + ' oleh <b class="text-primary">' + esc(cur.diubah_oleh || '—') + '</b></p></div>' +
      '<div class="row"><button class="btn btn-sm" data-act="pdf" data-id="' + cur.proyek_id + '">' + ic('download') + ' Unduh Laporan (PDF)</button><button class="btn btn-primary btn-sm" data-act="open" data-id="' + cur.proyek_id + '">' + ic('eye') + ' Pratinjau Perhitungan</button></div></div>' +
      '<div class="card-pad" style="padding-top:0"><div class="flow"><div class="bar" style="width:' + (flowIdx * 33.3) + '%"></div>' +
      '<div class="st ' + (flowIdx > 0 ? 'done' : 'cur') + '"><i>' + ic(flowIdx > 0 ? 'check' : 'edit') + '</i><b>' + (flowIdx > 0 ? 'Draft Selesai' : cur.status) + '</b><small>' + fmtDate(cur.dibuat_at) + '</small></div>' +
      '<div class="st ' + (flowIdx > 1 ? 'done' : flowIdx === 1 ? 'cur' : '') + '"><i>' + ic('send') + '</i><b>Dikirim ke Pusat</b><small>' + (cur.dikirim_at ? fmtDate(cur.dikirim_at) : 'Belum') + '</small></div>' +
      '<div class="st ' + (flowIdx === 2 ? 'done' : flowIdx === 1 ? 'warn' : '') + '"><i>' + ic(flowIdx === 2 ? 'lock' : 'clipboard-check') + '</i><b>Verifikasi & Pengesahan</b><small>' + (flowIdx === 2 ? fmtDate(cur.disetujui_at) : flowIdx === 1 ? 'Dalam proses audit' : '—') + '</small></div></div></div></div>' +
      '<div class="grid g-21 mt"><div class="card"><div class="card-head"><div><h3>Sebaran Nilai Manfaat per Stakeholder</h3><p>Total dampak (PV): ' + rp(tot) + '</p></div><span class="badge badge-info">Tahun ' + cur.tahun + '</span></div><div class="card-pad" style="padding-top:4px"><div class="donut-wrap">' + Charts.donut(segs, { title: 'STAKEHOLDER', value: segs.length + ' Pihak' }) + Charts.legend(segs) + '</div></div></div>' +
      '<div class="card flex-col"><div class="card-head"><div><h3>Evolusi Rasio SROI Cabang vs Target</h3><p>Riwayat tahun yang Disetujui • ◆ target cabang</p></div>' + (trend.length > 1 && trend[trend.length - 1].y >= trend[trend.length - 2].y ? '<span class="trend">Tren Positif</span>' : '') + '</div><div class="card-pad chart-col"><div class="chart-box grow" id="cbLine"></div><div class="chart-note">' + trendNote(trend, 'Rasio cabang', 'target cabang') + '</div></div></div></div>' +
      '<div class="card mt"><div class="card-head"><div><h3>Riwayat Perhitungan SROI</h3><p>Semua tahun perhitungan cabang ini</p></div></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tahun</th><th>Nama Program</th><th class="r">UMKM</th><th class="r">Investasi (PV)</th><th class="r">Manfaat (PV)</th><th class="r">Rasio</th><th class="r">Target</th><th class="c">Status</th><th class="c">Aksi</th></tr></thead><tbody>' +
      list.map(function (p) {
        var hx = N(p.hasil_pv_investasi) > 0, open = me.role !== 'STAKEHOLDER' || p.status === 'Disetujui';
        return '<tr><td class="b">' + p.tahun + '</td><td>' + esc(p.nama_program) + '<span class="sub">Diubah ' + fmtDate(p.diubah_at) + '</span></td><td class="r tnum">' + fmtNum(p.hasil_umkm) + '</td><td class="r tnum">' + (hx ? rp(p.hasil_pv_investasi) : '—') + '</td><td class="r tnum text-green">' + (hx ? rp(p.hasil_pv_impact) : '—') + '</td><td class="r tnum b text-primary">' + (hx ? ratioFmt(proyekRatio(p)) : '—') + '</td><td class="r nowrap">' + tgtCell(proyekRatio(p), M.targetCabang(p.tahun, cid), hx) + '</td><td class="c">' + badge(p.status) + '</td><td class="c">' + (open ? '<button class="btn btn-icon btn-ghost btn-sm" data-act="open" data-id="' + p.proyek_id + '">' + ic('eye') + '</button>' : '—') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
    ChartFit.mount($('#cbLine', el), function (w, h) { return Charts.line(trend, { target: 1, targetLabel: 'Titik impas 1,00', pw: w, ph: h }); });
  }
});
