# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 0. Project UI Rules (Học Chữ Hán)

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

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
