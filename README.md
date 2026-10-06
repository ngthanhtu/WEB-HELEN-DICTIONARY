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

Datamuse (`api.datamuse.com`, không cần key) bổ sung quan hệ đồng nghĩa/trái nghĩa, lọc theo từ loại. Hai nhãn luôn hiển thị; nếu nguồn không có dữ liệu phù hợp hoặc không truy cập được thì báo rõ thay vì tạo từ không có cơ sở.

Tra cứu trả định nghĩa từ nguồn hợp lệ đầu tiên thay vì đợi mọi nguồn. IPA và từ liên quan bổ sung bằng yêu cầu `details=1` chạy nền; kết quả đầy đủ được cache và các yêu cầu trùng dùng chung tác vụ. Điều này giảm thời gian chờ nguồn phụ, nhưng không loại bỏ thời gian khởi động khi Render Free ngủ.

Từ điển dùng thêm Princeton WordNet 3.1 cài cùng server để tra nhanh và giữ synonym/antonym theo từng synset (nghĩa). Quan hệ trái nghĩa đọc đúng liên kết lexical của chính từ được tra. Giao diện đánh số từng nghĩa, liệt kê ví dụ và đặt quan hệ ngay dưới nghĩa đó; dữ liệu Datamuse theo từ loại được tách vào Từ liên quan. Không suy diễn rằng hai từ cùng từ loại là đồng nghĩa. `Experimentation` gần nghĩa với `experiment` ở nghĩa hoạt động thử nghiệm; `try out` tương ứng một nghĩa của động từ; `experiment` không có trái nghĩa trực tiếp trong nguồn này. Phần trình bày tham khảo bố cục trong ảnh Oxford, không sao chép nội dung Oxford hoặc gán nhãn Oxford cho nguồn khác.

## Gợi ý chính tả, collocations và bộ từ cá nhân

Khi không có kết quả khớp chính xác, ứng dụng hiển thị các từ gần nhất từ danh sách lemma của WordNet. Gợi ý được xếp theo khoảng cách chính tả (bao gồm đảo hai chữ cạnh nhau), sau đó tần suất nghĩa trong WordNet; không tự đổi từ đã nhập. Bấm một từ gợi ý để tra lại tiếng Anh, hiển thị định nghĩa, ví dụ và các dữ liệu của chính từ được chọn. Nếu các dịch vụ tra cứu đều lỗi, ứng dụng báo lỗi kết nối thay vì khẳng định từ không tồn tại. Các từ ngoài phạm vi WordNet vẫn được thử ở nguồn từ điển trực tuyến như trước.

**Collocations — Cụm từ thường dùng** hiển thị nhóm cấu trúc và ví dụ do Helen Dictionary biên soạn trong `lib/collocations.js` (ban đầu có experiment, experience, environment, decision, research, evidence, progress, mistake, advice, attention, opportunity, responsibility). Đây là nội dung học tập tự biên soạn, không phải dữ liệu Oxford. Datamuse `rel_bgb`/`rel_bga` bổ sung cụm đứng trước/sau trong mục có thể mở rộng; đã lọc từ chức năng và dấu câu, nhưng dữ liệu thống kê chưa phân biệt từng nghĩa. Không dùng chúng thay cho collocations đã biên tập. Nguồn chưa bao phủ mọi từ; ứng dụng ghi rõ khi không có dữ liệu. Mỗi cụm có loa dùng giọng đang chọn. Nguồn này chạy cùng các dữ liệu bổ sung, không chặn kết quả định nghĩa đầu tiên.

Mục Voice thêm `(Eng)` cho accent Anh và `(Ame)` cho accent Mỹ dựa vào `labels.accent` từ ElevenLabs. Giọng có accent khác hiển thị accent đó; thiếu metadata hiển thị “Chưa rõ accent”. Tên giọng không được dùng để suy đoán accent. ID đang chọn và khả năng lưu lựa chọn giữ nguyên.

