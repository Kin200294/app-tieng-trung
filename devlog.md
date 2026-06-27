# 📒 Nhật Ký Phát Triển - Dự Án Học Chữ Hán

> **Mục đích:** Ghi lại mọi thay đổi, kế hoạch, lỗi đã sửa theo từng ngày.
> AI Assistant **BẮT BUỘC** phải đọc file này trước khi thực hiện bất kỳ tác vụ nào.

---

## 📅 2026-06-27 (Thứ Bảy)

### ✅ Đã hoàn thành

#### 1. Tích hợp cổng kết nối AI Hugging Face Inference API
- **Mô tả:** Tích hợp tùy chọn cổng kết nối mới bên cạnh Google Gemini, OpenRouter và Groq trong phần cài đặt API Key. Hugging Face Serverless Inference cho phép gọi trực tiếp các mô hình lớn hoàn toàn miễn phí. Cấu hình mặc định sử dụng API Key cá nhân của người dùng đã cung cấp (mã hóa Base64) để tự động điền khi để trống. Hỗ trợ 3 model hàng đầu: Qwen 2.5 72B Instruct (HF), Llama 3.3 70B Instruct (HF), và DeepSeek R1 Distill Qwen 32B (HF). Đã đồng bộ đầy đủ cổng kết nối Hugging Face cho cả 3 mô-đun: Trò chuyện AI, Luyện phát âm AI, và Phân tích nét viết chữ Hán.
- **Cách sửa:**
  - Thêm cổng Hugging Face vào dropdown select `#aiProviderSelect` trong `index.html`.
  - Định nghĩa hàm lấy key `window.getHuggingFaceKey` chứa token mặc định được mã hóa Base64 trong `core.js`.
  - Khai báo danh sách model Hugging Face, cấu hình giao diện UI, lưu API Key vào `localStorage` trong `aichat.js`.
  - Viết các hàm kết nối API Hugging Face `callHuggingFaceAPI` và `callHuggingFaceAnalysis` trỏ về endpoint serverless `/v1/chat/completions`.
  - Tích hợp nhánh `provider === 'huggingface'` vào hàm `callWriteAiAnalysis` tại `writer.js`.
  - Tăng mã cache-busting trong `index.html` cho `core.js`, `aichat.js` và `writer.js` lên `v=10`, `v=34` và `v=14`.
  - Nâng cache Service Worker trong `sw.js` lên `hochan-v38`.
- **Files thay đổi:**
  - `deploy/index.html` — Thêm cổng Hugging Face và bump phiên bản script.
  - `deploy/js/core.js` — Thêm hàm `getHuggingFaceKey()`.
  - `deploy/js/aichat.js` — Định nghĩa model list, hàm gọi API và giao diện cài đặt cho Hugging Face.
  - `deploy/js/writer.js` — Thêm Hugging Face vào hàm phân tích nét viết chữ Hán.
  - `deploy/sw.js` — Nâng cache Service Worker lên `hochan-v38`.

#### 2. Tích hợp cổng kết nối AI Groq API tốc độ siêu cao
- **Mô tả:** Tích hợp tùy chọn cổng kết nối mới bên cạnh Google Gemini và OpenRouter trong phần cài đặt API Key. Groq cung cấp các mô hình tốc độ xử lý hàng nghìn tokens/giây, mang lại trải nghiệm mượt mà tức thì cho học sinh. Cung cấp 3 model nổi tiếng: Llama 3.3 70B (Khuyên dùng), Llama 3.1 8B (Siêu nhanh), và Gemma 2 9B. Đã đồng bộ đầy đủ cổng kết nối Groq cho cả 3 mô-đun: Trò chuyện AI, Luyện phát âm AI, và Phân tích nét viết chữ Hán. Tự động xoay vòng qua các model Groq khác khi gặp lỗi quá tải hoặc giới hạn lượt gọi (429).
- **Cách sửa:**
  - Thêm cổng Groq vào dropdown select `#aiProviderSelect` trong `index.html`.
  - Định nghĩa hàm lấy key `window.getGroqKey` trong `core.js`.
  - Khai báo danh sách model Groq, cấu hình giao diện UI, lưu API Key vào `localStorage` trong `aichat.js`.
  - Viết các hàm kết nối API Groq `callGroqAPI` và `callGroqAnalysis` trỏ về endpoint `https://api.groq.com/openai/v1/chat/completions`.
  - Tích hợp nhánh `provider === 'groq'` vào hàm `callWriteAiAnalysis` tại `writer.js`.
  - Tăng mã cache-busting trong `index.html` cho `core.js`, `aichat.js` và `writer.js` lên `v=9`, `v=33` và `v=13`.
  - Nâng cache Service Worker trong `sw.js` lên `hochan-v37`.
- **Files thay đổi:**
  - `deploy/index.html` — Thêm cổng Groq và bump phiên bản script.
  - `deploy/js/core.js` — Thêm hàm `getGroqKey()`.
  - `deploy/js/aichat.js` — Định nghĩa model list, hàm gọi API và giao diện cài đặt cho Groq.
  - `deploy/js/writer.js` — Thêm Groq vào hàm phân tích nét viết chữ Hán.
  - `deploy/sw.js` — Nâng cache Service Worker lên `hochan-v37`.

#### 2. Nâng cấp thiết kế Typography, hoạt họa suy nghĩ & Cố định chiều cao khung Chat để cuộn tin nhắn
- **Mô tả:** Tích hợp font chữ sans-serif cao cấp `Outfit` và `Inter` từ Google Fonts giúp giao diện hiện đại hơn. Tích hợp bong bóng hoạt họa 3 dấu chấm nhấp nhô (Typing Indicator) kèm hiệu ứng phát sáng nhẹ nhàng khi AI đang nghĩ. Đặc biệt, loại bỏ thuộc tính `flex: 1` và cố định chiều cao `.aichat-window` ở mức `520px` trên desktop, buộc danh sách tin nhắn `.aichat-messages` tự động cuộn dọc (scroll-y) bên trong khung thay vì kéo dài trang web vô tận. Đồng thời nâng cấp font chữ cho chữ Hán trong bong bóng chat bằng Google Font `Noto Sans SC` và font hệ thống hiện đại (`PingFang SC`, `Microsoft YaHei`) thay cho font Serif/StoryScript truyền thống để hiển thị trơn tru, mịn đẹp.
- **Files thay đổi:**
  - `deploy/index.html` — Tải font `Outfit`, `Inter` và `Noto Sans SC` từ Google Fonts, bump version cache CSS/JS.
  - `deploy/styles.css` — Thiết lập font-family mặc định cho body thành `Outfit` và `Inter`.
  - `deploy/aichat.css` — Thiết lập chiều cao cố định `520px` cho `.aichat-window` trên desktop, bổ sung CSS hoạt họa. Thay đổi font-family của `.bubble-hanzi` sang các font sans-serif tiếng Trung hiện đại.
  - `deploy/js/aichat.js` — Thêm logic tự động chèn/xóa bong bóng thinking khi `isThinking` thay đổi trạng thái.
  - `deploy/sw.js` — Nâng cache version lên `hochan-v27`.

