# Practical AI: chấm phiên và hạn mức

Ngày kiểm tra: 18/10/2026. Mục tiêu là dùng ổn định với cấu hình hiện tại; không tự bật dịch vụ trả phí.

## Nguyên nhân đã xác minh

- Render đã trả `USAGE_LIMIT` cho stage `assess`. Thông báo cũ gọi mọi trường hợp là hết lượt đánh giá cá nhân, dù hạn mức chung hoặc mạng cũng có thể là nguyên nhân.
- Một phiên mẫu mới trên Render vượt qua quota nhưng Gemini trả HTTP 404. Catalogue được tải thành công; code cũ vẫn giữ model mặc định không khả dụng, và có thể chọn lại chính model vừa trả 404. Giao diện gọi đây là lỗi kết nối chung.
- Mỗi lần chuyển model trước đây trừ thêm một lượt chấm cá nhân; các lần không tạo được báo cáo cũng giữ khoản trừ đó.
- Không có quyền truy vấn TiDB của người dùng trong workspace này, nên chưa thể xác định bucket cụ thể đã chặn thiết bị của họ trước bản sửa. Không kết luận người dùng đã dùng 10 lượt.

## Hành vi mới

Catalogue chọn một Flash Lite khả dụng khi mặc định vắng mặt. Khi generation trả 404, loại model đó khỏi lựa chọn của tiến trình và thử tối đa một model khả dụng khác. Không chuyển model/key để né quota 429; model đặt rõ trong Environment vẫn được tôn trọng và báo lỗi cấu hình nếu không dùng được.

Lượt cá nhân giữ chỗ một lần cho một yêu cầu chấm. Chỉ giữ khoản trừ khi có báo cáo hợp lệ; lỗi model, provider, timeout hoặc báo cáo sai cấu trúc sẽ hoàn phần cá nhân. Lượt gọi chung và hạn mức chống spam theo mạng vẫn tính mọi generation attempt. Không hoàn chúng, không reset bảng quota và không tăng trần chi phí 600 generation/ngày mặc định.

Bucket cá nhân mới `practical-report-device` không nhập số lần lỗi từ bucket cũ `practical-assess-device`. Giới hạn mặc định vẫn là 10 báo cáo/thiết bị/ngày. Cả hai dùng bảng `helen_usage_budget` hiện có, không cần SQL hay migration thủ công. Hoàn lượt bằng update gắn với ngày/thiết bị ban đầu; không tự thử lại khi chưa biết update đã commit hay chưa. Nếu database không xác nhận được quota, vẫn chặn generation.

Yêu cầu chấm lại cùng nội dung, thiết bị và ngôn ngữ dùng báo cáo thành công đang giữ trong cache tiến trình 5 phút, kể cả request ID mới. Cache này không phải kho hội thoại vĩnh viễn; báo cáo vẫn được lưu riêng trên thiết bị như trước.

Lỗi hạn mức có `scope` (`device`, `network`, `shared`) và `resetAt` do server tính. Mốc ngày là 00:00 UTC / 07:00 Việt Nam: nếu hết hạn mức lúc 10:18 ngày 18/10 thì mốc tiếp theo là 07:00 ngày 19/10, không phải 07:00 đã qua. Không gán giờ này cho quota Google, vốn có quy tắc riêng.

Các thông báo API thông dụng có bản dịch tĩnh cho 7 ngôn ngữ, phân biệt giới hạn theo phút, quota nhà cung cấp, model, quyền key, quá tải, timeout, bộ quota/database và nội dung không hợp lệ. Không đưa chi tiết provider, key hay địa chỉ database vào thông báo. Lỗi vẫn giữ hội thoại và cho thử lại; không tự tạo band từ text khi thiếu bằng chứng âm thanh.

## Lựa chọn API

| Phương án | Phù hợp | Yêu cầu |
| --- | --- | --- |
| Gemini API qua Google AI Studio, model Flash/Lite đang khả dụng | Tiếp tục đối thoại, sửa ngữ pháp/từ vựng, báo cáo luyện tập với chi phí thấp | API key và quota của Google Cloud project; kiểm tra Rate limits/Billing trong chính project |
| Azure AI Speech Pronunciation Assessment | Bổ sung đánh giá phát âm/độ trôi chảy từ âm thanh | Speech resource và subscription key Azure riêng; cần đối chiếu free tier/giá trước khi bật |
| Model hội thoại khác qua Azure AI Foundry | Dự phòng nhà cung cấp cho phản hồi văn bản | Deployment, key/quyền và ngân sách riêng; chưa tích hợp/bật tính phí trong đợt này |

Microsoft 365 không tự cấp quota Gemini hoặc key Google AI Studio. Quyền dùng Copilot trong Microsoft 365 cũng không thay thế subscription key của Azure Speech. Tên gói Google AI Pro/Ultra và quyền lợi API/credit cần kiểm tra riêng; không suy ra từ việc chat Gemini dùng được. Tạo key khác trong cùng project không phải cách sửa việc project hết quota.

Nguồn chính thức để đối chiếu:

- [Google Gemini cookbook: API key và AI Studio](https://github.com/google-gemini/cookbook#prerequisites) — đã đọc README chính thức.
- [Gemini API rate limits](https://ai.google.dev/gemini-api/docs/rate-limits), [billing](https://ai.google.dev/gemini-api/docs/billing) — kiểm tra số hạn mức hiện hành trong AI Studio; không coi một con số free tier là cam kết cố định.
- [Microsoft Speech SDK: subscription keys riêng](https://github.com/Azure-Samples/cognitive-services-speech-sdk#getting-started) — đã đọc README chính thức.
- [Azure Pronunciation Assessment](https://learn.microsoft.com/azure/ai-services/speech-service/how-to-pronunciation-assessment), [Speech pricing](https://azure.microsoft.com/pricing/details/cognitive-services/speech-services/) — cần đối chiếu giá/region của tài khoản trước khi bật.

## Xác minh

455 kiểm thử đạt; 3 MySQL integration chưa chạy do workspace thiếu cấu hình database. QA trình duyệt 320/390/1440 px đạt cả 9 loại lỗi, retry, ngoại tuyến và Axe AA light/dark. Quét secret của file tracked/staged đạt.

- `node --test tests/practical-reliability.test.cjs` tái hiện quota shared/device/network, ngày mới, hoàn lượt lỗi, dedup báo cáo, catalogue có model 404, quyền API và thông báo 7 ngôn ngữ.
- `node scripts/qa/practical-assessment.cjs` kiểm tra nút End & see band, 9 loại lỗi, retry ID, giữ hội thoại, báo cáo qua reload ngoại tuyến ở 320/390/1440 px. Có thể bật Axe bằng `HELEN_AXE_PATH`.
- Kiểm tra thật trên Render sau deploy dùng một phiên mẫu gõ chữ; chỉ kiểm chứng ngữ pháp/từ vựng và việc API trả báo cáo, không kiểm chứng chấm phát âm từ micro iPhone.

Sau deploy: mở app, bấm Update app, mở phiên đang giữ và thử End & see band. Không cần gửi key vào chat, đổi key hoặc sửa SQL chỉ để áp dụng bản này. Nếu Google thật sự hết quota thì phải chờ nguồn mở lại hoặc chủ động cấu hình billing/nguồn khác; không có cách hợp lệ để bảo đảm quota miễn phí vô hạn.
