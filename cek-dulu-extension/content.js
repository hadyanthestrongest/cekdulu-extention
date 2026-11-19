/*
 * Cek Dulu - content script.
 * Menganalisis halaman secara lokal, menampilkan notifikasi kecil (toast) di
 * pojok kanan atas bila ada tanda mencurigakan, dan menjawab permintaan popup.
 * Tidak ada data yang dikirim keluar dari browser.
 */
(function () {
  'use strict';
  if (window.top !== window || typeof CekDulu === 'undefined') return;

  const RANK = { none: 0, note: 1, warn: 2, danger: 3 };
  const ACCENT = { note: '#496af1', warn: '#f08a00', danger: '#d9263f' };
  const COLLAPSE_MS = { note: 8000, warn: 12000 };

  let host = null;
  let root = null;
  let shownRank = 0;
  let closed = false;       // pengguna menutup notifikasi di halaman ini
  let collapseTimer = null;

  function el(tag, props, text) {
    const n = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) { n.setAttribute(k, props[k]); });
    if (text) n.textContent = text;
    return n;
  }

  function mount() {
    if (host && host.isConnected) return;
    host = el('div', { id: 'cek-dulu-toast-host' });
    host.style.cssText = 'all:initial;';
    root = host.attachShadow({ mode: 'open' });
    (document.documentElement || document.body).appendChild(host);
  }

  function unmount() {
    clearTimeout(collapseTimer);
    if (host) host.remove();
    host = null;
    root = null;
  }

  function css(accent) {
    return (
      '*{box-sizing:border-box}' +
      '.wrap{position:fixed;top:16px;right:16px;z-index:2147483647;' +
      'font:14px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#231f20}' +
      '.toast{width:300px;max-width:calc(100vw - 32px);background:#fff;border-radius:14px;' +
      'border-left:6px solid ' + accent + ';box-shadow:0 8px 28px rgba(0,0,0,.3);overflow-y:auto;max-height:calc(100vh - 32px);' +
      'animation:in .4s cubic-bezier(.2,.9,.3,1.2)}' +
      '@keyframes in{from{transform:translateX(120%);opacity:0}to{transform:none;opacity:1}}' +
      '.brand{display:flex;align-items:center;gap:6px;padding:7px 12px 6px;background:#eef1ff;' +
      'border-bottom:3px solid #e6e51e;font:700 13px/1 Georgia,"Times New Roman",serif;color:#231f20;letter-spacing:.2px}' +
      '.brand img{width:20px;height:20px;display:block}' +
      '.head{display:flex;gap:10px;align-items:flex-start;padding:12px 10px 8px 12px}' +
      '.ico{position:relative;flex:none;width:32px;height:32px;border-radius:50%;background:' + accent + ';' +
      'color:#fff;display:grid;place-items:center;font-weight:800;font-size:17px}' +
      '.ico::after{content:"";position:absolute;inset:0;border-radius:50%;border:2px solid ' + accent + ';' +
      'animation:ring 1.4s ease-out 3}' +
      '@keyframes ring{from{transform:scale(1);opacity:.9}to{transform:scale(2.1);opacity:0}}' +
      '.txt{flex:1;min-width:0}.t{font-weight:700;font-size:14px}' +
      '.s{font-size:12.5px;color:#5b5370;margin-top:2px}' +
      'button{font:inherit;cursor:pointer;border:0}' +
      '.x{flex:none;background:none;color:#8a8199;font-size:20px;line-height:1;padding:0 4px}' +
      '.x:hover{color:#231f20}' +
      '.act{padding:0 12px 12px 54px}' +
      '.more{background:' + accent + ';color:#fff;font-weight:600;font-size:12.5px;padding:5px 12px;border-radius:8px}' +
      '.more:hover{opacity:.9}' +
      '.detail{padding:0 12px 12px 12px;border-top:1px solid #eee6f6;margin-top:2px}' +
      '.detail ul{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:8px}' +
      '.detail .ft{font-weight:600;font-size:13px}.detail .fd{font-size:12px;color:#5b5370}' +
      '.q{margin-top:10px;font-size:12px;color:#5b5370}' +
      '.pill{display:flex;align-items:center;gap:6px;background:' + accent + ';color:#fff;font-weight:700;' +
      'font-size:13px;padding:8px 14px;border-radius:999px;box-shadow:0 4px 16px rgba(0,0,0,.3);' +
      'animation:in .3s ease-out}' +
      '@media (prefers-reduced-motion:reduce){*{animation:none!important}}'
    );
  }

  function topFindings(res, n) {
    return res.findings.slice().sort(function (a, b) { return b.weight - a.weight; }).slice(0, n);
  }

  function view(res, mode) {
    mount();
    while (root.firstChild) root.removeChild(root.firstChild);
    clearTimeout(collapseTimer);

    const accent = ACCENT[res.level];
    const style = el('style');
    style.textContent = css(accent);
    root.appendChild(style);
    const wrap = el('div', { class: 'wrap' });
    root.appendChild(wrap);

    if (mode === 'pill') {
      const pill = el('button', { class: 'pill', type: 'button', 'aria-label': 'Cek dulu: lihat tanda mencurigakan' },
        '⚠ Cek dulu');
      pill.addEventListener('click', function () { view(res, 'open'); });
      wrap.appendChild(pill);
      return;
    }

    const expanded = mode === 'expanded';
    const top = topFindings(res, 1)[0];
    const extra = res.findings.length - 1;

    const toast = el('div', { class: 'toast', role: 'alert' });
    if (typeof CekDuluBrand !== 'undefined') {
      const brand = el('div', { class: 'brand' });
      brand.appendChild(el('img', { src: CekDuluBrand.markDataUri, alt: '' }));
      brand.appendChild(el('span', null, 'CekDulu'));
      toast.appendChild(brand);
    }
    const head = el('div', { class: 'head' });
    head.appendChild(el('div', { class: 'ico', 'aria-hidden': 'true' }, '!'));

    const txt = el('div', { class: 'txt' });
    const TITLES = {
      danger: 'Awas, jangan kepancing!',
      warn: 'Cek dulu, ada yang janggal',
      note: 'Ada catatan kecil, cek dulu'
    };
    txt.appendChild(el('div', { class: 't' }, TITLES[res.level]));
    txt.appendChild(el('div', { class: 's' }, top.title + (extra > 0 ? ' (+' + extra + ' tanda lain)' : '')));
    head.appendChild(txt);

    const x = el('button', { class: 'x', type: 'button', 'aria-label': 'Tutup' }, '×');
    x.addEventListener('click', function () { closed = true; unmount(); });
    head.appendChild(x);
    toast.appendChild(head);

    if (!expanded) {
      const act = el('div', { class: 'act' });
      const more = el('button', { class: 'more', type: 'button' }, 'Lihat alasannya');
      more.addEventListener('click', function () { view(res, 'expanded'); });
      act.appendChild(more);
      toast.appendChild(act);
    } else {
      const d = el('div', { class: 'detail' });
      const ul = el('ul');
      topFindings(res, 5).forEach(function (fnd) {
        const li = el('li');
        li.appendChild(el('div', { class: 'ft' }, fnd.title));
        li.appendChild(el('div', { class: 'fd' }, fnd.detail));
        ul.appendChild(li);
      });
      d.appendChild(ul);
      d.appendChild(el('div', { class: 'q' },
        'Tanya dirimu: Siapa yang kirim? Kenapa harus sekarang? Kenapa mereka butuh itu? ' +
        'Klik ikon ekstensi untuk ringkasan lengkap.'));
      toast.appendChild(d);
    }

    wrap.appendChild(toast);

    // Tingkat "catatan" dan "peringatan" menciut jadi pill kecil agar tidak mengganggu;
    // tingkat "bahaya" tetap terbuka sampai ditutup pengguna.
    if (COLLAPSE_MS[res.level] && mode === 'open') {
      collapseTimer = setTimeout(function () { view(res, 'pill'); }, COLLAPSE_MS[res.level]);
    }
  }

  function run() {
    let res;
    try { res = CekDulu.analyzeAll(location.href, document); } catch (e) { return; }
    try { chrome.runtime.sendMessage({ type: 'cekdulu:result', level: res.level }); } catch (e) { /* konteks lama */ }
    if (closed) return;
    if (res.level !== 'none' && RANK[res.level] > shownRank) {
      shownRank = RANK[res.level];
      view(res, 'open');
    }
  }

  try {
    chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
      if (msg && msg.type === 'cekdulu:analyze') {
        sendResponse(CekDulu.analyzeAll(location.href, document));
      }
    });
  } catch (e) { /* abaikan */ }

  // Jalankan setelah halaman siap, lalu sekali lagi untuk konten yang dirender belakangan.
  if (document.readyState === 'complete') setTimeout(run, 300);
  else window.addEventListener('load', function () { setTimeout(run, 300); });
  setTimeout(run, 3000);
})();