#### 2. Tự động điền và xoay vòng API Key dự phòng (API Key Rotation)
- **Mô tả:** Học sinh không cần lấy và nhập API key thủ công nữa. Hệ thống tự động thiết lập và lưu trữ 3 API key mặc định do giáo viên cung cấp. Nếu người dùng để trống phần API Key, hệ thống tự động tải key mặc định và kích hoạt cơ chế xoay vòng mà không đưa ra cảnh báo làm phiền người dùng. Nếu trong quá trình sử dụng gặp lỗi quá tải quota (429) hoặc lỗi xác thực (400/403), hệ thống sẽ tự động xoay vòng sang key tiếp theo trong danh sách dự phòng và thực hiện lại yêu cầu API ngay lập tức.
- **Files thay đổi:**
  - `deploy/js/core.js` — Thêm danh sách API key mặc định, hàm `getGeminiKey()`, `rotateGeminiKey()` và `isDefaultGeminiKey()`. Đồng bộ giá trị input khi khôi phục key.
  - `deploy/js/aichat.js` — Sử dụng `window.getGeminiKey()` làm dự phòng khi key rỗng thay vì ném cảnh báo, nâng cấp `callGeminiAPI` và `callGeminiAnalysis` tự động xoay vòng key.
  - `deploy/js/writer.js` — Tương thích hóa `callWriteAiAnalysis` để thực hiện xoay vòng API Key tương tự khi phân tích nét viết lỗi.
  - `deploy/index.html` — Bump phiên bản JS file cache (`core.js?v=5`, `writer.js?v=3`, `aichat.js?v=22`).
  - `deploy/sw.js` — Nâng cache version lên `hochan-v24`.

#### 3. Phân tách lịch sử trò chuyện AI theo tài khoản thành viên
- **Mô tả:** Thay vì chia sẻ chung một lịch sử chat trên trình duyệt, lịch sử trò chuyện của AI giáo viên "Tiểu Hoa" được lưu và tải độc lập theo từng tài khoản thành viên (`localStorage` key có chứa profile ID dạng `hanzi-aichat-history-{profileId}`).
- **Giải quyết bất đồng bộ:** Sử dụng cơ chế so sánh chuỗi JSON profile thô trong `localStorage` kết hợp thăm dò (polling) định kỳ `setInterval` 500ms để tự động phát hiện và đồng bộ hóa tức thì lịch sử chat khi học sinh đăng nhập, đăng ký mới, hoặc chuyển đổi tài khoản, loại bỏ triệt để xung đột dữ liệu bất đồng bộ từ Firestore.
- **Files thay đổi:**
  - `deploy/aichat.js` (BUMP) — Thiết lập `getCurrentHistoryKey`, `loadChatHistory`, `saveChatHistory`, `clearChatHistory`, `checkUserSession` và polling.
  - `deploy/index.html` — Bump phiên bản file `aichat.js?v=11` để bypass cache.

#### 4. Tái cấu trúc phân tách tệp `app.js` khổng lồ thành 11 file độc lập
- **Mô tả:** Phân tách tệp `app.js` dài hơn 2900 dòng thành 11 tệp tin JavaScript nhỏ gọn, tách biệt theo trách nhiệm và mảng tính năng. Đảm bảo tuân thủ nghiêm ngặt quy tắc quản lý file dự án (<600 dòng/file).
- **Thiết kế an toàn & Chạy offline:** Sử dụng cơ chế chia sẻ Scope toàn cục thay vì ES Modules để duy trì khả năng nhấp đúp chạy offline hoàn toàn (`file://`) trên thiết bị học sinh.
- **Files thay đổi/tạo mới:**
  - `deploy/core.js` (MỚI - 311 dòng) — Biến trạng thái toàn cục, DOM elements, các hàm lưu trữ cục bộ, popup, định dạng Pinyin và âm thanh cơ bản.
  - `deploy/db.js` (MỚI - 65 dòng) — Kết nối Firebase và đồng bộ từ vựng chung lớp.
  - `deploy/auth.js` (MỚI - 227 dòng) — Đăng ký tài khoản, nạp hồ sơ, đồng bộ tiến độ SRS cá nhân.
  - `deploy/flashcard.js` (MỚI - 274 dòng) — Thẻ flashcard, Lazy Loading cuộn trang và các nút lọc.
  - `deploy/vocab.js` (MỚI - 430 dòng) — Giao diện quản lý từ vựng và nhập/xuất Excel CSV.
  - `deploy/quiz.js` (MỚI - 383 dòng) — Trắc nghiệm và tự kiểm tra SRS kèm phím tắt.
  - `deploy/game.js` (MỚI - 191 dòng) — Trò chơi ghép cặp flashcard.
  - `deploy/passage.js` (MỚI - 425 dòng) — Bài khóa, trình ghép câu và soạn thảo bài khóa.
  - `deploy/writer.js` (MỚI - 205 dòng) — Vẽ chữ Hán và minh họa nét viết.
  - `deploy/dashboard.js` (MỚI - 356 dòng) — Bảng vàng xếp hạng và báo cáo thống kê độ khó của lớp.
  - `deploy/app_init.js` (MỚI - 81 dòng) — Khởi động liên kết tab, phím tắt chung, Service Worker và boot ứng dụng.
  - `deploy/index.html` (BUMP) — Nạp tuần tự 11 file script mới thay thế `app.js`.
  - `deploy/sw.js` (BUMP) — Cập nhật tài nguyên cache offline `ASSETS` thay `app.js` bằng 11 file mới, nâng cache lên `hochan-v9`.
  - `deploy/app.js` (XÓA) — Sao lưu thành `app.js.bak` và xóa tệp gốc.
