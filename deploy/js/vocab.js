/* ============================================================
   Học Chữ Hán - vocab.js
   ============================================================ */

  function renderList() {
    listEl.innerHTML = '';
    const head = document.querySelector('.list-head');
    if (items.length === 0) {
      if (head) head.style.display = 'none';
      listEl.innerHTML = '<p class="empty-msg" style="padding:20px 0;">Chưa có chữ nào.</p>';
      return;
    }
    if (head) head.style.display = '';

    const q = searchQuery.trim().toLowerCase();
    const qNoTones = removeTones(q);
    const targetLesson = manageLessonFilter ? manageLessonFilter.value : 'all';
    
    // Gom các chữ theo lọc/tìm kiếm rồi sắp xếp theo BÀI HỌC (giữ chỉ số gốc để Sửa/Xoá)
    const entries = [];
    items.forEach((it, i) => {
      if (targetLesson !== 'all' && it.l !== targetLesson) return;
      const combined = (it.h + ' ' + it.p + ' ' + it.m).toLowerCase();
      if (q && !(combined.includes(q) || removeTones(combined).includes(qNoTones))) return;
      entries.push({ it, i });
    });
    // Sắp theo tên bài (số đúng thứ tự); chữ chưa có bài xếp cuối
    entries.sort((a, b) =>
      (a.it.l || '').localeCompare(b.it.l || '', 'vi', { numeric: true })
    );

    if (entries.length === 0) {
      listEl.innerHTML = '<p class="empty-msg" style="padding:20px 0;">Không tìm thấy chữ nào khớp “' + escapeHtml(searchQuery) + '”.</p>';
      return;
    }

    let renderedCount = 0;
    function renderNextChunk() {
      const frag = document.createDocumentFragment();
      const chunk = entries.slice(renderedCount, renderedCount + 100);
      chunk.forEach(e => frag.appendChild(buildRow(e.it, e.i)));
      listEl.appendChild(frag);
      renderedCount += chunk.length;

      if (renderedCount < entries.length) {
        const btnContainer = document.createElement('div');
        btnContainer.style.textAlign = 'center';
        btnContainer.style.padding = '20px 0';
        
        const btn = document.createElement('button');
        btn.className = 'btn-gold';
        btn.textContent = `Tải thêm chữ (${renderedCount} / ${entries.length})`;
        btn.onclick = () => { btnContainer.remove(); renderNextChunk(); };
        
        btnContainer.appendChild(btn);
        listEl.appendChild(btnContainer);
      }
    }
    
    renderNextChunk();
  }

  function addLessonPrompt() {
    showPromptModal('Nhập tên bài học mới:', '', (name) => {
      if (!name || !name.trim()) return;
      const finalName = formatLesson(name.trim());
      if (allLessons().includes(finalName)) { showAlert(`Bài học "${finalName}" đã tồn tại.`); return; }
      extraLessons.push(finalName);
      saveLessons(); updateLessonFilter(); renderLessonsPage();
      showAlert(`Đã tạo bài học "${finalName}"`);
    });
  }
  if ($('addLessonBtn')) $('addLessonBtn').onclick = addLessonPrompt;

  function renderLessonsPage() {
    const listEl = $('lessonsList');
    if (!listEl) return;
    listEl.innerHTML = '';

    const lessonCounts = {};
    items.forEach(it => {
      const l = it.l;
      if (l) lessonCounts[l] = (lessonCounts[l] || 0) + 1;
    });

    const lessons = allLessons();
    if (lessons.length === 0) {
      const msg = document.createElement('p');
      msg.className = 'empty-msg';
      msg.style.padding = '20px 0';
      msg.textContent = 'Chưa có bài học nào. Bấm “+ Thêm bài học” để tạo.';
      listEl.appendChild(msg);
      return;
    }

    lessons.forEach(l => {
      const count = lessonCounts[l] || 0;
      const row = document.createElement('div');
      row.className = 'lesson-mg-row';
      
      const info = document.createElement('div');
      info.className = 'lesson-mg-info';
      info.innerHTML = `<div class="lesson-mg-name">${escapeHtml(l)}</div><div class="lesson-mg-count">${count} chữ</div>`;
      
      const actions = document.createElement('div');
      actions.className = 'lesson-mg-actions';
      
      const isLocked = lockedLessons.includes(l);
      const btnLock = document.createElement('button');
      btnLock.className = 'btn-cancel';
      btnLock.textContent = isLocked ? '🔒 Đã khoá' : '🔓 Khoá bài';
      if (isLocked) btnLock.style.background = '#e74c3c';
      if (isLocked) btnLock.style.color = '#fff';
      btnLock.onclick = () => {
        if (isLocked) {
          lockedLessons = lockedLessons.filter(x => x !== l);
          showAlert(`Đã mở khoá bài học "${l}"`);
        } else {
          lockedLessons.push(l);
          showAlert(`Đã khoá bài học "${l}"`);
        }
        saveLockedLessons();
        renderLessonsPage();
      };
      
      const btnView = document.createElement('button');
      btnView.className = 'btn-gold';
      btnView.textContent = 'Xem từ';
      btnView.onclick = () => {
        if (manageLessonFilter) manageLessonFilter.value = l;
        searchInput.value = '';
        searchQuery = '';
        renderList();
        document.querySelector('.tab[data-page="add"]').click();
      };
      
      const btnEdit = document.createElement('button');
      btnEdit.className = 'btn-cancel';
      btnEdit.textContent = 'Đổi tên';
      btnEdit.onclick = () => {
        showPromptModal('Nhập tên mới cho bài học:', l, (newName) => {
          if (newName && newName.trim() && newName.trim() !== l) {
            const finalName = formatLesson(newName.trim());
            items.forEach(it => { if (it.l === l) it.l = finalName; });
            extraLessons = extraLessons.map(x => x === l ? finalName : x);
            save(); saveLessons(); updateLessonFilter(); renderLessonsPage(); renderList();
            showAlert(`Đã đổi tên bài học thành "${finalName}"`);
          }
        });
      };
      
      const btnDel = document.createElement('button');
      btnDel.className = 'btn-danger';
      btnDel.textContent = 'Xoá';
      btnDel.onclick = () => {
        showConfirm(`Bạn có chắc chắn muốn xoá bài học "${l}" không?\n(Các chữ thuộc bài này sẽ không bị xoá, chỉ mất nhãn bài học)`, () => {
          items.forEach(it => { if (it.l === l) it.l = ''; });
          extraLessons = extraLessons.filter(x => x !== l);
          save(); saveLessons(); updateLessonFilter(); renderLessonsPage(); renderList();
          showAlert(`Đã xoá bài học "${l}"`);
        });
      };
      
      actions.append(btnLock, btnView, btnEdit, btnDel);
      row.append(info, actions);
      listEl.appendChild(row);
    });
  }

  function buildRow(it, i) {
    const row = document.createElement('div');
    row.className = 'list-item';
    row.style.animationDelay = Math.min(i * 0.03, 0.4) + 's';

    if (i === editingIndex) {
      row.classList.add('editing');
      const efH = mkInput('ef-input ef-hanzi', it.h, 'Chữ Hán');
      const efP = mkInput('ef-input ef-pinyin', it.p, 'Pinyin');
      const efM = mkInput('ef-input ef-meaning', it.m, 'Nghĩa');
      const efEx = mkInput('ef-input ef-example', it.ex || '', 'Câu ví dụ (không bắt buộc)');
      // Dropdown chọn/dời bài học
      const efL = document.createElement('select');
      efL.className = 'ef-input ef-lesson';
      const lessonOptions = () => '<option value="">— Chưa gán bài —</option>' +
        allLessons().map(l => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join('') +
        '<option value="__new__">+ Tạo bài mới…</option>';
      efL.innerHTML = lessonOptions();
      efL.value = (it.l && allLessons().includes(it.l)) ? it.l : '';
      efL.addEventListener('change', () => {
        if (efL.value !== '__new__') return;
        showPromptModal('Nhập tên bài học mới:', '', (name) => {
          const finalName = formatLesson((name || '').trim());
          if (!finalName) { efL.value = it.l || ''; return; }
          if (!allLessons().includes(finalName)) { extraLessons.push(finalName); saveLessons(); updateLessonFilter(); }
          efL.innerHTML = lessonOptions();
          efL.value = finalName;
        });
        efL.value = it.l || '';
      });

      const saveEdit = () => {
        const h = efH.value.trim();
        if (!h) { efH.focus(); return; }
        const lesson = efL.value === '__new__' ? (it.l || '') : efL.value;
        Object.assign(items[i], { h: h, p: efP.value.trim(), m: efM.value.trim(), ex: efEx.value.trim(), l: lesson });
        editingIndex = -1;
        searchInput.value = '';
        searchQuery = '';
        save(); renderList(); updateLessonFilter();
      };
      efM.addEventListener('keydown', e => { if (e.key === 'Enter') saveEdit(); });
      const actions = document.createElement('div');
      actions.className = 'li-actions';
      actions.appendChild(mkBtn('li-save', 'Lưu', saveEdit));
      actions.appendChild(mkBtn('li-cancel', 'Huỷ', () => { editingIndex = -1; renderList(); }));
      efEx.style.gridColumn = '1 / -1';   // câu ví dụ chiếm trọn 1 hàng dưới
      row.append(efH, efP, efM, efL, actions, efEx);
      setTimeout(() => efH.focus(), 0);
    } else {
      const cH = document.createElement('div');
      cH.className = 'li-hanzi';
      cH.innerHTML = (it.known ? '<span class="known-dot" title="Đã thuộc">✓</span> ' : '') + escapeHtml(it.h);

      const cP = document.createElement('div');
      cP.className = 'li-pinyin';
      cP.innerHTML = colorPinyin(it.p) || '<span style="color:#888">—</span>';

      const cM = document.createElement('div');
      cM.className = 'li-meaning';
      cM.innerHTML = escapeHtml(it.m) || '<span style="color:#777">(chưa có nghĩa)</span>';

      const cL = document.createElement('div');
      cL.className = 'li-lesson';
      cL.textContent = it.l || '';

      const actions = document.createElement('div');
      actions.className = 'li-actions';
      actions.appendChild(mkBtn('li-edit', 'Sửa', () => { editingIndex = i; renderList(); }));
      actions.appendChild(mkBtn('li-del', 'Xoá', () => {
        showConfirm(`Bạn có muốn xoá chữ "${it.h}" không?`, () => {
          items.splice(i, 1);
          if (editingIndex === i) editingIndex = -1;
          rebuildOrder(); save(); renderList(); updateLessonFilter();
        });
      }));
      row.append(cH, cP, cM, cL, actions);
    }
    return row;
  }
  function addItem() {
    const h = inHanzi.value.trim();
    if (!h) { inHanzi.focus(); return; }
    if (items.some(it => it.h === h)) {
      showAlert('Chữ này đã có vui lòng kiểm tra lại');
      return;
    }
    const lesson = (inLessonSelect && inLessonSelect.value !== '__new__') ? inLessonSelect.value : '';
    items.push({ h: h, p: inPinyin.value.trim(), m: inMeaning.value.trim(), ex: inExample ? inExample.value.trim() : '', l: lesson, known: false });
    rebuildOrder(); save();
    const keepLesson = inLessonSelect ? inLessonSelect.value : '';   // giữ bài đang chọn để thêm nhanh nhiều chữ
    renderList(); updateLessonFilter();
    if (inLessonSelect) inLessonSelect.value = (keepLesson && keepLesson !== '__new__') ? keepLesson : '';
    inHanzi.value = inPinyin.value = inMeaning.value = '';
    if (inExample) inExample.value = '';
    inHanzi.focus();
  }
  // Chọn "+ Tạo bài mới…" trong dropdown -> hỏi tên rồi chọn luôn
  if (inLessonSelect) {
    inLessonSelect.addEventListener('change', () => {
      if (inLessonSelect.value !== '__new__') return;
      showPromptModal('Nhập tên bài học mới:', '', (name) => {
        const finalName = formatLesson((name || '').trim());
        if (!finalName) { inLessonSelect.value = ''; return; }
        if (!allLessons().includes(finalName)) { extraLessons.push(finalName); saveLessons(); }
        updateLessonFilter();
        inLessonSelect.value = finalName;
      });
      inLessonSelect.value = '';   // tạm về rỗng trong khi chờ nhập
    });
  }
  addBtn.addEventListener('click', addItem);
  inHanzi.addEventListener('keydown', e => { if (e.key === 'Enter') inPinyin.focus(); });
  inHanzi.addEventListener('input', () => {
    if (window.pinyinPro && inHanzi.value.trim()) {
      inPinyin.value = window.pinyinPro.pinyin(inHanzi.value.trim());
    } else if (!inHanzi.value.trim()) {
      inPinyin.value = '';
    }
  });
  inPinyin.addEventListener('keydown', e => { if (e.key === 'Enter') inMeaning.focus(); });
  inMeaning.addEventListener('keydown', e => { if (e.key === 'Enter') addItem(); });

  clearBtn.addEventListener('click', () => {
    if (items.length === 0) return;
    showConfirm('Bạn có chắc chắn muốn xoá toàn bộ danh sách chữ không?', () => {
      items = [];
      rebuildOrder(); save(); renderList(); updateLessonFilter();
    });
  });

  searchInput.addEventListener('input', () => { searchQuery = searchInput.value; renderList(); });
  if (manageLessonFilter) manageLessonFilter.addEventListener('change', renderList);

  // ===== Nhập từ CSV/Excel =====
  function parseCsvLine(text) {
    // Excel tiếng Việt hay lưu bằng dấu ';' -> tự nhận dấu phân cách phổ biến nhất ngoài ngoặc kép
    const delim = (text.split(';').length > text.split(',').length) ? ';' : ',';
    let ret = [], p = '', inQuote = false;
    for (let i = 0; i < text.length; i++) {
      let c = text[i];
      if (c === '"' && text[i+1] === '"') { p += '"'; i++; }
      else if (c === '"') { inQuote = !inQuote; }
      else if (c === delim && !inQuote) { ret.push(p.trim()); p = ''; }
      else { p += c; }
    }
    ret.push(p.trim());
    return ret;
  }
  
  if (importCsvBtnWrapper) {
    importCsvBtnWrapper.addEventListener('click', () => importCsvFile.click());
    importCsvFile.addEventListener('change', () => {
      const file = importCsvFile.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        let added = 0, dupCount = 0;
        
        if (lines.length > 0) {
          const firstLine = lines[0].toLowerCase();
          if ((firstLine.includes('chữ') && firstLine.includes('nghĩa')) || firstLine.includes('pinyin')) {
            lines.shift();
          }
        }

        lines.forEach(line => {
          const parts = line.includes('\t') ? line.split('\t').map(s => s.trim()) : parseCsvLine(line);
          const h = parts[0];
          if (!h) return;
          if (items.some(it => it.h === h)) {
            dupCount++;
            return;
          }
          items.push({ h: h, p: parts[1] || '', m: parts[2] || '', l: formatLesson(parts[3] || ''), ex: parts[4] || '', known: false });
          added++;
        });
        
        if (added) { rebuildOrder(); save(); renderList(); updateLessonFilter(); }
        importCsvFile.value = '';
        let msg = added ? ('Đã thêm thành công ' + added + ' chữ từ file Excel.') : 'Không có chữ mới nào được thêm.';
        if (dupCount > 0) msg += '\nĐã bỏ qua ' + dupCount + ' chữ bị trùng (đã tồn tại).';
        showAlert(msg);
      };
      reader.readAsText(file);
    });
  }

  if (downloadTemplateBtn) {
    downloadTemplateBtn.addEventListener('click', () => {
      const csvContent = '\uFEFFChữ,Pinyin,Nghĩa,Buổi học,Câu ví dụ\n你好,nǐ hǎo,xin chào,Bài 1,你好吗？\n谢谢,xièxie,cảm ơn,Bài 1,\n';
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mau_nhap_lieu.csv';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // =====================
  // EXCEL & IO
  // =====================
  // ===== Xuất / Nhập file =====
  exportBtn.addEventListener('click', () => {
    if (items.length === 0) { showAlert('Chưa có dữ liệu để xuất.'); return; }
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`; // DD-MM-YYYY
    const a = document.createElement('a');
    a.href = url;
    a.download = `hoc-chu-han-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
  importBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', () => {
    const file = importFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw 0;
        const incoming = data.map(normalizeItem).filter(x => x.h);
        if (!incoming.length) { showAlert('File không có dữ liệu hợp lệ.'); return; }
        
        showModal(`Đã tìm thấy ${incoming.length} chữ.\nBạn muốn thay thế danh sách hiện tại hay gộp thêm vào?`, [
          { text: 'Hủy bỏ', className: 'btn-cancel' },
          { text: 'Gộp thêm', className: 'btn-gold', onClick: () => {
              let added = 0;
              incoming.forEach(it => {
                if (!items.some(exist => exist.h === it.h)) {
                  items.push(it);
                  added++;
                }
              });
              const skipped = incoming.length - added;
              finishImport(`Đã gộp thêm ${added} chữ mới.${skipped > 0 ? ` (Bỏ qua ${skipped} chữ đã có)` : ''}\nTổng cộng danh sách: ${items.length} chữ.`);
          }},
          { text: 'Thay thế', className: 'btn-danger', onClick: () => {
              items = incoming;
              finishImport(`Đã thay thế toàn bộ!\nTổng cộng danh sách: ${items.length} chữ.`);
          }}
        ]);

        function finishImport(msg) {
          rebuildOrder(); save(); renderList(); updateLessonFilter();
          showAlert(msg);
        }
      } catch (e) { showAlert('Không đọc được file. Hãy chọn đúng file .json đã xuất từ app này.'); }
      importFile.value = '';
    };
    reader.readAsText(file);
  });
