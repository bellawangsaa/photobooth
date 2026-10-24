# Belly's Bar Photobooth

Photobooth online untuk **Bella's 21st Birthday**, dengan desain sesuai brand guideline (kuning, pink, cream, motif lotus dan bunga, font script retro).

Alurnya: tamu isi nama → pilih layout, filter, dan frame → foto dengan hitung mundur → hasil langsung bisa **disimpan ke Google Drive** (nama file = nama tamu + waktu) atau di-download.

## Fitur

- **3 layout:** Strip (3 foto), Grid (4 foto), dan Single (1 foto)
- **9 filter:** Original, Butter, Rosé, Mono, Vintage, Sky, Garden, Pop, dan Film B&W. Preview kamera langsung pakai filter, dan filter + frame masih bisa diganti setelah foto diambil.
- **6 frame brand:** Belly's Bar, Bella's 21st, You've Made It, BW Monogram, Cheers!, dan Garden Party. Nama tamu dan tanggal otomatis tercetak di frame.
- Hasil foto resolusi tinggi (strip 1200×3600, grid/single 2400×3000)
- Tombol **Tamu berikutnya** untuk mode kiosk di acara
- Tekan `Spasi` untuk mulai foto

Tanpa build step dan tanpa dependency, cukup HTML, CSS, dan JS biasa.

```
index.html
css/style.css
js/config.js       ← isi URL Apps Script di sini
js/filters.js      ← definisi filter
js/frames.js       ← layout + desain frame (digambar di canvas)
js/app.js          ← kamera, countdown, upload
apps-script/Code.gs ← backend Google Drive
```

## Setup Google Drive (sekali saja, ±5 menit)

Web statis tidak bisa langsung menulis ke Drive, jadi kita pakai Google Apps Script sebagai "jembatan".

1. Login ke akun Google pemilik folder Drive. Buka https://script.google.com, lalu klik **New project**.
2. Hapus isi editor, lalu paste isi file `apps-script/Code.gs`. Folder ID sudah terisi:
   `1AHjp3AM5rrcI4HgSkBTAZ0tYLzuV1ao8`
   (Kalau mau tiap tamu punya subfolder sendiri, ubah `SUBFOLDER_PER_GUEST = true`.)
3. Klik **Deploy → New deployment** → ikon gear → pilih **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Klik **Deploy** → **Authorize access** → pilih akun → *Advanced* → *Go to project (unsafe)* → **Allow**.
5. Copy **Web app URL** (`https://script.google.com/macros/s/.../exec`), lalu paste ke `js/config.js`:
   ```js
   window.PHOTOBOOTH_CONFIG = {
     appsScriptUrl: 'https://script.google.com/macros/s/XXXX/exec',
   };
   ```
6. Tes: buka URL `/exec` itu di browser. Harus muncul `{"ok":true,...}`.

> Kalau nanti `Code.gs` diubah, deploy ulang lewat **Deploy → Manage deployments → Edit → New version** supaya URL-nya tetap sama.

## Menjalankan

Kamera browser hanya jalan di **HTTPS** atau **localhost**.

**Lokal:**
```bash
cd photobooth
python3 -m http.server 8000
# buka http://localhost:8000
```

**Online (GitHub Pages, gratis):** push repo ini ke GitHub, buka **Settings → Pages**, pilih Source: *Deploy from a branch* → `main` / `root`. Web akan online di `https://<username>.github.io/photobooth/`.

## Kustomisasi

- **Filter baru:** tambahkan item ke `FILTERS` di `js/filters.js` (parameter: `sat`, `contrast`, `bright`, `tint`, `sepia`, `gray`, `fade`, `grain`).
- **Frame baru:** tambahkan objek ke `FRAMES` di `js/frames.js` dengan fungsi `bg()` (latar belakang) dan `fg()` (border, stiker, teks). Warna brand ada di konstanta `C`.
- **Lama countdown:** ubah `COUNTDOWN` di `js/app.js`.