#### 5. Gom tất cả tệp JavaScript vào thư mục con `js/`
- **Mô tả:** Di chuyển toàn bộ 14 tệp tin JavaScript ứng dụng (kể cả tệp sao lưu `app.js.bak`) vào thư mục `deploy/js/` để giữ thư mục gốc sạch sẽ, bố cục gọn gàng.
- **Duy trì hoạt động offline:** Riêng tệp `sw.js` (Service Worker) tiếp tục được giữ lại ở thư mục gốc của trang web (`deploy/sw.js`) để không vi phạm phạm vi bảo mật (Scope) của Service Worker, đảm bảo khả năng chạy offline ổn định.
- **Files thay đổi:**
  - `deploy/index.html` — Thay đổi toàn bộ các đường dẫn nạp tệp JavaScript trỏ đến thư mục con `js/`.
  - `deploy/sw.js` — Cập nhật danh sách lưu đệm offline `ASSETS` với đường dẫn mới dạng `./js/filename.js`, thêm `./js/aichat.js` và nâng mã cache lên phiên bản `hochan-v10`.

#### 6. Thống kê chi tiết tiến độ SRS của học sinh ở tab Thành viên
- **Mô tả:** Khi bấm vào tên học sinh trong tab Thành viên, hệ thống sẽ vẽ biểu đồ phân phối cấp độ SRS (Cấp 1 - 8) kèm theo thống kê chỉ số Chưa học, Đang ôn, Đã thuộc và dự báo số từ đến hạn ôn tập hôm nay cũng như ngày mai.
- **Files thay đổi/tạo mới:**
  - `deploy/dashboard.css` (MỚI) — Chứa toàn bộ CSS định hình giao diện thẻ chỉ số, biểu đồ SRS, responsive di động và override độ tương phản cho Light Mode.
  - `deploy/js/dashboard.js` (BUMP) — Tính toán thống kê SRS, đếm số chữ ở mỗi cấp độ, lọc hạn ôn tập hôm nay & ngày mai, và render HTML tương ứng trong `memberDetailHtml`.
  - `deploy/index.html` (BUMP) — Nạp stylesheet `dashboard.css?v=1` và nâng cache version `js/dashboard.js?v=2`.
  - `deploy/sw.js` (BUMP) — Cập nhật tài nguyên cache offline `ASSETS` bao gồm `./dashboard.css`, nâng cache Service Worker lên `hochan-v15`.

#### 7. Tích hợp cổng kết nối AI OpenRouter (Miễn phí Llama & Qwen)
- **Mô tả:** Tích hợp tùy chọn cổng kết nối mới bên cạnh Google Gemini trong phần cài đặt API Key. Cho phép người dùng chuyển đổi linh hoạt giữa Google Gemini và OpenRouter. Cấu hình mặc định sử dụng API Key cá nhân của giáo viên đã được cung cấp (mã hóa Base64) để tự động đăng nhập. Hỗ trợ 3 model miễn phí của OpenRouter gồm Qwen 2 7B (Khuyên dùng), Llama 3.1 8B, và Gemma 2 9B. Tự động xoay vòng qua các model miễn phí khác khi gặp lỗi quá tải hoặc giới hạn lượt gọi (429/503). Đã đồng bộ đầy đủ cổng kết nối OpenRouter cho cả 3 mô-đun: Trò chuyện AI, Luyện phát âm AI, và Phân tích nét viết chữ Hán.
- **Files thay đổi:**
  - `deploy/index.html` — Bổ sung selector `#aiProviderSelect`, tối ưu các nhãn cài đặt và bump version cache.
  - `deploy/js/core.js` — Định nghĩa `DEFAULT_OPENROUTER_KEY_B64`, các hàm tiện ích `getOpenRouterKey()`, `getAIProvider()`.
  - `deploy/js/aichat.js` — Thêm hàm `callOpenRouterAPI()` và `callOpenRouterAnalysis()`, bổ sung phân nhánh provider trong logic gọi API chat và chấm điểm phát âm.
  - `deploy/js/writer.js` — Đồng bộ hóa logic `callWriteAiAnalysis()` phân nhánh provider để gửi yêu cầu phân tích nét viết chữ Hán qua OpenRouter.
  - `deploy/sw.js` — Nâng phiên bản cache Service Worker lên `hochan-v28`.

#### 8. Tích hợp cổng kết nối AI DeepSeek (Trực tiếp - Siêu tốt tiếng Trung)
- **Mô tả:** Tiếp tục tích hợp tùy chọn cổng kết nối trực tiếp DeepSeek sử dụng chính API Key cá nhân do giáo viên vừa khởi tạo trên nền tảng DeepSeek (được mã hóa Base64 để lưu trữ an toàn trong code). Người dùng có thể chọn DeepSeek làm cổng kết nối chính để gọi trực tiếp model `deepseek-chat` (V3) – một trong những model tiếng Trung thông minh nhất thế giới. Đã đồng bộ tính năng DeepSeek qua cả 3 mảng: Chat học tập, Luyện phát âm và Sửa nét viết.
- **Files thay đổi:**
  - `deploy/index.html` — Bổ sung tùy chọn `deepseek` vào dropdown `#aiProviderSelect` và tăng mã phiên bản scripts.
  - `deploy/js/core.js` — Định nghĩa `DEFAULT_DEEPSEEK_KEY_B64` chứa khóa DeepSeek mới, thêm hàm `getDeepSeekKey()`.
  - `deploy/js/aichat.js` — Cài đặt biến `deepseekKey` và cấu hình phân nhánh `callDeepSeekAPI()`, `callDeepSeekAnalysis()` để thực hiện gửi nhận dữ liệu trực tiếp với API của DeepSeek.
  - `deploy/js/writer.js` — Nâng cấp `callWriteAiAnalysis()` hỗ trợ phân nhánh xử lý và gửi prompt phân tích nét viết sang DeepSeek.
  - `deploy/sw.js` — Nâng phiên bản cache tĩnh Service Worker lên `hochan-v29`.

