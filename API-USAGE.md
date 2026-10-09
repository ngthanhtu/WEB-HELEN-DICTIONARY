# API, giấy phép và giới hạn vận hành

Đối chiếu nguồn chính thức ngày **9/10/2026**. Helen hiện phục vụ học tập miễn phí, không có quảng cáo/thanh toán. “Free API” không đồng nghĩa không có giấy phép, không giới hạn, hoặc được phép kinh doanh lại dữ liệu. Đây là kết quả đối chiếu kỹ thuật và điều khoản được công bố, không phải xác nhận pháp lý cho mọi mô hình kinh doanh tương lai.

| Nguồn | Điều khoản đã xác minh | Áp dụng cho Helen |
| --- | --- | --- |
| [WordNet 3.0](public/assets/licenses/wordnet.txt) | Cho phép use/copy/modify/distribute “for any purpose and without fee or royalty”, phải giữ copyright + disclaimer trên mọi bản sao. Không dùng tên Princeton để ám chỉ bảo trợ. | Giữ giấy phép nguyên văn trong app/offline shell; Word of the day, starter sets và chuẩn bị quiz dùng dữ liệu này, không gọi AI. npm package `wordnet-db` phiên bản 3.1.14 chứa WordNet release **3.0**, không phải database 3.1. |
| [ElevenLabs publishing](https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform) và [Terms](https://elevenlabs.io/terms-of-use) | Free không có commercial license. Khi chia sẻ âm thanh Free cần “elevenlabs.io” hoặc “11.ai” trong title. Âm thanh tạo trước khi mua gói trả phí không tự có commercial license. Beta có điều khoản riêng. | Nhãn nguồn cạnh bộ chọn giọng, trong trạng thái phát/tooltip và trang nguồn. Khi xuất/chia sẻ âm thanh phải giữ attribution trong title. Không dùng âm thanh Free cho sản phẩm thu tiền/quảng cáo. Không tự đổi voice đã chọn. |
| [Gemini API terms](https://ai.google.dev/gemini-api/terms) | Không quy định gói Free chỉ dành cho phi thương mại như ElevenLabs; dành cho developers xây dựng sản phẩm professional/business. Điều khoản hiện yêu cầu 18+, không tích hợp vào API Clients hướng tới hoặc có khả năng được người dưới 18 truy cập; có giới hạn vùng. Unpaid có thể dùng input/output để phát triển dịch vụ và human review; không gửi dữ liệu nhạy cảm. EEA/Switzerland/UK cần Paid Services. | Không khẳng định đủ điều kiện phục vụ học sinh. Cần xác định độ tuổi/khu vực người dùng và phương án cung cấp AI trước khi mở rộng. Bản ghi micro ngắn được chuyển tiếp, không lưu backend. Bài AI có nhãn AI, cần kiểm tra; không khẳng định AI chính xác mọi từ. |
| [Merriam-Webster homepage](https://www.dictionaryapi.com/) và [Terms](https://www.dictionaryapi.com/info/terms-of-service) | Free: non-commercial; 1.000 queries/day/reference; không quá hai reference works. Có hạn chế automated/recorded queries, phân phối lại/phái sinh và trademarks. Ads/paid fee cần thỏa thuận riêng. | Tùy chọn khi có MW_LEARNERS_KEY; không gọi trong audit toàn bộ WordNet. Giới hạn Helen 950 calls/day trong production khi bật. Không coi quyền dùng API là quyền cache/export/relicense toàn bộ nội dung. Cần chủ tài khoản xác nhận cách dùng/caching cụ thể với nhà cung cấp nếu mở rộng. |
| [Wiktionary copyrights](https://en.wiktionary.org/wiki/Wiktionary:Copyrights) | Original text CC BY-SA 4.0 + GFDL. Attribution, link tới nguồn/tác giả, share-alike cho phần nội dung sửa/phái sinh. Câu trích, ảnh/âm thanh bên thứ ba có thể có điều kiện riêng. | Giữ link mục từ, license và relation-source revision đã có; thêm trang Sources, licenses & privacy. License dữ liệu không tự làm toàn bộ mã Helen thành CC BY-SA. Không lấy nội dung Oxford/Cambridge hoặc gắn nhãn nguồn của họ. |
| [Free Dictionary API](https://dictionaryapi.dev/) | Homepage nói API miễn phí; sample response/homepage không phải cấp phép blanket mọi nội dung. API entries có thể trả `license` và `sourceUrls`. | Giữ metadata này trên senses khi sử dụng nguồn dự phòng. Xem giấy phép từng response; license mã API khác license dữ liệu. Không khẳng định mọi nội dung đều có cùng CC license. |
| [Datamuse](https://www.datamuse.com/api/) | Hiện cho 100.000 requests/day chưa cần key; yêu cầu acknowledge API trong documentation. Khuyến nghị mô tả app customer-facing/traffic qua form của họ. Banner ghi key bắt buộc từ **1/2/2027**, Usage limits vẫn ghi “Until 1/1/2027”; hai mốc không thống nhất. | Đã ghi nguồn. Chủ app nên liên hệ Datamuse để xác nhận chính sách và key trước năm 2027; không tự gửi thông tin thay chủ app. Chưa đoán tên tham số auth khi chưa có tài liệu/key chính thức. |
| [MyMemory limits](https://mymemory.translated.net/doc/usagelimits.php) và [Terms](https://mymemory.translated.net/terms-and-conditions) | Anonymous 5.000 chars/day; valid contact email nâng 50.000 chars/day. API automation đúng mục đích được phép; cấm crawl archive, traffic bất thường, bypass limits, resale dịch vụ nguyên dạng không được phép. | Chỉ dịch nội dung người dùng cần; cache thành công; nghỉ nguồn khi hết quota, Gemini fallback vẫn chịu quota chung. Không đổi IP/email để vượt hạn mức, không dùng API để crawl/dịch toàn bộ kho từ. |
| [Pexels license](https://www.pexels.com/license/) | Free dùng ảnh trên website/app; không bắt buộc attribution, không imply endorsement, không bán ảnh nguyên bản hoặc phân phối lại như stock. | Cần xác nhận file stock thực sự lấy từ Pexels. Quyền sử dụng ảnh cá nhân/chân dung do chủ website cung cấp chưa thể xác minh chỉ từ tên file; cần quyền của người chụp/người trong ảnh. |

## Quota phía server

Production (`NODE_ENV=production`) cần TiDB/MySQL kết nối cho các lời gọi trả phí/AI mới. Nếu ledger chưa sẵn sàng, trả lỗi 503 ngắn thay vì gọi provider không có hạn mức. Tra từ local, ôn tập và audio đã tải không bị chặn. Không có đường tắt bằng tham số client để bỏ kiểm tra.

TTS cần HMAC proof của **đúng nội dung**, hết hạn sau 7 ngày. Proof được cấp cùng `/api/lookup`, `/api/study/prepare`, `/api/collocations`, `/api/context`. `/api/pronunciation` cấp lại cho văn bản đã khớp dữ liệu từ điển thực; không ký arbitrary text. Key HMAC dẫn xuất với domain separation từ key ElevenLabs; không gửi key đó ra client. Đổi key vô hiệu proof cũ; tra lại sẽ lấy proof mới. Chỉ cache audio thành công theo đúng text/voice; các tác vụ trùng dùng chung và chỉ reserve một lần.

Mặc định, các giới hạn sau đã hoạt động trong code, **không cần thêm env để bật**:

| Render Environment (tùy chọn chỉnh) | Mặc định | Ý nghĩa |
| --- | ---: | --- |
| TTS_DAILY_CHARACTER_LIMIT | 2000 | Tổng ký tự mới/ngày UTC cho website |
| TTS_MONTHLY_CHARACTER_LIMIT | 9000 | Tổng ký tự mới/tháng UTC cho website |
| TTS_DEVICE_DAILY_CHARACTER_LIMIT | 750 | Ký tự mới/ngày cho mã thiết bị |
| AI_DAILY_REQUEST_LIMIT | 100 | Tổng calls generateContent, gồm context/translation/micro và retries |
| MW_DAILY_REQUEST_LIMIT | 950 | Tổng queries reference Learner’s nếu có key |

Ledger `helen_usage_budget` reserve atomically trong transaction; dữ liệu giữ qua restart/deploy. Giới hạn tổng bảo vệ trước việc tự đổi device ID. Device ID là mã ngẫu nhiên, không phải account hoặc bằng chứng nhận diện người dùng. Đây là đơn vị **request/character reservation**, không phải số credit hoặc số tiền thực ElevenLabs/Google báo. Provider có thể đổi cách tính, billing cycle khác tháng UTC; việc dùng cùng key ngoài Helen không nằm trong ledger. Failed calls có thể vẫn giữ reservation để không mở đường retry vô hạn. Rate limit theo IP vẫn giữ như trước.

Không quét API từ điển/dịch toàn bộ từ để xác minh “đúng 100%”; việc đó không có bảo đảm ngữ nghĩa, tốn quota và có thể vi phạm hạn chế systematic access của nguồn. Kiểm thử dùng fixture và WordNet local; không gọi TTS/AI thật chỉ để test.

## Analytics tối thiểu

**Mặc định tắt**, bật trong Preferences → Help improve Helen. DNT/GPC không gửi. Chỉ event UUID, ngày, event name; không có word/audio/IP/device ID trong bảng analytics. Lookup đếm một lần cho kết quả chính, không đếm thêm khi enrichment; favorite là lượt thêm từ/bộ từ; quiz_completed là session hoàn tất, không phải session hủy hay review. Các sự kiện quay lại ngày 2/ngày 7 tính từ ngày bắt đầu opt-in trên thiết bị, là số sự kiện, **không phải retention percentage theo cohort**. Tắt xóa queue chưa gửi, không xóa riêng được số đếm đã aggregate không gắn danh tính.

Trong TiDB SQL Editor:

```sql
USE helen_dictionary;
SELECT event_day,event_name,event_count
FROM helen_metrics_daily ORDER BY event_day DESC,event_name LIMIT 100;
SELECT bucket,SUM(units) AS reserved_units
FROM helen_usage_budget WHERE expires_at > UTC_TIMESTAMP(3) GROUP BY bucket;
```

Event IDs giữ 30 ngày, daily aggregates giữ 90 ngày. Dọn từng batch định kỳ khoảng một giờ khi DB được truy cập; server ngủ/không có traffic thì dọn ở lần sẵn sàng sau. Không hứa xóa đúng giây cutoff trên Render Free.

## Học mỗi ngày và sao lưu

- 5/10/20 lượt, mỗi answer hoặc self-rated review tính một lượt. Wrong answers vẫn là practice; mở card/tra từ không tự tính. Streak cần đạt goal, hôm nay chưa xong vẫn giữ streak từ hôm qua; qua một ngày bỏ học thì đứt. Dùng ngày local và calendar arithmetic, không cộng 24h qua DST. Goal đã bắt đầu hôm nay giữ nguyên khi đổi goal; goal mới cho ngày sau.
- Word of the day chọn ổn định theo ngày từ pack đã có WordNet + Vietnamese gloss; không gọi paid API. Save word chuẩn bị dữ liệu học offline. Chỉ duy trì badge số due khi trình duyệt hỗ trợ, không hứa push reminder/badge trên mọi iPhone.
- JSON backup gộp 500 favorites, 100 sets, SRS cards, attempts/sessions và habits; không xuất .env/device token/micro/audio. Schedule có lastReviewedAt mới hơn được giữ; import lại không tạo duplicate sets/counters. Không thay cài đặt voice/theme, không đổi lịch SRS từ quiz.
- CSV theo RFC4180, UTF-8 BOM và chặn formula injection. Anki TSV: một card/word, nhiều senses trong Back, HTML escaped. Export dữ liệu học không cấp thêm quyền bản quyền với nội dung nguồn; đọc source license trước khi chia sẻ công khai.

## Còn cần chủ tài khoản thực hiện

1. Thu hồi ElevenLabs key đã lộ, thay key mới trong Render Environment. Việc rewrite Git không thay được bước này.
2. Nhờ GitHub Support purge cached/orphan URLs của `fe26f8b`/file `env`; main sạch nhưng raw URL cũ vẫn trả HTTP 200 khi kiểm tra. Clone/fork người khác nằm ngoài quyền kiểm soát.
3. Xác định tuổi/khu vực người dùng trước khi mở rộng Gemini; điều khoản 18+ không được giải quyết chỉ bằng việc nói app miễn phí.
4. Xác nhận quyền các ảnh cá nhân; làm việc với nguồn optional MW/Datamuse nếu phạm vi sử dụng vượt các điều kiện đã công bố. Không có account/payment/ads triển khai trong đợt này.
