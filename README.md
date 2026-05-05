# Quizizz Answer Viewer — Bookmarklet

## Cara Pakai

### Opsi 1: Console Browser
1. Buka quiz di quizizz.com
2. Tekan F12 → tab Console
3. Paste seluruh isi `bookmarklet.js` → Enter

### Opsi 2: Bookmark
1. Buat bookmark baru di browser
2. Isi nama: `Quizizz Viewer`
3. Isi URL dengan isi file `bookmark-url.txt`
4. Saat di halaman Quizizz, klik bookmark tersebut

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
