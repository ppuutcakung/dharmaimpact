/* =====================================================================
 * Ekspor PDF & Excel — dibuat di browser (SheetJS, jsPDF) — PRD §6.2
 * Pustaka dimuat hanya saat tombol ekspor ditekan (aset awal tetap ringan)
 * ===================================================================== */
var LIB = {
  xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  autotable: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  jszip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  xstd: 'js/xlsx-std.js?v=6'   // penulis Excel bergaya (kop, garis, format Rupiah, grafik)
};
async function loadXStd() { await loadScript(LIB.jszip); await loadScript(LIB.xstd); return window.XLap; }
/** Konteks hitung: proyek Disetujui memakai snapshot parameter saat persetujuan (B4) */
function ctxForProyek(p) {
  if (p.status === 'Disetujui' && p.param_snapshot) {
    try { var s = JSON.parse(p.param_snapshot); return { params: s.params, umk: s.umk, budget: s.budget, kpiMaster: s.kpi, sektor: App.master.sektor, snapshot: true }; } catch (e) { }
  }
  return M.engineCtx(p);
}
async function loadPdf() { await loadScript(LIB.jspdf); await loadScript(LIB.autotable); return window.jspdf.jsPDF; }
async function loadXlsx() { await loadScript(LIB.xlsx); return window.XLSX; }
/** Info gambar (data URL) untuk jsPDF: ukuran asli & format. */
function imgInfo(url) {
  return new Promise(function (res) {
    var im = new Image();
    im.onload = function () {
      var fmt = /^data:image\/jpe?g/.test(url) ? 'JPEG' : 'PNG', u = url;
      if (!/^data:image\/(png|jpe?g)/.test(url)) { var c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0); u = c.toDataURL('image/png'); fmt = 'PNG'; }
      res({ url: u, fmt: fmt, w: im.naturalWidth || 1, h: im.naturalHeight || 1 });
    };
    im.onerror = function () { res(null); }; im.src = url;
  });
}
/** Ubah gambar (data URL) menjadi PNG (Uint8Array) + ukuran, untuk Excel. */
function pngOf(url, max) {
  return new Promise(function (res) {
    var im = new Image();
    im.onload = function () {
      var sc = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(im.naturalWidth * sc)); c.height = Math.max(1, Math.round(im.naturalHeight * sc));
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      var b = atob(c.toDataURL('image/png').split(',')[1]), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
      res({ png: u, w: c.width, h: c.height });
    };
    im.onerror = function () { res(null); }; im.src = url;
  });
}
var PK_NAMA = { KPI_BUDGET: 'KPI×Budget', BENCHMARK: 'Benchmark', NET_PROFIT: 'Net Profit', MANFAAT_SH: 'Manfaat SH', MANUAL: 'Manual' };
function pkText(h) { return (h.komponen || []).map(function (c) { return PK_NAMA[c.jenis] || c.jenis || '-'; }).join(' + ') || '-'; }
function pkF(h, f) { return (h.komponen || []).map(function (c) { return fmtNum(c[f], 1) + '%'; }).join(' / ') || '-'; }
function pkPorsi(h) { return (h.komponen || []).map(function (c) { return fmtNum(c.porsi, 1) + '%'; }).join(' + ') || '-'; }
function fileSafe(s) { return String(s || '').replace(/[^\w\-]+/g, '_').replace(/_+/g, '_'); }
function rpPlain(v) { return 'Rp ' + Math.round(Number(v) || 0).toLocaleString('id-ID'); }

