# 📒 Nhật Ký Phát Triển - Dự Án Học Chữ Hán

> **Mục đích:** Ghi lại mọi thay đổi, kế hoạch, lỗi đã sửa theo từng ngày.
> AI Assistant **BẮT BUỘC** phải đọc file này trước khi thực hiện bất kỳ tác vụ nào.

---

## 📅 2026-06-27 (Thứ Bảy)

### ✅ Đã hoàn thành

#### 1. Phân tách lịch sử trò chuyện AI theo tài khoản thành viên
- **Mô tả:** Thay vì chia sẻ chung một lịch sử chat trên trình duyệt, lịch sử trò chuyện của AI giáo viên "Tiểu Hoa" được lưu và tải độc lập theo từng tài khoản thành viên (`localStorage` key có chứa profile ID dạng `hanzi-aichat-history-{profileId}`).
- **Giải quyết bất đồng bộ:** Sử dụng cơ chế so sánh chuỗi JSON profile thô trong `localStorage` kết hợp thăm dò (polling) định kỳ `setInterval` 500ms để tự động phát hiện và đồng bộ hóa tức thì lịch sử chat khi học sinh đăng nhập, đăng ký mới, hoặc chuyển đổi tài khoản, loại bỏ triệt để xung đột dữ liệu bất đồng bộ từ Firestore.
- **Files thay đổi:**
  - `deploy/aichat.js` (BUMP) — Thiết lập `getCurrentHistoryKey`, `loadChatHistory`, `saveChatHistory`, `clearChatHistory`, `checkUserSession` và polling.
  - `deploy/index.html` — Bump phiên bản file `aichat.js?v=11` để bypass cache.

#### 2. Tái cấu trúc phân tách tệp `app.js` khổng lồ thành 11 file độc lập
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
#### 3. Gom tất cả tệp JavaScript vào thư mục con `js/`
- **Mô tả:** Di chuyển toàn bộ 14 tệp tin JavaScript ứng dụng (kể cả tệp sao lưu `app.js.bak`) vào thư mục `deploy/js/` để giữ thư mục gốc sạch sẽ, bố cục gọn gàng.
- **Duy trì hoạt động offline:** Riêng tệp `sw.js` (Service Worker) tiếp tục được giữ lại ở thư mục gốc của trang web (`deploy/sw.js`) để không vi phạm phạm vi bảo mật (Scope) của Service Worker, đảm bảo khả năng chạy offline ổn định.
- **Files thay đổi:**
  - `deploy/index.html` — Thay đổi toàn bộ các đường dẫn nạp tệp JavaScript trỏ đến thư mục con `js/`.
  - `deploy/sw.js` — Cập nhật danh sách lưu đệm offline `ASSETS` với đường dẫn mới dạng `./js/filename.js`, thêm `./js/aichat.js` và nâng mã cache lên phiên bản `hochan-v10`.

#### 4. Thống kê chi tiết tiến độ SRS của học sinh ở tab Thành viên
- **Mô tả:** Khi bấm vào tên học sinh trong tab Thành viên, hệ thống sẽ vẽ biểu đồ phân phối cấp độ SRS (Cấp 1 - 8) kèm theo thống kê chỉ số Chưa học, Đang ôn, Đã thuộc và dự báo số từ đến hạn ôn tập hôm nay cũng như ngày mai.
- **Files thay đổi/tạo mới:**
  - `deploy/dashboard.css` (MỚI) — Chứa toàn bộ CSS định hình giao diện thẻ chỉ số, biểu đồ SRS, responsive di động và override độ tương phản cho Light Mode.
  - `deploy/js/dashboard.js` (BUMP) — Tính toán thống kê SRS, đếm số chữ ở mỗi cấp độ, lọc hạn ôn tập hôm nay & ngày mai, và render HTML tương ứng trong `memberDetailHtml`.
  - `deploy/index.html` (BUMP) — Nạp stylesheet `dashboard.css?v=1` và nâng cache version `js/dashboard.js?v=2`.
  - `deploy/sw.js` (BUMP) — Cập nhật tài nguyên cache offline `ASSETS` bao gồm `./dashboard.css`, nâng cache Service Worker lên `hochan-v15`.

### 🐛 Lỗi đã sửa

#### 1. Khắc phục ReferenceError khi tách file script chạy tuần tự
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

#### 2. Khắc phục lỗi AI quá tải (Spikes in demand / ResourceExhausted)
- **Mô tả:** Khi model AI mặc định gặp lỗi quá tải của Google (trả về status 503 hoặc tin nhắn báo quá tải "high demand"), hệ thống không tự động chuyển đổi sang model dự phòng (auto-fallback), dẫn đến hiển thị thông báo lỗi thô cho người dùng. Đồng thời, API phân tích giọng nói (`callGeminiAnalysis`) chưa được tích hợp cơ chế tự động đổi model.
- **Cách sửa:**
  - Cải tiến hàm `callGeminiAPI` trong `aichat.js` để phát hiện lỗi quá tải từ cả mã trạng thái HTTP (429, 503, 504, 408) lẫn chuỗi ký tự lỗi JSON (như "high demand", "resource_exhausted", "unavailable", "temporarily"). Khi phát hiện các lỗi này, hệ thống sẽ lập tức chuyển đổi sang model khác trong danh sách (Gemini 2.5 Flash Lite / Gemini 2.0 Flash Lite) và ghi nhớ lựa chọn mới vào `localStorage`.
  - Tái cấu trúc hàm `callGeminiAnalysis` để hỗ trợ cơ chế nạp đè `modelOverride` và danh sách model đã thử `triedModels`, áp dụng cơ chế tự động chuyển model tương tự như `callGeminiAPI`.
  - Bump phiên bản file `aichat.js?v=12` trong `index.html` và nâng Service Worker cache lên `hochan-v12`.
- **Files thay đổi:**
  - `deploy/js/aichat.js` — Cập nhật logic xử lý lỗi và thêm cơ chế fallback tự động cho cả trò chuyện và phân tích giọng nói.
  - `deploy/index.html` — Bump phiên bản `aichat.js?v=12`.
  - `deploy/sw.js` — Cập nhật cache lên `hochan-v12`.

#### 3. Tích hợp tính năng Giáo viên AI nhận xét nét viết chữ Hán
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

### 🔧 Cấu hình hiện tại
- **API Key:** Lưu tại `localStorage`.
- **Model mặc định:** `gemini-2.5-flash` (và tự động fallback).
- **CSS Cache:** `aichat.css?v=2`, `dashboard.css?v=1`, **JS Cache:** `js/core.js?v=3`, `js/db.js?v=1`, `js/auth.js?v=2`, `js/flashcard.js?v=1`, `js/vocab.js?v=1`, `js/quiz.js?v=1`, `js/game.js?v=1`, `js/passage.js?v=1`, `js/writer.js?v=2`, `js/dashboard.js?v=2`, `js/app_init.js?v=1`, `js/exam.js?v=17`, `js/aichat.js?v=15`.

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
