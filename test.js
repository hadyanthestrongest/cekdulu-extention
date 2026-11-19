// Uji logika aturan: node test.js
// Ini bukan pengukuran akurasi. Ini hanya memastikan aturan berperilaku sesuai
// maksud pada contoh yang kita tulis sendiri. Akurasi sebenarnya harus diuji
// dengan kumpulan URL nyata (misalnya daftar phishing publik + situs populer).
const CD = require('./rules.js');
const RANK = { none: 0, note: 1, warn: 2, danger: 3 };

let pass = 0, fail = 0;
function check(name, got, expect, mode) {
  // mode 'exact' | 'atleast'
  const ok = mode === 'atleast' ? RANK[got] >= RANK[expect] : got === expect;
  if (ok) pass++; else fail++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + '  -> ' + got + (ok ? '' : '  (diharapkan ' + (mode === 'atleast' ? '>= ' : '') + expect + ')'));
}

// ---- URL ----
const urlCases = [
  // [url, level yang diharapkan, mode]
  ['https://www.google.com/search?q=cek', 'none', 'exact'],
  ['https://accounts.google.com/signin', 'none', 'exact'],
  ['https://www.bca.co.id/id/', 'none', 'exact'],
  ['https://ibank.klikbca.com/', 'none', 'exact'],
  ['https://shopee.co.id/product/1', 'none', 'exact'],
  ['https://gopay.co.id/', 'none', 'exact'],
  ['https://dana.id/', 'none', 'exact'],
  ['https://github.com/user/repo', 'none', 'exact'],
  ['https://username.github.io/', 'none', 'exact'],
  ['https://pineapple-shop.com/', 'none', 'exact'],
  ['https://www.pendanaan-umkm.id/', 'none', 'exact'],
  ['https://www.bpjs-kesehatan.go.id/', 'none', 'exact'],
  ['http://localhost:3000/', 'none', 'exact'],
  ['http://192.168.1.10/admin', 'none', 'exact'],
  ['chrome://extensions', 'none', 'exact'],

  ['https://bca-klik-verifikasi.xyz/login', 'danger', 'exact'],
  ['https://gopay-hadiah.top/klaim', 'danger', 'exact'],
  ['https://dana-kaget.xyz/', 'danger', 'exact'],
  ['https://g00gle-login.com/', 'danger', 'exact'],
  ['https://www.bca.co.id@evil-site.com/', 'danger', 'exact'],
  ['https://paypa1.com/', 'warn', 'exact'],
  ['https://faceb00k.com/', 'warn', 'exact'],
  ['https://xn--pypal-4ve.com/', 'warn', 'exact'],
  ['http://45.33.12.9/login', 'warn', 'exact'],
  ['https://shopee-promo.example.com/', 'warn', 'atleast'],
  ['https://klikbca-login.com/', 'warn', 'atleast'],

  ['https://bit.ly/3abc', 'note', 'exact'],
  ['https://a.b.c.d.example.com/', 'note', 'exact'],
  ['https://example.com:8443/', 'note', 'exact']
];
urlCases.forEach(function (c) {
  const r = CD.analyzeAll(c[0], null);
  check('URL ' + c[0], r.level, c[1], c[2]);
});

// ---- Halaman (DOM tiruan sederhana) ----
function input(props, formAction) {
  const el = Object.assign({ type: 'text', name: '', id: '', placeholder: '', autocomplete: '', title: '', ariaLabel: '',
    form: formAction === undefined ? null : { getAttribute: function () { return formAction; } } }, props);
  // props.row = teks baris/tabel tempat label berada (label di sel sebelah, tanpa atribut for)
  if (props.row) el.closest = function () { return { textContent: props.row }; };
  return el;
}
// Formulir seperti di foto: label hanya ada di teks baris, atribut isian tidak informatif.
function foto(action) {
  return [
    input({ name: 'f1', row: 'Nama Lengkap *' }, action),
    input({ type: 'radio', name: 'f2', value: 'L', row: 'Jenis Kelamin * Laki-laki Perempuan' }, action),
    input({ type: 'select-one', name: 'f3', row: 'Usia * 18 Tahun kebawah' }, action),
    input({ name: 'f4', row: 'Alamat E-mail *' }, action),
    input({ type: 'select-one', name: 'f5', row: 'Tempat Tinggal * Jakarta Pusat' }, action)
  ];
}
function doc(opts) {
  return {
    title: opts.title || '',
    body: { innerText: opts.text || '' },
    querySelectorAll: function () { return opts.inputs || []; }
  };
}
function page(name, href, d, expectLevel, mode) {
  check('HALAMAN ' + name, CD.analyzeAll(href, d).level, expectLevel, mode);
}

