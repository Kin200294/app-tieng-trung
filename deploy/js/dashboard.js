/* ============================================================
   Học Chữ Hán - dashboard.js
   ============================================================ */

  // =====================
  // BẢNG VÀNG - LEADERBOARD
  // =====================
  function renderLeaderboardPage() {
    const stage = $('leaderboardStage');
    if (!stage) return;
    stage.innerHTML = '<div style="text-align:center; padding:20px;">Đang tải dữ liệu... ⏳</div>';
    
    if (typeof db === 'undefined' || !db) {
      stage.innerHTML = '<div style="text-align:center; color:red;">Lỗi kết nối cơ sở dữ liệu.</div>';
      return;
    }

    db.collection('members').orderBy('score', 'desc').limit(10).get().then(snap => {
      if (snap.empty) {
        stage.innerHTML = '<div style="text-align:center; color:var(--muted);">Chưa có dữ liệu bảng vàng.</div>';
        return;
      }
      
      const members = [];
      snap.forEach(doc => members.push(doc.data()));
      
      // Top 3 Podium
      let podiumHtml = '<div class="lb-podium">';
      // Order in podium: 2nd, 1st, 3rd for visual balance
      const top3Order = [1, 0, 2];
      top3Order.forEach(idx => {
        if (members[idx]) {
          const m = members[idx];
          const rank = idx + 1;
          const avatar = rank === 1 ? '👑' : (rank === 2 ? '🥈' : '🥉');
          podiumHtml += `
            <div class="lb-podium-item rank-${rank}">
              ${rank === 1 ? '<div class="lb-crown">👑</div>' : ''}
              <div class="lb-avatar">${avatar}</div>
              <div class="lb-name">${escapeHtml(m.name)}</div>
              <div class="lb-score">${m.score || 0} đ</div>
            </div>
          `;
        } else {
          // Empty spot to keep layout stable
          podiumHtml += `<div class="lb-podium-item" style="background:transparent; border:none; box-shadow:none;"></div>`;
        }
      });
      podiumHtml += '</div>';

      // Top 4-10 List
      let listHtml = '<div class="lb-list">';
      for (let i = 3; i < members.length; i++) {
        const m = members[i];
        listHtml += `
          <div class="lb-row">
            <div class="lb-row-rank">#${i + 1}</div>
            <div class="lb-row-name">${escapeHtml(m.name)}</div>
            <div class="lb-row-score">${m.score || 0} đ</div>
          </div>
        `;
      }
      listHtml += '</div>';

      stage.innerHTML = podiumHtml + listHtml;
    }).catch(err => {
      console.log('Lỗi tải Bảng vàng:', err);
      stage.innerHTML = '<div style="text-align:center; color:red;">Lỗi khi tải bảng vàng.</div>';
    });
  }

  // ===== Bảng xếp hạng online =====
  function submitAndLoadLeaderboard(t, pairs) {
    const el = $('onlineLb');
    if (!db) { if (el) el.innerHTML = '<p class="io-note">Cần có mạng để xem bảng xếp hạng chung.</p>'; return; }
    const doSubmit = (name) => {
      db.collection('leaderboard').add({ name: name, t: Math.round(t * 10) / 10, pairs: pairs, createdAt: Date.now() })
        .then(() => loadLeaderboard(pairs)).catch(() => loadLeaderboard(pairs));
    };
    let name = (profile && profile.name) || localStorage.getItem('hanzi-player-name');
    if (!name) {
      showPromptModal('Nhập tên của bạn (hiện trên bảng xếp hạng):', '', (v) => {
        name = (v || '').trim() || 'Ẩn danh';
        localStorage.setItem('hanzi-player-name', name);
        doSubmit(name);
      });
    } else doSubmit(name);
  }
  function loadLeaderboard(pairs) {
    const el = $('onlineLb');
    if (!db || !el) return;
    el.innerHTML = '<p class="io-note">Đang tải…</p>';
    // Lấy nhiều rồi lọc theo số cặp ở client (khỏi cần composite index)
    db.collection('leaderboard').orderBy('t').limit(300).get().then(snap => {
      const all = []; snap.forEach(d => all.push(d.data()));
      const same = all.filter(s => Number(s.pairs) === Number(pairs));
      if (!same.length) { el.innerHTML = '<p class="io-note">Chưa có ai trên bảng xếp hạng ' + pairs + ' cặp.</p>'; return; }
      // Mỗi người chỉ giữ kết quả tốt nhất (đã sắp theo t tăng dần nên lần đầu gặp là nhanh nhất)
      const seen = new Set(), rows = [];
      same.forEach(s => {
        const key = (s.name || '?').trim().toLowerCase();
        if (seen.has(key)) return;
        seen.add(key); rows.push(s);
      });
      el.innerHTML = rows.slice(0, 10).map((s, i) => `<div class="lb-row">
        <span class="lb-pos">${i + 1}</span>
        <span>${escapeHtml(s.name || '?')}</span>
        <span class="lb-date">${s.pairs} cặp</span>
        <span class="lb-time">${fmtTime(s.t)}</span>
      </div>`).join('');
    }).catch(e => { el.innerHTML = '<p class="io-note">Lỗi tải bảng xếp hạng: ' + escapeHtml(e.message) + '</p>'; });
  }

  function onlineLevel(s) {
    return s >= 20 ? 'Rất tích cực 🔥' : s >= 8 ? 'Khá thường xuyên' : s >= 3 ? 'Thỉnh thoảng' : 'Mới tham gia';
  }
  function memberDetailHtml(m) {
    const quiz = Array.isArray(m.quizResults) ? m.quizResults : [];
    const game = Array.isArray(m.gameResults) ? m.gameResults : [];
    
    // Tính toán thống kê tiến trình SRS
    const pg = m.progress || {};
    const total = typeof items !== 'undefined' ? items.length : 0;
    const levelCounts = Array(9).fill(0); // 0 đến 8
    let memorized = 0;
    let inProgress = 0;
    let notStarted = 0;
    let dueToday = 0;
    let dueTomorrow = 0;
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    if (total > 0) {
      items.forEach(it => {
        const p = pg[it.h];
        if (p) {
          const lv = p.lv || 0;
          const due = p.due || 0;
          const isKnown = p.k === 1 || lv >= 4;
          
          levelCounts[lv]++;
          
          if (isKnown) {
            memorized++;
          } else if (lv > 0 || due > 0) {
            inProgress++;
          } else {
            notStarted++;
          }
          
          if (due > 0) {
            if (due <= now) {
              dueToday++;
            } else if (due <= now + oneDay) {
              dueTomorrow++;
            }
          }
        } else {
          levelCounts[0]++;
          notStarted++;
        }
      });
    }

    // Giao diện thống kê SRS & dự báo ngày ôn tập
    const intervals = ["", "1 ngày", "2 ngày", "4 ngày", "8 ngày", "16 ngày", "30 ngày", "60 ngày", "120 ngày"];
    let srsBarsHtml = "";
    for (let lv = 1; lv <= 8; lv++) {
      const count = levelCounts[lv];
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      srsBarsHtml += `
        <div class="srs-bar-row">
          <span class="srs-bar-label">Cấp ${lv} (${intervals[lv]})</span>
          <div class="srs-bar-track">
            <div class="srs-bar-fill lv${lv}" style="width: ${pct}%"></div>
          </div>
          <span class="srs-bar-count">${count} chữ</span>
        </div>
      `;
    }

    const srsHtml = `
      <div class="srs-section">
        <div class="srs-title">📊 Tiến độ SRS & Dự báo ôn tập</div>
        
        <div class="srs-metrics">
          <div class="srs-metric-card card-not-started">
            <div class="srs-card-value">${notStarted}</div>
            <div class="srs-card-label">Chưa học</div>
          </div>
          <div class="srs-metric-card card-in-progress">
            <div class="srs-card-value">${inProgress}</div>
            <div class="srs-card-label">Đang ôn</div>
          </div>
          <div class="srs-metric-card card-memorized">
            <div class="srs-card-value">${memorized}</div>
            <div class="srs-card-label">Đã thuộc</div>
          </div>
          <div class="srs-metric-card card-due-today">
            <div class="srs-card-value">${dueToday}</div>
            <div class="srs-card-label">Cần ôn hôm nay</div>
          </div>
          <div class="srs-metric-card card-due-tomorrow">
            <div class="srs-card-value">${dueTomorrow}</div>
            <div class="srs-card-label">Đến hạn ngày mai</div>
          </div>
        </div>

        <div class="srs-chart-container">
          <div class="srs-chart-header">
            <span>Biểu đồ cấp độ SRS (Cấp 1 - 8)</span>
            <span>Tổng số: ${total} chữ</span>
          </div>
          <div class="srs-bars-list">
            ${srsBarsHtml}
          </div>
        </div>
      </div>
    `;

    const quizRows = quiz.length
      ? quiz.map(r => `<div class="md-row">
          <span class="md-date">${escapeHtml(r.d || '')}</span>
          <span class="md-type">${r.mc ? 'Trắc nghiệm' : 'Lật thẻ'}</span>
          <span class="md-main"><b>${r.k}/${r.total}</b> (${r.pct}%)</span>
          <span class="md-time">⏱ ${escapeHtml(r.time || '')}</span>
        </div>`).join('')
      : '<p class="io-note">Chưa có lần kiểm tra nào.</p>';
    const gameRows = game.length
      ? game.map(r => `<div class="md-row">
          <span class="md-date">${escapeHtml(r.d || '')}</span>
          <span class="md-main">${r.pairs} cặp</span>
          <span class="md-time">⏱ ${fmtTime(r.t)}</span>
        </div>`).join('')
      : '<p class="io-note">Chưa có lần ghép thẻ nào.</p>';
    const clearBtn = (quiz.length || game.length)
      ? `<button class="btn-danger md-clear" data-id="${escapeHtml(m.id || '')}">🗑 Xóa lịch sử kết quả</button>`
      : '';
    const delBtn = `<button class="btn-danger md-del" data-id="${escapeHtml(m.id || '')}" data-name="${escapeHtml(m.name || '')}">❌ Xóa thành viên này</button>`;
    
    return `${srsHtml}
      <div class="md-sec"><div class="md-title">📝 Kiểm tra (${quiz.length})</div>${quizRows}</div>
      <div class="md-sec"><div class="md-title">🎮 Ghép thẻ (${game.length})</div>${gameRows}</div>
      <div class="md-actions">${clearBtn}${delBtn}</div>`;
  }

  // ===== "Chữ khó của lớp" — chỉ tính chữ học sinh gắn cờ ⚑; xổ xuống xem ai gắn =====
  function renderClassDifficulty(rows) {
    const el = $('classDiff'); if (!el) return;
    if (!items.length || !rows.length) { el.innerHTML = ''; return; }
    const byH = {};
    items.forEach(it => { byH[it.h] = { h: it.h, p: it.p, m: it.m, names: [] }; });
    rows.forEach(m => {
      const pg = m.progress || {};
      items.forEach(it => { const e = pg[it.h]; if (e && e.fl) byH[it.h].names.push(m.name || '?'); });
    });
    const arr = Object.values(byH).filter(x => x.names.length).sort((a, b) => b.names.length - a.names.length);
    if (!arr.length) {
      el.innerHTML = '<div class="class-diff"><div class="cd-title">📊 Chữ khó của lớp</div><p class="io-note">Chưa có chữ nào được học sinh gắn cờ ⚑.</p></div>';
      return;
    }
    el.innerHTML = `<div class="class-diff">
      <div class="cd-title">📊 Chữ khó của lớp <span class="cd-sub">(chữ được gắn cờ ⚑ — bấm để xem ai gắn)</span></div>
      ${arr.map((x, i) => `<div class="cd-item">
        <div class="cd-row cd-clickable" data-i="${i}">
          <span class="cd-h">${escapeHtml(x.h)}</span>
          <span class="cd-stat">⚑ ${x.names.length} bạn <span class="cd-caret">▸</span></span>
        </div>
        <div class="cd-names" id="cdNames${i}" style="display:none;">
          <div class="cd-detail"><span class="cd-p">${colorPinyin(x.p) || '—'}</span><span class="cd-m">${escapeHtml(x.m) || ''}</span></div>
          <div class="cd-who">${x.names.map(n => `<span class="cs-chip">${escapeHtml(n)}</span>`).join('')}</div>
        </div>
      </div>`).join('')}
    </div>`;
    el.querySelectorAll('.cd-clickable').forEach(row => {
      row.addEventListener('click', () => {
        const d = $('cdNames' + row.dataset.i);
        const caret = row.querySelector('.cd-caret');
        const open = d.style.display !== 'none';
        d.style.display = open ? 'none' : 'flex';
        if (caret) caret.textContent = open ? '▸' : '▾';
      });
    });
  }
  function exportMembersCsv(rows) {
    if (!rows || !rows.length) { showAlert('Chưa có thành viên để xuất.'); return; }
    const head = ['Tên', 'Ngày sinh', 'Điểm', 'Đã thuộc', 'Tổng', 'Chuỗi ngày', 'Số phiên'];
    const esc = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const lines = [head.map(esc).join(',')];
    rows.forEach(m => lines.push([m.name, m.dob, m.score || 0, m.known || 0, m.total || 0, m.streak || 0, m.sessions || 0].map(esc).join(',')));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'diem-lop-' + todayStr() + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }
  let lastMembers = [];
  if ($('exportMembersBtn')) $('exportMembersBtn').onclick = () => exportMembersCsv(lastMembers);
  let lastDiffRows = [];
  function renderClassDiffPage() {
    const el = $('classDiff'); if (!el) return;
    if (!db) { el.innerHTML = '<p class="empty-msg">Cần có mạng để xem.</p>'; return; }
    el.innerHTML = '<p class="io-note">Đang tải…</p>';
    db.collection('members').limit(100).get().then(snap => {
      const rows = []; snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
      lastDiffRows = rows;
      renderClassDifficulty(rows);
      if (!el.innerHTML) el.innerHTML = '<p class="empty-msg">Chưa có dữ liệu — học sinh cần học/đánh dấu chữ trước.</p>';
    }).catch(e => { el.innerHTML = '<p class="io-note">Lỗi: ' + escapeHtml(e.message) + '</p>'; });
  }
  if ($('refreshDiffBtn')) $('refreshDiffBtn').onclick = renderClassDiffPage;
  // Xóa "dấu khó" (⚑) của cả lớp — xóa trên đám mây + báo các máy học sinh tự gỡ cờ
  if ($('clearDiffBtn')) $('clearDiffBtn').onclick = () => {
    showConfirm('Xóa toàn bộ "đánh dấu khó" (⚑) của cả lớp? Cờ lưu ý trên máy học sinh cũng sẽ tự mất ở lần mở app kế tiếp. Tiến độ đã thuộc KHÔNG bị ảnh hưởng.', () => {
      if (!db) return;
      const stamp = Date.now();
      const batch = db.batch();
      // 1) gỡ cờ trong dữ liệu đám mây của từng học sinh (giữ nguyên đã thuộc / cấp độ)
      lastDiffRows.forEach(m => {
        if (!m.progress || !Object.keys(m.progress).length) return;
        const np = {};
        Object.keys(m.progress).forEach(h => { np[h] = { ...m.progress[h], fl: 0 }; });
        batch.set(db.collection('members').doc(m.id), { progress: np }, { merge: true });
      });
      // 2) đánh dấu mốc reset để mọi máy học sinh tự gỡ cờ khi đồng bộ
      batch.set(db.collection('shared').doc('config'), { flagsResetAt: stamp }, { merge: true });
      batch.commit()
        .then(() => { showAlert('Đã xóa dấu khó của cả lớp. Máy học sinh sẽ tự cập nhật.'); renderClassDiffPage(); })
        .catch(e => showAlert('Lỗi: ' + e.message));
    });
  };
  // Gỡ tất cả cờ "lưu ý" trên máy này (khi giáo viên xóa dấu khó)
  function clearLocalFlags() {
    let changed = false;
    items.forEach(it => { if (it.flag) { it.flag = false; changed = true; } });
    if (changed) { save(); renderGrid(); updateStudyBanner(); }
  }

  function renderMembersPage() {
    const el = $('membersList');
    if (!el) return;
    if (!db) { el.innerHTML = '<p class="empty-msg">Cần có mạng để xem danh sách thành viên.</p>'; return; }
    el.innerHTML = '<p class="io-note">Đang tải…</p>';
    db.collection('members').orderBy('score', 'desc').limit(100).get().then(snap => {
      const rows = []; snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
      lastMembers = rows;
      if (!rows.length) { el.innerHTML = '<p class="empty-msg">Chưa có thành viên nào.</p>'; return; }
      el.innerHTML = rows.map((m, i) => {
        const pct = m.total ? Math.round((m.known || 0) / m.total * 100) : 0;
        const me = profile && m.name === profile.name ? ' style="border-color:var(--gold-2);"' : '';
        // Top 3 điểm tích cực: thêm hiệu ứng sống động + huy chương
        const topCls = (m.score || 0) > 0 && i < 3 ? ` member-top member-top${i + 1}` : '';
        const medal = ['🥇', '🥈', '🥉'][i];
        const rankInner = topCls ? `<span class="member-medal">${medal}</span>` : (i + 1);
        return `<div class="member-row member-clickable${topCls}" data-idx="${i}"${me}>
          <div class="member-rank">${rankInner}</div>
          <div class="member-info">
            <div class="member-name">${escapeHtml(m.name || '?')} <span class="member-caret">▸</span></div>
            <div class="member-sub">${m.dob ? '🎂 ' + escapeHtml(m.dob) + ' · ' : ''}Online: ${onlineLevel(m.sessions || 0)}</div>
          </div>
          <div class="member-stats">
            <span class="member-score">⭐ ${m.score || 0} điểm</span>
            <span class="member-prog">Tiến độ: ${m.known || 0}/${m.total || 0} (${pct}%)</span>
          </div>
        </div>
        <div class="member-detail" id="memDetail${i}" style="display:none;"></div>`;
      }).join('');
      el.querySelectorAll('.member-clickable').forEach(row => {
        row.addEventListener('click', () => {
          const i = row.dataset.idx;
          const det = $('memDetail' + i);
          const caret = row.querySelector('.member-caret');
          const open = det.style.display !== 'none';
          if (open) { det.style.display = 'none'; if (caret) caret.textContent = '▸'; return; }
          if (!det.innerHTML) {
            const bindDetail = () => {
              det.innerHTML = memberDetailHtml(rows[i]);
              const cb = det.querySelector('.md-clear');
              if (cb) cb.onclick = () => {
                showConfirm('Xóa toàn bộ lịch sử kết quả của "' + (rows[i].name || '?') + '"?', () => {
                  db.collection('members').doc(cb.dataset.id)
                    .set({ quizResults: [], gameResults: [] }, { merge: true })
                    .then(() => { rows[i].quizResults = []; rows[i].gameResults = []; bindDetail(); })
                    .catch(e => showAlert('Lỗi: ' + e.message));
                });
              };
              const db2 = det.querySelector('.md-del');
              if (db2) db2.onclick = () => {
                showConfirm('Xóa hẳn thành viên "' + (rows[i].name || '?') + '" khỏi danh sách? (dùng để dọn tài khoản trùng)', () => {
                  db.collection('members').doc(db2.dataset.id).delete()
                    .then(renderMembersPage)
                    .catch(e => showAlert('Lỗi: ' + e.message));
                });
              };
            };
            bindDetail();
          }
          det.style.display = 'block';
          if (caret) caret.textContent = '▾';
        });
      });
    }).catch(e => { el.innerHTML = '<p class="io-note">Lỗi: ' + escapeHtml(e.message) + '</p>'; });
  }
  if ($('refreshMembersBtn')) $('refreshMembersBtn').onclick = renderMembersPage;

  // ===== Chuyển chế độ Học sinh / Giáo viên =====
  let teacherPass = 'kinkin2002';   // mặc định; sẽ lấy từ Firebase nếu đã đổi
  if (db) db.collection('shared').doc('config').onSnapshot(s => {
    if (!s.exists) return;
    const data = s.data();
    if (data.teacherPass) teacherPass = data.teacherPass;
    // Giáo viên đã "Xóa dấu khó" -> gỡ cờ trên máy này (mỗi mốc chỉ xử lý một lần)
    if (data.flagsResetAt) {
      const seen = Number(localStorage.getItem('hanzi-flags-reset') || 0);
      if (data.flagsResetAt > seen) {
        localStorage.setItem('hanzi-flags-reset', String(data.flagsResetAt));
        clearLocalFlags();
      }
    }
  }, () => {});
  function applyRole(role) {
    role = role === 'teacher' ? 'teacher' : 'student';
    // Chế độ Giáo viên cần mật khẩu (nhớ trên máy sau khi nhập đúng 1 lần)
    if (role === 'teacher' && localStorage.getItem('hanzi-teacher-ok') !== '1') {
      showPromptModal('🔒 Nhập mật khẩu giáo viên:', '', (v) => {
        if ((v || '').trim() === teacherPass) {
          localStorage.setItem('hanzi-teacher-ok', '1');
          applyRole('teacher');
        } else {
          showAlert('Mật khẩu không đúng.');
          applyRole('student');
        }
      });
      return;
    }
    document.body.classList.toggle('role-teacher', role === 'teacher');
    document.body.classList.toggle('role-student', role !== 'teacher');
    document.querySelectorAll('.role-btn').forEach(b => b.classList.toggle('active', b.dataset.role === role));
    localStorage.setItem('hanzi-role', role);
    updateLessonFilter(); // cập nhật danh sách bài học
    // Mở tab đầu tiên của chế độ đó
    const firstTab = document.querySelector('.tab[data-role="' + role + '"]');
    if (firstTab) firstTab.click();
  }
  document.querySelectorAll('.role-btn').forEach(b => {
    b.addEventListener('click', () => applyRole(b.dataset.role));
  });
  // Đổi mật khẩu giáo viên (lưu lên Firebase -> dùng chung mọi máy)
  if ($('changePassBtn')) $('changePassBtn').onclick = () => {
    showPromptModal('Nhập mật khẩu MỚI cho giáo viên:', '', (v) => {
      v = (v || '').trim();
      if (!v) { showAlert('Mật khẩu không được để trống.'); return; }
      teacherPass = v;
      if (db) db.collection('shared').doc('config').set({ teacherPass: v }, { merge: true }).catch(() => {});
      showAlert('Đã đổi mật khẩu giáo viên thành: ' + v);
    });
  };
