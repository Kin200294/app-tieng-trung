/* ============================================================
   Học Chữ Hán - app_init.js
   ============================================================ */

  // ===== Chuyển trang =====
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      if (tab.dataset.page === 'add') renderList();

      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      $('page-' + tab.dataset.page).classList.add('active');
      if (tab.dataset.page === 'learn') {
        flagOnly = false;   // vào trang Học -> xem tất cả (bỏ lọc lưu ý)
        if (flagFilterBtn) flagFilterBtn.classList.remove('active');
        renderGrid();
      }
      if (tab.dataset.page !== 'quiz') { resetQuiz(); }
      if (tab.dataset.page === 'quiz') { resetQuiz(); updateQuizStat(); renderQuiz(); }
      if (tab.dataset.page === 'lessons') renderLessonsPage();
      if (tab.dataset.page === 'members') renderMembersPage();
      if (tab.dataset.page === 'classDiff') renderClassDiffPage();
      if (tab.dataset.page === 'leaderboard') renderLeaderboardPage();
      if (tab.dataset.page === 'passage') renderPassageExercise();
      if (tab.dataset.page === 'passageEdit') renderPassageEdit();
      if (tab.dataset.page === 'game') {
        resetGame(); gameStartScreen();   // vào trò chơi -> luôn bắt đầu từ màn hình chờ
      } else if (gameActive) {
        resetGame(); gameStartScreen();   // rời trò chơi -> thoát game
      }
    });
  });
  // Ẩn cửa sổ/đổi tab trình duyệt -> thoát game
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && gameActive) { resetGame(); gameStartScreen(); }
  });

  // ===== Service Worker: cài như app, chạy offline, tự cập nhật bản mới =====
  if ('serviceWorker' in navigator) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      location.reload();   // có bản mới -> tự tải lại
    });
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then((reg) => reg.update()).catch(() => {});
    });
  }

  // Khởi tạo
  load();
  // Trên điện thoại (màn hình hẹp): chỉ cho chọn 1/2/3 cột, mặc định 3
  if (window.matchMedia('(max-width: 600px)').matches) {
    colSelect.innerHTML = '<option value="1">1</option><option value="2">2</option><option value="3" selected>3</option>';
    columns = 3;
    colSelect.value = '3';
  }
  renderList();
  renderGrid();   // hiện sẵn lưới Học (trang mặc định)
  renderQuiz();
  gameStartScreen();
  // Chờ đăng nhập ẩn danh xong rồi mới đồng bộ/ghi (để Security Rules cho phép);
  // nếu không có Auth (offline) thì chạy luôn như cũ.
  function startSync() {
    subscribeShared();   // nhận từ vựng CHUNG của cả lớp
    ensureProfile();     // đăng ký/đếm phiên thành viên
  }
  if (db && firebase.auth) {
    let started = false;
    const go = () => { if (!started) { started = true; startSync(); } };
    firebase.auth().onAuthStateChanged(u => { if (u) go(); });
    setTimeout(go, 2500);   // dự phòng nếu auth chậm/lỗi
  } else {
    startSync();
  }
  // Áp dụng chế độ Học sinh / Giáo viên đã lưu
  applyRole(localStorage.getItem('hanzi-role') || 'student');