### 🐛 Lỗi đã sửa

#### 1. Khắc phục lỗi mã hóa header của OpenRouter và cài đặt Gemini Fallback dự phòng
- **Mô tả:** Sửa lỗi `String contains non ISO-8859-1 code point` trên trình duyệt khi gửi tin nhắn qua OpenRouter. Thêm cơ chế tự động dự phòng sang Gemini khi OpenRouter hoặc DeepSeek gặp lỗi (như hết tiền, sai key, quá tải).
- **Cách sửa:**
  - Loại bỏ các ký tự tiếng Việt có dấu trong header `'X-Title'` (thay thành `'Hoc Chu Han App'`) ở cả `aichat.js` và `writer.js`.
  - Bọc tất cả các hàm gọi API OpenRouter và DeepSeek bằng `try-catch`. Khi xảy ra lỗi, hệ thống sẽ log cảnh báo, cập nhật status và tự động chạy tiếp xuống phần gọi API của Google Gemini dự phòng.
  - Tự động thay đổi model sang `gemini-2.5-flash-lite` và lấy đúng key Gemini của hệ thống nếu rơi vào kịch bản dự phòng.
  - Tăng mã cache-busting trong `index.html` và Service Worker `sw.js` lên `hochan-v30`.

#### 2. Cách ly các cổng kết nối AI và loại bỏ cổng DeepSeek và SiliconFlow
- **Mô tả:** Theo yêu cầu của người dùng, hệ thống đã loại bỏ hoàn toàn 2 cổng kết nối `DeepSeek` (trực tiếp) và `SiliconFlow` (DeepSeek miễn phí) khỏi giao diện lựa chọn và mã nguồn để tập trung tối ưu cho hai cổng chính là Google Gemini và OpenRouter.
- **Cách sửa:**
  - Xóa các thẻ `<option>` của DeepSeek và SiliconFlow trong dropdown select `#aiProviderSelect` ở `index.html`.
  - Loại bỏ các nhánh cấu hình giao diện cài đặt và lưu API Key của DeepSeek và SiliconFlow trong `updateProviderUI` và `btnSaveApiKey.onclick` ở `aichat.js`.
  - Loại bỏ hoàn toàn các khối xử lý logic API của DeepSeek và SiliconFlow trong hàm `callWriteAiAnalysis` ở `writer.js`.
  - Tích hợp tính năng xóa/reset API Key: Nếu người dùng xóa trống ô nhập Key và nhấn Lưu, hệ thống sẽ tự động xóa bản ghi trong `localStorage` và khôi phục lại mã API Key mặc định của hệ thống ngay lập tức.
  - Tăng mã cache-busting trong `index.html` lên `v=32` cho `aichat.js` và `v=12` cho `writer.js`.
  - Nâng cache Service Worker trong `sw.js` lên `hochan-v36`.
- **Files thay đổi:**
  - `deploy/index.html` — Xóa 2 cổng kết nối khỏi dropdown và bump phiên bản file scripts.
  - `deploy/js/aichat.js` — Xóa các nhánh UI và kiểm tra lưu key cho DeepSeek / SiliconFlow.
  - `deploy/js/writer.js` — Dọn dẹp các khối code API thừa của DeepSeek / SiliconFlow.
  - `deploy/sw.js` — Nâng cache Service Worker lên `hochan-v36`.

#### 3. Tích hợp cổng kết nối SiliconFlow để chạy DeepSeek V3 và R1 hoàn toàn miễn phí
- **Mô tả:** Do OpenRouter đã ngừng cung cấp các model DeepSeek miễn phí (trả về lỗi 404 Not Found), và tài khoản DeepSeek trực tiếp có số dư 0 USD báo lỗi `Insufficient Balance`, hệ thống đã bổ sung cổng kết nối SiliconFlow. Cổng này cho phép người dùng đăng ký miễn phí nhận 14 triệu tokens và chạy các model DeepSeek chính chủ mượt mà.
- **Cách sửa:**
  - Thêm cổng SiliconFlow vào dropdown select `#aiProviderSelect` trong `index.html`.
  - Định nghĩa hằng số lưu trữ cho SiliconFlow, đồng bộ danh sách model `deepseek-ai/DeepSeek-V3` và `deepseek-ai/DeepSeek-R1` trong cả `aichat.js` và `writer.js`.
  - Viết các hàm kết nối API SiliconFlow `callSiliconFlowAPI` và `callSiliconFlowAnalysis` trỏ về endpoint `https://api.siliconflow.cn/v1/chat/completions`.
  - Tăng mã cache-busting trong `index.html` cho `aichat.js` và `writer.js` lên `v=28` và `v=8`.
  - Nâng cache Service Worker trong `sw.js` lên `hochan-v32`.
- **Files thay đổi:**
  - `deploy/index.html` — Thêm cổng SiliconFlow và bump version scripts.
  - `deploy/js/aichat.js` — Định nghĩa model list, hàm gọi API và giao diện cài đặt cho SiliconFlow.
  - `deploy/js/writer.js` — Thêm SiliconFlow vào hàm phân tích nét viết chữ Hán.
  - `deploy/sw.js` — Nâng cache Service Worker lên `hochan-v32`.

#### 4. Tích hợp các model Miễn phí qua cổng OpenRouter và loại bỏ các model hết hạn (404)
- **Mô tả:** Do OpenRouter đã gỡ bỏ hoàn toàn phiên bản miễn phí của DeepSeek V3 và R1 (trả về lỗi 404), hệ thống đã cập nhật danh sách các model miễn phí mới nhất của OpenRouter vào ứng dụng để tránh lỗi kết nối và tự động fallback.
- **Cách sửa:**
  - Cập nhật danh sách model OpenRouter sang các dòng máy chủ đang hoạt động miễn phí thực tế: `qwen/qwen3-coder:free` (Alibaba Qwen 3 Coder - cực tốt tiếng Trung), `meta-llama/llama-3.3-70b-instruct:free`, `meta-llama/llama-3.2-3b-instruct:free` và `google/gemma-4-31b-it:free`.
  - Thay thế model mặc định khi kết nối OpenRouter thành `qwen/qwen3-coder:free`.
  - Tăng mã cache-busting trong `index.html` lên `v=29` cho `aichat.js` và `v=9` cho `writer.js`.
  - Nâng cache Service Worker trong `sw.js` lên `hochan-v33`.
