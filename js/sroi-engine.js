/* ===================================================================
 * SroiEngine — Mesin Hitung SROI DharmaImpact  (v1.0)
 * -------------------------------------------------------------------
 * SATU file yang sama dipakai di:
 *   • Browser  : js/sroi-engine.js   (hasil real-time di wizard)
 *   • Server   : SroiEngine.gs       (hitung ulang resmi saat kirim/setujui)
 * JANGAN mengubah salah satu saja — salin identik ke keduanya.
 *
 * Rumus F1–F17 dan aturan koreksi R1–R8 mengikuti PRD DharmaImpact §5.1.
 * Semua persentase disimpan sebagai angka 0–100 (mis. 12,5 = 12,5%).
 * =================================================================== */
var SroiEngine = (function () {
  'use strict';

  var VERSION = '1.4.0';

  /* ---------- util angka (data tersimpan: Number atau string "1234.5") ---------- */
  function n(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    if (v === null || v === undefined || v === '') return 0;
    var x = Number(String(v).replace(',', '.'));
    return isFinite(x) ? x : 0;
  }
  function pct(v) { return n(v) / 100; }
  function isBlank(v) { return v === null || v === undefined || String(v).trim() === ''; }
  function adj(o) { return (1 - pct(o.dw)) * (1 - pct(o.ds)) * (1 - pct(o.at)) * (1 - pct(o['do'])); }
  function arr(a) { return Array.isArray(a) ? a : []; }
  /** Pisahkan referensi sumber: id biasa vs filter sektor "SEK:<sektor_id>". */
  function splitRefs(refs) { var sek = [], ids = []; refs.forEach(function (x) { if (String(x).indexOf('SEK:') === 0) { var v = String(x).slice(4); if (v && v !== 'ALL') sek.push(v); } else ids.push(x); }); return { sek: sek, ids: ids.length ? ids : ['ALL'] }; }
  function refList(ref) {
    var s = String(ref == null ? '' : ref).trim();
    if (!s || s === 'ALL' || s === '*') return ['ALL'];
    return s.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
  }

  /** Daftar komponen proksi satu outcome. Format baru: proksi_list (array/JSON); format lama: jenis_proksi tunggal. */
  function proksiOf(o) {
    var list = o.proksi_list;
    if (typeof list === 'string' && list.trim()) { try { list = JSON.parse(list); } catch (e) { list = null; } }
    if (!Array.isArray(list) || !list.length) {
      if (!o.jenis_proksi && !o.ref_proksi) return [];
      list = [{ jenis: o.jenis_proksi, ref: o.ref_proksi, porsi: o.porsi_proksi, nilai: o.nilai_proksi, notes: '' }];
    }
    var fb = function (c, f) { return (c[f] === undefined || c[f] === null || c[f] === '') ? (o[f] === undefined || o[f] === null ? '' : o[f]) : c[f]; };
    return list.map(function (c) { c = c || {}; return { jenis: String(c.jenis || '').toUpperCase(), ref: c.ref == null ? '' : String(c.ref), porsi: n(c.porsi === '' || c.porsi == null ? 100 : c.porsi), nilai: c.nilai, notes: c.notes || '',
      dw: fb(c, 'dw'), ds: fb(c, 'ds'), at: fb(c, 'at'), 'do': fb(c, 'do') }; });
  }

  /** Parameter baku → objek siap pakai */
  function parseParams(p) {
    p = p || {};
    var batas = String(p.bintang_batas == null ? '1;1,5;3;7' : p.bintang_batas)
      .split(';').map(function (x) { return n(String(x).trim()); });
    if (batas.length !== 4) batas = [1, 1.5, 3, 7];
    return {
      r: pct(p.discount_rate == null ? 5 : p.discount_rate),
      hk: n(p.hari_kerja_bulan) || 26,
      rumus: String(p.rumus_rasio || 'KLASIK').toUpperCase() === 'BERSIH' ? 'BERSIH' : 'KLASIK',
      batas: batas
    };
  }

  /** F15 — kategori bintang. <b1 ★1 · b1–b2 ★2 · >b2–b3 ★3 · >b3–b4 ★4 · >b4 ★5 */
  function bintang(rasio, batas) {
    batas = batas || [1, 1.5, 3, 7];
    if (rasio < batas[0]) return 1;
    if (rasio <= batas[1]) return 2;
    if (rasio <= batas[2]) return 3;
    if (rasio <= batas[3]) return 4;
    return 5;
  }

  var LABEL_BINTANG = { 1: 'Kurang', 2: 'Cukup', 3: 'Signifikan', 4: 'Sangat Signifikan', 5: 'Luar Biasa' };

  /* ===================================================================
   * compute(data, ctx)
   *   data : { proyek, stakeholder[], kpi[], kegiatan[], umkm[], kehadiran[],
   *            biaya[], omset[], benchmark[], manfaat[], outcome[], berkas[] }
   *   ctx  : { params, umk, budget, kpiMaster[], sektor[] }
   * =================================================================== */
  function compute(data, ctx) {
    data = data || {}; ctx = ctx || {};
    var P = parseParams(ctx.params);
    var UMK = n(ctx.umk), BUDGET = n(ctx.budget);
    var kpiMaster = arr(ctx.kpiMaster).slice().sort(function (a, b) { return n(a.urutan) - n(b.urutan); });
    var sh = arr(data.stakeholder), kpiRows = arr(data.kpi), keg = arr(data.kegiatan), umkm = arr(data.umkm);
    var hadir = arr(data.kehadiran), biaya = arr(data.biaya), omset = arr(data.omset);
    var bm = arr(data.benchmark), mf = arr(data.manfaat), oc = arr(data.outcome), berkas = arr(data.berkas);
    var errors = [], warnings = [];
    var umkmById = {}; umkm.forEach(function (u) { umkmById[u.umkm_id] = u; });
    var shById = {}; sh.forEach(function (s) { shById[s.sh_id] = s; });
    var sekById = {}; arr(ctx.sektor).forEach(function (x) { sekById[x.sektor_id] = x.nama_sektor; });
    function sekName(id) { return id === '_' ? 'Tanpa sektor' : (sekById[id] || id); }

    /* ---------- C2: KPI cabang → breakdown per sektor → sektor dihitung (F1–F3, F17) ----------
     * Baris KPI_SEKTOR dengan sektor_id 'ALL' = realisasi akumulasi cabang (semua sektor).
     * Target akumulasi berasal dari data induk KPI cabang (kpiMaster[].target).
     * proyek.sektor_dihitung = daftar sektor (csv) yang masuk proksi SROI sesuai arahan pusat. */
    var sektorIds = [], masterRow = {};
    kpiRows.forEach(function (r) {
      if (r.sektor_id === 'ALL') { masterRow[r.kpi_id] = r; return; }
      if (r.sektor_id && sektorIds.indexOf(r.sektor_id) < 0) sektorIds.push(r.sektor_id);
    });
    var dihitung = String((data.proyek || {}).sektor_dihitung || '').split(',').map(function (x) { return x.trim(); })
      .filter(function (x) { return x && sektorIds.indexOf(x) > -1; });
    var kpiCell = {}; // kpi_id|sektor_id → row
    kpiRows.forEach(function (r) { kpiCell[r.kpi_id + '|' + r.sektor_id] = r; });
    var kpi = { perKpi: [], total: 0, totalSemua: 0, totalCabang: 0, cell: {}, realisasiSektor: {}, proporsiSektor: {}, proksiSektor: {}, sektorIds: sektorIds, dihitung: dihitung };
    var realTotalAll = 0;
    kpiMaster.forEach(function (k) {
      var isPct = /%/.test(String(k.satuan || ''));
      var sumTarget = 0, sumReal = 0;
      sektorIds.forEach(function (s) { var c = kpiCell[k.kpi_id + '|' + s]; if (c) { sumTarget += n(c.target); sumReal += n(c.realisasi); } });
      var mT = n(k.target), mR = masterRow[k.kpi_id] ? n(masterRow[k.kpi_id].realisasi) : sumReal;
      var mF2 = mT > 0 ? (mR / mT) * BUDGET * pct(k.bobot) : 0;                     // proksi KPI tingkat cabang
      var item = { kpi_id: k.kpi_id, nama: k.nama_kpi, bobot: n(k.bobot), satuan: k.satuan || '', isPct: isPct,
        targetCabang: mT, realisasiCabang: mR, capaian: mT > 0 ? mR / mT : 0, proksiCabang: mF2,
        target: sumTarget, realisasi: sumReal, perSektor: [], total: 0, totalSemua: 0,
        selisihTarget: isPct ? 0 : sumTarget - mT, selisihReal: isPct ? 0 : sumReal - mR };
      sektorIds.forEach(function (s) {
        var c = kpiCell[k.kpi_id + '|' + s] || {};
        var t = n(c.target), rl = n(c.realisasi), on = dihitung.indexOf(s) > -1;
        var f1 = sumTarget > 0 ? pct(k.bobot) * (t / sumTarget) : 0;            // F1
        var f2 = t > 0 ? (rl / t) * BUDGET * f1 : 0;                              // F2
        item.perSektor.push({ sektor_id: s, target: t, realisasi: rl, f1: f1, f2: f2, dihitung: on });
        item.totalSemua += f2; if (on) item.total += f2;
        kpi.cell[k.kpi_id + '|' + s] = f2;
        kpi.proksiSektor[s] = (kpi.proksiSektor[s] || 0) + f2;
        kpi.realisasiSektor[s] = (kpi.realisasiSektor[s] || 0) + rl;
        realTotalAll += rl;
      });
      if (!mT) errors.push({ step: 2, msg: 'Target KPI "' + k.nama_kpi + '" untuk cabang ini belum diatur Super Admin.' });
      if (mT > 0 && mR > 2 * mT) warnings.push({ step: 2, msg: 'Realisasi KPI "' + k.nama_kpi + '" melebihi 200% target cabang.' });
      if (sektorIds.length && !isPct) {
        if (Math.abs(item.selisihTarget) > 1e-9) errors.push({ step: 2, msg: 'KPI "' + k.nama_kpi + '": jumlah target per sektor (' + fmtN(sumTarget) + ') belum sama dengan target cabang (' + fmtN(mT) + ').' });
        if (masterRow[k.kpi_id] && Math.abs(item.selisihReal) > 1e-9) errors.push({ step: 2, msg: 'KPI "' + k.nama_kpi + '": jumlah realisasi per sektor (' + fmtN(sumReal) + ') belum sama dengan realisasi cabang (' + fmtN(mR) + ').' });
      }
      kpi.total += item.total;                                                    // F3 (hanya sektor dihitung)
      kpi.totalSemua += item.totalSemua; kpi.totalCabang += mF2;
      kpi.perKpi.push(item);
    });
    sektorIds.forEach(function (s) { kpi.proporsiSektor[s] = realTotalAll > 0 ? kpi.realisasiSektor[s] / realTotalAll : 0; }); // F17
    if (kpiMaster.length && !sektorIds.length) errors.push({ step: 2, msg: 'Breakdown KPI per sektor belum diisi (pilih sektor binaan cabang).' });
    if (sektorIds.length && !dihitung.length) errors.push({ step: 2, msg: 'Belum ada sektor yang dipilih untuk dihitung dalam SROI.' });
    var bobotTotal = kpiMaster.reduce(function (a, k) { return a + n(k.bobot); }, 0);

    /* ---------- C3: kegiatan & kehadiran (R8: peserta dari KEHADIRAN) ---------- */
    var kegStat = {};
    keg.forEach(function (g) { kegStat[g.kegiatan_id] = { peserta: 0, umkm: 0, hadir: 0, manual: false }; });
    hadir.forEach(function (h) {
      var st = kegStat[h.kegiatan_id]; if (!st || !umkmById[h.umkm_id]) return;
      var j = n(h.jumlah); if (j > 0) { st.hadir += j; st.umkm += 1; }
    });
    /* Peserta per kegiatan: isian langsung bila diisi, selain itu dari matriks kehadiran */
    keg.forEach(function (g) { var st = kegStat[g.kegiatan_id]; if (!isBlank(g.jumlah_peserta)) { st.peserta = n(g.jumlah_peserta); st.manual = true; } else st.peserta = st.hadir; });

    /* ---------- C4: biaya (F4) & total investasi (F12, R2) ---------- */
    var perSh = {}; // sh_id → subtotal investasi
    function addInv(shId, v) { var k = shId || '_'; perSh[k] = (perSh[k] || 0) + v; }
    var biayaHasil = {};
    biaya.forEach(function (b) {
      var m = String(b.metode || 'MANUAL').toUpperCase(), v = 0;
      if (m === 'WAKTU_TENAGA') {                                                // F4
        var list = (b.kegiatan_id === '*' || b.kegiatan_id === 'ALL') ? keg : keg.filter(function (g) { return g.kegiatan_id === b.kegiatan_id; });
        list.forEach(function (g) {
          var st = kegStat[g.kegiatan_id] || { peserta: 0 };
          v += P.hk > 0 ? n(g.durasi_hari) * st.peserta / P.hk * UMK : 0;
        });
      } else if (m === 'QTY_X_TARIF') v = n(b.qty) * n(b.tarif);
      else v = n(b.nilai);
      biayaHasil[b.biaya_id] = v; addInv(b.sh_id, v);
    });
    var biayaKegiatan = 0;
    keg.forEach(function (g) { var v = n(g.biaya); biayaKegiatan += v; addInv(g.sh_pembiaya_id, v); });
    var totalInvestasi = 0; Object.keys(perSh).forEach(function (k) { totalInvestasi += perSh[k]; });   // F12
    var pvInvestasi = totalInvestasi / (1 + P.r);                                                     // F13

    /* ---------- C5: omset & net profit (F6–F8, R6, R7) ---------- */
    var omsetHasil = {}, f8 = 0;
    omset.forEach(function (o) {
      if (!umkmById[o.umkm_id]) return;
      var d = (n(o.omset_sesudah) - n(o.omset_sebelum)) * pct(o.margin_profit);  // F6
      var imp = d * adj(o);                                                       // F7
      omsetHasil[o.umkm_id] = { f6: d, f7: imp };
      f8 += imp;                                                                  // F8
      var nm = umkmById[o.umkm_id].nama_umkm || 'UMKM';
      if (isBlank(o.margin_profit)) errors.push({ step: 5, msg: 'Margin profit "' + nm + '" belum diisi.' });
      if (n(o.omset_sesudah) < n(o.omset_sebelum)) warnings.push({ step: 5, msg: 'Omset sesudah "' + nm + '" lebih kecil dari omset sebelum.' });
      ['dw', 'ds', 'at', 'do'].forEach(function (f) { var x = n(o[f]); if (x < 0 || x > 100) errors.push({ step: 5, msg: 'Faktor ' + f.toUpperCase() + ' "' + nm + '" di luar 0–100%.' }); });
    });
    umkm.forEach(function (u) {
      if (!omset.some(function (o) { return o.umkm_id === u.umkm_id; }))
        errors.push({ step: 5, msg: 'Data omset & margin profit "' + (u.nama_umkm || 'UMKM') + '" belum diisi.' });
    });

    /* ---------- C6: benchmark (F5) & manfaat stakeholder ---------- */
    var bmHasil = {}, f5 = 0;
    bm.forEach(function (b) {
      var peserta = b.kegiatan_id && kegStat[b.kegiatan_id] ? kegStat[b.kegiatan_id].peserta : n(b.jumlah_peserta);
      var v = (n(b.biaya_expert_per_peserta) - n(b.biaya_internal_per_peserta)) * peserta;            // F5
      // pemilahan per sektor UMKM: peserta dibagi menurut proporsi kehadiran UMKM tiap sektor pada kegiatan tsb.
      var sek = null, hTot = 0, hSek = {};
      if (b.kegiatan_id) hadir.forEach(function (h) { var u = umkmById[h.umkm_id], j = n(h.jumlah); if (h.kegiatan_id !== b.kegiatan_id || !u || j <= 0) return; var sid = u.sektor_id || '_'; hSek[sid] = (hSek[sid] || 0) + j; hTot += j; });
      if (hTot > 0) { sek = {}; Object.keys(hSek).forEach(function (sid) { var ps = peserta * hSek[sid] / hTot; sek[sid] = { peserta: ps, nilai: (n(b.biaya_expert_per_peserta) - n(b.biaya_internal_per_peserta)) * ps }; }); }
      bmHasil[b.bm_id] = { peserta: peserta, nilai: v, sektor: sek }; f5 += v;
    });
    var mfHasil = {};
    mf.forEach(function (m) {
      var met = String(m.metode || 'MANUAL').toUpperCase(), v;
      if (met === 'SELISIH') v = n(m.nilai_b) - n(m.nilai_a);
      else if (met === 'PERSEN') v = n(m.nilai_a) * pct(m.nilai_b);
      else v = n(m.nilai_a);
      mfHasil[m.mf_id] = v;
    });

    /* ---------- C7: Impact Map (F9–F11, R3–R5, R7) ---------- */
    var usage = {};   // unit sumber → Σ porsi (%)   (R4/R5)
    var usageMeta = {};
    function use(unit, label, group, porsi, ocId) {
      usage[unit] = (usage[unit] || 0) + porsi;
      if (!usageMeta[unit]) usageMeta[unit] = { label: label, group: group, outcomes: [] };
      usageMeta[unit].outcomes.push(ocId);
    }
    var ocHasil = {}, pvImpact = 0, totalImpact = 0, perShImpact = {};
    oc.forEach(function (o, idx) {
      var s = shById[o.sh_id] || {}, sektorFilter = s.kelompok_sektor || '';
      var label = 'Outcome #' + (idx + 1) + (s.nama ? ' (' + s.nama + ')' : '');
      if (!o.sh_id || !shById[o.sh_id]) errors.push({ step: 7, msg: label + ': stakeholder belum dipilih.' });
      var comps = proksiOf(o), nilaiTot = 0, nilaiPorsiTot = 0, kompHasil = [];
      if (!comps.length || !comps.some(function (c) { return c.jenis; })) errors.push({ step: 7, msg: label + ': belum memilih jenis/sumber proksi.' });   // R3
      comps.forEach(function (c, ci) {
        var jenis = c.jenis, porsi = c.porsi, refs = refList(c.ref), nilai = 0;
        var cl = label + (comps.length > 1 ? ' • proksi ke-' + (ci + 1) : '');
        if (!jenis) { if (comps.length > 1) errors.push({ step: 7, msg: cl + ': jenis proksi belum dipilih.' }); }
        else if (jenis === 'KPI_BUDGET') {
          var kpis = refs[0] === 'ALL' ? kpiMaster.map(function (k) { return k.kpi_id; }) : refs;
          var secs = sektorFilter ? (dihitung.indexOf(sektorFilter) > -1 ? [sektorFilter] : []) : dihitung;
          if (sektorFilter && !secs.length) warnings.push({ step: 7, msg: cl + ': sektor stakeholder ini tidak termasuk sektor yang dihitung, proksi KPI = 0.' });
          kpis.forEach(function (kid) {
            var km = kpiMaster.filter(function (k) { return k.kpi_id === kid; })[0]; if (!km) return;
            secs.forEach(function (sid) { nilai += kpi.cell[kid + '|' + sid] || 0; use('KPI:' + kid + ':' + sid, km.nama_kpi, 'KPI', porsi, o.outcome_id); });
          });
          if (!kpis.length) errors.push({ step: 7, msg: cl + ': pilih minimal satu KPI sebagai sumber proksi.' });
        } else if (jenis === 'BENCHMARK') {
          var rb = splitRefs(refs), bms = rb.ids.indexOf('ALL') > -1 ? bm.map(function (b) { return b.bm_id; }) : rb.ids;
          bms.forEach(function (id) {
            var h = bmHasil[id]; if (!h) return;
            var bl = 'Benchmark ' + (bm.filter(function (b) { return b.bm_id === id; })[0].nama_expert || '');
            if (h.sektor) {   // selalu dicatat per sektor agar pemakaian sumber tidak terhitung dobel antar outcome
              Object.keys(h.sektor).forEach(function (sid) {
                if (rb.sek.length && rb.sek.indexOf(sid) < 0) return;
                nilai += h.sektor[sid].nilai; use('BM:' + id + ':' + sid, bl + ' — ' + sekName(sid), 'BENCHMARK', porsi, o.outcome_id);
              });
            } else if (rb.sek.length) {
              warnings.push({ step: 7, msg: cl + ': ' + bl + ' belum punya data kehadiran UMKM, sehingga tidak bisa dipilah per sektor (nilai 0).' });
            } else { nilai += h.nilai; use('BM:' + id, bl, 'BENCHMARK', porsi, o.outcome_id); }
          });
          if (!bm.length) errors.push({ step: 7, msg: cl + ': tabel benchmark (langkah 6) masih kosong.' });
        } else if (jenis === 'NET_PROFIT') {
          var rn = splitRefs(refs), us = rn.ids.indexOf('ALL') > -1 ? umkm.map(function (u) { return u.umkm_id; }) : rn.ids;
          us.forEach(function (id) {
            var u = umkmById[id]; if (!u) return;
            if (sektorFilter && u.sektor_id !== sektorFilter) return;
            if (rn.sek.length && rn.sek.indexOf(u.sektor_id) < 0) return;   // filter sektor pilihan PIC
            nilai += omsetHasil[id] ? omsetHasil[id].f7 : 0;
            use('NP:' + id, 'Net profit ' + (u.nama_umkm || ''), 'NET_PROFIT', porsi, o.outcome_id);
          });
          if (adj(c) < 1) warnings.push({ step: 7, msg: cl + ': proksi Net Profit sudah dikurangi faktor penyesuaian per UMKM (F7). Isi 0% di DW/DS/AT/DO proksi ini bila tidak ingin dikurangi dua kali.' });
        } else if (jenis === 'MANFAAT_SH') {
          var mfs = refs[0] === 'ALL' ? [] : refs;
          mfs.forEach(function (id) {
            if (mfHasil[id] === undefined) return;
            var row = mf.filter(function (m) { return m.mf_id === id; })[0];
            nilai += mfHasil[id]; use('MF:' + id, 'Manfaat: ' + (row.parameter || ''), 'MANFAAT_SH', porsi, o.outcome_id);
          });
          if (!mfs.length) errors.push({ step: 7, msg: cl + ': pilih baris manfaat stakeholder sebagai sumber proksi.' });
        } else if (jenis === 'MANUAL') {
          nilai = n(c.nilai);
          if (isBlank(c.notes) && isBlank(o.proxy_notes)) errors.push({ step: 7, msg: cl + ': proksi MANUAL wajib diisi catatan sumber proksi.' });
        }
        if (porsi < 0 || porsi > 100) errors.push({ step: 7, msg: cl + ': porsi proksi harus 0–100%.' });
        ['dw', 'ds', 'at', 'do'].forEach(function (f) { var x = n(c[f]); if (x < 0 || x > 100) errors.push({ step: 7, msg: cl + ': faktor ' + f.toUpperCase() + ' di luar 0–100%.' }); });
        var np = nilai * pct(porsi), imp = np * adj(c);                                           // F9 per proksi
        nilaiTot += nilai; nilaiPorsiTot += np;
        kompHasil.push({ jenis: jenis, ref: c.ref, porsi: porsi, nilai: nilai, nilaiPorsi: np, impact: imp, dw: n(c.dw), ds: n(c.ds), at: n(c.at), 'do': n(c['do']), notes: c.notes || '' });
      });

      // F9 = Σ[(nilai proksi × porsi) × (1−DW)(1−DS)(1−AT)(1−DO)] tiap proksi; F10 drop-off per proksi
      var y1 = kompHasil.reduce(function (a, k) { return a + k.impact; }, 0);
      var dur = Math.max(1, Math.round(n(o.durasi_tahun) || 1)), years = [], pv = 0, sumNom = 0;
      for (var t = 1; t <= dur; t++) {
        var cur = kompHasil.reduce(function (a, k) { return a + k.impact * Math.pow(1 - pct(k['do']), t - 1); }, 0);   // F10
        years.push(cur); sumNom += cur; pv += cur / Math.pow(1 + P.r, t);                           // F11
      }
      ocHasil[o.outcome_id] = { nilai_proksi: nilaiTot, nilai_porsi: nilaiPorsiTot, komponen: kompHasil, impact: y1, impactTahun: years, impactNominal: sumNom, pv: pv };
      pvImpact += pv; totalImpact += sumNom;
      perShImpact[o.sh_id || '_'] = (perShImpact[o.sh_id || '_'] || 0) + pv;
      if (y1 === 0) warnings.push({ step: 7, msg: label + ': nilai impact = 0.' });
    });

    /* R4 — sumber proksi tak boleh terpakai > 100% */
    var usageList = Object.keys(usage).map(function (u) { return { unit: u, label: usageMeta[u].label, group: usageMeta[u].group, porsi: usage[u], outcomes: usageMeta[u].outcomes }; });
    var shown = {};
    usageList.forEach(function (u) {
      if (u.porsi > 100.0001) {
        var key = u.group + ':' + u.label; if (shown[key]) return; shown[key] = 1;
        errors.push({ step: 7, msg: 'Sumber proksi "' + u.label + '" terpakai ' + fmtPct(u.porsi) + ' (maks. 100%). Kurangi porsi agar tidak terhitung dobel.' });
      }
    });
    /* ringkas pemakaian per sumber (untuk indikator di UI) */
    var usageSummary = {};
    usageList.forEach(function (u) {
      var key = u.group + ':' + u.label;
      if (!usageSummary[key] || usageSummary[key].porsi < u.porsi) usageSummary[key] = { label: u.label, group: u.group, porsi: u.porsi };
    });

    /* ---------- F14–F16 ---------- */
    var rasioKlasik = pvInvestasi > 0 ? pvImpact / pvInvestasi : 0;
    var rasioBersih = pvInvestasi > 0 ? (pvImpact - pvInvestasi) / pvInvestasi : 0;
    var rasio = P.rumus === 'BERSIH' ? rasioBersih : rasioKlasik;
    var bin = bintang(rasio, P.batas);
    var sebaran = Object.keys(perShImpact).map(function (k) {
      var s2 = shById[k] || {};
      return { sh_id: k, nama: s2.nama || '(tanpa stakeholder)', peran: s2.peran || '', nilai: perShImpact[k], porsi: pvImpact > 0 ? perShImpact[k] / pvImpact : 0 };
    }).sort(function (a, b) { return b.nilai - a.nilai; });
    var investasiSh = Object.keys(perSh).map(function (k) { var s3 = shById[k] || {}; return { sh_id: k, nama: s3.nama || '(belum dipilih)', nilai: perSh[k] }; });

    /* ---------- validasi umum ---------- */
    var p = data.proyek || {};
    if (isBlank(p.nama_program)) errors.push({ step: 1, msg: 'Nama program belum diisi.' });
    if (!sh.some(function (s) { return s.peran === 'Pelaksana'; })) errors.push({ step: 1, msg: 'Minimal 1 stakeholder berperan Pelaksana.' });
    if (!sh.some(function (s) { return s.peran === 'Penerima Manfaat'; })) errors.push({ step: 1, msg: 'Minimal 1 stakeholder berperan Penerima Manfaat.' });
    if (kpiMaster.length && Math.abs(bobotTotal - 100) > 0.001) warnings.push({ step: 2, msg: 'Total bobot KPI tahun ini ' + fmtPct(bobotTotal) + ' (seharusnya 100%). Hubungi Super Admin.' });
    if (!BUDGET) errors.push({ step: 2, msg: 'Budget program cabang tahun ini belum diatur Super Admin.' });
    if (!UMK && biaya.some(function (b) { return String(b.metode).toUpperCase() === 'WAKTU_TENAGA'; })) errors.push({ step: 4, msg: 'UMK cabang tahun ini belum diatur Super Admin.' });
    if (totalInvestasi <= 0) errors.push({ step: 4, msg: 'Total Investasi masih 0.' });
    if (!oc.length) errors.push({ step: 7, msg: 'Impact Map belum memiliki baris outcome.' });
    if (!berkas.some(function (b) { return b.jenis === 'Lembar Pengesahan'; })) warnings.push({ step: 8, msg: 'Belum ada berkas Lembar Pengesahan.' });

    return {
      version: VERSION,
      params: P,
      kpi: kpi, bobotTotal: bobotTotal,
      kegiatanStat: kegStat,
      biaya: biayaHasil, biayaKegiatan: biayaKegiatan, investasiPerSh: investasiSh,
      totalInvestasi: totalInvestasi, pvInvestasi: pvInvestasi,
      omset: omsetHasil, netProfit: f8,
      benchmark: bmHasil, benchmarkTotal: f5,
      manfaat: mfHasil,
      outcome: ocHasil, usage: usageSummary,
      totalImpact: totalImpact, pvImpact: pvImpact,
      rasio: rasio, rasioKlasik: rasioKlasik, rasioBersih: rasioBersih,
      bintang: bin, bintangLabel: LABEL_BINTANG[bin],
      sebaran: sebaran,
      errors: dedupe(errors), warnings: dedupe(warnings)
    };
  }

  function dedupe(list) {
    var seen = {}; return list.filter(function (e) { var k = e.step + e.msg; if (seen[k]) return false; seen[k] = 1; return true; });
  }
  function fmtN(x) { return (Math.round(x * 100) / 100).toString().replace('.', ','); }
  function fmtPct(x) { return (Math.round(x * 100) / 100).toString().replace('.', ',') + '%'; }

  /** Ringkasan hasil untuk disimpan di sheet PROYEK (snapshot) */
  function summary(res) {
    return {
      hasil_total_investasi: Math.round(res.totalInvestasi),
      hasil_pv_investasi: Math.round(res.pvInvestasi),
      hasil_total_impact: Math.round(res.totalImpact),
      hasil_pv_impact: Math.round(res.pvImpact),
      hasil_rasio: Math.round(res.rasio * 10000) / 10000,
      hasil_rasio_bersih: Math.round(res.rasioBersih * 10000) / 10000,
      hasil_bintang: res.bintang,
      hasil_sebaran: JSON.stringify(res.sebaran.map(function (s) { return { n: s.nama, p: s.peran, v: Math.round(s.nilai) }; })),
      hasil_error: res.errors.length
    };
  }

  return { VERSION: VERSION, proksiOf: proksiOf, compute: compute, summary: summary, bintang: bintang, parseParams: parseParams, LABEL_BINTANG: LABEL_BINTANG, n: n };
})();

/* Node (uji otomatis) */
if (typeof module !== 'undefined' && module.exports) module.exports = SroiEngine;
