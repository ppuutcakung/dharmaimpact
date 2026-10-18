/* =====================================================================
 * Grafik SVG ringan (tanpa pustaka) — batang horizontal, donat, garis
 * ===================================================================== */
var PALETTE = [tp(), '#3E6DB5', '#0F9D8A', '#E8A317', '#95B5DF', tpd(), '#7A8BA3', '#C2410C'];

function cssv(n, d) { try { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || d; } catch (e) { return d; } }
function tp() { return cssv('--primary', '#005AAB'); }
function tpd() { return cssv('--primary-dark', '#003F7A'); }
var Charts = {
  /** rows: [{label, value, color?, note?}]  opt: {ref:1, refLabel, fmt} */
  barH: function (rows, opt) {
    opt = opt || {};
    if (!rows.length) return '<div class="empty">' + ic('bar-chart') + '<div>Belum ada data disetujui untuk ditampilkan.</div></div>';
    var W = 640, L = 112, R = 92, rowH = 34, top = 8, H = top + rows.length * rowH + 8;
    var max = Math.max(opt.ref || 0, Math.max.apply(null, rows.map(function (r) { return r.value; }))) * 1.08 || 1;
    var sx = function (v) { return L + (W - L - R) * Math.max(0, v) / max; };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img">';
    rows.forEach(function (r, i) {
      var y = top + i * rowH;
      s += '<text x="' + (L - 10) + '" y="' + (y + 20) + '" text-anchor="end" font-size="12.5" font-weight="500" fill="' + (r.color === '#DC2626' ? '#DC2626' : '#1A2433') + '">' + esc(trunc(r.label, 15)) + '</text>';
      s += '<rect x="' + L + '" y="' + (y + 6) + '" width="' + (W - L - R) + '" height="20" rx="3" fill="#F1F5F9"/>';
      s += '<rect x="' + L + '" y="' + (y + 6) + '" width="' + Math.max(2, sx(r.value) - L) + '" height="20" rx="3" fill="' + (r.color || tp()) + '"><title>' + esc(r.label) + ': ' + esc((opt.fmt || fmtNum)(r.value)) + '</title></rect>';
      s += '<text x="' + (W - 4) + '" y="' + (y + 20) + '" text-anchor="end" font-size="12.5" font-weight="700" fill="' + (r.color === '#DC2626' ? '#DC2626' : '#1A2433') + '" style="font-feature-settings:\'tnum\'">' + esc((opt.fmt || fmtNum)(r.value)) + (r.note ? ' ' + esc(r.note) : '') + '</text>';
    });
    if (opt.ref) {
      var x = sx(opt.ref);
      s += '<line x1="' + x + '" x2="' + x + '" y1="2" y2="' + (H - 4) + '" stroke="#DC2626" stroke-width="1.5" stroke-dasharray="4 3"/>';
      s += '<text x="' + (x + 4) + '" y="10" font-size="10.5" fill="#DC2626" font-weight="600">' + esc(opt.refLabel || 'Titik impas') + '</text>';
    }
    return '<div class="chart">' + s + '</svg></div>';
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

  /** pts: [{x:'2024', y:2.4}]  opt: {target, targetLabel} */
  line: function (pts, opt) {
    opt = opt || {};
    if (!pts.length) return '<div class="empty">' + ic('trending-up') + '<div>Belum ada riwayat tahun yang disetujui.</div></div>';
    var W = opt.wide ? 1000 : 640, H = opt.wide ? 250 : 230, L = 40, R = 24, T = 24, B = 34;
    var maxY = Math.max(opt.target || 0, Math.max.apply(null, pts.map(function (p) { return p.y; }))) * 1.2 || 1;
    var sx = function (i) { return pts.length === 1 ? (L + W - R) / 2 : L + (W - L - R) * i / (pts.length - 1); };
    var sy = function (v) { return T + (H - T - B) * (1 - v / maxY); };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img"><defs><linearGradient id="lgA" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="' + tp() + '" stop-opacity=".18"/><stop offset="1" stop-color="' + tp() + '" stop-opacity="0"/></linearGradient></defs>';
    for (var g = 0; g <= 4; g++) {
      var yv = maxY * g / 4, yy = sy(yv);
      s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" stroke="#EEF2F7"/>';
      s += '<text x="' + (L - 8) + '" y="' + (yy + 4) + '" text-anchor="end" font-size="10.5" fill="#94A3B8">' + fmtNum(yv, 1) + '</text>';
    }
    if (opt.target) {
      var ty = sy(opt.target);
      s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + ty + '" y2="' + ty + '" stroke="#E8A317" stroke-width="1.5" stroke-dasharray="6 4"/>';
      s += '<text x="' + (W - R) + '" y="' + (ty - 6) + '" text-anchor="end" font-size="10.5" fill="#B45309" font-weight="600">' + esc(opt.targetLabel || 'Target') + '</text>';
    }
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + sx(i).toFixed(1) + ' ' + sy(p.y).toFixed(1); }).join('');
    if (pts.length > 1) s += '<path d="' + d + 'L' + sx(pts.length - 1) + ' ' + (H - B) + 'L' + sx(0) + ' ' + (H - B) + 'Z" fill="url(#lgA)"/>';
    s += '<path d="' + d + '" fill="none" stroke="' + tp() + '" stroke-width="2.5" stroke-linejoin="round"/>';
    pts.forEach(function (p, i) {
      var last = i === pts.length - 1;
      s += '<circle cx="' + sx(i) + '" cy="' + sy(p.y) + '" r="' + (last ? 6 : 4.5) + '" fill="' + (last ? tp() : '#fff') + '" stroke="' + tp() + '" stroke-width="2.5"/>';
      s += '<text x="' + sx(i) + '" y="' + (sy(p.y) - 12) + '" text-anchor="middle" font-size="12" font-weight="700" fill="' + tpd() + '">' + fmtNum(p.y, 2) + '</text>';
      s += '<text x="' + sx(i) + '" y="' + (H - 10) + '" text-anchor="middle" font-size="11.5" fill="' + (last ? '#1A2433' : '#5B6B7F') + '" font-weight="' + (last ? 700 : 400) + '">' + esc(p.x) + '</text>';
    });
    return '<div class="chart">' + s + '</svg></div>';
  }
};
function trunc(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
