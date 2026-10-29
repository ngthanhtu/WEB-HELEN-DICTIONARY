# IELTS Topics và dọn cấu trúc — 29/10/2026

## Kết quả

Thay phần đề tĩnh “Chưa có chấm điểm tự động” bằng khu vực **IELTS Practice · Use it in context** thu gọn. Có 40 đề Helen tự biên soạn cho 20 chủ đề, chia Writing Task 2 và Speaking Part 2. Đây không phải đề thi chính thức hoặc thư viện đề đã được chứng nhận.

Writing có Task Response, Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy. Speaking có Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy, Pronunciation. Band là ước lượng bài luyện; một bài không thay thế kết quả toàn bộ bài thi.

## Hành vi và dữ liệu

- Đề/cue card, gợi ý 3–5 từ, word count và draft không cần AI. Không cộng điểm theo số keyword.
- Nhận bài từ 80 từ, tối đa 900 từ. Writing dưới 250 từ nhận góp ý tiêu chí nhưng chưa có band tổng Task 2. Speaking nhập chữ không có band fluency/pronunciation/overall.
- Speaking dùng recorder tối đa 180 giây đã có, live captions khi trình duyệt hỗ trợ, bước review và retry. Caption là bản nháp có thể nghe nhầm, không phải acoustic evidence.
- Chỉ signed speech receipt đúng thiết bị và đúng bản chữ mới dùng để ước lượng phần âm thanh. Bản chữ đã sửa hoặc receipt không hợp lệ không được coi là audio cho câu mới. Cần tổng ít nhất 30 giây được quan sát âm thanh hợp lệ cho band tổng.
- Backend chọn đề/rubric từ module cục bộ, tạo reference IDs từ bài gốc, kiểm tra quotes/band và tính tổng. Client không gán đề tùy ý hoặc điểm. Sửa câu phải trích đúng, duy nhất, không chồng lấn; phần gợi ý không hợp lệ bị loại.
- Dùng runner Gemini hiện có tại `/api/practical`, stage `topic-assess`, deadline server 25 giây/client 30 giây. Giữ quota, giới hạn request, lỗi có scope và retry model có kiểm soát. Không đổi key/model để vượt provider quota.
- Cache 5 phút và coalescing theo bài/thiết bị/ngôn ngữ; dùng chung daily assessment allowance với Practical AI. Lỗi chỉ hoàn slot report cá nhân một lần, không bỏ giới hạn attempt chung/mạng.
- Nháp/report riêng từng topic/mode ở `helen-topic-practice-v1`, mode ở `helen-topic-practice-mode-v1`; giữ khi đổi trang, reload, update shell và offline. Chưa nằm trong file backup từ vựng JSON; xóa browser storage vẫn có thể làm mất nháp.
- Cancel bỏ qua phản hồi đến muộn và giữ bài; Clear draft cần xác nhận. Không lưu bản thu vào database và không đẩy report vào cache chia sẻ. File thu thử lại chỉ giữ trong tab.

## Tổ chức mã nguồn/database

- Công cụ đã chuyển vào `scripts/build`, `audit`, `qa`, `database`, `security`, với tên kebab-case ngắn. Đã cập nhật package scripts, imports, pre-commit và workflow secret scan. Các lệnh npm đang có vẫn giữ tên.
- README gốc tập trung vào chạy dự án, tính năng và tài liệu. Chi tiết cũ nằm trong `docs/feature-reference.md`; sửa thông tin cũ về số trang và fallback quota.
- Thêm `CONTRIBUTING.md`, `docs/architecture.md`, `docs/README.md`, `scripts/README.md`.
- Database giữ nguyên 9 bảng `helen_*`, cột, index và dữ liệu. Chỉ thêm comment schema, mô tả bảng/UTC/units/privacy và `database/inspect.sql` chỉ đọc. Migrate in tên bảng từ schema, không dùng danh sách 5 bảng đã cũ.
- Không đổi public URLs, tên storage cũ, source packs, favorites hoặc SRS. Các module lâu đời lớn được ghi rõ để tách dần khi có nhu cầu; không mass-format phần không liên quan.

## Kiểm tra cục bộ

- Full suite: **477 pass, 0 fail, 3 MySQL integration skip** do chưa có cấu hình database test trong môi trường. Không chạy kiểm thử ghi vào database production.
- 8 kiểm thử mới: 40 đề/20 chủ đề, input sai và mẫu ngắn, canonical task, điểm tổng/quotes, dedup cache, quota release, Speaking typed/edited receipts, khôi phục draft/report.
- `npm run audit:topics`: 4.000 mục song ngữ, 1.000 concepts, 3.000 collocations, 200 nhóm đạt structural/local learning audit. Không chứng nhận tần suất thi hoặc độ đúng mọi câu AI.
- `npm run qa:topic-practice`: 320/390/1440 px; Writing, Speaking text, fixture recording 179 giây, draft theo topic/mode, lỗi/cancel/late response, reload/offline, sáng/tối và axe WCAG AA đạt. Ảnh QA trong `/tmp/helen-topic-practice-qa`.
- `npm run qa:topic-translations`: 390/1440 px, giữ bản dịch Việt cục bộ, bảy lựa chọn, cache, quiz và chiều Dictionary độc lập.
- Chromium kiểm thử đặt `navigator.onLine=true` trở lại sau reload dù context vẫn offline; QA áp lại network emulation qua CDP để kiểm tra cả offline controls. Không thay getter navigator hoặc thêm workaround vào production.

Fixture recording không chứng minh micro Safari/iPhone vật lý hay chất lượng band thật. Phản hồi AI thực tế phụ thuộc provider/quota; kiểm tra live được thực hiện riêng sau deploy. Không cam kết chấm mọi bài dưới 5 giây hoặc tương đương giám khảo IELTS.

## Người dùng cần làm

Bấm **Update app** → Topics → mở chủ đề → **IELTS Practice · Use it in context**. Chọn Writing/Speaking, làm bài, kiểm tra lời nhận diện nếu thu âm, rồi bấm **Get IELTS feedback**. Có thể sửa bài để chấm lại. Không cần sửa key, tạo bảng hay xóa cache. AI cần `GEMINI_API_KEY` đã cấu hình trên Render và còn quota.

Khung tiêu chí: [IELTS Speaking public descriptors](https://ielts.org/cdn/ielts-guides/ielts-speaking-band-descriptors.pdf). Speaking descriptors đã được đối chiếu trong tài liệu dự án trước; không tuyên bố đã truy cập lại toàn bộ nguồn IELTS hoặc chấm đối chuẩn với giám khảo trong đợt này.
