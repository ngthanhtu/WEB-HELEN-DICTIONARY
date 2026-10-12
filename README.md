# WEB-HELEN-DICTIONARY

Giao diện chia thành các trang riêng, với **Preferences** chứa Meanings in, Voice, theme và cursor. Quy tắc giao diện và tiêu chí tiếp cận nằm trong [design.md](design.md), quy trình bảo trì trong [skill.md](skill.md). Màu/khoảng cách/bo góc dùng semantic tokens trong `public/assets/workspace.css`; giữ ảnh, giọng đã chọn và các tính năng từ điển hiện có.

| Trang | Đường dẫn | Nội dung |
| --- | --- | --- |
| Dictionary | `/` | Tìm từ, nghĩa, phát âm và ngữ cảnh của từ đang tra |
| Study | `/study` | Review, quiz, bộ từ, tiến độ, mục tiêu ngày và Word of the day |
| My words | `/words` | Từ yêu thích, sao lưu và xuất JSON/CSV/Anki |
| History | `/history` | Lịch sử tra cứu và trạng thái đồng bộ |
| Offline | `/offline` | Cài app, từ ngoại tuyến và Save favorite audio |

Các URL hỗ trợ mở trực tiếp và refresh. Điều hướng nội bộ không tải lại ứng dụng, nên giữ nguyên kết quả từ và phiên quiz đang làm; Back/Forward cập nhật trang, tiêu đề và mục điều hướng đang chọn. Link cũ `#lookup`, `#study`, `#library` được chuyển sang trang tương ứng. Chỉ trang Dictionary tự khôi phục từ vừa tra; mở Study không khởi động một lookup không cần thiết. PWA dùng chung shell cho cả năm đường dẫn khi mất mạng, giữ nguyên dữ liệu và cache đã có. Refresh vẫn giữ tiến độ đã ghi nhận; câu quiz đang làm chỉ giữ khi chuyển trang trong cùng phiên.

Helen Dictionary là một hệ thống từ điển cá nhân hóa tích hợp AI, được thiết kế tập trung vào trải nghiệm người dùng (UX) và khả năng lưu trữ ngoại tuyến (PWA). Dự án kết hợp các API ngôn ngữ (Merriam-Webster, Wiktionary), công nghệ sinh giọng nói tự nhiên (ElevenLabs) và trí tuệ nhân tạo (Gemini) để tạo ra một không gian học từ vựng trực quan, sinh động.

Dự án được xây dựng với tư duy thiết kế hệ thống và quản lý luồng nghiệp vụ (Business Flow) chuyên nghiệp, thể hiện khả năng phân tích yêu cầu, tích hợp hệ thống và tối ưu hóa hiệu năng của một BA/Software Deployment.
Dictionary is built for personalization.

# Luồng nghiệp vụ & Tối ưu Hệ thống (Business Analysis & System Design)
Xử lý dự phòng (Fallback Mechanism): Hệ thống được thiết kế để tự động chuyển nguồn dịch vụ khi lỗi (Ví dụ: Chuyển từ MyMemory sang Gemini khi hết Quota) đảm bảo tính liên tục của dịch vụ.

Tối ưu hóa hiệu năng (Caching Strategy): Dữ liệu tra cứu, bản dịch và bài học AI dùng cache RAM, database MySQL/TiDB khi được kết nối và bộ nhớ trên Frontend/PWA. Cache database giữ kết quả qua lần restart; cache trên thiết bị hỗ trợ ngoại tuyến, giảm API calls và hướng tới phản hồi dưới 5s khi kết nối ổn định.

Offline-first (PWA): Phân tích hành vi người dùng học ngôn ngữ cần tra từ mọi lúc mọi nơi, ứng dụng cho phép tải bộ từ vựng Offline (Offline Pack) và tiếp tục truy cập các từ đã tra cứu ngay cả khi mất kết nối mạng.

# Công nghệ sử dụng (Tech Stack)
Backend: Node.js 24, Express.
Frontend: HTML/CSS thuần (Tối ưu hóa UI/UX, hỗ trợ Dark/Light mode), Progressive Web App (PWA).
Tích hợp API (3rd Party Services):
ElevenLabs API: Text-to-Speech (giọng đọc tự nhiên, hỗ trợ đa accent).
Google Gemini AI: Xử lý NLP, dịch thuật ngữ cảnh, sinh hội thoại và nhận diện giọng nói (Voice-to-Text).
Dictionary APIs: Merriam-Webster Learner's Dictionary, Wiktionary REST API, Datamuse, Princeton WordNet 3.0.
Deployment: Render (Web Service), cấu hình tự động (CI/CD cơ bản).

## Học mỗi ngày, sao lưu và bảo vệ quota

**Study → Daily goal:** chọn 5/10/20 lượt; câu quiz và thẻ tự đánh giá cập nhật tiến độ/streak theo ngày trên máy. Quiz giữ nguyên lịch SRS. **Word of the day** dùng bộ WordNet đã có, không gọi AI. Badge số từ đến hạn chỉ bật khi trình duyệt hỗ trợ.

**My words → Backup & export:** JSON để gộp dữ liệu qua máy khác, giữ lịch ôn mới hơn; CSV và Anki TSV để xuất học tập, một card Anki cho mỗi từ. Không xuất key, device token hay micro/audio. Kho từ hỗ trợ 500 từ yêu thích và 100 bộ từ, giữ nguyên các key lưu trữ và giới hạn cache/audio.

Production kiểm tra quyền đọc đúng nội dung và reserve quota tại TiDB trước khi gọi ElevenLabs/Gemini; database chưa sẵn sàng thì dừng lời gọi mới, không làm mất dữ liệu ngoại tuyến. Có giới hạn theo thiết bị và tổng website, không cần thêm biến env để bật mặc định. Chi tiết hạn mức, giấy phép đã đối chiếu và SQL kiểm tra nằm trong [API-USAGE.md](API-USAGE.md). Gói ElevenLabs Free chỉ dùng phi thương mại và cần attribution. Gemini có điều kiện về độ tuổi và khu vực người dùng; app miễn phí không tự giải quyết các điều kiện đó.

**Preferences → Help improve Helen** mặc định tắt: khi bật chỉ gửi tên sự kiện/ngày/UUID, không gửi từ đã tra trong bảng thống kê. DNT/GPC không gửi. [Sources, licenses & privacy](public/assets/sources.html) giải thích riêng dữ liệu học, lịch sử và việc gửi nội dung tới các provider.

## Chạy ứng dụng

Dùng Node.js 24 và chạy trong thư mục repository:

```sh
npm ci
npm start
```

Sarah là giọng premade mặc định khi chưa cấu hình ELEVENLABS_VOICE_ID. Kiểm tra quyền sử dụng và quota của giọng trên gói ElevenLabs của tài khoản; danh sách API không bảo đảm mọi giọng đều miễn phí. Chọn giọng khác trong mục **Voice** khi cần. Lựa chọn lưu trong trình duyệt, giữ nguyên khi tải lại trang và khi API báo lỗi; không tự chuyển sang giọng trình duyệt hoặc giọng mặc định. Xóa dữ liệu trình duyệt hoặc dùng trình duyệt khác sẽ mất lựa chọn đã lưu.

