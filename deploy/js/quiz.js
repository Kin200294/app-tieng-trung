/* ============================================================
   Học Chữ Hán - quiz.js
   ============================================================ */

  // ===== Trang Kiểm tra =====
  let quizQueue = [];   // chỉ số items cần kiểm tra
  let quizPos = 0;
  let quizKeyState = null;
  let sessionMarks = {};   // idx -> true (thuộc) / false (chưa thuộc) trong phiên hiện tại
  const quizMode = $('quizMode'), quizFront = $('quizFront'), quizType = $('quizType');
  function shuffleArr(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const startQuizBtn = $('startQuizBtn'), quizStage = $('quizStage');
  const quizBar = $('quizBar'), quizStat = $('quizStat'), quizTimerEl = $('quizTimer');

  // Đồng hồ thời gian làm bài
  let quizTimerId = null, quizStartMs = 0;
  function fmtMMSS(sec) {
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m + ':' + String(s).padStart(2, '0');
  }
  function quizSecs() { return (Date.now() - quizStartMs) / 1000; }
  function tickQuizTimer() { quizTimerEl.textContent = '⏱ ' + fmtMMSS(quizSecs()); }
  function startQuizTimer() {
    quizStartMs = Date.now();
    if (quizTimerId) clearInterval(quizTimerId);
    quizTimerId = setInterval(tickQuizTimer, 500);
    tickQuizTimer();
  }
  function stopQuizTimer() { if (quizTimerId) { clearInterval(quizTimerId); quizTimerId = null; } }
  function resetQuizTimer() { quizStartMs = 0; if (quizTimerEl) quizTimerEl.textContent = '⏱ 00:00'; }

  // Dừng & đưa phần kiểm tra về mặc định (để bắt đầu lại từ đầu)
  function resetQuiz() {
    quizQueue = []; quizPos = 0;
    stopQuizTimer(); resetQuizTimer();
    setQuizRunning(false);
  }

  function knownCount() { return items.filter(x => x.known).length; }
  function updateQuizStat() {
    if (!quizStat) return;
    quizStat.textContent = `Đã thuộc ${knownCount()} / ${items.length} chữ · Đến hạn ôn: ${dueCount()}`;
  }

  startQuizBtn.addEventListener('click', startQuiz);

  // Đổi nút khi đang làm bài: ẩn "Bắt đầu", hiện "Dừng lại" + "Làm lại"
  function setQuizRunning(on) {
    if (startQuizBtn) startQuizBtn.style.display = on ? 'none' : '';
    const r = $('quizRunBtns'); if (r) r.style.display = on ? 'flex' : 'none';
  }
  if ($('stopQuizBtn')) $('stopQuizBtn').onclick = () => {
    showConfirm('Bạn có muốn DỪNG bài kiểm tra không?', () => {
      resetQuiz();
      renderQuiz();
    });
  };
  if ($('restartQuizBtn')) $('restartQuizBtn').onclick = () => {
    showConfirm('Làm lại bài kiểm tra từ đầu?', () => startQuiz());
  };

  const SESSION_SIZE = 10;   // số chữ mỗi phiên
  let quizDeck = [];         // bộ bài đã trộn của TẤT CẢ chữ (đi hết mới trộn lại)
  let quizDeckMode = null;
  let quizDeckCount = 0;
  let quizDeckLesson = null;

  function buildDeck() {
    let pool = items.map((_, i) => i);
    const qLesson = $('quizLessonFilter');
    if (qLesson && qLesson.value !== 'all') {
      pool = pool.filter(i => items[i].l === qLesson.value);
    }
    // User definition: "chưa thuộc" means words they got wrong (level === 0 and has been tested)
    if (quizMode.value === 'unknown') pool = pool.filter(i => items[i].level === 0 && items[i].due > 0);
    quizDeck = shuffleArr(pool);
    quizDeckMode = quizMode.value;
    quizDeckCount = items.length;
    quizDeckLesson = qLesson ? qLesson.value : 'all';
  }

  function startQuiz() {
    const qLesson = $('quizLessonFilter');
    const curLesson = qLesson ? qLesson.value : 'all';
    
    let poolCheck = items.map((_, i) => i);
    if (curLesson !== 'all') poolCheck = poolCheck.filter(i => items[i].l === curLesson);
    
    if (poolCheck.length === 0) {
      stopQuizTimer(); setQuizRunning(false);
      quizStage.innerHTML = '<div class="quiz-done"><p>Không có chữ nào trong phần này!</p></div>';
      quizBar.style.width = '0%'; quizKeyState = null;
      return;
    }
    if (quizMode.value === 'unknown') {
      const hasUnknown = poolCheck.some(i => items[i].level === 0 && items[i].due > 0);
      if (!hasUnknown) {
        stopQuizTimer(); setQuizRunning(false);
        quizStage.innerHTML = '<div class="quiz-done"><p>Tuyệt vời! Hiện tại bạn không có chữ nào bị sai (chưa thuộc) trong phần này 🎉</p></div>';
        quizBar.style.width = '0%'; quizKeyState = null;
        return;
      }
    }
    // Trộn lại bộ bài nếu: đổi chế độ, đổi danh sách, đổi buổi học, hoặc đã đi hết tất cả chữ
    if (quizDeckMode !== quizMode.value || quizDeckCount !== items.length || quizDeckLesson !== curLesson || quizDeck.length === 0) buildDeck();
    // Lấy ~10 chữ tiếp theo chưa gặp (không lặp trong & giữa các phiên)
    quizQueue = quizDeck.splice(0, SESSION_SIZE);
    quizPos = 0;
    sessionMarks = {};   // bắt đầu phiên mới -> reset kết quả
    startQuizTimer();
    setQuizRunning(true);   // hiện nút Dừng lại / Làm lại
    renderQuiz();
  }
  function sessionCounts() {
    let k = 0, u = 0;
    for (const idx in sessionMarks) { if (sessionMarks[idx]) k++; else u++; }
    return { k: k, u: u };
  }

  function renderQuiz() {
    updateQuizStat();
    if (items.length === 0) {
      stopQuizTimer(); setQuizRunning(false);
      quizStage.innerHTML = '<p class="empty-msg">Chưa có chữ nào — sang trang “Thêm chữ” để nhập 👆</p>';
      quizBar.style.width = '0%'; quizKeyState = null; return;
    }
    if (quizQueue.length === 0) {
      stopQuizTimer(); setQuizRunning(false);
      let extra = '';
      if (quizMode.value === 'due') extra = ' (Hiện không có chữ nào đến hạn ôn — quay lại sau nhé 🎉)';
      else if (quizMode.value === 'unknown') extra = ' (Hiện không còn chữ nào chưa thuộc 🎉)';
      quizStage.innerHTML = '<div class="quiz-done"><p>Nhấn “Bắt đầu / Làm lại” để luyện tập.' + extra + '</p></div>';
      quizBar.style.width = '0%'; quizKeyState = null; return;
    }
    if (quizPos >= quizQueue.length) {
      stopQuizTimer(); setQuizRunning(false);
      const timeStr = fmtMMSS(quizSecs());
      const sc = sessionCounts();
      const total = sc.k + sc.u;
      const unknownIdx = Object.keys(sessionMarks).filter(i => !sessionMarks[i]).map(Number);
      const pct = total ? Math.round(sc.k / total * 100) : 0;
      const isMC = quizType.value === 'mc';
      const okLabel = isMC ? 'Đúng' : 'Thuộc';
      const noLabel = isMC ? 'Sai' : 'Chưa thuộc';

      let reviewHtml = '';
      if (unknownIdx.length) {
        reviewHtml = `
          <div class="review-title">Cần ôn lại (${unknownIdx.length})</div>
          <div class="review-list">
            ${unknownIdx.map(i => {
              const it = items[i];
              return `<div class="review-item">
                <span class="ri-hanzi">${escapeHtml(it.h)}</span>
                <span class="ri-info">
                  <span class="ri-pinyin">${colorPinyin(it.p) || '—'}</span>
                  <span class="ri-meaning">${escapeHtml(it.m) || ''}</span>
                </span>
              </div>`;
            }).join('')}
          </div>`;
      } else {
        reviewHtml = `<p class="all-good">Tuyệt vời! Phiên này bạn thuộc hết 🎉</p>`;
      }

      quizStage.innerHTML = `<div class="quiz-done">
        <p class="done-title">Hoàn thành! 🎉</p>
        <div class="done-ring" style="--pct:${pct}">
          <div class="done-ring-in"><b>${pct}%</b><span>${isMC ? 'đúng' : 'thuộc'}</span></div>
        </div>
        <div class="done-score">Điểm: <b>${sc.k}/${total}</b> · Thời gian: <b>${timeStr}</b></div>
        <div class="result-chips">
          <span class="chip chip-known">✓ ${okLabel}: ${sc.k}</span>
          <span class="chip chip-unknown">✗ ${noLabel}: ${sc.u}</span>
        </div>
        ${reviewHtml}
        <div class="quiz-btns" style="margin-top:18px;">
          ${unknownIdx.length ? '<button class="btn-unknown" id="reviewUnknownBtn">↻ Ôn lại chữ chưa thuộc</button>' : ''}
          <button class="btn-gold" id="restartBtn">Làm lại</button>
        </div>
      </div>`;
      quizBar.style.width = '100%'; quizKeyState = null;
      recordResult('quiz', { pct: pct, k: sc.k, total: total, time: timeStr, mc: isMC, d: gameDateStamp() });
      $('restartBtn').addEventListener('click', startQuiz);
      if ($('reviewUnknownBtn')) $('reviewUnknownBtn').addEventListener('click', () => {
        // ôn lại chỉ những chữ chưa thuộc của phiên này
        const pool = unknownIdx.slice();
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        quizQueue = pool; quizPos = 0; sessionMarks = {};
        renderQuiz();
      });
      return;
    }

    quizBar.style.width = (quizPos / quizQueue.length * 100) + '%';
    if (quizType.value === 'mc') { renderMC(); return; }   // chế độ trắc nghiệm
    const it = items[quizQueue[quizPos]];
    const askHanzi = quizFront.value === 'hanzi';

    const wrap = document.createElement('div');
    wrap.className = 'quiz-stage';
    const sc = sessionCounts();
    wrap.innerHTML = `
      <p class="hint" style="margin:0 0 8px;">Câu ${quizPos + 1} / ${quizQueue.length}</p>
      <div class="quiz-tally">
        <span class="tally-known">✓ Thuộc ${sc.k}</span>
        <span class="tally-unknown">✗ Chưa thuộc ${sc.u}</span>
      </div>
      <div class="qcard" id="qcard">
        <div class="qcard-inner">
          <div class="qface qfront">
            ${askHanzi
              ? `<div class="big-hanzi">${escapeHtml(it.h)}</div>`
              : `<div class="big-meaning">${escapeHtml(it.m || '(chưa có nghĩa)')}</div>`}
          </div>
          <div class="qface qback">
            <button class="spk-btn" id="qSpk" type="button" title="Nghe phát âm">🔊</button>
            ${askHanzi
              ? (it.p ? `<div class="q-pinyin">${colorPinyin(it.p)}</div>` : '') +
                `<div class="q-meaning">${escapeHtml(it.m || '(chưa có nghĩa)')}</div>`
              : `<div class="big-hanzi">${escapeHtml(it.h)}</div>` +
                (it.p ? `<div class="q-pinyin">${colorPinyin(it.p)}</div>` : '')}
          </div>
        </div>
      </div>
      <div class="quiz-btns" id="quizBtns">
        <button class="btn-gold" id="revealBtn">👁 Hiện đáp án</button>
      </div>`;
    quizStage.innerHTML = '';
    quizStage.appendChild(wrap);

    const qcard = $('qcard');
    const btns = $('quizBtns');
    qcard.addEventListener('click', reveal);
    $('revealBtn').addEventListener('click', reveal);
    if ($('qSpk')) $('qSpk').addEventListener('click', (e) => { e.stopPropagation(); speak(it.h); });
    let revealed = false;
    function reveal() {
      if (revealed) return;
      revealed = true;
      qcard.classList.add('flipped');
      speak(it.h);   // đọc chữ Hán khi hiện đáp án
      popPinyin(qcard.querySelector('.q-pinyin'));
      btns.innerHTML = '';
      btns.appendChild(mkBtn('btn-unknown', '✗ Chưa thuộc (1)', () => mark(false)));
      btns.appendChild(mkBtn('btn-known', '✓ Thuộc (2)', () => mark(true)));
    }
    function mark(known) {
      const idx = quizQueue[quizPos];
      scheduleItem(items[idx], known);
      sessionMarks[idx] = known;   // ghi lại kết quả phiên
      if (known) addPoints(1);     // thuộc -> +1 điểm
      save();
      quizPos++;
      renderQuiz();
    }
    // trạng thái cho phím tắt
    quizKeyState = {
      mode: 'card',
      reveal: reveal,
      markKnown: () => { if (revealed) mark(true); },
      markUnknown: () => { if (revealed) mark(false); },
      back: null
    };
  }

  // ===== Chế độ trắc nghiệm A/B/C/D =====
  function renderMC() {
    const idx = quizQueue[quizPos];
    const it = items[idx];
    const askHanzi = quizFront.value === 'hanzi';
    // Hỏi bằng chữ Hán -> đáp án là PINYIN; hỏi bằng nghĩa -> đáp án là chữ Hán
    const answerOf = (x) => (askHanzi ? (x.p || '') : (x.h || ''));
    const promptText = askHanzi ? it.h : (it.m || '(chưa có nghĩa)');
    const correctAns = answerOf(it) || '(trống)';
    const optIsPinyin = askHanzi;   // đáp án là pinyin -> tô màu thanh điệu

    // gom đáp án nhiễu (khác đáp án đúng, không trùng nhau)
    // Ưu tiên chữ có CÙNG số ký tự với câu hỏi (1 chữ -> nhiễu 1 chữ...); thiếu mới lấy chữ khác
    const charLen = (s) => Array.from(s || '').length;
    const wantLen = charLen(it.h);
    const seen = new Set([correctAns]);
    const distractors = [];
    const all = shuffleArr(items.map((_, i) => i).filter((i) => i !== idx));
    const sameLen = all.filter((i) => charLen(items[i].h) === wantLen);
    const otherLen = all.filter((i) => charLen(items[i].h) !== wantLen);
    for (const i of sameLen.concat(otherLen)) {
      const a = answerOf(items[i]);
      if (a && !seen.has(a)) { seen.add(a); distractors.push(a); }
      if (distractors.length >= 3) break;
    }
    const options = shuffleArr([correctAns, ...distractors]);

    const sc = sessionCounts();
    const wrap = document.createElement('div');
    wrap.className = 'quiz-stage';
    wrap.innerHTML = `
      <p class="hint" style="margin:0 0 8px;">Câu ${quizPos + 1} / ${quizQueue.length}</p>
      <div class="quiz-tally">
        <span class="tally-known">✓ Đúng ${sc.k}</span>
        <span class="tally-unknown">✗ Sai ${sc.u}</span>
      </div>
      <div class="mc-prompt ${askHanzi ? 'mc-hanzi' : ''}">${escapeHtml(promptText)}${askHanzi ? '<button class="mc-spk" id="mcSpk" title="Nghe lại" style="display:none;">🔊</button>' : ''}</div>
      <div class="mc-options" id="mcOpts">
        ${options.map((a, i) => `<button class="mc-opt" data-ok="${a === correctAns ? 1 : 0}"><b>${'ABCD'[i]}</b><span>${optIsPinyin ? colorPinyin(a) : escapeHtml(a)}</span></button>`).join('')}
      </div>
      <div class="mc-feedback" id="mcFb"></div>
      <div class="quiz-btns" id="mcNext" style="margin-top:14px;"></div>`;
    quizStage.innerHTML = '';
    quizStage.appendChild(wrap);

    const optBtns = Array.from(wrap.querySelectorAll('.mc-opt'));

    // Hỏi bằng chữ Hán -> nút nghe (đọc sau khi chọn, không đọc ngay)
    if (askHanzi) {
      const spk = $('mcSpk');
      if (spk) spk.addEventListener('click', (e) => { e.stopPropagation(); speak(it.h); });
    }

    let answered = false;
    function choose(i) {
      if (answered || !optBtns[i]) return;
      answered = true;
      const btn = optBtns[i];
      const correct = btn.dataset.ok === '1';
      optBtns.forEach((b) => {
        b.disabled = true;
        if (b.dataset.ok === '1') b.classList.add('correct');
      });
      if (!correct) btn.classList.add('wrong');

      const fb = $('mcFb');
      fb.textContent = correct ? '✓ Chính xác!' : ('✗ Sai rồi — đáp án đúng: ' + correctAns);
      fb.className = 'mc-feedback ' + (correct ? 'ok' : 'no');

      scheduleItem(it, correct);
      sessionMarks[idx] = correct;
      if (correct) addPoints(1);   // trả lời đúng -> +1 điểm
      save();
      const spk = $('mcSpk'); if (spk) spk.style.display = '';   // hiện nút loa sau khi chọn
      speak(it.h);   // đọc chữ Hán sau khi chọn

      const nextBtn = mkBtn('btn-gold', (quizPos + 1 < quizQueue.length ? 'Câu tiếp →' : 'Xem kết quả →'), next);
      $('mcNext').appendChild(nextBtn);
    }
    function next() { quizPos++; renderQuiz(); }

    optBtns.forEach((b, i) => b.addEventListener('click', () => choose(i)));

    quizKeyState = {
      mode: 'mc',
      choose: choose,
      next: () => { if (answered) next(); },
      back: null
    };
  }

  // ===== Phím tắt khi ở trang Kiểm tra =====
  document.addEventListener('keydown', (e) => {
    if (!$('page-quiz').classList.contains('active') || !quizKeyState) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    if (quizKeyState.mode === 'mc') {
      // Trắc nghiệm: 1–4 chọn đáp án, Space/Enter sang câu tiếp, Backspace quay lại
      if (['1', '2', '3', '4'].includes(e.key)) { e.preventDefault(); quizKeyState.choose(Number(e.key) - 1); }
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); quizKeyState.next(); }
      else if (e.key === 'Backspace') { e.preventDefault(); if (quizKeyState.back) quizKeyState.back(); }
      return;
    }
    // Lật thẻ: Space hiện đáp án, 1/2 chưa/đã thuộc, Backspace quay lại
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); quizKeyState.reveal(); }
    else if (e.key === '2') { quizKeyState.markKnown(); }
    else if (e.key === '1') { quizKeyState.markUnknown(); }
    else if (e.key === 'Backspace') { e.preventDefault(); if (quizKeyState.back) quizKeyState.back(); }
  });
