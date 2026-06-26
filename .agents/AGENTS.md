# AGENTS.md — Quy tắc cho AI Assistant (Dự án Học Chữ Hán)

## ⚠️ QUY TẮC BẮT BUỘC — ĐỌC TRƯỚC KHI LÀM BẤT CỨ GÌ

### 1. Đọc nhật ký phát triển TRƯỚC TIÊN
**Trước khi thực hiện bất kỳ tác vụ nào** (sửa code, thêm tính năng, debug, trả lời câu hỏi), AI **BẮT BUỘC** phải:

1. Đọc file **`devlog.md`** ở thư mục gốc dự án (`d:\apphoctiengtrung\devlog.md`) để nắm lịch sử thay đổi, lỗi đã sửa, kế hoạch, và cấu hình hiện tại.
2. Đọc file **`CLAUDE.md`** ở thư mục gốc để nắm quy tắc thiết kế giao diện và quản lý file.

### 2. Cập nhật nhật ký SAU KHI HOÀN THÀNH
Sau khi hoàn thành bất kỳ tác vụ nào, AI phải cập nhật file `devlog.md`:
- Ghi thêm mục mới vào ngày hiện tại (hoặc tạo mục ngày mới nếu sang ngày mới).
- Ghi rõ: tên tính năng/lỗi, files đã thay đổi, cách sửa, ghi chú quan trọng.
- Cập nhật mục "Kế hoạch tiếp theo" nếu có thay đổi.

### 3. Cấu trúc dự án hiện tại
```
d:\apphoctiengtrung\
├── deploy/              # Thư mục chứa toàn bộ mã nguồn web
│   ├── index.html       # Trang chính (chứa tất cả HTML + <script> tags)
│   ├── app.js           # Logic chính (~1800 dòng — KHÔNG thêm code vào đây!)
│   ├── exam.js          # Logic bài kiểm tra
│   ├── aichat.js        # Logic trò chuyện AI + luyện đọc phát âm
│   ├── styles.css       # CSS chính
│   └── aichat.css       # CSS cho trang trò chuyện AI
├── CLAUDE.md            # Quy tắc thiết kế giao diện & quản lý file
├── devlog.md            # 📒 Nhật ký phát triển (file này)
└── .agents/
    └── AGENTS.md        # Quy tắc cho AI Assistant (file này)
```

### 4. Lưu ý kỹ thuật quan trọng
- **Gemini API:** Dùng endpoint `v1beta`, header `x-goog-api-key`, model `gemini-2.5-flash`.
- **Cache busting:** Mỗi lần sửa file JS/CSS → bump `?v=` trong index.html.
- **Dark/Light mode:** Mọi thay đổi UI phải kiểm tra ở CẢ hai chế độ.
- **Mobile:** Đảm bảo giao diện hoạt động tốt trên màn hình nhỏ.
- **File size:** Không để file vượt ~600 dòng. Tạo file mới cho tính năng mới.

---

## 5. Quy tắc thiết kế giao diện & quản lý file (từ CLAUDE.md)

**Mọi thay đổi giao diện phải nổi bật & dùng tốt ở cả 2 tông màu và 2 loại thiết bị.**

- **Tông sáng & tối:** Bất kỳ chữ/nền/màu nào thêm hoặc sửa phải kiểm tra tương phản ở CẢ `body.light` (nền trắng) lẫn mặc định (nền tối). Đừng để chữ sáng màu (vàng/kem) nằm trên nền trắng → mờ. Khi cần, thêm override `body.light .selector { ... }`.
- **Mobile & máy tính:** Bố cục phải gọn gàng, không tràn/lệch trên màn hình hẹp lẫn rộng. Dùng đơn vị tương đối (`clamp`, `%`, `flex`), kiểm tra ở breakpoint hẹp.

### Quản lý file (phát triển lâu dài)

**Không để file phình to mất kiểm soát. Chủ động tách file khi cần — đừng đợi đến lúc quá dài.**

- **Ngưỡng tách:** Khi một file vượt ~**600 dòng** (hoặc gánh nhiều trách nhiệm rõ rệt), TÁCH ngay phần độc lập ra file mới — đừng tiếp tục dồn vào. Đã có tiền lệ `app.js` ~1800 dòng quá dài; **không để lặp lại**.
- **Tách theo trách nhiệm:** Mỗi file một mảng việc rõ ràng (ví dụ: học/lật thẻ, kiểm tra, ghép thẻ, bài khóa, thành viên/đồng bộ, Firebase/đám mây, tiện ích chung). CSS dài cũng tách theo khu vực.
- **Khi thêm tính năng mới:** Nếu tính năng đủ lớn, tạo file riêng ngay từ đầu thay vì nhét vào file sẵn có.
- **An toàn khi tách:** App đang chạy thật cho học sinh — tách dần từng phần, sau mỗi bước chạy `node --check` và kiểm thử lại, không sửa kiến trúc ồ ạt một lần. Giữ thứ tự nạp `<script>`/import đúng để không vỡ phạm vi biến.
- **Bù version:** Mỗi lần đổi file phải bump `?v=` trong `index.html` để qua cache.

### Nguyên tắc code

- **Nghĩ trước khi code:** Nêu rõ giả định. Nếu không chắc, hỏi lại.
- **Đơn giản là nhất:** Không thêm tính năng ngoài yêu cầu. Không trừu tượng hóa code dùng 1 lần.
- **Sửa đúng chỗ:** Chỉ sửa phần liên quan đến yêu cầu. Không "cải thiện" code xung quanh.
- **Kiểm chứng:** Mọi thay đổi phải có tiêu chí kiểm tra rõ ràng.