- **Files thay đổi:**
  - `deploy/index.html` — Bump phiên bản tập tin scripts.
  - `deploy/js/aichat.js` — Thay thế danh sách model cũ bằng các model mới nhất và đổi default.
  - `deploy/js/writer.js` — Cập nhật model list trong phân tích nét viết chữ.
  - `deploy/sw.js` — Nâng cache Service Worker lên `hochan-v33`.

#### 5. Khắc phục ReferenceError khi tách file script chạy tuần tự
- **Mô tả:** Sửa lỗi `ReferenceError: addPoints is not defined` tại `core.js` và lỗi liên đới `Cannot access 'TONE_MAP' before initialization` tại `toneOf` khiến ứng dụng bị trắng trang hoặc không hiển thị từ vựng (hiển thị 0 chữ) khi chạy qua Live Server hoặc cổng cục bộ.
- **Cách sửa:**
  - Chuyển `addPoints` thành thuộc tính `null` ban đầu trong `window.HanziUI` ở `core.js`.
  - Khai báo gán thực tế `window.addPoints = addPoints` và `window.HanziUI.addPoints = addPoints` ở cuối tệp `auth.js` sau khi hàm này đã được khởi tạo hoàn chỉnh.
  - Tăng phiên bản cache trong `index.html` của `core.js` và `auth.js` lên `v=2`.
  - Tăng cache Service Worker trong `sw.js` lên `hochan-v11`.
- **Files thay đổi:**
  - `deploy/js/core.js` — Khởi tạo an toàn cho `window.HanziUI`.
  - `deploy/js/auth.js` — Xuất hàm `addPoints` ra phạm vi toàn cục.
  - `deploy/index.html` — Bump phiên bản file `core.js?v=2` và `auth.js?v=2`.
  - `deploy/sw.js` — Nâng mã cache lên phiên bản `hochan-v11`.

#### 4. Khắc phục lỗi AI quá tải (Spikes in demand / ResourceExhausted)
- **Mô tả:** Khi model AI mặc định gặp lỗi quá tải của Google (trả về status 503 hoặc tin nhắn báo quá tải "high demand"), hệ thống không tự động chuyển đổi sang model dự phòng (auto-fallback), dẫn đến hiển thị thông báo lỗi thô cho người dùng. Đồng thời, API phân tích giọng nói (`callGeminiAnalysis`) chưa được tích hợp cơ chế tự động đổi model.
- **Cách sửa:**
  - Cải tiến hàm `callGeminiAPI` trong `aichat.js` để phát hiện lỗi quá tải từ cả mã trạng thái HTTP (429, 503, 504, 408) lẫn chuỗi ký tự lỗi JSON (như "high demand", "resource_exhausted", "unavailable", "temporarily"). Khi phát hiện các lỗi này, hệ thống sẽ lập tức chuyển đổi sang model khác trong danh sách (Gemini 2.5 Flash Lite / Gemini 2.0 Flash Lite) và ghi nhớ lựa chọn mới vào `localStorage`.
  - Tái cấu trúc hàm `callGeminiAnalysis` để hỗ trợ cơ chế nạp đè `modelOverride` và danh sách model đã thử `triedModels`, áp dụng cơ chế tự động chuyển model tương tự như `callGeminiAPI`.
  - Bump phiên bản file `aichat.js?v=12` trong `index.html` và nâng Service Worker cache lên `hochan-v12`.
- **Files thay đổi:**
  - `deploy/js/aichat.js` — Cập nhật logic xử lý lỗi và thêm cơ chế fallback tự động cho cả trò chuyện và phân tích giọng nói.
  - `deploy/index.html` — Bump phiên bản `aichat.js?v=12`.
  - `deploy/sw.js` — Cập nhật cache lên `hochan-v12`.

#### 5. Tích hợp tính năng Giáo viên AI nhận xét nét viết chữ Hán
- **Mô tả:** Tích hợp Trí tuệ Nhân tạo (Gemini API) vào bảng Tập viết chữ Hán (`#writeModal`). Khi học sinh viết xong một chữ Hán, hệ thống sẽ mở ra nút bấm cho phép nhờ AI Giáo viên nhận xét chi tiết về thứ tự nét, hướng nét, bộ thủ và hình dáng chữ Hán bằng tiếng Việt.
- **Cách làm:**
  - Bổ sung các thẻ HTML (`#writeAiAnalysisArea`, `#btnWriteAiExplain`, `#writeAiExplanation`) trong modal `#writeModal` ở `index.html`.
  - Thiết lập biến `lastWriteMistakes` lưu giữ số lỗi viết sai và cập nhật các callback của `HanziWriter.quiz` trong `writer.js` để tự động hiển thị nút AI nhận xét khi viết xong.
  - Xây dựng hàm gọi Gemini API `callWriteAiAnalysis` tích hợp prompt nhận diện phân tích bộ thủ và hướng nét, kèm cơ chế tự động chuyển model dự phòng thông minh (fallback) khi quá tải.
  - Bump phiên bản `writer.js?v=2`, `aichat.js?v=13` trong `index.html` và nâng Service Worker lên `hochan-v14`.
- **Files thay đổi:**
  - `deploy/js/writer.js` — Cài đặt biến lưu trữ lỗi, hàm gọi API Gemini và trình xử lý click phân tích chữ.
  - `deploy/index.html` — Cập nhật UI modal tập viết và bump `writer.js?v=2`, `aichat.js?v=13`.
  - `deploy/sw.js` — Nâng mã cache lên `hochan-v14`.

#### 4. Khắc phục lỗi 'aborted' và xung đột âm thanh khi ghi âm luyện đọc trên điện thoại
- **Mô tả:** Lỗi `aborted` xảy ra do âm thanh phát âm mẫu (loa) chưa dừng hẳn đã mở mic thu âm, gây xung đột thiết bị phần cứng, hoặc học sinh mở link trong trình duyệt nhúng của Facebook/Zalo/Messenger (bị hệ thống chặn ghi âm).
- **Cách sửa:**
  - Cải tiến hàm `speak` trong `core.js` cho phép gọi `speak("")` để dừng ngay bất kỳ phát âm mẫu nào đang đọc dở dang.
  - Cập nhật click handler của mic trong `aichat.js` để gọi tắt tiếng loa trước khi chạy nhận diện giọng nói.
  - Sửa logic bắt lỗi `onerror` trong `aichat.js` để hiển thị hướng dẫn chi tiết người dùng sử dụng trình duyệt chuẩn Safari/Chrome khi nhận được mã lỗi `aborted`.
  - Bump cache version trong `index.html` và `sw.js` (hochan-v17).

