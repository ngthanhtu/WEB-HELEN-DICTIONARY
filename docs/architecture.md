# Kiến trúc và quy ước mã nguồn

## Điểm vào và ranh giới

Helen là một Express service và PWA dùng JavaScript thuần. Runtime không dùng Supabase, RLS, ORM, tài khoản VIP hoặc admin. Database hiện là MySQL/TiDB; lịch sử được tách theo thiết bị/trình duyệt bằng cookie HttpOnly. Đây chưa phải đồng bộ tài khoản đa thiết bị.

| Khu vực | Trách nhiệm | Không đặt ở đây |
| --- | --- | --- |
| `server.js` | HTTP middleware/routes, khởi tạo và nối dịch vụ, static allowlist | Rubric AI hoặc logic dữ liệu mới dài trong route |
| `lib/` | Dịch vụ, validation, cache và quota phía server | DOM/UI và key viết cứng |
| `public/assets/` | UI, CSS, dữ liệu public và pure core dùng chung | Secret, query quản trị, nội dung người dùng riêng |
| `data/` | Nguồn biên soạn và chỉ mục lexical | Bản ghi học/lịch sử production |
| `database/` | SQL schema, ví dụ quyền runtime, truy vấn đọc kiểm tra | Dump production hoặc mật khẩu thật |
| `scripts/{build,audit,qa,database,security}/` | Tác vụ phát triển theo chức năng | Module được import trong request runtime |
| `tests/` | `*.test.cjs` và nguồn giả lập, không gọi AI trả phí | Test ghi vào database production |
| `docs/` | Hướng dẫn và kết quả kiểm tra có phạm vi/ngày | Thông tin xác thực hoặc transcript thật chưa được cho phép |

`index.html` còn chứa phần Dictionary đã có; các tính năng mới dùng module riêng. Đây là cấu trúc hiện hành, không giả định ứng dụng đã tách thành React hoặc một hệ thống nhiều service. Không tách toàn bộ shell hoặc đổi URL asset trong một lần cleanup vì app cũ còn cần offline cache.

## Tìm module theo nghiệp vụ

| Nghiệp vụ | Backend | Trình duyệt |
| --- | --- | --- |
| Tra từ/quan hệ | `lexicon`, `study-lexicon`, `topic-lexicon`, `thesaurus`, `spelling` | Dictionary trong `index.html`, `sense-core`, `autocomplete` |
| Dịch | `translation`, `vietnamese` | `languages`, `i18n`, `translation-warmup`, `quiz-translation` |
| Study/SRS/quiz | Nguồn từ và `/api/study/prepare` | `study-core`, `study-library`, `study`, `habit-core` |
| Chủ đề | `topic-lexicon`, dữ liệu v2 đã sinh | `topics-core`, `topics`, `topics.css` |
| Hội thoại/nhận diện | `practical-ai`, `speech-ai`, `speaking-flow` | `practical`, `voice-recorder`, `live-transcript` |
| IELTS | `topic-assessment`, `practical-assessment`; runner chung `practical-ai` | `topic-practice-core`, `topic-practice`, bảng report Practical |
| Phát âm | TTS route, `usage-policy`, `tts-budget` | `pronunciation`, `device-speech`, `offline-audio`, `practical-audio` |
| Dữ liệu/quyền | `database`, `persist-dictionary`, `web-security`, `usage-policy` | `history-sync`, `backup-core`, `backup`, `api-errors` |
| Điều hướng/PWA | Static routes/version trong `server.js` | `navigation`, `workspace`, `pwa`, `app-update`, `public/sw.js` |

Các tên trong bảng tương ứng file `.js`. Pure `*-core.js` dùng UMD/CommonJS để được kiểm thử bằng Node và chạy trên trình duyệt. Controller UI không được import ngược vào server.

## Luồng chấm IELTS Topics

