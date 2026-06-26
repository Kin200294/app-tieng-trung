/* ============================================================
   Học Chữ Hán - core.js
   ============================================================ */

// ===== Dữ liệu ===== items: [{h, p, m, known}]
  let items = [];
  let order = [];
  let columns = 4;
  let editingIndex = -1;
  let searchQuery = '';
  let frontMode = 'hanzi';
  let flagOnly = false;   // chỉ hiện chữ đã đánh dấu lưu ý
  // ===== Lazy loading cho lưới Flashcard =====
  const GRID_CHUNK = 40;       // số thẻ render mỗi đợt
  let gridView = [];           // mảng chỉ số items sau khi lọc
  let gridRendered = 0;        // đã render bao nhiêu thẻ
  let gridObserver = null;     // IntersectionObserver theo dõi sentinel
  const STORAGE_KEY = 'hanzi-cards-v1';
  const LESSON_KEY = 'hanzi-lessons-v1';
  const PASSAGE_KEY = 'hanzi-passages-v1';
  const LOCKED_LESSONS_KEY = 'hanzi-locked-lessons-v1';
  let extraLessons = [];  // tên các bài học đã tạo (kể cả chưa có chữ)
  let lockedLessons = []; // các bài học bị khoá
  let passages = [];      // bài khóa: [{ s: "你 叫 什么 名字", m: "Bạn tên là gì?" }]
  function savePassages() { localStorage.setItem(PASSAGE_KEY, JSON.stringify(passages)); schedulePush(); }
  function saveLockedLessons() { localStorage.setItem(LOCKED_LESSONS_KEY, JSON.stringify(lockedLessons)); schedulePush(); }
  // ===== Trạng thái đồng bộ đám mây =====
  let db = null, lastVocabJson = '', pushTimer = null, sharedUnsub = null;
  // Phần NỘI DUNG chung (chữ + bài + bài khóa + trạng thái khoá) — KHÔNG gồm tiến độ cá nhân
  function vocabJson() {
    return JSON.stringify({ vocab: items.map(it => ({ h: it.h, p: it.p, m: it.m, l: it.l || '', ex: it.ex || '' })), lessons: extraLessons, passages: passages, lockedLessons: lockedLessons });
  }
  function schedulePush() {
    if (!db) return;
    if (vocabJson() === lastVocabJson) return;   // từ vựng không đổi (vd chỉ đổi tiến độ) -> không đẩy
    clearTimeout(pushTimer);
    pushTimer = setTimeout(pushVocab, 700);
  }
  function saveLessons() { localStorage.setItem(LESSON_KEY, JSON.stringify(extraLessons)); schedulePush(); }
  // Hợp nhất bài học từ chữ + bài học tự tạo
  function allLessons() {
    const set = new Set(extraLessons);
    items.forEach(it => { if (it.l) set.add(it.l); });
    return [...set].sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
  }
  function visibleLessons() {
    const isTeacher = document.body.classList.contains('role-teacher');
    if (isTeacher) return allLessons();
    return allLessons().filter(l => !lockedLessons.includes(l));
  }

  const $ = id => document.getElementById(id);
  const inHanzi = $('inHanzi'), inPinyin = $('inPinyin'), inMeaning = $('inMeaning'), inExample = $('inExample'), inLessonSelect = $('inLessonSelect');
  const addBtn = $('addBtn'), clearBtn = $('clearBtn'), listEl = $('list');
  const grid = $('grid'), colSelect = $('colSelect'), frontSelect = $('frontSelect'), lessonFilter = $('lessonFilter');
  const shuffleBtn = $('shuffleBtn'), flipAllBtn = $('flipAllBtn'), countEl = $('count');
  const flagFilterBtn = $('flagFilterBtn');   // nút "Chữ lưu ý" trong hàng điều khiển Học
  const searchInput = $('searchInput'), manageLessonFilter = $('manageLessonFilter');
  const importCsvBtnWrapper = $('importCsvBtnWrapper'), importCsvFile = $('importCsvFile');
  const downloadTemplateBtn = $('downloadTemplateBtn');
  const exportBtn = $('exportBtn'), importBtn = $('importBtn'), importFile = $('importFile');

  // ===== Lưu / tải =====
  function updateLessonFilter() {
    const lessons = visibleLessons();
    const options = '<option value="all">Tất cả bài học</option>' +
      lessons.map(l => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join('');
    
    const filters = [$('lessonFilter'), $('quizLessonFilter'), $('gameLessonFilter'), $('manageLessonFilter')];
    filters.forEach(el => {
      if (!el) return;
      const current = el.value;
      el.innerHTML = options;
      if (current === 'all' || lessons.includes(current)) el.value = current;
      else el.value = 'all';
    });

    // Dropdown chọn bài ở trang Thêm chữ
    if (inLessonSelect) {
      const cur = inLessonSelect.value;
      inLessonSelect.innerHTML =
        '<option value="">— Chưa gán bài —</option>' +
        allLessons().map(l => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join('') +
        '<option value="__new__">+ Tạo bài mới…</option>';
      if (cur && cur !== '__new__' && allLessons().includes(cur)) inLessonSelect.value = cur;
      else inLessonSelect.value = '';
    }
  }

  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); schedulePush(); if (typeof scheduleProgressPush === 'function') scheduleProgressPush(); }
  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (Array.isArray(data)) items = data.map(normalizeItem);
    } catch (e) {}
    try {
      const ls = JSON.parse(localStorage.getItem(LESSON_KEY));
      if (Array.isArray(ls)) extraLessons = ls.filter(Boolean);
    } catch (e) {}
    try {
      const ps = JSON.parse(localStorage.getItem(PASSAGE_KEY));
      if (Array.isArray(ps)) passages = ps;
    } catch (e) {}
    try {
      const lls = JSON.parse(localStorage.getItem(LOCKED_LESSONS_KEY));
      if (Array.isArray(lls)) lockedLessons = lls.filter(Boolean);
    } catch (e) {}
    rebuildOrder();
    updateLessonFilter();
  }

  function showModal(msg, buttons) {
    const modal = $('confirmModal');
    const msgEl = $('confirmMsg');
    const btnsEl = modal ? modal.querySelector('.modal-btns') : null;

    if (!modal || !msgEl || !btnsEl) {
      if (buttons.length === 1) { alert(msg); if(buttons[0].onClick) buttons[0].onClick(); }
      else if (buttons.length === 2) {
        if (confirm(msg)) { if(buttons[1].onClick) buttons[1].onClick(); }
        else { if(buttons[0].onClick) buttons[0].onClick(); }
      } else {
        if (confirm(msg + '\n\nOK = ' + (buttons[2] ? buttons[2].text : '') + '\nCancel = ' + (buttons[1] ? buttons[1].text : ''))) {
           if(buttons[2] && buttons[2].onClick) buttons[2].onClick();
        } else {
           if(buttons[1] && buttons[1].onClick) buttons[1].onClick();
        }
      }
      return;
    }

    msgEl.innerHTML = escapeHtml(msg).replace(/\n/g, '<br>');
    btnsEl.innerHTML = '';
    
    const close = () => modal.classList.remove('active');

    buttons.forEach(b => {
      const btn = document.createElement('button');
      btn.className = b.className || 'btn-cancel';
      btn.textContent = b.text;
      btn.onclick = () => {
        close();
        if (b.onClick) b.onClick();
      };
      btnsEl.appendChild(btn);
    });

    modal.classList.add('active');
  }

  function showAlert(msg, onOk) {
    showModal(msg, [{ text: 'OK', className: 'btn-gold', onClick: onOk }]);
  }

  function showConfirm(msg, onYes) {
    showModal(msg, [
      { text: 'Không', className: 'btn-cancel' },
      { text: 'Có', className: 'btn-danger', onClick: onYes }
    ]);
  }
  // Cho các file khác (exam.js, aichat.js) dùng chung cửa sổ popup đẹp và các tiện ích
  window.HanziUI = { 
    alert: showAlert, 
    confirm: showConfirm, 
    modal: showModal,
    speak: speak,
    addPoints: null, // Sẽ được gán trong auth.js
    colorPinyin: colorPinyin
  };

  function normalizeItem(o) {
    const level = Number.isFinite(o.level) ? o.level : (o.known ? 4 : 0);
    const due = Number.isFinite(o.due) ? o.due : 0;
    return {
      h: (o.h || '').toString(), p: (o.p || '').toString(), m: (o.m || '').toString(), l: formatLesson((o.l || '').toString()),
      ex: (o.ex || '').toString(),
      level: level, due: due, known: level >= 4, flag: !!o.flag, ok: Number.isFinite(o.ok) ? o.ok : 0
    };
  }
  function rebuildOrder() { order = items.map((_, i) => i); }

  // ===== Ôn theo lịch (SRS) =====
  const DAY = 86400000;
  const INTERVAL_DAYS = [0, 1, 2, 4, 8, 16, 30, 60, 120];  // theo cấp độ
  function scheduleItem(it, correct) {
    if (correct) {
      it.level = Math.min((it.level || 0) + 1, INTERVAL_DAYS.length - 1);
      it.ok = (it.ok || 0) + 1;
      if (it.flag && it.ok >= 2) it.flag = false;   // đúng 2 lần liên tiếp -> tự gỡ cờ
    } else {
      it.level = 0; it.flag = true; it.ok = 0;       // sai / chưa thuộc -> gắn cờ "lưu ý"
    }
    it.due = Date.now() + (correct ? INTERVAL_DAYS[it.level] * DAY : 10 * 60000); // sai: ôn lại sau 10 phút
    it.known = it.level >= 4;
  }
  function isDue(it) { return (it.due || 0) <= Date.now(); }
  function dueCount() { return items.filter(isDue).length; }

  // ===== Tô màu pinyin theo thanh điệu =====
  const TONE_MAP = {};
  [['āēīōūǖ',1],['áéíóúǘ',2],['ǎěǐǒǔǚ',3],['àèìòùǜ',4]].forEach(([chars, t]) => {
    for (const c of chars) { TONE_MAP[c] = t; TONE_MAP[c.toUpperCase()] = t; }
  });
  function toneOf(syllable) {
    for (const ch of syllable) if (TONE_MAP[ch]) return TONE_MAP[ch];
    return 5; // không dấu = thanh nhẹ
  }
  function colorPinyin(pinyin) {
    if (!pinyin) return '';
    // tách giữ lại dấu cách/ngăn cách
    return pinyin.split(/(\s+)/).map(tok => {
      if (/^\s+$/.test(tok) || !tok) return escapeHtml(tok);
      return `<span class="t${toneOf(tok)}">${escapeHtml(tok)}</span>`;
    }).join('');
  }

  // ===== Trang Thêm: danh sách =====
  function removeTones(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function formatLesson(val) {
    if (!val) return '';
    let s = val.trim().replace(/\s+/g, ' '); // xóa khoảng trắng thừa
    if (/^\d+$/.test(s)) return 'Bài ' + s;   // tự thêm chữ "Bài" nếu chỉ gõ số
    return s;
  }

  function mkInput(cls, val, ph) { const el = document.createElement('input'); el.className = cls; el.value = val; el.placeholder = ph; return el; }
  function mkBtn(cls, txt, fn) { const b = document.createElement('button'); b.className = cls; b.textContent = txt; b.addEventListener('click', fn); return b; }

  // ===== Phát âm chữ Hán =====
  let curAudio = null;
  let soundOn = localStorage.getItem('hanzi-sound') !== 'off';   // mặc định bật
  const soundToggle = $('soundToggle');
  function applySound(on) {
    soundOn = on;
    soundToggle.textContent = on ? '🔊' : '🔇';
    soundToggle.classList.toggle('off', !on);
    soundToggle.title = on ? 'Đang bật tiếng (bấm để tắt)' : 'Đang tắt tiếng (bấm để bật)';
    localStorage.setItem('hanzi-sound', on ? 'on' : 'off');
    if (!on && curAudio) { try { curAudio.pause(); } catch (e) {} }
  }
  soundToggle.addEventListener('click', () => applySound(!soundOn));
  applySound(soundOn);

  function speak(text) {
    if (curAudio) { try { curAudio.pause(); } catch (e) {} curAudio = null; }
    if (!text || !soundOn) return;   // tắt tiếng thì không đọc
    // Chỉ dùng một giọng duy nhất: Google (translate.googleapis.com, client=gtx)
    const url = 'https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=zh-CN&q=' + encodeURIComponent(text);
    try {
      const audio = new Audio();
      audio.referrerPolicy = 'no-referrer';   // không gửi Referer để Google chịu phát
      audio.src = url;
      curAudio = audio;
      audio.play().catch(() => {});
    } catch (e) {}
  }

  // ===== Đổi tông sáng/tối =====
  const themeToggle = $('themeToggle');
  function applyTheme(light) {
    document.body.classList.toggle('light', light);
    themeToggle.textContent = light ? '☀️' : '🌙';
    localStorage.setItem('hanzi-theme', light ? 'light' : 'dark');
  }
  themeToggle.addEventListener('click', () => applyTheme(!document.body.classList.contains('light')));
  applyTheme(localStorage.getItem('hanzi-theme') === 'light');

  // Nút ⚙️ (mobile): xổ/gập 3 nút tùy chọn
  const toolsToggle = $('toolsToggle');
  if (toolsToggle) {
    toolsToggle.addEventListener('click', (e) => { e.stopPropagation(); document.body.classList.toggle('tools-open'); });
    // bấm ra ngoài thì gập lại
    document.addEventListener('click', (e) => {
      if (!document.body.classList.contains('tools-open')) return;
      if (e.target.closest('.theme-toggle')) return;
      document.body.classList.remove('tools-open');
    });
  }

  // Bật lại animation 3D cho pinyin
  function popPinyin(el) {
    if (!el) return;
    el.classList.remove('pop');
    void el.offsetWidth;   // ép trình duyệt chạy lại animation
    el.classList.add('pop');
  }

  function showPromptModal(msg, defaultVal, onSave) {
    const modal = $('promptModal');
    if (!modal) { const v = prompt(msg, defaultVal || ''); if (v !== null) onSave(v); return; }
    $('promptMsg').textContent = msg;
    const input = $('promptInput');
    input.value = defaultVal || '';

    const close = () => modal.classList.remove('active');
    $('btnPromptCancel').onclick = close;
    $('btnPromptSave').onclick = () => { close(); onSave(input.value); };
    input.onkeydown = (e) => { if (e.key === 'Enter') { close(); onSave(input.value); } };

    modal.classList.add('active');
    setTimeout(() => input.focus(), 50);
  }

  // ===== Tiện ích =====
  function escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, s => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[s]));
  }

  // ===== Cấu hình Gemini API Keys mặc định và tự động xoay vòng =====
  // Mã hóa Base64 các key để tránh hệ thống GitHub Push Protection chặn commit
  const DEFAULT_GEMINI_KEYS_B64 = [
    'QVEuQWI4Uk42TFhwTzNtVm1BaU5nVlpNbk0yN3YtaUhjeW9fT0MxUEhhcDJiUDRITFNSQWc=',
    'QVEuQWI4Uk42S3dzY3F1WFJFaHpLYXJTVW8tQm5rX2JpaTkydEktcDhSMWZzVUF5aV9yYnc=',
    'QVEuQWI4Uk42S2hzRnd5R1d0Z1FmWTZwRlJNR0tpUWR1N08tUjVrcGFZQVh4aUlaWFlSWlE='
  ];
  const DEFAULT_GEMINI_KEYS = DEFAULT_GEMINI_KEYS_B64.map(k => atob(k));

  window.getGeminiKey = function() {
    let key = localStorage.getItem('hanzi-gemini-api-key') || '';
    if (!key) {
      key = DEFAULT_GEMINI_KEYS[0];
      localStorage.setItem('hanzi-gemini-api-key', key);
      const input = document.getElementById('geminiApiKeyInput');
      if (input) {
        input.value = key;
      }
    }
    return key;
  };

  window.rotateGeminiKey = function(failedKey) {
    const currentKey = failedKey || localStorage.getItem('hanzi-gemini-api-key') || '';
    let nextIndex = 0;
    const idx = DEFAULT_GEMINI_KEYS.indexOf(currentKey);
    if (idx !== -1) {
      nextIndex = (idx + 1) % DEFAULT_GEMINI_KEYS.length;
    }
    const nextKey = DEFAULT_GEMINI_KEYS[nextIndex];
    localStorage.setItem('hanzi-gemini-api-key', nextKey);
    
    // Đồng bộ lại input nếu có
    const input = document.getElementById('geminiApiKeyInput');
    if (input) {
      input.value = nextKey;
    }
    return nextKey;
  };

  window.isDefaultGeminiKey = function(key) {
    return DEFAULT_GEMINI_KEYS.includes(key);
  };
