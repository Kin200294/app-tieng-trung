// Service Worker — ưu tiên mạng (luôn lấy bản mới khi có internet),
// chỉ dùng bản lưu đệm khi offline. Tránh tình trạng "sửa mà không thấy đổi".
const CACHE = 'hochan-v17';
const ASSETS = [
  './', 
  './index.html', 
  './admin.html', 
  './styles.css', 
  './dashboard.css', 
  './js/core.js', 
  './js/db.js', 
  './js/auth.js', 
  './js/flashcard.js', 
  './js/vocab.js', 
  './js/quiz.js', 
  './js/game.js', 
  './js/passage.js', 
  './js/writer.js', 
  './js/dashboard.js', 
  './js/app_init.js', 
  './js/exam.js', 
  './js/aichat.js', 
  './logo1.jpg', 
  './manifest.json'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // bỏ qua giọng đọc TTS & font bên ngoài

  // Ưu tiên mạng; nếu offline thì lấy bản đã lưu đệm
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
  );
});
