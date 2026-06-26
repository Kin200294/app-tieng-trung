/* ============================================================
   Học Chữ Hán - auth.js
   ============================================================ */

  // ===== Thành viên =====
  let profile = null, memberPushTimer = null;
  function loadProfile() { try { profile = JSON.parse(localStorage.getItem('hanzi-profile')); } catch (e) { profile = null; } }
  function saveProfile() { localStorage.setItem('hanzi-profile', JSON.stringify(profile)); }

  function pushMember() {
    if (!db || !profile) return;
    db.collection('members').doc(profile.id).set({
      name: profile.name, dob: profile.dob || '',
      score: profile.score || 0, sessions: profile.sessions || 0,
      streak: profile.streak || 0, lastStudyDay: profile.lastStudyDay || '',
      known: knownCount(), total: items.length, lastSeen: Date.now()
    }, { merge: true }).catch(() => {});
  }
  // ===== Ngày & chuỗi ngày học liên tiếp =====
  function dayStr(d) { const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  function todayStr() { return dayStr(new Date()); }
  function yesterdayStr() { const d = new Date(); d.setDate(d.getDate() - 1); return dayStr(d); }
  function updateStudyBanner() {
    const el = $('studyBanner'); if (!el) return;
    const due = dueCount();
    const streak = (profile && profile.streak) || 0;
    el.innerHTML = `<span class="sb-due">🔁 ${due} chữ cần ôn hôm nay</span>` +
      (streak > 0 ? `<span class="sb-streak">🔥 Chuỗi ${streak} ngày</span>` : '');
  }
  function addPoints(n) {
    if (!profile || !n) return;
    profile.score = (profile.score || 0) + n;
    saveProfile();
    clearTimeout(memberPushTimer);
    memberPushTimer = setTimeout(pushMember, 1200);
  }
  // ===== Đồng bộ TIẾN ĐỘ cá nhân lên đám mây theo mã đăng nhập =====
  let progressPushTimer = null;
  // Bản đồ tiến độ: chỉ lưu chữ có tiến triển (đã thuộc / có cấp / đánh dấu) cho gọn
  function progressMap() {
    const m = {};
    items.forEach(it => {
      if (it.known || it.flag || (it.level && it.level > 0)) {
        m[it.h] = { k: it.known ? 1 : 0, lv: it.level || 0, due: it.due || 0, fl: it.flag ? 1 : 0 };
      }
    });
    return m;
  }
  function pushProgress() {
    if (!db || !profile) return;
    const data = { progress: progressMap(), known: knownCount(), total: items.length, lastSeen: Date.now() };
    const ref = db.collection('members').doc(profile.id);
    // update GHI ĐÈ trọn 'progress' (bỏ cờ -> khóa cũ biến mất); set merge chỉ dùng khi doc chưa tồn tại
    ref.update(data).catch(() => ref.set(data, { merge: true }).catch(() => {}));
  }
  function scheduleProgressPush() {
    if (!db || !profile) return;
    clearTimeout(progressPushTimer);
    progressPushTimer = setTimeout(pushProgress, 1500);
  }
  // Gộp tiến độ từ đám mây vào dữ liệu máy này (hợp nhất, không làm mất "đã thuộc")
  function applyCloudProgress(map) {
    if (!map) return false;
    let changed = false;
    items.forEach(it => {
      const p = map[it.h];
      if (!p) return;
      const nk = it.known || !!p.k, nf = it.flag || !!p.fl;
      const nl = Math.max(it.level || 0, p.lv || 0), nd = Math.max(it.due || 0, p.due || 0);
      if (nk !== !!it.known || nf !== !!it.flag || nl !== (it.level || 0) || nd !== (it.due || 0)) {
        it.known = nk; it.flag = nf; it.level = nl; it.due = nd; changed = true;
      }
    });
    if (changed) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      renderList(); renderGrid(); updateQuizStat();
    }
    return changed;
  }
  // Lưu kết quả từng lần làm bài (kiểm tra / ghép thẻ) vào hồ sơ + đám mây (giữ 20 lần gần nhất)
  function recordResult(kind, r) {
    if (!profile) return;
    const key = kind === 'quiz' ? 'quizResults' : 'gameResults';
    profile[key] = [r].concat(profile[key] || []).slice(0, 20);
    saveProfile();
    if (db) db.collection('members').doc(profile.id).set({ [key]: profile[key] }, { merge: true }).catch(() => {});
  }
  // Mã thành viên = họ tên (bỏ dấu, gọn) + ngày sinh -> đăng nhập lại cùng tên+ngày sinh là khớp
  function memberKey(name, dob) {
    const n = removeTones((name || '').trim().toLowerCase()).replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return n + '_' + (dob || '');
  }
  // Nạp các lựa chọn Ngày / Tháng / Năm cho ô đăng ký
  function fillDobSelects() {
    const dEl = $('regDay'), mEl = $('regMonth'), yEl = $('regYear');
    if (!dEl || dEl.options.length) return;   // đã nạp rồi thì thôi
    const opt = (v, t) => `<option value="${v}">${t}</option>`;
    let dh = opt('', 'Ngày');
    for (let i = 1; i <= 31; i++) dh += opt(i, i);
    dEl.innerHTML = dh;
    let mh = opt('', 'Tháng');
    for (let i = 1; i <= 12; i++) mh += opt(i, 'Tháng ' + i);
    mEl.innerHTML = mh;
    const nowY = new Date().getFullYear();
    let yh = opt('', 'Năm');
    for (let y = nowY; y >= 1980; y--) yh += opt(y, y);
    yEl.innerHTML = yh;
  }
  function showRegModal(cb) {
    const modal = $('regModal');
    if (!modal) {
      const name = prompt('Họ và tên:');
      const dob = prompt('Ngày sinh (yyyy-mm-dd):');
      cb((name || 'Bạn').trim(), (dob || '').trim());
      return;
    }
    fillDobSelects();
    modal.classList.add('active');
    setTimeout(() => $('regName').focus(), 50);
    $('regSubmit').onclick = () => {
      const name = $('regName').value.trim();
      const d = $('regDay').value, mo = $('regMonth').value, y = $('regYear').value;
      if (!name) { showAlert('Vui lòng nhập họ và tên.'); $('regName').focus(); return; }
      if (!d || !mo || !y) { showAlert('Vui lòng chọn đủ Ngày, Tháng, Năm sinh.'); return; }
      const pad = n => String(n).padStart(2, '0');
      const dob = y + '-' + pad(mo) + '-' + pad(d);   // luôn yyyy-mm-dd, không phụ thuộc máy
      modal.classList.remove('active');
      cb(name, dob);
    };
  }
  // Hoàn tất hồ sơ: gộp điểm/tiến độ từ đám mây theo mã (nếu có), tăng số phiên
  function finalizeProfile(p) {
    const apply = (ex) => {
      profile = {
        id: p.id,
        name: p.name || (ex && ex.name) || 'Bạn',
        dob: p.dob || (ex && ex.dob) || '',
        score: ex ? (ex.score || 0) : (p.score || 0),
        sessions: (ex ? (ex.sessions || 0) : 0) + 1,
        createdAt: (ex && ex.createdAt) || Date.now()
      };
      // Chuỗi ngày học liên tiếp
      const today = todayStr();
      const last = ex ? (ex.lastStudyDay || '') : '';
      let streak = ex ? (ex.streak || 0) : 0;
      if (last !== today) streak = (last === yesterdayStr()) ? streak + 1 : 1;
      profile.streak = streak; profile.lastStudyDay = today;
      saveProfile();
      // Khôi phục tiến độ học từ đám mây (đăng nhập lại / máy khác) rồi đẩy bản hợp nhất lên
      if (ex && ex.progress) applyCloudProgress(ex.progress);
      pushMember();
      updateStudyBanner();
    };
    if (db) db.collection('members').doc(p.id).get().then(s => apply(s.exists ? s.data() : null)).catch(() => apply(null));
    else apply(null);
  }
  // Gộp dữ liệu 2 hồ sơ (cũ + mới) — ưu tiên giữ tiến độ cao hơn, không làm mất gì
  function mergeMemberData(a, b) {
    a = a || {}; b = b || {};
    const prog = {};
    [a.progress || {}, b.progress || {}].forEach(pg => {
      Object.keys(pg).forEach(h => {
        const e = pg[h] || {}, c = prog[h] || {};
        prog[h] = { k: Math.max(c.k || 0, e.k || 0), lv: Math.max(c.lv || 0, e.lv || 0), due: Math.max(c.due || 0, e.due || 0), fl: Math.max(c.fl || 0, e.fl || 0) };
      });
    });
    return {
      name: b.name || a.name || 'Bạn', dob: b.dob || a.dob || '',
      score: Math.max(a.score || 0, b.score || 0),
      sessions: Math.max(a.sessions || 0, b.sessions || 0),
      streak: Math.max(a.streak || 0, b.streak || 0),
      lastStudyDay: (a.lastStudyDay || '') > (b.lastStudyDay || '') ? a.lastStudyDay : b.lastStudyDay,
      known: Math.max(a.known || 0, b.known || 0), total: Math.max(a.total || 0, b.total || 0),
      quizResults: (b.quizResults || []).concat(a.quizResults || []).slice(0, 20),
      gameResults: (b.gameResults || []).concat(a.gameResults || []).slice(0, 20),
      progress: prog
    };
  }
  // Chuyển dữ liệu từ ID cũ sang ID chuẩn (tên+ngày sinh) rồi xóa ID cũ -> hết trùng tài khoản
  function migrateMember(oldId, newId, done) {
    const col = db.collection('members');
    Promise.all([col.doc(oldId).get(), col.doc(newId).get()]).then(([o, n]) => {
      if (!o.exists) { done(); return; }
      const merged = mergeMemberData(o.data(), n.exists ? n.data() : null);
      col.doc(newId).set(merged, { merge: true })
        .then(() => col.doc(oldId).delete().catch(() => {}))
        .then(done).catch(done);
    }).catch(done);
  }
  function ensureProfile() {
    loadProfile();
    if (profile && profile.id) {
      const canonical = (profile.name && profile.dob) ? memberKey(profile.name, profile.dob) : profile.id;
      if (db && canonical !== profile.id) {
        // hồ sơ cũ (ID ngẫu nhiên) -> gộp sang ID tên+ngày sinh để khỏi trùng
        migrateMember(profile.id, canonical, () =>
          finalizeProfile({ id: canonical, name: profile.name, dob: profile.dob }));
      } else {
        finalizeProfile({ id: profile.id, name: profile.name, dob: profile.dob, score: profile.score });
      }
      return;
    }
    showRegModal((name, dob) => {
      finalizeProfile({ id: memberKey(name, dob), name: name, dob: dob, score: 0 });
    });
  }
  // Đặt lại tiến độ trên máy này (để nạp tiến độ của tài khoản khác cho sạch)
  function resetLocalProgress() {
    items.forEach(it => { it.known = false; it.level = 0; it.due = 0; it.flag = false; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    renderList(); renderGrid(); updateQuizStat();
  }
  function switchAccount() {
    clearTimeout(progressPushTimer); clearTimeout(memberPushTimer);
    profile = null;
    localStorage.removeItem('hanzi-profile');
    resetLocalProgress();
    ensureProfile();
  }
  if ($('profileBtn')) $('profileBtn').onclick = () => {
    const who = profile ? (profile.name + (profile.dob ? ' · ' + profile.dob : '')) : 'Chưa đăng nhập';
    showModal('Tài khoản hiện tại:\n' + who, [
      { text: 'Đóng', className: 'btn-cancel' },
      { text: '🔁 Đăng nhập / đổi tài khoản', className: 'btn-gold',
        onClick: () => showConfirm('Đổi sang tài khoản khác? Tiến độ trên máy này sẽ được thay bằng tiến độ của tài khoản bạn đăng nhập.', switchAccount) }
    ]);
  };

  // Xuất addPoints ra phạm vi toàn cục để các file script khác chạy tuần tự truy cập được
  window.addPoints = addPoints;
  if (window.HanziUI) {
    window.HanziUI.addPoints = addPoints;
  }