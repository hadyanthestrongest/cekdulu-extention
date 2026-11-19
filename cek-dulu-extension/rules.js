/*
 * Cek Dulu - aturan heuristik (semua berjalan lokal, tanpa jaringan).
 * File ini dipakai bersama oleh content script, popup, dan test.js.
 *
 * Penting: hasilnya adalah "tanda yang ditemukan", bukan vonis aman/tidak aman.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CekDulu = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------- domain util

  // Akhiran dua level (dan layanan hosting gratis) supaya "registrable domain"
  // dihitung benar. Daftar ini ringkas, bukan Public Suffix List penuh.
  const PUBLIC_SUFFIXES = new Set([
    'co.id', 'go.id', 'ac.id', 'or.id', 'web.id', 'my.id', 'sch.id', 'mil.id',
    'net.id', 'desa.id', 'biz.id', 'com.au', 'co.uk', 'com.sg', 'com.my', 'co.jp',
    'github.io', 'pages.dev', 'vercel.app', 'netlify.app', 'web.app',
    'firebaseapp.com', 'blogspot.com', 'weebly.com', 'wixsite.com',
    '000webhostapp.com', 'glitch.me', 'herokuapp.com', 'workers.dev', 'repl.co'
  ]);

  function parseUrl(input) {
    try { return new URL(input); } catch (e) { return null; }
  }

  function registrableDomain(host) {
    const labels = host.split('.');
    if (labels.length <= 2) return host;
    const last2 = labels.slice(-2).join('.');
    if (PUBLIC_SUFFIXES.has(last2)) return labels.slice(-3).join('.');
    return last2;
  }

  function isIPv4(h) { return /^\d{1,3}(\.\d{1,3}){3}$/.test(h); }

  function isPrivateHost(h) {
    const bare = h.replace(/^\[|\]$/g, '');
    if (bare === 'localhost' || bare.endsWith('.localhost') || bare === '::1') return true;
    if (isIPv4(bare)) {
      const p = bare.split('.').map(Number);
      return p[0] === 10 || p[0] === 127 ||
        (p[0] === 192 && p[1] === 168) ||
        (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
        (p[0] === 169 && p[1] === 254);
    }
    return false;
  }

  // ---------------------------------------------------------------- daftar brand
  // Daftar domain resmi ini sengaja ringkas dan BELUM tentu lengkap. Kalau ada
  // domain resmi yang tidak tercatat, ia akan ditandai "perlu dicek" (bukan
  // "pasti palsu"), makanya teks temuan dibuat netral. Mohon diverifikasi dan
  // dilengkapi sebelum dipakai di luar demo.
  const BRANDS = [
    { name: 'BCA', key: 'bca', official: ['bca.co.id', 'klikbca.com'] },
    { name: 'BRI', key: 'bri', official: ['bri.co.id'] },
    { name: 'Bank Mandiri', key: 'mandiri', official: ['bankmandiri.co.id'] },
    { name: 'BNI', key: 'bni', official: ['bni.co.id'] },
    { name: 'GoPay', key: 'gopay', official: ['gopay.co.id', 'gojek.com'] },
    { name: 'Gojek', key: 'gojek', official: ['gojek.com'] },
    { name: 'OVO', key: 'ovo', official: ['ovo.id'] },
    { name: 'DANA', key: 'dana', official: ['dana.id'] },
    { name: 'LinkAja', key: 'linkaja', official: ['linkaja.id'] },
    { name: 'Shopee', key: 'shopee', official: ['shopee.co.id', 'shopee.com', 'shopeepay.co.id'] },
    { name: 'Tokopedia', key: 'tokopedia', official: ['tokopedia.com'] },
    { name: 'Lazada', key: 'lazada', official: ['lazada.co.id', 'lazada.com'] },
    { name: 'Telkomsel', key: 'telkomsel', official: ['telkomsel.com'] },
    { name: 'BPJS', key: 'bpjs', official: ['bpjs-kesehatan.go.id', 'bpjsketenagakerjaan.go.id'] },
    { name: 'JNE', key: 'jne', official: ['jne.co.id'] },
    { name: 'Pos Indonesia', key: 'posindonesia', official: ['posindonesia.co.id'] },
    { name: 'Binance', key: 'binance', official: ['binance.com'] },
    { name: 'Google', key: 'google', official: ['google.com', 'google.co.id', 'googleapis.com', 'googleusercontent.com', 'gstatic.com'] },
    { name: 'Facebook', key: 'facebook', official: ['facebook.com', 'fb.com'] },
    { name: 'Instagram', key: 'instagram', official: ['instagram.com'] },
    { name: 'WhatsApp', key: 'whatsapp', official: ['whatsapp.com', 'whatsapp.net'] },
    { name: 'TikTok', key: 'tiktok', official: ['tiktok.com'] },
    { name: 'Telegram', key: 'telegram', official: ['telegram.org', 't.me'] },
    { name: 'PayPal', key: 'paypal', official: ['paypal.com', 'paypal.me'] },
    { name: 'Apple', key: 'apple', alts: ['appleid', 'icloud'], official: ['apple.com', 'icloud.com'] },
    { name: 'Microsoft', key: 'microsoft', official: ['microsoft.com', 'live.com', 'office.com', 'microsoftonline.com'] },
    { name: 'Netflix', key: 'netflix', official: ['netflix.com'] }
  ];

  const PRE = '(?:klik|my|m|e|go|app|bank|official)?';
  const POST = '(?:id|login|verify|verifikasi|secure|support|care|cs|help|promo|hadiah|official|indonesia|app|\\d+)?';
  BRANDS.forEach(function (b) {
    const keys = [b.key].concat(b.alts || []);
    b.re = new RegExp('^' + PRE + '(?:' + keys.join('|') + ')' + POST + '$');
  });

  const TRUSTED_SUFFIX = /(^|\.)(go\.id|ac\.id|sch\.id|mil\.id|gov|edu)$/;

  function tokensOf(s) { return s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean); }

  // Variasi huruf yang menyerupai: 0->o, 3->e, 4->a, 5->s, 7->t, 1->l / 1->i, rn->m
  function leetVariants(token) {
    if (!/[0-9]|rn/.test(token)) return [];
    const base = token.replace(/0/g, 'o').replace(/3/g, 'e').replace(/4/g, 'a')
      .replace(/5/g, 's').replace(/7/g, 't').replace(/rn/g, 'm');
    return [base.replace(/1/g, 'l'), base.replace(/1/g, 'i')];
  }

  // Mengembalikan [{brand, kind: 'impersonation' | 'lookalike'}] untuk daftar token.
  function matchBrands(tokens) {
    const found = new Map();
    tokens.forEach(function (t) {
      BRANDS.forEach(function (b) {
        if (found.get(b.name) === 'impersonation') return;
        if (b.re.test(t)) { found.set(b.name, 'impersonation'); return; }
        if (!found.has(b.name) && leetVariants(t).some(function (v) { return b.re.test(v); })) {
          found.set(b.name, 'lookalike');
        }
      });
    });
    return Array.from(found, function (e) {
      return { brand: BRANDS.find(function (b) { return b.name === e[0]; }), kind: e[1] };
    });
  }

  // ---------------------------------------------------------------- konstanta aturan

  const SHORTENERS = new Set([
    'bit.ly', 'tinyurl.com', 't.co', 'cutt.ly', 'rb.gy', 'is.gd', 's.id',
    'shorturl.at', 'ow.ly', 'buff.ly', 'rebrand.ly', 'tiny.cc', 'lnkd.in'
  ]);

  const RISKY_TLDS = new Set([
    'xyz', 'top', 'click', 'icu', 'cfd', 'sbs', 'cyou', 'buzz', 'rest',
    'monster', 'tk', 'ml', 'ga', 'cf', 'gq', 'zip', 'mov', 'vip', 'work'
  ]);

  const PHISHY_WORDS = new Set([
    'login', 'signin', 'verify', 'verifikasi', 'secure', 'security', 'update',
    'akun', 'account', 'konfirmasi', 'confirm', 'support', 'helpdesk', 'otp'
  ]);
  const BAIT_WORDS = new Set([
    'hadiah', 'klaim', 'claim', 'undian', 'bonus', 'giveaway', 'gratis', 'free',
    'blokir', 'kaget', 'berhadiah', 'menang', 'winner', 'reward'
  ]);

  const URGENCY_STRONG = [
    'akun anda diblokir', 'akun anda akan diblokir', 'akun diblokir',
    'akun anda ditangguhkan', 'segera verifikasi', 'verifikasi sekarang',
    'verifikasi akun', 'dalam 24 jam', 'selamat anda terpilih', 'anda memenangkan',
    'klaim sekarang', 'klaim hadiah', 'hadiah anda', 'akan hangus', 'tindakan segera',
    'your account has been', 'your account will be', 'verify your account',
    'act now', 'within 24 hours', 'claim your', 'account suspended'
  ];
  const URGENCY_WEAK = ['segera', 'hangus', 'batas waktu', 'urgent', 'hari ini saja', 'terakhir', 'limited time'];

  const SENSITIVE_FIELD = /(^|[^a-z])(otp|pin|cvv|cvc|cvn|nik|ktp)([^a-z]|$)|kode\s*(otp|verifikasi)|one[- ]?time|nomor\s*kartu|no\.?\s*kartu|card[- ]?number|kartu\s*kredit|ibu\s*kandung|rekening|selfie|foto\s*(ktp|diri)/;

  // Data pribadi "biasa" yang bila dikumpulkan bersamaan bisa dipakai untuk
  // profiling atau menyusun umpan yang pas untuk korban.
  const PERSONAL_FIELDS = [
    { label: 'nama lengkap', test: function (i) {
      return /nama\s*lengkap|full[ _-]?name|first[ _-]?name|last[ _-]?name|nama\s*(depan|belakang)|(^|[^a-z])nama([^a-z]|$)/.test(i.text) &&
        !/nama\s*pengguna|user\s*name/.test(i.text); } },
    { label: 'jenis kelamin', test: function (i) {
      return /jenis\s*kelamin|gender|(^|[^a-z])sex([^a-z]|$)|laki[- ]?laki|perempuan|pria|wanita/.test(i.text); } },
    { label: 'usia / tanggal lahir', test: function (i) {
      return /(^|[^a-z])(usia|umur|age|dob)([^a-z]|$)|tanggal\s*lahir|tgl\s*lahir|birth|tahun\s*lahir/.test(i.text); } },
    { label: 'email', test: function (i) { return i.type === 'email' || /e-?mail/.test(i.text); } },
    { label: 'nomor telepon', test: function (i) {
      return i.type === 'tel' || /telepon|telp|no\.?\s*hp|handphone|whatsapp|(^|[^a-z])(wa|phone|mobile)([^a-z]|$)/.test(i.text); } },
    { label: 'alamat / tempat tinggal', test: function (i) {
      return /alamat|address|tempat\s*tinggal|domisili|(^|[^a-z])(kota|city|kabupaten|provinsi|kecamatan|kelurahan)([^a-z]|$)|kode\s*pos|postal|zip/.test(i.text); } },
    { label: 'pekerjaan / penghasilan', test: function (i) {
      return /pekerjaan|profesi|penghasilan|gaji|income|occupation/.test(i.text); } }
  ];

  // ---------------------------------------------------------------- pembuat temuan

  function f(id, q, weight, title, detail) {
    return { id: id, q: q, weight: weight, title: title, detail: detail };
  }

  // ---------------------------------------------------------------- analisis URL

  function analyzeUrl(input) {
    const out = { findings: [], host: '', registrable: '', skipped: false };
    const u = parseUrl(input);
    if (!u || !/^https?:$/.test(u.protocol)) { out.skipped = true; return out; }

    const host = u.hostname.toLowerCase();
    out.host = host;
    if (isPrivateHost(host)) { out.skipped = true; return out; }

    const registrable = registrableDomain(host);
    out.registrable = registrable;
    const F = out.findings;
    const trusted = TRUSTED_SUFFIX.test(host);

    if (u.protocol === 'http:') {
      F.push(f('no-https', 3, 1.5, 'Tanpa HTTPS',
        'Koneksi tidak terenkripsi, jadi apa pun yang kamu ketik bisa dibaca pihak lain di jaringan.'));
    }

    if (u.username || u.password) {
      const faked = /\./.test(decodeURIComponent(u.username || ''));
      F.push(f('userinfo', 1, faked ? 5 : 3, 'Ada tanda "@" di alamat',
        'Bagian sebelum "@" diabaikan browser. Penipu memakainya agar alamat terlihat seperti situs lain.'));
    }

    const isIp = isIPv4(host) || host.startsWith('[');
    if (isIp) {
      F.push(f('ip-host', 1, 3, 'Alamat berupa angka (IP)',
        'Situs resmi hampir selalu memakai nama domain, bukan deretan angka.'));
    }

    if (host.split('.').some(function (l) { return l.startsWith('xn--'); })) {
      F.push(f('punycode', 1, 3, 'Alamat memakai karakter menyerupai huruf biasa',
        'Domain ini memakai karakter Unicode (punycode) yang bisa tampak identik dengan huruf Latin.'));
    }

    if (SHORTENERS.has(registrable)) {
      F.push(f('shortener', 1, 1.5, 'Tautan dipendekkan',
        'Tujuan sebenarnya tidak terlihat. Buka pratinjau tautan atau cari situs resminya sendiri.'));
    }

    if (!isIp && !trusted) {
      const tokens = tokensOf(host.replace(/\.[a-z0-9-]+$/, ''));
      const official = BRANDS.some(function (b) { return b.official.indexOf(registrable) !== -1; });

      matchBrands(tokens).forEach(function (m) {
        if (m.brand.official.indexOf(registrable) !== -1) return;
        if (m.kind === 'impersonation') {
          F.push(f('brand-' + m.brand.key, 1, 4, 'Nama ' + m.brand.name + ' muncul di alamat',
            'Domain ini (' + registrable + ') tidak ada di daftar domain resmi ' + m.brand.name +
            ' milik ekstensi ini. Buka situs resminya sendiri untuk memastikan.'));
        } else {
          F.push(f('lookalike-' + m.brand.key, 1, 4, 'Alamat menyerupai ' + m.brand.name,
            'Ada huruf yang diganti angka atau gabungan huruf yang mirip, dan domainnya bukan milik resmi ' + m.brand.name + '.'));
        }
      });

      const tld = host.split('.').pop();
      if (RISKY_TLDS.has(tld)) {
        F.push(f('risky-tld', 1, 1, 'Akhiran domain ".' + tld + '"',
          'Akhiran ini sering dipakai situs sekali pakai. Ini hanya petunjuk, banyak situs sah juga memakainya.'));
      }

      const regLabel = registrable.split('.')[0];
      if ((regLabel.match(/-/g) || []).length >= 3) {
        F.push(f('hyphens', 1, 1, 'Banyak tanda hubung di domain',
          'Domain panjang dengan banyak "-" sering dipakai untuk meniru nama lain.'));
      }

      const subCount = host.split('.').length - registrable.split('.').length;
      if (subCount >= 3) {
        F.push(f('subdomains', 1, 1.5, 'Subdomain bertumpuk',
          'Bagian yang penting ada di akhir domain. Subdomain panjang bisa dipakai untuk mengelabui.'));
      }

      if (!official) {
        const cleaned = tokens.map(function (t) { return t.replace(/\d+$/, ''); });
        if (cleaned.some(function (t) { return PHISHY_WORDS.has(t); })) {
          F.push(f('phishy-words', 1, 1.5, 'Kata "pancingan" di alamat',
            'Kata seperti login, verify, atau akun di dalam domain sering dipakai untuk menyamar.'));
        }
        if (cleaned.some(function (t) { return BAIT_WORDS.has(t); })) {
          F.push(f('bait-words', 2, 1.5, 'Kata umpan di alamat',
            'Kata seperti hadiah, klaim, atau undian di dalam domain adalah umpan yang umum dipakai.'));
        }
      }
    }

    if (u.port && u.port !== '80' && u.port !== '443') {
      F.push(f('port', 1, 1.5, 'Port tidak biasa (' + u.port + ')',
        'Situs publik biasanya tidak memakai port khusus.'));
    }

    return out;
  }

  // ---------------------------------------------------------------- analisis halaman

  // Teks konteks sebuah isian: atribut, label terkait, dan teks baris/kelompoknya
  // (label sering ada di sel tabel sebelahnya, bukan di atribut).
  function inputInfo(el) {
    const type = String(el.type || '').toLowerCase();
    const parts = [el.name, el.id, el.placeholder, el.autocomplete, el.title, el.ariaLabel];
    if (type === 'radio') parts.push(el.value);
    if (el.labels && el.labels.length) {
      Array.prototype.forEach.call(el.labels, function (l) { parts.push(l.textContent); });
    }
    if (typeof el.closest === 'function') {
      const row = el.closest('tr, .form-group, .form-row, .field, .row');
      if (row && row.textContent && row.textContent.length < 120) parts.push(row.textContent);
    }
    return { type: type, text: parts.filter(Boolean).join(' ').toLowerCase() };
  }

  // Host tujuan formulir bila berbeda domain dari halaman, selain itu null.
  function actionHost(action, href, pageReg) {
    if (!action) return null;
    try {
      const t = new URL(action, href);
      if (!/^https?:$/.test(t.protocol)) return null;
      const h = t.hostname.toLowerCase();
      return registrableDomain(h) !== pageReg ? h : null;
    } catch (e) { return null; }
  }

  function analyzePage(doc, href) {
    const F = [];
    const u = parseUrl(href);
    if (!u || !doc) return F;
    const host = u.hostname.toLowerCase();
    if (isPrivateHost(host) || !/^https?:$/.test(u.protocol)) return F;
    const pageReg = registrableDomain(host);

    // Isian
    const fields = Array.prototype.slice.call(doc.querySelectorAll('input, select, textarea'));
    let hasPassword = false;
    let hasSensitive = false;
    const personal = new Set();
    const crossSens = new Set();
    const crossPersonal = new Set();

    fields.forEach(function (el) {
      const info = inputInfo(el);
      if (/^(hidden|submit|button|checkbox|image|reset)$/.test(info.type)) return;
      const isPw = info.type === 'password';
      const isSens = SENSITIVE_FIELD.test(info.text);
      let isPers = false;
      PERSONAL_FIELDS.forEach(function (p) {
        if (p.test(info)) { personal.add(p.label); isPers = true; }
      });
      if (isPw) hasPassword = true;
      if (isSens) hasSensitive = true;
      if ((isPw || isSens || isPers) && el.form && typeof el.form.getAttribute === 'function') {
        const target = actionHost(el.form.getAttribute('action'), href, pageReg);
        if (target) (isPw || isSens ? crossSens : crossPersonal).add(target);
      }
    });

    if (u.protocol === 'http:' && hasPassword) {
      F.push(f('http-password', 3, 2.5, 'Kolom kata sandi di halaman tanpa HTTPS',
        'Kata sandi yang kamu ketik dikirim tanpa enkripsi.'));
    }

    if (crossSens.size) {
      F.push(f('cross-form', 3, 3, 'Formulir mengirim data ke situs lain',
        'Isian sensitif di halaman ini dikirim ke domain berbeda: ' + Array.from(crossSens).join(', ') + '.'));
    } else if (crossPersonal.size) {
      F.push(f('cross-form-personal', 3, 1.5, 'Data pribadimu dikirim ke situs lain',
        'Bisa wajar (misalnya layanan survei pihak ketiga), tapi pastikan kamu tahu siapa penerimanya: ' +
        Array.from(crossPersonal).join(', ') + '.'));
    }

    if (hasSensitive) {
      F.push(f('sensitive-field', 3, 1.5, 'Meminta data sensitif',
        'Halaman ini meminta OTP, PIN, nomor kartu, KTP, atau sejenisnya. Tanya dulu: kenapa mereka butuh itu? Kode OTP tidak boleh diberikan ke siapa pun.'));
    }

    if (personal.size >= 3) {
      F.push(f('personal-data', 3, personal.size >= 5 ? 2 : 1, 'Meminta banyak data pribadi',
        'Halaman ini meminta ' + Array.from(personal).join(', ') + '. Kombinasi data seperti ini bisa dipakai untuk profiling ' +
        'atau menyusun umpan yang pas untukmu. Wajar di survei atau pendaftaran resmi, jadi pastikan siapa penyelenggaranya dan kenapa data itu dibutuhkan.'));
    }

    // Judul menyebut brand, tapi domain bukan milik brand itu
    if ((hasPassword || hasSensitive || personal.size >= 3) && !TRUSTED_SUFFIX.test(host)) {
      const title = String(doc.title || '');
      const hits = matchBrands(tokensOf(title)).filter(function (m) {
        return m.kind === 'impersonation' && m.brand.official.indexOf(pageReg) === -1;
      });
      if (hits.length) {
        F.push(f('title-brand', 1, 3, 'Halaman mengaku sebagai ' + hits[0].brand.name,
          'Judul halaman menyebut ' + hits[0].brand.name + ' dan meminta data, tetapi domainnya (' +
          pageReg + ') tidak ada di daftar domain resmi.'));
      }
    }

    // Kata-kata mendesak
    const body = doc.body && typeof doc.body.innerText === 'string' ? doc.body.innerText : '';
    if (body) {
      const text = body.slice(0, 30000).toLowerCase();
      let points = 0;
      URGENCY_STRONG.forEach(function (p) { if (text.indexOf(p) !== -1) points += 1; });
      URGENCY_WEAK.forEach(function (p) { if (text.indexOf(p) !== -1) points += 0.5; });
      if (points >= 2) {
        F.push(f('urgency', 2, 2, 'Bahasa yang menekanmu',
          'Halaman ini banyak memakai kata mendesak atau hadiah. Penipu memang mengandalkan rasa panik dan buru-buru.'));
      }
    }

    return F;
  }

  // ---------------------------------------------------------------- gabungan

  const QUESTIONS = [
    { id: 1, title: 'Siapa yang kirim?', hint: 'Jangan percaya nama di layar. Buka aplikasi atau situs resminya sendiri, bukan lewat tautan di pesan.' },
    { id: 2, title: 'Kenapa harus sekarang?', hint: 'Urgensi seperti "akun diblokir" atau "hadiah hangus" adalah tanda umpan.' },
    { id: 3, title: 'Kenapa mereka butuh itu?', hint: 'Setiap permintaan data, OTP, atau transfer perlu alasan jelas. OTP tidak boleh diberikan ke siapa pun.' }
  ];

  function levelOf(score) {
    if (score >= 5) return 'danger';
    if (score >= 2.5) return 'warn';
    if (score > 0) return 'note';
    return 'none';
  }

  const LEVEL_TEXT = {
    danger: 'Banyak tanda bahaya',
    warn: 'Ada tanda mencurigakan',
    note: 'Ada catatan kecil',
    none: 'Tidak ada tanda mencurigakan yang kami temukan. Tetap cek dulu.'
  };

  function analyzeAll(href, doc) {
    const urlRes = analyzeUrl(href);
    if (urlRes.skipped) {
      return { href: href, host: urlRes.host, skipped: true, score: 0, level: 'none',
        levelText: 'Halaman ini tidak dianalisis (bukan situs web publik).', findings: [],
        questions: QUESTIONS.map(function (q) { return Object.assign({ findings: [] }, q); }) };
    }
    const findings = urlRes.findings.concat(doc ? analyzePage(doc, href) : []);
    const score = findings.reduce(function (s, x) { return s + x.weight; }, 0);
    const level = levelOf(score);
    return {
      href: href,
      host: urlRes.host,
      registrable: urlRes.registrable,
      skipped: false,
      score: score,
      level: level,
      levelText: LEVEL_TEXT[level],
      findings: findings,
      questions: QUESTIONS.map(function (q) {
        return Object.assign({}, q, { findings: findings.filter(function (x) { return x.q === q.id; }) });
      })
    };
  }

  return {
    analyzeUrl: analyzeUrl,
    analyzePage: analyzePage,
    analyzeAll: analyzeAll,
    registrableDomain: registrableDomain,
    levelOf: levelOf,
    QUESTIONS: QUESTIONS,
    LEVEL_TEXT: LEVEL_TEXT
  };
});
