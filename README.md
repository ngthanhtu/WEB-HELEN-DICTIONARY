# Helen Dictionary

Từ điển và ứng dụng học tiếng Anh dạng PWA: tra từ, lưu nghĩa cần học, ôn cách quãng, quiz, 20 chủ đề với 4.000 mục từ và luyện IELTS với AI.

Website: https://helen-dictionary.onrender.com/

Node.js 24 + Express, HTML/CSS/JavaScript thuần, MySQL 8+/TiDB tùy chọn. Không có bước build giao diện. API key chỉ cấu hình ở backend; không thêm giá trị thật vào Git hoặc `.env.example`.

## Chạy trên máy

```sh
npm ci
cp .env.example .env
npm start
```

Mở `http://localhost:3000`. Điền biến cần dùng trong `.env` trên máy; file này đã được bỏ qua bởi Git. Trên Render, điền trong **Environment**, không tải `.env` lên repo.

| Chức năng | Cấu hình |
| --- | --- |
| WordNet, ôn tập, quiz, Topics | Không cần API key |
| Dịch AI, nhận diện bản thu, Practical AI, chấm IELTS | `GEMINI_API_KEY`; có thể chọn `GEMINI_MODEL` |
| Giọng ElevenLabs | `ELEVENLABS_API_KEY`; chọn giọng trong Preferences/Topics |
| Merriam-Webster Learner’s | `MW_LEARNERS_KEY`, tùy chọn |
| Cache và lịch sử bền vững | `MYSQL_*` hoặc `DATABASE_URL`; xem [hướng dẫn database](database/README.md) |

Thiếu dịch vụ nào thì chức năng tương ứng thông báo; phần cục bộ còn lại vẫn dùng được. Quyền sử dụng/quota phụ thuộc nhà cung cấp và gói tài khoản; xem [API-USAGE.md](API-USAGE.md). ElevenLabs Free hiện chỉ dùng phi thương mại.

## Các trang

| Trang | URL | Nội dung |
| --- | --- | --- |
| Dictionary | `/` | Tra từ, gợi ý, nghĩa, IPA, ví dụ, phát âm và dịch |
| Study | `/study` | SRS, quiz, matching, bộ từ, mục tiêu ngày và tiến độ |
| Topics | `/topics` | 20 chủ đề, 10 nhóm/chủ đề, 20 mục từ/nhóm; luyện IELTS |
| Practical AI | `/practical-ai` | Hội thoại, ghi âm tối đa 3 phút và feedback Speaking |
| My words | `/words` | Từ đã lưu, sao lưu JSON và xuất CSV/Anki |
| History | `/history` | Lịch sử thiết bị và trạng thái đồng bộ |
| Offline | `/offline` | Cài PWA, bộ từ đã tải và audio ngoại tuyến |

Ngôn ngữ dịch: Anh, Việt, Hàn, Nhật, Trung giản thể, Tây Ban Nha, Pháp. Giao diện theo thiết bị; bản dịch theo lựa chọn. Topics có **Meanings in** riêng để không bị đổi khi đảo chiều tra từ điển.

## IELTS trong Topics

Mở một chủ đề → **IELTS Practice · Use it in context** → chọn dạng bài:

- **Writing Task 2:** đề Helen tự biên soạn, khuyến nghị 250+ từ/40 phút. Từ 80 từ được góp ý; band tổng chỉ có khi đủ 250 từ và dẫn chứng cho bốn tiêu chí: Task Response, Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy.
- **Speaking Part 2:** cue card theo chủ đề; chuẩn bị 1 phút, nói 1–2 phút. Ghi âm tối đa 3 phút; xem chữ trực tiếp khi trình duyệt hỗ trợ, kiểm tra lời nhận diện rồi gửi chấm. Bài nhập chữ chỉ được chấm từ vựng/ngữ pháp, không suy đoán phát âm hay độ trôi chảy.
- Góp ý có dẫn chứng bài gốc, sửa lỗi, collocation tùy chọn và bước luyện tiếp. Thử dùng 3–5 từ của nhóm tự nhiên; số từ khóa không quyết định điểm.
- Nháp và kết quả lưu riêng theo chủ đề/dạng bài trên thiết bị. Đổi trang/reload không tự gửi bài. Có **Cancel** và xác nhận khi xóa. Bài đã lưu đọc được ngoại tuyến; chấm mới cần mạng.

Đây là **ước lượng AI cho một bài luyện**, không phải điểm IELTS chính thức hay toàn bộ kỳ thi. Chấm dùng chung hạn mức hằng ngày với Practical AI. Gửi lại bài giống hệt trong cache 5 phút không tạo lần chấm mới. Audio chỉ giữ tạm trong tab để thử lại, không lưu vào database Helen. Sửa bản chữ sau nhận diện sẽ bỏ chấm âm thanh của bản đó.

## Cấu trúc và tài liệu

```text
server.js             Routes, middleware và kết nối dịch vụ
index.html            App shell và phần Dictionary hiện có
lib/                  Dịch vụ backend, validation và quota
public/assets/        Module trình duyệt, CSS, artwork và dữ liệu public
data/                 Nguồn biên soạn/build; không phục vụ trực tiếp ra web
database/             Schema, phân quyền và truy vấn kiểm tra
scripts/build/        Sinh dữ liệu phát hành
scripts/audit/        Rà soát dữ liệu cục bộ
scripts/qa/           Kiểm tra giao diện
scripts/database/     Khởi tạo/kiểm tra schema
scripts/security/     Quét secret trong Git
tests/                Kiểm thử *.test.cjs
docs/                 Kiến trúc, hướng dẫn và QA theo đợt
```

- [Kiến trúc và quy ước](docs/architecture.md), [hướng dẫn bảo trì](CONTRIBUTING.md)
- [Danh mục tài liệu](docs/README.md), [chi tiết tính năng](docs/feature-reference.md)
- [Database và ý nghĩa các bảng](database/README.md), [công cụ phát triển](scripts/README.md)
- [Thiết kế](design.md), [quy trình UI](skill.md), [bảo mật](SECURITY.md)

## Kiểm tra

```sh
npm test
npm run security:check
npm run audit:topics
```

`npm test` dùng fixture, không gọi AI trả phí. Ba kiểm thử MySQL thật chỉ bật khi có `HELEN_MYSQL_TEST=1` và database test riêng; không chạy vào production. QA trình duyệt cần Playwright/Chromium; xem [scripts/README.md](scripts/README.md). Fixture không chứng minh nhận giọng trên iPhone thật hoặc tính nhất quán điểm AI.

## Render và PWA

Render dùng `render.yaml`, `npm ci`, `npm start`. `/healthz` phải trả JSON; `/api/app-version` cho biết commit đang chạy. Người dùng bấm **Update app** sau deploy khi có yêu cầu; dữ liệu cá nhân đã lưu được giữ lại.

TiDB dùng TLS và IP outbound của dịch vụ Render. Không cần đổi tên bảng hoặc xóa cache cho tính năng IELTS. Khởi tạo schema bằng `npm run db:migrate` với danh tính có quyền tạo bảng; runtime nên dùng tài khoản ít quyền hơn.

Android cài qua **Install app**; iPhone: Safari → Share → Add to Home Screen. AI, dịch/giọng mới và nhận diện micro cần mạng. Render Free có thể ngủ, API ngoài có thể chậm/hết quota; không cam kết mọi yêu cầu luôn dưới một mốc cố định.
