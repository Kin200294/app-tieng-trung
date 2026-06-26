/* ============================================================
   Học Chữ Hán - passage.js
   ============================================================ */

  // ===== Bài khóa: Giáo viên soạn =====
  let paEditIndex = -1;
  function setPaEditMode(on) {
    if ($('paAddBtn')) $('paAddBtn').textContent = on ? '💾 Lưu thay đổi' : '+ Thêm bài khóa';
  }
  // Đổi giao diện form theo kiểu (build / qa / free)
  function syncPaType() {
    const t = $('paType') ? $('paType').value : 'build';
    if ($('paQField')) $('paQField').style.display = (t === 'qa' || t === 'free') ? '' : 'none';
    if ($('paSLabel')) {
      if (t === 'free') $('paSLabel').textContent = 'Gợi ý trả lời (không bắt buộc)';
      else $('paSLabel').textContent = (t === 'qa') ? 'Câu TRẢ LỜI — các TỪ cách nhau bằng dấu cách' : 'Câu chữ Hán — các TỪ cách nhau bằng dấu cách';
    }
  }
  if ($('paType')) $('paType').addEventListener('change', syncPaType);

  function clearPaForm() {
    if ($('paS')) $('paS').value = '';
    if ($('paM')) $('paM').value = '';
    if ($('paQ')) $('paQ').value = '';
  }
  let paGroupCollapsed = { build: true, qa: true, free: true };
  function renderPassageEdit() {
    const el = $('paList');
    if ($('paCount')) $('paCount').textContent = passages.length;
    if (!el) return;
    if (!passages.length) { el.innerHTML = '<p class="empty-msg" style="padding:16px 0;">Chưa có bài khóa nào.</p>'; return; }
    el.innerHTML = '';

    const groups = {
      'build': { title: '🧩 Ghép câu', items: [] },
      'qa': { title: '❓ Trả lời câu hỏi', items: [] },
      'free': { title: '💬 Vấn đáp (Trả lời tự do)', items: [] }
    };
    passages.forEach((p, i) => {
      const t = p.type || 'build';
      if (!groups[t]) groups[t] = { title: 'Loại khác', items: [] };
      groups[t].items.push({ p, i });
    });

    for (const [key, group] of Object.entries(groups)) {
      if (group.items.length === 0) continue;

      const header = document.createElement('div');
      header.className = 'pa-group-header';
      const isCollapsed = paGroupCollapsed[key];
      header.innerHTML = `<span>${group.title} (${group.items.length})</span> <span style="font-size: 0.9em;">${isCollapsed ? '▼ Hiện' : '▲ Ẩn'}</span>`;
      header.onclick = () => {
        paGroupCollapsed[key] = !paGroupCollapsed[key];
        renderPassageEdit();
      };
      el.appendChild(header);

      if (!isCollapsed) {
        const listContainer = document.createElement('div');
        listContainer.style.cssText = 'padding-left: 8px; margin-top: 8px; border-left: 2px solid var(--gold-3); margin-left: 8px;';
        group.items.forEach(({ p, i }) => {
          const isQA = p.type === 'qa';
          const isFree = p.type === 'free';
          const row = document.createElement('div');
          row.className = 'pa-item' + (i === paEditIndex ? ' editing' : '');
          row.style.marginTop = '8px';
          let head = escapeHtml(p.s);
          if (isQA) head = '❓ ' + escapeHtml(p.q || '') + ' → ' + escapeHtml(p.s);
          if (isFree) head = '💬 ' + escapeHtml(p.q || '') + (p.s ? (' (Gợi ý: ' + escapeHtml(p.s) + ')') : '');
          row.innerHTML = `<div class="pa-info"><div class="pa-s">${head}</div><div class="pa-m">${escapeHtml(p.m || '')}</div></div>`;
          const acts = document.createElement('div');
          acts.style.cssText = 'display:flex; gap:6px;';
          const edit = document.createElement('button');
          edit.className = 'btn-cancel'; edit.textContent = 'Sửa';
          edit.style.cssText = 'padding:7px 12px; font-size:.85rem; border-radius:9px;';
          edit.onclick = () => {
            paEditIndex = i;
            if ($('paType')) $('paType').value = p.type || 'build';
            syncPaType();
            $('paS').value = p.s; $('paM').value = p.m || ''; if ($('paQ')) $('paQ').value = p.q || '';
            setPaEditMode(true);
            renderPassageEdit();
            $('paType').scrollIntoView({ behavior: 'smooth', block: 'center' });
          };
          const del = document.createElement('button');
          del.className = 'btn-danger'; del.textContent = 'Xoá';
          del.style.cssText = 'padding:7px 12px; font-size:.85rem; border-radius:9px;';
          del.onclick = () => {
            showConfirm('Xoá bài khóa này?', () => {
              passages.splice(i, 1);
              if (paEditIndex === i) { paEditIndex = -1; clearPaForm(); setPaEditMode(false); }
              savePassages(); renderPassageEdit();
            });
          };
          acts.append(edit, del);
          if (isFree) {
            const viewAns = document.createElement('button');
            viewAns.className = 'btn-gold'; viewAns.textContent = 'Xem đáp án';
            viewAns.style.cssText = 'padding:7px 12px; font-size:.85rem; border-radius:9px; margin-left: 6px;';
            
            const answersContainer = document.createElement('div');
            answersContainer.className = 'pa-answers-container';
            answersContainer.style.display = 'none';
            
            let answersLoaded = false;

            viewAns.onclick = () => {
              const isHidden = answersContainer.style.display === 'none';
              if (isHidden) {
                answersContainer.style.display = 'block';
                viewAns.textContent = 'Ẩn đáp án';
                
                if (!answersLoaded) {
                  answersContainer.innerHTML = '<p style="margin:0; opacity:0.8;">Đang tải dữ liệu...</p>';
                  if (typeof db !== 'undefined' && db) {
                    db.collection('submissions').where('q', '==', p.q).get().then(snap => {
                      let answers = [];
                      snap.forEach(doc => answers.push({ id: doc.id, ...doc.data() }));
                      answers.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
                      
                      if (answers.length === 0) {
                        answersContainer.innerHTML = '<p style="margin:0; opacity:0.8; font-style:italic;">Chưa có học sinh nào nộp đáp án cho câu hỏi này.</p>';
                      } else {
                        answersContainer.innerHTML = ''; // clear loading
                        const listDiv = document.createElement('div');
                        listDiv.style.cssText = 'display:flex; flex-direction:column; gap:12px;';
                        
                        answers.forEach(a => {
                          let dateStr = 'Mới đây';
                          if (a.timestamp) {
                             const d = a.timestamp.toDate();
                             dateStr = d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
                          }
                          
                          const ansDiv = document.createElement('div');
                          ansDiv.className = 'pa-answer-item';
                          
                          ansDiv.innerHTML = `
                            <div class="pa-answer-head">
                              <div style="display:flex; flex-direction:column; gap:4px; flex:1;">
                                <strong style="color:var(--gold-1); font-size: 1.1rem; letter-spacing:0.02em;">👤 ${escapeHtml(a.studentName)}</strong>
                                <span style="font-size:0.8rem; opacity:0.8;">🕒 ${dateStr}</span>
                              </div>
                              <div class="ans-meta" style="margin-left: 8px;"></div>
                            </div>
                            <div class="pa-answer-text">${escapeHtml(a.answer)}</div>
                          `;
                          
                          const delBtn = document.createElement('button');
                          delBtn.innerHTML = '🗑️ Xoá';
                          delBtn.style.cssText = 'background:rgba(255,50,50,0.1); border:none; color:#ff4d4f; border-radius:6px; cursor:pointer; font-size:0.85rem; padding:6px 12px; transition:0.2s; font-weight:bold; white-space:nowrap;';
                          delBtn.onmouseover = () => delBtn.style.background = 'rgba(255,50,50,0.2)';
                          delBtn.onmouseout = () => delBtn.style.background = 'rgba(255,50,50,0.1)';
                          delBtn.onclick = () => {
                             if (confirm('Xoá câu trả lời này?')) {
                                db.collection('submissions').doc(a.id).delete().then(() => {
                                   ansDiv.remove();
                                   if (listDiv.children.length === 0) {
                                      answersContainer.innerHTML = '<p style="margin:0; color:#777; font-style:italic;">Chưa có học sinh nào nộp đáp án cho câu hỏi này.</p>';
                                   }
                                }).catch(err => alert('Lỗi: ' + err));
                             }
                          };
                          ansDiv.querySelector('.ans-meta').appendChild(delBtn);
                          listDiv.appendChild(ansDiv);
                        });
                        answersContainer.appendChild(listDiv);
                        answersLoaded = true;
                      }
                    }).catch(err => {
                      console.error(err);
                      answersContainer.innerHTML = '<p style="margin:0; color:red;">Lỗi tải dữ liệu. Vui lòng kiểm tra kết nối mạng.</p>';
                    });
                  } else {
                     answersContainer.innerHTML = '<p style="margin:0; color:red;">Cơ sở dữ liệu chưa sẵn sàng.</p>';
                  }
                }
              } else {
                answersContainer.style.display = 'none';
                viewAns.textContent = 'Xem đáp án';
              }
            };
            acts.append(viewAns);
            row.appendChild(acts);
            
            const wrapper = document.createElement('div');
            wrapper.appendChild(row);
            wrapper.appendChild(answersContainer);
            listContainer.appendChild(wrapper);
          } else {
            row.appendChild(acts);
            listContainer.appendChild(row);
          }
        });
        el.appendChild(listContainer);
      }
    }
  }
  if ($('paAddBtn')) $('paAddBtn').onclick = () => {
    const type = $('paType') ? $('paType').value : 'build';
    const s = $('paS').value.trim().replace(/\s+/g, ' ');
    const m = $('paM').value.trim();
    const q = $('paQ') ? $('paQ').value.trim() : '';
    if (type !== 'free' && !s) { $('paS').focus(); return; }
    if ((type === 'qa' || type === 'free') && !q) { $('paQ').focus(); return; }
    const obj = { type: type, s: s, m: m, q: q };
    if (paEditIndex >= 0 && passages[paEditIndex]) {
      passages[paEditIndex] = obj;   // lưu sửa
      paEditIndex = -1; setPaEditMode(false);
    } else {
      passages.push(obj);            // thêm mới
    }
    savePassages(); renderPassageEdit();
    clearPaForm();
    $('paS').focus();
  };

  // ===== Bài khóa: Học sinh làm (ghép câu) =====
  let paQueue = [], paPos = 0, paLast = -1, paQueueKey = '', paCurrent = -1, paIsCorrect = false;
  function paMode() { return $('paModeFilter') ? $('paModeFilter').value : 'all'; }
  function paFilteredIdx() {
    const mode = paMode();
    return passages.map((_, i) => i).filter(i => mode === 'all' || (passages[i].type || 'build') === mode);
  }
  if ($('paModeFilter')) $('paModeFilter').addEventListener('change', () => { paQueueKey = ''; renderPassageExercise(); });
  // Gọi khi mở trang / bấm "Câu khác": đi lần lượt qua các câu (theo loại đã chọn), không lặp
  function renderPassageExercise() {
    const stage = $('passageStage');
    const pool = paFilteredIdx();
    if (!pool.length) {
      if (stage) stage.innerHTML = '<p class="empty-msg">Chưa có bài khóa loại này. Giáo viên hãy vào "Soạn bài khóa" để thêm.</p>';
      return;
    }
    const key = paMode() + ':' + passages.length;
    if (paQueueKey !== key) {
      paQueue = pool.slice();
      shuffleArr(paQueue);
      paQueueKey = key;
      paPos = 0;
      paIsCorrect = false;
    } else {
      if (paCurrent !== -1 && !paIsCorrect && paPos <= paQueue.length) {
        paQueue.push(paCurrent); // push back to the end of queue if skipped/wrong
      }
    }

    if (paPos >= paQueue.length) {
      if (stage) stage.innerHTML = `
        <div style="text-align:center; padding: 40px 20px;">
          <h3 style="color:var(--gold-1); font-size:1.8rem; margin-bottom:15px;">🎉 Chúc mừng!</h3>
          <p style="color:var(--muted); margin-bottom:25px;">Bạn đã hoàn thành tất cả bài khóa ở mục này.</p>
          <button class="btn-gold" id="restartPassageBtn">🔄 Ôn lại từ đầu</button>
        </div>
      `;
      if ($('restartPassageBtn')) {
        $('restartPassageBtn').onclick = () => {
          paQueueKey = ''; // reset queue
          renderPassageExercise();
        };
      }
      return;
    }

    paIsCorrect = false;
    paCurrent = paQueue[paPos++];
    paLast = paCurrent;
    showPassage(paCurrent);
  }
  // Hiển thị 1 câu cụ thể (dùng cho "Làm lại" — xáo lại đúng câu hiện tại)
  function showPassage(idx) {
    const stage = $('passageStage');
    if (!stage || !passages[idx]) return;
    const p = passages[idx];
    const words = p.s.split(/\s+/).filter(Boolean);
    const shuffled = words.map(w => w).sort(() => Math.random() - 0.5);

    let promptHtml;
    if (p.type === 'qa') {
      promptHtml = '<div class="pa-label">Trả lời câu hỏi</div><div class="pa-q">' + escapeHtml(p.q || '') + '</div>'
        + (p.m ? '<div class="pa-hint" style="margin-top:6px;">(' + escapeHtml(p.m) + ')</div>' : '');
    } else if (p.type === 'free') {
      promptHtml = '<div class="pa-label">Vấn đáp (Trả lời tự do)</div><div class="pa-q">' + escapeHtml(p.q || '') + '</div>'
        + (p.m ? '<div class="pa-hint" style="margin-top:6px;">(' + escapeHtml(p.m) + ')</div>' : '');
    } else if (p.m) {
      promptHtml = '<div class="pa-label">Ghép câu có nghĩa</div><div class="pa-mean">' + escapeHtml(p.m) + '</div>';
    } else {
      promptHtml = '<div class="pa-label">Sắp xếp các từ thành câu đúng</div>';
    }

    if (p.type === 'free') {
      stage.innerHTML = `
        <div class="pa-prompt">${promptHtml}</div>
        <input type="text" id="paFreeInput" placeholder="Nhập câu trả lời..." style="width:100%; text-align:center; border:2px solid var(--gold-3); border-radius:12px; padding:16px 12px; margin: 16px 0; font-family:'StoryScript', 'Noto Serif SC', 'Songti SC', 'STSong', 'SimSun', Georgia, serif; font-size:clamp(1.2rem, 5vw, 1.8rem); letter-spacing:0.05em; outline:none; background:var(--panel, rgba(255,255,255,0.7)); color:var(--text, #333); box-sizing:border-box; box-shadow: inset 0 2px 6px rgba(0,0,0,0.05); transition: border-color 0.3s, box-shadow 0.3s;" onfocus="this.style.borderColor='var(--gold-1)'; this.style.boxShadow='0 0 0 3px rgba(212,175,55,0.2), inset 0 2px 6px rgba(0,0,0,0.05)';" onblur="this.style.borderColor='var(--gold-3)'; this.style.boxShadow='inset 0 2px 6px rgba(0,0,0,0.05)';">
        <div class="quiz-btns" style="margin-top:16px;">
          <button class="btn-clear" id="paResetBtn" style="display:none;">↺ Làm lại</button>
          <button class="btn-gold" id="paCheckBtn">✓ Kiểm tra</button>
          <button class="btn-clear" id="newPassageBtn">🎲 Câu khác</button>
        </div>
        <div class="pa-feedback" id="paFb"></div>`;
        
      const fb = $('paFb');
      if ($('paResetBtn')) {
        $('paResetBtn').onclick = () => {
          $('paFreeInput').value = '';
          fb.innerHTML = '';
          fb.className = 'pa-feedback';
          $('paResetBtn').style.display = 'none';
        };
      }
      $('paCheckBtn').onclick = () => {
        const val = $('paFreeInput').value.trim();
        if (!val) { fb.textContent = 'Hãy nhập câu trả lời của bạn trước nhé.'; fb.className = 'pa-feedback no'; return; }
        
        // Lưu đáp án lên Firestore (dùng bảng submissions để tận dụng quyền ghi hiện có)
        if (typeof db !== 'undefined' && db) {
          let studentName = (typeof profile !== 'undefined' && profile && profile.name) || localStorage.getItem('hanzi-player-name') || 'Học sinh ẩn danh';
          
          let h = 0;
          let str = studentName + '_' + p.q;
          for(let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
          let docId = 'pa_' + (h >>> 0).toString(16);
          
          db.collection('submissions').doc(docId).set({
            q: p.q,
            answer: val,
            studentName: studentName,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          }, {merge: true}).catch(err => console.log('Lỗi lưu đáp án:', err));
        }

        fb.innerHTML = '✓ Đã ghi nhận câu trả lời! 🎉';
        fb.className = 'pa-feedback ok';
        paIsCorrect = true;
        if (p.s) {
          fb.innerHTML += '<div class="pa-correct" style="margin-top:12px; font-weight:normal; font-size:1rem; color:#555;"><strong>Gợi ý của giáo viên:</strong><br/>' + escapeHtml(p.s) + '</div>';
          
          // Tạo nút Luyện nói câu gợi ý
          const readBtn = document.createElement('button');
          readBtn.className = 'pa-read-btn';
          readBtn.innerHTML = '🎙️ Luyện nói câu này';
          readBtn.style.marginTop = '10px';
          readBtn.onclick = () => {
            if (window.HanziUI && typeof window.HanziUI.openPronounceModal === 'function') {
              const sentenceClean = p.s.replace(/\s+/g, '');
              let pinyin = '';
              if (window.pinyinPro) pinyin = window.pinyinPro.pinyin(sentenceClean);
              window.HanziUI.openPronounceModal(sentenceClean, pinyin, p.m || '');
            }
          };
          fb.appendChild(readBtn);
        }
        $('paFreeInput').value = ''; // Reset the input field
        if (typeof addPoints === 'function') addPoints(2);
      };
    } else {
      stage.innerHTML = `
        <div class="pa-prompt">${promptHtml}</div>
        <div class="pa-hint">Bấm từng từ để thêm vào câu; bấm từ trong câu để bỏ ra.</div>
        <div class="pa-answer" id="paAnswer"></div>
        <div class="pa-bank" id="paBank"></div>
        <div class="quiz-btns" style="margin-top:16px;">
          <button class="btn-clear" id="paResetBtn" style="display:none;">↺ Làm lại</button>
          <button class="btn-gold" id="paCheckBtn">✓ Kiểm tra</button>
          <button class="btn-clear" id="newPassageBtn">🎲 Câu khác</button>
        </div>
        <div class="pa-feedback" id="paFb"></div>`;

      const bank = $('paBank'), answer = $('paAnswer'), fb = $('paFb');
      function mkWord(w, inAnswer) {
        const b = document.createElement('button');
        b.className = 'pa-word'; b.textContent = w;
        b.onclick = () => {
          fb.textContent = ''; fb.className = 'pa-feedback';
          if (inAnswer) { b.remove(); addToBank(w); }
          else { b.remove(); answer.appendChild(mkWord(w, true)); }
        };
        return b;
      }
      function addToBank(w) { bank.appendChild(mkWord(w, false)); }
      shuffled.forEach(w => addToBank(w));

      $('paResetBtn').onclick = () => {
        $('paResetBtn').style.display = 'none';
        showPassage(idx);
      };
      $('paCheckBtn').onclick = () => {
        const got = Array.from(answer.querySelectorAll('.pa-word')).map(x => x.textContent);
        if (got.length === 0) { fb.textContent = 'Hãy chọn các từ để ghép câu.'; fb.className = 'pa-feedback no'; return; }
        if (got.join(' ') === words.join(' ')) {
          fb.innerHTML = '✓ Chính xác! 🎉';
          
          // Nút Luyện nói câu vừa ghép
          const readBtn = document.createElement('button');
          readBtn.className = 'pa-read-btn';
          readBtn.innerHTML = '🎙️ Luyện nói câu này';
          readBtn.style.marginTop = '10px';
          readBtn.onclick = () => {
            if (window.HanziUI && typeof window.HanziUI.openPronounceModal === 'function') {
              const sentenceClean = words.join('');
              let pinyin = '';
              if (window.pinyinPro) pinyin = window.pinyinPro.pinyin(sentenceClean);
              window.HanziUI.openPronounceModal(sentenceClean, pinyin, p.m || '');
            }
          };
          fb.appendChild(document.createElement('br'));
          fb.appendChild(readBtn);

          fb.className = 'pa-feedback ok';
          paIsCorrect = true;
          $('paResetBtn').style.display = 'none';
          if (typeof speak === 'function') speak(words.join(''));
          if (typeof addPoints === 'function') addPoints(2);
        } else {
          fb.innerHTML = '✗ Chưa đúng, thử lại nhé.<div class="pa-correct">Đáp án: ' + escapeHtml(words.join(' ')) + '</div>';
          fb.className = 'pa-feedback no';
          $('paResetBtn').style.display = 'inline-block';
        }
      };
    }
    // Bind Câu khác
    if ($('newPassageBtn')) {
      $('newPassageBtn').onclick = renderPassageExercise;
    }
  }