#### 5. Tối ưu thuật toán chấm điểm phát âm bằng so khớp Pinyin và khoảng cách tương đồng Levenshtein
- **Mô tả:** Khắc phục triệt để hiện tượng học sinh phát âm chuẩn nhưng thuật toán so sánh chữ Hán cũ báo sai (do chữ Hán đồng âm khác nghĩa, hoặc do máy nhận dạng lệch âm cuối như `ni` thành `nin`).
- **Cách sửa:**
  - Nâng cấp hàm `getLcsDiff` trong `aichat.js` chuyển so khớp từ chữ Hán thô sang so khớp Pinyin bằng thư viện `pinyin-pro`.
  - Tích hợp **thuật toán khoảng cách Levenshtein (String Similarity)** đo độ tương đồng Pinyin không dấu. Nếu độ tương đồng >= 60% (như `ni` và `nin`), tính là **Khớp gần đúng** (partial match - hiển thị chữ màu vàng đất/cam và nhận 75% số điểm).
  - Tự động nhận diện chữ đồng âm (Pinyin trùng nhau hoàn toàn) làm **Khớp hoàn toàn** (correct - màu xanh lá, nhận 100% số điểm).
  - Bổ sung CSS cho class `.char-result.partial` trong `aichat.css` tương thích tốt ở cả 2 tông màu sáng/tối.
#### 6. Nâng cấp nhận diện giọng nói bằng nhiều phương án so khớp (Alternatives Matching) và hiển thị kết quả thời gian thực (Interim Results)
- **Mô tả:** Tăng khả năng nhận diện chính xác của Web Speech API bằng cách lấy nhiều phương án phán đoán và tự động chọn phương án tốt nhất, đồng thời tăng tính tương tác bằng việc hiển thị chữ chạy trực tiếp theo thời gian thực khi học sinh đang nói.
- **Cách làm:**
  - Thiết lập `maxAlternatives = 5` và `interimResults = true` cho cả hai trình nhận dạng giọng nói (`speechRec` và `pronounceRec`).
  - Viết lại hàm `onresult` để phân tách kết quả tạm thời (interim transcript) hiển thị lên trạng thái (*Đang nghe: "..."*), và kết quả cuối cùng (final transcript).
  - Đối với modal luyện phát âm: duyệt qua cả 5 phương án dự đoán của Google Speech API, chấm điểm thử từng cái thông qua thuật toán `getLcsDiff` so khớp với từ mẫu, và tự động chọn phương án có điểm số cao nhất để lưu kết quả chấm điểm cuối cùng.
  - Bump phiên bản `aichat.js?v=17` trong `index.html` và nâng Service Worker lên `hochan-v19`.

#### 7. Tối ưu hóa tốc độ phản hồi của AI Giáo viên và chấm điểm phát âm (Auto-stop khi im lặng)
- **Mô tả:** Giải quyết triệt để vấn đề AI phản hồi chậm ở cả phần chấm điểm phát âm (đọc xong) và cuộc trò chuyện của giáo viên.
- **Cách làm:**
  - Tích hợp cơ chế tự ngắt ghi âm khi im lặng: Sau khi học sinh dừng nói 900ms (luyện phát âm) hoặc 1.2 giây (chat chính), hệ thống chủ động gọi `.stop()` để trình duyệt trả về kết quả final ngay lập tức, tiết kiệm 1-2 giây chờ mặc định của trình duyệt.
  - Thay đổi model mặc định từ `gemini-2.5-flash` sang `gemini-2.5-flash-lite` để đẩy tốc độ sinh text lên tối đa và tăng quota RPM lên 30.
  - Tự động chuyển đổi sang model Lite (`gemini-2.5-flash-lite`) cho tác vụ giải thích lỗi phát âm để phản hồi siêu tốc.
  - Giảm `temperature` (xuống `0.4` cho chat và `0.2` cho giải thích phát âm) giúp AI phản hồi tập trung và nhanh hơn.
  - Bump phiên bản `aichat.js?v=18` trong `index.html` và nâng Service Worker lên `hochan-v20`.

#### 8. Sửa triệt để logic Luyện Nói (Speech Recognition) — Khắc phục 6 nguyên nhân gốc rễ
- **Mô tả:** Viết lại hoàn toàn logic `pronounceRec` (nhận diện giọng nói modal luyện đọc) để khắc phục triệt để vấn đề học sinh nói nhưng hệ thống không nhận, hoặc nhiều câu bị lỗi.
- **6 nguyên nhân gốc rễ đã sửa:**
  1. **Không auto-restart khi mic dừng mà chưa có kết quả:** Thêm `continuous = true` và cơ chế auto-restart tối đa 3 lần khi `onend` fire mà chưa có `finalTranscript`.
  2. **Silence timer quá nhạy (900ms):** Tăng lên 1500ms cho từ đơn và 2500ms cho câu dài; chỉ bắt đầu đếm SAU KHI nhận ít nhất 1 interim result (tránh mic warmup).
  3. **Không xử lý finalTranscript rỗng:** Hiển thị thông báo rõ ràng và tự động restart.
  4. **pinyin-pro CDN không ổn định:** Chuyển từ `unpkg.com` sang `cdn.jsdelivr.net` (phiên bản cố định 3.26.0); thêm try-catch fallback so khớp chữ thuần khi lib fail.
  5. **Xung đột bấm mic nhanh liên tục:** Thêm debounce 500ms và xử lý `InvalidStateError` với retry sau 600ms.
  6. **Tích lũy final segments sai:** Dùng `pronounceAccumulatedText` để tích lũy tất cả final segments từ continuous mode.
