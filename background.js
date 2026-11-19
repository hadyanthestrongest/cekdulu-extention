// Cek Dulu - service worker kecil: hanya mengatur lencana (badge) pada ikon.
// Tidak ada permintaan jaringan dan tidak ada data yang disimpan.
chrome.runtime.onMessage.addListener(function (msg, sender) {
  if (!msg || msg.type !== 'cekdulu:result' || !sender.tab || sender.tab.id == null) return;
  const tabId = sender.tab.id;
  const map = {
    danger: { text: '!!', color: '#d9263f' },
    warn: { text: '!', color: '#f08a00' },
    note: { text: 'i', color: '#a87a00' }
  };
  const m = map[msg.level];
  chrome.action.setBadgeText({ tabId: tabId, text: m ? m.text : '' });
  if (m) chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: m.color });
});