Server nhận `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `PORT` và tùy chọn `MW_LEARNERS_KEY` từ môi trường. `npm start` và `node server.js` tự đọc `.env` hoặc tệp `env` cùng thư mục server; biến được cung cấp cho tiến trình có ưu tiên cao nhất, sau đó `.env`, rồi `env`. Không đưa API key thật lên GitHub. Nếu tệp `env` đã chứa key thật, thu hồi/tạo lại key và chuyển cấu hình sang nơi lưu secrets của nền tảng triển khai.

Key ElevenLabs từng nằm trong lịch sử Git công khai: xóa file ở commit mới không vô hiệu hóa key hoặc xóa blob cũ. Làm ngay các bước thu hồi/thay key tại [SECURITY.md](SECURITY.md). `npm run security:check` kiểm tra các file đang theo dõi; `npm run security:history` kiểm tra lịch sử. GitHub chạy cả hai kiểm tra, và hook chống commit bí mật có thể bật bằng `git config core.hooksPath .githooks`.

Chọn ngôn ngữ nhập trong thanh tìm kiếm và ngôn ngữ đích tại **Meanings in**. Từ điển vẫn tra cứu định nghĩa tiếng Anh; bản dịch của từ hiển thị theo ngôn ngữ đích. Bấm mắt để xem bản dịch nghĩa. Đổi ngôn ngữ đích cập nhật bản dịch của từ, đóng các nghĩa cũ và dịch nghĩa theo ngôn ngữ mới khi bấm mắt.

Trong môi trường cloud có proxy, thêm `NODE_USE_ENV_PROXY=1` vào lệnh khởi động. Cho phép HTTPS tới `api.elevenlabs.io`, `api.mymemory.translated.net`, `en.wiktionary.org`; thêm `www.dictionaryapi.com` nếu sử dụng Merriam-Webster và `generativelanguage.googleapis.com` nếu dùng Gemini.

## Kiểm thử

```sh
node --test tests/*.test.cjs
```

Các kiểm thử API và trình duyệt giả lập dịch vụ ngoài, không tiêu hao quota ElevenLabs/Gemini. Kiểm tra thực tế riêng bằng `/api/voices`, `/api/lookup` và `/api/translate` sau khi có quyền mạng và thông tin tài khoản hợp lệ. Với micro, các kiểm thử mô phỏng Web Speech/MediaRecorder; vẫn cần thử thu tiếng thật trên iPhone Safari và app đã thêm vào màn hình chính. `/env` phải trả về 404.

Để chạy trên máy cá nhân, tải đầy đủ repository (bao gồm package.json và package-lock.json), tạo `.env` tại thư mục server với `ELEVENLABS_API_KEY` của bạn và `ELEVENLABS_VOICE_ID=EXAVITQu4vr4xnSDxMaL`, rồi chạy `npm ci` và `npm start`. Mở trang tại localhost:3000. Nếu giọng cũ đã lưu không dùng được, chọn Sarah trong mục Voice; ứng dụng không tự thay lựa chọn. Không mở index.html trực tiếp bằng file://.

## Giao diện và lưu lựa chọn

Ảnh Pexels được dùng làm nền mờ dưới lớp phủ trắng bán trong suốt. Công tắc Light/Dark ở thanh đầu trang lấy cảm hứng từ Uiverse.io (Javierrocadev) và được chuyển sang CSS thuần. Chế độ hiển thị, từ đang nhập, ngôn ngữ nhập, ngôn ngữ đích và giọng đều được lưu trong localStorage của trình duyệt. Khi tải lại trang, ứng dụng điền lại từ và khôi phục kết quả; sau khi cache PWA đã kích hoạt, dữ liệu đã tra trong 24 giờ mở ngay từ thiết bị, các từ mới cần server và dịch vụ từ điển hoạt động. Xóa ô tìm kiếm sẽ xóa từ đã lưu.

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

Datamuse (`api.datamuse.com`, hiện chưa cần key; xem thông báo thay đổi 2027 trong API-USAGE.md) bổ sung quan hệ đồng nghĩa/trái nghĩa, lọc theo từ loại. Hai nhãn luôn hiển thị; nếu nguồn không có dữ liệu phù hợp hoặc không truy cập được thì báo rõ thay vì tạo từ không có cơ sở.

Tra cứu trả định nghĩa từ nguồn hợp lệ đầu tiên thay vì đợi mọi nguồn. IPA và từ liên quan bổ sung bằng yêu cầu `details=1` chạy nền; kết quả đầy đủ được cache và các yêu cầu trùng dùng chung tác vụ. Điều này giảm thời gian chờ nguồn phụ, nhưng không loại bỏ thời gian khởi động khi Render Free ngủ.

Từ điển dùng thêm Princeton WordNet 3.0 cài cùng server để tra nhanh và giữ synonym/antonym theo từng synset (nghĩa). Quan hệ trái nghĩa đọc đúng liên kết lexical của chính từ được tra. Giao diện đánh số từng nghĩa, liệt kê ví dụ và đặt quan hệ ngay dưới nghĩa đó; dữ liệu Datamuse theo từ loại được tách vào Từ liên quan. Không suy diễn rằng hai từ cùng từ loại là đồng nghĩa. `Experimentation` gần nghĩa với `experiment` ở nghĩa hoạt động thử nghiệm; `try out` tương ứng một nghĩa của động từ; `experiment` không có trái nghĩa trực tiếp trong nguồn này. Phần trình bày tham khảo bố cục trong ảnh Oxford, không sao chép nội dung Oxford hoặc gán nhãn Oxford cho nguồn khác.

## Gợi ý chính tả, collocations và bộ từ cá nhân

Khi không có kết quả khớp chính xác, ứng dụng hiển thị các từ gần nhất từ danh sách lemma của WordNet. Gợi ý được xếp theo khoảng cách chính tả (bao gồm đảo hai chữ cạnh nhau), sau đó tần suất nghĩa trong WordNet; không tự đổi từ đã nhập. Bấm một từ gợi ý để tra lại tiếng Anh, hiển thị định nghĩa, ví dụ và các dữ liệu của chính từ được chọn. Nếu các dịch vụ tra cứu đều lỗi, ứng dụng báo lỗi kết nối thay vì khẳng định từ không tồn tại. Các từ ngoài phạm vi WordNet vẫn được thử ở nguồn từ điển trực tuyến như trước.

**Collocations — Cụm từ thường dùng** hiển thị nhóm cấu trúc và ví dụ do Helen Dictionary biên soạn trong `lib/collocations.js` (ban đầu có experiment, experience, environment, decision, research, evidence, progress, mistake, advice, attention, opportunity, responsibility). Đây là nội dung học tập tự biên soạn, không phải dữ liệu Oxford. Datamuse `rel_bgb`/`rel_bga` bổ sung cụm đứng trước/sau trong mục có thể mở rộng; đã lọc từ chức năng và dấu câu, nhưng dữ liệu thống kê chưa phân biệt từng nghĩa. Không dùng chúng thay cho collocations đã biên tập. Nguồn chưa bao phủ mọi từ; ứng dụng ghi rõ khi không có dữ liệu. Mỗi cụm có loa dùng giọng đang chọn. Nguồn này chạy cùng các dữ liệu bổ sung, không chặn kết quả định nghĩa đầu tiên.

Mục Voice thêm `(Eng)` cho accent Anh và `(Ame)` cho accent Mỹ dựa vào `labels.accent` từ ElevenLabs. Giọng có accent khác hiển thị accent đó; thiếu metadata hiển thị “Chưa rõ accent”. Tên giọng không được dùng để suy đoán accent. ID đang chọn và khả năng lưu lựa chọn giữ nguyên.

Bấm **☆ Lưu từ** cạnh đầu mục để thêm vào **Từ yêu thích**, bấm **★ Đã lưu** để bỏ lưu. **Lịch sử tra cứu** ghi tối đa 40 từ tra thành công gần nhất, không lưu lỗi chính tả. Bấm một từ đã lưu để tra lại; nút **Xóa lịch sử** chỉ xóa lịch sử. Có thể lưu tối đa 500 từ yêu thích. Cả hai giữ bản localStorage để dùng ngoại tuyến. Khi MySQL đã kết nối, lịch sử còn được lưu trong database theo trình duyệt/app này. Chưa có đăng nhập để đồng bộ giữa thiết bị; xóa dữ liệu website mất mã nhận diện lịch sử cũ. Khôi phục kết quả sau khi tải trang không tự ghi lại lịch sử đã xóa.

Kiểm tra sau triển khai: tra `experimence` → bấm `experiment` → kiểm tra 5 nghĩa, loa định nghĩa, collocations → lưu từ → tải lại → mở Từ yêu thích/Lịch sử → đổi Dark/Light và kiểm tra nhãn Voice.

## Gợi ý nhanh và thẻ thông tin bổ sung

Khi tra một từ tiếng Anh, trình duyệt chờ ngắn rồi gọi `/api/spelling?word=...` nếu yêu cầu tra cứu vẫn đang chạy. Danh sách từ gần giống được tính từ WordNet ngay trên server và hiển thị dưới nhãn **Gợi ý nhanh**; đây chỉ là gợi ý cách viết trong lúc các nguồn trực tuyến xác minh từ. Kết quả tra chính xác vẫn có ưu tiên: khi có định nghĩa, giao diện hiển thị từ đã nhập; khi xác nhận không có kết quả, nhãn gợi ý chuyển thành thông báo không khớp. Bấm gợi ý sẽ tra đúng từ đã chọn. Chỉ sử dụng dữ liệu WordNet cho từ tiếng Anh để tránh gợi ý sai ngôn ngữ. Server làm nóng danh sách chính tả khi khởi động; gọi `/api/spelling?word=experiment` trả danh sách rỗng, còn `experimence` trả các gợi ý gần nhất.

Nút mắt và loa, ô ngôn ngữ, giọng và ô tìm kiếm có viền sáng, bóng nhẹ và phản hồi khi hover/focus. Màu được điều chỉnh cho cả Light/Dark. Từ yêu thích và lịch sử có thẻ nổi bật; nội dung từ liên quan, ví dụ bổ sung và collocations nằm trong thẻ **Explore more**, mặc định đóng. Bấm tiêu đề hoặc dùng bàn phím để mở; khi dữ liệu bổ sung tải xong, trạng thái mở được giữ. Loại từ, định nghĩa, ví dụ trong từng nghĩa và quan hệ đồng/trái nghĩa của từng nghĩa vẫn đọc được ngay trên trang.

## Dịch từ dễ nhầm giữa tiếng Anh và tiếng Việt

`loan` được giải nghĩa là “khoản vay; cho vay, cho mượn; từ vay mượn”, thay vì lặp lại chữ `loan`. `lib/vietnamese.js` có các giải nghĩa ngắn biên soạn cho các từ thường dễ nhầm như loan, may, can, ban, song, son, long, mine, bank… Khi dịch Anh–Việt, kết quả lặp nguyên văn tiếng Anh bị loại; ứng dụng thử kết quả dịch phù hợp khác. Các từ vay mượn được dùng nguyên dạng trong tiếng Việt như internet, email, taxi… vẫn được chấp nhận. Nếu dịch riêng đầu mục không có kết quả hợp lệ, định nghĩa của từ cung cấp ngữ cảnh để hiển thị giải nghĩa tiếng Việt. Đây là bước kiểm soát bản dịch, không bảo đảm mọi nghĩa của mọi từ đều được dịch hoàn hảo. Từ nhiều nghĩa vẫn cần đọc nghĩa được đánh số và ví dụ.

`intermediate` có giải nghĩa biên soạn theo từ loại: trung gian/trung cấp, người hoặc vật ở mức giữa, và làm trung gian. Lỗi dịch từ và các câu trước đây xảy ra khi MyMemory hết hạn mức dịch hằng ngày. Server nay chuyển sang Gemini bằng `GEMINI_API_KEY` hiện có khi MyMemory thất bại, gom các câu cần dịch vào một lượt, dùng chung yêu cầu trùng và chỉ cache bản dịch thành công. Không thử liên tiếp nguồn đã báo hết quota. Bản dịch có giới hạn chờ tổng 6,5 giây; nếu cả hai nguồn lỗi, nút mắt có thông báo ngắn và cho bấm thử lại. Không cần key dịch mới nếu Gemini đã cấu hình trên Render.

## Tìm bằng giọng nói

Bấm micro trên thanh tìm kiếm, cấp quyền micro khi trình duyệt hỏi và đọc từ bằng ngôn ngữ chọn ở bên trái thanh tìm kiếm. Trên iPhone Safari và app đã cài, ứng dụng ưu tiên thu âm ngắn rồi gửi Gemini khi `GEMINI_API_KEY` đã cấu hình. Nói một từ/cụm từ rõ ràng; ứng dụng tự gửi sau khi ngừng nói hoặc bấm micro lần nữa để gửi sớm. Mỗi bản ghi tối đa 10 giây/750 KB. Gõ phím, đổi ngôn ngữ nhập hoặc chuyển ứng dụng ra nền sẽ hủy lượt nghe và tắt micro.

Các trình duyệt hỗ trợ tiếp tục dùng Web Speech API (`SpeechRecognition` hoặc `webkitSpeechRecognition`). Nếu trình duyệt nhận được tiếng nhưng kết thúc mà không gửi kết quả cuối, ứng dụng dùng phần lời đã nhận thay vì bỏ mất. Khi có lựa chọn nhận diện khác, người dùng có thể bấm từ phù hợp; không tự sửa chính tả từ đã nói. Cần HTTPS hoặc localhost và Internet. Dịch vụ Web Speech có thể gửi âm thanh tới nhà cung cấp của trình duyệt; chế độ thu âm gửi qua server tới Gemini, không ghi âm vào file hoặc lưu audio trong cache của ứng dụng.

`/api/speech/status` trả `configured` để xác nhận có cấu hình key, không xác nhận key/quota hợp lệ. `/api/speech` nhận bản ghi ngắn và trả từ nhận diện; giới hạn production 10 yêu cầu/phút/IP. Dùng chung key/model Gemini với tính năng AI, không cần thêm API key. Thiếu quyền micro, không nghe rõ, lỗi mạng và chờ quá lâu đều có thông báo ngắn. Nếu thiếu quyền, kiểm tra quyền micro của website trong Safari rồi thử lại. Tham khảo Web Speech: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition.

Khi nhận diện dùng alias Flash Lite, server đọc danh sách model một lần để chọn bản Lite hiện có và đặt chế độ suy nghĩ thấp theo đúng phiên bản. Không chọn Pro hoặc đổi model ID đã cấu hình cụ thể. Thời gian chờ cục bộ tối đa 7 giây, tách khỏi deadline gửi cho máy chủ Google; client dừng sau 7,5 giây. SDK được tải trước khi server nhận yêu cầu để giảm độ trễ ở lượt đầu. Định nghĩa dài bị nguồn dịch rút thành tên khái niệm tiếng Việt được chuyển sang dịch đủ câu; bản dịch định nghĩa và giải nghĩa đầu mục có cache riêng.

## Minh họa ngữ cảnh bằng Gemini

Phần **AI contexts** trong **Explore more** cho phép chọn một nghĩa rồi tạo hội thoại song ngữ, tình huống thực tế, ghi chú sử dụng và prompt tiếng Anh cho video hoạt hình. Hội thoại/tình huống có loa dùng giọng đang chọn; prompt có nút sao chép để dùng ở công cụ tạo video. Bản dịch theo ngôn ngữ **Meanings in**. Nội dung có nhãn AI tạo, không được dùng thay cho dữ liệu định nghĩa của nguồn từ điển.

Ứng dụng dùng SDK Google Gen AI chính thức (`@google/genai`), yêu cầu Node.js 20 trở lên; Render tiếp tục dùng Node.js 24. Không cần thêm Python. Client gửi từ, định danh nghĩa theo từ loại/định nghĩa và ngôn ngữ. Server dùng định danh để đối chiếu nguồn từ điển của chính mình, rồi truyền định nghĩa, ví dụ cùng nghĩa và các nghĩa khác cần phân biệt cho Gemini. Định nghĩa tùy ý từ client không được dùng làm bài học; client cũ gửi chỉ số nghĩa vẫn được hỗ trợ. API key chỉ nằm ở server.

Bật trên Render:

1. Tạo API key ở https://aistudio.google.com/app/api-keys.
2. Render → Web Service → **Environment** → thêm **GEMINI_API_KEY** và dán key vào ô Value bảo mật; Save/Deploy. Không commit hoặc gửi key trong chat.
3. Để **GEMINI_MODEL** trống để dùng `gemini-flash-lite-latest`, đã xác minh hoạt động trên Render. Alias này theo bản Flash Lite hiện hành của Google. Nếu Google báo model mặc định không còn khả dụng (404), server kiểm tra danh sách model và ưu tiên Flash Lite bản ổn định còn hỗ trợ tạo nội dung. Không chọn Pro/image/audio và không đổi model khi lỗi quyền hoặc quota. Có thể đặt **GEMINI_MODEL** để cố định model được tài khoản hỗ trợ. Local dùng các biến tương tự trong `.env`.
4. `/healthz` có `aiConfigured`/`speechConfigured`, `/api/context/status` và `/api/speech/status` có `configured`; chúng xác nhận đã cấu hình key, không kiểm tra key/quota. Mở trang, tra loan, mở Explore more → AI contexts, chọn nghĩa và bấm Generate context để kiểm tra thực tế; thử micro trên iPhone để kiểm tra nhận diện.

Bài học Gemini chỉ được tạo khi bấm Generate context. Gemini còn dùng để nhận diện bản ghi micro và làm nguồn dịch dự phòng khi MyMemory lỗi; các lượt này tính vào hạn mức tài khoản Gemini. Yêu cầu tạo bài trùng được dùng chung; kết quả cache theo từ, nghĩa, ngôn ngữ trong 24 giờ, tối đa 200 mục trên mỗi tiến trình. Khi MySQL đã kết nối, bài AI thành công được lưu bền vững và dùng lại sau restart; nếu chưa cấu hình database, cache RAM mất khi restart. Giới hạn production: 6 yêu cầu tạo mỗi phút/IP, tối đa 1800 token đầu ra/yêu cầu, không tự retry khi quota báo lỗi. Free tier/hạn mức phụ thuộc tài khoản, model và chính sách Google; kiểm tra trong AI Studio. Chưa có key thì giao diện ghi rõ AI chưa bật; key/quota không hợp lệ thì báo lỗi và không hiển thị bài học giả.

Cloud có allowlist cần thêm `generativelanguage.googleapis.com` khi kiểm tra Gemini thật. Tham khảo SDK: https://github.com/googleapis/js-genai.

## Loading, tốc độ AI và các mục mở rộng

Yêu cầu Gemini gồm 2 ví dụ song ngữ trong các tình huống khác nhau, đúng 4 lượt hội thoại ngắn, một câu tình huống, ghi chú phân biệt nghĩa và prompt video 45–65 từ. Tất cả phải dùng nghĩa đã chọn; ví dụ AI có nhãn riêng, có loa và không được đưa vào nguồn câu hỏi Review/Quiz. Không tự tạo trước khi người dùng bấm. Mục tiêu dưới 5 giây phụ thuộc mạng, Gemini và việc Render free vừa khởi động lại.

**Compare senses** nằm ngay trên các định nghĩa khi từ có nhiều nghĩa: bảng đối chiếu từ loại, định nghĩa và ví dụ từ nguồn của chính nghĩa đó. Bấm **Practice this sense · AI** dưới nghĩa hoặc **Practice this sense** trong bảng để mở AI contexts với nghĩa tương ứng. Khung **Selected sense** nhắc lại định nghĩa và ví dụ nguồn; chọn nghĩa chưa có ví dụ thì ghi rõ, không lấy câu của nghĩa khác. Lựa chọn giữ qua reload và khi dữ liệu bổ sung tải xong, dựa vào từ loại/định nghĩa thay vì vị trí. Nếu dữ liệu server không còn khớp nghĩa đã chọn, ứng dụng yêu cầu tra lại thay vì tạo bài theo nghĩa khác.

Bài AI mới dùng cache server `context-v2` để giữ 2 ví dụ có bản dịch; bài cũ trong trình duyệt vẫn đọc được, kể cả ngoại tuyến, dù chưa có mục ví dụ mới. Review, lịch ôn, quiz và dữ liệu `helen-study-v1` giữ nguyên.

Trình duyệt giữ tối đa 20 bài AI thành công dưới `helen-ai-contexts`, dùng ngay trong 24 giờ mà không gọi Gemini; cache phân biệt từ, từ loại, **định nghĩa** và ngôn ngữ dịch. Khi ngoại tuyến vẫn xem lại bài thành công đã lưu quá 24 giờ. Bài lỗi, đang tạo và dữ liệu lưu hỏng không được dùng. Cache chỉ ở trình duyệt này, không đồng bộ sang thiết bị khác; vẫn xem lại bài đã lưu khi dịch vụ AI chưa được bật.

Hoạt ảnh hamster do người dùng cung cấp (Uiverse.io by Nawsome) nằm trong `public/assets/hamster.css`, phục vụ tại `/assets/hamster.css`. Các trạng thái chờ tra cứu, kiểm tra chính tả, tải giọng, dịch từ/định nghĩa, chuẩn bị âm thanh, tạo AI, tải dữ liệu bổ sung và ảnh đều có loading phù hợp kích thước. Khi hoàn tất hoặc lỗi, loading dừng; nút trở lại hoạt động. `prefers-reduced-motion` tắt chuyển động và giữ thông báo trạng thái.

Trong **Explore more**, các mục Related words, More examples, Collocations, Common word combinations (Datamuse), Short dialogue, Real-life scenario và Animated video prompt có tiêu đề tiếng Anh. Chú thích và bản dịch vẫn theo ngôn ngữ đang dùng. Hover/focus làm nổi màu, viền và bóng; không đổi độ rộng. Bấm tiêu đề hoặc Enter/Space để mở, dấu + chuyển thành dấu đóng. Trạng thái mở của các mục được giữ khi dữ liệu bổ sung tải xong. Giao diện được kiểm tra cả desktop, mobile và dark mode.

## Chú chó ở con trỏ hoặc cạnh tên website

Hai ảnh chó người dùng cung cấp được tách phần đầu và tai, nền trong suốt; bản gốc lưu ở `public/assets/pet/dog-idle.png` và `dog-pressed.png`. Cấu hình nằm riêng trong **`public/assets/appearance.json`**; ảnh không nhúng vào HTML/JavaScript. Chỉ cần sửa file này rồi commit để Render tự deploy:

- `enabled` (dòng 2): đặt `false` để bỏ hoàn toàn tính năng; khi đó không tải ảnh chó.
- `mode` (dòng 3): `cursor` để dùng ở con trỏ desktop; `mascot` để đặt cạnh tên Helen Dictionary trên cả desktop/mobile.
- `touchMode` (dòng 4): `mascot` để hiện chó cạnh tên trên thiết bị cảm ứng; `off` để bỏ trên thiết bị này.
- `size` (dòng 5): mặc định 32 px, cho phép 24–48 px.
- `idleImage` / `pressedImage` (dòng 6–7): mặc định dùng bản WebP nhỏ trong `public/assets/mobile`; thay đường dẫn ảnh riêng, hoặc URL HTTPS của ảnh PNG/WebP nền trong suốt. Có thể thay hai file ảnh trong thư mục pet bằng ảnh mới cùng tên.
- `pressedHoldMs` (dòng 8): thời gian giữ ảnh tối thiểu trong chế độ `press`, mặc định 300 ms; cho phép 0–1000 ms.
- `clickBehavior` (dòng 9): `toggle` (mặc định) để mỗi lần bấm đổi ảnh và giữ nguyên; `press` để đổi ảnh khi giữ chuột rồi trở về khi thả.

Desktop: đầu chó theo chuột, có chấm nhỏ xác định đúng vị trí bấm; bấm trái đổi sang ảnh thứ hai và giữ sau khi thả chuột; bấm lần nữa đổi về ảnh đầu. Ảnh được đảo phía khi gần mép màn hình để không tràn. Mobile/mascot: chạm nút chó để đổi qua lại hai ảnh. Công tắc **Dog cursor / Dog mascot** cạnh công tắc Light/Dark bật/tắt theo sở thích và lưu trong trình duyệt; không ghi đè cấu hình chung.

Ảnh tải ở nền; con trỏ hệ thống vẫn được giữ tới khi cả hai ảnh tải thành công. Không có cấu hình, `enabled:false`, hoặc ảnh lỗi đều dùng con trỏ hệ thống. Lớp chó không nhận sự kiện chuột nên nút, nhập liệu và chọn văn bản vẫn hoạt động. Tab, rời trang hoặc mất focus trả về con trỏ thường. Đã kiểm tra trong Chromium: ảnh normal/pressed, bật/tắt qua reload, bấm tra từ, ảnh thiếu, thay cấu hình, góc màn hình và mobile không tràn ngang.


## Cài lên điện thoại và kết nối

Website có manifest, biểu tượng và service worker để cài dạng PWA; dùng HTTPS của Render. Người dùng xác nhận cài trực tiếp từ web, không cần App Store/CH Play, file APK hoặc chạy terminal trên điện thoại.

- Android: mở https://helen-dictionary.onrender.com/ bằng Chrome → **Install app**, hoặc menu ⋮ → **Cài đặt ứng dụng / Thêm vào màn hình chính**.
- iPhone/iPad: mở link trong Safari → **Chia sẻ → Thêm vào Màn hình chính → Thêm**. Bật Open as Web App nếu có. Nút Install app trên trang cũng hiện hướng dẫn này.
- Sau mỗi bản deploy, ứng dụng đã cài hiện **Update app** khi bản mới tải xong. Bấm để tải lại; từ yêu thích, lịch sử và tùy chọn vẫn giữ. Có thể mất một lần mở lại để trình duyệt phát hiện bản cập nhật.

Giao diện nhỏ có ô chọn ngôn ngữ/voice vừa màn hình, thanh tìm kiếm giữ đủ chỗ gõ, vùng chạm tối thiểu 44 px và không tràn ngang ở 320–430 px. Ảnh hiển thị dùng WebP đã xuất nhỏ trong **public/assets/mobile** (tổng khoảng 330 KB thay vì hơn 7 MB), giữ ảnh gốc trong repository. Đổi ảnh hiển thị: IMAGE 1/2 trong CSS index.html; ảnh chính trong IMAGES.hero; ảnh chó trong public/assets/appearance.json. Có thể trỏ về ảnh gốc hoặc ảnh mới tùy ý. Server nén HTML/JSON bằng compression.

Mở **Saved offline** để xem và mở các từ đã lưu trên thiết bị. Tối đa 100 phản hồi tra cứu thành công (bao gồm dữ liệu mở rộng) được giữ; trong 24 giờ, tra lại mở ngay từ cache. Nếu nguồn trực tuyến lỗi hoặc chậm, ứng dụng có thể dùng bản đã lưu cũ hơn. Kết quả đầu tiên vẫn được lưu khi service worker vừa cài xong. Dữ liệu mới chỉ có định nghĩa chính được ghi rõ, không giữ loading dữ liệu mở rộng khi mất mạng. Không lưu lỗi hoặc ghi đè bản thành công bằng phản hồi lỗi.

Bấm **Download offline pack → Download** để xác nhận tải 50 từ tiếng Anh thông dụng (khoảng 136 KiB) với định nghĩa thật từ Princeton WordNet và nghĩa tiếng Việt của đầu mục do Helen Dictionary biên soạn. Bộ từ không gọi AI hoặc ElevenLabs khi tải, giữ nguyên những từ cá nhân đã lưu và vẫn chịu giới hạn 100 mục. Có thể tra các từ trong bộ này mà chưa từng tìm từng từ trước đó. Các câu định nghĩa chỉ có bản dịch nếu đã bấm mắt khi có mạng.

Bộ từ nằm tại `public/assets/offline-basics.json`; sửa danh sách từ/nghĩa Việt ở đầu `scripts/build-offline-pack.cjs`, rồi chạy `node scripts/build-offline-pack.cjs` để dựng lại bằng WordNet đã cài trên server, không gọi dịch vụ mạng. Giấy phép WordNet được giữ trong bộ từ và `public/assets/wordnet-license.txt`.

**Offline pronunciation:** âm thanh từ, định nghĩa và ví dụ được lưu trên thiết bị sau khi bấm loa thành công. Khi nghe lại, app dùng đúng âm thanh của đúng voice ID và nguyên văn câu đã lưu; không đổi sang giọng khác, không gọi ElevenLabs khi đã có file. Âm thanh không có sẵn khi ngoại tuyến được thông báo ngắn thay vì chờ API. Tên/accent của giọng từ ElevenLabs được giữ để chọn giọng đã lưu lúc mất mạng.

Ngay bên dưới **Từ yêu thích / Lịch sử tra cứu**, phần **Offline pronunciation → Save favorite audio → Download** luôn hiện, kể cả khi Saved offline đang thu gọn. Nút hướng dẫn thêm từ yêu thích/chọn giọng/kết nối mạng nếu còn thiếu. Người dùng xác nhận tải giọng đang chọn cho tối đa 10 từ yêu thích mỗi lượt. Chỉ tải đầu mục, không tự tải mọi định nghĩa/câu hoặc gọi AI. Các file đã có được bỏ qua; có nút **Stop**, gặp lỗi hoặc hạn mức thì dừng và giữ phần đã tải để lần sau tiếp tục. Mỗi yêu cầu chịu giới hạn 7,5 giây; cả gói nhiều từ có thể lâu hơn và hiển thị tiến độ. Chức năng này sử dụng hạn mức ElevenLabs của server, không phải giọng đọc miễn phí bổ sung.

Cache `helen-audio-v1` giữ tối đa 100 âm thanh, 20 MiB tổng cộng, 1 MiB/file; file cũ được loại khi vượt giới hạn. Cache âm thanh và từ được giữ qua cập nhật app. **Clear audio** cần xác nhận và chỉ xoá âm thanh trên thiết bị; không xoá từ yêu thích, bản dịch, lựa chọn nghĩa hay lịch ôn. Dữ liệu có thể mất nếu người dùng xoá dữ liệu trình duyệt hoặc hệ điều hành thu hồi dung lượng; tải được file không thay thế việc cài app shell ngoại tuyến.

Gợi ý tự hiện từ 2 ký tự khi gõ tiếng Anh, kể cả lúc bàn phím đang ghép ký tự (IME/Telex), và sau khi bấm Search, kể cả khi ô nhập không còn focus. Không cần xoá ký tự, bấm lại ô nhập hay kết thúc ghép ký tự. Phím Enter vẫn dành cho bộ gõ khi đang ghép. Bấm chọn gợi ý đóng danh sách; Escape, bấm bên ngoài và đổi ngôn ngữ huỷ lượt gợi ý cũ. Từ yêu thích/lịch sử và các gợi ý đã nhận còn khớp hiện ngay trong lúc lấy danh sách mới; lỗi kết nối thử lại một lần, không cache danh sách rỗng do nguồn chưa sẵn sàng. Mỗi lượt gợi ý giới hạn 2,5 giây và không trì hoãn tra từ chính. Render free đang ngủ vẫn có thể chưa trả được gợi ý mới; app hiển thị trạng thái và giữ gợi ý cục bộ.

Ứng dụng giữ tối đa 100 bản dịch thành công theo văn bản/ngôn ngữ/ngữ cảnh và 20 bài AI. Bản còn trong 24 giờ dùng ngay; bản thành công cũ hơn vẫn đọc được khi ngoại tuyến, không tự xóa chỉ vì hết hạn làm mới. Nội dung chỉ thuộc trình duyệt/ứng dụng này, không đồng bộ giữa các máy; hệ điều hành có thể xóa cache khi thiếu dung lượng. Micro, giọng ElevenLabs, từ ngoài dữ liệu đã lưu, bản dịch chưa tải và tạo bài AI mới cần Internet. Mở trang khi có mạng một lần và tải bộ từ trước khi dùng ngoại tuyến.

Mục tiêu phản hồi dưới 5 giây trên kết nối tốt. Bản dịch có giới hạn tổng 6,5 giây, nhận diện Gemini 7 giây sau khi gửi audio. Các nguồn từ điển ngoài có giới hạn 5 giây và không còn lượt chờ lại 15 giây khi tất cả nguồn lỗi. Frontend dừng lượt chờ API sau 7,5 giây (cả tải nội dung/audio), dọn loading và cho thử lại; đây là giới hạn chờ, không phải bảo đảm thành công dưới 8 giây. Tra cứu chưa lưu có hạn chờ mạng 6,5 giây; nếu có bản cũ, ứng dụng dùng bản đó khi làm mới chậm quá 2,4 giây hoặc lỗi. Gemini có thể hoàn tất trên server sau khi client dừng; thử lại cùng nghĩa có thể nhận cache mà không tạo thêm. Render free có thể ngủ và khởi động lại lâu hơn 8 giây: app shell và dữ liệu đã lưu vẫn mở nhanh, nhưng nội dung cần mạng phải chờ server thức. Cấu hình hiện tại tiếp tục dùng free; hosting không ngủ là lựa chọn nếu cần server luôn sẵn sàng.


## Database MySQL và dữ liệu đồng nghĩa/trái nghĩa

Hướng dẫn tạo TiDB Cloud Starter miễn phí, cấu hình Render, quản lý bằng DBeaver và kiểm tra lưu dữ liệu nằm ở [database/README.md](database/README.md). Bảng SQL ở [database/schema.sql](database/schema.sql); biến kết nối mẫu trong `.env.example`. Chưa có thông tin kết nối thì database chưa được bật trên Render, website vẫn hoạt động như trước. Kết nối thành công khi `/healthz` có `database.connected: true`.

Pipeline đồng/trái nghĩa áp dụng cho mọi từ: WordNet theo nghĩa, Free Dictionary API, Datamuse theo từ loại và Wiktionary. Wiktionary đọc mẫu syn/ant, các mục Synonyms/Antonyms và các trang Thesaurus được chính đầu mục liên kết; giữ nguồn và giấy phép CC BY-SA 4.0. Kiểm tra từ loại bằng chỉ mục WordNet; không lấy hypernym/hyponym làm synonym/antonym. Danh sách quan hệ không còn bị cắt ở 12 từ, các nghĩa WordNet không còn bị cắt ở 8. Dữ liệu khác định nghĩa giữ thành nhóm riêng trong **Explore more → Thesaurus**; không gắn mơ hồ vào nghĩa của nguồn khác. Đối nghĩa qua từ cùng nghĩa trong WordNet có nhãn riêng.

`drawback` có phần bổ sung biên soạn cho nghĩa nhược điểm/bất lợi, gồm disadvantage, obstacle, hindrance, handicap, detriment, impediment, stumbling block; đối nghĩa advantage, benefit. Có chú thích các sắc thái và không áp dụng cho nghĩa hoàn thuế. File `data/thesaurus-supplements.json` dành cho bổ sung theo nghĩa; cơ chế lấy dữ liệu chung hoạt động cho mọi từ, không phụ thuộc danh sách này.

`npm run audit:lexicon` kiểm tra toàn bộ dữ liệu WordNet cài cùng server: 117.791 synset, 148.897 đầu mục và 7.983 liên kết antonym. Đây là kiểm tra cấu trúc/liên kết dữ liệu, không chứng minh mọi từ tiếng Anh đều có đối nghĩa trực tiếp hoặc mọi nguồn đều có danh sách đầy đủ. Nếu nguồn phụ lỗi thì báo chưa tải được; nguồn chưa ghi nhận không đồng nghĩa với khẳng định từ đó không có đồng/trái nghĩa. Cache PWA cũ được làm mới theo phiên bản quan hệ, vẫn giữ bản cũ để dùng ngoại tuyến.

## Review and Quiz

Quick quiz mở khi có ít nhất **3 từ yêu thích khác nhau có dữ liệu câu hỏi**, hiển thị số từ còn thiếu. Bài trộn tối đa 10 từ và tránh từ đang tra ở câu đầu. Kết quả tra cứu tạm ẩn khi làm quiz rồi hiện lại khi kết thúc; lịch ôn không thay đổi. Câu hỏi sử dụng nghĩa và ví dụ có nguồn, chỉ che đúng đầu mục trong câu nguồn. Các câu hỏi gõ từ theo định nghĩa không có ví dụ chấp nhận từ đã lưu khác khi nguồn xác nhận cùng nghĩa/từ loại; câu điền từ đối chiếu từ trong ví dụ nguồn.

Lưu ☆ từ khi tra cứu, mở **Study · Review & Quiz**, rồi chọn **Review due words** hoặc **Quick quiz**. Với từ yêu thích đã lưu trước bản cập nhật, chọn **Prepare saved words** một lần. Từ đã có dữ liệu có thể học ngay trong khi phần còn lại được chuẩn bị; có thể hủy mà không mất dữ liệu đã tải.

Review mở thẻ nghĩa và ví dụ theo từng từ loại. **Chưa nhớ** hẹn ôn lại sau 10 phút; **Hơi nhớ** tăng khoảng cách chậm; **Đã nhớ** lần lượt hẹn 1 ngày, 3 ngày, rồi tăng dần (tối đa 365 ngày). Mỗi lượt tối đa 20 thẻ đến hạn. Quiz có tối đa 10 câu từ danh sách yêu thích, dùng nghĩa tiếng Anh hoặc ví dụ có sẵn; chọn đáp án hoặc điền từ. Quiz không thay đổi lịch ôn; cuối lượt có thể Review các từ trả lời sai. Câu hỏi tránh đáp án nhiễu có cùng nghĩa hoặc được nguồn xác nhận là từ đồng nghĩa; nếu không đủ lựa chọn phù hợp, chuyển sang gõ đáp án.

Mỗi đáp án quiz có âm báo vang khoảng 0,8–0,95 giây: đúng là ba nốt cao dần, sai là hai nốt đi xuống. Âm lượng đỉnh tăng từ 0,08 lên 0,28; tiếng vọng nhẹ kéo dài 0,14 giây, không tạo vòng lặp âm. Web Audio tạo âm ngay trên thiết bị, dùng được ngoại tuyến và không gọi ElevenLabs. **Quiz sound: on/off** tắt/bật âm và giữ lựa chọn qua reload; Safari mở âm từ thao tác trả lời. Phản hồi hiển thị đầu mục, từ loại, đúng định nghĩa của câu hỏi và ví dụ nguồn nếu có; các từ trả lời sai được đưa vào **Review mistakes** cuối lượt. Chỉ tự đánh giá trong Review mới đổi lịch ôn.

Sau khi trả lời đúng hoặc sai, quiz tự dịch toàn bộ định nghĩa đề bài và câu ví dụ theo **Meanings in** (mặc định tiếng Việt). Với câu điền từ, dịch câu nguồn đầy đủ đã điền đáp án để giữ ngữ cảnh. Bản dịch dùng chung dịch vụ/cache của nút mắt, có loading và **Retry translation** khi lỗi. Chấm đáp án và Next question hoạt động ngay; bản dịch về trễ không xuất hiện trong câu hỏi khác. Câu nguồn dài được dịch đủ từng phần trong giới hạn API, không cắt bớt nội dung. Bản dịch thành công đã lưu mở lại được ngoại tuyến; nội dung chưa lưu cần mạng.

Nguồn Gemini trả lỗi tạm thời 500/502/503/504 được thử lại một lần sau 150 ms nếu còn đủ thời gian, vẫn trong giới hạn dịch 6,5 giây. Không tự thử lại lỗi key, quyền truy cập, quota hoặc nội dung không hợp lệ. `/healthz` có `translation.primaryError` và `translation.aiError` gồm mã trạng thái/lý do đã lọc; không chứa API key, câu người dùng hoặc thông báo thô của nhà cung cấp. `configured: true` chỉ xác nhận có cấu hình key, không bảo đảm nguồn dịch đang hoạt động hay còn quota.

Nghĩa, ví dụ và tiến độ lưu riêng trên thiết bị trong `helen-study-v1`, tối đa 500 từ. Dữ liệu này chưa đồng bộ giữa thiết bị. Mở thẻ và chấm đáp án quiz thực hiện trên thiết bị, dùng được ngoại tuyến sau khi app đã cập nhật và từ đã chuẩn bị. Dịch câu hỏi chưa lưu và giọng đọc mới cần mạng; âm thanh đã lưu phát lại theo đúng giọng. Chuẩn bị từ cũ ưu tiên bản tra đã lưu; phần thiếu dùng WordNet cục bộ của server, tối đa 12 từ/lượt, dừng chờ sau 4,5 giây. Từ ngoài WordNet được bổ sung bằng cách mở lại từ trong từ điển khi có mạng. Nếu bộ nhớ thiết bị đầy, app báo tiến độ chỉ giữ trong phiên hiện tại.

`npm run audit:study` rà soát khả năng tạo thẻ/câu hỏi của mọi bản ghi WordNet đã cài. Đây là kiểm tra cấu trúc và điều kiện tạo câu hỏi, không phải xác nhận mọi bản dịch hay mọi đáp án ngữ nghĩa trên thế giới đều chính xác.

**Study workspace:** Dashboard có **Review due**, **Word sets** và **Your progress**. Chọn **Practice from** để luyện toàn bộ từ đã lưu hoặc một bộ cụ thể; **Practice style** chọn Quick quiz (mixed), Multiple choice, Fill in the blank, Type the word, Matching pairs. Những kiểu trắc nghiệm/điền từ/gõ từ dùng lại logic và nguồn nghĩa hiện có. Các bài cần ít nhất 3 từ có dữ liệu phù hợp; Fill in the blank chỉ dùng câu nguồn chứa đúng từ. Trắc nghiệm có tối đa 4 lựa chọn; nếu không có đủ đáp án nhiễu phù hợp, câu đó chuyển sang gõ từ. Không tự sáng tác thêm ví dụ để đủ số câu.

**Matching pairs:** Mỗi lượt có 3–6 cặp từ/định nghĩa, cột nghĩa được trộn riêng. Chọn từ hoặc nghĩa trước đều được, không cần kéo thả; Enter/Space hoạt động trên các nút. Loại định nghĩa trùng và những cặp đồng nghĩa được nguồn xác nhận. Lựa chọn có trạng thái `aria-pressed`, ghép đúng có dấu ✓ và khóa cặp, sai hiện nghĩa đúng rồi cho ghép lại. Điểm cuối phiên tính theo số cặp đúng ngay lần đầu; accuracy trong Progress tính mọi lần thử. Tất cả kiểu quiz giữ lịch ôn. **Mark for review** là thao tác chủ động đặt từ đến hạn ngay; đánh giá trong Review tiếp tục dùng lịch cách quãng cũ.

**Word sets:** Tạo tối đa 100 bộ từ, tên 1–50 ký tự và không trùng tên khác khi bỏ qua hoa/thường. Một từ yêu thích có thể thuộc nhiều bộ; có thể lưu bộ trống. Editor cho lọc từ, chọn checkbox và sửa tên; từ đã tick không mất khi bị ẩn bởi bộ lọc. Xóa bộ cần xác nhận và chỉ xóa nhóm, giữ nguyên từ, âm thanh và lịch ôn. **Add searched word to a set** lưu từ vừa tra và mở editor, cho chọn bộ có sẵn hoặc tạo bộ mới. Bộ mẫu Everyday English, Learning & Discovery, Money & Work dùng dữ liệu WordNet đã có trong offline pack; sửa danh sách trong `public/assets/study-starters.json`. Thêm bộ mẫu không gọi AI hay ElevenLabs, giữ giới hạn 500 từ yêu thích và gộp vào bộ cùng tên khi thêm lại.

**Your progress:** Kết quả đúng/sai được lưu ngay sau mỗi câu, kể cả khi dừng giữa phiên. Phiên chỉ được ghi vào Recent sessions khi hoàn thành. Có số lượt trả lời, accuracy, số từ từng Review, số đến hạn, Words to revisit và 5 phiên gần nhất. Chỉ giữ 500 lượt trả lời và 100 phiên gần nhất; đây là kết quả luyện tập, không phải chứng nhận thành thạo. Từ hay sai không tự thay đổi lịch ôn. Bộ từ, dấu cần ôn, kết quả được lưu riêng trong `helen-learning-library-v1`; không đổi dữ liệu trong `helen-study-v1`, favorites, selected sense hay cache âm thanh. Chưa đồng bộ bộ từ/tiến độ giữa các máy. Bộ nhớ đầy có cảnh báo; dữ liệu khi đó chỉ giữ trong phiên. Thay đổi từ tab khác cập nhật kho từ và dừng lượt học cũ để tránh ghi đè.

Khi thêm bộ mẫu, ứng dụng cũng lưu các trang tra tương ứng bằng cơ chế offline pack có sẵn, để **View dictionary** mở được ngoại tuyến. Không ghi đè mục tra cá nhân đã có; khi cache 100 mục đã đầy, giữ mục cũ và bỏ qua mục mẫu chưa có chỗ. App chưa cài xong hoặc bộ nhớ đầy có thể chưa lưu được trang tra; vẫn giữ thẻ luyện tập và báo ngắn để thử lại.

Giao diện Study/chấm bài hoạt động ngay trên thiết bị; không chờ API. Bản dịch và giọng mới vẫn phụ thuộc nguồn ngoài. Starter assets được cài cùng app shell để thêm bộ mẫu khi ngoại tuyến sau khi app cập nhật thành công; tải asset chưa lưu có giới hạn 4,5 giây. Công cụ kiểm tra trình duyệt dùng dịch vụ giả lập, không tiêu hao key. Đợt thiết kế này đã thử desktop/mobile mô phỏng, dark/light, reload, bộ mẫu ngoại tuyến và lưu tiến độ; vẫn cần test trên iPhone Safari thật. Rà soát cấu trúc bộ WordNet: 148.897 đầu mục, 147.216 đầu mục đủ điều kiện hỏi nghĩa, 20.555 có ví dụ chứa đúng từ, không có lỗi cấu trúc. Kết quả này không xác nhận mọi bản dịch hoặc mọi cặp đáp án đều tuyệt đối không mơ hồ.

Đường chuẩn bị bài học đọc trực tiếp bộ đệm WordNet đã nạp trước khi server lắng nghe, tránh hàng loạt thao tác đọc đĩa nhỏ của thư viện cũ khi Render vừa khởi động. Mỗi từ trả tối đa 16 nghĩa, phân bổ giữa các từ loại, mỗi nghĩa tối đa 2 ví dụ để giảm dữ liệu trên điện thoại; không giới hạn số nghĩa ở phần tra cứu từ điển chính.

Refresh ưu tiên HTML từ server và tải CSS/JavaScript có cùng mã phiên bản triển khai. Khi offline hoặc kết nối chậm, app dùng bản đã cài đầy đủ; HTML của bản mới không thay thế bộ offline cũ cho đến khi bản mới cài xong. Trên lượt reload, worker mới đã sẵn sàng sẽ được kích hoạt tự động nếu không có phiên học đang chạy. Với app còn giữ cache từ bản trước thay đổi này, bấm **Update app** một lần để cập nhật cơ chế refresh; từ và lịch ôn được giữ.

## Topics — 4.000 mục từ theo 20 chủ đề

Mở **Topics** (`/topics`) → chọn chủ đề → chọn một nhóm 20 từ. Mỗi chủ đề có 200 mục từ, chia thành 10 nhóm. Có quiz nghĩa, gõ từ, ghép cặp và bài điền từ khi đủ câu ví dụ; thêm hai đề luyện nói/viết tự biên soạn cho mỗi chủ đề. Bộ v2 hướng tới IELTS 6.5+: 50 khái niệm và 150 collocations hành động được chọn riêng cho từng chủ đề (1.000 khái niệm + 3.000 cách kết hợp). Định nghĩa và nghĩa tiếng Việt do Helen biên soạn, không phải danh sách chính thức, đo tần suất hoặc cam kết điểm IELTS/TOEIC/VSTEP.

Có thể luyện ngay mà không tự thêm toàn bộ thư viện vào Favorites. Lưu từng từ hoặc nhóm 20 từ để ôn theo lịch; từ đã lưu giữ nguyên các nghĩa và lịch ôn. Kết quả hoàn thành nhóm được lưu trên thiết bị và đi cùng JSON backup. **Save topic offline** tải 200 từ của chủ đề vào cache riêng, giữ qua cập nhật app; dịch mới và giọng AI cần mạng.

### Giọng nhanh và bản dịch đã chuẩn bị

**Topics → Topic audio → Selected ElevenLabs voice** là mặc định cho thiết bị chưa chọn chế độ đọc. Topics có ô **ElevenLabs voice** ngay bên cạnh, đồng bộ với Preferences; đổi giọng ở một trong hai ô sẽ dừng âm thanh cũ và chuyển Topics (kể cả quiz mở từ Topics) sang đúng giọng AI vừa chọn. Lựa chọn giữ qua reload. **Fast device voice** vẫn là tùy chọn đọc nhanh không dùng quota; lựa chọn giọng máy đã lưu trước đây được giữ cho đến khi người dùng chọn giọng ElevenLabs. Giọng máy cần trình duyệt và giọng tiếng Anh được hỗ trợ; chỉ giọng cài trên thiết bị mới bảo đảm không cần mạng. Danh sách giọng ElevenLabs được giữ bằng khóa riêng `helen-voices-v1`; khi làm mới API lỗi, danh sách đã tải vẫn chọn được, có **Reload voices** ở Preferences và Topics. Ngoại tuyến chỉ nghe được âm thanh đã lưu cho đúng giọng; không tự chuyển về giọng mặc định. Giọng AI lần tạo mới vẫn phụ thuộc mạng và quota. Chưa kiểm thử trên iPhone vật lý trong môi trường này.

Bộ Topics v2 có nghĩa tiếng Việt cho toàn bộ 4.000 mục; bấm mắt đọc trực tiếp từ pack, không cần API và dùng được ngoại tuyến sau khi tải chủ đề. Nghĩa và 60 ví dụ song ngữ đi cùng thẻ đã lưu, câu hỏi và JSON backup; quiz không dùng cách diễn đạt cùng khái niệm làm đáp án nhiễu. Các ngôn ngữ khác vẫn dùng dịch vụ dịch. Mắt ở Dictionary và các nội dung chưa có bản dịch chuẩn bị các định nghĩa đang hiện trên màn hình; Study chuẩn bị câu hiện tại và kế tiếp. Các nhóm tối đa 4 nội dung, tối đa 2 nhóm đang chạy, dùng chung cache theo từng nội dung/ngôn ngữ/mục đích/nghĩa. Không dịch trước cả thư viện 4.000 từ và không tạo giọng AI tự động. Bản dịch hợp lệ giữ qua reload, ngoại tuyến và qua ngày, giới hạn 5.000 mục hoặc 1 triệu ký tự trên thiết bị. Dữ liệu cũ theo nhóm được chuyển sang từng mục; cache từ, giọng, bộ từ và lịch ôn không bị xóa. Nội dung dài được chia đủ phần, không cắt nghĩa.

Server chuẩn bị lại tối đa 5.000 bản dịch đã lưu trong TiDB khi kết nối database lúc khởi động, tránh đọc riêng từng mục. Không đổi schema và không cần thêm API key. Chế độ giọng AI chuẩn bị quyền đọc 20 đầu mục Topics trong một request; âm thanh vẫn lấy từ cache đúng giọng hoặc tạo khi người dùng bấm, giữ giới hạn quota.

Mục tiêu dưới 1 giây áp dụng cho giọng máy đã sẵn sàng, bản dịch đã chuẩn bị và âm thanh AI đã cache. **Lượt dịch hoặc tạo giọng AI mới hoàn toàn vẫn phụ thuộc nguồn bên ngoài và mạng; không có cam kết dưới 1 giây.** Kiểm thử trình duyệt desktop và kích thước iPhone với nguồn dịch/giọng mô phỏng chậm 1,2 giây cho thấy thao tác dùng cache/giọng máy khoảng 33–100 ms; kết quả này kiểm tra luồng UI, không đo độ trễ giọng thực trên điện thoại.

Chỉ tải dữ liệu chủ đề đang mở, không gọi AI khi tạo quiz. Kiểm tra và tái tạo bằng `npm run build:topics` / `npm run audit:topics`. Xem [quy trình biên soạn và kiểm tra](docs/topics.md).

Bộ IELTS mới dùng URL `/assets/topics/v2/*.json` để không bị cache v1 che mất. Cần tải lại chủ đề bằng **Save topic offline** để lưu bản mới. Bộ v1 đã tải vẫn mở dự phòng khi mất mạng; từ cá nhân và lịch ôn cũ không bị sửa. Kết quả luyện v1/v2 được ghi riêng trong cùng backup. Không tạo 4.000 bản dịch bằng Gemini hoặc giọng AI khi cập nhật nội dung.

### Voice selection QA — 2026-10-11

292 kiểm thử đạt, 3 MySQL bỏ qua do thiếu cấu hình. Kiểm thử trình duyệt desktop và iPhone mô phỏng xác nhận đổi Bella/Sarah từ cả hai ô chọn, dừng chế độ máy khi chọn ElevenLabs, giữ giọng sau reload và quiz Topics gửi đúng voice ID. Giọng máy chỉ chạy khi chọn rõ chế độ device. WCAG AA kiểm tra vùng Topics không có vi phạm và không tràn ngang ở 390px/1440px. Luồng phát âm dùng phản hồi audio giả lập để không tiêu thụ quota; chưa xác minh chất lượng nghe hoặc Safari trên iPhone vật lý. Render `/api/voices` trước cập nhật trả 23 giọng; không cần thay API key cho lỗi đồng bộ này.

### Faster pronunciation and device voice choice — 2026-10-11

Âm thanh ElevenLabs mới dùng `eleven_flash_v2_5` cho tốc độ tạo nhanh hơn, giữ nguyên voice ID người dùng chọn. Âm thanh đã lưu trên thiết bị/server vẫn dùng lại, không tự tạo lại bằng mô hình mới. Kiểm tra quota TTS của cả ba giới hạn dùng một câu UPDATE có điều kiện trên cùng một hàng, thay vì chín câu SQL cùng BEGIN/COMMIT. Mỗi lần cập nhật kiểm tra đủ ngày/tháng/thiết bị và trừ tất cả hoặc không trừ; lỗi database vẫn chặn tạo âm thanh. Header `Server-Timing` của TTS phân tách tổng thời gian, quota và provider để chẩn đoán. Không tự tải/tạo giọng cả 20 từ vì dùng quota Free. Lần đầu vẫn phụ thuộc mạng, quota và việc Render Free khởi động lại; không cam kết mọi lần dưới một giây.

Đổi giọng máy: **Topics → Topic audio → Fast device voice → Device voice**. Danh sách chỉ gồm giọng tiếng Anh trình duyệt công bố; nhãn Eng/Ame theo `lang`, đánh dấu giọng cục bộ hoặc giọng có thể cần Internet. Lựa chọn lưu qua reload bằng khóa riêng `helen-device-voice-v1`, dùng cho từ Topics và quiz từ Topics; chọn Auto để dùng lựa chọn tự động. Không thay giọng ElevenLabs đã lưu. Khi giọng đã chọn không còn trên thiết bị, app yêu cầu chọn lại thay vì tự phát một giọng khác. Danh sách cập nhật khi hệ điều hành cung cấp giọng muộn.

QA: 300 kiểm thử đạt, 3 MySQL chưa chạy do thiếu cấu hình. Kiểm thử riêng quota với ba bucket và mức tăng khác nhau xác nhận tám yêu cầu đồng thời chỉ chấp nhận đúng ngân sách, không trừ một phần. Browser desktop/iPhone mô phỏng xác nhận chọn giọng máy Anh–Anh, giữ ID lựa chọn, chuyển lại ElevenLabs và quiz vẫn dùng đúng giọng. Không tràn ngang ở 390/1440px; kiểm tra WCAG AA vùng Topics không có vi phạm. Kiểm thử audio trình duyệt dùng dữ liệu giả lập; chưa kiểm thử iPhone vật lý.

**TTS budget migration:** Bảng mới `helen_tts_usage` tự tạo khi backend khởi động. Một hàng giữ tổng ngày/tháng và bản đồ bộ đếm thiết bị đã băm của ngày hiện tại. Lần đầu chuyển đổi giữ số đã dùng từ `helen_usage_budget`; các lần restart không ghi đè số đã dùng. Đổi ngày/tháng đặt lại đúng bộ đếm; yêu cầu có ngày cũ không được đặt lại hạn mức mới. Ledger được chuẩn bị sau khi database khởi động, rồi mỗi lần tạo TTS chỉ cần một UPDATE atomic trong autocommit. Kết nối quota riêng được làm nóng lúc khởi động và tái sử dụng; deadline đọc cache không phá kết nối này. Query dùng giá trị được mysql2 escape, bỏ round trip PREPARE, giữ kiểm tra TLS và multipleStatements=false. Pool riêng giới hạn một kết nối, đóng cùng backend; hết hạn quota hoặc lỗi database vẫn từ chối tạo âm thanh mới. Giới hạn AI/Merriam-Webster vẫn dùng bảng và transaction riêng. Không cần người dùng nhập key mới hay chạy SQL thủ công. Khởi động/migration lần đầu và mạng database vẫn có độ trễ; mẫu đầu tiên trước tối ưu cuối mất 3,06 giây (quota 2,14 giây, provider 0,24 giây), mẫu nghe lại 0,28 giây. Các số là mẫu đo, không phải SLA.

## Translation batches and persistent reuse

Dictionary prepares all definitions of the word just searched, including those below the fold, in the selected meaning language. Five ordinary definitions use one `/api/translate` request; the eye buttons share its individual pending/results cache. Changing languages prepares the current word again; reload/offline reuse the existing browser translations. Requests cap at 40 chunks; Gemini splits unusually long words into at most 12 chunks/3,000 source characters per provider batch. Local curated Vietnamese entries remain immediate and never call a provider.

Missing definition batches go directly to Gemini when configured. Without Gemini, or if it fails while time remains, MyMemory remains a per-sentence fallback; its API does not provide a reliable equivalent batch endpoint. A headword summary keeps its separate sense-aware purpose and may be a separate request. No unrelated words are translated in advance.

TiDB remains the shared cache in `helen_cache`, using the existing `translation-v2` and `translation-semantic-v4` namespaces. A separate pool avoids the general dictionary cache's 250 ms deadlines; one SELECT reads a word's missing translations and one upsert writes a completed batch. Old valid translations are reused even after `fresh_until`; source text, language and purpose identify the translation. Startup restores up to 5,000 recent entries and retries a failed load; older entries remain available through indexed reads. Cache errors do not count as a miss and cannot trigger redundant provider generation. Queued writes retry after connection recovery and drain during normal SIGTERM/redeploy, before the database closes.

`/healthz` reports `translation.cache.loaded`, `readError`, `writeError` and `pendingWrites` independently from the cache count. `loaded: true` with a zero count can be a genuinely empty table; `loaded: false`/an error means loading was not confirmed. This is durable reuse on the current single Render process, not a distributed exactly-once transaction across multiple workers or protection from abrupt power loss. No new SQL table or environment variable is required.

## Practical AI speaking

**Practical AI → `/practical-ai`** là trang riêng để luyện hội thoại bằng micro hoặc nhập câu trả lời, với tab viền vàng và ngôi sao nhẹ (tắt chuyển động khi thiết bị yêu cầu). Có sáu tình huống: café, travel, job interview, everyday speaking, opinions và free conversation; chọn mức A2/B1/B2. Người học nhận câu đáp có câu hỏi tiếp theo, bản dịch tiếng Việt, một góp ý cụ thể, câu đã sửa và một cụm từ hữu ích. Bấm Translation mở nghĩa đã có sẵn, không gọi API dịch lần nữa.

Micro dùng MediaRecorder MP4 trên Safari hoặc WebM trên trình duyệt hỗ trợ, **tối đa 180 giây / 6 MB**. Bộ đếm hiển thị thời gian; bấm Speak để thu, bấm lần nữa để gửi, hoặc gửi tự động khi hết 3 phút. Khoảng nghỉ trong câu không tự kết thúc bản thu; im lặng hoàn toàn 6 giây vẫn báo chưa thu được tiếng. Cancel, đổi trang hoặc đưa app ra nền giải phóng micro và bỏ phản hồi đến muộn. Dictionary Voice Search giữ giới hạn ngắn cũ. Câu trả lời tối đa 900 từ / 6.000 ký tự.

Nhận diện chạy riêng ở temperature 0, chỉ gửi audio và ngôn ngữ, không gửi tình huống/lịch sử để tránh gợi ý từ theo ngữ cảnh. **Auto-send clear speech** mặc định bật: câu nghe rõ chuyển thẳng sang AI và tự đọc câu đáp, không cần Confirm hoặc bấm loa. Có thể tắt để kiểm tra mọi câu trước. Chỗ không rõ dùng `[unclear]`, luôn giữ ở **Review what I heard** để sửa/thu lại. Không tự gửi bản nháp khi reload. Hai bước tương ứng hai generation; gõ trực tiếp chỉ một. Đây là prompt/luồng tương tác, không fine-tune mô hình; ASR vẫn có thể nhận nhầm từ. Các sửa câu phải trích đúng đoạn duy nhất, không chồng lấn; câu sửa được dựng từ edits tại server thay vì yêu cầu AI sinh lại toàn bộ bản chép lời, giảm token và thời gian với câu dài. Gợi ý **Vocabulary & collocations** gồm cụm tự nhiên, nghĩa Việt và câu ví dụ; lựa chọn diễn đạt hợp lệ không được gọi là lỗi. Kiểm thử mô phỏng không thay thế kiểm tra micro trên iPhone vật lý.

**End & see band** kết thúc phiên sau tối thiểu 80 từ gốc, trả bốn tiêu chí IELTS Speaking: Fluency & coherence, Lexical resource, Grammatical range & accuracy, Pronunciation, cùng dẫn chứng và 1–3 việc nên luyện tiếp. Đây là **band ước lượng AI, không phải điểm IELTS chính thức**, chưa hiệu chuẩn với giám khảo. Nhận xét âm thanh được tạo ngay trong bước nhận diện, có chữ ký và gắn với thiết bị; không lưu file âm thanh. Đánh giá cuối phiên dùng bản chép lời gốc được ký, không chấm câu đã sửa để tránh tăng điểm giả. Chữ ký có hiệu lực 30 ngày; đổi key Gemini làm chữ ký cũ không dùng được, báo cáo đã lưu vẫn đọc được. Cần tổng ít nhất 30 giây âm thanh có nhận xét hợp lệ; câu gõ không được suy ra phát âm/tốc độ nói. Band tổng chỉ có khi mọi lượt được ghi âm và cả bốn tiêu chí có đủ dữ liệu; tính trung bình trọng số bằng nhau, làm tròn 0,5 tại server. Phiên thiếu âm thanh hiện đánh giá từng phần và lý do, không bịa điểm. Đánh giá chỉ phát sinh một generation, có hạn mức riêng mặc định 10 lần/thiết bị/ngày (`PRACTICAL_DEVICE_DAILY_ASSESSMENT_LIMIT`), không trừ vào 100 lượt đáp; cùng chịu trần chung 600 generation; retry cùng yêu cầu dùng lại kết quả 5 phút, reload không chấm lại.

Nhân vật hoạt hình Helen có chuyển động nhẹ khi nghe, suy nghĩ và nói. Trạng thái nói chỉ bắt đầu khi âm thanh thực sự phát và kết thúc khi tiếng dừng; đây là mô phỏng bằng ảnh và CSS, chưa phải video hay đồng bộ khẩu hình. Trên điện thoại, Conversation settings mặc định thu gọn để nhân vật và hội thoại hiện ngay; bấm để đổi tình huống, trình độ hoặc giọng. Thay tên, ảnh và giọng mặc định tại `public/assets/practical-partner.json`; ảnh WebP khoảng 40 KB và được cài cùng shell ngoại tuyến.

AI mặc định dùng **(Ame) Jessica · Playful, Bright, Warm** của ElevenLabs, độc lập với Preferences của Dictionary/Topics. Mỗi lượt gửi thành công tự đọc **một câu trả lời**; không tự đọc góp ý/bản dịch, không phát lại khi reload hoặc mở lại lịch sử. Tắt Auto-read replies để chỉ đọc khi bấm loa/Hear reply; Stop voice, bật micro, đổi giọng, đổi trang hoặc đưa app ra nền dừng cả request tiếng đang chờ. Listen with có giọng máy, AI voice chọn riêng hoặc Use my Preferences voice. Giọng máy có lựa chọn riêng; Auto ưu tiên giọng Anh thân thiện như Samantha khi thiết bị cung cấp. Tùy chọn **Keep speaking with device voice** mặc định bật: chỉ chuyển sang giọng máy khi backend xác nhận ElevenLabs hết quota (`USAGE_LIMIT`/`VOICE_QUOTA`), có nhãn rõ, không đổi lựa chọn Jessica/global. Có thể tắt; lỗi key/quyền giọng/proof hoặc kết nối không tự đổi provider. **Try AI voice again** thử lại một lần khi người dùng muốn. Hạn mức giọng đã hết được nhớ tới ngày UTC kế tiếp, tránh gọi lỗi ở mỗi câu; retry chủ động xóa trạng thái này. Nếu Safari chặn giọng máy sau lời gọi async, Hear reply phát ngay trong thao tác chạm.

Safari được unlock phần tử Audio và AudioContext trong thao tác chạm. Nếu Safari từ chối media tự phát nhưng AudioContext vẫn chạy, cùng đoạn MP3 được decode và phát qua Web Audio, không đổi giọng hoặc gọi TTS thêm. Context chưa chạy vẫn có fallback Hear reply; dừng/hủy phải dừng cả nguồn Web Audio. Phần tử Audio được unlock bằng một đoạn WAV im lặng 20 ms ngay trong thao tác chạm và dùng lại cùng phần tử Audio; Safari vẫn có thể chặn tự phát sau khi app ra nền/ghi âm tự kết thúc. Khi bị chặn, app hiện “Bấm Hear reply để nghe”, dùng lại đoạn đã cache thay vì gọi TTS lần nữa. Đây là giải pháp có fallback, không phải cam kết bypass giới hạn iOS. Giọng máy nghe lại được gọi ngay trong thao tác chạm; giọng OS có thể vẫn cần Internet. Các lựa chọn giữ trong `helen-practical-voice-v1`, `helen-practical-ai-voice-v1`, `helen-practical-device-voice-v1`, `helen-practical-autoplay-v1`, không sửa giọng đã chọn cho các trang khác.

Âm thanh trả lời đã thành công được lưu riêng tại `helen-practical-audio-v1` (tối đa 30 đoạn/5 MB), tái sử dụng đúng text/voice khi nghe lại và ngoại tuyến. Cache này không đẩy các đoạn Dictionary/Topics yêu thích khỏi cache cũ; service worker giữ cả hai qua cập nhật. Giọng mới dùng proof/hạn mức TTS hiện có, request bị giới hạn thời gian và không retry tự động. Khi đã hết quota và bật lựa chọn tiếp tục, dùng giọng máy; đoạn ElevenLabs đã cache vẫn được ưu tiên khi chưa chuyển chế độ. Cache riêng và giọng thiết bị không tăng số ký tự ElevenLabs Free được cấp.

Cửa sổ hội thoại giữ 12 lượt trao đổi trong `helen-practical-ai-v1`; nhật ký đánh giá giữ toàn phiên (tối đa 100 câu trả lời / 60.000 ký tự kể cả câu hỏi) và báo cáo tại khóa riêng `helen-practical-session-v1`. Reload, chuyển trang và ngoại tuyến giữ cả hai; không mất những lượt đầu khi chat rút gọn. `helen-practical-auto-send-v1` lưu lựa chọn tự gửi. Nhật ký Practical chưa nằm trong JSON backup của kho từ. Khi mất mạng, app đã cài mở lại trang và xem hội thoại được; gửi câu mới cần Internet. New session hoặc đổi tình huống/trình độ thay thế phiên hiện tại sau khi xác nhận. Không có tài khoản đồng bộ trong thay đổi này. Nguồn/API hiện có vẫn giữ điều kiện sử dụng, xem [Sources & privacy](/assets/sources.html).

Backend dùng **GEMINI_API_KEY/GEMINI_MODEL đang có**, không cần key mới hoặc bảng SQL mới. `/api/practical/status` chỉ báo cấu hình và trả proof cho câu mở đầu, không tiêu tốn generation. `/api/practical` production giới hạn 8 request/phút/IP, yêu cầu mã thiết bị, có hạn mức luyện nói riêng: **100 attempts tạo câu đáp/thiết bị/ngày**, 150 attempts nhận diện/thiết bị/ngày, 600 generation luyện nói/ngày cho toàn website. Lượt dịch/context không trừ vào 100 lượt này. Đặt lại ngày UTC lúc 07:00 Việt Nam; reservation lỗi/retry đổi model vẫn tính, retry cùng ID/nội dung thành công không tính lại. Ngân sách lưu atomic ở bảng `helen_usage_budget` đang có; reuse pool AI đã làm nóng để giảm handshake, không cần thêm bảng hay SQL thủ công. Góp ý từng câu dựa trên bản chữ đã xác nhận chỉ nhận xét ngữ pháp, từ vựng và ý; nhận xét về giọng nói phải đợi đánh giá cuối phiên có bằng chứng âm thanh. Nhận diện vẫn có thể nghe sai, nên luôn có tùy chọn tắt tự gửi để kiểm tra/sửa trước. Không tăng/né hạn mức Gemini hoặc ElevenLabs của nhà cung cấp: quota Free thực tế hoặc trần chung toàn website vẫn có thể hết trước các giới hạn này. Voice thiết bị giúp đọc tiếp mà không gọi ElevenLabs; hội thoại AI mới vẫn cần Gemini có quota. Nhận diện dài có watchdog 25 giây, đánh giá 20 giây; client tối đa 35/25 giây cho hai tác vụ này thay vì áp trần tra từ 7,5 giây. Phản hồi bình thường giữ deadline ngắn. Đây là giới hạn chờ, không phải SLA; thời gian thực tùy mạng/provider. Phản hồi được kiểm tra cấu trúc/độ dài, provider errors được lọc; yêu cầu cùng ID/nội dung đang xử lý hoặc đã thành công trong 5 phút không gọi AI lần nữa. Không lưu audio/hội thoại vào cache TiDB chung; ngữ cảnh gần nhất được gửi Gemini khi bạn gửi câu. Server giữ tạm tối đa 100 phản hồi để xử lý retry, không phải kho hội thoại lâu dài. Các câu nghe ElevenLabs vẫn cần pronunciation proof và hạn mức TTS.

QA (11 October 2026, faithful speech and daily-budget update): **353 tests passed, 3 real MySQL integration tests skipped** without local credentials. New checks cover no context hints during transcription, uncertainty/silence, exact correction spans, retry isolation, 100 speaking reservations independent from translation/ASR, atomic shared/device limits across restart, and quota-only opt-in device fallback. Browser checks at 320/390/768/1440px confirm editing before submission, no premature coaching/TTS, draft reload, preserved independent/global voices, blocked device playback recovered synchronously on tap, no repeated exhausted-voice requests, mute and cancellation, zero light/dark WCAG AA violations and no overflow. Installed shell preserves the unconfirmed draft offline. Audio/provider tests use fixtures; these do not establish physical iPhone ASR or pronunciation accuracy. Existing exact-voice offline playback and favorites caches pass regression checks. No new dependency, secret or table is required.

Live Render verification of 012d848: a previously generated synthetic Jessica clip produced only an editable transcript in 3.102 s; coaching returned grounded edits in 2.752 s, cached retry in 0.259 s. Daily speaking allowance reported 100 and TiDB was connected. This sample checks the deployed integration, not human pronunciation accuracy or a latency guarantee.

**Browser tab logo:** mẫu H trong bong bóng thoại/ngôi sao do người dùng chọn. Favicon PNG 32/64px và ICO 16/32/48px được khai báo trên tất cả trang, có endpoint `/favicon.ico` và lưu trong shell ngoại tuyến. Bản gốc để sửa/thay nằm tại `public/assets/icons/helen-logo-v1.png`; thay thiết kế bằng phiên bản tên mới để tránh favicon cache cũ. Chỉ đổi favicon tab; icon màn hình chính/manifest hiện có vẫn giữ theo yêu cầu làm rõ.

### Dictionary translation latency

Cả một định nghĩa và các lô định nghĩa đi thẳng tới Gemini khi đã cấu hình, giữ MyMemory làm fallback trong thời gian còn lại. Không chờ tác vụ khám phá mô hình khởi động trước khi dịch; cache cục bộ/TiDB, gộp request và chuẩn bị bản dịch sau Search vẫn giữ nguyên. Hạn mức AI dùng lại hàng `ai-day` trong `helen_usage_budget`, chuẩn bị kết nối riêng lúc startup; mỗi generation chỉ một UPDATE có điều kiện thay vì nhiều SELECT/UPDATE và BEGIN/COMMIT. Không reset số đã dùng, không vượt hạn mức khi nhiều yêu cầu đồng thời, lỗi database vẫn chặn generation. Pool một kết nối đóng cùng backend. Dịch lần đầu vẫn phụ thuộc mạng/nguồn dịch; không cam kết mọi lần dưới một giây.

QA (11 October 2026, interactive partner update): 342 tests passed, 3 real MySQL tests skipped because this workspace has no credentials. Browser checks at 320/390/768/1440px cover typed replies, one recorded-audio request, cancellation/retry identity, stored conversation after reload and installed-shell offline reload. Light/dark Practical AI has zero WCAG AA violations and no horizontal overflow. Independent Jessica default, unchanged Dictionary voice, one automatic read per reply, cache-only replay, persisted mute, blocked autoplay recovery, microphone release before reply, and synchronous manual device replay passed browser checks. Character/controller/config and cached speech work after installed-shell offline reload; full stage controls remain visible at 320px. The avatar respects reduced motion. Audio recording/playback checks use fixtures; physical iPhone microphone quality and pronunciation accuracy remain to be checked on-device. Local quota concurrency tests preserve the legacy daily counter and reject excess requests. No new dependencies or credential values are added.

## Browser security and history migration

Production history uses an opaque random host cookie named `__Host-helen-device`, with HttpOnly, Secure, SameSite=Strict, Path=/ and no Domain. A previous `helen-history-device` bearer is imported once through the same-origin JSON `/api/session` endpoint; its existing database identity remains unchanged. The browser removes the legacy localStorage bearer only after cookie-authenticated history succeeds. Blocked cookies or offline migration retain the old identity and queued history for a later retry. Future reloads use the cookie; production rejects an `X-Helen-Device` header as history authorization. Quota/TTS uses a separate `helen-api-device-v1` identifier, which is not a history credential. There is no account/JWT or cross-device login in this change.

Responses add a nonce-based script CSP (no unsafe-inline/unsafe-eval for scripts), frame blocking, nosniff, a restrictive referrer policy and microphone=self permission policy. HTTPS production responses add HSTS. API calls reject foreign Origin/cross-site fetch metadata and non-JSON mutations. Session/voice listing receive rate limits; parser failures return short JSON without stacks or provider secrets. Inline styles remain permitted for the existing layout; static self-hosted scripts and offline shell are preserved. Secrets remain in Render/server environment, never cookies, client code, backups or browser storage. See [SECURITY.md](SECURITY.md).

QA: 311 tests passed, 3 real MySQL integration tests skipped because this workspace has no test credentials. Desktop and iPhone-sized Chromium checks confirmed one five-definition request per language, pending-click reuse, reload/offline translations, a cookie invisible to JavaScript, blocked injected script, no horizontal overflow and zero WCAG AA violations in Dictionary results. Provider/browser checks use fixtures and do not prove physical iPhone behavior or complete translation accuracy. Current tracked/staged files and reachable main history pass secret scanning; npm production dependency audit reported zero known vulnerabilities on 11 October 2026. Initial uncached translations still depend on network/provider quota; no universal sub-second SLA is claimed.


Practical conversation QA (11/10/2026): 366 kiểm thử đạt, 3 MySQL integration chưa chạy vì môi trường local không có cấu hình database. Browser QA mô phỏng ở 320/390/768/1440 px: tự gửi câu nghe rõ, tự đọc đáp, yêu cầu sửa câu chưa rõ, bộ đếm/gửi khi hết 180 giây, đủ bốn thẻ đánh giá, lưu báo cáo qua reload và đọc ngoại tuyến; không tràn ngang và không có vi phạm Axe WCAG AA ở light/dark. Web Audio có kiểm thử kích hoạt từ thao tác chạm, phát cùng clip khi media bị Safari chặn và bỏ decode đến muộn sau Cancel. Bản ghi/giọng browser là fixture; không coi đây là kiểm chứng nhận diện iPhone thực tế hoặc độ chính xác band với giám khảo.

Security review (12/10/2026): đã sửa crash từ query dạng object và kiểm tra Origin/no-store bị bỏ qua qua API viết hoa; bọc lỗi async Express 4, giới hạn collocations, từ chối JSON nén và dùng prepared parameters cho ghi cache dịch. 375 kiểm thử đạt; 3 MySQL integration local chưa chạy. Browser mobile/desktop xác nhận cookie HttpOnly, CSP và nội dung từ điển/AI/ôn tập không chạy thành mã, kể cả shell ngoại tuyến. Xem [báo cáo bảo mật](docs/security-review-2026-10-12.md) về phạm vi, kết quả và phần không thể kiểm chứng chỉ từ mã nguồn. Không cần key, cấu hình hoặc bảng SQL mới.

Speaking flow (12/10/2026): sửa lỗi “Góp ý AI chưa khớp câu của bạn” khi lời nói có nhiều cụm lặp. Bỏ riêng sửa câu không đủ rõ thay vì từ chối cả câu đáp; server chỉ áp dụng đoạn trích khớp nguyên câu, giữ bản gốc cho hội thoại/chấm band. Thẻ Speaking flow đếm âm đệm trong bản chữ, gợi ý ngừng ngắn và ba cụm suy nghĩ/nhớ lại/diễn đạt phù hợp; không coi mỗi um/uh là lỗi ngữ pháp hoặc tự trừ band. Phần hướng dẫn này chạy ngay trong cùng response, không thêm lượt AI. Chấm phiên dùng thống kê từ lời gốc có chữ ký; không lấy câu đã sửa để tăng band. Xem [nguồn tham khảo và quy tắc](docs/speaking-flow-2026-10-12.md). Đây là nâng cấp prompt/logic coaching, không phải fine-tune model.

QA: 382 kiểm thử đạt, 3 MySQL integration local chưa chạy. Browser 390/1440 px kiểm tra nhận diện → tự gửi → giữ góp ý hợp lệ → tự đọc một câu đáp, thẻ Speaking flow mở bằng bàn phím, reload không gọi AI và đọc ngoại tuyến; không tràn ngang, không có vi phạm Axe WCAG AA ở light/dark. Audio/provider browser là fixture; chưa có file ghi âm gốc của người dùng để đối chiếu và chưa kiểm tra iPhone vật lý. Không thay key, quota, giọng đã chọn, dữ liệu học hoặc bảng SQL.

Quota đánh giá dùng bucket `practical-assess-device`, vừa `VARCHAR(24)` của bảng hiện có; kiểm thử budget kiểm tra giới hạn tên này để tránh lỗi TiDB ở bước chấm. Không cần migration hoặc nhập SQL.
