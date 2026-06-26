/* ============================================================
   Bài kiểm tra giáo viên giao (trắc nghiệm + tự luận)
   - Giáo viên: tạo đề (nhập thủ công hoặc dán theo mẫu), xem & chấm bài nộp.
   - Học sinh: làm bài và nộp; trắc nghiệm tự chấm, tự luận giáo viên chấm tay.
   File riêng, không phụ thuộc app.js (đọc hồ sơ qua localStorage, Firebase qua compat SDK).
   ============================================================ */
(function () {
  if (!window.firebase || !firebase.firestore) return;
  let db;
  try { db = firebase.firestore(); } catch (e) { return; }

  const $ = id => document.getElementById(id);
  const esc = s => (s == null ? '' : String(s)).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const getProfile = () => { try { return JSON.parse(localStorage.getItem('hanzi-profile')); } catch (e) { return null; } };
  const qTag = q => q.type === 'mc' ? 'TN' : q.type === 'fill' ? 'ĐK' : 'TL';   // TN=trắc nghiệm, ĐK=điền khuyết, TL=tự luận
  const isAuto = q => q.type === 'mc' || q.type === 'fill';   // câu tự chấm được
  const norm = s => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  function shuf(a) { const arr = a.slice(); for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
  // Dùng popup đẹp của app.js (nếu có), không thì rơi về hộp thoại mặc định
  function uiAlert(msg) { if (window.HanziUI && window.HanziUI.alert) window.HanziUI.alert(msg); else alert(msg); }
  function uiConfirm(msg, onYes) { if (window.HanziUI && window.HanziUI.confirm) window.HanziUI.confirm(msg, onYes); else { if (confirm(msg)) onYes(); } }

  // ===================== GIÁO VIÊN: SOẠN ĐỀ =====================
  let draft = { title: '', durationMin: 0, open: true, questions: [] };
  let editingId = null;   // đang sửa đề nào (null = tạo mới)
  let examTimer = null;
  let leaveHandler = null, leaveCount = 0;   // đếm số lần rời màn hình bài thi
  function stopExamTimer() {
    if (examTimer) { clearInterval(examTimer); examTimer = null; }
    if (leaveHandler) { document.removeEventListener('visibilitychange', leaveHandler); window.removeEventListener('blur', leaveHandler); leaveHandler = null; }
  }

  function examEditHtml() {
    const qlist = draft.questions.length
      ? draft.questions.map((q, i) => `
        <div class="ex-qrow">
          <span class="ex-qbadge">${qTag(q)}</span>
          <span class="ex-qtext">${i + 1}. ${esc(q.q)}${isAuto(q) ? ' <em>(đáp án: ' + esc(q.correctText) + ')</em>' : ''}</span>
          <button class="btn-gold ex-edit" data-i="${i}">Sửa</button>
          <button class="btn-danger ex-del" data-i="${i}">Xóa</button>
        </div>`).join('')
      : '<p class="io-note">Chưa có câu hỏi nào trong đề.</p>';

    return `
    <div class="panel">
      <div class="lessons-head"><h3>${editingId ? '✏️ Sửa đề kiểm tra' : '📋 Giao bài kiểm tra'}</h3>${editingId ? '<button class="btn-clear" id="cancelEditBtn">Hủy sửa</button>' : ''}</div>
      ${editingId ? '<p class="io-note" style="color:#6fe0a0;">Đang sửa đề đã giao — bấm "Cập nhật đề" để lưu thay đổi.</p>' : ''}
      <div class="field">
        <label for="exTitle">Tên đề kiểm tra</label>
        <input type="text" id="exTitle" placeholder="VD: Kiểm tra 15 phút — Bài 1" value="${esc(draft.title)}" autocomplete="off">
      </div>
      <div class="field">
        <label for="exDuration">Thời gian làm bài (phút) — để trống/0 = không giới hạn</label>
        <input type="number" id="exDuration" min="0" placeholder="VD: 15" value="${draft.durationMin || ''}" autocomplete="off">
      </div>
      <label class="ex-openline"><input type="checkbox" id="exOpen" ${draft.open !== false ? 'checked' : ''}> Mở cho học sinh làm bài</label>
    </div>

    <details class="panel">
      <summary>➕ Thêm câu trắc nghiệm</summary>
      <div class="field" style="margin-top:10px;"><input type="text" id="mcQ" placeholder="Câu hỏi" autocomplete="off"></div>
      <div class="field"><input type="text" id="mcA" placeholder="Đáp án ĐÚNG" autocomplete="off"></div>
      <div class="field"><input type="text" id="mcB" placeholder="Đáp án sai 1" autocomplete="off"></div>
      <div class="field"><input type="text" id="mcC" placeholder="Đáp án sai 2" autocomplete="off"></div>
      <div class="field"><input type="text" id="mcD" placeholder="Đáp án sai 3 (không bắt buộc)" autocomplete="off"></div>
      <button class="btn-gold" id="addMcBtn">+ Thêm câu trắc nghiệm</button>
    </details>

    <details class="panel">
      <summary>➕ Thêm câu điền vào chỗ trống (bấm từ để ghép)</summary>
      <div class="field" style="margin-top:10px;"><input type="text" id="fillQ" placeholder="Câu hỏi (dùng ___ cho chỗ trống). VD: 我 ___ 学生" autocomplete="off"></div>
      <div class="field"><input type="text" id="fillA" placeholder="Đáp án đúng — các TỪ cách nhau bằng dấu cách (HS ghép đúng thứ tự). VD: 是" autocomplete="off"></div>
      <div class="field"><input type="text" id="fillD" placeholder="Từ gây nhiễu cho sẵn (cách nhau bằng dấu cách, không bắt buộc). VD: 不是 有 很" autocomplete="off"></div>
      <button class="btn-gold" id="addFillBtn">+ Thêm câu điền khuyết</button>
    </details>

    <details class="panel">
      <summary>➕ Thêm câu tự luận</summary>
      <div class="field" style="margin-top:10px;"><input type="text" id="essayQ" placeholder="Câu hỏi tự luận (học sinh gõ trả lời)" autocomplete="off"></div>
      <button class="btn-gold" id="addEssayBtn">+ Thêm câu tự luận</button>
    </details>

    <div class="panel">
      <div class="lessons-head"><h3>Câu hỏi trong đề (<span id="exQCount">${draft.questions.length}</span>)</h3></div>
      <div id="exDraftList">${qlist}</div>
      <button class="btn-add" id="saveExamBtn" style="margin-top:14px;">${editingId ? '💾 Cập nhật đề' : '✅ Lưu & giao bài cho lớp'}</button>
    </div>

    <div class="panel">
      <div class="lessons-head"><h3>📚 Đề đã giao</h3><button class="btn-gold" id="reloadExamsBtn">🔄 Làm mới</button></div>
      <div id="examList"><p class="io-note">Đang tải…</p></div>
    </div>

    <div class="panel" id="subPanel" style="display:none;">
      <div class="lessons-head"><h3 id="subTitle">Bài nộp</h3><button class="btn-clear" id="subCloseBtn">Đóng</button></div>
      <div id="subList"></div>
    </div>`;
  }

  function renderTeacherExam() {
    const el = $('page-examEdit'); if (!el) return;
    el.innerHTML = examEditHtml();

    $('exTitle').addEventListener('input', e => { draft.title = e.target.value; });
    $('exDuration').addEventListener('input', e => { draft.durationMin = parseInt(e.target.value, 10) || 0; });
    $('exOpen').addEventListener('change', e => { draft.open = e.target.checked; });

    $('addMcBtn').onclick = () => {
      const q = $('mcQ').value.trim();
      const a = $('mcA').value.trim();
      const opts = [a, $('mcB').value.trim(), $('mcC').value.trim(), $('mcD').value.trim()].filter(Boolean);
      if (!q) { uiAlert('Nhập câu hỏi.'); return; }
      if (!a || opts.length < 2) { uiAlert('Cần đáp án đúng và ít nhất 1 đáp án sai.'); return; }
      draft.questions.push({ type: 'mc', q: q, opts: opts, correctText: a });
      reRenderKeepLists();
    };
    $('addFillBtn').onclick = () => {
      const q = $('fillQ').value.trim();
      const a = $('fillA').value.trim();
      const d = $('fillD').value.trim();
      if (!q) { uiAlert('Nhập câu hỏi.'); return; }
      if (!a) { uiAlert('Nhập đáp án đúng cho chỗ trống.'); return; }
      const distractors = d ? d.split(/\s+/).filter(Boolean) : [];
      draft.questions.push({ type: 'fill', q: q, correctText: a, distractors: distractors });
      reRenderKeepLists();
    };
    $('addEssayBtn').onclick = () => {
      const q = $('essayQ').value.trim();
      if (!q) { uiAlert('Nhập câu hỏi tự luận.'); return; }
      draft.questions.push({ type: 'essay', q: q });
      reRenderKeepLists();
    };
    $('saveExamBtn').onclick = saveExam;
    $('reloadExamsBtn').onclick = loadAssignmentsList;
    $('subCloseBtn').onclick = () => { $('subPanel').style.display = 'none'; };
    if ($('cancelEditBtn')) $('cancelEditBtn').onclick = () => {
      editingId = null; draft = { title: '', durationMin: 0, open: true, questions: [] };
      renderTeacherExam();
    };
    bindDraftDeletes();
    loadAssignmentsList();
  }

  // Đưa một câu trong đề trở lại ô nhập để sửa (xóa khỏi danh sách, sửa xong bấm Thêm lại)
  function editQuestion(i) {
    const q = draft.questions[i];
    if (!q) return;
    draft.questions.splice(i, 1);
    reRenderKeepLists();   // hàm này dọn sạch ô nhập, nên set giá trị SAU khi gọi
    if (q.type === 'mc') {
      $('mcQ').value = q.q; $('mcA').value = q.correctText;
      const wrong = (q.opts || []).filter(o => o !== q.correctText);
      $('mcB').value = wrong[0] || ''; $('mcC').value = wrong[1] || ''; $('mcD').value = wrong[2] || '';
      $('mcQ').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (q.type === 'fill') {
      $('fillQ').value = q.q; $('fillA').value = q.correctText; $('fillD').value = (q.distractors || []).join(' ');
      $('fillQ').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      $('essayQ').value = q.q;
      $('essayQ').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function reRenderKeepLists() {
    // chỉ vẽ lại danh sách câu hỏi để không mất ô đang nhập tên đề
    const list = $('exDraftList');
    if (!list) { renderTeacherExam(); return; }
    list.innerHTML = draft.questions.length
      ? draft.questions.map((q, i) => `
        <div class="ex-qrow">
          <span class="ex-qbadge">${qTag(q)}</span>
          <span class="ex-qtext">${i + 1}. ${esc(q.q)}${isAuto(q) ? ' <em>(đáp án: ' + esc(q.correctText) + ')</em>' : ''}</span>
          <button class="btn-gold ex-edit" data-i="${i}">Sửa</button>
          <button class="btn-danger ex-del" data-i="${i}">Xóa</button>
        </div>`).join('')
      : '<p class="io-note">Chưa có câu hỏi nào trong đề.</p>';
    if ($('exQCount')) $('exQCount').textContent = draft.questions.length;
    // dọn các ô nhập nhanh
    ['mcQ', 'mcA', 'mcB', 'mcC', 'mcD', 'fillQ', 'fillA', 'fillD', 'essayQ'].forEach(id => { if ($(id)) $(id).value = ''; });
    bindDraftDeletes();
  }
  function bindDraftDeletes() {
    document.querySelectorAll('#exDraftList .ex-del').forEach(b => {
      b.onclick = () => { draft.questions.splice(Number(b.dataset.i), 1); reRenderKeepLists(); };
    });
    document.querySelectorAll('#exDraftList .ex-edit').forEach(b => {
      b.onclick = () => editQuestion(Number(b.dataset.i));
    });
  }

  function loadForEdit(a) {
    editingId = a.id;
    draft = {
      title: a.title || '', durationMin: a.durationMin || 0, open: a.open !== false,
      questions: JSON.parse(JSON.stringify(a.questions || []))
    };
    renderTeacherExam();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function saveExam() {
    const title = (draft.title || '').trim();
    if (!title) { uiAlert('Nhập tên đề kiểm tra.'); return; }
    if (!draft.questions.length) { uiAlert('Đề chưa có câu hỏi nào.'); return; }
    const data = { title: title, questions: draft.questions, durationMin: draft.durationMin || 0, open: draft.open !== false };
    const done = (msg) => {
      uiAlert(msg);
      editingId = null;
      draft = { title: '', durationMin: 0, open: true, questions: [] };
      renderTeacherExam();
    };
    if (editingId) {
      db.collection('assignments').doc(editingId).set(data, { merge: true })
        .then(() => done('Đã cập nhật đề "' + title + '".'))
        .catch(e => uiAlert('Lỗi: ' + e.message));
    } else {
      data.createdAt = Date.now();
      db.collection('assignments').add(data)
        .then(() => done('Đã giao bài "' + title + '" cho lớp.'))
        .catch(e => uiAlert('Lỗi: ' + e.message));
    }
  }

  function loadAssignmentsList() {
    const el = $('examList'); if (!el) return;
    el.innerHTML = '<p class="io-note">Đang tải…</p>';
    db.collection('assignments').orderBy('createdAt', 'desc').limit(50).get().then(snap => {
      const rows = []; snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
      if (!rows.length) { el.innerHTML = '<p class="empty-msg">Chưa có đề nào.</p>'; return; }
      el.innerHTML = '';
      rows.forEach(a => {
        const mc = (a.questions || []).filter(q => q.type === 'mc').length;
        const fi = (a.questions || []).filter(q => q.type === 'fill').length;
        const es = (a.questions || []).filter(q => q.type === 'essay').length;
        const isOpen = a.open !== false;
        const dur = a.durationMin ? a.durationMin + ' phút' : 'không giới hạn';
        const row = document.createElement('div');
        row.className = 'ex-arow';
        row.innerHTML = `<div class="ex-ainfo"><b>${esc(a.title)}</b>
          <span class="io-note">${mc} trắc nghiệm · ${fi} điền · ${es} tự luận · ⏱ ${dur} · ${isOpen ? '<span style="color:#6fe0a0">Đang mở</span>' : '<span style="color:#ff9d8e">Đã đóng</span>'}</span></div>`;
        const acts = document.createElement('div'); acts.className = 'ex-aacts';
        const bToggle = document.createElement('button');
        bToggle.className = isOpen ? 'btn-clear' : 'btn-gold';
        bToggle.textContent = isOpen ? '🔒 Đóng' : '🔓 Mở';
        bToggle.onclick = () => db.collection('assignments').doc(a.id).set({ open: !isOpen }, { merge: true }).then(loadAssignmentsList).catch(e => uiAlert('Lỗi: ' + e.message));
        const bEdit = document.createElement('button'); bEdit.className = 'btn-gold'; bEdit.textContent = '✏️ Sửa';
        bEdit.onclick = () => loadForEdit(a);
        const bView = document.createElement('button'); bView.className = 'btn-gold'; bView.textContent = '📥 Bài nộp';
        bView.onclick = () => viewSubmissions(a);
        const bDel = document.createElement('button'); bDel.className = 'btn-danger'; bDel.textContent = 'Xóa';
        bDel.onclick = () => uiConfirm('Xóa đề "' + a.title + '"?', () => db.collection('assignments').doc(a.id).delete().then(loadAssignmentsList));
        acts.append(bToggle, bEdit, bView, bDel); row.appendChild(acts);
        el.appendChild(row);
      });
    }).catch(e => { el.innerHTML = '<p class="io-note">Lỗi: ' + esc(e.message) + '</p>'; });
  }

  function viewSubmissions(a) {
    const panel = $('subPanel'), list = $('subList');
    $('subTitle').textContent = '📥 Bài nộp: ' + a.title;
    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    list.innerHTML = '<p class="io-note">Đang tải…</p>';
    db.collection('submissions').where('assignmentId', '==', a.id).get().then(snap => {
      const subs = []; snap.forEach(d => subs.push({ id: d.id, ...d.data() }));
      if (!subs.length) { list.innerHTML = '<p class="empty-msg">Chưa có học sinh nào nộp.</p>'; return; }
      subs.sort((x, y) => (y.submittedAt || 0) - (x.submittedAt || 0));
      list.innerHTML = '';
      subs.forEach(s => {
        const essays = (a.questions || []).map((q, i) => ({ q, i })).filter(o => o.q.type === 'essay');
        const essayHtml = essays.length ? essays.map(o => `
          <div class="ex-essay"><div class="ex-eq">TL: ${esc(o.q.q)}</div>
          <div class="ex-ea">${esc((s.answers && s.answers[o.i]) || '(bỏ trống)')}</div></div>`).join('') : '';
        const div = document.createElement('div');
        div.className = 'ex-sub';
        const lc = s.leaveCount || 0;
        const flagHtml = `<div class="ex-cheat ${lc > 0 ? 'ex-cheat-bad' : ''}">${lc > 0 ? '⚠️ Rời màn hình ' + lc + ' lần khi làm bài' : '✓ Không rời màn hình'}${s.timedOut ? ' · ⏱ hết giờ tự nộp' : ''}</div>`;
        div.innerHTML = `
          <div class="ex-subhead">
            <b>${esc(s.name || '?')}</b>
            <span class="ex-score">Tự chấm: Đúng ${s.mcScore || 0}/${s.mcTotal || 0} câu${s.mcTotal ? ' (' + Math.round((s.mcScore || 0) / s.mcTotal * 100) + '%)' : ''}</span>
          </div>
          ${flagHtml}
          ${essayHtml}
          <div class="ex-grade">
            <label>Điểm tổng (giáo viên chấm): </label>
            <input type="text" class="ef-input ex-gin" value="${esc(s.teacherScore || '')}" placeholder="VD: 8/10" style="max-width:120px; display:inline-block;">
            <button class="btn-gold ex-gsave">Lưu điểm</button>
            <span class="ex-gst">${s.teacherScore ? '✓ đã chấm: ' + esc(s.teacherScore) : ''}</span>
          </div>`;
        div.querySelector('.ex-gsave').onclick = () => {
          const v = div.querySelector('.ex-gin').value.trim();
          db.collection('submissions').doc(s.id).set({ teacherScore: v, graded: true }, { merge: true })
            .then(() => { div.querySelector('.ex-gst').textContent = '✓ đã chấm: ' + v; })
            .catch(e => uiAlert('Lỗi: ' + e.message));
        };
        list.appendChild(div);
      });
    }).catch(e => { list.innerHTML = '<p class="io-note">Lỗi: ' + esc(e.message) + '</p>'; });
  }

  // ===================== HỌC SINH: LÀM BÀI =====================
  function renderStudentExam() {
    stopExamTimer();
    const el = $('page-exam'); if (!el) return;
    const profile = getProfile();
    if (!profile || !profile.id) {
      el.innerHTML = '<div class="panel"><p class="empty-msg">Hãy vào trang "Học" để đăng nhập (tên + ngày sinh) trước khi làm bài kiểm tra.</p></div>';
      return;
    }
    el.innerHTML = '<div class="panel"><div class="lessons-head"><h3>🧪 Bài kiểm tra được giao</h3></div><div id="exStuList"><p class="io-note">Đang tải…</p></div></div>';
    db.collection('assignments').orderBy('createdAt', 'desc').limit(50).get().then(snap => {
      const rows = []; snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
      const listEl = $('exStuList');
      if (!rows.length) { listEl.innerHTML = '<p class="empty-msg">Hiện chưa có bài kiểm tra nào.</p>'; return; }
      // kiểm tra bài đã nộp
      Promise.all(rows.map(a => db.collection('submissions').doc(a.id + '__' + profile.id).get().catch(() => null)))
        .then(subSnaps => {
          listEl.innerHTML = '';
          rows.forEach((a, idx) => {
            const sub = subSnaps[idx] && subSnaps[idx].exists ? subSnaps[idx].data() : null;
            const mc = (a.questions || []).filter(q => q.type === 'mc').length;
            const fi = (a.questions || []).filter(q => q.type === 'fill').length;
            const es = (a.questions || []).filter(q => q.type === 'essay').length;
            const isOpen = a.open !== false;
            const dur = a.durationMin ? ' · ⏱ ' + a.durationMin + ' phút' : '';
            const row = document.createElement('div');
            row.className = 'ex-arow';
            row.innerHTML = `<div class="ex-ainfo"><b>${esc(a.title)}</b><span class="io-note">${mc} trắc nghiệm · ${fi} điền · ${es} tự luận${dur}${sub ? ' · <span style="color:#6fe0a0">Đã nộp</span>' : (isOpen ? '' : ' · <span style="color:#ff9d8e">Đã đóng</span>')}</span></div>`;
            const btn = document.createElement('button');
            if (sub) {
              btn.className = 'btn-clear'; btn.textContent = 'Xem kết quả';
              btn.onclick = () => showResult(a, sub);
            } else if (!isOpen) {
              btn.className = 'btn-clear'; btn.textContent = 'Đã đóng'; btn.disabled = true;
            } else {
              btn.className = 'btn-gold'; btn.textContent = 'Làm bài';
              btn.onclick = () => doExam(a, profile);
            }
            row.appendChild(btn);
            listEl.appendChild(row);
          });
        });
    }).catch(e => { const l = $('exStuList'); if (l) l.innerHTML = '<p class="io-note">Lỗi: ' + esc(e.message) + '</p>'; });
  }

  function doExam(a, profile) {
    stopExamTimer();
    const el = $('page-exam');
    // chuẩn bị: trắc nghiệm trộn đáp án; điền khuyết trộn các "từ" cho sẵn (đáp án + nhiễu)
    const fillState = {};
    const prepared = (a.questions || []).map((q, i) => {
      if (q.type === 'mc') return { ...q, shown: shuf(q.opts) };
      if (q.type === 'fill') {
        const words = (q.correctText || '').trim().split(/\s+/).filter(Boolean);
        let id = 0;
        const bank = shuf(words.concat(q.distractors || []).map(w => ({ id: id++, word: w })));
        fillState[i] = { answer: [] };
        return { ...q, bank: bank };
      }
      return q;
    });
    const hasTimer = a.durationMin > 0;

    // 1 câu hỏi -> HTML (num = số thứ tự hiển thị, i = chỉ số gốc để chấm/lưu)
    function qHtml(q, i, num) {
      if (q.type === 'mc') return `
        <div class="ex-doq">
          <div class="ex-doqt">${num}. ${esc(q.q)}</div>
          ${q.shown.map(opt => `<label class="ex-opt"><input type="radio" name="q${i}" value="${esc(opt)}"> ${esc(opt)}</label>`).join('')}
        </div>`;
      if (q.type === 'fill') return `
        <div class="ex-doq">
          <div class="ex-doqt">${num}. ${esc(q.q)} <em>(bấm từ để ghép)</em></div>
          <div class="pa-answer ex-fans" id="exFans${i}"></div>
          <div class="pa-bank ex-fbank" id="exFbank${i}"></div>
        </div>`;
      return `
        <div class="ex-doq">
          <div class="ex-doqt">${num}. ${esc(q.q)}</div>
          <textarea class="ef-input" name="q${i}" rows="3" style="width:100%;" placeholder="Nhập câu trả lời…"></textarea>
        </div>`;
    }
    // Sắp xếp theo phần: 1 Trắc nghiệm, 2 Tự luận, 3 Điền khuyết
    const sections = [
      { title: 'Phần 1: Trắc nghiệm', type: 'mc' },
      { title: 'Phần 2: Tự luận', type: 'essay' },
      { title: 'Phần 3: Điền khuyết', type: 'fill' }
    ];
    let num = 0;
    const blocks = [];
    sections.forEach(sec => {
      // Xáo trộn thứ tự câu trong từng phần -> mỗi máy một thứ tự khác nhau
      const group = shuf(prepared.map((q, i) => ({ q, i })).filter(o => o.q.type === sec.type));
      if (!group.length) return;
      const inner = group.map(({ q, i }) => { num++; return qHtml(q, i, num); }).join('');
      blocks.push(`<details class="ex-part-box"><summary class="ex-part">${sec.title} (${group.length} câu)</summary>${inner}</details>`);
    });

    el.innerHTML = `<div class="panel">
      <div class="lessons-head"><h3>${esc(a.title)}</h3>${hasTimer ? '<div class="ex-timer" id="exTimer">⏱ --:--</div>' : ''}</div>
      <form id="examForm">
        ${blocks.join('')}
        <button type="submit" class="btn-add" style="margin-top:14px;">📤 Nộp bài</button>
      </form>
    </div>`;

    let submitted = false;
    const form = $('examForm');

    // Âm thầm đếm số lần học sinh rời màn hình bài thi (chuyển tab / thoát app)
    leaveCount = 0;
    leaveHandler = () => { if (document.hidden && !submitted) leaveCount++; };
    document.addEventListener('visibilitychange', leaveHandler);

    // ===== Câu điền khuyết: bấm từ để ghép =====
    function fillWord(q, id) { const it = q.bank.find(b => b.id === id); return it ? it.word : ''; }
    function renderFill(i) {
      const q = prepared[i], st = fillState[i];
      const ansEl = $('exFans' + i), bankEl = $('exFbank' + i);
      ansEl.innerHTML = st.answer.length
        ? st.answer.map(id => `<button type="button" class="pa-word ex-tile" data-i="${i}" data-id="${id}" data-where="ans">${esc(fillWord(q, id))}</button>`).join('')
        : '<span class="pa-hint">Bấm từ bên dưới để ghép…</span>';
      bankEl.innerHTML = q.bank.filter(b => !st.answer.includes(b.id))
        .map(b => `<button type="button" class="pa-word ex-tile" data-i="${i}" data-id="${b.id}" data-where="bank">${esc(b.word)}</button>`).join('');
    }
    prepared.forEach((q, i) => { if (q.type === 'fill') renderFill(i); });
    form.addEventListener('click', e => {
      const tile = e.target.closest('.ex-tile'); if (!tile) return;
      const i = Number(tile.dataset.i), id = Number(tile.dataset.id), st = fillState[i];
      if (tile.dataset.where === 'bank') st.answer.push(id);
      else st.answer = st.answer.filter(x => x !== id);
      renderFill(i);
    });

    function collectAndSave(auto) {
      if (submitted) return;
      submitted = true;
      stopExamTimer();
      const answers = [];
      let mcScore = 0, mcTotal = 0;
      prepared.forEach((q, i) => {
        if (q.type === 'mc') {
          const f = form['q' + i];
          const val = f && f.value ? f.value : '';
          answers[i] = val; mcTotal++;
          if (val === q.correctText) mcScore++;
        } else if (q.type === 'fill') {
          const val = fillState[i].answer.map(id => fillWord(q, id)).join(' ');
          answers[i] = val; mcTotal++;
          if (norm(val) === norm(q.correctText)) mcScore++;
        } else {
          const f = form['q' + i];
          answers[i] = f ? (f.value || '').trim() : '';
        }
      });
      const lc = leaveCount;   // chốt số lần rời màn hình trước khi dọn guard
      const sub = {
        assignmentId: a.id, title: a.title, memberId: profile.id, name: profile.name || '?',
        answers: answers, mcScore: mcScore, mcTotal: mcTotal,
        essayTotal: prepared.filter(q => q.type === 'essay').length,
        leaveCount: lc, timedOut: !!auto, submittedAt: Date.now()
      };
      db.collection('submissions').doc(a.id + '__' + profile.id).set(sub)
        .then(() => { if (auto) uiAlert('Hết giờ — bài đã được nộp tự động.'); showResult(a, sub); })
        .catch(err => { submitted = false; uiAlert('Lỗi khi nộp: ' + err.message); });
    }

    form.addEventListener('submit', e => {
      e.preventDefault();
      uiConfirm('Nộp bài? Sau khi nộp không sửa được.', () => collectAndSave(false));
    });

    // Đồng hồ đếm ngược (nếu giáo viên đặt thời gian)
    if (hasTimer) {
      let remain = a.durationMin * 60;
      const tEl = $('exTimer');
      const tick = () => {
        const m = Math.floor(remain / 60), s = remain % 60;
        if (tEl) {
          tEl.textContent = '⏱ ' + m + ':' + String(s).padStart(2, '0');
          tEl.classList.toggle('ex-timer-low', remain <= 30);
        }
        if (remain <= 0) { stopExamTimer(); collectAndSave(true); return; }
        remain--;
      };
      tick();
      examTimer = setInterval(tick, 1000);
    }
  }

  function showResult(a, sub) {
    stopExamTimer();
    const el = $('page-exam');
    el.innerHTML = `<div class="panel">
      <div class="lessons-head"><h3>Kết quả: ${esc(a.title)}</h3></div>
      <p class="done-score" style="font-size:1.2rem;">Tự chấm (trắc nghiệm + điền): <b>Đúng ${sub.mcScore || 0}/${sub.mcTotal || 0} câu</b>${sub.mcTotal ? ' (' + Math.round((sub.mcScore || 0) / sub.mcTotal * 100) + '%)' : ''}</p>
      ${sub.essayTotal ? `<p class="io-note">Có ${sub.essayTotal} câu tự luận — giáo viên sẽ chấm tay.</p>` : ''}
      ${sub.teacherScore ? `<p class="done-score">Điểm giáo viên chấm: <b>${esc(sub.teacherScore)}</b></p>` : ''}
      <button class="btn-gold" id="exBackBtn" style="margin-top:12px;">← Về danh sách bài</button>
    </div>`;
    $('exBackBtn').onclick = renderStudentExam;
  }

  // ===================== GẮN VÀO HỆ THỐNG TAB =====================
  document.querySelectorAll('.tab').forEach(t => {
    if (t.dataset.page === 'exam') t.addEventListener('click', renderStudentExam);
    else if (t.dataset.page === 'examEdit') t.addEventListener('click', renderTeacherExam);
    else t.addEventListener('click', stopExamTimer);   // rời tab khác -> dừng đồng hồ
  });
})();
