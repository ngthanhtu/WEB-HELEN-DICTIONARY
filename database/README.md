# Kết nối database online và quản lý bằng DBeaver

Code hỗ trợ MySQL 8+ và TiDB tương thích giao thức MySQL. Server tự tạo năm bảng `helen_*` khi kết nối thành công, không xóa bảng cũ. Chưa cấu hình database thì website tiếp tục hoạt động với cache RAM và lịch sử trên thiết bị. Có code kết nối chưa có nghĩa là Render đã có database.

## Phương án tiết kiệm: TiDB Cloud Starter

TiDB là database tương thích MySQL, không phải máy chủ Oracle MySQL. MySQL 8 vẫn dùng được nếu bạn có dịch vụ MySQL riêng. Đề xuất Starter vì có hạn mức miễn phí; Render Web Service free hiện tại giữ nguyên. DBeaver Community là phần mềm quản lý trên máy tính, không thay thế dịch vụ database online.

Theo [tài liệu chính thức về hạn mức Starter](https://docs.pingcap.com/tidbcloud/manage-serverless-spend-limit/), mỗi instance đủ điều kiện có 5 GiB lưu trữ hàng, 5 GiB lưu trữ cột và 50 triệu RU/tháng. **Spending limit = 0** giữ instance miễn phí; hết hạn mức có thể chặn kết nối mới hoặc làm chậm truy vấn. Xác nhận hạn mức trên màn hình tạo dịch vụ vì chính sách có thể cập nhật. Không cần tăng Spending limit để bắt đầu.

1. Vào https://tidbcloud.com/signup, đăng ký bằng GitHub/Google hoặc email.
2. **My TiDB → Create Resource → Starter**. Đặt tên `helen-dictionary-db`, chọn vùng gần dịch vụ Render, đặt **Spending limit = 0**, rồi **Create**. Nếu Starter hiển thị điều kiện khác, kiểm tra giá trước khi tạo; không chọn Essential cho cấu hình này.
3. Mở instance → **Connect → Public → main**. **Generate Password** nếu chưa có mật khẩu. Lưu riêng Host, Port, Username đầy đủ có tiền tố instance, Password. Đây là mật khẩu database, không phải key ElevenLabs/Gemini.
4. Mở **SQL Editor** của TiDB (hoặc DBeaver ở bước dưới), chạy:

   ```sql
   CREATE DATABASE IF NOT EXISTS helen_dictionary
     CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
   ```

5. Trong TiDB **Settings → Networking**, thêm IP máy tính nếu dùng DBeaver và các dải IP outbound của dịch vụ Render. Render hiển thị các địa chỉ này trong phần **Outbound** của dịch vụ; dùng dải của chính dịch vụ đang chạy. Xem [hướng dẫn firewall của TiDB](https://docs.pingcap.com/tidbcloud/configure-serverless-firewall-rules-for-public-endpoints/).
6. Render → `helen-dictionary` → **Environment**, thêm:

   | Tên biến | Giá trị |
   | --- | --- |
   | `MYSQL_HOST` | Host trong Connect, không có `https://` |
   | `MYSQL_PORT` | Port trong Connect; thường `4000` với TiDB |
   | `MYSQL_DATABASE` | `helen_dictionary` |
   | `MYSQL_USER` | Username đầy đủ trong Connect, gồm tiền tố instance |
   | `MYSQL_PASSWORD` | Mật khẩu database trong ô Value bảo mật |
   | `MYSQL_SSL` | `true` |

   Không gửi mật khẩu vào chat, không commit `.env`. Key giọng đọc và Gemini giữ trong các biến riêng đang dùng. Server xác minh CA và tên máy chủ TLS; `MYSQL_SSL_CA`/`MYSQL_SSL_CA_FILE` chỉ cần nếu nhà cung cấp yêu cầu CA riêng. TiDB dùng CA công khai nên thường để trống. Có thể dùng `DATABASE_URL` thay các biến kết nối; ký tự đặc biệt trong username/password phải được URL encode và không đồng thời đặt các biến MYSQL_* cũ.
7. **Save, rebuild, and deploy**. Mở https://helen-dictionary.onrender.com/healthz: cần thấy `database.configured: true` và **`database.connected: true`**. Tra một từ, mở Lịch sử tra cứu: thông báo **Đã lưu lịch sử vào database cho thiết bị này.**

## Kết nối bằng DBeaver

1. Tải **DBeaver Community** từ https://dbeaver.io/download/.
2. **Database → New Database Connection → MySQL**, cho phép tải driver nếu được hỏi.
3. Nhập cùng Host, Port, Database `helen_dictionary`, Username và Password ở trên; không bỏ tiền tố Username.
4. Trong **SSL**, bật Use SSL và xác minh chứng chỉ/tên máy chủ (`VERIFY_IDENTITY` nếu driver cung cấp). Dùng CA nhà cung cấp hướng dẫn hoặc trust store hệ thống; không bật bỏ qua chứng chỉ.
5. **Test Connection → Finish**. Mở `helen_dictionary → Tables`; Refresh sau khi server khởi động.

| Bảng | Dữ liệu |
| --- | --- |
| `helen_vocabulary` | Từ đã tra, định nghĩa, quan hệ theo nghĩa, phiên bản dữ liệu |
| `helen_cache` | Kết quả từ điển, bản dịch, bài AI và âm thanh ngắn thành công |
| `helen_history` | Từ đã tra theo trình duyệt/app, lần gần nhất, số lần tra |
| `helen_history_events` | ID sự kiện để gửi lại không tạo lượt trùng |
| `helen_devices` | Mã thiết bị đã băm để tách lịch sử và điều phối đồng bộ |
| `helen_usage_budget` | Ledger giới hạn API theo ngày/thiết bị/mạng; đơn vị tùy bucket |
| `helen_tts_usage` | Một hàng tổng TTS: ký tự ngày/tháng và counters thiết bị/mạng |
| `helen_metrics_daily` | Số lượt sự kiện theo ngày khi người dùng đồng ý thống kê |
| `helen_metric_events` | ID chống đếm trùng sự kiện thống kê |

Nguồn schema duy nhất: [schema.sql](schema.sql). Bộ lệnh [inspect.sql](inspect.sql) chỉ đọc giúp xem số bản ghi, cache namespace, từ đã lưu, lịch sử và quota. Chạy từng câu để xem đúng tab kết quả. `npm run db:migrate` lấy danh sách tên bảng trực tiếp từ schema, tránh thông báo thiếu các bảng quota/thống kê.

## Quy ước bảng, khóa và thời gian

Tên bảng/cột dùng `helen_` + `snake_case`; không cần đổi tên các bảng production đã có. Toàn bộ timestamp runtime là UTC; Việt Nam là UTC+07:00. `fresh_until` là hạn làm mới cache, không phải hạn xóa dữ liệu.

| Bảng | Khóa chính / chỉ mục | Cách hiểu và vòng đời |
| --- | --- | --- |
| `helen_devices` | `device_hash` | Hash thiết bị, không phải tài khoản đăng nhập, email hay profile |
| `helen_cache` | `(namespace, cache_key)` | Một kết quả chia sẻ theo namespace và hash key; cache cũ vẫn có thể dùng khi nguồn lỗi |
| `helen_vocabulary` | `word` | Mỗi từ/cụm một payload và revision hiện tại; không phải mọi sự kiện search |
| `helen_history` | `(device_hash, word)`; `recent_history(device_hash, last_seen)` | Mỗi từ khác nhau của mỗi thiết bị một hàng; `search_count` là số lượt đã đồng bộ |
| `helen_history_events` | `(device_hash, event_id)` | Receipt chống lặp, không dùng để hiển thị danh sách từ |
| `helen_usage_budget` | `(bucket, key_hash)`; `expired_budget(expires_at)` | Dòng quota hết hạn được dọn theo đợt; không cộng các bucket chồng global/device/network |
| `helen_tts_usage` | `id` | Reservation TTS nguyên tử, không chứa audio hoặc key |
| `helen_metrics_daily` | `(event_day, event_name)` | Counts tổng, dọn sau 90 ngày; không chứa từ người dùng đã tra |
| `helen_metric_events` | `event_id`; `expired_metric(created_at)` | Chống đếm trùng analytics, dọn sau 30 ngày |

Hạn mức ngày reset lúc 00:00 UTC, tức 07:00 Việt Nam; quota của nhà cung cấp có lịch reset riêng. `practical-day` tính attempt chung, `practical-report-device` tính report thành công của thiết bị, còn bucket IP giới hạn attempt theo mạng. Một lỗi report có thể hoàn slot cá nhân nhưng không hoàn ngân sách attempt chung. TTS tính ký tự; không diễn giải mọi cột `units` thành số lượt.

Favorites, SRS, bộ từ cá nhân, hội thoại và nháp/report IELTS Topics hiện ở localStorage/Cache Storage trên máy, không nằm trong các bảng trên. Vì vậy `helen_vocabulary` hoặc cache rỗng không tự chứng minh bài luyện/favorites bị mất. Report IELTS không được công khai trong cache database chia sẻ; bản ghi microphone không được lưu vào database Helen. Chưa có đăng nhập/sync nháp đa thiết bị.

## Quyền runtime và thay đổi schema

Đây là MySQL/TiDB, không phải Supabase nên không có RLS kiểu Supabase. Backend giới hạn lịch sử bằng hash cookie thiết bị, bind tham số SQL, kiểm tra origin và giữ TLS. SQL Editor/DBeaver với quyền quản trị có thể thấy dữ liệu nhiều thiết bị; giao diện ẩn một cột không phải là phân quyền database.

Tạo bảng bằng danh tính provisioning. Sau đó có thể dùng [runtime-user.example.sql](runtime-user.example.sql), cấu hình `DATABASE_AUTO_MIGRATE=false`, giữ runtime ở quyền SELECT/INSERT/UPDATE/DELETE. Không cấp `ALL`/`GRANT OPTION` cho app. Không tự chạy lệnh DROP, TRUNCATE hay rename bảng khi dọn mã nguồn. Đợt IELTS/cleanup này chỉ bổ sung tài liệu và comment SQL, không thay cấu trúc hay dữ liệu production.

Ví dụ xem dữ liệu:

```sql
SELECT word, revision, updated_at, payload
FROM helen_vocabulary ORDER BY updated_at DESC LIMIT 30;

SELECT word, last_seen, search_count
FROM helen_history ORDER BY last_seen DESC LIMIT 30;

SELECT namespace, COUNT(*) AS items
FROM helen_cache GROUP BY namespace;
```

Cache không bị xóa khi hết hạn làm mới hoặc Render restart. Từ điển thường làm mới sau 24 giờ; nguồn phụ bị lỗi dùng hạn ngắn hơn. Bản từ điển cũ hợp lệ vẫn có thể dùng khi làm mới chậm. Bài AI dùng lại theo đúng từ, nghĩa, ngôn ngữ. Audio thành công tối đa 300 KB được lưu riêng theo tài khoản/giọng/nội dung; audio lớn hơn tiếp tục dùng RAM. Không lưu bản ghi micro, API key, danh sách quyền giọng hoặc lỗi API. Dữ liệu vẫn phụ thuộc dung lượng/vòng đời dịch vụ database; xuất backup bằng DBeaver khi cần.

Lịch sử theo một **trình duyệt/app**, chưa có đăng nhập để đồng bộ giữa thiết bị. UI hiện 40 từ gần nhất; database giữ các từ đã đồng bộ đến khi người dùng xóa lịch sử. Lượt tra ngoại tuyến được xếp hàng, tối đa 200 sự kiện, và gửi khi có mạng; xóa lịch sử xóa cả bản tương ứng trong database khi đồng bộ. Từ yêu thích và dữ liệu PWA ngoại tuyến giữ như trước.

## Kiểm tra sau khi kết nối

1. Tra `drawback`, `bank`, `fast`, `always`, `experiment`; kiểm tra quan hệ ở nghĩa cụ thể và **Explore more → Thesaurus / Related words**.
2. DBeaver: xem `helen_vocabulary`, `helen_cache`, `helen_history` đã có dữ liệu.
3. Render → Restart Service; tra lại cùng từ/bản dịch. Bản trong database vẫn được dùng, không cần tạo lại bài AI hoặc audio đã lưu.
4. Bật chế độ máy bay trên điện thoại, tra một từ đã lưu, rồi bật mạng lại; lịch sử được đồng bộ.
5. Xóa lịch sử và tải lại: danh sách cũ không trở lại; từ yêu thích vẫn còn.

Nếu `connected:false`: kiểm tra host/port, password, username có tiền tố, database đã tạo, IP outbound Render được cho phép, TLS và quyền CREATE/SELECT/INSERT/UPDATE/DELETE. `/healthz` chỉ trả mã lỗi an toàn. Database lỗi không ngăn tra bằng RAM/WordNet và dùng dữ liệu PWA đã lưu.

## Kiểm thử trong môi trường phát triển

`npm run db:migrate` tạo bảng và kiểm tra kết nối. `npm test` chạy kiểm thử ứng dụng; bài test MySQL thực bật bằng `HELEN_MYSQL_TEST=1`, chỉ chạy trên database test với MYSQL_* tương ứng. Đã kiểm thử trên MySQL Community 8.4 thật. Không chạy kiểm thử dữ liệu vào database production.

Nguồn: [Tạo Starter](https://docs.pingcap.com/tidbcloud/create-tidb-cluster-serverless/), [Connect / TLS](https://docs.pingcap.com/tidbcloud/connect-via-standard-connection-serverless/).