page('login biasa, form ke domain sama', 'https://www.contoh.com/login',
  doc({ title: 'Masuk', inputs: [input({ type: 'password', name: 'pw' }, '/session')] }), 'none', 'exact');

page('form password ke domain lain', 'https://www.contoh.com/login',
  doc({ title: 'Masuk', inputs: [input({ type: 'password', name: 'pw' }, 'https://pengumpul-data.example/collect')] }),
  'warn', 'exact');

page('urgensi + minta OTP', 'https://www.contoh.com/verifikasi',
  doc({ text: 'Akun Anda diblokir! Verifikasi sekarang dalam 24 jam.', inputs: [input({ name: 'otp', placeholder: 'Kode OTP' }, '/v')] }),
  'warn', 'exact');

page('judul mengaku DANA di domain lain', 'https://akun-aman.com/masuk',
  doc({ title: 'Login DANA', inputs: [input({ type: 'password' }, '/x')] }), 'warn', 'atleast');

page('judul DANA di domain resmi', 'https://dana.id/masuk',
  doc({ title: 'Login DANA', inputs: [input({ type: 'password' }, '/x')] }), 'none', 'exact');

page('berita yang menyebut Google (tanpa isian)', 'https://berita.example.com/artikel',
  doc({ title: 'Google luncurkan fitur baru', inputs: [] }), 'none', 'exact');

page('kata sandi di http', 'http://www.contoh.com/login',
  doc({ inputs: [input({ type: 'password' }, '/s')] }), 'warn', 'atleast');

// ---- Data pribadi ----
page('formulir seperti di foto (5 jenis data), domain biasa', 'https://survei.contoh.com/isi',
  doc({ inputs: foto('/kirim') }), 'note', 'exact');

page('formulir foto + umpan hadiah + domain berisiko', 'https://hadiah-survei.top/isi',
  doc({ text: 'Selamat anda terpilih! Klaim sekarang hadiah anda.', inputs: foto('/kirim') }), 'danger', 'atleast');

page('formulir foto dikirim ke domain lain', 'https://survei.contoh.com/isi',
  doc({ inputs: foto('https://penampung-data.example/in') }), 'note', 'atleast');

page('pendaftaran biasa (3 jenis data) tidak ditandai tinggi', 'https://app.contoh.com/daftar',
  doc({ inputs: [
    input({ name: 'nama_lengkap' }, '/daftar'),
    input({ type: 'email', name: 'email' }, '/daftar'),
    input({ type: 'tel', name: 'hp' }, '/daftar')
  ] }), 'note', 'exact');

page('login biasa (email + password) tidak ditandai', 'https://app.contoh.com/masuk',
  doc({ inputs: [input({ type: 'email', name: 'email' }, '/masuk'), input({ type: 'password' }, '/masuk')] }), 'none', 'exact');

page('formulir foto di domain resmi DANA tidak ditandai brand', 'https://dana.id/survei',
  doc({ title: 'Survei DANA', inputs: foto('/kirim') }), 'note', 'exact');

page('formulir foto mengaku DANA di domain lain', 'https://survei-akun.com/isi',
  doc({ title: 'Survei DANA', inputs: foto('/kirim') }), 'warn', 'atleast');

console.log('\n' + pass + ' lolos, ' + fail + ' gagal');
process.exit(fail ? 1 : 0);
