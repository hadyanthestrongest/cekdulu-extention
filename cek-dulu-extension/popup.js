/*
 * Cek Dulu - popup. Meminta hasil analisis dari content script di tab aktif.
 * Kalau content script belum ada (halaman dibuka sebelum ekstensi dipasang),
 * popup tetap menganalisis alamatnya saja, secara lokal.
 */
(function () {
  'use strict';

  const statusEl = document.getElementById('status');
  const titleEl = document.getElementById('status-title');
  const hostEl = document.getElementById('status-host');
  const noticeEl = document.getElementById('notice');
  const questionsEl = document.getElementById('questions');

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function showNotice(text) {
    noticeEl.textContent = text;
    noticeEl.hidden = false;
  }

  function render(res) {
    statusEl.className = 'status ' + res.level;
    titleEl.textContent = res.levelText;
    hostEl.textContent = res.host || '';

    questionsEl.textContent = '';
    res.questions.forEach(function (q) {
      const box = el('div', 'q' + (q.findings.length ? ' flag' : ''));
      const h = el('h2');
      h.appendChild(el('span', 'num', String(q.id)));
      h.appendChild(document.createTextNode(q.title));
      box.appendChild(h);

      if (q.findings.length) {
        const ul = el('ul', 'finds');
        q.findings.forEach(function (x) {
          const li = el('li');
          li.appendChild(el('div', 'ft', x.title));
          li.appendChild(el('div', 'fd', x.detail));
          ul.appendChild(li);
        });
        box.appendChild(ul);
      } else {
        box.appendChild(el('p', 'hint', q.hint));
      }
      questionsEl.appendChild(box);
    });
  }

  function urlOnly(url) {
    const res = CekDulu.analyzeAll(url, null);
    render(res);
    return res;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const tab = tabs && tabs[0];
    if (!tab || !tab.url || !/^https?:/i.test(tab.url)) {
      render(CekDulu.analyzeAll('about:blank', null));
      statusEl.className = 'status none';
      titleEl.textContent = 'Halaman ini tidak bisa dianalisis';
      hostEl.textContent = '';
      showNotice('Ekstensi hanya memeriksa halaman web http dan https. Buka situs yang ingin kamu cek, lalu klik ikon ini lagi.');
      return;
    }

    chrome.tabs.sendMessage(tab.id, { type: 'cekdulu:analyze' }, function (res) {
      if (chrome.runtime.lastError || !res) {
        urlOnly(tab.url);
        showNotice('Isi halaman belum bisa diperiksa (halaman dibuka sebelum ekstensi aktif). Muat ulang halaman untuk pemeriksaan penuh. Untuk sementara, hanya alamatnya yang diperiksa.');
        return;
      }
      render(res);
    });
  });
})();
