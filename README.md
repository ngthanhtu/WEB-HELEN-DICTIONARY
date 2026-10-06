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
