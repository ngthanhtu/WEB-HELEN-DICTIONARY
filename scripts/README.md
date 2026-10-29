# Công cụ phát triển

Chạy từ thư mục gốc repo. Tên file dùng kebab-case; thư mục thể hiện mục đích. Script cũ đã chuyển vào nhóm tương ứng; các lệnh `npm run` đang có vẫn giữ nguyên.

| Nhóm | Lệnh/file | Tác động |
| --- | --- | --- |
| `build/` | `npm run build:topics` | Sinh manifest và 20 bộ từ v2 từ `data/` |
| `build/` | `node scripts/build/word-pos.cjs` | Sinh chỉ mục từ loại |
| `build/` | `node scripts/build/offline-pack.cjs` | Sinh bộ từ ngoại tuyến; đọc tham số trong file trước khi chạy |
| `audit/` | `npm run audit:topics` | Rà 4.000 mục từ v2, bản dịch và quiz |
| `audit/` | `npm run audit:study`, `npm run audit:lexicon` | Rà dữ liệu WordNet/Study |
| `audit/` | `node scripts/audit/topics-v1.cjs` | Rà bộ v1 giữ cho app cũ |
| `database/` | `npm run db:migrate` | Kết nối và tạo bảng chưa tồn tại |
| `security/` | `npm run security:check`, `npm run security:history` | Quét Git; chỉ in vị trí/loại lỗi, không in secret |
| `qa/` | `npm run qa:topic-practice` | IELTS UI, draft, lỗi/cancel, fixture recording, reload/offline |
| `qa/` | `npm run qa:topic-translations`, `npm run qa:languages` | Lựa chọn ngôn ngữ, cache và locale |
| `qa/` | `node scripts/qa/practical-assessment.cjs`, `node scripts/qa/practical-recording.cjs` | Bảng chấm và ghi âm qua fixture |
| `qa/` | `node scripts/qa/app-update.cjs` | Cập nhật PWA và dữ liệu đã lưu |

Build ghi lại dữ liệu public: review diff, audit và test trước commit. Audit không sửa dữ liệu. Migrate dùng danh tính provisioning; không truyền secret trực tiếp trên dòng lệnh.

## QA trình duyệt

Node cần resolve được `playwright`, và máy cần Chromium. Có thể cài công cụ ngoài repo; không cần thêm dependencies QA vào production:

```sh
npm install --prefix /tmp/helen-browser-qa --no-package-lock playwright axe-core
NODE_PATH=/tmp/helen-browser-qa/node_modules \
HELEN_CHROMIUM_PATH=/usr/bin/chromium \
HELEN_AXE_PATH=/tmp/helen-browser-qa/node_modules/axe-core/axe.min.js \
npm run qa:topic-practice
```

Chỉnh đường dẫn Chromium theo máy. Topic Practice QA dùng port tạm/fixture, không dùng key thật; ảnh lưu tại `/tmp/helen-topic-practice-qa`. Ghi âm vật lý và AI thật cần kiểm tra riêng. Script phải kết thúc server/browser cả khi kiểm tra thất bại.