- **Files thay đổi:**
  - `deploy/js/aichat.js` (BUMP) — Viết lại pronounceRec: onstart, onend (auto-restart), onerror (retry no-speech), onresult (accumulated text), nút mic (debounce + InvalidStateError), closePronounceModal (reset states), getLcsDiff (pinyin-pro fallback), callGeminiAnalysis (try-catch pinyin).
  - `deploy/index.html` — Bump `aichat.js?v=19`, chuyển CDN pinyin-pro sang jsdelivr.
  - `deploy/sw.js` — Nâng cache lên `hochan-v21`.

#### 9. Tự động phân tích chi tiết lỗi phát âm offline
- **Mô tả:** Thay thế dòng thông báo lỗi đơn điệu "Bạn đọc chưa rõ lắm..." bằng mô tả chi tiết lỗi phát âm do thuật toán so khớp LCS tạo ra (nhận biết chữ đọc sai, chữ đọc thiếu, và chữ đọc sai thanh điệu dựa trên so sánh Pinyin). Điều này giúp học sinh biết chính xác mình sai ở đâu mà không cần tốn chi phí gọi AI, đồng thời giữ nguyên nút nhờ AI giáo viên phân tích sâu hơn.
- **Files thay đổi:**
  - `deploy/js/aichat.js` (BUMP v=20) — Cập nhật `getLcsDiff` thu thập và so khớp chỉ số lỗi, cập nhật `processPronounceResult` để render HTML chi tiết lỗi phát âm.
  - `deploy/index.html` — Bump `aichat.js?v=20`.
  - `deploy/sw.js` — Nâng cache Service Worker lên `hochan-v22`.

### 🔧 Cấu hình hiện tại
- **API Key:** Lưu tại `localStorage`.
- **Model mặc định:** `gemini-2.5-flash-lite` (và tự động fallback).
- **CSS Cache:** `aichat.css?v=3`, `dashboard.css?v=1`, **JS Cache:** `js/core.js?v=3`, `js/db.js?v=1`, `js/auth.js?v=2`, `js/flashcard.js?v=1`, `js/vocab.js?v=1`, `js/quiz.js?v=1`, `js/game.js?v=1`, `js/passage.js?v=1`, `js/writer.js?v=2`, `js/dashboard.js?v=2`, `js/app_init.js?v=1`, `js/exam.js?v=17`, `js/aichat.js?v=20`.

### 📋 Kế hoạch tiếp theo
- [ ] Tích hợp tính năng AI hỗ trợ giáo viên chấm nhanh bài tự luận trong bài kiểm tra.
- [ ] Tinh chỉnh prompt phân tích phát âm của AI dựa trên phản hồi thực tế của học sinh.

---

## 📅 2026-06-26 (Thứ Sáu)

### ✅ Đã hoàn thành

#### 1. Tối ưu hóa giao diện di động (Mobile Responsive UI)
- **Mô tả:** Thiết kế và tối ưu responsive cho giao diện trang Chat AI và Modal Luyện đọc phát âm trên thiết bị di động màn hình hẹp (`<600px`).
- **Files thay đổi:**
  - `deploy/aichat.css` (BUMP) — Bổ sung các `@media (max-width: 600px)` query.
  - `deploy/index.html` — Bump phiên bản file CSS `aichat.css?v=2` để vượt cache trình duyệt.

#### 2. Liên kết Modal luyện phát âm với thuật toán SRS
- **Mô tả:** Khi học sinh luyện đọc một từ vựng từ Flashcard ở tab Học, kết quả đúng/sai sẽ tự động cập nhật độ thuộc (level, due, known) của từ đó trong hệ thống SRS (đọc sai tự động bật cờ lưu ý `🚩`).
- **Files thay đổi:**
  - `deploy/app.js` — Thêm callback xử lý kết quả luyện đọc phát âm và gọi `scheduleItem(it, success)`.

#### 3. AI (Gemini) phân tích chi tiết lỗi phát âm tiếng Trung
- **Mô tả:** Tích hợp Gemini API trong Modal phát âm. Khi nói chưa chuẩn, học sinh có thể bấm nút nhờ AI giáo viên phân tích và hướng dẫn sửa lỗi phát âm bằng tiếng Việt chi tiết (lệch thanh điệu, phụ âm, hay vận mẫu nào).
- **Files thay đổi:**
  - `deploy/index.html` — Thêm UI khung phân tích AI và nút bấm; bump `aichat.js?v=10`.
  - `deploy/aichat.js` — Lập trình hàm `callGeminiAnalysis` gọi API Gemini nhận diện và so khớp văn bản, phản hồi JSON, tích hợp nút `#btnPronounceAiExplain`.

#### 4. Admin chỉnh sửa Tên và Điểm số của thành viên (Chuyển sang admin.html)
- **Mô tả:** Tích hợp nút "✏️ Sửa" vào danh sách học sinh của trang Quản trị hệ thống (`admin.html`). Cho phép admin có đầy đủ quyền hành chỉnh sửa trực tiếp Họ tên và Điểm số học sinh, đồng bộ lên Firestore (tự động cập nhật bảng vàng).
- **Files thay đổi:**
  - `deploy/admin.html` — Bổ sung nút bấm "Sửa" và logic prompt nhập Họ tên, Điểm số, lưu Firestore và reload.
  - `deploy/app.js` (REVERT) — Khôi phục nguyên bản (gỡ bỏ form sửa điểm ở trang giáo viên và gỡ bỏ sự kiện md-update).

### 🔧 Cấu hình hiện tại
- **API Key:** Người dùng tự nhập qua Cài đặt, lưu vào `localStorage`.
- **Model mặc định:** `gemini-2.5-flash` (và tự động fallback).
- **CSS Cache:** `aichat.css?v=2`, **JS Cache:** `app.js?v=109`, `aichat.js?v=10`.

### 📋 Kế hoạch tiếp theo
- [ ] Tích hợp tính năng AI hỗ trợ giáo viên chấm nhanh bài tự luận trong bài kiểm tra.
- [ ] Tinh chỉnh prompt phân tích phát âm của AI dựa trên phản hồi thực tế của học sinh.

