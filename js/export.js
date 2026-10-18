/* =====================================================================
 * Ekspor PDF & Excel — dibuat di browser (SheetJS, jsPDF) — PRD §6.2
 * Pustaka dimuat hanya saat tombol ekspor ditekan (aset awal tetap ringan)
 * ===================================================================== */
var LIB = {
  xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  autotable: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
};
/** Konteks hitung: proyek Disetujui memakai snapshot parameter saat persetujuan (B4) */
function ctxForProyek(p) {
  if (p.status === 'Disetujui' && p.param_snapshot) {
    try { var s = JSON.parse(p.param_snapshot); return { params: s.params, umk: s.umk, budget: s.budget, kpiMaster: s.kpi, sektor: App.master.sektor, snapshot: true }; } catch (e) { }
  }
  return M.engineCtx(p);
}
async function loadPdf() { await loadScript(LIB.jspdf); await loadScript(LIB.autotable); return window.jspdf.jsPDF; }
async function loadXlsx() { await loadScript(LIB.xlsx); return window.XLSX; }
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
      var blue = [0, 90, 171], dark = [26, 36, 51], muted = [91, 107, 127];
      var final = p.status === 'Disetujui';
      // kop
      doc.setFillColor(10, 61, 115); doc.rect(0, 0, W, 30, 'F');
      doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
      doc.text('LAPORAN PERHITUNGAN SOCIAL RETURN ON INVESTMENT', 14, 13);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
      doc.text((CFG.ORG_NAME || 'DharmaImpact') + ' — Cabang ' + (cab.nama_cabang || '') + ' — Tahun ' + p.tahun, 14, 20);
      doc.text('Document No: ' + (p.doc_number || '-') + '   |   Rev. ' + (p.doc_rev || '0') + '   |   Status: ' + p.status + '   |   Dicetak: ' + new Date().toLocaleDateString('id-ID'), 14, 26);
      if (!final) { doc.setTextColor(220, 38, 38); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('SEMENTARA — BELUM DISETUJUI', W - 14, 13, { align: 'right' }); }
      var y = 38, sec = function (t) { doc.setTextColor.apply(doc, blue); doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.text(t, 14, y); y += 2; };
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
        body: d.outcome.map(function (o, i) { var h = r.outcome[o.outcome_id] || {}; return [i + 1, shName(o.sh_id), o.deskripsi_outcome || o.output_ringkas || '-', (o.indikator_sebelum || '-') + ' → ' + (o.indikator_sesudah || '-'), (o.jenis_proksi || '-').replace('_', ' '), rpPlain(h.nilai_proksi), fmtNum(N(o.porsi_proksi === '' ? 100 : o.porsi_proksi), 1) + '%', fmtNum(N(o.dw), 1) + '%', fmtNum(N(o.ds), 1) + '%', fmtNum(N(o.at), 1) + '%', fmtNum(N(o['do']), 1) + '%', (o.durasi_tahun || 1) + ' th', rpPlain(h.impact), rpPlain(h.pv)]; }),
        foot: [['', '', '', '', '', '', '', '', '', '', '', 'TOTAL', rpPlain(r.totalImpact), rpPlain(r.pvImpact)]],
        footStyles: { fillColor: [234, 242, 251], textColor: [0, 63, 122], fontStyle: 'bold' },
        columnStyles: { 5: { halign: 'right' }, 6: { halign: 'right' }, 12: { halign: 'right' }, 13: { halign: 'right' } }
      }));
      var n = doc.getNumberOfPages();
      for (var i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(148, 163, 184); var pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight(); doc.text('DharmaImpact • SroiEngine v' + SroiEngine.VERSION + ' • ' + (final ? 'Hasil resmi server' : 'Hasil sementara'), 14, ph - 8); doc.text('Hal. ' + i + ' / ' + n, pw - 14, ph - 8, { align: 'right' }); }
      doc.save('Laporan_SROI_' + fileSafe(cab.nama_cabang) + '_' + p.tahun + '.pdf');
      toast('PDF diunduh.', 'ok');
    });
  },

  /* ---------------- G2: Excel 6 sheet ---------------- */
  proyekXlsx: function (id, btn, data) {
    return this.run(btn, async function () {
      var d = await Exporter.detail(id, data), p = d.proyek, ctx = ctxForProyek(p), r = SroiEngine.compute(d, ctx), X = await loadXlsx(), wb = X.utils.book_new(), cab = M.cabang(p.cabang_id);
      var shName = function (sid) { var s = d.stakeholder.filter(function (x) { return x.sh_id === sid; })[0]; return s ? s.nama : ''; };
      var kegName = function (kid) { if (kid === '*') return 'Semua kegiatan'; var g = d.kegiatan.filter(function (x) { return x.kegiatan_id === kid; })[0]; return g ? g.nama_kegiatan : ''; };
      var umkmName = function (uid2) { var u = d.umkm.filter(function (x) { return x.umkm_id === uid2; })[0]; return u ? u.nama_umkm : ''; };
      var add = function (name, aoa, widths) { var ws = X.utils.aoa_to_sheet(aoa); ws['!cols'] = (widths || []).map(function (w) { return { wch: w }; }); X.utils.book_append_sheet(wb, ws, name); };
      // 1. Informasi Umum
      add('Informasi Umum', [['LAPORAN PERHITUNGAN SROI — ' + (cab.nama_cabang || '') + ' ' + p.tahun], ['Document Number', p.doc_number, 'Rev.', p.doc_rev], ['Status', p.status + (p.status === 'Disetujui' ? '' : ' (SEMENTARA)')], [],
        ['A. DATA PROGRAM'], ['Nama Program', p.nama_program], ['Nama Project', p.nama_project], ['Project Owner', p.project_owner], ['Lokasi', p.lokasi], ['Google Maps', p.gmaps_url], ['Tanggal Pengukuran', p.tgl_pengukuran], ['Periode', (p.periode_awal || '') + ' s.d. ' + (p.periode_akhir || '')],
        ['Mitra Pelaksana', p.mitra_pelaksana], ['PIC Mitra', p.pic_mitra], ['HP PIC', p.hp_pic], ['Tujuan', p.tujuan], ['Aktivitas', p.aktivitas], ['Metode', p.metode], ['Mitra Penilai', p.mitra_penilai], ['Tim Leader Penilai', p.tim_leader_penilai], ['HP Penilai', p.hp_penilai], [],
        ['STAKEHOLDER'], ['No', 'Nama', 'Peran', 'Kelompok Sektor', 'Alasan Penyertaan']].concat(d.stakeholder.map(function (s, i) { return [i + 1, s.nama, s.peran, s.kelompok_sektor ? M.sektorName(s.kelompok_sektor) : '', s.alasan_penyertaan]; }))
        .concat([[], ['B. HASIL PERHITUNGAN'], ['Total Investasi', Math.round(r.totalInvestasi)], ['PV Investasi', Math.round(r.pvInvestasi)], ['Total Impact', Math.round(r.totalImpact)], ['PV Impact', Math.round(r.pvImpact)], ['Rasio SROI (' + r.params.rumus + ')', +r.rasio.toFixed(4)], ['Rasio Klasik', +r.rasioKlasik.toFixed(4)], ['Rasio Bersih', +r.rasioBersih.toFixed(4)], ['Bintang', r.bintang, r.bintangLabel], ['Discount rate', r.params.r], [],
          ['Sebaran Manfaat', 'Peran', 'PV Impact', 'Porsi']]).concat(r.sebaran.map(function (s) { return [s.nama, s.peran, Math.round(s.nilai), +s.porsi.toFixed(4)]; }))
        .concat([[], ['Penjelasan Kualitatif', p.penjelasan_kualitatif], [], ['C. PENGESAHAN'], ['PIC Pelaksana', p.pic_mitra || p.project_owner], ['Mitra Penilai', p.tim_leader_penilai + ' — ' + (p.mitra_penilai || '')]]), [26, 46, 18, 18, 40]);
      // 2. Impact Map
      add('Impact Map', [['No', 'Stakeholder', 'Input', 'Output', 'Outcome', 'Indikator Sebelum', 'Indikator Sesudah', 'Sumber Informasi', 'Durasi (th)', 'Mulai', 'Jenis Proksi', 'Sumber Proksi', 'Porsi %', 'Nilai Proksi', 'Catatan Proksi', 'DW %', 'DS %', 'AT %', 'DO %', 'Impact Th-1', 'PV Impact']]
        .concat(d.outcome.map(function (o, i) { var h = r.outcome[o.outcome_id] || {}; return [i + 1, shName(o.sh_id), o.input_ref, o.output_ringkas, o.deskripsi_outcome, o.indikator_sebelum, o.indikator_sesudah, o.sumber_informasi, N(o.durasi_tahun) || 1, N(o.mulai) === 2 ? 'Setelah aktivitas' : 'Saat aktivitas', o.jenis_proksi, o.ref_proksi, N(o.porsi_proksi === '' ? 100 : o.porsi_proksi), Math.round(h.nilai_proksi || 0), o.proxy_notes, N(o.dw), N(o.ds), N(o.at), N(o['do']), Math.round(h.impact || 0), Math.round(h.pv || 0)]; }))
        .concat([[], ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'TOTAL', Math.round(r.totalImpact), Math.round(r.pvImpact)]]), [5, 22, 18, 24, 30, 16, 16, 18, 8, 14, 14, 18, 8, 16, 22, 6, 6, 6, 6, 16, 16]);
      // 3. Input
      var inRows = [['Stakeholder', 'Kelompok', 'Komponen', 'Metode', 'Kegiatan', 'Qty', 'Tarif', 'Nilai', 'Keterangan']];
      d.stakeholder.forEach(function (s) {
        d.biaya.filter(function (b) { return b.sh_id === s.sh_id; }).forEach(function (b) { inRows.push([s.nama, b.kelompok, b.komponen, b.metode, kegName(b.kegiatan_id), N(b.qty) || '', N(b.tarif) || '', Math.round(r.biaya[b.biaya_id] || 0), b.keterangan]); });
        d.kegiatan.filter(function (g) { return g.sh_pembiaya_id === s.sh_id && N(g.biaya); }).forEach(function (g) { inRows.push([s.nama, 'Biaya Kegiatan', g.nama_kegiatan, 'KEGIATAN', M.programName(g.program_id), '', '', N(g.biaya), '']); });
        var it = r.investasiPerSh.filter(function (x) { return x.sh_id === s.sh_id; })[0]; inRows.push(['Subtotal ' + s.nama, '', '', '', '', '', '', Math.round(it ? it.nilai : 0), '']);
      });
      inRows.push([], ['TOTAL INVESTASI', '', '', '', '', '', '', Math.round(r.totalInvestasi)], ['PV INVESTASI', '', '', '', '', '', '', Math.round(r.pvInvestasi)]);
      add('Input', inRows, [26, 16, 26, 14, 26, 8, 14, 16, 20]);
      // 4. Output
      var out = [['PROKSI KPI × BUDGET'], ['KPI', 'Bobot %', 'Proksi (F3)']].concat(r.kpi.perKpi.map(function (k) { return [k.nama, k.bobot, Math.round(k.total)]; })).concat([['Total', '', Math.round(r.kpi.total)], [], ['BENCHMARK PELATIHAN & PENDAMPINGAN'], ['Kegiatan', 'Biaya Internal/Peserta', 'Expert', 'Biaya Expert/Peserta', 'Peserta', 'Benefit (F5)']])
        .concat(d.benchmark.map(function (b) { var h = r.benchmark[b.bm_id] || {}; return [kegName(b.kegiatan_id), N(b.biaya_internal_per_peserta), b.nama_expert, N(b.biaya_expert_per_peserta), h.peserta || 0, Math.round(h.nilai || 0)]; }))
        .concat([['Total', '', '', '', '', Math.round(r.benchmarkTotal)], [], ['KENAIKAN NET PROFIT UMKM'], ['UMKM', 'Sektor', 'Omset Sebelum', 'Omset Sesudah', 'Margin %', '∆ Net Profit (F6)', 'DW %', 'DS %', 'AT %', 'DO %', 'Impact (F7)']])
        .concat(d.omset.map(function (o) { var h = r.omset[o.umkm_id] || {}; var u = d.umkm.filter(function (x) { return x.umkm_id === o.umkm_id; })[0] || {}; return [u.nama_umkm, M.sektorName(u.sektor_id), N(o.omset_sebelum), N(o.omset_sesudah), N(o.margin_profit), Math.round(h.f6 || 0), N(o.dw), N(o.ds), N(o.at), N(o['do']), Math.round(h.f7 || 0)]; }))
        .concat([['Total (F8)', '', '', '', '', '', '', '', '', '', Math.round(r.netProfit)], [], ['MANFAAT STAKEHOLDER'], ['Stakeholder', 'Parameter', 'Metode', 'Nilai A', 'Nilai B', 'Hasil', 'Keterangan']])
        .concat(d.manfaat.map(function (m) { return [shName(m.sh_id), m.parameter, m.metode, N(m.nilai_a), N(m.nilai_b), Math.round(r.manfaat[m.mf_id] || 0), m.keterangan]; }));
      add('Output', out, [28, 16, 18, 18, 10, 18, 8, 8, 8, 8, 16]);
      // 5. Detail Program
      var kg = d.kegiatan, hm = {}; d.kehadiran.forEach(function (h) { hm[h.umkm_id + '|' + h.kegiatan_id] = N(h.jumlah); });
      var det = [['KEGIATAN'], ['Program', 'Kegiatan', 'Waktu', 'Durasi (hari)', 'Biaya', 'Penanggung', 'Peserta']].concat(kg.map(function (g) { var st = r.kegiatanStat[g.kegiatan_id] || {}; return [M.programName(g.program_id), g.nama_kegiatan, g.waktu, N(g.durasi_hari), N(g.biaya), shName(g.sh_pembiaya_id), st.peserta || 0]; }))
        .concat([[], ['MATRIKS KEHADIRAN UMKM'], ['No', 'UMKM', 'Sektor', 'Status Khusus'].concat(kg.map(function (g) { return g.nama_kegiatan; })).concat(['Total'])])
        .concat(d.umkm.map(function (u, i) { var tot = 0, cells = kg.map(function (g) { var v = hm[u.umkm_id + '|' + g.kegiatan_id] || 0; tot += v; return v || ''; }); return [i + 1, u.nama_umkm, M.sektorName(u.sektor_id), u.status_khusus].concat(cells).concat([tot]); }));
      add('Detail Program', det, [6, 28, 16, 14].concat(kg.map(function () { return 12; })));
      // 6. Lampiran-Cost Structure
      var secs = r.kpi.sektorIds, cs = [['Budget Program', Math.round(ctx.budget || 0)], ['UMK', Math.round(ctx.umk || 0)], ['Sektor dihitung', (r.kpi.dihitung || []).map(M.sektorName).join(', ')], [],
        ['A. KPI CABANG (AKUMULASI)'], ['KPI', 'Bobot %', 'Target', 'Satuan', 'Realisasi', 'Capaian', 'Proksi Cabang']].concat(r.kpi.perKpi.map(function (k) { return [k.nama, k.bobot, k.targetCabang, k.satuan, k.realisasiCabang, +k.capaian.toFixed(4), Math.round(k.proksiCabang)]; }))
        .concat([['Total', '', '', '', '', '', Math.round(r.kpi.totalCabang)], [], ['B. BREAKDOWN PER SEKTOR'], ['KPI', 'Bobot %'].concat([].concat.apply([], secs.map(function (s) { var n = M.sektorName(s); return [n + ' Target', n + ' Realisasi', n + ' F1', n + ' F2']; }))).concat(['F3'])])
        .concat(r.kpi.perKpi.map(function (k) { return [k.nama, k.bobot].concat([].concat.apply([], k.perSektor.map(function (c) { return [c.target, c.realisasi, +c.f1.toFixed(6), Math.round(c.f2)]; }))).concat([Math.round(k.total)]); }))
        .concat([['Total proksi sektor dihitung (F3)', Math.round(r.kpi.total)]])
        .concat([[], ['Proporsi sektor (F17)'].concat(secs.map(function (s) { return M.sektorName(s) + ': ' + pctFmt(r.kpi.proporsiSektor[s] || 0, 2); }))]);
      add('Lampiran-Cost Structure', cs, [30, 10].concat(secs.map(function () { return 14; })));
      X.writeFile(wb, 'SROI_' + fileSafe(cab.nama_cabang) + '_' + p.tahun + '.xlsx');
      toast('Excel diunduh.', 'ok');
    });
  },

  /* ---------------- G3: Rekap semua cabang ---------------- */
  rekapRows: function (th) {
    var byCab = {}; (App.proyek || []).forEach(function (p) { if (Number(p.tahun) === th) byCab[p.cabang_id] = p; });
    return M.cabangAktif().map(function (c) { var p = byCab[c.cabang_id]; return { cabang: c.nama_cabang, kode: c.kode, p: p }; });
  },
  rekapXlsx: function (th, btn) {
    return this.run(btn, async function () {
      var X = await loadXlsx(), rows = Exporter.rekapRows(th), ok = rows.filter(function (r) { return r.p && r.p.status === 'Disetujui'; }).map(function (r) { return r.p; }), w = Agg.weighted(ok);
      var aoa = [['REKAP SROI SEMUA CABANG — TAHUN ' + th], ['Dicetak', new Date().toLocaleString('id-ID')], [], ['No', 'Kode', 'Cabang', 'Total Investasi', 'PV Investasi', 'Total Impact', 'PV Impact', 'Rasio SROI', 'Bintang', 'Status', 'Jumlah UMKM']]
        .concat(rows.map(function (r, i) { var p = r.p || {}; return [i + 1, r.kode, r.cabang, Math.round(N(p.hasil_total_investasi)), Math.round(N(p.hasil_pv_investasi)), Math.round(N(p.hasil_total_impact)), Math.round(N(p.hasil_pv_impact)), N(p.hasil_rasio), N(p.hasil_bintang), p.status || 'Belum Mulai', N(p.hasil_umkm)]; }))
        .concat([[], ['', '', 'TOTAL (Disetujui: ' + ok.length + ')', Math.round(w.totalInvestasi), Math.round(w.pvInvestasi), Math.round(w.totalImpact), Math.round(w.pvImpact), +w.ratio.toFixed(4), Agg.bintangOf(w.ratio), '', w.umkm], ['', '', 'Rata-rata tertimbang = Σ PV Impact ÷ Σ PV Investasi']]);
      var wb = X.utils.book_new(), ws = X.utils.aoa_to_sheet(aoa); ws['!cols'] = [5, 8, 22, 16, 16, 16, 16, 10, 8, 14, 10].map(function (x) { return { wch: x }; });
      X.utils.book_append_sheet(wb, ws, 'Rekap ' + th); X.writeFile(wb, 'Rekap_SROI_' + th + '.xlsx'); toast('Rekap Excel diunduh.', 'ok');
    });
  },
  rekapPdf: function (th, btn) {
    return this.run(btn, async function () {
      var jsPDF = await loadPdf(), doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' }), W = 297;
      var rows = Exporter.rekapRows(th), ok = rows.filter(function (r) { return r.p && r.p.status === 'Disetujui'; }).map(function (r) { return r.p; }), w = Agg.weighted(ok);
      doc.setFillColor(10, 61, 115); doc.rect(0, 0, W, 24, 'F'); doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
      doc.text('REKAP SROI SEMUA CABANG — TAHUN ' + th, 14, 12); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
      doc.text('Rata-rata tertimbang ' + fmtNum(w.ratio, 2) + ' : 1  •  ' + ok.length + ' dari ' + rows.length + ' cabang disetujui  •  Dicetak ' + new Date().toLocaleDateString('id-ID'), 14, 19);
      // grafik batang
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
      doc.autoTable({
        startY: Math.max(ty, 50), theme: 'grid', margin: { left: 14, right: 14 }, styles: { fontSize: 8.5, cellPadding: 1.8 }, headStyles: { fillColor: [0, 90, 171] },
        head: [['No', 'Cabang', 'Total Investasi', 'PV Investasi', 'Total Impact', 'PV Impact', 'Rasio', 'Bintang', 'Status', 'UMKM']],
        body: rows.map(function (r, i) { var p = r.p || {}; var has = N(p.hasil_pv_investasi) > 0; return [i + 1, r.cabang, has ? rpPlain(p.hasil_total_investasi) : '-', has ? rpPlain(p.hasil_pv_investasi) : '-', has ? rpPlain(p.hasil_total_impact) : '-', has ? rpPlain(p.hasil_pv_impact) : '-', has ? fmtNum(N(p.hasil_rasio), 2) : '-', has ? String(p.hasil_bintang) : '-', p.status || 'Belum Mulai', N(p.hasil_umkm) || '-']; }),
        foot: [['', 'TOTAL DISETUJUI', rpPlain(w.totalInvestasi), rpPlain(w.pvInvestasi), rpPlain(w.totalImpact), rpPlain(w.pvImpact), fmtNum(w.ratio, 2), String(Agg.bintangOf(w.ratio)), ok.length + ' cabang', fmtNum(w.umkm)]],
        footStyles: { fillColor: [234, 242, 251], textColor: [0, 63, 122] },
        columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } }
      });
      doc.setFontSize(7.5); doc.setTextColor(148, 163, 184); doc.text('Rata-rata tertimbang = Σ PV Impact ÷ Σ PV Investasi. Status selain Disetujui tidak dihitung pada total.', 14, doc.internal.pageSize.getHeight() - 8);
      doc.save('Rekap_SROI_' + th + '.pdf'); toast('Rekap PDF diunduh.', 'ok');
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
