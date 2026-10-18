/* =====================================================================
 * XLSX-STD — penulis Excel bergaya (tanpa pustaka berbayar) di atas JSZip
 * Mendukung: gaya sel (font, isi, garis, perataan, format angka), sel gabung,
 * lebar kolom, tinggi baris, freeze pane, tanpa gridline, warna tab,
 * pengaturan cetak (landscape, fit lebar, judul berulang, header/footer),
 * dan gambar PNG (grafik) — dimuat hanya saat ekspor Excel.
 * ===================================================================== */
(function (G) {
  'use strict';
  function xe(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''); }
  function colName(c) { var s = ''; c++; while (c > 0) { var m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; }
  function ref(r, c) { return colName(c) + (r + 1); }
  function hex(h) { h = String(h || '').replace('#', '').toUpperCase(); if (h.length === 3) h = h.split('').map(function (x) { return x + x; }).join(''); return /^[0-9A-F]{6}$/.test(h) ? h : '000000'; }

  /* ---------------- Registri gaya ---------------- */
  function Styles() {
    this.fonts = ['<font><sz val="10"/><name val="Arial"/><family val="2"/></font>'];
    this.fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
    this.borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
    this.numFmts = []; this.xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
    this.map = { '{}': 0 }; this._f = {}; this._fi = {}; this._b = {}; this._n = {};
  }
  Styles.prototype.font = function (f) {
    f = f || {}; var k = JSON.stringify(f); if (this._f[k] != null) return this._f[k];
    var x = '<font>' + (f.b ? '<b/>' : '') + (f.i ? '<i/>' : '') + (f.u ? '<u/>' : '') + '<sz val="' + (f.sz || 10) + '"/>' + (f.color ? '<color rgb="FF' + hex(f.color) + '"/>' : '') + '<name val="' + xe(f.name || 'Arial') + '"/><family val="2"/></font>';
    this.fonts.push(x); return (this._f[k] = this.fonts.length - 1);
  };
  Styles.prototype.fill = function (c) {
    if (!c) return 0; var k = hex(c); if (this._fi[k] != null) return this._fi[k];
    this.fills.push('<fill><patternFill patternType="solid"><fgColor rgb="FF' + k + '"/><bgColor indexed="64"/></patternFill></fill>'); return (this._fi[k] = this.fills.length - 1);
  };
  Styles.prototype.border = function (b) {
    if (!b) return 0; var k = JSON.stringify(b); if (this._b[k] != null) return this._b[k];
    var side = function (n, v) { if (!v) return '<' + n + '/>'; var st = v.s || v, col = v.c || 'CBD5E1'; return '<' + n + ' style="' + st + '"><color rgb="FF' + hex(col) + '"/></' + n + '>'; };
    var all = b.all;
    this.borders.push('<border>' + side('left', b.l || all) + side('right', b.r || all) + side('top', b.t || all) + side('bottom', b.b || all) + '<diagonal/></border>');
    return (this._b[k] = this.borders.length - 1);
  };
  Styles.prototype.numFmt = function (f) {
    if (!f) return 0; var builtin = { '0': 1, '0.00': 2, '#,##0': 3, '#,##0.00': 4, '0%': 9, '0.00%': 10, '@': 49 };
    if (builtin[f] != null) return builtin[f]; if (this._n[f] != null) return this._n[f];
    var id = 164 + this.numFmts.length; this.numFmts.push('<numFmt numFmtId="' + id + '" formatCode="' + xe(f) + '"/>'); return (this._n[f] = id);
  };
  /** st: {font:{b,i,sz,color}, fill:'hex', border:{all|l|r|t|b}, h:'left|center|right', v:'top|center|bottom', wrap, indent, fmt} */
  Styles.prototype.id = function (st) {
    if (!st) return 0; var k = JSON.stringify(st); if (this.map[k] != null) return this.map[k];
    var fo = this.font(st.font), fi = this.fill(st.fill), bo = this.border(st.border), nf = this.numFmt(st.fmt);
    var al = (st.h || st.v || st.wrap || st.indent || st.rot) ? '<alignment' + (st.h ? ' horizontal="' + st.h + '"' : '') + ' vertical="' + (st.v || 'center') + '"' + (st.wrap ? ' wrapText="1"' : '') + (st.indent ? ' indent="' + st.indent + '"' : '') + '/>' : '<alignment vertical="center"/>';
    this.xfs.push('<xf numFmtId="' + nf + '" fontId="' + fo + '" fillId="' + fi + '" borderId="' + bo + '" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">' + al + '</xf>');
    return (this.map[k] = this.xfs.length - 1);
  };
  Styles.prototype.xml = function () {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      (this.numFmts.length ? '<numFmts count="' + this.numFmts.length + '">' + this.numFmts.join('') + '</numFmts>' : '') +
      '<fonts count="' + this.fonts.length + '">' + this.fonts.join('') + '</fonts>' +
      '<fills count="' + this.fills.length + '">' + this.fills.join('') + '</fills>' +
      '<borders count="' + this.borders.length + '">' + this.borders.join('') + '</borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="' + this.xfs.length + '">' + this.xfs.join('') + '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0"/></styleSheet>';
  };

  /* ---------------- Sheet ---------------- */
  function Sheet(wb, name) {
    this.wb = wb; this.name = String(name).replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 31);
    this.rows = {}; this.heights = {}; this.widths = {}; this.merges = []; this.images = [];
    this.freeze = null; this.tab = null; this.landscape = false; this.fitWidth = true; this.printTitle = null; this.footer = ''; this.header = '';
    this.maxR = 0; this.maxC = 0; this.breaks = [];
  }
  /** Tulis satu sel. v: string | number | null | {f:'FORMULA', v:hasil}. */
  Sheet.prototype.set = function (r, c, v, st) {
    (this.rows[r] = this.rows[r] || {})[c] = { v: v, s: this.wb.styles.id(st) };
    if (r > this.maxR) this.maxR = r; if (c > this.maxC) this.maxC = c; return this;
  };
  /** Tulis baris mulai kolom c0; st boleh array per kolom atau satu objek. */
  Sheet.prototype.row = function (r, c0, vals, st) { var self = this; vals.forEach(function (v, i) { self.set(r, c0 + i, v, Array.isArray(st) ? st[i] : st); }); return this; };
  /** Isi gaya untuk rentang (agar garis/isi sel gabung tampil utuh). */
  Sheet.prototype.fillRange = function (r1, c1, r2, c2, st) { for (var r = r1; r <= r2; r++) for (var c = c1; c <= c2; c++) { var cur = this.rows[r] && this.rows[r][c]; this.set(r, c, cur ? cur.v : null, st); } return this; };
  Sheet.prototype.merge = function (r1, c1, r2, c2, v, st) { if (v !== undefined) this.set(r1, c1, v, st); if (st) this.fillRange(r1, c1, r2, c2, st); if (v !== undefined && st) this.rows[r1][c1].v = v; if (r1 !== r2 || c1 !== c2) this.merges.push(ref(r1, c1) + ':' + ref(r2, c2)); return this; };
  Sheet.prototype.height = function (r, h) { this.heights[r] = h; return this; };
  Sheet.prototype.cols = function (arr, c0) { var self = this; arr.forEach(function (w, i) { self.widths[(c0 || 0) + i] = w; }); return this; };
  /** Gambar PNG di (row, col) — ukuran piksel. */
  Sheet.prototype.image = function (png, r, c, wPx, hPx, offX, offY) { this.images.push({ png: png, r: r, c: c, w: wPx, h: hPx, ox: offX || 0, oy: offY || 0 }); return this; };
  Sheet.prototype.xml = function (drawRid) {
    var self = this, o = [];
    o.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">');
    o.push('<sheetPr>' + (this.tab ? '<tabColor rgb="FF' + hex(this.tab) + '"/>' : '') + '<pageSetUpPr fitToPage="1"/></sheetPr>');
    o.push('<dimension ref="A1:' + ref(this.maxR, this.maxC) + '"/>');
    o.push('<sheetViews><sheetView workbookViewId="0" showGridLines="0" zoomScale="100"' + (this.wb.sheets[0] === this ? ' tabSelected="1"' : '') + '>');
    if (this.freeze) {
      var fr = this.freeze.r || 0, fc = this.freeze.c || 0, pane = fr && fc ? 'bottomRight' : fr ? 'bottomLeft' : 'topRight';
      o.push('<pane' + (fc ? ' xSplit="' + fc + '"' : '') + (fr ? ' ySplit="' + fr + '"' : '') + ' topLeftCell="' + ref(fr, fc) + '" activePane="' + pane + '" state="frozen"/><selection pane="' + pane + '" activeCell="' + ref(fr, fc) + '" sqref="' + ref(fr, fc) + '"/>');
    } else o.push('<selection activeCell="A1" sqref="A1"/>');
    o.push('</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>');
    var wk = Object.keys(this.widths).map(Number).sort(function (a, b) { return a - b; });
    if (wk.length) o.push('<cols>' + wk.map(function (c) { return '<col min="' + (c + 1) + '" max="' + (c + 1) + '" width="' + self.widths[c] + '" customWidth="1"/>'; }).join('') + '</cols>');
    o.push('<sheetData>');
    var rk = Object.keys(this.rows).map(Number).concat(Object.keys(this.heights).map(Number)).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
    rk.forEach(function (r) {
      var cells = self.rows[r] || {}, h = self.heights[r];
      o.push('<row r="' + (r + 1) + '"' + (h ? ' ht="' + h + '" customHeight="1"' : '') + '>');
      Object.keys(cells).map(Number).sort(function (a, b) { return a - b; }).forEach(function (c) {
        var cell = cells[c], v = cell.v, a = ' r="' + ref(r, c) + '"' + (cell.s ? ' s="' + cell.s + '"' : '');
        if (v == null || v === '') o.push('<c' + a + '/>');
        else if (typeof v === 'object' && v.f) o.push('<c' + a + '><f>' + xe(v.f) + '</f>' + (v.v != null ? '<v>' + v.v + '</v>' : '') + '</c>');
        else if (typeof v === 'number' && isFinite(v)) o.push('<c' + a + '><v>' + v + '</v></c>');
        else o.push('<c' + a + ' t="inlineStr"><is><t xml:space="preserve">' + xe(v) + '</t></is></c>');
      });
      o.push('</row>');
    });
    o.push('</sheetData>');
    if (this.merges.length) o.push('<mergeCells count="' + this.merges.length + '">' + this.merges.map(function (m) { return '<mergeCell ref="' + m + '"/>'; }).join('') + '</mergeCells>');
    o.push('<printOptions horizontalCentered="1"/><pageMargins left="0.4" right="0.4" top="0.55" bottom="0.6" header="0.25" footer="0.3"/>');
    o.push('<pageSetup paperSize="9" orientation="' + (this.landscape ? 'landscape' : 'portrait') + '" fitToWidth="1" fitToHeight="0"/>');
    if (this.header || this.footer) o.push('<headerFooter>' + (this.header ? '<oddHeader>' + xe(this.header) + '</oddHeader>' : '') + (this.footer ? '<oddFooter>' + xe(this.footer) + '</oddFooter>' : '') + '</headerFooter>');
    if (this.breaks.length) o.push('<rowBreaks count="' + this.breaks.length + '" manualBreakCount="' + this.breaks.length + '">' + this.breaks.map(function (b) { return '<brk id="' + b + '" max="16383" man="1"/>'; }).join('') + '</rowBreaks>');
    if (drawRid) o.push('<drawing r:id="' + drawRid + '"/>');
    o.push('</worksheet>');
    return o.join('');
  };

  /* ---------------- Workbook ---------------- */
  function Workbook(meta) { this.styles = new Styles(); this.sheets = []; this.meta = meta || {}; }
  Workbook.prototype.sheet = function (name) { var s = new Sheet(this, name); this.sheets.push(s); return s; };
  Workbook.prototype.blob = async function () {
    var Z = new G.JSZip(), self = this, media = 0;
    var ct = ['<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>', '<Default Extension="xml" ContentType="application/xml"/>', '<Default Extension="png" ContentType="image/png"/>',
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'];
    var wbRels = [], sheetsXml = [], defs = [];
    this.sheets.forEach(function (s, i) {
      var n = i + 1, drawRid = null;
      ct.push('<Override PartName="/xl/worksheets/sheet' + n + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>');
      wbRels.push('<Relationship Id="rId' + n + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + n + '.xml"/>');
      sheetsXml.push('<sheet name="' + xe(s.name) + '" sheetId="' + n + '" r:id="rId' + n + '"/>');
      if (s.printTitle) defs.push('<definedName name="_xlnm.Print_Titles" localSheetId="' + i + '">\'' + xe(s.name.replace(/'/g, "''")) + '\'!$' + (s.printTitle[0] + 1) + ':$' + (s.printTitle[1] + 1) + '</definedName>');
      if (s.images.length) {
        drawRid = 'rId1';
        ct.push('<Override PartName="/xl/drawings/drawing' + n + '.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>');
        Z.file('xl/worksheets/_rels/sheet' + n + '.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing' + n + '.xml"/></Relationships>');
        var dr = [], drRels = [];
        s.images.forEach(function (im, k) {
          media++; var mName = 'image' + media + '.png', emu = 9525;
          Z.file('xl/media/' + mName, im.png);
          drRels.push('<Relationship Id="rId' + (k + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/' + mName + '"/>');
          dr.push('<xdr:oneCellAnchor><xdr:from><xdr:col>' + im.c + '</xdr:col><xdr:colOff>' + (im.ox * emu) + '</xdr:colOff><xdr:row>' + im.r + '</xdr:row><xdr:rowOff>' + (im.oy * emu) + '</xdr:rowOff></xdr:from><xdr:ext cx="' + Math.round(im.w * emu) + '" cy="' + Math.round(im.h * emu) + '"/>' +
            '<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="' + (k + 2) + '" name="Grafik ' + (k + 1) + '"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>' +
            '<xdr:blipFill><a:blip r:embed="rId' + (k + 1) + '"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>' +
            '<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + Math.round(im.w * emu) + '" cy="' + Math.round(im.h * emu) + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>');
        });
        Z.file('xl/drawings/drawing' + n + '.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' + dr.join('') + '</xdr:wsDr>');
        Z.file('xl/drawings/_rels/drawing' + n + '.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + drRels.join('') + '</Relationships>');
      }
      Z.file('xl/worksheets/sheet' + n + '.xml', s.xml(drawRid));
    });
    wbRels.push('<Relationship Id="rId' + (this.sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>');
    Z.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' + ct.join('') + '</Types>');
    Z.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>');
    Z.file('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="16000" activeTab="0"/></bookViews><sheets>' + sheetsXml.join('') + '</sheets>' + (defs.length ? '<definedNames>' + defs.join('') + '</definedNames>' : '') + '<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>');
    Z.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + wbRels.join('') + '</Relationships>');
    Z.file('xl/styles.xml', this.styles.xml());
    var now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    Z.file('docProps/core.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + xe(this.meta.title || '') + '</dc:title><dc:subject>' + xe(this.meta.subject || '') + '</dc:subject><dc:creator>' + xe(this.meta.author || 'DharmaImpact') + '</dc:creator><cp:lastModifiedBy>' + xe(this.meta.author || 'DharmaImpact') + '</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">' + now + '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' + now + '</dcterms:modified></cp:coreProperties>');
    Z.file('docProps/app.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Excel</Application><Company>' + xe(this.meta.company || '') + '</Company></Properties>');
    return Z.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', compression: 'DEFLATE' });
  };
  Workbook.prototype.save = async function (fileName) {
    var b = await this.blob(), a = document.createElement('a'), u = URL.createObjectURL(b);
    a.href = u; a.download = fileName; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 1500);
  };

  /* ---------------- Grafik PNG (canvas) ---------------- */
  var PAL = ['#005AAB', '#0F9D8A', '#E8A317', '#3E6DB5', '#95B5DF', '#C2410C', '#7A8BA3', '#16A34A'];
  function canvas(w, h) { var c = document.createElement('canvas'), k = 2; c.width = w * k; c.height = h * k; var x = c.getContext('2d'); x.scale(k, k); x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, w, h); x.textBaseline = 'middle'; return { c: c, x: x, w: w, h: h }; }
  function toPng(cv) { var d = cv.c.toDataURL('image/png').split(',')[1], bin = atob(d), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  function font(x, sz, b) { x.font = (b ? 'bold ' : '') + sz + 'px Arial, Helvetica, sans-serif'; }
  function title(cv, t, sub) { var x = cv.x; font(x, 14, true); x.fillStyle = '#1A2433'; x.textAlign = 'left'; x.fillText(t, 14, 18); if (sub) { font(x, 11); x.fillStyle = '#5B6B7F'; x.fillText(sub, 14, 36); } }
  function cut(x, s, max) { s = String(s || ''); if (x.measureText(s).width <= max) return s; while (s.length > 1 && x.measureText(s + '…').width > max) s = s.slice(0, -1); return s + '…'; }
  var Chart = {
    /** Donat + legenda. segs: [{label, value}] */
    donut: function (segs, o) {
      o = o || {}; var cv = canvas(o.w || 520, o.h || 300), x = cv.x; title(cv, o.title || '', o.sub);
      var top = o.sub ? 50 : 34, R = Math.min(100, (cv.h - top - 14) / 2), r = R * 0.62, cx = 20 + R + 10, cy = top + 6 + R, a0 = -Math.PI / 2;
      var tot = segs.reduce(function (a, s) { return a + Math.max(0, s.value); }, 0);
      if (!tot) { x.strokeStyle = '#EEF2F7'; x.lineWidth = R - r; x.beginPath(); x.arc(cx, cy, (R + r) / 2, 0, Math.PI * 2); x.stroke(); }
      segs.forEach(function (s, i) { var v = Math.max(0, s.value); if (!v) return; var a1 = a0 + v / tot * Math.PI * 2; x.fillStyle = s.color || PAL[i % PAL.length]; x.beginPath(); x.arc(cx, cy, R, a0, a1); x.arc(cx, cy, r, a1, a0, true); x.closePath(); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 2; x.stroke(); a0 = a1; });
      x.textAlign = 'center'; font(x, 10); x.fillStyle = '#5B6B7F'; x.fillText(o.centerTitle || 'TOTAL', cx, cy - 10); font(x, 14, true); x.fillStyle = '#1A2433'; x.fillText(o.centerValue || '', cx, cy + 10);
      var ly = top + 26, lx = cx + R + 30; segs.slice(0, 8).forEach(function (s, i) {
        x.fillStyle = s.color || PAL[i % PAL.length]; x.fillRect(lx, ly - 6, 12, 12);
        x.textAlign = 'left'; font(x, 11.5); x.fillStyle = '#1A2433'; x.fillText(cut(x, s.label, cv.w - lx - 80), lx + 20, ly);
        x.textAlign = 'right'; font(x, 11.5, true); x.fillText(tot ? (s.value / tot * 100).toFixed(1).replace('.', ',') + '%' : '-', cv.w - 14, ly); ly += 26;
      });
      return toPng(cv);
    },
    /** Batang horizontal. rows: [{label, value, target?, color?}] ; o.ref garis acuan */
    barH: function (rows, o) {
      o = o || {}; var rowH = 30, top = o.sub ? 56 : 40, h = Math.max(o.h || 0, top + rows.length * rowH + 30), cv = canvas(o.w || 620, h), x = cv.x; title(cv, o.title || '', o.sub);
      var L = o.left || 150, R = 90, W = cv.w - L - R, max = Math.max(o.ref || 0, Math.max.apply(null, rows.map(function (r) { return Math.max(r.value, r.target || 0); }).concat([0]))) * 1.1 || 1;
      var sx = function (v) { return L + W * Math.max(0, v) / max; }, fmt = o.fmt || function (v) { return String(v); };
      rows.forEach(function (r, i) {
        var y = top + i * rowH;
        x.textAlign = 'right'; font(x, 11.5); x.fillStyle = '#1A2433'; x.fillText(cut(x, r.label, L - 16), L - 10, y + 12);
        x.fillStyle = '#F1F5F9'; x.fillRect(L, y + 3, W, 18); x.fillStyle = r.color || PAL[0]; x.fillRect(L, y + 3, Math.max(2, sx(r.value) - L), 18);
        if (r.target) { x.fillStyle = '#E8A317'; x.fillRect(sx(r.target) - 2, y, 4, 24); }
        x.textAlign = 'left'; font(x, 11.5, true); x.fillStyle = '#1A2433'; x.fillText(fmt(r.value), L + W + 8, y + 12);
      });
      var yb = top + rows.length * rowH + 4;
      if (o.ref) { var rx = sx(o.ref); x.strokeStyle = '#DC2626'; x.setLineDash([4, 3]); x.lineWidth = 1.2; x.beginPath(); x.moveTo(rx, top - 4); x.lineTo(rx, yb); x.stroke(); x.setLineDash([]); }
      font(x, 10.5); x.textAlign = 'left'; var lx = L;
      if (o.ref) { x.fillStyle = '#DC2626'; x.fillText('┆ ' + (o.refLabel || 'Acuan'), lx, yb + 14); lx += 150; }
      if (rows.some(function (r) { return r.target; })) { x.fillStyle = '#E8A317'; x.fillRect(lx, yb + 8, 4, 12); x.fillStyle = '#B45309'; x.fillText(o.targetLabel || 'Target', lx + 10, yb + 14); }
      return toPng(cv);
    },
    /** Kolom berpasangan: groups [{label, a, b}] dengan legenda labelA/labelB */
    columns: function (groups, o) {
      o = o || {}; var cv = canvas(o.w || 520, o.h || 300), x = cv.x; title(cv, o.title || '', o.sub);
      var L = 20, B = 50, T = 70, W = cv.w - L - 20, H = cv.h - T - B, max = Math.max.apply(null, groups.map(function (g) { return Math.max(g.a, g.b); }).concat([1])) * 1.15;
      var gw = W / groups.length, bw = Math.min(70, gw * 0.3), fmt = o.fmt || String;
      x.strokeStyle = '#E2E8F0'; x.beginPath(); x.moveTo(L, T + H); x.lineTo(L + W, T + H); x.stroke();
      groups.forEach(function (g, i) {
        var cx = L + gw * i + gw / 2;
        [[g.a, o.colorA || PAL[0], -1], [g.b, o.colorB || '#16A34A', 1]].forEach(function (s) {
          var bh = H * s[0] / max, bx = cx + (s[2] < 0 ? -bw - 4 : 4);
          x.fillStyle = s[1]; x.fillRect(bx, T + H - bh, bw, bh);
          font(x, 11, true); x.fillStyle = '#1A2433'; x.textAlign = 'center'; x.fillText(fmt(s[0]), bx + bw / 2, T + H - bh - 10);
        });
        font(x, 11.5); x.fillStyle = '#5B6B7F'; x.fillText(g.label, cx, T + H + 16);
      });
      font(x, 11); x.textAlign = 'left'; var ly = cv.h - 14;
      x.fillStyle = o.colorA || PAL[0]; x.fillRect(L, ly - 6, 12, 12); x.fillStyle = '#1A2433'; x.fillText(o.labelA || 'A', L + 18, ly);
      x.fillStyle = o.colorB || '#16A34A'; x.fillRect(L + 150, ly - 6, 12, 12); x.fillStyle = '#1A2433'; x.fillText(o.labelB || 'B', L + 168, ly);
      return toPng(cv);
    }
  };

  /* ---------------- Gaya standar laporan ---------------- */
  function theme() {
    var ui = G.UI || {};
    return { pri: hex(ui.color_primary || '#005AAB'), dark: hex(ui.color_sidebar || '#0A3D73'), tint: 'EAF2FB', zebra: 'F8FAFC', line: 'CBD5E1', text: '1A2433', muted: '5B6B7F', red: 'B91C1C', redBg: 'FEE2E2', green: '15803D', greenBg: 'DCFCE7', amberBg: 'FEF3C7' };
  }
  var RP = '"Rp" #,##0;[Red]-"Rp" #,##0;"Rp" 0', NUM = '#,##0;[Red]-#,##0;0', DEC = '#,##0.00', PCT = '0.0%', RATIO = '0.00" : 1"';
  function S(T) {
    var B = { all: { s: 'thin', c: T.line } };
    return {
      title: { font: { b: true, sz: 16, color: 'FFFFFF' }, fill: T.dark, v: 'center', indent: 1 },
      band: { fill: T.dark },
      sub: { font: { sz: 10, color: 'FFFFFF' }, fill: T.dark, v: 'center', indent: 1 },
      draft: { font: { b: true, sz: 10, color: T.red }, fill: T.redBg, v: 'center', indent: 1 },
      final: { font: { b: true, sz: 10, color: T.green }, fill: T.greenBg, v: 'center', indent: 1 },
      sec: { font: { b: true, sz: 12, color: T.pri }, border: { b: { s: 'medium', c: T.pri } }, v: 'bottom' },
      secLine: { border: { b: { s: 'medium', c: T.pri } } },
      note: { font: { i: true, sz: 9, color: T.muted }, wrap: false },
      th: { font: { b: true, sz: 10, color: 'FFFFFF' }, fill: T.pri, border: B, h: 'center', v: 'center', wrap: true },
      td: { border: B, v: 'top', wrap: true },
      tdz: { border: B, v: 'top', wrap: true, fill: T.zebra },
      tdc: { border: B, v: 'top', h: 'center' },
      tdcz: { border: B, v: 'top', h: 'center', fill: T.zebra },
      key: { font: { b: true, color: T.text }, fill: T.zebra, border: B, v: 'top', wrap: true },
      val: { border: B, v: 'top', wrap: true },
      rpL: { border: B, v: 'top', fmt: RP, h: 'left' },
      tdcw: { border: B, v: 'top', h: 'center', wrap: true }, tdcwz: { border: B, v: 'top', h: 'center', wrap: true, fill: T.zebra },
      tileVD: { font: { sz: 16, b: true, color: T.pri }, fill: T.tint, border: { l: { s: 'thin', c: T.line }, r: { s: 'thin', c: T.line } }, h: 'left', v: 'center', indent: 1, fmt: '0.00;[Red]-0.00' },
      rp: { border: B, v: 'top', fmt: RP }, rpz: { border: B, v: 'top', fmt: RP, fill: T.zebra },
      num: { border: B, v: 'top', fmt: NUM }, numz: { border: B, v: 'top', fmt: NUM, fill: T.zebra },
      dec: { border: B, v: 'top', fmt: DEC }, decz: { border: B, v: 'top', fmt: DEC, fill: T.zebra },
      pct: { border: B, v: 'top', fmt: PCT }, pctz: { border: B, v: 'top', fmt: PCT, fill: T.zebra },
      tot: { font: { b: true, color: T.dark }, fill: T.tint, border: { all: { s: 'thin', c: T.line }, t: { s: 'medium', c: T.pri } }, v: 'center' },
      totRp: { font: { b: true, color: T.dark }, fill: T.tint, border: { all: { s: 'thin', c: T.line }, t: { s: 'medium', c: T.pri } }, fmt: RP, v: 'center' },
      totNum: { font: { b: true, color: T.dark }, fill: T.tint, border: { all: { s: 'thin', c: T.line }, t: { s: 'medium', c: T.pri } }, fmt: NUM, v: 'center' },
      totPct: { font: { b: true, color: T.dark }, fill: T.tint, border: { all: { s: 'thin', c: T.line }, t: { s: 'medium', c: T.pri } }, fmt: PCT, v: 'center' },
      sub2: { font: { b: true, color: T.text }, fill: 'F1F5F9', border: B, v: 'center' },
      sub2Rp: { font: { b: true, color: T.text }, fill: 'F1F5F9', border: B, fmt: RP, v: 'center' },
      tileL: { font: { sz: 9, b: true, color: T.muted }, fill: T.tint, border: { t: { s: 'medium', c: T.pri }, l: { s: 'thin', c: T.line }, r: { s: 'thin', c: T.line } }, h: 'left', v: 'center', indent: 1 },
      tileV: { font: { sz: 16, b: true, color: T.pri }, fill: T.tint, border: { l: { s: 'thin', c: T.line }, r: { s: 'thin', c: T.line } }, h: 'left', v: 'center', indent: 1 },
      tileVR: { font: { sz: 16, b: true, color: T.pri }, fill: T.tint, border: { l: { s: 'thin', c: T.line }, r: { s: 'thin', c: T.line } }, h: 'left', v: 'center', indent: 1, fmt: RATIO },
      tileVRp: { font: { sz: 13, b: true, color: T.pri }, fill: T.tint, border: { l: { s: 'thin', c: T.line }, r: { s: 'thin', c: T.line } }, h: 'left', v: 'center', indent: 1, fmt: RP },
      tileVRpG: { font: { sz: 13, b: true, color: T.green }, fill: T.tint, border: { l: { s: 'thin', c: T.line }, r: { s: 'thin', c: T.line } }, h: 'left', v: 'center', indent: 1, fmt: RP },
      tileF: { font: { sz: 9, color: T.muted }, fill: T.tint, border: { b: { s: 'thin', c: T.line }, l: { s: 'thin', c: T.line }, r: { s: 'thin', c: T.line } }, h: 'left', v: 'center', indent: 1, wrap: true },
      sign: { border: { all: { s: 'thin', c: T.line } }, v: 'top', wrap: true, font: { sz: 9, color: T.muted }, indent: 1 },
      signName: { border: { l: { s: 'thin', c: T.line }, r: { s: 'thin', c: T.line } }, v: 'bottom', font: { b: true, color: T.text }, indent: 1 },
      signOrg: { border: { l: { s: 'thin', c: T.line }, r: { s: 'thin', c: T.line }, b: { s: 'thin', c: T.line } }, v: 'top', font: { sz: 9, color: T.muted }, indent: 1 },
      plain: { v: 'top', wrap: true }, muted: { font: { sz: 9, color: T.muted }, v: 'top', wrap: true },
      okChip: { font: { b: true, color: T.green }, fill: T.greenBg, border: B, h: 'center', v: 'top' },
      warnChip: { font: { b: true, color: 'B45309' }, fill: T.amberBg, border: B, h: 'center', v: 'top' },
      redChip: { font: { b: true, color: T.red }, fill: T.redBg, border: B, h: 'center', v: 'top' }
    };
  }
  /** Kop standar di setiap sheet: judul, sub-judul, pita status. Mengembalikan baris berikutnya. */
  function kop(sh, st, nCols, judul, sub, status) {
    sh.height(0, 30).height(1, 18).height(2, 20);
    sh.merge(0, 0, 0, nCols - 1, judul, st.title);
    sh.merge(1, 0, 1, nCols - 1, sub, st.sub);
    var final = status === 'Disetujui';
    sh.merge(2, 0, 2, nCols - 1, final ? '✔ DISETUJUI & TERKUNCI — hasil resmi' : '⚠ DOKUMEN SEMENTARA — BELUM DISETUJUI  •  Status: ' + (status || '-') + '  •  angka dapat berubah sampai disetujui kantor pusat', final ? st.final : st.draft);
    return 4;
  }
  function section(sh, st, r, nCols, text) { sh.height(r, 22); sh.merge(r, 0, r, nCols - 1, text, st.sec); return r + 1; }
  /** Tabel: head [..], rows [[..]], kinds ['td'|'rp'|'num'|'pct'|'dec'|'tdc'] ; zebra otomatis. */
  function table(sh, st, r, c0, head, rows, kinds, opt) {
    opt = opt || {};
    sh.height(r, opt.headH || 30); sh.row(r, c0, head, st.th); r++;
    rows.forEach(function (row, i) {
      var z = i % 2 === 1;
      row.forEach(function (v, j) {
        var k = (kinds && kinds[j]) || 'td', key = k + (z ? 'z' : '');
        if (v && typeof v === 'object' && v.st) { sh.set(r, c0 + j, v.v, st[v.st]); return; }
        sh.set(r, c0 + j, v, st[key] || st[k] || st.td);
      });
      r++;
    });
    if (!rows.length) { sh.merge(r, c0, r, c0 + head.length - 1, opt.empty || '— belum ada data —', st.tdc); r++; }
    return r;
  }

  G.XStd = { Workbook: Workbook, Chart: Chart, theme: theme, S: S, kop: kop, section: section, table: table, fmt: { RP: RP, NUM: NUM, DEC: DEC, PCT: PCT, RATIO: RATIO }, colName: colName };
})(window);

/* =====================================================================
 * LAPORAN EXCEL STANDAR — per perhitungan cabang & rekap seluruh cabang
 * ===================================================================== */
(function (G) {
  'use strict';
  var X = G.XStd;
  function N(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function lines(t, w) { return String(t == null ? '' : t).split('\n').reduce(function (a, s) { return a + Math.max(1, Math.ceil(s.length * 1.08 / Math.max(4, w))); }, 0); }
  /** Perkirakan tinggi baris dari teks terpanjang (Excel tidak auto-fit saat membuka berkas). */
  function fitH(sh, r, specs, min) { var n = 1; specs.forEach(function (s) { n = Math.max(n, lines(s[0], s[1])); }); sh.height(r, Math.max(min || 16, Math.min(400, 13.2 * n + 5))); }
  function widthOf(sh, c1, c2) { var w = 0; for (var c = c1; c <= c2; c++) w += sh.widths[c] || 9; return w; }
  function stars(b) { b = Math.max(0, Math.min(5, Math.round(N(b)))); return '★★★★★'.slice(0, b) + '☆☆☆☆☆'.slice(0, 5 - b); }
  /** Pasangan label–nilai: label di kolom c0..c0+kw-1, nilai di sisanya sampai cEnd. */
  function kv(sh, st, r, c0, kw, cEnd, pairs) {
    pairs.forEach(function (p) {
      var v = p[1] == null || p[1] === '' ? '-' : p[1], vs = p[2] ? st[p[2]] : st.val;
      sh.merge(r, c0, r, c0 + kw - 1, p[0], st.key); sh.merge(r, c0 + kw, r, cEnd, v, vs);
      fitH(sh, r, [[v, widthOf(sh, c0 + kw, cEnd)], [p[0], widthOf(sh, c0, c0 + kw - 1)]]); r++;
    });
    return r;
  }
  function autoRows(sh, r0, r1, c0, nC) { for (var r = r0; r < r1; r++) { var cells = sh.rows[r] || {}, specs = []; for (var c = c0; c < c0 + nC; c++) if (cells[c] && typeof cells[c].v === 'string') specs.push([cells[c].v, sh.widths[c] || 9]); if (specs.length) fitH(sh, r, specs); } }
  function finish(sh, footLeft) { sh.footer = '&L&8' + footLeft + '&R&8Hal. &P / &N'; }
  function tile(sh, st, r, c, w, label, value, vStyle, foot) {
    sh.merge(r, c, r, c + w - 1, label, st.tileL); sh.merge(r + 1, c, r + 1, c + w - 1, value, st[vStyle] || st.tileV); sh.merge(r + 2, c, r + 2, c + w - 1, foot || '', st.tileF);
  }

  var Lap = {
    /** Excel per perhitungan cabang. env: {d, r, ctx, cab, M, SroiEngine, target, org, pkText, pkF, pkPorsi} */
    proyek: async function (env) {
      var d = env.d, p = d.proyek, r = env.r, ctx = env.ctx, cab = env.cab || {}, M = env.M, T = X.theme(), st = X.S(T);
      var wb = new X.Workbook({ title: 'Laporan SROI ' + (cab.nama_cabang || '') + ' ' + p.tahun, subject: 'Social Return on Investment', company: env.org });
      var judul = 'LAPORAN PERHITUNGAN SOCIAL RETURN ON INVESTMENT (SROI)';
      var subj = (env.org || 'DharmaImpact') + '  •  Cabang ' + (cab.nama_cabang || '-') + '  •  Tahun ' + p.tahun + '  •  Doc. No: ' + (p.doc_number || '-') + '  Rev. ' + (p.doc_rev || '0');
      var foot = 'DharmaImpact • SroiEngine v' + env.SroiEngine.VERSION + ' • ' + (p.status === 'Disetujui' ? 'Hasil resmi' : 'Hasil sementara') + ' • Dicetak ' + new Date().toLocaleString('id-ID');
      var shName = function (sid) { var s = d.stakeholder.filter(function (x) { return x.sh_id === sid; })[0]; return s ? s.nama : '-'; };
      var kegName = function (kid) { if (kid === '*') return 'Semua kegiatan'; var g = d.kegiatan.filter(function (x) { return x.kegiatan_id === kid; })[0]; return g ? g.nama_kegiatan : '-'; };
      var tgt = N(env.target), capT = tgt ? r.rasio / tgt : 0;

      /* ===== 1. RINGKASAN (cover + dashboard) ===== */
      var s1 = wb.sheet('Ringkasan'); s1.tab = T.dark; s1.cols([15, 15, 15, 15, 15, 15, 15, 15]);
      var y = X.kop(s1, st, 8, judul, subj, p.status);
      y = X.section(s1, st, y, 8, 'IDENTITAS LAPORAN');
      y = kv(s1, st, y, 0, 2, 7, [['Nama Program', p.nama_program], ['Cabang / Lokasi', (cab.nama_cabang || '-') + (p.lokasi ? ' — ' + p.lokasi : '')], ['Periode Program', (p.periode_awal || '-') + ' s.d. ' + (p.periode_akhir || '-')],
        ['Tanggal Pengukuran', p.tgl_pengukuran], ['Metode Penilaian', p.metode], ['Status Dokumen', p.status + (p.status === 'Disetujui' ? ' — disetujui ' + (p.disetujui_at || '') + ' oleh ' + (p.disetujui_oleh || 'Super Admin') : ' (sementara)')]]);
      y++; y = X.section(s1, st, y, 8, 'HASIL UTAMA');
      s1.height(y, 18).height(y + 1, 30).height(y + 2, 28);
      tile(s1, st, y, 0, 2, 'RASIO SROI (' + r.params.rumus + ')', +r.rasio.toFixed(4), 'tileVR', 'Setiap Rp1 investasi menghasilkan ±Rp' + r.rasio.toFixed(2).replace('.', ',') + ' manfaat sosial');
      tile(s1, st, y, 2, 2, 'KATEGORI DAMPAK', stars(r.bintang), 'tileV', 'Bintang ' + r.bintang + ' — ' + r.bintangLabel);
      tile(s1, st, y, 4, 2, 'TOTAL INVESTASI (PV)', Math.round(r.pvInvestasi), 'tileVRp', 'Nominal Rp' + Math.round(r.totalInvestasi).toLocaleString('id-ID'));
      tile(s1, st, y, 6, 2, 'TOTAL MANFAAT (PV)', Math.round(r.pvImpact), 'tileVRpG', 'Nominal Rp' + Math.round(r.totalImpact).toLocaleString('id-ID'));
      y += 4; s1.height(y, 18).height(y + 1, 30).height(y + 2, 28);
      tile(s1, st, y, 0, 2, 'TARGET SROI ' + p.tahun, tgt ? tgt : '-', tgt ? 'tileVR' : 'tileV', tgt ? (r.rasio >= tgt ? '✔ Target tercapai' : 'Belum mencapai target') : 'Target belum ditetapkan pusat');
      tile(s1, st, y, 2, 2, 'CAPAIAN TERHADAP TARGET', tgt ? (capT * 100).toFixed(0) + '%' : '-', 'tileV', tgt ? 'Rasio aktual ÷ target' : '');
      tile(s1, st, y, 4, 2, 'RASIO BERSIH', +r.rasioBersih.toFixed(4), 'tileVD', '(PV Impact − PV Investasi) ÷ PV Investasi');
      tile(s1, st, y, 6, 2, 'UMKM BINAAN', N(d.umkm.length), 'tileV', 'Discount rate ' + (r.params.r * 100).toFixed(2).replace('.', ',') + '%');
      y += 4; y = X.section(s1, st, y, 8, 'VISUALISASI');
      var segs = r.sebaran.map(function (s) { return { label: s.nama, value: s.nilai }; });
      try {
        s1.image(X.Chart.donut(segs, { w: 440, h: 270, title: 'Sebaran Manfaat per Stakeholder', sub: 'Porsi PV impact', centerTitle: 'PV IMPACT', centerValue: env.rpShort(r.pvImpact) }), y, 0, 440, 270, 4, 6);
        s1.image(X.Chart.columns([{ label: 'Nominal', a: r.totalInvestasi, b: r.totalImpact }, { label: 'Present Value', a: r.pvInvestasi, b: r.pvImpact }], { w: 440, h: 270, title: 'Investasi vs Manfaat', sub: 'Rupiah', labelA: 'Investasi', labelB: 'Manfaat (Impact)', fmt: env.rpShort }), y, 4, 440, 270, 4, 6);
      } catch (e) { console.warn('grafik', e); }
      for (var i = 0; i < 14; i++) s1.height(y + i, 20);
      y += 14;
      var kp = r.kpi.perKpi.filter(function (k) { return N(k.targetCabang) > 0; });
      if (kp.length) {
        try { s1.image(X.Chart.barH(kp.map(function (k) { return { label: k.nama, value: k.capaian * 100, color: k.capaian >= 1 ? '#16A34A' : '#' + T.pri }; }), { w: 890, title: 'Capaian KPI Cabang (realisasi ÷ target)', sub: 'Persen — garis merah = 100% target', ref: 100, refLabel: '100% target', left: 220, fmt: function (v) { return v.toFixed(0) + '%'; } }), y, 0, 890, Math.max(150, 56 + kp.length * 30 + 30), 4, 6); } catch (e) { }
        var kh = Math.ceil((Math.max(150, 56 + kp.length * 30 + 30) + 12) / 20); for (var j = 0; j < kh; j++) s1.height(y + j, 20); y += kh;
      }
      y++; s1.breaks.push(y); y = X.section(s1, st, y, 8, 'PENGESAHAN');
      [['Disiapkan oleh (PIC Pelaksana)', p.pic_mitra || p.project_owner || '', p.mitra_pelaksana || ('PPU ' + (cab.nama_cabang || ''))], ['Diverifikasi oleh (Mitra Penilai)', p.tim_leader_penilai || '', p.mitra_penilai || '']].forEach(function (b, i2) {
        var c = i2 * 4;
        s1.merge(y, c, y, c + 3, b[0], st.sign); s1.merge(y + 1, c, y + 1, c + 3, '', st.signName); s1.merge(y + 2, c, y + 2, c + 3, b[1] || '(...................................)', st.signName); s1.merge(y + 3, c, y + 3, c + 3, b[2] || '', st.signOrg);
      });
      s1.height(y, 18).height(y + 1, 46).height(y + 2, 18).height(y + 3, 18); y += 5;
      s1.merge(y, 0, y, 7, 'Catatan: Rasio SROI = Σ PV Impact ÷ Σ PV Investasi (rumus ' + r.params.rumus + '). Rincian perhitungan ada di sheet berikutnya: Informasi Umum, Impact Map, Input, Output, Detail Program, dan Lampiran-Cost Structure.', st.muted); fitH(s1, y, [[s1.rows[y][0].v, 110]]);
      finish(s1, foot);

      /* ===== 2. INFORMASI UMUM ===== */
      var s2 = wb.sheet('Informasi Umum'); s2.tab = T.pri; s2.cols([6, 26, 18, 20, 44]);
      y = X.kop(s2, st, 5, 'INFORMASI UMUM', subj, p.status);
      y = X.section(s2, st, y, 5, 'A. DATA PROGRAM');
      y = kv(s2, st, y, 0, 2, 4, [['Nama Program', p.nama_program], ['Nama Project', p.nama_project], ['Project Owner', p.project_owner], ['Lokasi', p.lokasi], ['Tautan Google Maps', p.gmaps_url],
        ['Periode Program', (p.periode_awal || '-') + ' s.d. ' + (p.periode_akhir || '-')], ['Tanggal Pengukuran', p.tgl_pengukuran], ['Metode', p.metode], ['Mitra Pelaksana', p.mitra_pelaksana], ['PIC Mitra / No. HP', (p.pic_mitra || '-') + (p.hp_pic ? ' / ' + p.hp_pic : '')],
        ['Mitra Penilai', p.mitra_penilai], ['Tim Leader Penilai / No. HP', (p.tim_leader_penilai || '-') + (p.hp_penilai ? ' / ' + p.hp_penilai : '')], ['Tujuan Program', p.tujuan], ['Aktivitas Utama', p.aktivitas],
        ['Budget Program', Math.round(N(ctx.budget)), 'rpL'], ['UMK (Rp/bulan)', Math.round(N(ctx.umk)), 'rpL']]);
      y++; y = X.section(s2, st, y, 5, 'B. STAKEHOLDER');
      var r0 = y + 1; y = X.table(s2, st, y, 0, ['No', 'Nama Stakeholder', 'Peran', 'Kelompok Sektor', 'Alasan Penyertaan'], d.stakeholder.map(function (s, i) { return [i + 1, s.nama, s.peran, s.kelompok_sektor ? M.sektorName(s.kelompok_sektor) : '-', s.alasan_penyertaan || '-']; }), ['tdc', 'td', 'td', 'td', 'td']);
      autoRows(s2, r0, y, 0, 5);
      y++; y = X.section(s2, st, y, 5, 'C. HASIL PERHITUNGAN');
      y = kv(s2, st, y, 0, 2, 4, [['Total Investasi (nominal)', Math.round(r.totalInvestasi), 'rpL'], ['PV Investasi', Math.round(r.pvInvestasi), 'rpL'], ['Total Impact (nominal)', Math.round(r.totalImpact), 'rpL'], ['PV Impact', Math.round(r.pvImpact), 'rpL'],
        ['Rasio SROI (' + r.params.rumus + ')', r.rasio.toFixed(2).replace('.', ',') + ' : 1'], ['Rasio Klasik / Bersih', r.rasioKlasik.toFixed(2).replace('.', ',') + ' / ' + r.rasioBersih.toFixed(2).replace('.', ',')], ['Kategori', stars(r.bintang) + '  Bintang ' + r.bintang + ' — ' + r.bintangLabel],
        ['Target SROI ' + p.tahun, tgt ? tgt.toFixed(2).replace('.', ',') + ' : 1  (capaian ' + (capT * 100).toFixed(0) + '%)' : 'Belum ditetapkan'], ['Discount rate', (r.params.r * 100).toFixed(2).replace('.', ',') + '%']]);
      y++; y = X.section(s2, st, y, 5, 'D. SEBARAN MANFAAT PER STAKEHOLDER');
      r0 = y + 1; y = X.table(s2, st, y, 0, ['No', 'Stakeholder', 'Peran', 'PV Impact', 'Porsi'], r.sebaran.map(function (s, i) { return [i + 1, s.nama, s.peran, Math.round(s.nilai), s.porsi]; }), ['tdc', 'td', 'td', 'rp', 'pct']);
      if (r.sebaran.length) { s2.row(y, 0, ['', 'TOTAL', '', Math.round(r.pvImpact), 1], [st.tot, st.tot, st.tot, st.totRp, st.totPct]); y++; }
      y++; y = X.section(s2, st, y, 5, 'E. PENJELASAN KUALITATIF');
      s2.merge(y, 0, y, 4, p.penjelasan_kualitatif || '-', st.val); fitH(s2, y, [[p.penjelasan_kualitatif || '-', 110]], 40); y++;
      s2.printTitle = null; finish(s2, foot);

      /* ===== 3. IMPACT MAP ===== */
      var s3 = wb.sheet('Impact Map'); s3.tab = '0F9D8A'; s3.landscape = true;
      s3.cols([5, 20, 18, 22, 30, 16, 16, 18, 8, 13, 16, 18, 12, 16, 22, 12, 12, 12, 12, 16, 16]);
      y = X.kop(s3, st, 21, 'IMPACT MAP', subj, p.status);
      var hR = y; s3.freeze = { r: hR + 1, c: 2 }; s3.printTitle = [hR, hR];
      r0 = y + 1;
      y = X.table(s3, st, y, 0, ['No', 'Stakeholder', 'Input', 'Output', 'Outcome', 'Indikator Sebelum', 'Indikator Sesudah', 'Sumber Informasi', 'Durasi (th)', 'Mulai', 'Jenis Proksi', 'Sumber Proksi', 'Porsi', 'Nilai Proksi (setelah porsi)', 'Catatan Proksi', 'DW', 'DS', 'AT', 'DO', 'Impact Tahun-1', 'PV Impact'],
        d.outcome.map(function (o, i) {
          var h = r.outcome[o.outcome_id] || {};
          return [i + 1, shName(o.sh_id), o.input_ref || '-', o.output_ringkas || '-', o.deskripsi_outcome || '-', o.indikator_sebelum || '-', o.indikator_sesudah || '-', o.sumber_informasi || '-', N(o.durasi_tahun) || 1, N(o.mulai) === 2 ? 'Setelah aktivitas' : 'Saat aktivitas',
            env.pkText(h), (h.komponen || []).map(function (c) { return String(c.ref || '').split(',').map(function (x) { x = x.trim(); return x === 'ALL' ? 'Semua' : x.indexOf('SEK:') === 0 ? 'Sektor ' + M.sektorName(x.slice(4)) : x; }).join(', '); }).filter(Boolean).join(' | ') || '-', env.pkPorsi(h), Math.round(h.nilai_porsi || 0), (h.komponen || []).map(function (c) { return c.notes; }).filter(Boolean).concat(o.proxy_notes ? [o.proxy_notes] : []).join(' | ') || '-',
            env.pkF(h, 'dw'), env.pkF(h, 'ds'), env.pkF(h, 'at'), env.pkF(h, 'do'), Math.round(h.impact || 0), Math.round(h.pv || 0)];
        }), ['tdc', 'td', 'td', 'td', 'td', 'td', 'td', 'td', 'tdc', 'td', 'td', 'td', 'tdcw', 'rp', 'td', 'tdcw', 'tdcw', 'tdcw', 'tdcw', 'rp', 'rp'], { headH: 34 });
      autoRows(s3, r0, y, 0, 21);
      if (d.outcome.length) { var tr = new Array(21).fill(''); tr[1] = 'TOTAL'; tr[19] = Math.round(r.totalImpact); tr[20] = Math.round(r.pvImpact); s3.row(y, 0, tr, tr.map(function (_, k) { return k >= 19 ? st.totRp : st.tot; })); s3.height(y, 20); y++; }
      y++; s3.merge(y, 0, y, 20, 'Impact per proksi = nilai proksi × porsi × (1−DW)(1−DS)(1−AT)(1−DO). Impact outcome = jumlah impact seluruh proksinya; tahun berikutnya berkurang sesuai DO tiap proksi. PV = Σ impact ÷ (1+r)^n.', st.muted);
      finish(s3, foot);

      /* ===== 4. INPUT ===== */
      var s4 = wb.sheet('Input'); s4.tab = 'E8A317'; s4.landscape = true; s4.cols([24, 18, 26, 13, 26, 8, 15, 17, 26]);
      y = X.kop(s4, st, 9, 'INPUT — INVESTASI PER STAKEHOLDER', subj, p.status);
      s4.freeze = { r: y + 1, c: 0 }; s4.printTitle = [y, y];
      s4.height(y, 30); s4.row(y, 0, ['Stakeholder', 'Kelompok', 'Komponen', 'Metode', 'Kegiatan / Program', 'Qty', 'Tarif', 'Nilai', 'Keterangan'], st.th); y++;
      var anyIn = false;
      d.stakeholder.forEach(function (s) {
        var rowsS = [];
        d.biaya.filter(function (b) { return b.sh_id === s.sh_id; }).forEach(function (b) { rowsS.push([s.nama, b.kelompok || '-', b.komponen || '-', b.metode || '-', kegName(b.kegiatan_id), N(b.qty) || '', N(b.tarif) || '', Math.round(r.biaya[b.biaya_id] || 0), b.keterangan || '']); });
        d.kegiatan.filter(function (g) { return g.sh_pembiaya_id === s.sh_id && N(g.biaya); }).forEach(function (g) { rowsS.push([s.nama, 'Biaya Kegiatan', g.nama_kegiatan, 'KEGIATAN', M.programName(g.program_id), '', '', N(g.biaya), '']); });
        if (!rowsS.length) return; anyIn = true;
        rowsS.forEach(function (row, i) { var z = i % 2 ? 'z' : ''; s4.row(y, 0, row, [st['td' + z], st['td' + z], st['td' + z], st['tdc' + z], st['td' + z], st['num' + z], st['rp' + z], st['rp' + z], st['td' + z]]); fitH(s4, y, [[row[2], 26], [row[4], 26], [row[8], 26]]); y++; });
        var it = r.investasiPerSh.filter(function (x) { return x.sh_id === s.sh_id; })[0];
        s4.row(y, 0, ['Subtotal ' + s.nama, '', '', '', '', '', '', Math.round(it ? it.nilai : 0), ''], [st.sub2, st.sub2, st.sub2, st.sub2, st.sub2, st.sub2, st.sub2, st.sub2Rp, st.sub2]); y++;
      });
      if (!anyIn) { s4.merge(y, 0, y, 8, '— belum ada data investasi —', st.tdc); y++; }
      s4.row(y, 0, ['TOTAL INVESTASI (nominal)', '', '', '', '', '', '', Math.round(r.totalInvestasi), ''], [st.tot, st.tot, st.tot, st.tot, st.tot, st.tot, st.tot, st.totRp, st.tot]); y++;
      s4.row(y, 0, ['PV INVESTASI', '', '', '', '', '', '', Math.round(r.pvInvestasi), ''], [st.tot, st.tot, st.tot, st.tot, st.tot, st.tot, st.tot, st.totRp, st.tot]); y++;
      finish(s4, foot);

      /* ===== 5. OUTPUT ===== */
      var s5 = wb.sheet('Output'); s5.tab = '3E6DB5'; s5.landscape = true; s5.cols([28, 18, 18, 18, 12, 18, 16, 10, 10, 10, 18]);
      var PN = { border: { all: { s: 'thin', c: T.line } }, v: 'top', fmt: '0.0"%"' };
      st.pctN = PN; st.pctNz = Object.assign({}, PN, { fill: T.zebra });
      y = X.kop(s5, st, 11, 'OUTPUT — NILAI PROKSI MANFAAT', subj, p.status);
      y = X.section(s5, st, y, 11, 'A. PROKSI KPI × BUDGET (F3)');
      y = X.table(s5, st, y, 0, ['KPI', 'Bobot', 'Proksi (F3)'], r.kpi.perKpi.map(function (k) { return [k.nama, { v: N(k.bobot), st: 'pctN' }, Math.round(k.total)]; }), ['td', 'num', 'rp']);
      s5.row(y, 0, ['Total', '', Math.round(r.kpi.total)], [st.tot, st.tot, st.totRp]); y += 2;
      y = X.section(s5, st, y, 11, 'B. BENCHMARK PELATIHAN & PENDAMPINGAN (F5)');
      y = X.table(s5, st, y, 0, ['Kegiatan', 'Biaya Internal / Peserta', 'Expert Pembanding', 'Biaya Expert / Peserta', 'Peserta', 'Benefit (F5)'], d.benchmark.map(function (b) { var h = r.benchmark[b.bm_id] || {}; return [kegName(b.kegiatan_id), N(b.biaya_internal_per_peserta), b.nama_expert || '-', N(b.biaya_expert_per_peserta), h.peserta || 0, Math.round(h.nilai || 0)]; }), ['td', 'rp', 'td', 'rp', 'num', 'rp']);
      s5.row(y, 0, ['Total', '', '', '', '', Math.round(r.benchmarkTotal)], [st.tot, st.tot, st.tot, st.tot, st.tot, st.totRp]); y += 2;
      y = X.section(s5, st, y, 11, 'C. KENAIKAN NET PROFIT UMKM (F6–F8)');
      y = X.table(s5, st, y, 0, ['UMKM', 'Sektor', 'Omset Sebelum', 'Omset Sesudah', 'Margin', '∆ Net Profit (F6)', 'DW', 'DS', 'AT', 'DO', 'Impact (F7)'], d.omset.map(function (o) {
        var h = r.omset[o.umkm_id] || {}, u = d.umkm.filter(function (x) { return x.umkm_id === o.umkm_id; })[0] || {};
        return [u.nama_umkm || '-', M.sektorName(u.sektor_id), N(o.omset_sebelum), N(o.omset_sesudah), { v: N(o.margin_profit), st: 'pctN' }, Math.round(h.f6 || 0), { v: N(o.dw), st: 'pctN' }, { v: N(o.ds), st: 'pctN' }, { v: N(o.at), st: 'pctN' }, { v: N(o['do']), st: 'pctN' }, Math.round(h.f7 || 0)];
      }), ['td', 'td', 'rp', 'rp', 'td', 'rp', 'td', 'td', 'td', 'td', 'rp']);
      var trr = new Array(11).fill(''); trr[0] = 'Total (F8)'; trr[10] = Math.round(r.netProfit); s5.row(y, 0, trr, trr.map(function (_, k) { return k === 10 ? st.totRp : st.tot; })); y += 2;
      y = X.section(s5, st, y, 11, 'D. MANFAAT STAKEHOLDER LAIN');
      r0 = y + 1; y = X.table(s5, st, y, 0, ['Stakeholder', 'Parameter', 'Metode', 'Nilai A', 'Nilai B', 'Hasil', 'Keterangan'], d.manfaat.map(function (m) { return [shName(m.sh_id), m.parameter || '-', m.metode || '-', N(m.nilai_a), N(m.nilai_b), Math.round(r.manfaat[m.mf_id] || 0), m.keterangan || '']; }), ['td', 'td', 'td', 'num', 'num', 'rp', 'td']);
      autoRows(s5, r0, y, 0, 7);
      finish(s5, foot);

      /* ===== 6. DETAIL PROGRAM ===== */
      var kg = d.kegiatan, hm = {}; d.kehadiran.forEach(function (h) { hm[h.umkm_id + '|' + h.kegiatan_id] = N(h.jumlah); });
      var s6 = wb.sheet('Detail Program'); s6.tab = '7A8BA3'; s6.landscape = true; s6.cols([24, 32, 16, 12, 17, 22, 10]);
      var peserta = function (g) { var s0 = r.kegiatanStat[g.kegiatan_id] || {}; return N(g.jumlah_peserta) || s0.peserta || 0; };
      y = X.kop(s6, st, 7, 'DETAIL PROGRAM — KEGIATAN', subj, p.status);
      y = X.section(s6, st, y, 7, 'A. KEGIATAN PER PROGRAM');
      r0 = y + 1; y = X.table(s6, st, y, 0, ['Program', 'Kegiatan', 'Waktu', 'Durasi (hari)', 'Biaya', 'Penanggung Biaya', 'Peserta'], kg.map(function (g) { return [M.programName(g.program_id), g.nama_kegiatan || '-', g.waktu || '-', N(g.durasi_hari), N(g.biaya), shName(g.sh_pembiaya_id), peserta(g)]; }), ['td', 'td', 'td', 'num', 'rp', 'td', 'num']);
      autoRows(s6, r0, y, 0, 7);
      if (kg.length) { s6.row(y, 0, ['Total', '', '', kg.reduce(function (a, g) { return a + N(g.durasi_hari); }, 0), kg.reduce(function (a, g) { return a + N(g.biaya); }, 0), '', kg.reduce(function (a, g) { return a + peserta(g); }, 0)], [st.tot, st.tot, st.tot, st.totNum, st.totRp, st.tot, st.totNum]); y++; }
      y++; y = X.section(s6, st, y, 7, 'B. RINGKASAN PER PROGRAM');
      var byPg = {}; kg.forEach(function (g) { var k = g.program_id || '-'; (byPg[k] = byPg[k] || { n: 0, b: 0, p: 0, d: 0 }); byPg[k].n++; byPg[k].b += N(g.biaya); byPg[k].p += peserta(g); byPg[k].d += N(g.durasi_hari); });
      y = X.table(s6, st, y, 0, ['Program', 'Jumlah Kegiatan', 'Total Durasi (hari)', 'Total Biaya', 'Total Peserta'], Object.keys(byPg).map(function (k) { return [M.programName(k), byPg[k].n, byPg[k].d, byPg[k].b, byPg[k].p]; }), ['td', 'num', 'num', 'rp', 'num']);
      finish(s6, foot);

      /* ===== 6b. KEHADIRAN UMKM ===== */
      var s6b = wb.sheet('Kehadiran UMKM'); s6b.tab = '95B5DF'; s6b.landscape = true;
      var nCb = Math.max(6, 5 + kg.length);
      s6b.cols([6, 30, 16, 16].concat(kg.map(function () { return 13; })).concat([10]));
      y = X.kop(s6b, st, nCb, 'MATRIKS KEHADIRAN UMKM PER KEGIATAN', subj, p.status);
      s6b.freeze = { r: y + 1, c: 2 }; s6b.printTitle = [y, y];
      var mh = ['No', 'UMKM', 'Sektor', 'Status Khusus'].concat(kg.map(function (g) { return g.nama_kegiatan || '-'; })).concat(['Total']);
      y = X.table(s6b, st, y, 0, mh, d.umkm.map(function (u, i) { var tot = 0, cells = kg.map(function (g) { var v = hm[u.umkm_id + '|' + g.kegiatan_id] || 0; tot += v; return v || ''; }); return [i + 1, u.nama_umkm || '-', M.sektorName(u.sektor_id), u.status_khusus || '-'].concat(cells).concat([tot]); }),
        ['tdc', 'td', 'td', 'td'].concat(kg.map(function () { return 'tdc'; })).concat(['tdc']), { headH: 54, empty: '— belum ada UMKM —' });
      if (d.umkm.length && kg.length) {
        var colTot = kg.map(function (g) { return d.umkm.reduce(function (a, u) { return a + (hm[u.umkm_id + '|' + g.kegiatan_id] || 0); }, 0); });
        s6b.row(y, 0, ['', 'Total kehadiran', '', ''].concat(colTot).concat([colTot.reduce(function (a, b) { return a + b; }, 0)]), st.tot); y++;
      }
      finish(s6b, foot);

      /* ===== 7. LAMPIRAN COST STRUCTURE ===== */
      var secs = r.kpi.sektorIds, nC7 = Math.max(7, 2 + secs.length * 4 + 1);
      var s7 = wb.sheet('Lampiran-Cost Structure'); s7.tab = 'C2410C'; s7.landscape = true;
      s7.cols([30, 10, 12, 10, 13, 11, 18].concat(new Array(Math.max(0, nC7 - 7)).fill(13)));
      y = X.kop(s7, st, nC7, 'LAMPIRAN — COST STRUCTURE & KPI', subj, p.status);
      st.okPct = Object.assign({}, st.okChip, { fmt: X.fmt.PCT }); st.warnPct = Object.assign({}, st.warnChip, { fmt: X.fmt.PCT });
      y = kv(s7, st, y, 0, 2, 6, [['Budget Program', Math.round(N(ctx.budget)), 'rpL'], ['UMK (Rp/bulan)', Math.round(N(ctx.umk)), 'rpL'], ['Sektor dihitung', (r.kpi.dihitung || []).map(M.sektorName).join(', ') || '-']]);
      y++; y = X.section(s7, st, y, nC7, 'A. KPI CABANG (AKUMULASI SEMUA SEKTOR)');
      y = X.table(s7, st, y, 0, ['KPI', 'Bobot', 'Target', 'Satuan', 'Realisasi', 'Capaian', 'Proksi Cabang'], r.kpi.perKpi.map(function (k) { return [k.nama, { v: N(k.bobot), st: 'pctN' }, N(k.targetCabang), k.satuan || '-', N(k.realisasiCabang), { v: k.capaian, st: k.capaian >= 1 ? 'okPct' : 'warnPct' }, Math.round(k.proksiCabang)]; }), ['td', 'num', 'dec', 'tdc', 'dec', 'pct', 'rp']);
      s7.row(y, 0, ['Total', '', '', '', '', '', Math.round(r.kpi.totalCabang)], [st.tot, st.tot, st.tot, st.tot, st.tot, st.tot, st.totRp]); y += 2;
      if (secs.length) {
        y = X.section(s7, st, y, nC7, 'B. BREAKDOWN PER SEKTOR');
        s7.height(y, 22); s7.merge(y, 0, y + 1, 0, 'KPI', st.th); s7.merge(y, 1, y + 1, 1, 'Bobot', st.th);
        secs.forEach(function (sid, i) { var c = 2 + i * 4; s7.merge(y, c, y, c + 3, M.sektorName(sid) + ((r.kpi.dihitung || []).indexOf(sid) > -1 ? '  ✔ dihitung' : ''), st.th); s7.row(y + 1, c, ['Target', 'Realisasi', 'F1', 'F2'], st.th); });
        s7.merge(y, 2 + secs.length * 4, y + 1, 2 + secs.length * 4, 'F3', st.th); s7.height(y + 1, 22); y += 2;
        r.kpi.perKpi.forEach(function (k, i) {
          var z = i % 2 ? 'z' : '', row = [k.nama, N(k.bobot)], sty = [st['td' + z], st['pctN' + z]];
          k.perSektor.forEach(function (c) { row.push(N(c.target), N(c.realisasi), +N(c.f1).toFixed(6), Math.round(N(c.f2))); sty.push(st['dec' + z], st['dec' + z], Object.assign({}, st['dec' + z], { fmt: '0.0000' }), st['rp' + z]); });
          row.push(Math.round(k.total)); sty.push(st['rp' + z]); s7.row(y, 0, row, sty); y++;
        });
        var tr7 = new Array(2 + secs.length * 4 + 1).fill(''); tr7[0] = 'Total proksi sektor dihitung (F3)'; tr7[tr7.length - 1] = Math.round(r.kpi.total);
        s7.row(y, 0, tr7, tr7.map(function (_, k) { return k === tr7.length - 1 ? st.totRp : st.tot; })); y += 2;
        y = X.section(s7, st, y, nC7, 'C. PROPORSI SEKTOR (F17)');
        y = X.table(s7, st, y, 0, ['Sektor', 'Proporsi', 'Status'], secs.map(function (sid) { return [M.sektorName(sid), r.kpi.proporsiSektor[sid] || 0, (r.kpi.dihitung || []).indexOf(sid) > -1 ? 'Dihitung' : 'Tidak dihitung']; }), ['td', 'pct', 'tdc']);
      }
      finish(s7, foot);

      await wb.save('Laporan_SROI_' + env.fileSafe(cab.nama_cabang) + '_' + p.tahun + (p.status === 'Disetujui' ? '' : '_SEMENTARA') + '.xlsx');
    },

    /** Rekap seluruh cabang (admin). env: {th, rows, ok, w, M, Agg, target(cid), targetNas, org, rpShort, ratioOf} */
    rekap: async function (env) {
      var wb = new X.Workbook({ title: 'Rekap SROI ' + env.th, subject: 'Rekap SROI seluruh cabang', company: env.org });
      Lap.rekapSheet(wb, env, 'Rekap ' + env.th);
      await wb.save('Rekap_SROI_' + env.th + '.xlsx');
    },
    /** Sheet rekap seluruh cabang — dipakai sebagai file tersendiri maupun lampiran laporan manajemen. */
    rekapSheet: function (wb, env, name, judul) {
      var T = X.theme(), st = X.S(T), th = env.th;
      var sh = wb.sheet(name); sh.tab = T.dark; sh.landscape = true; sh.cols([5, 9, 22, 17, 17, 17, 17, 11, 11, 11, 12, 14, 10]);
      var nC = 13, done = env.ok.length, all = env.rows.length;
      sh.height(0, 30).height(1, 18).height(2, 20);
      sh.merge(0, 0, 0, nC - 1, judul || ('REKAP SOCIAL RETURN ON INVESTMENT (SROI) SELURUH CABANG — TAHUN ' + th), st.title);
      sh.merge(1, 0, 1, nC - 1, (env.org || 'DharmaImpact') + '  •  Dicetak ' + new Date().toLocaleString('id-ID') + '  •  Akumulasi hanya menghitung laporan berstatus Disetujui', st.sub);
      sh.merge(2, 0, 2, nC - 1, done === all ? '✔ Seluruh ' + all + ' cabang sudah disetujui' : '⚠ ' + done + ' dari ' + all + ' cabang sudah disetujui — rekap bersifat sementara', done === all ? st.final : st.draft);
      var y = 4; y = X.section(sh, st, y, nC, 'RINGKASAN NASIONAL');
      sh.height(y, 18).height(y + 1, 30).height(y + 2, 28);
      var tn = N(env.targetNas);
      tile(sh, st, y, 0, 3, 'RATA-RATA SROI NASIONAL', done ? +env.w.ratio.toFixed(4) : '-', done ? 'tileVR' : 'tileV', 'Tertimbang: Σ PV Impact ÷ Σ PV Investasi');
      tile(sh, st, y, 3, 2, 'TARGET NASIONAL', tn || '-', tn ? 'tileVR' : 'tileV', tn ? (done ? 'Capaian ' + (env.w.ratio / tn * 100).toFixed(0) + '%' : '') : 'Belum ditetapkan');
      tile(sh, st, y, 5, 2, 'TOTAL INVESTASI (PV)', Math.round(env.w.pvInvestasi), 'tileVRp', 'Cabang disetujui');
      tile(sh, st, y, 7, 3, 'TOTAL MANFAAT (PV)', Math.round(env.w.pvImpact), 'tileVRpG', fmtID(env.w.umkm) + ' UMKM binaan');
      tile(sh, st, y, 10, 3, 'STATUS PERSETUJUAN', done + ' / ' + all + ' cabang', 'tileV', all ? (done / all * 100).toFixed(0) + '% disetujui' : '');
      y += 4; y = X.section(sh, st, y, nC, 'KINERJA PER CABANG');
      var hr = y; sh.freeze = { r: hr + 1, c: 3 }; sh.printTitle = [hr, hr];
      var body = env.rows.map(function (rw, i) {
        var p = rw.p || {}, has = N(p.hasil_pv_investasi) > 0, ratio = N(p.hasil_rasio), t = N(env.target(rw.cabang_id)), stt = p.status || 'Belum Mulai';
        var cap = has && t && stt === 'Disetujui' ? { v: ratio / t, st: ratio >= t ? 'okPct' : 'warnPct' } : '-';
        return [i + 1, rw.kode, rw.cabang, has ? Math.round(N(p.hasil_total_investasi)) : '-', has ? Math.round(N(p.hasil_pv_investasi)) : '-', has ? Math.round(N(p.hasil_total_impact)) : '-', has ? Math.round(N(p.hasil_pv_impact)) : '-',
          has ? { v: ratio, st: 'ratioC' } : '-', t ? { v: t, st: 'ratioC' } : '-', cap, has ? stars(p.hasil_bintang) : '-', { v: stt, st: stt === 'Disetujui' ? 'okChip' : stt === 'Perlu Revisi' ? 'redChip' : stt === 'Dikirim' ? 'warnChip' : 'tdc' }, has ? N(p.hasil_umkm) : '-'];
      });
      st.okPct = Object.assign({}, st.okChip, { fmt: X.fmt.PCT }); st.warnPct = Object.assign({}, st.warnChip, { fmt: X.fmt.PCT });
      st.ratioC = { border: { all: { s: 'thin', c: T.line } }, v: 'top', h: 'right', fmt: '0.00', font: { b: true, color: T.pri } };
      y = X.table(sh, st, y, 0, ['No', 'Kode', 'Cabang', 'Total Investasi', 'PV Investasi', 'Total Impact', 'PV Impact', 'Rasio SROI', 'Target', 'Capaian', 'Bintang', 'Status', 'UMKM'], body, ['tdc', 'tdc', 'td', 'rp', 'rp', 'rp', 'rp', 'dec', 'dec', 'pct', 'tdc', 'tdc', 'num'], { headH: 32 });
      var tot = ['', '', 'TOTAL (' + done + ' disetujui)', Math.round(env.w.totalInvestasi), Math.round(env.w.pvInvestasi), Math.round(env.w.totalImpact), Math.round(env.w.pvImpact), done ? +env.w.ratio.toFixed(4) : '-', tn || '-', done && tn ? env.w.ratio / tn : '-', done ? stars(env.Agg.bintangOf(env.w.ratio)) : '', '', env.w.umkm];
      sh.row(y, 0, tot, [st.tot, st.tot, st.tot, st.totRp, st.totRp, st.totRp, st.totRp, Object.assign({}, st.tot, { fmt: '0.00' }), Object.assign({}, st.tot, { fmt: '0.00' }), st.totPct, st.tot, st.tot, st.totNum]); sh.height(y, 20); y += 2;
      y = X.section(sh, st, y, nC, 'VISUALISASI');
      var bars = env.rows.filter(function (rw) { return rw.p && rw.p.status === 'Disetujui'; }).map(function (rw) { var v = N(rw.p.hasil_rasio); return { label: rw.cabang, value: v, target: N(env.target(rw.cabang_id)), color: v < 1 ? '#DC2626' : '#' + T.pri }; }).sort(function (a, b) { return b.value - a.value; });
      if (bars.length) {
        var hpx = Math.max(160, 56 + bars.length * 30 + 30);
        try { sh.image(X.Chart.barH(bars, { w: 900, title: 'Rasio SROI per Cabang (Disetujui)', sub: 'Penanda oranye = target cabang • garis merah = titik impas 1,00', ref: 1, refLabel: 'Titik impas 1,00', targetLabel: 'Target cabang', left: 180, fmt: function (v) { return v.toFixed(2).replace('.', ','); } }), y, 0, 900, hpx, 4, 6); } catch (e) { }
        var nr = Math.ceil((hpx + 12) / 20); for (var i = 0; i < nr; i++) sh.height(y + i, 20); y += nr;
        var segs = [{ label: 'PV Investasi', value: env.w.pvInvestasi, color: '#' + T.pri }, { label: 'PV Manfaat', value: env.w.pvImpact, color: '#16A34A' }];
        try { sh.image(X.Chart.columns(env.ok.slice(0, 10).map(function (p) { return { label: (env.M.cabang(p.cabang_id).kode || ''), a: N(p.hasil_pv_investasi), b: N(p.hasil_pv_impact) }; }), { w: 900, h: 300, title: 'PV Investasi vs PV Manfaat per Cabang', sub: 'Rupiah — 10 cabang pertama yang disetujui', labelA: 'PV Investasi', labelB: 'PV Manfaat', fmt: env.rpShort }), y, 0, 900, 300, 4, 6); } catch (e) { }
        for (var k = 0; k < 16; k++) sh.height(y + k, 20); y += 16;
      } else { sh.merge(y, 0, y, nC - 1, 'Belum ada cabang yang disetujui pada tahun ini — grafik akan muncul setelah ada laporan Disetujui.', st.muted); y++; }
      sh.footer = '&L&8DharmaImpact • Rekap SROI ' + th + '&R&8Hal. &P / &N';
      return sh;
    },

    /** Laporan manajemen (konsolidasi) + lampiran rekap seluruh cabang.
     *  env: rekap env + {lap: data isian admin, agg: hasil agregasi (stakeholder, peran, w, ok, rows), user} */
    mgmt: async function (env) {
      var T = X.theme(), st = X.S(T), th = env.th, L = env.lap || {}, P = L.program || {}, A = env.agg, w = A.w, done = A.ok.length, all = A.rows.length;
      var wb = new X.Workbook({ title: P.judul || ('Laporan Konsolidasi SROI ' + th), subject: 'Laporan SROI untuk manajemen', company: env.org });
      var sh = wb.sheet('Laporan Manajemen'); sh.tab = T.dark; sh.cols([6, 26, 16, 16, 16, 16, 16, 14]);
      var nC = 8, final = done === all && all > 0;
      var judul = (P.judul || ('LAPORAN KONSOLIDASI SROI TAHUN ' + th)).toUpperCase(), lg = env.logo;
      var tStyle = Object.assign({}, st.title, { wrap: true, font: { b: true, sz: 15, color: 'FFFFFF' } });
      if (lg) {   // logo di kiri judul; judul dibatasi lebarnya agar turun baris dengan rapi
        var lines = Math.max(1, Math.ceil(judul.length / 52));
        sh.height(0, Math.max(52, 22 * lines + 10));
        sh.set(0, 0, null, st.band);
        sh.merge(0, 1, 0, nC - 2, judul, tStyle); sh.set(0, nC - 1, null, st.band);
        var box = 44, sc2 = Math.min(box / lg.w, box / lg.h);
        sh.image(lg.png, 0, 0, Math.round(lg.w * sc2), Math.round(lg.h * sc2), 2, 4);
        sh.cols([8], 0);
      } else { sh.height(0, Math.max(34, 22 * Math.ceil(judul.length / 62) + 10)); sh.merge(0, 0, 0, nC - 1, judul, tStyle); }
      sh.height(1, 18).height(2, 20);
      var subTxt = (P.penyelenggara || env.org || 'DharmaImpact') + '  •  Tahun ' + th + '  •  Doc. No: ' + (P.doc_number || '-') + '  •  Rev. ' + (P.rev || '0') + '  •  Tanggal: ' + (P.tgl || new Date().toLocaleDateString('id-ID'));
      var subSt = Object.assign({}, st.sub, { font: { sz: subTxt.length > 95 ? 8 : 9, color: 'E2E8F0' } });   // satu baris, sejajar judul
      if (lg) { sh.set(1, 0, null, st.band); sh.merge(1, 1, 1, nC - 1, subTxt, subSt); } else sh.merge(1, 0, 1, nC - 1, subTxt, subSt);
      sh.merge(2, 0, 2, nC - 1, final ? '✔ Seluruh ' + all + ' cabang sudah disetujui' : '⚠ ' + done + ' dari ' + all + ' cabang sudah disetujui — laporan bersifat sementara', final ? st.final : st.draft);
      var y = 4;
      y = X.section(sh, st, y, nC, 'A. DATA PROGRAM');
      y = kv(sh, st, y, 0, 2, nC - 1, [['Nama Program', P.nama_program], ['Penyelenggara', P.penyelenggara || env.org], ['Periode Program', P.periode], ['Lokasi / Cakupan', P.lokasi], ['Penanggung Jawab Program', P.penanggung_jawab],
        ['Mitra Penilai', P.mitra_penilai], ['Metode Penilaian', P.metode], ['Tujuan Program', P.tujuan], ['Ruang Lingkup', P.ruang_lingkup]]);
      y++; y = X.section(sh, st, y, nC, 'B. RINGKASAN HASIL KONSOLIDASI');
      sh.height(y, 18).height(y + 1, 30).height(y + 2, 28);
      var tn = N(env.targetNas);
      tile(sh, st, y, 0, 2, 'RASIO SROI KONSOLIDASI', done ? +w.ratio.toFixed(4) : '-', done ? 'tileVR' : 'tileV', 'Σ PV Impact ÷ Σ PV Investasi');
      tile(sh, st, y, 2, 2, 'TARGET NASIONAL', tn || '-', tn ? 'tileVR' : 'tileV', tn && done ? 'Capaian ' + (w.ratio / tn * 100).toFixed(0) + '%' : (tn ? '' : 'Belum ditetapkan'));
      tile(sh, st, y, 4, 2, 'TOTAL INVESTASI (PV)', Math.round(w.pvInvestasi), 'tileVRp', 'Nominal Rp' + Math.round(w.totalInvestasi).toLocaleString('id-ID'));
      tile(sh, st, y, 6, 2, 'TOTAL MANFAAT (PV)', Math.round(w.pvImpact), 'tileVRpG', 'Nominal Rp' + Math.round(w.totalImpact).toLocaleString('id-ID'));
      y += 4; sh.height(y, 18).height(y + 1, 30).height(y + 2, 28);
      tile(sh, st, y, 0, 2, 'KATEGORI DAMPAK', done ? stars(env.Agg.bintangOf(w.ratio)) : '-', 'tileV', done ? 'Bintang ' + env.Agg.bintangOf(w.ratio) : '');
      tile(sh, st, y, 2, 2, 'CABANG DISETUJUI', done + ' / ' + all, 'tileV', all ? (done / all * 100).toFixed(0) + '% cabang' : '');
      tile(sh, st, y, 4, 2, 'UMKM BINAAN', N(w.umkm), 'tileV', 'Dari cabang yang disetujui');
      tile(sh, st, y, 6, 2, 'STAKEHOLDER TERLIBAT', A.stakeholder.length, 'tileV', A.peran.length + ' kelompok peran');
      y += 4; y = X.section(sh, st, y, nC, 'C. SEBARAN MANFAAT PER STAKEHOLDER (SELURUH CABANG)');
      var r0 = y + 1;
      y = X.table(sh, st, y, 0, ['No', 'Stakeholder', 'Peran', 'Jumlah Cabang', 'PV Manfaat', 'Porsi'], A.stakeholder.map(function (s, i) { return [i + 1, s.nama, s.peran, s.cabang, Math.round(s.v), s.porsi]; }), ['tdc', 'td', 'td', 'num', 'rp', 'pct'], { empty: '— belum ada cabang yang disetujui —' });
      autoRows(sh, r0, y, 0, 6);
      if (A.stakeholder.length) { sh.row(y, 0, ['', 'TOTAL', '', '', Math.round(w.pvImpact), 1], [st.tot, st.tot, st.tot, st.tot, st.totRp, st.totPct]); y++; }
      y++;
      y = X.table(sh, st, y, 0, ['No', 'Kelompok Peran', 'Jumlah Stakeholder', 'PV Manfaat', 'Porsi'], A.peran.map(function (s, i) { return [i + 1, s.peran, s.n, Math.round(s.v), s.porsi]; }), ['tdc', 'td', 'num', 'rp', 'pct']);
      if (A.stakeholder.length) {
        try { sh.image(X.Chart.donut(A.stakeholder.slice(0, 8).map(function (s) { return { label: s.nama, value: s.v }; }), { w: 520, h: 270, title: 'Sebaran Manfaat per Stakeholder', sub: 'Porsi PV manfaat seluruh cabang', centerTitle: 'PV MANFAAT', centerValue: env.rpShort(w.pvImpact) }), y + 1, 0, 520, 270, 4, 6); } catch (e) { }
        for (var i = 0; i < 15; i++) sh.height(y + 1 + i, 20); y += 16;
      }
      y++; sh.breaks.push(y); y = X.section(sh, st, y, nC, 'D. PENJELASAN HASIL');
      sh.merge(y, 0, y, nC - 1, L.penjelasan || '-', st.val); fitH(sh, y, [[L.penjelasan || '-', 120]], 40); y += 2;
      y = X.section(sh, st, y, nC, 'E. PENGESAHAN');
      var pg = (L.pengesahan || []).filter(function (x) { return x && (x.tahap || x.nama || x.jabatan); });
      if (!pg.length) { sh.merge(y, 0, y, nC - 1, '— belum ada susunan pengesahan —', st.muted); y++; }
      for (var k = 0; k < pg.length; k += 2) {
        [pg[k], pg[k + 1]].forEach(function (b, j) {
          if (!b) return; var c = j * 4;
          sh.merge(y, c, y, c + 3, (b.tahap || '') + (b.tgl ? ', ' + b.tgl : ''), st.sign); sh.merge(y + 1, c, y + 1, c + 3, '', st.signName);
          sh.merge(y + 2, c, y + 2, c + 3, b.nama || '(...................................)', st.signName); sh.merge(y + 3, c, y + 3, c + 3, b.jabatan || '', st.signOrg);
        });
        sh.height(y, 18).height(y + 1, 46).height(y + 2, 18).height(y + 3, 18); y += 5;
      }
      var rv = (L.revisi || []).filter(function (x) { return x && (x.rev || x.ket); });
      if (rv.length) {
        y++; y = X.section(sh, st, y, nC, 'F. RIWAYAT REVISI');
        sh.height(y, 24); sh.row(y, 0, ['Rev.', 'Tanggal'], st.th); sh.merge(y, 2, y, 5, 'Keterangan perubahan', st.th); sh.merge(y, 6, y, 7, 'Oleh', st.th); y++;
        rv.forEach(function (x, i) { var z = i % 2 ? 'z' : ''; sh.set(y, 0, String(x.rev), st['tdc' + z]); sh.set(y, 1, x.tgl || '', st['td' + z]); sh.merge(y, 2, y, 5, x.ket || '-', st['td' + z]); sh.merge(y, 6, y, 7, x.oleh || '', st['td' + z]); fitH(sh, y, [[x.ket || '-', 64]]); y++; });
        y++;
      }
      sh.merge(y, 0, y, nC - 1, 'Lampiran: Rekap SROI seluruh cabang (sheet "Lampiran Rekap Cabang").', st.muted);
      sh.footer = '&L&8DharmaImpact • Laporan Konsolidasi SROI ' + th + '&R&8Hal. &P / &N';
      Lap.rekapSheet(wb, env, 'Lampiran Rekap Cabang', 'LAMPIRAN — REKAP SROI SELURUH CABANG TAHUN ' + th);
      await wb.save('Laporan_Manajemen_SROI_' + th + '_Rev' + (P.rev || '0') + '.xlsx');
    }
  };
  function fmtID(n) { return Math.round(N(n)).toLocaleString('id-ID'); }
  G.XLap = Lap;
})(window);