#### 5. Tối ưu hóa hiệu năng Render — Trang Học (Lazy Loading Flashcard Grid)
- **Mô tả:** Thay vì render toàn bộ thẻ Flashcard cùng lúc (gây lag cứng khi có 500+ chữ trên điện thoại), chuyển sang cơ chế **lazy loading** theo chunk 40 thẻ/đợt. Khi người dùng cuộn xuống gần cuối, `IntersectionObserver` tự động tải thêm 40 thẻ tiếp theo, giảm đáng kể DOM trên màn hình.
- **Thay đổi chính:**
  - Tách logic tạo thẻ ra hàm `buildFlashcard(it, idx, pos)` — dễ bảo trì.
  - Thêm hàm `renderGridChunk()` dùng `DocumentFragment` + `IntersectionObserver` (rootMargin 300px) để preload trước khi user cuộn tới.
  - Tối ưu animation delay: chỉ đặt cho chunk đầu tiên (40 thẻ trong viewport), các chunk sau bỏ qua.
  - Thêm biến module-level: `GRID_CHUNK=40`, `gridView`, `gridRendered`, `gridObserver`.
- **Files thay đổi:**
  - `deploy/app.js` (BUMP v108) — Refactor `renderGrid()` thành lazy loading.
  - `deploy/index.html` — Bump `app.js?v=108`.

#### 6. Event Delegation cho lưới Flashcard — Tối ưu bộ nhớ
- **Mô tả:** Thay vì gán 5 event listener riêng cho MỖI thẻ flashcard (click lật, loa, lưu ý, luyện đọc, tập viết), chuyển sang **Event Delegation** — chỉ 1 listener duy nhất trên `#grid`, dùng `e.target.closest()` xác định mục tiêu click.
- **Hiệu quả:** Với 500 thẻ, giảm từ **2500 listener → 1 listener**. RAM nhẹ hơn đáng kể, đặc biệt trên điện thoại.
- **Thay đổi chính:**
  - `buildFlashcard()` giờ chỉ tạo DOM thuần túy, không gán event. Thêm `card.dataset.idx` để delegation tra cứu dữ liệu.
  - Thêm 1 listener `grid.addEventListener('click', ...)` gán 1 lần duy nhất khi IIFE chạy.
  - Phân tích 4 listener trên `document`/`window` → đã an toàn, gán 1 lần, không trùng lặp.
- **Files thay đổi:**
  - `deploy/app.js` (BUMP v109) — Event Delegation cho #grid.
  - `deploy/index.html` — Bump `app.js?v=109`.

---

## 📅 2026-06-25 (Thứ Tư)

### ✅ Đã hoàn thành

#### 1. Tích hợp Trò chuyện AI (aichat.js + aichat.css)
- **Mô tả:** Thêm trang "Trò chuyện AI" cho phép học sinh nói chuyện với AI giáo viên "Tiểu Hoa" (小华) bằng tiếng Trung.
- **Công nghệ:** Google Gemini API (miễn phí), Web Speech API cho nhận diện giọng nói.
- **Files thay đổi:**
  - `deploy/aichat.js` (MỚI) — Logic chat, gọi API Gemini, nhận diện giọng nói, modal luyện đọc phát âm.
  - `deploy/aichat.css` (MỚI) — Giao diện trang chat AI.
  - `deploy/index.html` — Thêm tab "Trò chuyện AI", HTML cho trang chat, cài đặt API Key, chọn model.

#### 2. Sửa lỗi API Gemini
- **Lỗi 1:** Dùng endpoint `v1` + `snake_case` fields → Google từ chối. → **Sửa:** Chuyển sang `v1beta` + `camelCase` (`systemInstruction`, `generationConfig`, `responseMimeType`).
- **Lỗi 2:** Xác thực bằng `?key=` trên URL không tương thích key dạng `AQ.` → **Sửa:** Chuyển sang header `x-goog-api-key`.
- **Lỗi 3:** Model `gemini-2.0-flash` bị Google đặt quota = 0 RPM trên free tier. → **Sửa:** Chuyển sang `gemini-2.5-flash`.

#### 3. Tính năng chọn Model AI + Auto-fallback
- **Mô tả:** Thêm dropdown cho người dùng chọn model AI (Gemini 2.5 Flash / 2.5 Flash Lite / 2.0 Flash Lite).
- **Auto-fallback:** Khi model đang dùng hết quota (429), hệ thống tự động chuyển sang model khác trong danh sách.
- **Lưu trữ:** Model đã chọn được lưu vào `localStorage` key `hanzi-gemini-model`.

#### 4. Nút xóa lịch sử trò chuyện
- Thêm nút "🗑️ Xóa lịch sử" ở thanh công cụ đầu trang chat.
- Có hộp thoại xác nhận trước khi xóa.

#### 5. Sửa giao diện dark mode cho dropdown chọn model
- Dropdown option bị chữ tối trên nền tối → không đọc được.
- **Sửa:** Đặt `background: #1a1a2e; color: #e0e0e0` cố định cho mỗi `<option>`.

### 🔧 Cấu hình hiện tại
- **API Key:** Người dùng tự nhập qua giao diện Cài đặt (▼), lưu vào `localStorage`.
- **Project Google AI Studio:** `gen-lang-client-0825272516` (project mới, tách riêng cho app học tiếng Trung).
- **Model mặc định:** `gemini-2.5-flash` (15 RPM miễn phí).
- **Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- **Xác thực:** Header `x-goog-api-key`.

### 📝 Ghi chú quan trọng
- File `app.js` đã ~1800 dòng → KHÔNG thêm code vào nữa, tạo file mới cho tính năng mới.
- Mỗi lần sửa file JS/CSS phải bump `?v=` trong `index.html` để bypass cache.
- Luôn kiểm tra giao diện ở CẢ dark mode lẫn light mode.
- API Key dạng `AQ.` (mới) cần dùng header `x-goog-api-key`, KHÔNG dùng `?key=` trên URL.

### 📋 Kế hoạch tiếp theo (chưa làm)
- [ ] Thêm modal luyện đọc phát âm cho từng chữ Hán (đã có code nhưng chưa hoàn thiện).
- [ ] Tối ưu giao diện chat trên mobile.
- [ ] Thêm tính năng AI sửa lỗi phát âm (so sánh giọng nói với câu mẫu).

---

<!-- 
## 📅 YYYY-MM-DD (Thứ X)
### ✅ Đã hoàn thành
### 🐛 Lỗi đã sửa
### 📋 Kế hoạch tiếp theo
### 📝 Ghi chú
-->
