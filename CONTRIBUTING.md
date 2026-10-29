# Bảo trì Helen Dictionary

Đọc [README](README.md) → [kiến trúc](docs/architecture.md) → tài liệu module. Với UI, đọc [design.md](design.md) và [skill.md](skill.md).

## Quy trình

1. Dùng Node.js 24, `npm ci`, tạo `.env` riêng khi cần. Không ghi key thật vào source, fixture, log, ảnh chụp hoặc Git.
2. Kiểm tra Git và yêu cầu hiện tại; giữ lại thay đổi của người khác. Chỉ sửa module liên quan, đặt tên tiếng Anh mô tả nghiệp vụ.
3. Backend/validation ở `lib/`, trình duyệt ở `public/assets/`, nguồn sinh dữ liệu ở `data/`. Sửa nguồn biên soạn trước khi chạy build, không vá riêng file sinh.
4. Kiểm thử hành vi quan trọng: dữ liệu sai, lỗi API, quyền/quota, tính điểm và khôi phục dữ liệu. Không viết test chỉ sao chép triển khai.
5. Ghi đúng giới hạn kiểm tra; fixture không chứng minh API luôn đúng/nhanh hoặc microphone vật lý hoạt động.
6. Cập nhật tài liệu/lệnh, review diff, quét secret và commit với mục đích rõ ràng.

| Thay đổi | Kiểm tra |
| --- | --- |
| Dịch vụ/validation | Test module liên quan; full `npm test` khi thay logic dùng chung |
| Topics/dữ liệu sinh | `npm run audit:topics` và test Topics/Study |
| UI | Keyboard, 320/390 px, desktop, sáng/tối, axe AA, loading/error/cancel |
| Storage/PWA | Reload, update, offline và dữ liệu phiên bản trước |
| Database | Schema additive, database test riêng, đối chiếu tài liệu bảng/quyền |
| Trước push | `git diff --check`, `npm run security:check`; hook quét staged files |

## Quy ước bắt buộc

- Dùng `textContent`/DOM nodes cho dữ liệu người dùng và AI; không đưa vào `innerHTML`.
- Backend quyết định rubric, prompt, band tổng, scope và quota. Điểm/quyền do client gửi không có giá trị xác thực.
- Trước generation phải giữ giới hạn bền vững. Lỗi quota/database không được mở API không giới hạn.
- Chỉ localize giao diện được đánh dấu; không dịch lại transcript/kết quả theo locale của máy.
- Không rename bảng/cột, URL public, storage key hoặc cache namespace chỉ để đẹp tên. Thay đổi cần tương thích/migration và giữ dữ liệu cũ.
- Ghi âm phải có Stop/Cancel; hủy/đổi trang giải phóng micro và bỏ qua phản hồi đến muộn.

## Schema và phát hành

`database/schema.sql` là nguồn schema. Thay đổi mới phải additive và ghi rõ quyền/cách chạy. `npm run db:migrate` tạo phần còn thiếu và liệt kê bảng trực tiếp từ schema. Không chạy kiểm thử ghi dữ liệu vào production.

Render tự deploy `main`. Đối chiếu `/api/app-version`; người dùng cập nhật shell bằng **Update app**. Kiểm tra Safari/iPhone thật khi thay micro/audio/PWA. Không reset dữ liệu học để xử lý cache.
