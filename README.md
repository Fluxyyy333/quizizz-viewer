# Quizizz Answer Viewer — Bookmarklet

## Cara Pakai (Android / Desktop)

### Bookmarklet (Recommended)
1. Buat bookmark baru di browser (bookmark halaman apa saja dulu)
2. Edit bookmark tersebut, ganti URL dengan:
```
javascript:void(fetch('https://cdn.jsdelivr.net/gh/Fluxyyy333/quizizz-viewer@master/bookmarklet.js').then(r=>r.text()).then(eval))
```
3. Buka quiz di quizizz.com
4. Ketik nama bookmark di address bar → pilih bookmark tersebut

### Console Browser (Desktop)
1. Buka quiz di quizizz.com
2. Tekan F12 → tab Console
3. Paste seluruh isi `bookmarklet.js` → Enter

## Cara Kerja
- **Hook fetch & XHR** — menangkap response API Quizizz saat quiz dimuat
- **Scan React fiber** — membaca state internal React di halaman
- **Scan window objects** — cek apakah data quiz tersedia di global scope

## Fitur
- Panel floating yang bisa di-drag
- Minimize/close
- Refresh manual
- Auto-detect soal baru setiap 1.5 detik
- Support: MCQ, fill-in-the-blank, text answer
- Tampilkan gambar soal jika ada

## Catatan
- Harus dijalankan di halaman quizizz.com
- Data soal baru muncul setelah quiz dimulai (karena Quizizz load soal via API)
- Jika soal tidak muncul, klik tombol 🔄 Refresh
