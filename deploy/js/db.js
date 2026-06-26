/* ============================================================
   Học Chữ Hán - db.js
   ============================================================ */

  // ===== Firebase: đồng bộ chữ + bảng xếp hạng =====
  const FB_CONFIG = {
    apiKey: "AIzaSyDB15EkqWvyFpUTdy_1D80DnKg1cT-946Q",
    authDomain: "hoc-chu-han.firebaseapp.com",
    projectId: "hoc-chu-han",
    storageBucket: "hoc-chu-han.firebasestorage.app",
    messagingSenderId: "730479874371",
    appId: "1:730479874371:web:0219d04f0f1279ba0c9ff6"
  };
  try {
    if (window.firebase && firebase.initializeApp) {
      firebase.initializeApp(FB_CONFIG);
      db = firebase.firestore();
      // Đăng nhập ẩn danh để Security Rules cho phép ghi (mỗi máy 1 tài khoản ẩn danh, tự nhớ)
      if (firebase.auth) {
        firebase.auth().signInAnonymously().catch(() => {});
      }
    }
  } catch (e) { db = null; }

  // ===== Từ vựng CHUNG cho cả lớp (shared/words) =====
  // Đẩy lên đám mây: chỉ chữ/pinyin/nghĩa/bài (không gồm tiến độ cá nhân)
  function pushVocab() {
    if (!db) return;
    const vocab = items.map(it => ({ h: it.h, p: it.p, m: it.m, l: it.l || '', ex: it.ex || '' }));
    lastVocabJson = JSON.stringify({ vocab: vocab, lessons: extraLessons, passages: passages, lockedLessons: lockedLessons });
    db.collection('shared').doc('words')
      .set({ vocab: vocab, lessons: extraLessons, passages: passages, lockedLessons: lockedLessons, updatedAt: Date.now() })
      .catch(() => {});
  }
  // Nhận nội dung chung: cập nhật chữ/bài/bài khóa nhưng GIỮ tiến độ cá nhân (khớp theo chữ Hán)
  function applyShared(data) {
    const prev = {};
    items.forEach(it => { prev[it.h] = it; });
    const vocab = Array.isArray(data.vocab) ? data.vocab : [];
    items = vocab.map(v => {
      const o = prev[v.h] || {};
      return normalizeItem({ h: v.h, p: v.p, m: v.m, l: v.l || '', ex: v.ex || '', known: o.known, level: o.level, due: o.due, flag: o.flag });
    });
    extraLessons = Array.isArray(data.lessons) ? data.lessons.filter(Boolean) : extraLessons;
    lockedLessons = Array.isArray(data.lockedLessons) ? data.lockedLessons.filter(Boolean) : lockedLessons;
    passages = Array.isArray(data.passages) ? data.passages : passages;
    lastVocabJson = JSON.stringify({ vocab: items.map(it => ({ h: it.h, p: it.p, m: it.m, l: it.l || '', ex: it.ex || '' })), lessons: extraLessons, passages: passages, lockedLessons: lockedLessons });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    localStorage.setItem(LESSON_KEY, JSON.stringify(extraLessons));
    saveLockedLessons();
    savePassages();
    rebuildOrder(); updateLessonFilter(); renderList(); renderGrid();
  }
  function subscribeShared() {
    if (!db) return;
    if (sharedUnsub) sharedUnsub();
    sharedUnsub = db.collection('shared').doc('words').onSnapshot(snap => {
      if (!snap.exists) { if (items.length || passages.length || lockedLessons.length) pushVocab(); return; }   // chưa có -> đẩy bản hiện tại lên
      const data = snap.data();
      const j = JSON.stringify({ vocab: data.vocab || [], lessons: data.lessons || [], passages: data.passages || [], lockedLessons: data.lockedLessons || [] });
      if (j === lastVocabJson) return;   // chính mình vừa đẩy -> bỏ qua
      applyShared(data);
    }, () => {});
  }
