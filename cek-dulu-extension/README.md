# CekDulu (MVP)

Ekstensi Chrome (Manifest V3) untuk campaign "CekDulu. Biar nggak kepancing.".
Mencari tanda-tanda situs penipuan secara lokal di browser. Tidak ada permintaan
jaringan, tidak ada penyimpanan data, dan hanya izin `activeTab`.

## Cara memuat di Chrome
1. Ekstrak zip ini (atau pakai foldernya langsung).
2. Buka `chrome://extensions`, aktifkan **Developer mode**.
3. Klik **Load unpacked**, pilih folder `cek-dulu-extension`.
4. Buka sebuah situs, klik ikon ekstensi untuk melihat tiga pertanyaan dan temuannya.
   Jika ada tanda mencurigakan, banner muncul di atas halaman dan ikon diberi lencana `!`.

Halaman yang sudah terbuka sebelum ekstensi dipasang perlu dimuat ulang agar
isi halamannya ikut diperiksa.

## Aturan yang ada
Alamat (URL): tanpa HTTPS, tanda "@", alamat IP, punycode, tautan pendek,
nama brand muncul di domain yang bukan resmi, huruf menyerupai (g00gle, paypa1),
akhiran domain berisiko, subdomain bertumpuk, kata pancingan/umpan di domain, port tidak biasa.

Isi halaman: kolom kata sandi di HTTP, formulir yang mengirim data ke domain lain,
permintaan OTP/PIN/kartu/KTP/selfie, permintaan banyak data pribadi sekaligus (nama lengkap,
jenis kelamin, usia, email, telepon, domisili, pekerjaan; mulai dari 3 jenis, bobot lebih tinggi
dari 5 jenis), judul mengaku brand tertentu tapi domain bukan miliknya, bahasa yang menekan
(urgensi/hadiah).

Catatan: formulir data pribadi sering sah (survei, pendaftaran), jadi aturan ini sengaja
berbobot rendah dan hanya menjadi "catatan". Ia baru naik jadi peringatan bila digabung
tanda lain (domain mirip brand, bahasa hadiah, data dikirim ke domain lain, dan sebagainya).

Notifikasi: bila ditemukan tanda sekecil apa pun (tingkat "catatan", "peringatan", atau
"bahaya"), muncul toast kecil di pojok kanan atas halaman (dengan animasi dan cincin berdenyut).
Tombol "Lihat alasannya" membuka detail temuan. Tingkat "catatan" (kuning tua) menciut jadi
pill kecil "Cek dulu" setelah 8 detik, "peringatan" (oranye) setelah 12 detik (klik pill untuk
membuka lagi), sedangkan "bahaya" (merah) tetap terbuka sampai ditutup. Tanda "×" menutupnya
untuk halaman itu. Ikon ekstensi diberi lencana "i", "!" atau "!!". Bila tidak ada tanda sama
sekali, tidak ada notifikasi.

Hasilnya dipetakan ke tiga pertanyaan: Siapa yang kirim? Kenapa harus sekarang?
Kenapa mereka butuh itu?

## Batasan (jujur)
- Ini mencari **tanda**, bukan menjamin keamanan. Tampilan "tidak ada tanda" sengaja
  ditutup dengan "tetap cek dulu".
- Akan ada false positive dan false negative. Angka akurasi belum pernah diukur.
- Daftar domain resmi brand di `rules.js` (`BRANDS`) sengaja ringkas dan **belum diverifikasi
  lengkap**. Cek dan lengkapi sebelum dipakai di luar demo. Domain resmi yang belum tercatat
  akan ditandai "perlu dicek".
- Ambang skor (`levelOf`) dan bobot tiap aturan adalah tebakan awal, belum dikalibrasi.

## Menguji logika
`node test.js` menjalankan 43 contoh. Itu hanya memastikan aturan berperilaku sesuai
maksud, bukan mengukur akurasi. Untuk bahan riset di deck, ujilah dengan kumpulan URL
phishing publik dan situs populer yang sebenarnya, lalu catat hasilnya.

## Merek dan tampilan
Logo, ikon, dan warna mengikuti merek CekDulu: primer `#496af1`, aksen `#e6e51e`, teks `#231f20`.
Variabel warna ada di bagian atas `popup.css`; toast di halaman memakai warna yang sama di
`content.js` (konstanta `ACCENT` dan blok `css()`). Warna status sengaja tidak memakai aksen kuning
supaya tidak tertukar: catatan = biru primer, peringatan = oranye `#f08a00`, bahaya = merah `#d9263f`.
Logo di popup ada di `brand/logo-full.png`; tanda logo kecil untuk toast tertanam di `brand.js`
(data URI), dan ikon ekstensi ada di `icons/`. Untuk mengganti logo, buat ulang ketiganya dari
file logo baru.
