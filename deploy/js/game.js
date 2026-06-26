/* ============================================================
   Học Chữ Hán - game.js
   ============================================================ */

  // ===== Trò chơi Ghép thẻ =====
  const gameCount = $('gameCount'), startGameBtn = $('startGameBtn'),
        gameTimer = $('gameTimer'), gameStage = $('gameStage');
  const GAME_KEY = 'hanzi-game-scores';
  let gameTimerId = null, gameBaseElapsed = 0, gameRunStart = 0, gamePenalty = 0,
      gameSelected = null, gameMatched = 0, gamePairs = 0, gameActive = false, gamePaused = false;

  // Đổi nút khi đang chơi: ẩn "Bắt đầu", hiện "Tạm dừng" + "Làm lại"
  function setGameRunning(on) {
    if (startGameBtn) startGameBtn.style.display = on ? 'none' : '';
    const r = $('gameRunBtns'); if (r) r.style.display = on ? 'flex' : 'none';
  }

  function gameElapsed() {
    return gameBaseElapsed + (gameRunStart ? (Date.now() - gameRunStart) / 1000 : 0) + gamePenalty;
  }
  function fmtTime(s) {
    const m = Math.floor(s / 60), sec = s - m * 60;
    return (m > 0 ? m + 'p ' : '') + sec.toFixed(1) + 's';
  }
  function updateGameTimer() { gameTimer.textContent = fmtTime(gameElapsed()); }
  function startTimerTick() { if (gameTimerId) clearInterval(gameTimerId); gameTimerId = setInterval(updateGameTimer, 100); }
  // Rời tab/ẩn trang -> THOÁT game (reset hẳn), phải bấm Bắt đầu để chơi lại
  function resetGame() {
    if (gameTimerId) { clearInterval(gameTimerId); gameTimerId = null; }
    gameActive = false; gamePaused = false; gameRunStart = 0; gameBaseElapsed = 0; gamePenalty = 0;
    gameSelected = null; gameMatched = 0;
    gameTimer.textContent = '0.0s';
    setGameRunning(false);
  }

  function gameStartScreen() {
    if (gameActive) return;
    const usable = items.filter(it => it.h && (it.p || it.m));
    gameStage.innerHTML = usable.length < 3
      ? '<p class="empty-msg">Cần ít nhất 3 chữ (có pinyin/nghĩa) để chơi — thêm chữ trước nhé 👆</p>'
      : '<p class="empty-msg">Bấm “Bắt đầu / Chơi lại” để chơi ghép thẻ 🎮</p>';
    gameTimer.textContent = '0.0s';
  }

  startGameBtn.addEventListener('click', startGame);

  function pauseGame() {
    if (!gameActive || gamePaused) return;
    gamePaused = true;
    gameBaseElapsed += (gameRunStart ? (Date.now() - gameRunStart) / 1000 : 0);
    gameRunStart = 0;
    if (gameTimerId) { clearInterval(gameTimerId); gameTimerId = null; }
    updateGameTimer();
    const pb = $('pauseGameBtn'); if (pb) pb.textContent = '▶ Tiếp tục';
    if (gameStage.firstChild) gameStage.firstChild.classList.add('paused');
  }
  function resumeGame() {
    if (!gameActive || !gamePaused) return;
    gamePaused = false;
    gameRunStart = Date.now();
    startTimerTick();
    const pb = $('pauseGameBtn'); if (pb) pb.textContent = '⏸ Tạm dừng';
    if (gameStage.firstChild) gameStage.firstChild.classList.remove('paused');
  }
  if ($('pauseGameBtn')) $('pauseGameBtn').onclick = () => { gamePaused ? resumeGame() : pauseGame(); };
  if ($('restartGameBtn')) $('restartGameBtn').onclick = () => {
    showConfirm('Làm lại từ đầu?', () => startGame());
  };
  if ($('endGameBtn')) $('endGameBtn').onclick = () => {
    showConfirm('Bạn chưa chơi xong, bạn có muốn kết thúc không?', () => {
      resetGame(); gameStartScreen();
    });
  };

  function startGame() {
    let usable = items.map((_, i) => i).filter(i => items[i].h && (items[i].p || items[i].m));
    const gLesson = $('gameLessonFilter');
    if (gLesson && gLesson.value !== 'all') {
      usable = usable.filter(i => items[i].l === gLesson.value);
    }
    if (usable.length < 3) { showAlert('Cần ít nhất 3 chữ có pinyin/nghĩa trong phần này để chơi.'); return; }
    const want = Math.min(parseInt($('gameCount').value, 10), usable.length);
    shuffleArr(usable);
    const chosen = usable.slice(0, want);
    gamePairs = chosen.length;

    let cards = [];
    chosen.forEach(idx => { cards.push({ idx, side: 'han' }); cards.push({ idx, side: 'def' }); });
    shuffleArr(cards);

    gameMatched = 0; gamePenalty = 0; gameSelected = null; gameActive = true; gamePaused = false;
    gameBaseElapsed = 0; gameRunStart = Date.now();
    startTimerTick();
    setGameRunning(true);
    const pb = $('pauseGameBtn'); if (pb) pb.textContent = '⏸ Tạm dừng';

    const board = document.createElement('div');
    board.className = 'game-board';
    cards.forEach(c => {
      const it = items[c.idx];
      const el = document.createElement('div');
      el.className = 'game-card';
      el.dataset.idx = c.idx;
      el.dataset.side = c.side;
      if (c.side === 'han') {
        el.innerHTML = `<div class="gc-han">${escapeHtml(it.h)}</div>`;
      } else {
        el.innerHTML = (it.p ? `<div class="gc-pinyin">${colorPinyin(it.p)}</div>` : '') +
                       (it.m ? `<div class="gc-meaning">${escapeHtml(it.m)}</div>` : '');
      }
      el.addEventListener('click', () => gameClick(el));
      board.appendChild(el);
    });
    gameStage.innerHTML = '';
    gameStage.appendChild(board);
    updateGameTimer();
  }

  function gameClick(el) {
    if (!gameActive || gamePaused || el.classList.contains('matched')) return;
    if (gameSelected === el) { el.classList.remove('selected'); gameSelected = null; return; }
    if (!gameSelected) { el.classList.add('selected'); gameSelected = el; return; }

    const a = gameSelected, b = el;
    const isMatch = (a.dataset.idx === b.dataset.idx) && (a.dataset.side !== b.dataset.side);
    if (isMatch) {
      a.classList.remove('selected');
      a.classList.add('matched'); b.classList.add('matched');
      gameSelected = null;
      gameMatched++;
      if (gameMatched >= gamePairs) finishGame();
    } else {
      gamePenalty += 3;   // sai: +3 giây
      a.classList.add('wrong'); b.classList.add('wrong');
      a.classList.remove('selected');
      setTimeout(() => { a.classList.remove('wrong'); b.classList.remove('wrong'); }, 450);
      gameSelected = null;
      flashTimer();   // đồng hồ nháy đỏ + phóng to
    }
  }
  function flashTimer() {
    gameTimer.classList.remove('penalty');
    void gameTimer.offsetWidth;   // ép chạy lại animation
    gameTimer.classList.add('penalty');
  }

  function gameDateStamp() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}`;
  }

  function finishGame() {
    gameActive = false; gamePaused = false;
    setGameRunning(false);
    if (gameTimerId) { clearInterval(gameTimerId); gameTimerId = null; }
    const finalT = gameElapsed();
    updateGameTimer();

    let scores = [];
    try { const d = JSON.parse(localStorage.getItem(GAME_KEY)); if (Array.isArray(d)) scores = d; } catch (e) {}
    const curT = Math.round(finalT * 10) / 10;
    // Kỷ lục cũ của CHÍNH mình cho đúng số cặp này (trước khi thêm lần chơi hiện tại)
    const prevTimes = scores.filter(s => s.pairs === gamePairs).map(s => s.t);
    const prevBest = prevTimes.length ? Math.min(...prevTimes) : null;
    const isRecord = prevBest === null || curT < prevBest;

    const entry = { t: curT, pairs: gamePairs, d: gameDateStamp() };
    scores.push(entry);
    scores.sort((x, y) => x.t - y.t);
    scores = scores.slice(0, 50);
    localStorage.setItem(GAME_KEY, JSON.stringify(scores));

    const recordText = isRecord
      ? `🏆 Chúc mừng! Bạn vừa lập <b>kỷ lục mới</b> với ${gamePairs} cặp!`
      : `💪 Cố gắng lên! Kỷ lục của bạn là <b>${fmtTime(prevBest)}</b> cho ${gamePairs} cặp.`;
    gameStage.innerHTML = `
      <div class="panel game-done">
        <div class="gd-title">🎉 Chúc mừng! Bạn đã hoàn thành</div>
        <div class="gd-time">⏱ <b>${fmtTime(finalT)}</b></div>
        <div class="gd-rank ${isRecord ? 'gd-record' : ''}">${recordText}</div>
        <div class="quiz-btns"><button class="btn-gold" id="playAgainBtn">▶ Chơi lại</button></div>
        <div class="lb-title">🌐 Bảng xếp hạng chung — ${gamePairs} cặp</div>
        <div class="leaderboard" id="onlineLb"><p class="io-note">Đang tải…</p></div>
      </div>`;
    $('playAgainBtn').addEventListener('click', startGame);
    submitAndLoadLeaderboard(finalT, gamePairs);   // gửi & tải bảng xếp hạng chung
    addPoints(gamePairs);   // hoàn thành trò chơi -> +điểm theo số cặp
    recordResult('game', { t: Math.round(finalT * 10) / 10, pairs: gamePairs, d: gameDateStamp() });
  }