Bấm **☆ Lưu từ** cạnh đầu mục để thêm vào **Từ yêu thích**, bấm **★ Đã lưu** để bỏ lưu. **Lịch sử tra cứu** ghi tối đa 40 từ tra thành công gần nhất, không lưu lỗi chính tả. Bấm một từ đã lưu để tra lại; nút **Xóa lịch sử** chỉ xóa lịch sử. Có thể lưu tối đa 100 từ yêu thích. Cả hai dùng localStorage, không cần tài khoản, không đồng bộ giữa các trình duyệt hoặc thiết bị và mất khi xóa dữ liệu website. Khôi phục kết quả sau khi tải trang không tự ghi lại lịch sử đã xóa.

Kiểm tra sau triển khai: tra `experimence` → bấm `experiment` → kiểm tra 5 nghĩa, loa định nghĩa, collocations → lưu từ → tải lại → mở Từ yêu thích/Lịch sử → đổi Dark/Light và kiểm tra nhãn Voice.

## Gợi ý nhanh và thẻ thông tin bổ sung

Khi tra một từ tiếng Anh, trình duyệt chờ ngắn rồi gọi `/api/spelling?word=...` nếu yêu cầu tra cứu vẫn đang chạy. Danh sách từ gần giống được tính từ WordNet ngay trên server và hiển thị dưới nhãn **Gợi ý nhanh**; đây chỉ là gợi ý cách viết trong lúc các nguồn trực tuyến xác minh từ. Kết quả tra chính xác vẫn có ưu tiên: khi có định nghĩa, giao diện hiển thị từ đã nhập; khi xác nhận không có kết quả, nhãn gợi ý chuyển thành thông báo không khớp. Bấm gợi ý sẽ tra đúng từ đã chọn. Chỉ sử dụng dữ liệu WordNet cho từ tiếng Anh để tránh gợi ý sai ngôn ngữ. Server làm nóng danh sách chính tả khi khởi động; gọi `/api/spelling?word=experiment` trả danh sách rỗng, còn `experimence` trả các gợi ý gần nhất.

Nút mắt và loa, ô ngôn ngữ, giọng và ô tìm kiếm có viền sáng, bóng nhẹ và phản hồi khi hover/focus. Màu được điều chỉnh cho cả Light/Dark. Từ yêu thích và lịch sử có thẻ nổi bật; nội dung từ liên quan, ví dụ bổ sung và collocations nằm trong thẻ **Explore more**, mặc định đóng. Bấm tiêu đề hoặc dùng bàn phím để mở; khi dữ liệu bổ sung tải xong, trạng thái mở được giữ. Loại từ, định nghĩa, ví dụ trong từng nghĩa và quan hệ đồng/trái nghĩa của từng nghĩa vẫn đọc được ngay trên trang.

## Dịch từ dễ nhầm giữa tiếng Anh và tiếng Việt

`loan` được giải nghĩa là “khoản vay; cho vay, cho mượn; từ vay mượn”, thay vì lặp lại chữ `loan`. `lib/vietnamese.js` có các giải nghĩa ngắn biên soạn cho các từ thường dễ nhầm như loan, may, can, ban, song, son, long, mine, bank… Khi dịch Anh–Việt, kết quả lặp nguyên văn tiếng Anh bị loại; ứng dụng thử kết quả dịch phù hợp khác. Các từ vay mượn được dùng nguyên dạng trong tiếng Việt như internet, email, taxi… vẫn được chấp nhận. Nếu dịch riêng đầu mục không có kết quả hợp lệ, định nghĩa của từ cung cấp ngữ cảnh để hiển thị giải nghĩa tiếng Việt. Đây là bước kiểm soát bản dịch, không bảo đảm mọi nghĩa của mọi từ đều được dịch hoàn hảo. Từ nhiều nghĩa vẫn cần đọc nghĩa được đánh số và ví dụ.

## Tìm bằng giọng nói

Bấm micro trên thanh tìm kiếm, cấp quyền micro khi trình duyệt hỏi và đọc từ bằng ngôn ngữ chọn ở bên trái thanh tìm kiếm. Chỉ kết quả nhận diện cuối cùng mới được dùng để tra cứu; bấm micro lần nữa để dừng. Gõ phím hoặc đổi ngôn ngữ nhập sẽ hủy lượt nghe đang chạy. Trình duyệt không hỗ trợ, thiếu micro, từ chối quyền, lỗi mạng hoặc không nghe được tiếng đều có thông báo riêng.

