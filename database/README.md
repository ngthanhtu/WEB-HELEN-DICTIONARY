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
