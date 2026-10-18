/* =====================================================================
 * Grafik SVG ringan (tanpa pustaka) — batang horizontal, donat, garis
 * ===================================================================== */
var PALETTE = [tp(), '#3E6DB5', '#0F9D8A', '#E8A317', '#95B5DF', tpd(), '#7A8BA3', '#C2410C'];

function cssv(n, d) { try { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || d; } catch (e) { return d; } }
function tp() { return cssv('--primary', '#005AAB'); }
function tpd() { return cssv('--primary-dark', '#003F7A'); }
var Charts = {
  /** rows: [{label, value, color?, note?, target?}]  opt: {ref, refLabel, fmt, pw}
   *  pw = lebar piksel nyata kontainer → huruf tidak ikut membesar/mengecil, proporsi kiri-kanan pas. */
  barH: function (rows, opt) {
    opt = opt || {};
    if (!rows.length) return '<div class="empty">' + ic('bar-chart') + '<div>Belum ada data disetujui untuk ditampilkan.</div></div>';
    var fmt = opt.fmt || fmtNum, W = Math.max(280, Math.round(opt.pw || 640)), small = W < 420;
    var fs = small ? 11.5 : 12.5, cw = fs * 0.56;   // perkiraan lebar karakter
    var maxLbl = Math.max.apply(null, rows.map(function (r) { return textW(r.label, fs, 500); }));
    var L = Math.round(Math.min(small ? 110 : Math.max(160, W * 0.24), Math.max(60, maxLbl + 16)));
    var maxVal = Math.max.apply(null, rows.map(function (r) { return textW(fmt(r.value), fs, 700) + (r.note ? textW(' ' + r.note, fs - 1.5, 600) : 0); }));
    var R = Math.round(Math.max(48, maxVal + 14));
    var rowH = 32, top = opt.ref ? 20 : 6, barH = 14, H = top + rows.length * rowH + 4;
    var max = Math.max(opt.ref || 0, Math.max.apply(null, rows.map(function (r) { return Math.max(r.value, r.target || 0); }))) * 1.08 || 1;
    var sx = function (v) { return L + (W - L - R) * Math.max(0, v) / max; };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img">';
    rows.forEach(function (r, i) {
      var y = top + i * rowH, cy = y + rowH / 2, red = r.color === '#DC2626';
      s += '<text x="' + (L - 10) + '" y="' + (cy + fs * 0.35) + '" text-anchor="end" font-size="' + fs + '" font-weight="500" fill="' + (red ? '#DC2626' : '#1A2433') + '"><title>' + esc(r.label) + '</title>' + esc(fitText(r.label, L - 14, fs, 500)) + '</text>';
      s += '<rect x="' + L + '" y="' + (cy - barH / 2) + '" width="' + (W - L - R) + '" height="' + barH + '" rx="4" fill="#F1F5F9"/>';
      s += '<rect x="' + L + '" y="' + (cy - barH / 2) + '" width="' + Math.max(3, sx(r.value) - L) + '" height="' + barH + '" rx="4" fill="' + (r.color || tp()) + '"><title>' + esc(r.label) + ': ' + esc(fmt(r.value)) + '</title></rect>';
      if (r.target) s += '<rect x="' + (sx(r.target) - 1.5) + '" y="' + (cy - barH / 2 - 4) + '" width="3" height="' + (barH + 8) + '" rx="1.5" fill="#E8A317"><title>Target ' + esc(r.label) + ': ' + esc(fmt(r.target)) + '</title></rect>';
      s += '<text x="' + (W - 2) + '" y="' + (cy + fs * 0.35) + '" text-anchor="end" font-size="' + fs + '" font-weight="700" fill="' + (red ? '#DC2626' : '#1A2433') + '" style="font-feature-settings:\'tnum\'">' + esc(fmt(r.value)) + (r.note ? ' <tspan fill="' + (red ? '#DC2626' : '#15803D') + '" font-weight="600" font-size="' + (fs - 1.5) + '">' + esc(r.note) + '</tspan>' : '') + '</text>';
    });
    if (opt.ref) {
      var x = sx(opt.ref);
      s += '<line x1="' + x + '" x2="' + x + '" y1="' + (top - 4) + '" y2="' + (H - 2) + '" stroke="#DC2626" stroke-width="1.2" stroke-dasharray="4 3"/>';
      s += '<text x="' + (x + 4) + '" y="11" font-size="10.5" fill="#DC2626" font-weight="600">' + esc(opt.refLabel || 'Titik impas') + '</text>';
    }
    return '<div class="chart chart-px">' + s + '</svg></div>';
  },

  /** segs: [{label, value, color?}]  center: {title, value} */
  donut: function (segs, center) {
    var total = segs.reduce(function (a, s) { return a + Math.max(0, s.value); }, 0);
    var R = 80, r = 54, cx = 100, cy = 100, a0 = -Math.PI / 2, s = '<svg viewBox="0 0 200 200" role="img">';
    if (!total) s += '<circle cx="100" cy="100" r="' + ((R + r) / 2) + '" fill="none" stroke="#EEF2F7" stroke-width="' + (R - r) + '"/>';
    segs.forEach(function (g, i) {
      var v = Math.max(0, g.value); if (!v) return;
      var a1 = a0 + (v / total) * Math.PI * 2, col = g.color || PALETTE[i % PALETTE.length];
      if (v / total > 0.9999) { s += '<circle cx="100" cy="100" r="' + ((R + r) / 2) + '" fill="none" stroke="' + col + '" stroke-width="' + (R - r) + '"/>'; }
      else {
        var lg = a1 - a0 > Math.PI ? 1 : 0;
        var p = [cx + R * Math.cos(a0), cy + R * Math.sin(a0), cx + R * Math.cos(a1), cy + R * Math.sin(a1), cx + r * Math.cos(a1), cy + r * Math.sin(a1), cx + r * Math.cos(a0), cy + r * Math.sin(a0)].map(function (n) { return n.toFixed(2); });
        s += '<path d="M' + p[0] + ' ' + p[1] + 'A' + R + ' ' + R + ' 0 ' + lg + ' 1 ' + p[2] + ' ' + p[3] + 'L' + p[4] + ' ' + p[5] + 'A' + r + ' ' + r + ' 0 ' + lg + ' 0 ' + p[6] + ' ' + p[7] + 'Z" fill="' + col + '" stroke="#fff" stroke-width="1.5"><title>' + esc(g.label) + ': ' + pctFmt(v / total) + '</title></path>';
      }
      a0 = a1;
    });
    if (center) {
      s += '<text x="100" y="92" text-anchor="middle" font-size="10.5" fill="#5B6B7F" letter-spacing=".5">' + esc(center.title) + '</text>';
      s += '<text x="100" y="114" text-anchor="middle" font-size="16" font-weight="800" fill="#1A2433" font-family="Plus Jakarta Sans">' + esc(center.value) + '</text>';
    }
    return '<div class="chart">' + s + '</svg></div>';
  },
  legend: function (segs, fmtV) {
    var total = segs.reduce(function (a, s) { return a + Math.max(0, s.value); }, 0);
    if (!segs.length) return '<div class="muted small">Belum ada data.</div>';
    return '<div class="legend">' + segs.map(function (g, i) {
      return '<div class="li"><span class="sw" style="background:' + (g.color || PALETTE[i % PALETTE.length]) + '"></span><span class="nm" title="' + esc(g.label) + '">' + esc(g.label) + '</span><span class="v">' + esc((fmtV || rpShort)(g.value)) + '<small>' + pctFmt(total ? g.value / total : 0, 0) + '</small></span></div>';
    }).join('') + '</div>';
  },

  /** pts: [{x:'2024', y:2.4, t?:target}]  opt: {target (garis acuan), targetLabel, pw, ph (piksel nyata), wide} */
  line: function (pts, opt) {
    opt = opt || {};
    if (!pts.length) return '<div class="empty">' + ic('trending-up') + '<div>Belum ada riwayat tahun yang disetujui.</div></div>';
    var px = !!opt.pw, W = Math.max(280, Math.round(opt.pw || (opt.wide ? 1000 : 640))), H = Math.max(170, Math.round(opt.ph || (opt.wide ? 250 : 230)));
    var L = 38, R = 18, T = 26, B = 30;
    var hi = Math.max(opt.target || 0, Math.max.apply(null, pts.map(function (p) { return Math.max(p.y || 0, p.t || 0); }))) * 1.15 || 1;
    var step = niceStep(hi / 4), maxY = Math.ceil(hi / step) * step;
    var pad = pts.length === 1 ? 0 : Math.min(60, (W - L - R) * 0.06);
    var sx = function (i) { return pts.length === 1 ? (L + W - R) / 2 : L + pad + (W - L - R - 2 * pad) * i / (pts.length - 1); };
    var sy = function (v) { return T + (H - T - B) * (1 - v / maxY); };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '"' + (px ? ' width="' + W + '" height="' + H + '"' : '') + ' role="img"><defs><linearGradient id="lgA" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="' + tp() + '" stop-opacity=".18"/><stop offset="1" stop-color="' + tp() + '" stop-opacity="0"/></linearGradient></defs>';
    for (var yv = 0; yv <= maxY + 1e-9; yv += step) {
      var yy = sy(yv);
      s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" stroke="#EEF2F7"/>';
      s += '<text x="' + (L - 8) + '" y="' + (yy + 4) + '" text-anchor="end" font-size="10.5" fill="#94A3B8">' + fmtNum(yv, step < 1 ? 1 : 0) + '</text>';
    }
    var hasT = pts.some(function (p) { return p.t; });
    if (opt.target) {   // garis acuan (titik impas / batas bintang) — label di kiri agar tidak bertabrakan dengan label target
      var ty = sy(opt.target), rc = hasT ? '#DC2626' : '#E8A317';
      s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + ty + '" y2="' + ty + '" stroke="' + rc + '" stroke-width="1.2" stroke-dasharray="' + (hasT ? '3 3' : '6 4') + '"/>';
      s += '<text x="' + (L + 6) + '" y="' + (ty - 5) + '" font-size="10.5" fill="' + rc + '" font-weight="600">' + esc(opt.targetLabel || 'Target') + '</text>';
    }
    var tg = pts.map(function (p, i) { return p.t ? [sx(i), sy(p.t), p.t] : null; }), tgs = tg.filter(Boolean);
    if (tgs.length) {   // garis target (amber)
      var td = '';
      if (tgs.length === 1 || tgs.every(function (q) { return q[2] === tgs[0][2]; })) td = 'M' + L + ' ' + tgs[0][1] + 'L' + (W - R) + ' ' + tgs[0][1];   // target sama → garis penuh
      else { var pen = false; tg.forEach(function (q) { if (!q) { pen = false; return; } td += (pen ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); pen = true; }); }
      s += '<path d="' + td + '" fill="none" stroke="#E8A317" stroke-width="2" stroke-dasharray="6 4"/>';
      tgs.forEach(function (q) { s += '<rect x="' + (q[0] - 4) + '" y="' + (q[1] - 4) + '" width="8" height="8" transform="rotate(45 ' + q[0] + ' ' + q[1] + ')" fill="#E8A317"><title>Target ' + fmtNum(q[2], 2) + '</title></rect>'; });
      var lt = tgs[tgs.length - 1];
      s += '<text x="' + (W - R) + '" y="' + (lt[1] - 7) + '" text-anchor="end" font-size="10.5" fill="#B45309" font-weight="700">Target ' + fmtNum(lt[2], 2) + '</text>';
    }
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + sx(i).toFixed(1) + ' ' + sy(p.y).toFixed(1); }).join('');
    if (pts.length > 1) s += '<path d="' + d + 'L' + sx(pts.length - 1) + ' ' + (H - B) + 'L' + sx(0) + ' ' + (H - B) + 'Z" fill="url(#lgA)"/>';
    s += '<path d="' + d + '" fill="none" stroke="' + tp() + '" stroke-width="2.5" stroke-linejoin="round"/>';
    pts.forEach(function (p, i) {
      var last = i === pts.length - 1;
      s += '<circle cx="' + sx(i) + '" cy="' + sy(p.y) + '" r="' + (last ? 6 : 4.5) + '" fill="' + (last ? tp() : '#fff') + '" stroke="' + tp() + '" stroke-width="2.5"/>';
      var ly = sy(p.y) - 12, near = function (v) { return v && Math.abs(sy(v) - (ly - 4)) < 11; };
      if (near(p.t) || near(opt.target)) ly = sy(p.y) + 22;   // hindari label menumpuk garis target/acuan
      s += '<text x="' + sx(i) + '" y="' + ly + '" text-anchor="middle" font-size="12" font-weight="700" fill="' + tpd() + '" paint-order="stroke" stroke="#fff" stroke-width="3">' + fmtNum(p.y, 2) + '</text>';
      s += '<text x="' + sx(i) + '" y="' + (H - 9) + '" text-anchor="middle" font-size="11.5" fill="' + (last ? '#1A2433' : '#5B6B7F') + '" font-weight="' + (last ? 700 : 400) + '">' + esc(p.x) + '</text>';
    });
    return '<div class="chart' + (px ? ' chart-px' : '') + '">' + s + '</svg></div>';
  }
};
var _mc; function textW(t, sz, wt) { try { _mc = _mc || document.createElement('canvas').getContext('2d'); _mc.font = (wt || 400) + ' ' + sz + 'px ' + (cssv('--f-body', '') || 'Inter, Arial, sans-serif'); return _mc.measureText(String(t)).width; } catch (e) { return String(t).length * sz * 0.56; } }
function fitText(t, max, sz, wt) { t = String(t || ''); if (textW(t, sz, wt) <= max) return t; while (t.length > 1 && textW(t + '…', sz, wt) > max) t = t.slice(0, -1); return t + '…'; }
function niceStep(raw) { if (!(raw > 0)) return 1; var e = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e; }
/** Render grafik sesuai ukuran piksel kontainer & render ulang saat ukuran berubah. fn(w, h) → html */
var ChartFit = {
  mount: function (el, fn) {
    if (!el) return;
    el._cf = fn; ChartFit.draw(el, true);
    if (!el._ro && window.ResizeObserver) { el._ro = new ResizeObserver(debounce(function () { ChartFit.draw(el); }, 60)); el._ro.observe(el); }
  },
  draw: function (el, force) {
    var w = Math.floor(el.clientWidth), h = Math.floor(el.clientHeight);
    if (!w || (!force && w === el._w && h === el._h)) return;
    el._w = w; el._h = h; el.innerHTML = el._cf(w, h);
  }
};
function trunc(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