Dùng Web Speech API (`SpeechRecognition` hoặc `webkitSpeechRecognition`), phù hợp với Chrome và các trình duyệt có hỗ trợ; cần HTTPS hoặc localhost. Dịch vụ nhận diện của một số trình duyệt gửi âm thanh tới nhà cung cấp của trình duyệt và cần Internet. Server Helen Dictionary không nhận/tích trữ bản ghi âm. Các kiểm thử nhận diện dùng sự kiện mô phỏng; kiểm tra âm thanh thật trên thiết bị có micro. Tham khảo MDN: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition.

## Minh họa ngữ cảnh bằng Gemini

Phần **AI contexts** trong **Explore more** cho phép chọn một nghĩa rồi tạo hội thoại song ngữ, tình huống thực tế, ghi chú sử dụng và prompt tiếng Anh cho video hoạt hình. Hội thoại/tình huống có loa dùng giọng đang chọn; prompt có nút sao chép để dùng ở công cụ tạo video. Bản dịch theo ngôn ngữ **Meanings in**. Nội dung có nhãn AI tạo, không được dùng thay cho dữ liệu định nghĩa của nguồn từ điển.

Ứng dụng dùng SDK Google Gen AI chính thức (`@google/genai`), yêu cầu Node.js 20 trở lên; Render tiếp tục dùng Node.js 24. Không cần thêm Python. Server tự lấy định nghĩa tương ứng từ nguồn từ điển và truyền cho Gemini; client chỉ gửi từ, chỉ số nghĩa và ngôn ngữ. API key chỉ nằm ở server.

Bật trên Render:

1. Tạo API key ở https://aistudio.google.com/app/api-keys.
2. Render → Web Service → **Environment** → thêm **GEMINI_API_KEY** và dán key vào ô Value bảo mật; Save/Deploy. Không commit hoặc gửi key trong chat.
3. Để **GEMINI_MODEL** trống để dùng `gemini-flash-lite-latest`, đã xác minh hoạt động trên Render. Alias này theo bản Flash Lite hiện hành của Google. Nếu Google báo model mặc định không còn khả dụng (404), server kiểm tra danh sách model và ưu tiên Flash Lite bản ổn định còn hỗ trợ tạo nội dung. Không chọn Pro/image/audio và không đổi model khi lỗi quyền hoặc quota. Có thể đặt **GEMINI_MODEL** để cố định model được tài khoản hỗ trợ. Local dùng các biến tương tự trong `.env`.
4. `/healthz` có `aiConfigured`, `/api/context/status` có `configured`; chúng xác nhận đã cấu hình key, không kiểm tra key/quota. Mở trang, tra loan, mở Explore more → AI contexts, chọn nghĩa và bấm Generate context để kiểm tra thực tế.

Gemini chỉ được gọi khi bấm tạo. Các yêu cầu trùng được dùng chung; kết quả cache theo từ, nghĩa, ngôn ngữ trong 24 giờ, tối đa 200 mục trên mỗi tiến trình. Restart Render sẽ mất cache trên server. Giới hạn production: 6 yêu cầu tạo mỗi phút/IP, tối đa 1400 token đầu ra/yêu cầu, không tự retry khi quota báo lỗi. Free tier/hạn mức phụ thuộc tài khoản, model và chính sách Google; kiểm tra trong AI Studio. Chưa có key thì giao diện ghi rõ AI chưa bật; key/quota không hợp lệ thì báo lỗi và không hiển thị bài học giả.

Cloud có allowlist cần thêm `generativelanguage.googleapis.com` khi kiểm tra Gemini thật. Tham khảo SDK: https://github.com/googleapis/js-genai.

## Loading, tốc độ AI và các mục mở rộng

Yêu cầu Gemini được rút gọn: đúng 4 lượt hội thoại ngắn, một câu tình huống, ghi chú sử dụng ngắn và prompt video 45–65 từ. Vẫn giữ nghĩa từ được chọn, bản dịch từng phần và các nút loa. Đầu ra ngắn giúp giảm thời gian tạo; không tự tạo trước khi người dùng bấm để tránh thêm lượt gọi. Mục tiêu dưới 5 giây phụ thuộc mạng, Gemini và việc Render free vừa khởi động lại.