var Exporter = {
  detail: async function (id, data) {
    if (data) return data;
    var c = cachedDetail(id); if (c) return c;
    var res = await fetchDetail(id, true);
    if (!res.success) throw new Error(res.message);
    return res.data;
  },
  run: async function (btn, fn) {
    return withBtn(btn, async function () { try { await fn(); } catch (e) { console.error(e); toast('Ekspor gagal: ' + e.message, 'err'); } });
  },

  /* ---------------- G1: PDF per cabang ---------------- */
  proyekPdf: function (id, btn, data) {
    return this.run(btn, async function () {
      var d = await Exporter.detail(id, data), p = d.proyek, ctx = ctxForProyek(p), r = SroiEngine.compute(d, ctx);
      var jsPDF = await loadPdf(), doc = new jsPDF({ unit: 'mm', format: 'a4' }), W = 210, cab = M.cabang(p.cabang_id);
      var blue = hexRgb(UI.color_primary) || [0, 90, 171], dark = [26, 36, 51], muted = [91, 107, 127];
      var final = p.status === 'Disetujui';
      // kop
      doc.setFillColor.apply(doc, hexRgb(UI.color_sidebar) || [10, 61, 115]); doc.rect(0, 0, W, 30, 'F');
      doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
      doc.text('LAPORAN PERHITUNGAN SOCIAL RETURN ON INVESTMENT', 14, 13);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
      doc.text((CFG.ORG_NAME || 'DharmaImpact') + ' — Cabang ' + (cab.nama_cabang || '') + ' — Tahun ' + p.tahun, 14, 20);
      doc.text('Document No: ' + (p.doc_number || '-') + '   |   Rev. ' + (p.doc_rev || '0') + '   |   Status: ' + p.status + '   |   Dicetak: ' + new Date().toLocaleDateString('id-ID'), 14, 26);
      var y = 38;
      if (!final) {   // pita status sementara — di bawah kop, tidak menumpuk dengan judul
        doc.setFillColor(254, 226, 226); doc.rect(0, 30, W, 9, 'F');
        doc.setFillColor(220, 38, 38); doc.rect(0, 30, 3, 9, 'F');
        doc.setTextColor(185, 28, 28); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
        doc.text('DOKUMEN SEMENTARA — BELUM DISETUJUI', 14, 35.8);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.2);
        doc.text('Status: ' + p.status + '  •  Angka dapat berubah sampai disetujui kantor pusat', W - 14, 35.8, { align: 'right' });
        y = 47;
      }
      var sec = function (t) { doc.setTextColor.apply(doc, blue); doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.text(t, 14, y); y += 2; };
      var tblOpt = { theme: 'grid', styles: { fontSize: 8.6, cellPadding: 1.8, textColor: dark, lineColor: [226, 232, 240] }, headStyles: { fillColor: blue, textColor: 255, fontStyle: 'bold' }, margin: { left: 14, right: 14 } };
      sec('A. DATA PROGRAM');
      doc.autoTable(Object.assign({}, tblOpt, {
        startY: y, columnStyles: { 0: { cellWidth: 52, fontStyle: 'bold', fillColor: [248, 250, 252] } },
        body: [['Nama Program', p.nama_program], ['Nama Project', p.nama_project], ['Project Owner', p.project_owner], ['Lokasi', p.lokasi + (p.gmaps_url ? '  (' + p.gmaps_url + ')' : '')],
          ['Periode Program', (p.periode_awal || '-') + ' s.d. ' + (p.periode_akhir || '-')], ['Tanggal Pengukuran', p.tgl_pengukuran || '-'], ['Metode', p.metode],
          ['Mitra Pelaksana / PIC', (p.mitra_pelaksana || '-') + ' / ' + (p.pic_mitra || '-') + ' ' + (p.hp_pic || '')], ['Mitra Penilai / Tim Leader', (p.mitra_penilai || '-') + ' / ' + (p.tim_leader_penilai || '-') + ' ' + (p.hp_penilai || '')],
          ['Tujuan', p.tujuan], ['Aktivitas', p.aktivitas]].map(function (x) { return [x[0], x[1] == null || x[1] === '' ? '-' : String(x[1])]; })
      }));
      y = doc.lastAutoTable.finalY + 8; sec('STAKEHOLDER');
      doc.autoTable(Object.assign({}, tblOpt, { startY: y, head: [['No', 'Nama Stakeholder', 'Peran', 'Alasan Penyertaan']], body: d.stakeholder.map(function (s, i) { return [i + 1, s.nama, s.peran, s.alasan_penyertaan || '-']; }), columnStyles: { 0: { cellWidth: 10 } } }));
      y = doc.lastAutoTable.finalY + 8;
      if (y > 220) { doc.addPage(); y = 20; }
      sec('B. HASIL PERHITUNGAN');
      doc.autoTable(Object.assign({}, tblOpt, {
        startY: y, columnStyles: { 0: { cellWidth: 70, fontStyle: 'bold', fillColor: [234, 242, 251] }, 1: { halign: 'right' } },
        body: [['Total Investasi', rpPlain(r.totalInvestasi)], ['PV Investasi', rpPlain(r.pvInvestasi)], ['Total Impact', rpPlain(r.totalImpact)], ['PV Impact', rpPlain(r.pvImpact)],
          ['Rasio SROI (' + r.params.rumus + ')', fmtNum(r.rasio, 2) + ' : 1'], ['Rasio klasik / bersih', fmtNum(r.rasioKlasik, 2) + ' / ' + fmtNum(r.rasioBersih, 2)],
          ['Kategori', 'Bintang ' + r.bintang + ' (' + r.bintangLabel + ')'], ['Discount rate', fmtNum(r.params.r * 100, 2) + '%' + (ctx.snapshot ? ' (snapshot persetujuan)' : '')]]
      }));
      y = doc.lastAutoTable.finalY + 5;
      doc.autoTable(Object.assign({}, tblOpt, { startY: y, head: [['Sebaran Manfaat per Stakeholder', 'Peran', 'PV Impact', 'Porsi']], body: r.sebaran.map(function (s) { return [s.nama, s.peran, rpPlain(s.nilai), pctFmt(s.porsi)]; }), columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } } }));
      y = doc.lastAutoTable.finalY + 8;
      if (y > 230) { doc.addPage(); y = 20; }
      sec('PENJELASAN KUALITATIF'); y += 4;
      doc.setTextColor.apply(doc, dark); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      var lines = doc.splitTextToSize(p.penjelasan_kualitatif || '-', W - 28); doc.text(lines, 14, y); y += lines.length * 4.2 + 8;
      if (y > 235) { doc.addPage(); y = 20; }
      sec('C. PENGESAHAN'); y += 4;
      var bw = (W - 28 - 10) / 2;
      [['Disiapkan oleh (PIC Pelaksana)', p.pic_mitra || p.project_owner || '', p.mitra_pelaksana || ('PPU ' + (cab.nama_cabang || ''))], ['Diverifikasi oleh (Mitra Penilai)', p.tim_leader_penilai || '', p.mitra_penilai || '']].forEach(function (b, i) {
        var x = 14 + i * (bw + 10);
        doc.setDrawColor(203, 213, 225); doc.rect(x, y, bw, 36);
        doc.setFontSize(8.5); doc.setTextColor.apply(doc, muted); doc.text(b[0], x + 4, y + 6);
        doc.setTextColor.apply(doc, dark); doc.setFont('helvetica', 'bold'); doc.text(b[1] || '(.................................)', x + 4, y + 28);
        doc.setFont('helvetica', 'normal'); doc.setTextColor.apply(doc, muted); doc.text(b[2] || '', x + 4, y + 33);
      });
      // Lampiran Impact Map (landscape)
      doc.addPage('a4', 'landscape');
      doc.setTextColor.apply(doc, blue); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('LAMPIRAN — IMPACT MAP', 14, 16);
      var shName = function (id) { var s = d.stakeholder.filter(function (x) { return x.sh_id === id; })[0]; return s ? s.nama : '-'; };
      doc.autoTable(Object.assign({}, tblOpt, {
        startY: 21, styles: Object.assign({}, tblOpt.styles, { fontSize: 7.2 }),
        head: [['No', 'Stakeholder', 'Outcome', 'Indikator (sebelum → sesudah)', 'Jenis Proksi', 'Nilai Proksi', 'Porsi', 'DW', 'DS', 'AT', 'DO', 'Durasi', 'Impact Th-1', 'PV Impact']],
        body: d.outcome.map(function (o, i) { var h = r.outcome[o.outcome_id] || {}; return [i + 1, shName(o.sh_id), o.deskripsi_outcome || o.output_ringkas || '-', (o.indikator_sebelum || '-') + ' → ' + (o.indikator_sesudah || '-'), pkText(h), rpPlain(h.nilai_proksi), pkPorsi(h), pkF(h, 'dw'), pkF(h, 'ds'), pkF(h, 'at'), pkF(h, 'do'), (o.durasi_tahun || 1) + ' th', rpPlain(h.impact), rpPlain(h.pv)]; }),
        foot: [['', '', '', '', '', '', '', '', '', '', '', 'TOTAL', rpPlain(r.totalImpact), rpPlain(r.pvImpact)]],
        footStyles: { fillColor: [234, 242, 251], textColor: [0, 63, 122], fontStyle: 'bold' },
        columnStyles: { 5: { halign: 'right' }, 6: { halign: 'right' }, 12: { halign: 'right' }, 13: { halign: 'right' } }
      }));
      var n = doc.getNumberOfPages();
      for (var i = 1; i <= n; i++) {
        doc.setPage(i);
        if (!final) {   // watermark diagonal samar di setiap halaman
          var pw0 = doc.internal.pageSize.getWidth(), ph0 = doc.internal.pageSize.getHeight();
          try { if (doc.GState) doc.setGState(new doc.GState({ opacity: 0.07 })); } catch (e) { }
          doc.setTextColor(220, 38, 38); doc.setFont('helvetica', 'bold'); doc.setFontSize(96);
          var tw = doc.getTextWidth('DRAF'), rad = 35 * Math.PI / 180; doc.text('DRAF', pw0 / 2 - tw / 2 * Math.cos(rad), ph0 / 2 + tw / 2 * Math.sin(rad), { angle: 35 });
          try { if (doc.GState) doc.setGState(new doc.GState({ opacity: 1 })); } catch (e) { }
          doc.setFont('helvetica', 'normal');
        }
        doc.setFontSize(7.5); doc.setTextColor(148, 163, 184); var pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight(); doc.text('DharmaImpact • SroiEngine v' + SroiEngine.VERSION + ' • ' + (final ? 'Hasil resmi server' : 'Hasil sementara'), 14, ph - 8); doc.text('Hal. ' + i + ' / ' + n, pw - 14, ph - 8, { align: 'right' }); }
      doc.save('Laporan_SROI_' + fileSafe(cab.nama_cabang) + '_' + p.tahun + '.pdf');
      toast('PDF diunduh.', 'ok');
    });
  },

  /* ---------------- G2: Excel 6 sheet ---------------- */
  proyekXlsx: function (id, btn, data) {
    return this.run(btn, async function () {
      var d = await Exporter.detail(id, data), p = d.proyek, ctx = ctxForProyek(p), r = SroiEngine.compute(d, ctx), L = await loadXStd();
      await L.proyek({ d: d, r: r, ctx: ctx, cab: M.cabang(p.cabang_id), M: M, SroiEngine: SroiEngine, target: M.targetCabang(p.tahun, p.cabang_id),
        org: CFG.ORG_NAME || 'DharmaImpact', pkText: pkText, pkF: pkF, pkPorsi: pkPorsi, rpShort: rpShort, fileSafe: fileSafe });
      toast('Excel diunduh.', 'ok');
    });
  },

  /* ---------------- G3: Rekap semua cabang ---------------- */
  rekapRows: function (th) {
    var byCab = {}; (App.proyek || []).forEach(function (p) { if (Number(p.tahun) === th) byCab[p.cabang_id] = p; });
    return M.cabangAktif().map(function (c) { var p = byCab[c.cabang_id]; return { cabang_id: c.cabang_id, cabang: c.nama_cabang, kode: c.kode, p: p }; });
  },
  rekapXlsx: function (th, btn) {
    return this.run(btn, async function () {
      var L = await loadXStd(), rows = Exporter.rekapRows(th), ok = rows.filter(function (r) { return r.p && r.p.status === 'Disetujui'; }).map(function (r) { return r.p; });
      await L.rekap({ th: th, rows: rows, ok: ok, w: Agg.weighted(ok), M: M, Agg: Agg, target: function (cid) { return M.targetCabang(th, cid); }, targetNas: M.targetNasional(th), org: CFG.ORG_NAME || 'DharmaImpact', rpShort: rpShort });
      toast('Rekap Excel diunduh.', 'ok');
    });
  },
  rekapPdf: function (th, btn) {
    return this.run(btn, async function () {
      var jsPDF = await loadPdf(), doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
      Exporter.rekapDraw(doc, th);
      doc.save('Rekap_SROI_' + th + '.pdf'); toast('Rekap PDF diunduh.', 'ok');
    });
  },
  /** Gambar rekap seluruh cabang pada halaman landscape yang sedang aktif (dipakai juga sebagai lampiran). */
  rekapDraw: function (doc, th, judul) {
    var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    var rows = Exporter.rekapRows(th), ok = rows.filter(function (r) { return r.p && r.p.status === 'Disetujui'; }).map(function (r) { return r.p; }), w = Agg.weighted(ok);
    doc.setFillColor.apply(doc, hexRgb(UI.color_sidebar) || [10, 61, 115]); doc.rect(0, 0, W, 24, 'F'); doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text(judul || ('REKAP SROI SEMUA CABANG — TAHUN ' + th), 14, 12); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
    doc.text('Rata-rata tertimbang ' + fmtNum(w.ratio, 2) + ' : 1  •  ' + ok.length + ' dari ' + rows.length + ' cabang disetujui  •  Dicetak ' + new Date().toLocaleDateString('id-ID'), 14, 19);
    var cx = 14, cy = 32, cw = W - 28, bars = ok.slice().sort(function (a, b) { return N(b.hasil_rasio) - N(a.hasil_rasio); }), maxR = Math.max(1.2, Math.max.apply(null, bars.map(function (p) { return N(p.hasil_rasio); }).concat([0]))) * 1.1;
    doc.setTextColor(0, 90, 171); doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.text('SROI per Cabang (Disetujui)', cx, cy); cy += 4;
    var bh = Math.min(6, 60 / Math.max(1, bars.length));
    bars.forEach(function (p, i) {
      var y = cy + i * (bh + 1.6), r = N(p.hasil_rasio), len = (cw - 70) * r / maxR;
      doc.setFontSize(8); doc.setTextColor(26, 36, 51); doc.setFont('helvetica', 'normal'); doc.text(M.cabangName(p.cabang_id), cx + 38, y + bh - 1.3, { align: 'right' });
      doc.setFillColor(r < 1 ? 220 : 0, r < 1 ? 38 : 90, r < 1 ? 38 : 171); doc.rect(cx + 40, y, Math.max(0.6, len), bh, 'F');
      doc.setFont('helvetica', 'bold'); doc.text(fmtNum(r, 2), cx + 42 + len, y + bh - 1.3);
    });
    if (bars.length) { var x1 = cx + 40 + (cw - 70) / maxR; doc.setDrawColor(220, 38, 38); doc.setLineDashPattern([1, 1], 0); doc.line(x1, cy - 1, x1, cy + bars.length * (bh + 1.6)); doc.setLineDashPattern([], 0); }
    var ty = cy + bars.length * (bh + 1.6) + 6;
    var addOrig = doc.addPage;   // halaman lanjutan tabel tetap landscape walau dokumen induk portrait
    doc.addPage = function () { return addOrig.call(doc, 'a4', 'landscape'); };
    try {
      doc.autoTable({
        startY: Math.max(ty, 50), theme: 'grid', margin: { left: 14, right: 14 }, styles: { fontSize: 8.5, cellPadding: 1.8 }, headStyles: { fillColor: hexRgb(UI.color_primary) || [0, 90, 171] },
        head: [['No', 'Cabang', 'Total Investasi', 'PV Investasi', 'Total Impact', 'PV Impact', 'Rasio', 'Target', 'Bintang', 'Status', 'UMKM']],
        body: rows.map(function (r, i) { var p = r.p || {}; var has = N(p.hasil_pv_investasi) > 0, t = M.targetCabang(th, r.cabang_id); return [i + 1, r.cabang, has ? rpPlain(p.hasil_total_investasi) : '-', has ? rpPlain(p.hasil_pv_investasi) : '-', has ? rpPlain(p.hasil_total_impact) : '-', has ? rpPlain(p.hasil_pv_impact) : '-', has ? fmtNum(N(p.hasil_rasio), 2) : '-', t ? fmtNum(t, 2) : '-', has ? String(p.hasil_bintang) : '-', p.status || 'Belum Mulai', N(p.hasil_umkm) || '-']; }),
        foot: [['', 'TOTAL DISETUJUI', rpPlain(w.totalInvestasi), rpPlain(w.pvInvestasi), rpPlain(w.totalImpact), rpPlain(w.pvImpact), fmtNum(w.ratio, 2), M.targetNasional(th) ? fmtNum(M.targetNasional(th), 2) : '-', String(Agg.bintangOf(w.ratio)), ok.length + ' cabang', fmtNum(w.umkm)]],
        footStyles: { fillColor: [234, 242, 251], textColor: [0, 63, 122] },
        columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } }
      });
    } finally { doc.addPage = addOrig; }
    doc.setFontSize(7.5); doc.setTextColor(148, 163, 184); doc.text('Rata-rata tertimbang = Σ PV Impact ÷ Σ PV Investasi. Status selain Disetujui tidak dihitung pada total.', 14, H - 8);
  },

  /* ---------------- G4: Laporan manajemen (konsolidasi) + lampiran rekap ---------------- */
  /** Agregasi seluruh cabang Disetujui: stakeholder (UMKM digabung jadi satu), per peran, total. */
  mgmtAgg: function (th) {
    var rows = Exporter.rekapRows(th), ok = rows.filter(function (r) { return r.p && r.p.status === 'Disetujui'; }).map(function (r) { return r.p; }), w = Agg.weighted(ok);
    var sh = {}, tot = 0;
    ok.forEach(function (p) {
      var arr = []; try { arr = JSON.parse(p.hasil_sebaran || '[]'); } catch (e) { }
      var seen = {};
      arr.forEach(function (s) {
        var nm = String(s.n || '').trim(), umkm = /umkm/i.test(nm), key = umkm ? '__UMKM' : nm.toLowerCase().replace(/\s+/g, ' ');
        if (!key) return;
        var g = sh[key] = sh[key] || { nama: umkm ? 'UMKM Binaan' : nm, peranSet: {}, cab: {}, v: 0 };
        g.peranSet[umkm ? 'Penerima Manfaat' : (s.p || 'Lainnya')] = 1; g.cab[p.cabang_id] = 1; g.v += Number(s.v) || 0; tot += Number(s.v) || 0;
      });
    });
    var list = Object.keys(sh).map(function (k) { var g = sh[k]; return { nama: g.nama, peran: Object.keys(g.peranSet).join(', '), cabang: Object.keys(g.cab).length, v: g.v, porsi: tot ? g.v / tot : 0 }; }).sort(function (a, b) { return b.v - a.v; });
    var pm = {}; list.forEach(function (s) { var k = s.peran.split(', ')[0]; (pm[k] = pm[k] || { peran: k, n: 0, v: 0 }); pm[k].n++; pm[k].v += s.v; });
    var peran = Object.keys(pm).map(function (k) { var x = pm[k]; x.porsi = tot ? x.v / tot : 0; return x; }).sort(function (a, b) { return b.v - a.v; });
    return { rows: rows, ok: ok, w: w, stakeholder: list, peran: peran, total: tot };
  },
  /** Draf penjelasan otomatis dari angka konsolidasi. */
  mgmtDraft: function (th) {
    var A = Exporter.mgmtAgg(th), w = A.w, tn = M.targetNasional(th);
    if (!A.ok.length) return 'Belum ada laporan cabang yang disetujui untuk tahun ' + th + '.';
    var srt = A.ok.slice().sort(function (a, b) { return N(b.hasil_rasio) - N(a.hasil_rasio); });
    var t = 'Berdasarkan hasil penilaian SROI terhadap ' + A.ok.length + ' dari ' + A.rows.length + ' cabang yang telah disetujui pada tahun ' + th + ', total investasi program (nilai sekarang) sebesar ' + rpPlain(w.pvInvestasi) + ' menghasilkan nilai manfaat sosial (nilai sekarang) sebesar ' + rpPlain(w.pvImpact) + '. ';
    t += 'Rasio SROI konsolidasi mencapai ' + fmtNum(w.ratio, 2) + ' : 1, artinya setiap Rp1 yang diinvestasikan menghasilkan sekitar Rp' + fmtNum(w.ratio, 2) + ' manfaat sosial (kategori Bintang ' + Agg.bintangOf(w.ratio) + ' — ' + (SroiEngine.LABEL_BINTANG[Agg.bintangOf(w.ratio)] || '') + ').';
    if (tn) t += ' Capaian ini setara ' + pctFmt(w.ratio / tn, 0) + ' dari target nasional ' + fmtNum(tn, 2) + ' : 1' + (w.ratio >= tn ? ' (target tercapai).' : '.');
    if (srt.length > 1) t += '\n\nRasio tertinggi dicapai Cabang ' + M.cabangName(srt[0].cabang_id) + ' (' + fmtNum(N(srt[0].hasil_rasio), 2) + ') dan terendah Cabang ' + M.cabangName(srt[srt.length - 1].cabang_id) + ' (' + fmtNum(N(srt[srt.length - 1].hasil_rasio), 2) + ').';
    if (A.stakeholder.length) t += '\n\nPenerima manfaat terbesar adalah ' + A.stakeholder[0].nama + ' dengan porsi ' + pctFmt(A.stakeholder[0].porsi, 1) + ' dari total manfaat' + (A.stakeholder[1] ? ', diikuti ' + A.stakeholder[1].nama + ' (' + pctFmt(A.stakeholder[1].porsi, 1) + ')' : '') + '. Program menjangkau ' + fmtNum(w.umkm) + ' UMKM binaan.';
    return t;
  },
  mgmtPdf: function (th, lap, btn, logo) {
    return this.run(btn, async function () {
      var lgImg = logo ? await imgInfo(logo) : null;
      var jsPDF = await loadPdf(), doc = new jsPDF({ unit: 'mm', format: 'a4' }), W = 210, A = Exporter.mgmtAgg(th), w = A.w, L = lap || {}, P = L.program || {};
      var blue = hexRgb(UI.color_primary) || [0, 90, 171], dark = [26, 36, 51], muted = [91, 107, 127], final = A.ok.length === A.rows.length && A.rows.length > 0;
      // KOP: logo perusahaan (kiri) + judul yang dibatasi lebarnya — otomatis turun baris bila panjang
      var LG = 24, tx = lgImg ? 14 + LG + 6 : 14, tw = Math.min(W - 14 - tx, 132);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13.5);
      var jl = doc.splitTextToSize((P.judul || ('Laporan Konsolidasi SROI Tahun ' + th)).toUpperCase(), tw).slice(0, 3);
      // sub-judul: SATU baris, selebar judul — ukuran huruf mengecil otomatis bila panjang
      doc.setFont('helvetica', 'normal');
      var parts = [P.penyelenggara || CFG.ORG_NAME || 'DharmaImpact', 'Tahun ' + th, 'Doc. No: ' + (P.doc_number || '-'), 'Rev. ' + (P.rev || '0'), 'Tanggal: ' + (P.tgl || new Date().toLocaleDateString('id-ID'))];
      var subTxt = parts.join('  |  '), subFs = 8.8;
      doc.setFontSize(subFs);
      while (doc.getTextWidth(subTxt) > tw && subFs > 6.2) { subFs -= 0.2; doc.setFontSize(subFs); }
      if (doc.getTextWidth(subTxt) > tw) { subTxt = parts.join(' | '); while (doc.getTextWidth(subTxt) > tw && subFs > 5.4) { subFs -= 0.2; doc.setFontSize(subFs); } }
      var sub = [subTxt];
      var block = 3.6 + (jl.length - 1) * 6.2 + 7 + (sub.length - 1) * 4.4 + 1;   // tinggi isi kop (mm)
      var kopH = Math.max(lgImg ? LG + 12 : 26, block + 16);
      doc.setFillColor.apply(doc, hexRgb(UI.color_sidebar) || [10, 61, 115]); doc.rect(0, 0, W, kopH, 'F');
      if (lgImg) {
        var ly = (kopH - LG) / 2;
        doc.setFillColor(255, 255, 255); doc.roundedRect(14, ly, LG, LG, 2.5, 2.5, 'F');
        var sc = Math.min((LG - 3) / lgImg.w, (LG - 3) / lgImg.h), iw = lgImg.w * sc, ih = lgImg.h * sc;
        try { doc.addImage(lgImg.url, lgImg.fmt, 14 + (LG - iw) / 2, ly + (LG - ih) / 2, iw, ih); } catch (e) { console.warn('logo', e); }
      }
      var ty = (kopH - block) / 2 + 3.6;   // judul & sub-judul di tengah kop secara vertikal
      doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(13.5); doc.text(jl, tx, ty, { lineHeightFactor: 1.3 });
      ty += (jl.length - 1) * 6.2 + 7;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(subFs); doc.setTextColor(226, 232, 240); doc.text(subTxt, tx, ty);
      var y = kopH + 8;
      if (!final) {
        doc.setFillColor(254, 226, 226); doc.rect(0, kopH, W, 9, 'F'); doc.setFillColor(220, 38, 38); doc.rect(0, kopH, 3, 9, 'F');
        doc.setTextColor(185, 28, 28); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('LAPORAN SEMENTARA — ' + A.ok.length + ' dari ' + A.rows.length + ' cabang disetujui', 14, kopH + 5.8); y = kopH + 17;
      }
      var sec = function (t) { if (y > 262) { doc.addPage(); y = 20; } doc.setTextColor.apply(doc, blue); doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.text(t, 14, y); y += 2; };
      var tblOpt = { theme: 'grid', styles: { fontSize: 8.8, cellPadding: 1.8, textColor: dark, lineColor: [226, 232, 240] }, headStyles: { fillColor: blue, textColor: 255, fontStyle: 'bold' }, margin: { left: 14, right: 14 } };
      sec('A. DATA PROGRAM');
      doc.autoTable(Object.assign({}, tblOpt, { startY: y, columnStyles: { 0: { cellWidth: 52, fontStyle: 'bold', fillColor: [248, 250, 252] } },
        body: [['Nama Program', P.nama_program], ['Penyelenggara', P.penyelenggara || CFG.ORG_NAME], ['Periode Program', P.periode], ['Lokasi / Cakupan', P.lokasi], ['Penanggung Jawab', P.penanggung_jawab], ['Mitra Penilai', P.mitra_penilai], ['Metode Penilaian', P.metode], ['Tujuan Program', P.tujuan], ['Ruang Lingkup', P.ruang_lingkup]].map(function (x) { return [x[0], x[1] == null || x[1] === '' ? '-' : String(x[1])]; }) }));
      y = doc.lastAutoTable.finalY + 8; sec('B. RINGKASAN HASIL KONSOLIDASI');
      var tn = M.targetNasional(th);
      doc.autoTable(Object.assign({}, tblOpt, { startY: y, columnStyles: { 0: { cellWidth: 70, fontStyle: 'bold', fillColor: [248, 250, 252] }, 1: { halign: 'right' } },
        body: [['Cabang disetujui', A.ok.length + ' dari ' + A.rows.length + ' cabang'], ['Total Investasi (nominal / PV)', rpPlain(w.totalInvestasi) + ' / ' + rpPlain(w.pvInvestasi)], ['Total Manfaat (nominal / PV)', rpPlain(w.totalImpact) + ' / ' + rpPlain(w.pvImpact)],
          ['Rasio SROI konsolidasi', A.ok.length ? fmtNum(w.ratio, 2) + ' : 1' : '-'], ['Target nasional', tn ? fmtNum(tn, 2) + ' : 1' + (A.ok.length ? '  (capaian ' + pctFmt(w.ratio / tn, 0) + ')' : '') : 'Belum ditetapkan'], ['Kategori dampak', A.ok.length ? 'Bintang ' + Agg.bintangOf(w.ratio) + ' — ' + (SroiEngine.LABEL_BINTANG[Agg.bintangOf(w.ratio)] || '') : '-'], ['UMKM binaan', fmtNum(w.umkm)]] }));
      y = doc.lastAutoTable.finalY + 8; sec('C. SEBARAN MANFAAT PER STAKEHOLDER');
      doc.autoTable(Object.assign({}, tblOpt, { startY: y, head: [['No', 'Stakeholder', 'Peran', 'Cabang', 'PV Manfaat', 'Porsi']], body: A.stakeholder.length ? A.stakeholder.map(function (s, i) { return [i + 1, s.nama, s.peran, s.cabang, rpPlain(s.v), pctFmt(s.porsi, 1)]; }) : [['', 'Belum ada cabang yang disetujui', '', '', '', '']],
        foot: A.stakeholder.length ? [['', 'TOTAL', '', '', rpPlain(A.total), '100%']] : undefined, footStyles: { fillColor: [234, 242, 251], textColor: [0, 63, 122], fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 10 }, 3: { halign: 'center', cellWidth: 16 }, 4: { halign: 'right' }, 5: { halign: 'right', cellWidth: 18 } } }));
      y = doc.lastAutoTable.finalY + 4;
      if (A.peran.length) doc.autoTable(Object.assign({}, tblOpt, { startY: y, head: [['Kelompok Peran', 'Jumlah Stakeholder', 'PV Manfaat', 'Porsi']], body: A.peran.map(function (s) { return [s.peran, s.n, rpPlain(s.v), pctFmt(s.porsi, 1)]; }), columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' } } }));
      y = doc.lastAutoTable.finalY + 8; sec('D. PENJELASAN HASIL'); y += 4;
      doc.setTextColor.apply(doc, dark); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.2);
      doc.splitTextToSize(L.penjelasan || '-', W - 28).forEach(function (ln) { if (y > 280) { doc.addPage(); y = 20; } doc.text(ln, 14, y); y += 4.4; });
      y += 6;
      var pg = (L.pengesahan || []).filter(function (x) { return x && (x.tahap || x.nama || x.jabatan); });
      var rowsN = Math.ceil(Math.max(1, pg.length) / 2);
      if (y + 12 + rowsN * 42 > 285) { doc.addPage(); y = 20; }
      sec('E. PENGESAHAN'); y += 4;
      var bw = (W - 28 - 10) / 2;
      if (!pg.length) { doc.setFontSize(9); doc.setTextColor.apply(doc, muted); doc.text('— belum ada susunan pengesahan —', 14, y + 4); }
      pg.forEach(function (b, i) {
        var col = i % 2, x = 14 + col * (bw + 10); if (col === 0 && i > 0) y += 42; if (y + 38 > 285) { doc.addPage(); y = 20; }
        doc.setDrawColor(203, 213, 225); doc.rect(x, y, bw, 36);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor.apply(doc, muted); doc.text((b.tahap || '') + (b.tgl ? ', ' + b.tgl : ''), x + 4, y + 6);
        doc.setTextColor.apply(doc, dark); doc.setFont('helvetica', 'bold'); doc.text(b.nama || '(.................................)', x + 4, y + 28);
        doc.setFont('helvetica', 'normal'); doc.setTextColor.apply(doc, muted); doc.text(doc.splitTextToSize(b.jabatan || '', bw - 8)[0] || '', x + 4, y + 33);
      });
      var rv = (L.revisi || []).filter(function (x) { return x && (x.rev || x.ket); });
      if (rv.length) {
        y += pg.length ? 46 : 14; if (y > 250) { doc.addPage(); y = 20; }
        sec('F. RIWAYAT REVISI');
        doc.autoTable(Object.assign({}, tblOpt, { startY: y, head: [['Rev.', 'Tanggal', 'Keterangan perubahan', 'Oleh']], body: rv.map(function (x) { return [String(x.rev), x.tgl || '', x.ket || '-', x.oleh || '']; }), columnStyles: { 0: { cellWidth: 14, halign: 'center' }, 1: { cellWidth: 28 }, 3: { cellWidth: 40 } } }));
      }
      // LAMPIRAN
      doc.addPage('a4', 'landscape');
      Exporter.rekapDraw(doc, th, 'LAMPIRAN — REKAP SROI SELURUH CABANG TAHUN ' + th);
      var n = doc.getNumberOfPages();
      for (var i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(148, 163, 184); var pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight(); doc.text('DharmaImpact • Laporan Konsolidasi SROI ' + th, 14, ph - 4); doc.text('Hal. ' + i + ' / ' + n, pw - 14, ph - 4, { align: 'right' }); }
      doc.save('Laporan_Manajemen_SROI_' + th + '_Rev' + (P.rev || '0') + '.pdf'); toast('Laporan manajemen (PDF) diunduh.', 'ok');
    });
  },
  mgmtXlsx: function (th, lap, btn, logo) {
    return this.run(btn, async function () {
      var lgPng = logo ? await pngOf(logo, 160) : null;
      var L = await loadXStd(), rows = Exporter.rekapRows(th), ok = rows.filter(function (r) { return r.p && r.p.status === 'Disetujui'; }).map(function (r) { return r.p; });
      await L.mgmt({ th: th, rows: rows, ok: ok, w: Agg.weighted(ok), M: M, Agg: Agg, target: function (cid) { return M.targetCabang(th, cid); }, targetNas: M.targetNasional(th), org: CFG.ORG_NAME || 'DharmaImpact', rpShort: rpShort, lap: lap, agg: Exporter.mgmtAgg(th), logo: lgPng });
      toast('Laporan manajemen (Excel) diunduh.', 'ok');
    });
  },

  /* ---------------- Cadangan database ---------------- */
  backupDb: function (btn) {
    return this.run(btn, async function () {
      var res = await api('exportDatabase', {}); if (!res.success) throw new Error(res.message);
      var X = await loadXlsx(), wb = X.utils.book_new();
      Object.keys(res.data).forEach(function (name) { var t = res.data[name]; X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([t.cols].concat(t.rows)), name.slice(0, 31)); });
      X.writeFile(wb, 'DharmaImpact_Backup_' + new Date().toISOString().slice(0, 10) + '.xlsx'); toast('Cadangan database diunduh.', 'ok');
    });
  }
};
