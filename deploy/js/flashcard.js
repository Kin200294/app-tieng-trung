/* ============================================================
   Học Chữ Hán - flashcard.js
   ============================================================ */

  if (flagFilterBtn) flagFilterBtn.addEventListener('click', () => {
    flagOnly = !flagOnly;
    flagFilterBtn.classList.toggle('active', flagOnly);
    renderGrid();
  });

  // ===== Event Delegation cho lưới Flashcard =====
  // 1 listener duy nhất trên #grid thay cho hàng trăm listener riêng lẻ
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    const idx = Number(card.dataset.idx);
    const it = items[idx];
    if (!it) return;

    // Nút loa — nghe phát âm
    if (e.target.closest('.spk-btn')) {
      speak(it.h);
      return;
    }
    // Nút lưu ý — đánh dấu/bỏ đánh dấu
    if (e.target.closest('.flag-btn')) {
      it.flag = !it.flag;
      save();
      card.querySelector('.flag-btn').classList.toggle('on', it.flag);
      card.classList.toggle('flagged', it.flag);
      flagFilterBtn.textContent = `⚑ Chữ lưu ý (${items.filter(x => x.flag).length})`;
      if (flagOnly && !it.flag) renderGrid();
      return;
    }
    // Nút luyện đọc phát âm
    if (e.target.closest('.read-btn')) {
      if (window.HanziUI && typeof window.HanziUI.openPronounceModal === 'function') {
        window.HanziUI.openPronounceModal(it.h, it.p, it.m, (success) => {
          scheduleItem(it, success);
          save();
          renderGrid();
        });
      } else {
        showAlert('Tính năng Luyện đọc chưa sẵn sàng.');
      }
      return;
    }
    // Nút tập viết chữ
    if (e.target.closest('.write-btn')) {
      openWriteModal(it.h);
      return;
    }
    // Click vào thẻ → lật
    card.classList.toggle('flipped');
    if (card.classList.contains('flipped')) {
      speak(it.h);
      popPinyin(card.querySelector('.back-pinyin'));
    }
  });
  // ===== Trang Học: lưới thẻ lật (Lazy Loading) =====

  // Tạo DOM cho 1 thẻ flashcard (chỉ tạo DOM, không gán event — dùng delegation trên #grid)
  function buildFlashcard(it, idx, pos) {
    const card = document.createElement('div');
    card.className = 'card' + (it.flag ? ' flagged' : '');
    card.dataset.idx = idx;   // để delegation tra cứu items[idx]
    // Chỉ đặt animation delay cho chunk đầu tiên (thẻ trong viewport)
    if (pos < GRID_CHUNK) {
      card.style.animationDelay = Math.min(pos * 0.05, 0.6) + 's';
    }
    const inner = document.createElement('div');
    inner.className = 'card-inner';

    const front = document.createElement('div');
    front.className = 'face face-front';
    const back = document.createElement('div');
    back.className = 'face face-back';

    if (frontMode === 'meaning') {
      front.classList.add('mode-meaning');
      front.textContent = it.m || '(chưa có nghĩa)';
      back.innerHTML = `<div class="back-hanzi">${escapeHtml(it.h)}</div>` +
                       (it.p ? `<div class="back-pinyin">${colorPinyin(it.p)}</div>` : '');
    } else {
      const len = [...it.h].length;
      front.classList.add('len-' + Math.min(len, 4));
      front.textContent = it.h;
      if (it.p || it.m) {
        back.innerHTML = (it.p ? `<div class="back-pinyin">${colorPinyin(it.p)}</div>` : '') +
                         (it.m ? `<div class="back-meaning">${escapeHtml(it.m)}</div>` : '') +
                         (it.ex ? `<div class="back-ex">${escapeHtml(it.ex)}</div>` : '');
      } else {
        back.innerHTML = '<div class="back-empty">Chưa có pinyin / nghĩa</div>';
      }
    }
    inner.append(front, back);
    card.appendChild(inner);

    // Nút loa (chỉ tạo DOM, logic xử lý ở delegation)
    const spk = document.createElement('button');
    spk.className = 'spk-btn';
    spk.textContent = '🔊';
    spk.title = 'Nghe phát âm';
    card.appendChild(spk);

    // Nút lưu ý
    const flagBtn = document.createElement('button');
    flagBtn.className = 'flag-btn' + (it.flag ? ' on' : '');
    flagBtn.textContent = '⚑';
    flagBtn.title = 'Đánh dấu lưu ý (đọc sai)';
    card.appendChild(flagBtn);

    // Nút tập viết & luyện đọc — chỉ hiện khi có ký tự Hán thực sự
    const chars = [...it.h].filter(c => /\p{Unified_Ideograph}/u.test(c));
    if (chars.length > 0) {
      const readBtn = document.createElement('button');
      readBtn.className = 'read-btn';
      readBtn.textContent = '🎙️';
      readBtn.title = 'Luyện đọc phát âm';
      back.appendChild(readBtn);

      const writeBtn = document.createElement('button');
      writeBtn.className = 'write-btn';
      writeBtn.textContent = '✍️';
      writeBtn.title = 'Tập viết chữ';
      back.appendChild(writeBtn);
    }

    return card;
  }

  // Render từng đợt thẻ vào grid (lazy chunk)
  function renderGridChunk() {
    const chunk = gridView.slice(gridRendered, gridRendered + GRID_CHUNK);
    if (chunk.length === 0) return;

    const frag = document.createDocumentFragment();
    chunk.forEach((idx, i) => {
      const it = items[idx];
      if (!it) return;
      const card = buildFlashcard(it, idx, gridRendered + i);
      frag.appendChild(card);
    });
    grid.appendChild(frag);
    gridRendered += chunk.length;

    // Còn thẻ chưa render → đặt sentinel để tự động tải thêm khi cuộn
    if (gridRendered < gridView.length) {
      const sentinel = document.createElement('div');
      sentinel.className = 'grid-sentinel';
      sentinel.style.height = '1px';
      grid.appendChild(sentinel);

      gridObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          gridObserver.disconnect();
          gridObserver = null;
          sentinel.remove();
          renderGridChunk(); // render chunk tiếp
        }
      }, { rootMargin: '300px' }); // preload trước 300px

      gridObserver.observe(sentinel);
    }
  }

  function renderGrid() {
    // Dọn dẹp observer cũ
    if (gridObserver) { gridObserver.disconnect(); gridObserver = null; }

    grid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    grid.classList.toggle('dense', columns >= 7);
    grid.innerHTML = '';

    const flaggedCount = items.filter(x => x.flag).length;
    flagFilterBtn.textContent = `⚑ Chữ lưu ý (${flaggedCount})`;
    countEl.textContent = `${items.length} chữ`;
    updateStudyBanner();

    // Vẽ biểu đồ tiến độ học tập (SRS Analytics)
    const srsEl = $('srsAnalytics');
    if (srsEl) {
      if (items.length === 0) {
        srsEl.style.display = 'none';
      } else {
        const lFilter = lessonFilter.value;
        const pool = lFilter === 'all' ? items : items.filter(it => it.l === lFilter);
        const total = pool.length;

        if (total === 0) {
          srsEl.style.display = 'none';
        } else {
          srsEl.style.display = 'block';
          const mastered = pool.filter(it => it.level >= 4).length;
          const learning = pool.filter(it => it.level > 0 && it.level < 4).length;
          const unlearned = pool.filter(it => it.level === 0).length;

          const masteredPct = total > 0 ? Math.round(mastered / total * 100) : 0;
          const learningPct = total > 0 ? Math.round(learning / total * 100) : 0;
          const unlearnedPct = total > 0 ? (100 - masteredPct - learningPct) : 0; // Đảm bảo tổng phần trăm là 100%

          const scopeText = lFilter === 'all' ? 'kho từ vựng' : 'buổi học này';

          srsEl.innerHTML = `
            <div class="srs-analytics">
              <div class="srs-header">
                <span class="srs-title">📊 Tiến độ học tập</span>
                <span class="srs-summary">Bạn đã làm chủ được <strong>${masteredPct}%</strong> ${scopeText}! 🏆</span>
              </div>
              <div class="srs-bar">
                <div class="srs-segment srs-mastered" style="width: ${masteredPct}%;" title="Đã thuộc: ${masteredPct}%"></div>
                <div class="srs-segment srs-learning" style="width: ${learningPct}%;" title="Đang ôn: ${learningPct}%"></div>
                <div class="srs-segment srs-new" style="width: ${unlearnedPct}%;" title="Chưa học: ${unlearnedPct}%"></div>
              </div>
              <div class="srs-legend">
                <div class="srs-legend-item">
                  <span class="srs-dot srs-dot-mastered"></span>
                  <span class="srs-legend-text">Đã thuộc: <strong>${mastered}</strong>/${total} chữ (${masteredPct}%)</span>
                </div>
                <div class="srs-legend-item">
                  <span class="srs-dot srs-dot-learning"></span>
                  <span class="srs-legend-text">Đang ôn: <strong>${learning}</strong>/${total} chữ (${learningPct}%)</span>
                </div>
                <div class="srs-legend-item">
                  <span class="srs-dot srs-dot-new"></span>
                  <span class="srs-legend-text">Chưa học: <strong>${unlearned}</strong>/${total} chữ (${unlearnedPct}%)</span>
                </div>
              </div>
            </div>
          `;
        }
      }
    }

    if (items.length === 0) {
      grid.innerHTML = '<div class="empty-msg">Chưa có chữ nào — sang trang "Thêm chữ" để nhập 👆</div>';
      return;
    }

    // Lọc theo "chữ lưu ý" và buổi học
    let view = order;
    const lFilter = lessonFilter.value;
    if (lFilter !== 'all') {
      view = view.filter(idx => items[idx] && items[idx].l === lFilter);
    }
    if (flagOnly) {
      view = view.filter(idx => items[idx] && items[idx].flag);
      if (view.length === 0) {
        grid.innerHTML = '<div class="empty-msg">Chưa có chữ nào được đánh dấu 🚩 (hoặc phù hợp với buổi học hiện tại). Lật thẻ và bấm 🚩 để đánh dấu chữ đọc sai.</div>';
        return;
      }
    }

    // Lazy loading: lưu view và render chunk đầu tiên
    gridView = view;
    gridRendered = 0;
    renderGridChunk();
  }

  colSelect.addEventListener('change', () => { columns = parseInt(colSelect.value, 10); renderGrid(); });
  frontSelect.addEventListener('change', () => { frontMode = frontSelect.value; renderGrid(); });
  lessonFilter.addEventListener('change', () => { renderGrid(); });

  shuffleBtn.addEventListener('click', () => {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    renderGrid();
  });
  flipAllBtn.addEventListener('click', () => {
    grid.querySelectorAll('.card').forEach(c => c.classList.remove('flipped'));
  });