Trình duyệt lưu tối đa 20 bài AI thành công trong 24 giờ dưới `helen-ai-contexts`. Bài đã lưu được hiển thị ngay sau reload mà không gọi Gemini; cache phân biệt từ, từ loại, **định nghĩa** và ngôn ngữ dịch. Bài lỗi, đang tạo, hết hạn hoặc dữ liệu lưu hỏng không được dùng. Cache chỉ ở trình duyệt này, không đồng bộ sang thiết bị khác; vẫn xem lại bài đã lưu khi dịch vụ AI chưa được bật.

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

Website có manifest, biểu tượng và service worker để cài dạng PWA; dùng HTTPS của Render. Không cần chạy terminal trên điện thoại.

- Android: mở https://helen-dictionary.onrender.com/ bằng Chrome → **Install app**, hoặc menu ⋮ → **Cài đặt ứng dụng / Thêm vào màn hình chính**.
- iPhone/iPad: mở link trong Safari → **Chia sẻ → Thêm vào Màn hình chính → Thêm**. Bật Open as Web App nếu có. Nút Install app trên trang cũng hiện hướng dẫn này.
- Sau mỗi bản deploy, ứng dụng đã cài hiện **Update app** khi bản mới tải xong. Bấm để tải lại; từ yêu thích, lịch sử và tùy chọn vẫn giữ. Có thể mất một lần mở lại để trình duyệt phát hiện bản cập nhật.

Giao diện nhỏ có ô chọn ngôn ngữ/voice vừa màn hình, thanh tìm kiếm giữ đủ chỗ gõ, vùng chạm tối thiểu 44 px và không tràn ngang ở 320–430 px. Ảnh hiển thị dùng WebP đã xuất nhỏ trong **public/assets/mobile** (tổng khoảng 330 KB thay vì hơn 7 MB), giữ ảnh gốc trong repository. Đổi ảnh hiển thị: IMAGE 1/2 trong CSS index.html; ảnh chính trong IMAGES.hero; ảnh chó trong public/assets/appearance.json. Có thể trỏ về ảnh gốc hoặc ảnh mới tùy ý. Server nén HTML/JSON bằng compression.

Sau khi service worker đã kích hoạt, tối đa 100 phản hồi tra cứu thành công (bao gồm dữ liệu mở rộng) lưu trên thiết bị trong 24 giờ. Tra lại dùng cache ngay và có chú thích dữ liệu đã lưu; khi ngoại tuyến có thể xem cả bản cũ hơn. Không lưu lỗi hoặc tự tạo định nghĩa cho từ chưa tra. 100 bản dịch thành công lưu 24 giờ theo văn bản/ngôn ngữ/ngữ cảnh; 20 bài AI giữ cơ chế cache riêng. Dữ liệu chỉ thuộc trình duyệt/ứng dụng này, không đồng bộ giữa các máy; hệ điều hành có thể xóa cache khi thiếu dung lượng. Vào trang và tra một từ sau khi cài để lưu dữ liệu ngoại tuyến. Giọng đọc, giọng mới và tạo AI mới cần Internet.

Mục tiêu phản hồi dưới 5 giây trên kết nối tốt. Bản dịch dùng tổng thời gian tối đa 6 giây cho các lần thử và giải nghĩa dự phòng. Các nguồn từ điển ngoài có giới hạn 5 giây và không còn lượt chờ lại 15 giây khi tất cả nguồn lỗi. Frontend dừng lượt chờ API sau 7,5 giây (cả tải nội dung/audio), dọn loading và cho thử lại; đây là giới hạn chờ, không phải bảo đảm thành công dưới 8 giây. Gemini có thể hoàn tất trên server sau khi client dừng; thử lại cùng nghĩa có thể nhận cache mà không tạo thêm. Render free có thể ngủ và khởi động lại lâu hơn 8 giây: app shell và dữ liệu đã lưu vẫn mở nhanh, nhưng từ/voice/AI mới cần server thức. Muốn bảo đảm server luôn sẵn sàng cần hosting không ngủ; cấu hình hiện tại tiếp tục dùng free, không đổi sang gói trả phí.
