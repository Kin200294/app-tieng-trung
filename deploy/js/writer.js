/* ============================================================
   Học Chữ Hán - writer.js
   ============================================================ */

  // ===== Tập viết chữ Hán & Nét vẽ (HanziWriter) =====
  let currentWriteChar = '';
  let hanziWriterInstance = null;
  let writeTimeoutId = null;
  let lastWriteMistakes = 0;

  function openWriteModal(word) {
    // Lọc lấy các ký tự là chữ Hán thực sự
    const chars = [...word].filter(c => /\p{Unified_Ideograph}/u.test(c));
    if (chars.length === 0) return;

    const modal = $('writeModal');
    if (!modal) return;
    modal.classList.add('active');

    // Ẩn vùng nhận xét AI khi mở modal
    if ($('writeAiAnalysisArea')) $('writeAiAnalysisArea').style.display = 'none';
    if ($('writeAiExplanation')) $('writeAiExplanation').style.display = 'none';

    const targetLabel = $('writeTargetChar');
    targetLabel.innerHTML = '';

    if (chars.length > 1) {
      // Có nhiều chữ Hán -> vẽ tab lựa chọn
      const group = document.createElement('div');
      group.className = 'write-char-tabs';
      chars.forEach((c, idx) => {
        const tabBtn = document.createElement('button');
        tabBtn.className = 'write-char-tab' + (idx === 0 ? ' active' : '');
        tabBtn.textContent = c;
        tabBtn.onclick = () => {
          group.querySelectorAll('.write-char-tab').forEach(b => b.classList.remove('active'));
          tabBtn.classList.add('active');
          initWriter(c);
        };
        group.appendChild(tabBtn);
      });
      targetLabel.appendChild(group);
    } else {
      // Chỉ có 1 chữ Hán -> hiển thị chữ Hán cỡ to làm nhãn
      const lbl = document.createElement('div');
      lbl.style.fontSize = '2.2rem';
      lbl.style.fontWeight = '800';
      lbl.style.color = 'var(--gold-1)';
      lbl.style.fontFamily = '"Noto Serif SC", serif';
      lbl.textContent = chars[0];
      targetLabel.appendChild(lbl);
    }

    // Khởi tạo bảng vẽ với chữ Hán đầu tiên
    initWriter(chars[0]);
  }

  function cleanupWriter() {
    if (writeTimeoutId) {
      clearTimeout(writeTimeoutId);
      writeTimeoutId = null;
    }
    if (hanziWriterInstance) {
      try {
        if (typeof hanziWriterInstance.cancelQuiz === 'function') {
          hanziWriterInstance.cancelQuiz();
        }
      } catch (e) {}
      hanziWriterInstance = null;
    }
  }

  function initWriter(char) {
    currentWriteChar = char;

    cleanupWriter();

    // Ẩn vùng nhận xét AI khi khởi tạo chữ mới
    if ($('writeAiAnalysisArea')) $('writeAiAnalysisArea').style.display = 'none';
    if ($('writeAiExplanation')) $('writeAiExplanation').style.display = 'none';

    const container = $('writerContainer');
    const statusEl = $('writeStatus');
    if (!container || !statusEl) return;

    // Tái tạo lại thẻ target div để cô lập hoàn toàn HanziWriter cũ khỏi DOM
    container.innerHTML = '';
    const targetDiv = document.createElement('div');
    targetDiv.id = 'character-target-div';
    container.appendChild(targetDiv);

    statusEl.textContent = 'Đang tải nét vẽ...';
    statusEl.className = 'io-note';

    if (typeof HanziWriter === 'undefined') {
      statusEl.textContent = '⚠️ Lỗi: Không thể tải thư viện tập viết (Kiểm tra kết nối mạng).';
      statusEl.className = 'io-note error';
      return;
    }

    try {
      const isLight = document.body.classList.contains('light');
      hanziWriterInstance = HanziWriter.create(targetDiv, char, {
        width: 180,
        height: 180,
        padding: 10,
        showOutline: true,
        strokeColor: isLight ? '#7d1626' : '#f3d98b',
        outlineColor: isLight ? '#e6e6e6' : '#232834',
        drawingColor: isLight ? '#1f9d63' : '#3ed18a',
        strokeAnimationSpeed: 1.25,
        delayBetweenStrokes: 300
      });

      // Tự động vẽ mẫu 1 lần lúc bắt đầu
      writeTimeoutId = setTimeout(() => {
        if (!hanziWriterInstance) return;
        statusEl.textContent = 'Đang vẽ hướng dẫn...';
        hanziWriterInstance.animateCharacter({
          onComplete: () => {
            if (statusEl && statusEl.textContent === 'Đang vẽ hướng dẫn...') {
              startWritingQuiz();
            }
          }
        });
      }, 350);
    } catch (e) {
      statusEl.textContent = '⚠️ Lỗi khởi tạo bảng tập viết.';
      statusEl.className = 'io-note error';
      console.error(e);
    }
  }

  function startWritingQuiz() {
    if (!hanziWriterInstance) return;
    try {
      if (typeof hanziWriterInstance.cancelQuiz === 'function') {
        hanziWriterInstance.cancelQuiz();
      }
    } catch (e) {}
    
    // Ẩn vùng nhận xét AI khi bắt đầu viết thử lượt mới
    if ($('writeAiAnalysisArea')) $('writeAiAnalysisArea').style.display = 'none';
    if ($('writeAiExplanation')) $('writeAiExplanation').style.display = 'none';
    
    const statusEl = $('writeStatus');
    statusEl.textContent = 'Hãy viết nét tiếp theo...';
    statusEl.className = 'io-note';
    statusEl.style.color = '';
 
    hanziWriterInstance.quiz({
      onCorrectStroke: function(strokeData) {
        statusEl.textContent = '✓ Chính xác!';
        statusEl.className = 'io-note ok';
        statusEl.style.color = 'var(--green-1)';
      },
      onMistake: function(strokeData) {
        statusEl.textContent = '✗ Sai nét rồi, vẽ lại nhé!';
        statusEl.className = 'io-note error';
        statusEl.style.color = '#ff9d8e';
      },
      onComplete: function(summary) {
        lastWriteMistakes = summary.totalMistakes;
        if (summary.totalMistakes === 0) {
          statusEl.textContent = '🎉 Tuyệt vời! Viết hoàn hảo!';
          statusEl.className = 'io-note ok';
          statusEl.style.color = 'var(--green-1)';
        } else {
          statusEl.textContent = `🎉 Hoàn thành! (Sai: ${summary.totalMistakes} lần)`;
          statusEl.className = 'io-note warning';
          statusEl.style.color = 'var(--gold-1)';
        }

        // Hiển thị nút AI phân tích nét viết
        const aiArea = $('writeAiAnalysisArea');
        if (aiArea) {
          aiArea.style.display = 'block';
          const explanation = $('writeAiExplanation');
          if (explanation) explanation.style.display = 'none'; // Ẩn giải thích của lần viết trước
        }
      }
    });
  }

  // Gắn sự kiện điều khiển Modal tập viết
  if ($('btnWriteAnimate')) {
    $('btnWriteAnimate').onclick = () => {
      if (!hanziWriterInstance) return;
      const statusEl = $('writeStatus');
      statusEl.textContent = 'Đang vẽ hướng dẫn...';
      statusEl.className = 'io-note';
      statusEl.style.color = '';
      try {
        if (typeof hanziWriterInstance.cancelQuiz === 'function') {
          hanziWriterInstance.cancelQuiz();
        }
      } catch (e) {}
      hanziWriterInstance.animateCharacter({
        onComplete: () => {
          if (statusEl && statusEl.textContent === 'Đang vẽ hướng dẫn...') {
            startWritingQuiz();
          }
        }
      });
    };
  }

  if ($('btnWriteQuiz')) {
    $('btnWriteQuiz').onclick = () => {
      startWritingQuiz();
    };
  }

  if ($('btnWriteClear')) {
    $('btnWriteClear').onclick = () => {
      if (currentWriteChar) initWriter(currentWriteChar);
    };
  }

  if ($('btnWriteClose')) {
    $('btnWriteClose').onclick = () => {
      cleanupWriter();
      const modal = $('writeModal');
      if (modal) modal.classList.remove('active');
    };
  }

  // --- Gọi API Gemini để phân tích cấu trúc và nhận xét nét viết chữ Hán (có tự động chuyển model và key) ---
  async function callWriteAiAnalysis(char, mistakes, apiKey, model, triedModels = [], triedKeys = []) {
    const provider = typeof window.getAIProvider === 'function' ? window.getAIProvider() : 'gemini';
    
    if (provider === 'deepseek') {
      try {
        const currentModel = model || localStorage.getItem('hanzi-deepseek-model') || 'deepseek-chat';
        const currentKey = typeof window.getDeepSeekKey === 'function' ? window.getDeepSeekKey() : apiKey;

        const systemPrompt = `
You are a warm, encouraging Chinese teacher. The student is practicing writing Chinese characters.
Analyze their writing process for the target character and give them helpful advice in friendly Vietnamese.
The target character is: "${char}"
The student made ${mistakes} mistakes while writing this character.

Based on the character's structure and the number of mistakes:
1. Explain the components/radicals (bộ thủ) of the character (e.g. for "ni" 'Ni', it has bộ Nhân đứng '亻' on the left and '尔' on the right).
2. Give clear, actionable advice in Vietnamese on the stroke order (thứ tự nét) and stroke direction (hướng nét) to help them write correctly.
3. Keep the feedback concise (maximum 3 sentences) so it fits in the popup.
4. Encourage them.
5. You MUST respond in a strictly structured JSON format with a single field:
   - "analysis": Your feedback in Vietnamese.

Example of expected JSON format:
{
  "analysis": "Chữ 'Ni' gồm bộ Nhân đứng (亻) bên trái và chữ '尔' bên phải. Bạn hãy lưu ý viết bộ Nhân đứng trước (phẩy rồi sổ), sau đó viết chữ '尔' (phẩy, ngang móc, phẩy, cong móc và hai nét chấm). Hãy cố gắng nhớ quy tắc viết từ trái sang phải nhé!"
}
`;

        const prompt = `Target Chinese character: "${char}"\nNumber of stroke mistakes: ${mistakes}`;
        const url = `https://api.deepseek.com/chat/completions`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + currentKey
          },
          body: JSON.stringify({
            model: currentModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt }
            ],
            temperature: 0.4
          })
        });

        if (!response.ok) {
          const errInfo = await response.json().catch(() => ({}));
          const errMessage = errInfo.error?.message || `HTTP error ${response.status}`;
          throw new Error(errMessage);
        }

        const data = await response.json();
        const textOutput = data.choices[0].message.content;
        const parsed = JSON.parse(textOutput.trim());
        return parsed.analysis || 'Không có phản hồi từ AI.';
      } catch (err) {
        console.warn('DeepSeek phân tích viết chữ lỗi, chuyển sang Gemini dự phòng:', err);
        // Tự động chạy tiếp xuống khối code Gemini bên dưới
      }
    }
    
    if (provider === 'openrouter') {
      try {
        const OPENROUTER_MODELS = [
          { id: 'deepseek/deepseek-chat:free', name: 'DeepSeek V3 (Free - Khuyên dùng)' },
          { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (Free - Suy luận)' },
          { id: 'qwen/qwen-2-7b-instruct:free', name: 'Alibaba Qwen 2 7B (Free)' },
          { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Meta Llama 3.1 8B (Free)' },
          { id: 'google/gemma-2-9b-it:free', name: 'Google Gemma 2 9B (Free)' }
        ];
        const currentModel = model || localStorage.getItem('hanzi-openrouter-model') || 'deepseek/deepseek-chat:free';
        const currentKey = typeof window.getOpenRouterKey === 'function' ? window.getOpenRouterKey() : apiKey;

        const systemPrompt = `
You are a warm, encouraging Chinese teacher. The student is practicing writing Chinese characters.
Analyze their writing process for the target character and give them helpful advice in friendly Vietnamese.
The target character is: "${char}"
The student made ${mistakes} mistakes while writing this character.

Based on the character's structure and the number of mistakes:
1. Explain the components/radicals (bộ thủ) of the character (e.g. for "ni" 'Ni', it has bộ Nhân đứng '亻' on the left and '尔' on the right).
2. Give clear, actionable advice in Vietnamese on the stroke order (thứ tự nét) and stroke direction (hướng nét) to help them write correctly.
3. Keep the feedback concise (maximum 3 sentences) so it fits in the popup.
4. Encourage them.
5. You MUST respond in a strictly structured JSON format with a single field:
   - "analysis": Your feedback in Vietnamese.

Example of expected JSON format:
{
  "analysis": "Chữ 'Ni' gồm bộ Nhân đứng (亻) bên trái và chữ '尔' bên phải. Bạn hãy lưu ý viết bộ Nhân đứng trước (phẩy rồi sổ), sau đó viết chữ '尔' (phẩy, ngang móc, phẩy, cong móc và hai nét chấm). Hãy cố gắng nhớ quy tắc viết từ trái sang phải nhé!"
}
`;

        const prompt = `Target Chinese character: "${char}"\nNumber of stroke mistakes: ${mistakes}`;
        const url = `https://openrouter.ai/api/v1/chat/completions`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + currentKey,
            'HTTP-Referer': 'https://github.com/Kin200294/app-tieng-trung',
            'X-Title': 'Hoc Chu Han App'
          },
          body: JSON.stringify({
            model: currentModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt }
            ],
            temperature: 0.4
          })
        });

        if (!response.ok) {
          const errInfo = await response.json().catch(() => ({}));
          const errMessage = errInfo.error?.message || `HTTP error ${response.status}`;
          
          triedModels.push(currentModel);
          const nextModel = OPENROUTER_MODELS.find(m => !triedModels.includes(m.id));
          if (nextModel) {
            localStorage.setItem('hanzi-openrouter-model', nextModel.id);
            await new Promise(r => setTimeout(r, 1000));
            return callWriteAiAnalysis(char, mistakes, currentKey, nextModel.id, triedModels, triedKeys);
          }
          throw new Error(errMessage);
        }

        const data = await response.json();
        const textOutput = data.choices[0].message.content;
        const parsed = JSON.parse(textOutput.trim());
        return parsed.analysis || 'Không có phản hồi từ AI.';
      } catch (err) {
        console.warn('OpenRouter phân tích viết chữ lỗi, chuyển sang Gemini dự phòng:', err);
        // Tự động chạy tiếp xuống khối code Gemini bên dưới
      }
    }

    const AVAILABLE_MODELS = [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
      { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite' }
    ];

    // Sử dụng Gemini key & model thực tế nếu rơi vào kịch bản fallback từ OpenRouter/DeepSeek
    const currentModel = (provider === 'gemini')
      ? (model || localStorage.getItem('hanzi-gemini-model') || 'gemini-2.5-flash-lite')
      : (localStorage.getItem('hanzi-gemini-model') || 'gemini-2.5-flash-lite');
    
    const currentKey = (provider === 'gemini')
      ? (apiKey || window.getGeminiKey())
      : window.getGeminiKey();

    const systemPrompt = `
You are a warm, encouraging Chinese teacher. The student is practicing writing Chinese characters.
Analyze their writing process for the target character and give them helpful advice in friendly Vietnamese.
The target character is: "${char}"
The student made ${mistakes} mistakes while writing this character.

Based on the character's structure and the number of mistakes:
1. Explain the components/radicals (bộ thủ) of the character (e.g. for "ni" 'Ni', it has bộ Nhân đứng '亻' on the left and '尔' on the right).
2. Give clear, actionable advice in Vietnamese on the stroke order (thứ tự nét) and stroke direction (hướng nét) to help them write correctly.
3. Keep the feedback concise (maximum 3 sentences) so it fits in the popup.
4. Encourage them.
5. You MUST respond in a strictly structured JSON format with a single field:
   - "analysis": Your feedback in Vietnamese.

Example of expected JSON format:
{
  "analysis": "Chữ 'Ni' gồm bộ Nhân đứng (亻) bên trái và chữ '尔' bên phải. Bạn hãy lưu ý viết bộ Nhân đứng trước (phẩy rồi sổ), sau đó viết chữ '尔' (phẩy, ngang móc, phẩy, cong móc và hai nét chấm). Hãy cố gắng nhớ quy tắc viết từ trái sang phải nhé!"
}
`;

    const prompt = `Target Chinese character: "${char}"\nNumber of stroke mistakes: ${mistakes}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent`;

    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.4
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': currentKey
      },
      body: JSON.stringify(requestBody)
    });

    // Xử lý lỗi rate-limit (429) hoặc quá tải hệ thống (503/500...)
    let isTemporaryError = false;
    let isKeyError = false;
    let errMessage = '';
    let errStatus = '';

    if (response.status === 400 || response.status === 403 || response.status === 429) {
      isKeyError = true;
    }
    if (response.status === 429 || response.status === 503 || response.status === 504 || response.status === 408) {
      isTemporaryError = true;
    }

    if (!response.ok) {
      const errInfo = await response.json().catch(() => ({}));
      errMessage = errInfo.error?.message || `HTTP error ${response.status}`;
      errStatus = errInfo.error?.status || '';
      
      const checkStr = (errMessage + ' ' + errStatus).toLowerCase();
      if (
        checkStr.includes('api key') ||
        checkStr.includes('api_key') ||
        checkStr.includes('key not found') ||
        checkStr.includes('quota') || 
        checkStr.includes('limit') || 
        checkStr.includes('resource_exhausted')
      ) {
        isKeyError = true;
      }
      if (
        checkStr.includes('high demand') || 
        checkStr.includes('unavailable') ||
        checkStr.includes('temporarily')
      ) {
        isTemporaryError = true;
      }

      // Xoay vòng API key trước nếu gặp lỗi liên quan đến API key hoặc quota
      if (isKeyError) {
        if (!triedKeys.includes(currentKey)) {
          triedKeys.push(currentKey);
        }
        const nextKey = window.rotateGeminiKey(currentKey);
        if (!triedKeys.includes(nextKey)) {
          await new Promise(r => setTimeout(r, 1000));
          return callWriteAiAnalysis(char, mistakes, nextKey, model, triedModels, triedKeys);
        }
      }

      // Nếu đã thử hết các keys hoặc không phải lỗi key, thử xoay vòng model
      if (isTemporaryError || isKeyError) {
        triedModels.push(currentModel);
        
        // Tìm model khác chưa thử
        const nextModel = AVAILABLE_MODELS.find(m => !triedModels.includes(m.id));
        
        if (nextModel) {
          // Ghi đè cấu hình đã chọn
          localStorage.setItem('hanzi-gemini-model', nextModel.id);
          
          await new Promise(r => setTimeout(r, 1000));
          return callWriteAiAnalysis(char, mistakes, apiKey, nextModel.id, triedModels, triedKeys);
        }
        
        throw new Error('Tất cả API Key và Model AI đều đã hết lượt miễn phí hoặc đang quá tải. Vui lòng thử lại sau.');
      }
      
      throw new Error(errMessage);
    }

    const data = await response.json();
    try {
      const textOutput = data.candidates[0].content.parts[0].text;
      const parsed = JSON.parse(textOutput.trim());
      return parsed.analysis || 'Không có phản hồi từ AI.';
    } catch (e) {
      console.warn('Lỗi phân tích JSON từ AI phân tích lỗi viết:', e);
      const textOutput = data.candidates[0].content.parts[0].text;
      const jsonMatch = textOutput.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0].trim()).analysis;
      }
      return textOutput.trim();
    }
  }

  if ($('btnWriteAiExplain')) {
    $('btnWriteAiExplain').onclick = async () => {
      const explainArea = $('writeAiExplanation');
      if (!explainArea) return;

      explainArea.style.display = 'block';
      explainArea.innerHTML = '<span style="color:var(--muted);">🔄 AI đang phân tích cấu trúc chữ và lỗi sai...</span>';

      const apiKey = window.getGeminiKey();
      const selectedModel = localStorage.getItem('hanzi-gemini-model') || 'gemini-2.5-flash';

      try {
        const analysis = await callWriteAiAnalysis(currentWriteChar, lastWriteMistakes, apiKey, selectedModel);
        explainArea.textContent = analysis;
      } catch (err) {
        console.error(err);
        let errMsg = err.message || 'Hệ thống bận.';
        if (err.message.includes('API key') || err.message.includes('API_KEY_INVALID')) {
          errMsg = 'API Key không hợp lệ hoặc chưa được lưu.';
        } else if (err.message.includes('quota') || err.message.includes('429') || err.message.includes('503') || err.message.includes('demand')) {
          errMsg = 'Đã hết lượt sử dụng miễn phí hoặc AI đang bận. Vui lòng thử lại sau.';
        }
        explainArea.textContent = '❌ Lỗi phân tích: ' + errMsg;
      }
    };
  }
