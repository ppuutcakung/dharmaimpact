# DharmaImpact — Frontend

Aplikasi web perhitungan & pelaporan SROI (Social Return on Investment) program pembinaan UMKM.

- Frontend statis (HTML/CSS/JS murni) untuk GitHub Pages.
- Backend: Google Apps Script sebagai REST API (`fetch` + JSON).
- Isi `js/config.js` → `GAS_URL` dengan URL Web App `/exec` sebelum diunggah.

Struktur:

```
index.html
css/style.css
js/config.js        ← isi URL backend di sini
js/sroi-engine.js   ← mesin hitung (identik dengan SroiEngine.gs di backend)
js/core.js          ← API tahan jaringan, cache SWR, router SPA
js/charts.js        ← grafik SVG ringan
js/page-*.js        ← halaman
js/export.js        ← ekspor PDF/Excel (pustaka dimuat saat dibutuhkan)
js/app.js           ← boot & sesi
```

Panduan lengkap: `PANDUAN-INSTALASI.md`.
