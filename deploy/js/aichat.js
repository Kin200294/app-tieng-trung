/* ============================================================
   Logic Phòng trò chuyện AI và Luyện đọc phát âm (aichat.js)
   ============================================================ */

(function () {
  const $ = id => document.getElementById(id);
  const esc = s => (s == null ? '' : String(s)).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // --- Hằng số Storage ---
  const API_KEY_KEY = 'hanzi-gemini-api-key';
  const HISTORY_KEY = 'hanzi-aichat-history-v1';
  const MODEL_KEY = 'hanzi-gemini-model';
  
  const PROVIDER_KEY = 'hanzi-ai-provider';
  const OPENROUTER_MODEL_KEY = 'hanzi-openrouter-model';
  const OPENROUTER_KEY_KEY = 'hanzi-openrouter-api-key';
  
  const DEEPSEEK_MODEL_KEY = 'hanzi-deepseek-model';
  const DEEPSEEK_KEY_KEY = 'hanzi-deepseek-api-key';

  // --- Danh sách model miễn phí ---
  const AVAILABLE_MODELS = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', rpm: 15 },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', rpm: 30 },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', rpm: 30 }
  ];

  const OPENROUTER_MODELS = [
    { id: 'qwen/qwen-2-7b-instruct:free', name: 'Alibaba Qwen 2 7B (Free)' },
    { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Meta Llama 3.1 8B (Free)' },
    { id: 'google/gemma-2-9b-it:free', name: 'Google Gemma 2 9B (Free)' }
  ];

  const DEEPSEEK_MODELS = [
    { id: 'deepseek-chat', name: 'DeepSeek Chat (V3)' }
  ];

  // --- Trạng thái ---
  let aiProvider = window.getAIProvider();
  let geminiKey = window.getGeminiKey();
  let openrouterKey = window.getOpenRouterKey();
  let deepseekKey = window.getDeepSeekKey();

  function getSelectedModelKey() {
    if (aiProvider === 'openrouter') return OPENROUTER_MODEL_KEY;
    if (aiProvider === 'deepseek') return DEEPSEEK_MODEL_KEY;
    return MODEL_KEY;
  }

  function getDefaultModel() {
    if (aiProvider === 'openrouter') return 'qwen/qwen-2-7b-instruct:free';
    if (aiProvider === 'deepseek') return 'deepseek-chat';
    return 'gemini-2.5-flash-lite';
  }

  let selectedModel = localStorage.getItem(getSelectedModelKey()) || getDefaultModel();
  let chatHistory = [];
  let lastProfileString = ''; // Theo dõi chuỗi JSON profile trong localStorage để phát hiện đổi tài khoản
  let speechRec = null;
  let isRecActive = false;
  let isThinking = false;
  
  // Trạng thái cho Modal Luyện đọc (phát âm từ/câu ngắn)
  let pronounceRec = null;
  let isPronounceRecActive = false;
  let currentPronounceTarget = '';
  let currentPronouncePinyin = '';
  let currentPronounceMeaning = '';
  let currentPronounceCallback = null; // Gọi sau khi hoàn tất nói trong modal

  // Biến kiểm soát nâng cao cho Luyện đọc (khai báo ở IIFE scope để closePronounceModal truy cập được)
  let pronounceGotResult = false;
  let pronounceRetryCount = 0;
  const PRONOUNCE_MAX_RETRY = 3;
  let pronounceWantActive = false;
  let pronounceAccumulatedText = '';
  let pronounceHasInterim = false;

  // Các biến kiểm soát thời gian im lặng để dừng mic tự động (nhanh phản hồi)
  let speechSilenceTimer = null;
  let speechLastTime = 0;
  let speechLastText = '';

  let pronounceSilenceTimer = null;
  let pronounceLastTime = 0;
  let pronounceLastText = '';

  // --- Các hàm quản lý Lịch sử chat theo tài khoản ---
  function getCurrentHistoryKey() {
    try {
      const profileJson = localStorage.getItem('hanzi-profile');
      if (profileJson) {
        const profile = JSON.parse(profileJson);
        if (profile && profile.id) {
          return `hanzi-aichat-history-${profile.id}`;
        }
      }
    } catch (e) {
      console.error('Lỗi khi đọc profile để tạo key lịch sử chat:', e);
    }
    return HISTORY_KEY;
  }

  function loadChatHistory() {
    const key = getCurrentHistoryKey();
    try {
      chatHistory = JSON.parse(localStorage.getItem(key)) || [];
    } catch (e) {
      chatHistory = [];
    }
  }

  function saveChatHistory() {
    const key = getCurrentHistoryKey();
    try {
      localStorage.setItem(key, JSON.stringify(chatHistory));
    } catch (e) {
      console.error('Lỗi khi lưu lịch sử chat:', e);
    }
  }

  function clearChatHistory() {
    const key = getCurrentHistoryKey();
    chatHistory = [];
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error('Lỗi khi xoá lịch sử chat:', e);
    }
  }

  function checkUserSession() {
    const profileJson = localStorage.getItem('hanzi-profile') || '';
    if (profileJson !== lastProfileString) {
      lastProfileString = profileJson;
      loadChatHistory();
      renderChatMessages();
    }
  }

  // Khởi tạo trạng thái ban đầu
  lastProfileString = localStorage.getItem('hanzi-profile') || '';
  loadChatHistory();

  // Định kỳ tự động đồng bộ lịch sử chat nếu người dùng đổi tài khoản học sinh (giải quyết bất đồng bộ Firestore)
  setInterval(checkUserSession, 500);

  // --- Chỉ thị hệ thống (System Prompt) cho AI Giáo viên ---
  const SYSTEM_INSTRUCTIONS = `
You are a friendly Chinese teacher and conversational partner named "Tiểu Hoa" (小华) helping a Vietnamese student practice speaking Chinese.
Respond to the user's message in natural, conversational Mandarin Chinese.

Rules:
1. Keep your response short and concise (usually 1 or 2 sentences), suitable for HSK 1 to HSK 4 learners.
2. Be encouraging, warm, and conversational.
3. You MUST respond in a strictly structured JSON format. The JSON must contain exactly three fields:
   - "hanzi": Your response in simplified Chinese characters.
   - "pinyin": The pinyin phonetic spelling of your response with tones (include spaces between words/syllables).
   - "vietnamese": The natural Vietnamese translation of your response.

Example of expected JSON format:
{
  "hanzi": "你好！很高兴认识你。你今天怎么样？",
  "pinyin": "nǐ hǎo! hěn gāoxìng rènshí nǐ. nǐ jīntiān zěnmeyàng?",
  "vietnamese": "Chào bạn! Rất vui được gặp bạn. Hôm nay bạn thế nào?"
}

Return ONLY the raw JSON string. Do not wrap it in markdown code blocks (\`\`\`json ... \`\`\`), do not include backticks, and do not add any explanation or other text.
`;

  // --- Khởi tạo khi DOM sẵn sàng ---
  window.addEventListener('load', () => {
    initChatPage();
    initSpeechRecognition();
    initPronounceModalEvents();
  });

  // Lắng nghe sự kiện click toàn trang để phát hiện đổi tài khoản (đặc biệt khi nhấn Đóng trên modal)
  document.addEventListener('click', () => {
    const chatPage = $('page-aiChat');
    if (chatPage && chatPage.classList.contains('active')) {
      checkUserSession();
    }
  });

  // --- Đăng ký sự kiện chuyển Tab ---
  const chatTab = document.querySelector('.tab[data-page="aiChat"]');
  if (chatTab) {
    chatTab.addEventListener('click', () => {
      // Kiểm tra đồng bộ tài khoản người dùng trước khi hiển thị
      checkUserSession();
      // Tự động cuộn xuống cuối khi vào tab chat
      setTimeout(scrollToBottom, 100);
      // Hiển thị lịch sử chat
      renderChatMessages();
    });
  }

  // --- Khởi tạo trang trò chuyện ---
  function initChatPage() {
    if (!$('page-aiChat')) return;

    function updateProviderUI() {
      const instructions = $('aiKeyInstructions');
      const keyInput = $('geminiApiKeyInput');
      const modelSelect = $('geminiModelSelect');
      const configTitle = $('aichatConfigTitle');

      if (aiProvider === 'openrouter') {
        if (configTitle) configTitle.textContent = '🔑 Cài đặt OpenRouter (Free)';
        if (instructions) {
          instructions.innerHTML = 'Để kết nối AI, bạn có thể sử dụng mã API Key OpenRouter mặc định hoặc lấy mã cá nhân tại <a href="https://openrouter.ai/" target="_blank" style="color: var(--gold-1); text-decoration: underline;">OpenRouter.ai</a> rồi dán vào bên dưới:';
        }
        if (keyInput) {
          keyInput.value = window.getOpenRouterKey();
        }
        if (modelSelect) {
          modelSelect.innerHTML = `
            <option value="qwen/qwen-2-7b-instruct:free" style="background:#1a1a2e; color:#e0e0e0;">🤖 Alibaba Qwen 2 7B (Free - Khuyên dùng)</option>
            <option value="meta-llama/llama-3.1-8b-instruct:free" style="background:#1a1a2e; color:#e0e0e0;">⚡ Meta Llama 3.1 8B (Free)</option>
            <option value="google/gemma-2-9b-it:free" style="background:#1a1a2e; color:#e0e0e0;">🪶 Google Gemma 2 9B (Free)</option>
          `;
          selectedModel = localStorage.getItem(OPENROUTER_MODEL_KEY) || 'qwen/qwen-2-7b-instruct:free';
          modelSelect.value = selectedModel;
        }
      } else if (aiProvider === 'deepseek') {
        if (configTitle) configTitle.textContent = '🔑 Cài đặt DeepSeek (Trực tiếp)';
        if (instructions) {
          instructions.innerHTML = 'Để kết nối AI, bạn có thể sử dụng mã API Key DeepSeek mặc định hoặc lấy mã cá nhân tại <a href="https://platform.deepseek.com/" target="_blank" style="color: var(--gold-1); text-decoration: underline;">platform.deepseek.com</a> rồi dán vào bên dưới:';
        }
        if (keyInput) {
          keyInput.value = window.getDeepSeekKey();
        }
        if (modelSelect) {
          modelSelect.innerHTML = `
            <option value="deepseek-chat" style="background:#1a1a2e; color:#e0e0e0;">🤖 DeepSeek Chat (V3 - Khuyên dùng)</option>
          `;
          selectedModel = localStorage.getItem(DEEPSEEK_MODEL_KEY) || 'deepseek-chat';
          modelSelect.value = selectedModel;
        }
      } else {
        if (configTitle) configTitle.textContent = '🔑 Cài đặt Google Gemini (Miễn phí)';
        if (instructions) {
          instructions.innerHTML = 'Để trò chuyện cùng AI, bạn có thể dùng khóa mặc định hoặc lấy mã trong 30 giây bằng cách bấm vào <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color: var(--gold-1); text-decoration: underline;">Google AI Studio</a> rồi dán vào bên dưới:';
        }
        if (keyInput) {
          keyInput.value = window.getGeminiKey();
        }
        if (modelSelect) {
          modelSelect.innerHTML = `
            <option value="gemini-2.5-flash-lite" style="background:#1a1a2e; color:#e0e0e0;">🪶 Gemini 2.5 Flash Lite (30 lượt/phút - Khuyên dùng)</option>
            <option value="gemini-2.5-flash" style="background:#1a1a2e; color:#e0e0e0;">⚡ Gemini 2.5 Flash (15 lượt/phút)</option>
            <option value="gemini-2.0-flash-lite" style="background:#1a1a2e; color:#e0e0e0;">💡 Gemini 2.0 Flash Lite (30 lượt/phút)</option>
          `;
          selectedModel = localStorage.getItem(MODEL_KEY) || 'gemini-2.5-flash-lite';
          modelSelect.value = selectedModel;
        }
      }
    }

    // Thiết lập giá trị ban đầu cho cổng kết nối
    if ($('aiProviderSelect')) {
      $('aiProviderSelect').value = aiProvider;
      $('aiProviderSelect').onchange = () => {
        aiProvider = $('aiProviderSelect').value;
        localStorage.setItem(PROVIDER_KEY, aiProvider);
        updateProviderUI();
        let providerLabel = 'Google Gemini';
        if (aiProvider === 'openrouter') providerLabel = 'OpenRouter';
        else if (aiProvider === 'deepseek') providerLabel = 'DeepSeek';
        updateStatus(`Đã chuyển cổng kết nối: ${providerLabel}`);
      };
    }

    // Chạy đồng bộ UI lúc khởi động
    updateProviderUI();

    // Lắng nghe sự kiện đổi Model trực tiếp
    if ($('geminiModelSelect')) {
      $('geminiModelSelect').onchange = () => {
        selectedModel = $('geminiModelSelect').value;
        const currentModelKey = getSelectedModelKey();
        localStorage.setItem(currentModelKey, selectedModel);
        
        let modelName = selectedModel;
        if (aiProvider === 'openrouter') {
          const mInfo = OPENROUTER_MODELS.find(m => m.id === selectedModel);
          if (mInfo) modelName = mInfo.name;
        } else if (aiProvider === 'deepseek') {
          const mInfo = DEEPSEEK_MODELS.find(m => m.id === selectedModel);
          if (mInfo) modelName = mInfo.name;
        } else {
          const mInfo = AVAILABLE_MODELS.find(m => m.id === selectedModel);
          if (mInfo) modelName = mInfo.name;
        }
        updateStatus(`Đã chọn: ${modelName}`);
      };
    }

    // Toggle bảng API Key
    if ($('btnToggleConfig')) {
      $('btnToggleConfig').onclick = () => {
        const body = $('aichatConfigBody');
        const btn = $('btnToggleConfig');
        if (body.style.display === 'none') {
          body.style.display = 'flex';
          btn.textContent = '▲';
        } else {
          body.style.display = 'none';
          btn.textContent = '▼';
        }
      };
    }

    // Lưu API Key + Model
    if ($('btnSaveApiKey')) {
      $('btnSaveApiKey').onclick = () => {
        let val = $('geminiApiKeyInput').value.trim();
        if (aiProvider === 'openrouter') {
          if (!val) {
            val = window.getOpenRouterKey();
            $('geminiApiKeyInput').value = val;
          }
          openrouterKey = val;
          localStorage.setItem(OPENROUTER_KEY_KEY, val);
          if ($('geminiModelSelect')) {
            selectedModel = $('geminiModelSelect').value;
            localStorage.setItem(OPENROUTER_MODEL_KEY, selectedModel);
          }
        } else if (aiProvider === 'deepseek') {
          if (!val) {
            val = window.getDeepSeekKey();
            $('geminiApiKeyInput').value = val;
          }
          deepseekKey = val;
          localStorage.setItem(DEEPSEEK_KEY_KEY, val);
          if ($('geminiModelSelect')) {
            selectedModel = $('geminiModelSelect').value;
            localStorage.setItem(DEEPSEEK_MODEL_KEY, selectedModel);
          }
        } else {
          if (!val) {
            val = window.getGeminiKey();
            $('geminiApiKeyInput').value = val;
          }
          geminiKey = val;
          localStorage.setItem(API_KEY_KEY, val);
          if ($('geminiModelSelect')) {
            selectedModel = $('geminiModelSelect').value;
            localStorage.setItem(MODEL_KEY, selectedModel);
          }
        }
        alertUi('Đã lưu API Key và Model thành công!');
        // Tự động thu gọn bảng sau khi lưu
        if ($('aichatConfigBody')) $('aichatConfigBody').style.display = 'none';
        if ($('btnToggleConfig')) $('btnToggleConfig').textContent = '▼';
      };
    }

    // Gửi tin nhắn bằng văn bản (Fallback)
    if ($('btnAichatSend')) {
      $('btnAichatSend').onclick = sendTypedMessage;
    }
    if ($('aichatTextInput')) {
      $('aichatTextInput').onkeydown = (e) => {
        if (e.key === 'Enter') sendTypedMessage();
      };
    }

    // Xoá lịch sử chat
    const clearFn = () => {
      confirmUi('Bạn có chắc chắn muốn xoá toàn bộ lịch sử trò chuyện không?', () => {
        clearChatHistory();
        renderChatMessages();
        updateStatus('Đã xoá lịch sử trò chuyện.');
      });
    };
    if ($('btnAichatClear')) $('btnAichatClear').onclick = clearFn;
    if ($('btnAichatClearTop')) $('btnAichatClearTop').onclick = clearFn;

    // Đăng ký sự kiện các thẻ gợi ý chủ đề
    document.querySelectorAll('.aichat-suggestion-chip').forEach(chip => {
      chip.onclick = () => {
        const text = chip.dataset.text || chip.textContent;
        handleUserMessage(text);
      };
    });

    // Hiển thị tin nhắn ban đầu
    renderChatMessages();
  }

  // --- Khởi tạo Nhận dạng giọng nói (Web Speech API) ---
  function initSpeechRecognition() {
    const SpeechRecClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecClass) {
      updateStatus('Nhận diện giọng nói chưa được trình duyệt này hỗ trợ. Bạn có thể gõ chữ ở ô nhập bên cạnh để trò chuyện.', false);
      if ($('btnAichatMic')) $('btnAichatMic').style.opacity = '0.5';
      return;
    }

    // 1. Nhận diện giọng nói cho trang Chat chính
    speechRec = new SpeechRecClass();
    speechRec.lang = 'zh-CN'; // Thiết lập nhận diện tiếng Trung
    speechRec.interimResults = true;
    speechRec.maxAlternatives = 5;

    speechRec.onstart = () => {
      isRecActive = true;
      const btn = $('btnAichatMic');
      if (btn) btn.classList.add('recording');
      const dot = $('aichatStatusDot');
      if (dot) dot.classList.add('active');
      updateStatus('Đang lắng nghe... Hãy nói tiếng Trung 🗣️');

      // Khởi tạo các biến kiểm soát thời gian im lặng
      speechLastTime = Date.now();
      speechLastText = '';
      if (speechSilenceTimer) clearInterval(speechSilenceTimer);
      speechSilenceTimer = setInterval(() => {
        if (isRecActive && speechLastText && Date.now() - speechLastTime > 1200) {
          console.log('Tự động dừng speechRec do học sinh dừng nói 1.2s');
          clearInterval(speechSilenceTimer);
          speechRec.stop();
        }
      }, 300);
    };

    speechRec.onend = () => {
      isRecActive = false;
      if (speechSilenceTimer) {
        clearInterval(speechSilenceTimer);
        speechSilenceTimer = null;
      }
      const btn = $('btnAichatMic');
      if (btn) btn.classList.remove('recording');
      const dot = $('aichatStatusDot');
      if (dot) dot.classList.remove('active');
      if (!isThinking) {
        updateStatus('Nhấn Mic để nói hoặc nhập văn bản...');
      }
    };

    speechRec.onerror = (e) => {
      isRecActive = false;
      if (speechSilenceTimer) {
        clearInterval(speechSilenceTimer);
        speechSilenceTimer = null;
      }
      const btn = $('btnAichatMic');
      if (btn) btn.classList.remove('recording');
      const dot = $('aichatStatusDot');
      if (dot) dot.classList.remove('active');
      
      console.error('Speech recognition error:', e);
      if (e.error === 'not-allowed') {
        alertUi('Không thể truy cập Micro. Vui lòng cấp quyền micro cho trang web này trong phần cài đặt trình duyệt của bạn.');
        updateStatus('Lỗi: Thiếu quyền Micro.');
      } else if (e.error === 'no-speech') {
        updateStatus('Không nghe rõ âm thanh. Hãy thử lại.');
      } else if (e.error === 'aborted') {
        updateStatus('Lỗi: Bị hủy. Hãy dùng Safari/Chrome để mở link trực tiếp.');
      } else {
        updateStatus('Lỗi nhận diện: ' + e.error);
      }
    };

    speechRec.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          // Lấy phương án đầu tiên đáng tin cậy nhất cho phần chat thông thường
          finalTranscript = event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      if (interimTranscript) {
        if (interimTranscript !== speechLastText) {
          speechLastText = interimTranscript;
          speechLastTime = Date.now(); // Cập nhật mốc thời gian khi có từ mới
        }
        updateStatus(`Đang nghe: "${interimTranscript}"...`, true);
      }
      
      if (finalTranscript && finalTranscript.trim()) {
        handleUserMessage(finalTranscript.trim());
      }
    };

    // Bind nút Mic trang chat
    if ($('btnAichatMic')) {
      $('btnAichatMic').onclick = () => {
        if (isThinking) return;
        if (isRecActive) {
          speechRec.stop();
        } else {
          // Bắt đầu thu
          try {
            speakOutput(""); // Tắt tiếng phát âm đang đọc dở để tránh xung đột
            speechRec.start();
          } catch (e) {
            console.error(e);
          }
        }
      };
    }

    // 2. Nhận diện giọng nói cho Modal Luyện đọc
    // --- Reset biến kiểm soát nâng cao (đã khai báo ở IIFE scope) ---
    pronounceGotResult = false;
    pronounceRetryCount = 0;
    pronounceWantActive = false;
    pronounceAccumulatedText = '';
    pronounceHasInterim = false;

    pronounceRec = new SpeechRecClass();
    pronounceRec.lang = 'zh-CN';
    pronounceRec.interimResults = true;
    pronounceRec.maxAlternatives = 5;
    pronounceRec.continuous = true;     // Tiếp tục lắng nghe sau mỗi đoạn

    pronounceRec.onstart = () => {
      isPronounceRecActive = true;
      pronounceHasInterim = false;
      const btn = $('btnPronounceMic');
      if (btn) btn.classList.add('recording');
      const wave = $('pronounceWave');
      if (wave) wave.style.display = 'block';
      updatePronounceStatus('Đang lắng nghe... Mời bạn nói 🗣️');

      // Khởi tạo các biến kiểm soát thời gian im lặng
      pronounceLastTime = Date.now();
      pronounceLastText = '';
      if (pronounceSilenceTimer) clearInterval(pronounceSilenceTimer);

      // Tính silence timeout thông minh theo độ dài câu mẫu
      const targetLen = (currentPronounceTarget || '').replace(/[\s\p{P}]/gu, '').length;
      const silenceTimeout = targetLen <= 2 ? 1500 : 2500; // 1.5s cho từ đơn, 2.5s cho câu dài

      pronounceSilenceTimer = setInterval(() => {
        // Chỉ bắt đầu đếm im lặng SAU KHI đã nhận ít nhất 1 interim result
        if (isPronounceRecActive && pronounceHasInterim && Date.now() - pronounceLastTime > silenceTimeout) {
          console.log(`Tự động dừng pronounceRec do im lặng ${silenceTimeout}ms`);
          clearInterval(pronounceSilenceTimer);
          pronounceSilenceTimer = null;
          pronounceWantActive = false; // Đánh dấu dừng chủ động
          try { pronounceRec.stop(); } catch (e) {}
        }
      }, 250);
    };

    pronounceRec.onend = () => {
      isPronounceRecActive = false;
      if (pronounceSilenceTimer) {
        clearInterval(pronounceSilenceTimer);
        pronounceSilenceTimer = null;
      }
      const btn = $('btnPronounceMic');
      if (btn) btn.classList.remove('recording');
      const wave = $('pronounceWave');
      if (wave) wave.style.display = 'none';

      // --- Auto-restart logic ---
      // Nếu học sinh vẫn muốn mic mở VÀ chưa có kết quả final → tự động restart
      if (pronounceWantActive && !pronounceGotResult && pronounceRetryCount < PRONOUNCE_MAX_RETRY) {
        pronounceRetryCount++;
        console.log(`Auto-restart pronounceRec lần ${pronounceRetryCount}/${PRONOUNCE_MAX_RETRY}`);
        updatePronounceStatus(`Chưa nghe rõ, đang thử lại... (${pronounceRetryCount}/${PRONOUNCE_MAX_RETRY})`);
        setTimeout(() => {
          if (pronounceWantActive && !pronounceGotResult) {
            try {
              pronounceRec.start();
            } catch (e) {
              console.error('Auto-restart failed:', e);
              pronounceWantActive = false;
              updatePronounceStatus('Không nhận được giọng nói. Hãy bấm Mic và nói to hơn.');
            }
          }
        }, 400);
        return; // Không reset UI vì sẽ restart
      }

      // Nếu hết retry mà vẫn chưa có kết quả → thông báo rõ ràng
      if (pronounceWantActive && !pronounceGotResult) {
        pronounceWantActive = false;
        // Nếu có accumulated text từ các lần trước → xử lý nó
        if (pronounceAccumulatedText.trim()) {
          processPronounceResult(pronounceAccumulatedText.trim());
        } else {
          updatePronounceStatus('Không nhận được giọng nói. Hãy nói to, rõ ràng và gần mic hơn.');
        }
      }
    };

    pronounceRec.onerror = (e) => {
      console.error('Pronounce recognition error:', e.error);
      
      // Lỗi 'no-speech' xảy ra khi mic mở nhưng không ai nói — vẫn có thể retry
      if (e.error === 'no-speech') {
        // Không set isPronounceRecActive = false ở đây, để onend handler xử lý retry
        updatePronounceStatus('Không nhận thấy giọng nói. Hãy nói to hơn...');
        return; // Để onend xử lý auto-restart
      }

      // Các lỗi nghiêm trọng → dừng hẳn
      isPronounceRecActive = false;
      pronounceWantActive = false;
      if (pronounceSilenceTimer) {
        clearInterval(pronounceSilenceTimer);
        pronounceSilenceTimer = null;
      }
      const btn = $('btnPronounceMic');
      if (btn) btn.classList.remove('recording');
      const wave = $('pronounceWave');
      if (wave) wave.style.display = 'none';

      if (e.error === 'not-allowed') {
        updatePronounceStatus('Lỗi: Không được cấp quyền Mic. Vui lòng cho phép truy cập Mic trong cài đặt trình duyệt.');
      } else if (e.error === 'aborted') {
        updatePronounceStatus('Lỗi: Bị hủy. Hãy mở link bằng Safari hoặc Chrome thay vì trình duyệt Zalo/Facebook.');
      } else if (e.error === 'network') {
        updatePronounceStatus('Lỗi mạng. Kiểm tra kết nối internet và thử lại.');
      } else {
        updatePronounceStatus('Lỗi: ' + e.error + '. Hãy thử lại.');
      }
    };

    pronounceRec.onresult = (event) => {
      let interimTranscript = '';
      
      // Tích lũy TẤT CẢ final segments (continuous mode có thể trả nhiều lần)
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const alternatives = event.results[i];
          let bestSpokenText = alternatives[0].transcript;
          let highestScore = -1;
          
          // Duyệt qua tất cả phán đoán để tìm phương án có điểm LCS cao nhất
          for (let a = 0; a < alternatives.length; a++) {
            const altText = alternatives[a].transcript;
            if (!altText || !altText.trim()) continue;
            const diff = getLcsDiff(currentPronounceTarget, altText);
            if (diff.score > highestScore) {
              highestScore = diff.score;
              bestSpokenText = altText;
            }
          }
          
          if (bestSpokenText && bestSpokenText.trim()) {
            pronounceAccumulatedText += bestSpokenText;
            pronounceGotResult = true;
          }
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      // Cập nhật trạng thái interim
      if (interimTranscript) {
        pronounceHasInterim = true; // Đánh dấu đã nhận được interim → bắt đầu đếm silence timer
        if (interimTranscript !== pronounceLastText) {
          pronounceLastText = interimTranscript;
          pronounceLastTime = Date.now();
        }
        updatePronounceStatus(`Đang nghe: "${interimTranscript}"...`);
      }
      
      // Khi đã có kết quả final → dừng mic và xử lý
      if (pronounceGotResult && pronounceAccumulatedText.trim()) {
        // Dừng mic ngay — không cần chờ thêm
        pronounceWantActive = false;
        try { pronounceRec.stop(); } catch (e) {}
        processPronounceResult(pronounceAccumulatedText.trim());
      }
    };

    // --- Nút Mic Modal Luyện đọc (có chống xung đột bấm nhanh) ---
    let pronounceMicDebounce = false;
    if ($('btnPronounceMic')) {
      $('btnPronounceMic').onclick = () => {
        // Chống bấm nhanh liên tục
        if (pronounceMicDebounce) return;
        pronounceMicDebounce = true;
        setTimeout(() => { pronounceMicDebounce = false; }, 500);

        if (isPronounceRecActive) {
          // Đang recording → dừng
          pronounceWantActive = false;
          try { pronounceRec.stop(); } catch (e) {}
        } else {
          // Bắt đầu recording
          try {
            speakOutput(""); // Tắt loa phát âm đang đọc để tránh xung đột micro
            // Reset toàn bộ trạng thái
            pronounceGotResult = false;
            pronounceRetryCount = 0;
            pronounceAccumulatedText = '';
            pronounceHasInterim = false;
            pronounceWantActive = true;
            // Xóa vùng kết quả cũ
            const resArea = $('pronounceResultArea');
            if (resArea) resArea.style.display = 'none';
            const aiArea = $('pronounceAiAnalysisArea');
            if (aiArea) aiArea.style.display = 'none';
            pronounceRec.start();
          } catch (e) {
            console.error('Start pronounceRec error:', e);
            pronounceWantActive = false;
            // Nếu lỗi InvalidStateError (mic chưa kịp dừng) → retry sau 500ms
            if (e.name === 'InvalidStateError') {
              updatePronounceStatus('Mic đang khởi động, chờ chút...');
              setTimeout(() => {
                try {
                  pronounceRec.start();
                  pronounceWantActive = true;
                } catch (e2) {
                  console.error('Retry start failed:', e2);
                  updatePronounceStatus('Không thể mở Mic. Hãy thử lại.');
                }
              }, 600);
            } else {
              updatePronounceStatus('Không thể mở Mic. Hãy kiểm tra quyền truy cập micro.');
            }
          }
        }
      };
    }
  }

  // --- Logic xử lý hội thoại AI ---
  function sendTypedMessage() {
    const input = $('aichatTextInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    handleUserMessage(text);
  }

  async function handleUserMessage(text) {
    checkUserSession();
    if (isThinking) return;

    // Kiểm tra API Key trước khi thực hiện gửi
    if (aiProvider === 'openrouter') {
      if (!openrouterKey) {
        openrouterKey = window.getOpenRouterKey();
      }
    } else if (aiProvider === 'deepseek') {
      if (!deepseekKey) {
        deepseekKey = window.getDeepSeekKey();
      }
    } else {
      if (!geminiKey) {
        geminiKey = window.getGeminiKey();
      }
    }

    // 1. Thêm tin nhắn của User vào lịch sử và render
    const userMsg = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      text: text,
      timestamp: Date.now()
    };
    
    chatHistory.push(userMsg);
    saveChatHistory();
    renderChatMessages();
    scrollToBottom();

    // 2. Gọi AI suy nghĩ
    isThinking = true;
    renderChatMessages();
    updateStatus('AI đang suy nghĩ...', true);
    
    // Tự động cuộn xuống khi đang suy nghĩ
    setTimeout(scrollToBottom, 50);

    try {
      const aiResponse = await callGeminiAPI(chatHistory);
      
      // 3. Thêm tin nhắn của AI vào lịch sử
      const aiMsg = {
        id: 'msg_' + (Date.now() + 1),
        sender: 'ai',
        text: aiResponse.hanzi,
        pinyin: aiResponse.pinyin,
        translation: aiResponse.vietnamese,
        timestamp: Date.now()
      };
      
      chatHistory.push(aiMsg);
      saveChatHistory();
      renderChatMessages();
      scrollToBottom();

      // Cộng điểm thưởng cho học sinh (1 điểm cho mỗi câu giao tiếp bằng tiếng Trung)
      addPointsReward(1);

      // 4. Phát âm giọng nói AI
      speakOutput(aiResponse.hanzi);
      updateStatus('Nhấn Mic để nói hoặc nhập văn bản...');
    } catch (err) {
      console.error('Lỗi khi trò chuyện với AI:', err);
      let errMsg = err.message || 'Lỗi hệ thống không xác định.';
      if (err.message.includes('API key') || err.message.includes('API_KEY_INVALID')) {
        errMsg = 'API Key không hợp lệ hoặc đã bị khóa. Vui lòng kiểm tra lại.';
      } else if (err.message.includes('quota') || err.message.includes('429')) {
        errMsg = 'Đã hết lượt sử dụng miễn phí của phút này. Vui lòng đợi 1 chút rồi thử lại.';
      }
      
      const errorMsg = {
        id: 'msg_err_' + Date.now(),
        sender: 'ai',
        text: '❌ Có lỗi xảy ra: ' + errMsg,
        pinyin: '',
        translation: 'Xem chi tiết thông báo lỗi phía trên để biết lý do.',
        timestamp: Date.now()
      };
      chatHistory.push(errorMsg);
      renderChatMessages();
      scrollToBottom();
      updateStatus('Có lỗi xảy ra.');
    } finally {
      isThinking = false;
      renderChatMessages();
    }
  }

  // --- Gọi API Gemini (có tự động chuyển model và API key khi bị rate-limit/lỗi) ---
  async function callGeminiAPI(history, modelOverride = null, triedModels = [], triedKeys = []) {
    if (aiProvider === 'openrouter') {
      try {
        return await callOpenRouterAPI(history, modelOverride, triedModels, triedKeys);
      } catch (err) {
        console.warn('OpenRouter lỗi, chuyển sang Gemini dự phòng:', err);
        updateStatus('Cổng OpenRouter bận/lỗi → Đang tự động dùng Gemini dự phòng...', true);
        await new Promise(r => setTimeout(r, 1500));
        // Cho phép chạy tiếp xuống Gemini
      }
    }
    if (aiProvider === 'deepseek') {
      try {
        return await callDeepSeekAPI(history, modelOverride, triedModels, triedKeys);
      } catch (err) {
        console.warn('DeepSeek lỗi, chuyển sang Gemini dự phòng:', err);
        updateStatus('DeepSeek lỗi (Hết số dư/bận) → Đang dùng Gemini dự phòng...', true);
        await new Promise(r => setTimeout(r, 1500));
        // Cho phép chạy tiếp xuống Gemini
      }
    }
    let currentModel = modelOverride || selectedModel;
    if (aiProvider !== 'gemini' || !currentModel.startsWith('gemini')) {
      currentModel = 'gemini-2.5-flash-lite';
    }
    const currentKey = geminiKey;
    const contents = [];
    
    // Giới hạn số câu ngữ cảnh gửi đi (tối đa 8 tin nhắn gần nhất) để tiết kiệm token và đảm bảo tốc độ phản hồi
    const maxContext = 8;
    const recentHistory = history.slice(-maxContext);
    
    recentHistory.forEach(msg => {
      // Không gửi các tin nhắn thông báo lỗi
      if (msg.text.startsWith('❌')) return;

      contents.push({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      });
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent`;
    
    const requestBody = {
      contents: contents,
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTIONS }]
      },
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.4
      }
    };

    const modelInfo = AVAILABLE_MODELS.find(m => m.id === currentModel);
    updateStatus(`🤖 Đang dùng ${modelInfo?.name || currentModel}...`, true);

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
          updateStatus(`🔑 Key lỗi/hết lượt → Đổi sang key dự phòng...`, true);
          await new Promise(r => setTimeout(r, 1000));
          geminiKey = nextKey;
          return callGeminiAPI(history, modelOverride, triedModels, triedKeys);
        }
      }

      // Nếu đã thử hết các keys hoặc không phải lỗi key, thử xoay vòng model
      if (isTemporaryError || isKeyError) {
        triedModels.push(currentModel);
        
        // Tìm model khác chưa thử
        const nextModel = AVAILABLE_MODELS.find(m => !triedModels.includes(m.id));
        
        if (nextModel) {
          const nextInfo = AVAILABLE_MODELS.find(m => m.id === nextModel.id);
          updateStatus(`⚡ ${modelInfo?.name || currentModel} bận/hết lượt → Chuyển sang ${nextInfo.name}...`, true);
          await new Promise(r => setTimeout(r, 1000));
          
          // Cập nhật model đã chọn trên giao diện
          selectedModel = nextModel.id;
          localStorage.setItem(MODEL_KEY, nextModel.id);
          if ($('geminiModelSelect')) $('geminiModelSelect').value = nextModel.id;
          
          return callGeminiAPI(history, nextModel.id, triedModels, triedKeys);
        }
        
        throw new Error('Tất cả API Key và Model AI đều đã hết lượt miễn phí hoặc đang quá tải. Vui lòng thử lại sau.');
      }
      
      throw new Error(errMessage);
    }

    const data = await response.json();
    
    try {
      const textOutput = data.candidates[0].content.parts[0].text;
      return JSON.parse(textOutput.trim());
    } catch (e) {
      console.warn('Lỗi phân tích JSON từ AI, thử trích xuất thủ công:', e);
      // Fallback nếu AI trả về văn bản chứa JSON thô
      const textOutput = data.candidates[0].content.parts[0].text;
      const jsonMatch = textOutput.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0].trim());
      }
      // Trả về đối tượng cơ bản nếu hoàn toàn thất bại trong việc lấy JSON
      return {
        hanzi: textOutput,
        pinyin: '',
        vietnamese: 'Nhấn nút nghe để phát âm thử câu trả lời.'
      };
    }
  }

  // --- Gọi API OpenRouter ---
  async function callOpenRouterAPI(history, modelOverride = null, triedModels = [], triedKeys = []) {
    const currentModel = modelOverride || localStorage.getItem(OPENROUTER_MODEL_KEY) || 'qwen/qwen-2-7b-instruct:free';
    const currentKey = openrouterKey || window.getOpenRouterKey();

    const maxContext = 8;
    const recentHistory = history.slice(-maxContext);
    const messages = [
      { role: 'system', content: SYSTEM_INSTRUCTIONS }
    ];

    recentHistory.forEach(msg => {
      if (msg.text.startsWith('❌')) return;
      messages.push({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      });
    });

    const modelInfo = OPENROUTER_MODELS.find(m => m.id === currentModel) || { name: currentModel };
    updateStatus(`🤖 Đang dùng ${modelInfo.name || currentModel}...`, true);

    const url = 'https://openrouter.ai/api/v1/chat/completions';
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
        messages: messages,
        temperature: 0.4
      })
    });

    if (!response.ok) {
      const errInfo = await response.json().catch(() => ({}));
      const errMessage = errInfo.error?.message || `HTTP error ${response.status}`;
      
      // Thử xoay vòng sang model khác của OpenRouter
      triedModels.push(currentModel);
      const nextModel = OPENROUTER_MODELS.find(m => !triedModels.includes(m.id));
      if (nextModel) {
        updateStatus(`OpenRouter model bận → Chuyển sang ${nextModel.name}...`, true);
        await new Promise(r => setTimeout(r, 1000));
        
        selectedModel = nextModel.id;
        localStorage.setItem(OPENROUTER_MODEL_KEY, nextModel.id);
        if ($('geminiModelSelect')) $('geminiModelSelect').value = nextModel.id;
        
        return callOpenRouterAPI(history, nextModel.id, triedModels, triedKeys);
      }
      throw new Error(errMessage);
    }

    const data = await response.json();
    try {
      const textOutput = data.choices[0].message.content;
      return JSON.parse(textOutput.trim());
    } catch (e) {
      console.warn('Lỗi phân tích JSON từ OpenRouter, thử trích xuất thủ công:', e);
      const textOutput = data.choices[0].message.content;
      const jsonMatch = textOutput.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0].trim());
      }
      return {
        hanzi: textOutput,
        pinyin: '',
        vietnamese: 'Nhấn nút nghe để phát âm thử câu trả lời.'
      };
    }
  }

  // --- Gọi API DeepSeek ---
  async function callDeepSeekAPI(history, modelOverride = null, triedModels = [], triedKeys = []) {
    const currentModel = modelOverride || localStorage.getItem(DEEPSEEK_MODEL_KEY) || 'deepseek-chat';
    const currentKey = deepseekKey || window.getDeepSeekKey();

    const maxContext = 8;
    const recentHistory = history.slice(-maxContext);
    const messages = [
      { role: 'system', content: SYSTEM_INSTRUCTIONS }
    ];

    recentHistory.forEach(msg => {
      if (msg.text.startsWith('❌')) return;
      messages.push({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      });
    });

    const modelInfo = DEEPSEEK_MODELS.find(m => m.id === currentModel) || { name: currentModel };
    updateStatus(`🤖 Đang dùng ${modelInfo.name || currentModel}...`, true);

    const url = 'https://api.deepseek.com/chat/completions';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + currentKey
      },
      body: JSON.stringify({
        model: currentModel,
        messages: messages,
        temperature: 0.4
      })
    });

    if (!response.ok) {
      const errInfo = await response.json().catch(() => ({}));
      const errMessage = errInfo.error?.message || `HTTP error ${response.status}`;
      throw new Error(errMessage);
    }

    const data = await response.json();
    try {
      const textOutput = data.choices[0].message.content;
      return JSON.parse(textOutput.trim());
    } catch (e) {
      console.warn('Lỗi phân tích JSON từ DeepSeek, thử trích xuất thủ công:', e);
      const textOutput = data.choices[0].message.content;
      const jsonMatch = textOutput.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0].trim());
      }
      return {
        hanzi: textOutput,
        pinyin: '',
        vietnamese: 'Nhấn nút nghe để phát âm thử câu trả lời.'
      };
    }
  }

  // --- Giao diện vẽ tin nhắn ---
  function renderChatMessages() {
    const stage = $('aichatMessages');
    if (!stage) return;

    if (chatHistory.length === 0) {
      stage.innerHTML = `
        <div style="text-align:center; padding: 40px 20px; color:var(--muted); font-size:0.95rem;">
          <p style="font-size:1.8rem; margin-bottom:8px;">👋</p>
          <p style="font-weight:600; color:var(--gold-1); margin-bottom:6px;">Chào bạn! Tôi là Tiểu Hoa (小华)</p>
          <p style="max-width:320px; margin:0 auto; line-height:1.4;">Hãy nhấn nút Mic phía dưới hoặc bấm vào các chủ đề gợi ý để bắt đầu trò chuyện nhé!</p>
        </div>
      `;
      return;
    }

    let html = '';
    chatHistory.forEach(msg => {
      const isAi = msg.sender === 'ai';
      const avatar = isAi ? '👩‍🏫' : '🎓';
      
      let pinyinHtml = '';
      if (msg.pinyin) {
        pinyinHtml = `<div class="bubble-pinyin">${colorPinyinText(msg.pinyin)}</div>`;
      }
      
      let translationHtml = '';
      if (msg.translation) {
        translationHtml = `<div class="bubble-translation">${esc(msg.translation)}</div>`;
      }

      let playBtnHtml = '';
      if (isAi && !msg.text.startsWith('❌')) {
        playBtnHtml = `<button class="bubble-play-btn" data-text="${esc(msg.text)}" title="Nghe đọc lại">🔊 Nghe đọc</button>`;
      }

      html += `
        <div class="chat-row ${msg.sender}">
          ${isAi ? `<div class="chat-avatar">${avatar}</div>` : ''}
          <div class="chat-bubble">
            <div class="bubble-hanzi">${esc(msg.text)}</div>
            ${pinyinHtml}
            ${translationHtml}
            ${playBtnHtml}
          </div>
          ${!isAi ? `<div class="chat-avatar">${avatar}</div>` : ''}
        </div>
      `;
    });

    if (isThinking) {
      html += `
        <div class="chat-row ai">
          <div class="chat-avatar">👩‍🏫</div>
          <div class="chat-bubble thinking-bubble">
            <div class="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      `;
    }

    stage.innerHTML = html;

    // Bind nút nghe lại trong bong bóng chat
    stage.querySelectorAll('.bubble-play-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const text = btn.dataset.text;
        speakOutput(text);
      };
    });
  }

  function scrollToBottom() {
    const stage = $('aichatMessages');
    if (stage) {
      stage.scrollTop = stage.scrollHeight;
    }
  }

  function updateStatus(text, showDot = false) {
    const el = $('aichatStatusText');
    if (el) el.textContent = text;
    const dot = $('aichatStatusDot');
    if (dot) {
      if (showDot) dot.classList.add('active');
      else dot.classList.remove('active');
    }
  }

  // saveChatHistory is defined at the top

  // --- API Luyện đọc phát âm Modal (Tập đọc chữ/câu ngắn) ---
  function initPronounceModalEvents() {
    // Nút nghe phát âm mẫu trong modal
    if ($('btnPronounceListen')) {
      $('btnPronounceListen').onclick = () => {
        if (currentPronounceTarget) {
          speakOutput(currentPronounceTarget);
        }
      };
    }

    // Đóng modal
    if ($('btnPronounceClose')) {
      $('btnPronounceClose').onclick = () => {
        closePronounceModal();
      };
    }

    // Nút AI phân tích lỗi phát âm
    if ($('btnPronounceAiExplain')) {
      $('btnPronounceAiExplain').onclick = async () => {
        const explainArea = $('pronounceAiExplanation');
        if (!explainArea) return;

        explainArea.style.display = 'block';
        explainArea.innerHTML = '<span style="color:var(--muted);">🔄 AI đang phân tích âm thanh và so khớp chữ viết...</span>';
        
        const spokenText = $('pronounceSpokenText').textContent || '';
        
        try {
          const analysis = await callGeminiAnalysis(currentPronounceTarget, currentPronouncePinyin, spokenText);
          explainArea.textContent = analysis;
        } catch (err) {
          console.error(err);
          let errMsg = err.message || 'Hệ thống bận.';
          if (err.message.includes('API key') || err.message.includes('API_KEY_INVALID')) {
            errMsg = 'API Key không hợp lệ hoặc chưa được lưu.';
          } else if (err.message.includes('quota') || err.message.includes('429')) {
            errMsg = 'Đã hết lượt sử dụng miễn phí của phút này. Vui lòng thử lại sau 1 phút.';
          }
          explainArea.textContent = '❌ Lỗi phân tích: ' + errMsg;
        }
      };
    }
  }

  // --- Gọi API Gemini để phân tích lỗi phát âm (có tự động chuyển model và API key) ---
  async function callGeminiAnalysis(target, pinyin, spoken, modelOverride = null, triedModels = [], triedKeys = []) {
    if (aiProvider === 'openrouter') {
      try {
        return await callOpenRouterAnalysis(target, pinyin, spoken, modelOverride, triedModels, triedKeys);
      } catch (err) {
        console.warn('OpenRouter phân tích lỗi, chuyển sang Gemini dự phòng:', err);
        // Cho phép chạy tiếp xuống Gemini
      }
    }
    if (aiProvider === 'deepseek') {
      try {
        return await callDeepSeekAnalysis(target, pinyin, spoken, modelOverride, triedModels, triedKeys);
      } catch (err) {
        console.warn('DeepSeek phân tích lỗi, chuyển sang Gemini dự phòng:', err);
        // Cho phép chạy tiếp xuống Gemini
      }
    }
    if (!geminiKey) {
      geminiKey = window.getGeminiKey();
    }

    let currentModel = modelOverride || (selectedModel === 'gemini-2.5-flash' ? 'gemini-2.5-flash-lite' : selectedModel);
    if (aiProvider !== 'gemini' || !currentModel.startsWith('gemini')) {
      currentModel = 'gemini-2.5-flash-lite';
    }
    const currentKey = geminiKey;
    
    // Lấy Pinyin của từ học sinh phát âm ra
    let spokenPinyin = '';
    try {
      spokenPinyin = (window.pinyinPro && typeof window.pinyinPro.pinyin === 'function' && spoken && spoken.trim()) ? window.pinyinPro.pinyin(spoken.trim()) : '';
    } catch (e) {
      console.warn('pinyin-pro lỗi khi phân tích spoken text:', e);
    }

    const systemPrompt = `
You are a warm, encouraging Chinese teacher. The student is practicing pronunciation.
Compare the correct Chinese text (and its Pinyin) with what the student actually pronounced (and its recognized Pinyin), and analyze their pronunciation errors in clear, friendly Vietnamese.

Specifically, look out for and guide the student on:
1. Tones (Thanh điệu): Compare the correct Pinyin with the recognized Pinyin. Point out incorrect tones. Pay special attention to:
   - Confusion between Tone 1 (flat, high) and short pronunciation.
   - Tone 3 (low-dipping-and-rising) read as flat or like Vietnamese grave accent (dấu huyền) or question mark.
   - Tone 4 (high-falling, sharp and short) read as flat or like Vietnamese grave accent (dấu huyền). Instruct the student to pronounce it forcefully and falling.
2. Initials (Phụ âm đầu): Check if they missed aspiration (p, t, k, q, c, ch) or confused dental sibilants (z, c, s) with retroflexes (zh, ch, sh, r) or palatals (j, q, x).
3. Finals (Vận mẫu / Vần): Check if they confused vowels (u vs ü, e vs o) or nasal endings (an vs ang, en vs eng, in vs ing).

Important Rules for Analysis:
- VERY IMPORTANT (Homophones / Chữ đồng âm): If the recognized Pinyin is identical or extremely close to the correct Pinyin, but the Chinese characters are different (due to Google Speech-to-Text recognizing a homophone, e.g., 'shì' recognized as '事' or '市' instead of '是'), praise the student that their pronunciation was actually correct and they did a great job, and explain that the system just outputted a homophone.
- If they pronounced it very well (pronunciation and Pinyin match perfectly), praise them warmly and encourage them.
- If the student spoke something completely unrelated or Web Speech API failed to recognize (spoken text is empty or garbled), politely ask them to try speaking again closer to the microphone, speak louder and more clearly, or try imitating the sample audio.
- Keep the feedback extremely short, actionable, and friendly (maximum 2-3 sentences).
- You MUST respond in a strictly structured JSON format with a single field:
   - "analysis": Your feedback in Vietnamese.

Example of expected JSON format:
{
  "analysis": "Tuyệt vời! Bạn phát âm rất chuẩn chữ này, từ thanh điệu đến phụ âm đầu đều rất tốt."
}

Return ONLY the raw JSON string. Do not wrap it in markdown code blocks, do not include backticks, and do not add any explanation or other text.
`;

    const prompt = `Correct Chinese: "${target}" (Pinyin: "${pinyin}")\nStudent pronounced: "${spoken}"${spokenPinyin ? ` (Recognized Pinyin: "${spokenPinyin}")` : ''}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent`;

    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2
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
          geminiKey = nextKey;
          return callGeminiAnalysis(target, pinyin, spoken, modelOverride, triedModels, triedKeys);
        }
      }

      // Nếu đã thử hết các keys hoặc không phải lỗi key, thử xoay vòng model
      if (isTemporaryError || isKeyError) {
        triedModels.push(currentModel);
        
        // Tìm model khác chưa thử
        const nextModel = AVAILABLE_MODELS.find(m => !triedModels.includes(m.id));
        
        if (nextModel) {
          // Cập nhật model đã chọn trên giao diện
          selectedModel = nextModel.id;
          localStorage.setItem(MODEL_KEY, nextModel.id);
          if ($('geminiModelSelect')) $('geminiModelSelect').value = nextModel.id;
          
          await new Promise(r => setTimeout(r, 1000));
          return callGeminiAnalysis(target, pinyin, spoken, nextModel.id, triedModels, triedKeys);
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
      console.warn('Lỗi phân tích JSON từ AI phân tích lỗi:', e);
      const textOutput = data.candidates[0].content.parts[0].text;
      const jsonMatch = textOutput.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0].trim()).analysis;
      }
      return textOutput.trim();
    }
  }

  // --- Gọi API OpenRouter để phân tích lỗi phát âm ---
  async function callOpenRouterAnalysis(target, pinyin, spoken, modelOverride = null, triedModels = [], triedKeys = []) {
    const currentModel = modelOverride || localStorage.getItem(OPENROUTER_MODEL_KEY) || 'qwen/qwen-2-7b-instruct:free';
    const currentKey = openrouterKey || window.getOpenRouterKey();
    
    // Lấy Pinyin của từ học sinh phát âm ra
    let spokenPinyin = '';
    try {
      spokenPinyin = (window.pinyinPro && typeof window.pinyinPro.pinyin === 'function' && spoken && spoken.trim()) ? window.pinyinPro.pinyin(spoken.trim()) : '';
    } catch (e) {
      console.warn('pinyin-pro lỗi khi phân tích spoken text:', e);
    }

    const systemPrompt = `
You are a warm, encouraging Chinese teacher. The student is practicing pronunciation.
Compare the correct Chinese text (and its Pinyin) with what the student actually pronounced (and its recognized Pinyin), and analyze their pronunciation errors in clear, friendly Vietnamese.

Specifically, look out for and guide the student on:
1. Tones (Thanh điệu): Compare the correct Pinyin with the recognized Pinyin. Point out incorrect tones. Pay special attention to:
   - Confusion between Tone 1 (flat, high) and short pronunciation.
   - Tone 3 (low-dipping-and-rising) read as flat or like Vietnamese grave accent (dấu huyền) or question mark.
   - Tone 4 (high-falling, sharp and short) read as flat or like Vietnamese grave accent (dấu huyền). Instruct the student to pronounce it forcefully and falling.
2. Initials (Phụ âm đầu): Check if they missed aspiration (p, t, k, q, c, ch) or confused dental sibilants (z, c, s) with retroflexes (zh, ch, sh, r) or palatals (j, q, x).
3. Finals (Vận mẫu / Vần): Check if they confused vowels (u vs ü, e vs o) or nasal endings (an vs ang, en vs eng, in vs ing).

Important Rules for Analysis:
- VERY IMPORTANT (Homophones / Chữ đồng âm): If the recognized Pinyin is identical or extremely close to the correct Pinyin, but the Chinese characters are different (due to Google Speech-to-Text recognizing a homophone, e.g., 'shì' recognized as '事' or '市' instead of '是'), praise the student that their pronunciation was actually correct and they did a great job, and explain that the system just outputted a homophone.
- If they pronounced it very well (pronunciation and Pinyin match perfectly), praise them warmly and encourage them.
- If the student spoke something completely unrelated or Web Speech API failed to recognize (spoken text is empty or garbled), politely ask them to try speaking again closer to the microphone, speak louder and more clearly, or try imitating the sample audio.
- Keep the feedback extremely short, actionable, and friendly (maximum 2-3 sentences).
- You MUST respond in a strictly structured JSON format with a single field:
   - "analysis": Your feedback in Vietnamese.

Example of expected JSON format:
{
  "analysis": "Tuyệt vời! Bạn phát âm rất chuẩn chữ này, từ thanh điệu đến phụ âm đầu đều rất tốt."
}

Return ONLY the raw JSON string. Do not wrap it in markdown code blocks, do not include backticks, and do not add any explanation or other text.
`;

    const prompt = `Correct Chinese: "${target}" (Pinyin: "${pinyin}")\nStudent pronounced: "${spoken}"${spokenPinyin ? ` (Recognized Pinyin: "${spokenPinyin}")` : ''}`;
    const url = 'https://openrouter.ai/api/v1/chat/completions';

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
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const errInfo = await response.json().catch(() => ({}));
      const errMessage = errInfo.error?.message || `HTTP error ${response.status}`;
      
      triedModels.push(currentModel);
      const nextModel = OPENROUTER_MODELS.find(m => !triedModels.includes(m.id));
      if (nextModel) {
        selectedModel = nextModel.id;
        localStorage.setItem(OPENROUTER_MODEL_KEY, nextModel.id);
        if ($('geminiModelSelect')) $('geminiModelSelect').value = nextModel.id;
        
        await new Promise(r => setTimeout(r, 1000));
        return callOpenRouterAnalysis(target, pinyin, spoken, nextModel.id, triedModels, triedKeys);
      }
      throw new Error(errMessage);
    }

    const data = await response.json();
    try {
      const textOutput = data.choices[0].message.content;
      const parsed = JSON.parse(textOutput.trim());
      return parsed.analysis || 'Không có phản hồi từ AI.';
    } catch (e) {
      console.warn('Lỗi phân tích JSON từ OpenRouter phân tích lỗi phát âm:', e);
      const textOutput = data.choices[0].message.content;
      const jsonMatch = textOutput.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0].trim()).analysis;
      }
      return textOutput.trim();
    }
  }

  // --- Gọi API DeepSeek để phân tích lỗi phát âm ---
  async function callDeepSeekAnalysis(target, pinyin, spoken, modelOverride = null, triedModels = [], triedKeys = []) {
    const currentModel = modelOverride || localStorage.getItem(DEEPSEEK_MODEL_KEY) || 'deepseek-chat';
    const currentKey = deepseekKey || window.getDeepSeekKey();
    
    // Lấy Pinyin của từ học sinh phát âm ra
    let spokenPinyin = '';
    try {
      spokenPinyin = (window.pinyinPro && typeof window.pinyinPro.pinyin === 'function' && spoken && spoken.trim()) ? window.pinyinPro.pinyin(spoken.trim()) : '';
    } catch (e) {
      console.warn('pinyin-pro lỗi khi phân tích spoken text:', e);
    }

    const systemPrompt = `
You are a warm, encouraging Chinese teacher. The student is practicing pronunciation.
Compare the correct Chinese text (and its Pinyin) with what the student actually pronounced (and its recognized Pinyin), and analyze their pronunciation errors in clear, friendly Vietnamese.

Specifically, look out for and guide the student on:
1. Tones (Thanh điệu): Compare the correct Pinyin with the recognized Pinyin. Point out incorrect tones. Pay special attention to:
   - Confusion between Tone 1 (flat, high) and short pronunciation.
   - Tone 3 (low-dipping-and-rising) read as flat or like Vietnamese grave accent (dấu huyền) or question mark.
   - Tone 4 (high-falling, sharp and short) read as flat or like Vietnamese grave accent (dấu huyền). Instruct the student to pronounce it forcefully and falling.
2. Initials (Phụ âm đầu): Check if they missed aspiration (p, t, k, q, c, ch) or confused dental sibilants (z, c, s) with retroflexes (zh, ch, sh, r) or palatals (j, q, x).
3. Finals (Vận mẫu / Vần): Check if they confused vowels (u vs ü, e vs o) or nasal endings (an vs ang, en vs eng, in vs ing).

Important Rules for Analysis:
- VERY IMPORTANT (Homophones / Chữ đồng âm): If the recognized Pinyin is identical or extremely close to the correct Pinyin, but the Chinese characters are different (due to Google Speech-to-Text recognizing a homophone, e.g., 'shì' recognized as '事' or '市' instead of '是'), praise the student that their pronunciation was actually correct and they did a great job, and explain that the system just outputted a homophone.
- If they pronounced it very well (pronunciation and Pinyin match perfectly), praise them warmly and encourage them.
- If the student spoke something completely unrelated or Web Speech API failed to recognize (spoken text is empty or garbled), politely ask them to try speaking again closer to the microphone, speak louder and more clearly, or try imitating the sample audio.
- Keep the feedback extremely short, actionable, and friendly (maximum 2-3 sentences).
- You MUST respond in a strictly structured JSON format with a single field:
   - "analysis": Your feedback in Vietnamese.

Example of expected JSON format:
{
  "analysis": "Tuyệt vời! Bạn phát âm rất chuẩn chữ này, từ thanh điệu đến phụ âm đầu đều rất tốt."
}

Return ONLY the raw JSON string. Do not wrap it in markdown code blocks, do not include backticks, and do not add any explanation or other text.
`;

    const prompt = `Correct Chinese: "${target}" (Pinyin: "${pinyin}")\nStudent pronounced: "${spoken}"${spokenPinyin ? ` (Recognized Pinyin: "${spokenPinyin}")` : ''}`;
    const url = 'https://api.deepseek.com/chat/completions';

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
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const errInfo = await response.json().catch(() => ({}));
      const errMessage = errInfo.error?.message || `HTTP error ${response.status}`;
      throw new Error(errMessage);
    }

    const data = await response.json();
    try {
      const textOutput = data.choices[0].message.content;
      const parsed = JSON.parse(textOutput.trim());
      return parsed.analysis || 'Không có phản hồi từ AI.';
    } catch (e) {
      console.warn('Lỗi phân tích JSON từ DeepSeek phân tích lỗi phát âm:', e);
      const textOutput = data.choices[0].message.content;
      const jsonMatch = textOutput.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0].trim()).analysis;
      }
      return textOutput.trim();
    }
  }

  // Mở modal luyện đọc được định nghĩa toàn cục để app.js gọi
  function openPronounceModal(targetText, targetPinyin, targetMeaning, callback) {
    currentPronounceTarget = targetText || '';
    currentPronouncePinyin = targetPinyin || '';
    currentPronounceMeaning = targetMeaning || '';
    currentPronounceCallback = callback || null;

    const modal = $('pronounceModal');
    if (!modal) return;

    // Cập nhật giao diện modal
    $('pronounceTargetText').textContent = currentPronounceTarget;
    $('pronounceTargetPinyin').innerHTML = colorPinyinText(currentPronouncePinyin) || '—';
    $('pronounceTargetMeaning').textContent = currentPronounceMeaning || '';
    
    // Reset kết quả
    $('pronounceResultArea').style.display = 'none';
    const aiArea = $('pronounceAiAnalysisArea');
    if (aiArea) aiArea.style.display = 'none';
    const explanation = $('pronounceAiExplanation');
    if (explanation) explanation.style.display = 'none';
    updatePronounceStatus('Sẵn sàng! Nhấn nút Mic và đọc to.');

    // Kích hoạt
    modal.classList.add('active');
  }

  function closePronounceModal() {
    // Dừng recording và reset toàn bộ trạng thái
    pronounceWantActive = false;
    if (isPronounceRecActive && pronounceRec) {
      try { pronounceRec.stop(); } catch (e) {}
    }
    if (pronounceSilenceTimer) {
      clearInterval(pronounceSilenceTimer);
      pronounceSilenceTimer = null;
    }
    const modal = $('pronounceModal');
    if (modal) modal.classList.remove('active');
  }

  function updatePronounceStatus(text) {
    const el = $('pronounceStatus');
    if (el) el.textContent = text;
  }

  // Xử lý so sánh giọng nói
  function processPronounceResult(spokenText) {
    const target = currentPronounceTarget;
    const resArea = $('pronounceResultArea');
    if (!resArea) return;

    // Thực hiện so sánh chuỗi bằng thuật toán LCS
    const diff = getLcsDiff(target, spokenText);

    // Hiển thị kết quả lên giao diện
    $('pronounceDiffHTML').innerHTML = diff.html;
    $('pronounceSpokenText').textContent = spokenText;
    $('pronounceScorePct').textContent = diff.score + '%';
    $('pronounceScoreBar').style.width = diff.score + '%';

    // Cập nhật màu thanh tiến độ
    if (diff.score >= 80) {
      $('pronounceScoreBar').style.backgroundColor = 'var(--green-1, #3ed18a)';
      $('pronounceFeedback').innerHTML = `<span style="color:var(--green-1, #3ed18a); font-weight: bold; display: block; margin-bottom: 5px;">🎉 Tuyệt vời! Bạn đọc rất tốt! (+2 điểm)</span>`;
      // Thưởng điểm
      addPointsReward(2);
      // Gọi callback thành công nếu có
      if (typeof currentPronounceCallback === 'function') {
        currentPronounceCallback(true, diff.score);
      }
    } else if (diff.score >= 50) {
      $('pronounceScoreBar').style.backgroundColor = 'var(--gold-2, #d4af37)';
      
      let detailHtml = '';
      if (diff.errorDetails && diff.errorDetails.length > 0) {
        detailHtml = `
          <div style="text-align: left; margin-top: 10px; font-size: 0.9rem; line-height: 1.5; border-top: 1px dashed rgba(255,255,255,0.15); padding-top: 8px; max-height: 120px; overflow-y: auto;">
            <span style="color:var(--gold-1, #f3d98b); font-weight: bold; display: block; margin-bottom: 4px;">Khá tốt, cần cải thiện một số chữ:</span>
            <ul style="margin: 0; padding-left: 18px; color: var(--text-color, #e0e0e0);">
              ${diff.errorDetails.map(err => `<li style="margin-bottom: 3px;">${err}</li>`).join('')}
            </ul>
          </div>
        `;
      }

      $('pronounceFeedback').innerHTML = `
        <span style="color:var(--gold-1, #f3d98b); font-weight: bold;">Khá tốt, hãy tập trung phát âm rõ hơn nhé!</span>
        ${detailHtml}
      `;
      if (typeof currentPronounceCallback === 'function') {
        currentPronounceCallback(false, diff.score);
      }
    } else {
      $('pronounceScoreBar').style.backgroundColor = 'var(--crimson-1, #c0392b)';
      
      let detailHtml = '';
      if (diff.errorDetails && diff.errorDetails.length > 0) {
        detailHtml = `
          <div style="text-align: left; margin-top: 10px; font-size: 0.9rem; line-height: 1.5; border-top: 1px dashed rgba(255,255,255,0.15); padding-top: 8px; max-height: 120px; overflow-y: auto;">
            <span style="color:#e74c3c; font-weight: bold; display: block; margin-bottom: 4px;">Chi tiết lỗi phát âm:</span>
            <ul style="margin: 0; padding-left: 18px; color: var(--text-color, #e0e0e0);">
              ${diff.errorDetails.map(err => `<li style="margin-bottom: 3px;">${err}</li>`).join('')}
            </ul>
          </div>
        `;
      } else {
        detailHtml = `<div style="color:#e74c3c; font-weight: bold;">Bạn đọc chưa rõ lắm, bấm "Nghe mẫu" rồi thử lại nhé!</div>`;
      }

      $('pronounceFeedback').innerHTML = `
        ${detailHtml}
      `;
      if (typeof currentPronounceCallback === 'function') {
        currentPronounceCallback(false, diff.score);
      }
    }

    resArea.style.display = 'block';
    
    // Hiển thị nút AI phân tích lỗi phát âm
    const aiArea = $('pronounceAiAnalysisArea');
    if (aiArea) {
      aiArea.style.display = 'block';
      const explanation = $('pronounceAiExplanation');
      if (explanation) explanation.style.display = 'none'; // Ẩn giải thích của lần nói trước
    }

    updatePronounceStatus('Đã nhận diện giọng nói xong.');
  }

  // Thuật toán so khớp chuỗi con chung dài nhất (LCS) cho chữ Hán & Pinyin
  function getLcsDiff(target, spoken) {
    // Làm sạch chuỗi: xóa dấu cách và các dấu câu thông dụng
    const cleanStr = (str) => (str || '').replace(/[\s\p{P}]/gu, '');
    const t = cleanStr(target);
    const s = cleanStr(spoken);

    if (!t) return { html: '', score: 0 };

    // Helper làm sạch Pinyin để so sánh
    const cleanPinyin = (py) => {
      if (!py) return '';
      return py.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z]/g, '');
    };

    // Helper tính độ tương đồng Pinyin không dấu (Levenshtein distance)
    const getPinyinSimilarity = (py1, py2) => {
      const s1 = cleanPinyin(py1);
      const s2 = cleanPinyin(py2);
      if (!s1 || !s2) return 0;
      if (s1 === s2) return 1;

      const track = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
      for (let i = 0; i <= s1.length; i += 1) track[0][i] = i;
      for (let j = 0; j <= s2.length; j += 1) track[j][0] = j;
      for (let j = 1; j <= s2.length; j += 1) {
        for (let i = 1; i <= s1.length; i += 1) {
          const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
          track[j][i] = Math.min(
            track[j - 1][i] + 1,
            track[j][i - 1] + 1,
            track[j - 1][i - 1] + indicator
          );
        }
      }
      const distance = track[s2.length][s1.length];
      const maxLength = Math.max(s1.length, s2.length);
      return maxLength > 0 ? (1 - distance / maxLength) : 0;
    };

    // Phân tích Pinyin từng chữ Hán (có fallback khi pinyin-pro chưa load)
    const hasPinyinLib = !!(window.pinyinPro && typeof window.pinyinPro.pinyin === 'function');
    let tPinyins = [];
    let sPinyins = [];
    try {
      tPinyins = hasPinyinLib ? window.pinyinPro.pinyin(t).split(/\s+/) : [];
      sPinyins = hasPinyinLib ? window.pinyinPro.pinyin(s).split(/\s+/) : [];
    } catch (e) {
      console.warn('pinyin-pro lỗi, fallback sang so khớp chữ thuần:', e);
      tPinyins = [];
      sPinyins = [];
    }

    // Tạo danh sách đối tượng
    const tArr = [];
    for (let k = 0; k < t.length; k++) {
      tArr.push({
        char: t[k],
        pinyin: tPinyins[k] || '',
        rawPinyin: cleanPinyin(tPinyins[k] || '')
      });
    }

    const sArr = [];
    for (let k = 0; k < s.length; k++) {
      sArr.push({
        char: s[k] || '',
        pinyin: sPinyins[k] || '',
        rawPinyin: cleanPinyin(sPinyins[k] || '')
      });
    }

    if (sArr.length === 0) {
      let html = '';
      for (const item of tArr) {
        html += `<span class="char-result incorrect">${esc(item.char)}</span>`;
      }
      return { html, score: 0 };
    }

    const m = tArr.length;
    const n = sArr.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    // Hàm chấm điểm khớp giữa ký tự target i và spoken j
    // Trả về: 2 (Khớp hoàn toàn: trùng chữ Hán hoặc trùng Pinyin có dấu)
    //         1 (Khớp gần đúng: trùng Pinyin không dấu hoặc độ tương đồng >= 60%)
    //         0 (Không khớp)
    function getMatchScore(itemT, itemS) {
      if (!itemT || !itemS) return 0;
      if (itemT.char === itemS.char || (itemT.pinyin && itemT.pinyin === itemS.pinyin)) {
        return 2;
      }
      if (itemT.rawPinyin && itemT.rawPinyin === itemS.rawPinyin) {
        return 1;
      }
      if (getPinyinSimilarity(itemT.pinyin, itemS.pinyin) >= 0.6) {
        return 1;
      }
      return 0;
    }

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const match = getMatchScore(tArr[i - 1], sArr[j - 1]);
        if (match > 0) {
          dp[i][j] = dp[i - 1][j - 1] + match;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    let i = m, j = n;
    const matchResults = {};
    const matchedIndicesTtoS = {};
    while (i > 0 && j > 0) {
      const match = getMatchScore(tArr[i - 1], sArr[j - 1]);
      if (match > 0) {
        matchResults[i - 1] = match;
        matchedIndicesTtoS[i - 1] = j - 1;
        i--;
        j--;
      } else if (dp[i - 1][j] >= dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }

    let html = '';
    let totalScorePoints = 0;
    const maxScorePoints = m * 2;

    for (let k = 0; k < tArr.length; k++) {
      const match = matchResults[k] || 0;
      const char = tArr[k].char;
      if (match === 2) {
        totalScorePoints += 2;
        html += `<span class="char-result correct">${esc(char)}</span>`;
      } else if (match === 1) {
        totalScorePoints += 1.5; // Đọc gần đúng nhận 75% số điểm
        html += `<span class="char-result partial" title="Phát âm gần đúng (hoặc sai thanh điệu)">${esc(char)}</span>`;
      } else {
        html += `<span class="char-result incorrect">${esc(char)}</span>`;
      }
    }

    const score = maxScorePoints > 0 ? Math.round((totalScorePoints / maxScorePoints) * 100) : 0;

    // Phân tích chi tiết lỗi phát âm
    const errorDetails = [];
    if (score < 80) {
      const sMatched = Array(sArr.length).fill(false);
      for (const tIdx in matchedIndicesTtoS) {
        sMatched[matchedIndicesTtoS[tIdx]] = true;
      }

      const tToSMapping = {};
      for (let k = 0; k < tArr.length; k++) {
        const match = matchResults[k] || 0;
        if (match === 0) {
          let bestJ = -1;
          let minDistance = Infinity;
          for (let j = 0; j < sArr.length; j++) {
            if (!sMatched[j]) {
              const dist = Math.abs(k - j);
              if (dist < minDistance && dist <= 2) {
                minDistance = dist;
                bestJ = j;
              }
            }
          }
          if (bestJ !== -1) {
            tToSMapping[k] = bestJ;
            sMatched[bestJ] = true;
          }
        }
      }

      for (let k = 0; k < tArr.length; k++) {
        const match = matchResults[k] || 0;
        const charT = tArr[k].char;
        const pyT = tArr[k].pinyin || 'không rõ';

        if (match === 1) {
          const sIdx = matchedIndicesTtoS[k];
          const charS = sArr[sIdx] ? sArr[sIdx].char : '';
          const pyS = sArr[sIdx] ? (sArr[sIdx].pinyin || 'không rõ') : 'không rõ';
          if (charS === charT) {
            errorDetails.push(`Chữ <b style="color:var(--text-color, #fff); font-size: 1.05rem;">${esc(charT)}</b> (mẫu đọc là <span style="color:#2ecc71; font-weight:bold;">${esc(pyT)}</span>) bạn đọc sai thanh điệu thành <span style="color:var(--gold-2, #d4af37); font-weight:bold;">${esc(pyS)}</span>.`);
          } else {
            errorDetails.push(`Chữ <b style="color:var(--text-color, #fff); font-size: 1.05rem;">${esc(charT)}</b> (mẫu đọc là <span style="color:#2ecc71; font-weight:bold;">${esc(pyT)}</span>) bạn phát âm gần giống <span style="color:var(--gold-2, #d4af37); font-weight:bold;">${esc(pyS)}</span> (nhận diện thành "${esc(charS)}").`);
          }
        } else if (match === 0) {
          if (k in tToSMapping) {
            const sIdx = tToSMapping[k];
            const charS = sArr[sIdx].char;
            const pyS = sArr[sIdx].pinyin || 'không rõ';
            errorDetails.push(`Chữ <b style="color:var(--text-color, #fff); font-size: 1.05rem;">${esc(charT)}</b> (mẫu đọc là <span style="color:#2ecc71; font-weight:bold;">${esc(pyT)}</span>) bạn phát âm sai thành <span style="color:#e74c3c; font-weight:bold;">${esc(pyS)}</span> (nhận diện thành "${esc(charS)}").`);
          } else {
            errorDetails.push(`Bạn đọc thiếu chữ <b style="color:var(--text-color, #fff); font-size: 1.05rem;">${esc(charT)}</b> (mẫu đọc là <span style="color:#2ecc71; font-weight:bold;">${esc(pyT)}</span>).`);
          }
        }
      }
    }

    return { html, score, errorDetails };
  }

  // --- Các hàm Wrapper kết nối sang app.js ---
  function speakOutput(text) {
    if (window.HanziUI && typeof window.HanziUI.speak === 'function') {
      window.HanziUI.speak(text);
    } else {
      console.warn('Giọng đọc chưa sẵn sàng.');
    }
  }

  function addPointsReward(n) {
    if (window.HanziUI && typeof window.HanziUI.addPoints === 'function') {
      window.HanziUI.addPoints(n);
    } else {
      console.warn('Cộng điểm chưa sẵn sàng.');
    }
  }

  function colorPinyinText(pinyin) {
    if (window.HanziUI && typeof window.HanziUI.colorPinyin === 'function') {
      return window.HanziUI.colorPinyin(pinyin);
    }
    return pinyin;
  }

  function alertUi(msg) {
    if (window.HanziUI && typeof window.HanziUI.alert === 'function') {
      window.HanziUI.alert(msg);
    } else {
      alert(msg);
    }
  }

  function confirmUi(msg, onYes) {
    if (window.HanziUI && typeof window.HanziUI.confirm === 'function') {
      window.HanziUI.confirm(msg, onYes);
    } else {
      if (confirm(msg)) onYes();
    }
  }

  // --- Khai báo hàm dùng chung sang HanziUI để app.js gọi ---
  window.addEventListener('DOMContentLoaded', () => {
    if (window.HanziUI) {
      window.HanziUI.openPronounceModal = openPronounceModal;
      window.HanziUI.closePronounceModal = closePronounceModal;
    } else {
      window.HanziUI = {
        openPronounceModal: openPronounceModal,
        closePronounceModal: closePronounceModal
      };
    }
  });
})();