1. `topic-practice-core.js` cung cấp 40 đề Helen tự biên soạn: Writing Task 2 và Speaking Part 2 cho 20 chủ đề. Mở đề không gọi AI.
2. `topic-practice.js` quản lý mode, nháp, ghi âm/chép lời, Cancel và report. Gửi `stage: topic-assess` đến `/api/practical`.
3. `topic-assessment.js` kiểm tra topic/mode/độ dài, lấy đề và từ vựng **từ server**, tạo các đoạn dẫn chứng của bài gốc. Không tin đề, band hoặc rubric do client gửi thêm.
4. `practical-ai.js` dùng runner model/deadline/retry/cache hiện có. Hạn mức `practical-assessment` được giữ trước generation; lỗi trả slot report cá nhân một lần, không hoàn tác giới hạn attempt chung/mạng.
5. AI chọn ID dẫn chứng; backend khôi phục quote nguyên văn, kiểm tra band và sửa câu. Backend tính tổng từ tiêu chí hợp lệ, không dùng tổng do AI/client gán.
6. Report lưu trên thiết bị cùng bài gốc. Bản chữ không có receipt âm thanh hợp lệ chỉ chấm từ vựng/ngữ pháp cho Speaking. Đổi chữ sau ASR làm mất quyền dùng receipt cho bản chữ mới.

Cache report RAM/pending là 5 phút, theo thiết bị + bài + đề + mode + lesson + ngôn ngữ; request ID không tạo lần chấm mới cho bài giống hệt. Report/bản thu không được lưu vào các bảng cache database chung. AI và nhận diện cần Internet; nháp và report đã lưu không cần mạng.

## Dữ liệu và cache

| Tầng | Nội dung | Tính chất |
| --- | --- | --- |
| `data/` → `public/assets/topics/v2/` | Nguồn học và 4.000 mục từ phát hành | Chạy build/audit khi đổi nguồn; v1 giữ tương thích |
| MySQL/TiDB | Cache chia sẻ, từ đã tra, lịch sử hash thiết bị, quota và counts | TTL làm mới không đồng nghĩa xóa cache; xem database docs |
| RAM server | Pending requests và cache ngắn | Mất khi Render restart, không thay thế quota database |
| `localStorage` | Lựa chọn, favorites, SRS, bộ từ, nháp và report trên máy | Key versioned; chưa có cloud-account sync |
| Cache Storage/PWA | Shell, bộ từ và audio đã tải | Namespace ổn định, không xóa cache người dùng để update shell |

Nháp IELTS: `helen-topic-practice-v1`; mode: `helen-topic-practice-mode-v1`. Nháp/report được giữ trên thiết bị, chưa được thêm vào file backup từ vựng JSON hiện có. Không khẳng định localStorage là bản sao lưu vĩnh viễn; xóa dữ liệu trình duyệt có thể làm mất bản nháp.

## Đặt tên và thay đổi cấu trúc

- File/thư mục nghiệp vụ dùng tiếng Anh, kebab-case; backend/browser `.js`, công cụ Node/test `.cjs`, test tự chạy `*.test.cjs`.
- File UI theo tiền tố tính năng (`topics-*`, `practical-*`, `topic-practice-*`); giữ module cùng nghiệp vụ cạnh nhau. Không tạo layer trừu tượng chỉ để đổi tên file.
- JavaScript dùng `camelCase` cho hàm/biến, `PascalCase` cho kiểu khi có, `UPPER_SNAKE_CASE` cho hằng. Tiếp tục style module đang sửa; không mass-format nguồn không liên quan.
- SQL dùng `helen_` + `snake_case`, tham số bind và UTC. Giữ tên bảng/cột đang chạy; không rename để khớp số ít/số nhiều nếu không có lợi ích nghiệp vụ/migration.
- DOM IDs, events `helen:*`, storage keys và URL asset là hợp đồng với app đã cài; đổi tên phải xét phiên bản cũ, service worker và fixtures.
- Script move đã cập nhật npm commands, hook, workflow, imports và tài liệu. Nếu có automation ngoài repo gọi script bằng đường dẫn cũ, chuyển sang `npm run` hoặc đường dẫn mới trong `scripts/README.md`.

## Giới hạn và hướng tách tiếp

`server.js`, `lib/database.js`, Dictionary inline và catalog `ui-messages.js` còn lớn. Nên tách dần theo thay đổi nghiệp vụ có kiểm thử thay vì chuyển hết trong một đợt. Đợt này tách rubric IELTS vào module riêng, gom công cụ phát triển và sửa tài liệu/schema inspection; không đổi schema production, dữ liệu cache hay public URLs.
