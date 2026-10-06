# WEB-HELEN-DICTIONARY

Dictionary is built for personalization.

## Chạy ứng dụng

Dùng Node.js 24 và chạy trong thư mục repository:

```sh
npm ci
npm start
```

Sarah là giọng premade mặc định khi chưa cấu hình ELEVENLABS_VOICE_ID. Kiểm tra quyền sử dụng và quota của giọng trên gói ElevenLabs của tài khoản; danh sách API không bảo đảm mọi giọng đều miễn phí. Chọn giọng khác trong mục **Voice** khi cần. Lựa chọn lưu trong trình duyệt, giữ nguyên khi tải lại trang và khi API báo lỗi; không tự chuyển sang giọng trình duyệt hoặc giọng mặc định. Xóa dữ liệu trình duyệt hoặc dùng trình duyệt khác sẽ mất lựa chọn đã lưu.

Server nhận `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `PORT` và tùy chọn `MW_LEARNERS_KEY` từ môi trường. `npm start` và `node server.js` tự đọc `.env` hoặc tệp `env` cùng thư mục server; biến được cung cấp cho tiến trình có ưu tiên cao nhất, sau đó `.env`, rồi `env`. Không đưa API key thật lên GitHub. Nếu tệp `env` đã chứa key thật, thu hồi/tạo lại key và chuyển cấu hình sang nơi lưu secrets của nền tảng triển khai.

Chọn ngôn ngữ nhập trong thanh tìm kiếm và ngôn ngữ đích tại **Meanings in**. Từ điển vẫn tra cứu định nghĩa tiếng Anh; bản dịch của từ hiển thị theo ngôn ngữ đích. Bấm mắt để xem bản dịch nghĩa. Đổi ngôn ngữ đích cập nhật bản dịch của từ, đóng các nghĩa cũ và dịch nghĩa theo ngôn ngữ mới khi bấm mắt.

Trong môi trường cloud có proxy, thêm `NODE_USE_ENV_PROXY=1` vào lệnh khởi động. Cho phép HTTPS tới `api.elevenlabs.io`, `api.mymemory.translated.net`, `en.wiktionary.org`; thêm `www.dictionaryapi.com` nếu sử dụng Merriam-Webster.

## Kiểm thử

```sh
node --test tests/*.test.cjs
```

Các kiểm thử API và trình duyệt giả lập dịch vụ ngoài, không tiêu hao quota ElevenLabs. Kiểm tra thực tế riêng bằng `/api/voices`, `/api/lookup` và `/api/translate` sau khi có quyền mạng và thông tin tài khoản hợp lệ. `/env` phải trả về 404.

Để chạy trên máy cá nhân, tải đầy đủ repository (bao gồm package.json và package-lock.json), tạo `.env` tại thư mục server với `ELEVENLABS_API_KEY` của bạn và `ELEVENLABS_VOICE_ID=EXAVITQu4vr4xnSDxMaL`, rồi chạy `npm ci` và `npm start`. Mở trang tại localhost:3000. Nếu giọng cũ đã lưu không dùng được, chọn Sarah trong mục Voice; ứng dụng không tự thay lựa chọn. Không mở index.html trực tiếp bằng file://.

## Giao diện và lưu lựa chọn

Ảnh Pexels được dùng làm nền mờ dưới lớp phủ trắng bán trong suốt. Công tắc Light/Dark ở thanh đầu trang lấy cảm hứng từ Uiverse.io (Javierrocadev) và được chuyển sang CSS thuần. Chế độ hiển thị, từ đang nhập, ngôn ngữ nhập, ngôn ngữ đích và giọng đều được lưu trong localStorage của trình duyệt. Khi tải lại trang, ứng dụng điền lại từ và gọi tra cứu để khôi phục kết quả mới nhất; bước này cần server và dịch vụ từ điển hoạt động. Xóa ô tìm kiếm sẽ xóa từ đã lưu.

## Tự chèn ảnh và nghe câu ví dụ

Đặt ảnh trong `public/images/`. Trong index.html, tìm `--page-image` (ảnh nền mờ toàn trang) và `--lookup-image` (ảnh sau toàn khối Look up a word đến Search). Cả hai đã gắn ảnh từ repository; có thể thay bằng `url("/images/ten-anh.jpg")`. Ảnh bên phải vẫn được cấu hình riêng trong `IMAGES.hero`. Không dùng đường dẫn tuyệt đối trên máy cá nhân.

Nút loa bên cạnh từng câu ví dụ dùng giọng ElevenLabs đã chọn. Các câu thêm từ Free Dictionary API hiển thị trong Usage examples. API `api.dictionaryapi.dev` không cần key, bổ sung synonym/antonym theo từ loại và có thể làm nguồn định nghĩa dự phòng. Không phải từ nào cũng có từ trái nghĩa hoặc ví dụ; không coi mọi synonym là từ thay thế được trong mọi ngữ cảnh. TTS đọc tối đa 2000 ký tự mỗi lần, tính vào quota ElevenLabs.

Ảnh nền đã được cấu hình trực tiếp từ hai file mới trong repository: `pexels-mart-production-7550534.jpg` cho toàn trang và `Helennn.jpg` cho khối tiêu đề đến thanh tìm kiếm. Server phục vụ riêng các ảnh này. Biến `--page-wash` và `--lookup-wash` điều chỉnh lớp phủ sáng/tối (alpha cao hơn làm ảnh mờ hơn). Mỗi câu định nghĩa cũng có nút loa riêng, ngoài các câu ví dụ.

Nếu hai ảnh mới không có cùng thư mục server.js, server tự chuyển yêu cầu ảnh sang link raw GitHub đã ghim phiên bản. Khi đó trình duyệt cần Internet để tải ảnh. Chép hai ảnh cùng thư mục vẫn là cách chạy offline. Có thể kiểm tra trực tiếp `/Helennn.jpg` và `/pexels-mart-production-7550534.jpg` trên server local.

## Triển khai để dùng qua đường link (Render)

Repository có `render.yaml` để tạo một Web Service Node.js. Không dùng GitHub Pages vì dịch vụ cần backend cho API và để giữ API key ở server.

1. Đăng nhập Render tại https://dashboard.render.com, chọn **New → Blueprint** và kết nối repository `ngthanhtu/WEB-HELEN-DICTIONARY`, nhánh `main`.
2. Blueprint đọc render.yaml: build `npm ci`, start `npm start`, health `/healthz`, Node.js 24.
3. Điền `ELEVENLABS_API_KEY` trong bảng cấu hình bảo mật của Render bằng key hợp lệ của bạn. Không gửi key vào chat hoặc commit key. `MW_LEARNERS_KEY` chỉ cần nếu muốn bật Merriam-Webster.
4. Tạo/triển khai dịch vụ. Khi trạng thái Live, mở URL HTTPS do Render hiển thị (tên cụ thể do Render cấp). Người dùng truy cập URL đó và không cần chạy terminal.
5. Kiểm tra `/healthz`, `/api/voices`; tìm từ `happy`, kiểm tra hai nhãn “Từ đồng nghĩa:”/“Từ trái nghĩa:”, và thử loa. Tự triển khai lại khi có commit mới lên main.

Gói miễn phí có thể ngủ khi ít hoạt động và mất thời gian khởi động lại; quota giọng ElevenLabs vẫn tính trên tài khoản của bạn. Server giới hạn yêu cầu mỗi IP trong production: 12 lượt loa, 30 lượt tìm kiếm, 60 lượt dịch mỗi phút. Chọn gói chạy liên tục nếu cần truy cập ngay mọi lúc.

Tệp `env` đã bỏ khỏi danh sách theo dõi Git nhưng giữ trên máy hiện tại để chạy local. Việc bỏ theo dõi không xóa key trong lịch sử Git; thay key đã lộ trước khi triển khai công khai. Dùng `.env.example` làm mẫu trên máy mới.

Datamuse (`api.datamuse.com`, không cần key) bổ sung quan hệ đồng nghĩa/trái nghĩa, lọc theo từ loại. Hai nhãn luôn hiển thị; nếu nguồn không có dữ liệu phù hợp hoặc không truy cập được thì báo rõ thay vì tạo từ không có cơ sở.

Tra cứu trả định nghĩa từ nguồn hợp lệ đầu tiên thay vì đợi mọi nguồn. IPA và từ liên quan bổ sung bằng yêu cầu `details=1` chạy nền; kết quả đầy đủ được cache và các yêu cầu trùng dùng chung tác vụ. Điều này giảm thời gian chờ nguồn phụ, nhưng không loại bỏ thời gian khởi động khi Render Free ngủ.

Từ điển dùng thêm Princeton WordNet 3.1 cài cùng server để tra nhanh và giữ synonym/antonym theo từng synset (nghĩa). Quan hệ trái nghĩa đọc đúng liên kết lexical của chính từ được tra. Giao diện đánh số từng nghĩa, liệt kê ví dụ và đặt quan hệ ngay dưới nghĩa đó; dữ liệu Datamuse theo từ loại được tách vào Từ liên quan. Không suy diễn rằng hai từ cùng từ loại là đồng nghĩa. `Experimentation` gần nghĩa với `experiment` ở nghĩa hoạt động thử nghiệm; `try out` tương ứng một nghĩa của động từ; `experiment` không có trái nghĩa trực tiếp trong nguồn này. Phần trình bày tham khảo bố cục trong ảnh Oxford, không sao chép nội dung Oxford hoặc gán nhãn Oxford cho nguồn khác.
