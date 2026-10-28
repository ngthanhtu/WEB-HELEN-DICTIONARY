# Ngôn ngữ dịch của Topics

## Nguyên nhân và hành vi mới

Các bản dịch tiếng Việt của 4.000 mục từ vẫn có đầy đủ. Ví dụ `responsible travel` có nghĩa tiếng Anh `Travelling with consideration for people and the environment.` và nghĩa Việt `Việc du lịch có ý thức với con người và môi trường.` Lỗi trong ảnh xảy ra khi Topics lấy `#target=en` của Dictionary, thường sau khi đảo chiều Việt → Anh; nhánh Anh → Anh trả lại chính định nghĩa và hiển thị như bản dịch.

Topics giờ có ô **Meanings in / Dịch nghĩa sang**, kèm cờ của bảy ngôn ngữ. Lựa chọn lưu ở `helen-topic-target-v1`, dùng cho cả nút mắt và phản hồi quiz của nhóm từ. Đảo chiều Dictionary không đổi lựa chọn này; chọn ngôn ngữ trong Topics cũng không đổi cặp tra từ của Dictionary. Một lựa chọn trực tiếp từ Preferences vẫn áp dụng cho Topics như trước.

Lần đầu dùng: giữ ngôn ngữ Topics đã lưu nếu hợp lệ; nếu chưa có, dùng ngôn ngữ đích hiện tại khi khác tiếng Anh, rồi ngôn ngữ thiết bị được hỗ trợ. Nếu các lựa chọn đó là tiếng Anh thì mặc định tiếng Việt cho bộ học tiếng Anh. Người dùng vẫn có thể chủ động chọn English; lúc đó nút mắt giải thích định nghĩa vốn đã là tiếng Anh, thay vì lặp nguyên câu như bản dịch.

Nghĩa Việt có sẵn mở ngay trên thiết bị, không gọi dịch vụ dịch. Các ngôn ngữ khác tiếp tục dùng cùng cache có khóa gồm nội dung, ngôn ngữ nguồn, ngôn ngữ đích và mục đích dịch. Warmup của Topics/quiz dùng đúng ngôn ngữ riêng, vẫn chia sẻ request đang chạy và bản dịch đã lưu. Thay ngôn ngữ làm mới các thẻ; phản hồi cũ đến muộn không được ghi đè lựa chọn mới. Nếu dịch lỗi, bấm mắt một lần để thử lại, không cần đóng rồi mở lại và không có vòng tự gọi AI không giới hạn.

Không đổi dữ liệu từ, lịch ôn, key API, schema TiDB hoặc trần quota. Bộ chủ đề đã tải và các nghĩa Việt tiếp tục dùng ngoại tuyến. Bản dịch ngôn ngữ khác đã có trong cache vẫn mở lại sau reload; ngôn ngữ chưa tải cần mạng.

## Xác minh

- 469 kiểm thử đạt; 3 MySQL integration local chưa chạy do thiếu cấu hình.
- Kiểm tra dữ liệu/dịch cục bộ cho cả 4.000 mục từ và ví dụ Việt: không gọi provider.
- Fixture kiểm tra 42 hướng dịch khác ngôn ngữ và 7 trường hợp cùng ngôn ngữ, khóa cache và regional aliases.
- Browser QA ở 390/1440 px tái hiện Dictionary Việt → Anh nhưng Topics vẫn dịch Việt; kiểm tra đủ bảy lựa chọn, năm đích ngoài Việt/Anh, phản hồi đến muộn, lỗi/thử lại một lần bấm, quiz, giữ lựa chọn qua reload, đảo chiều Dictionary, ngoại tuyến và Axe AA light/dark.
- QA ngôn ngữ hiện có kiểm tra tám locale thiết bị, hai chiều Pháp → Nhật → Pháp, không tràn các trang và ngôn ngữ đích được giữ khi ngoại tuyến.
- API thật trên Render được kiểm tra bằng định nghĩa mẫu trên theo Anh → sáu ngôn ngữ còn lại và các bản dịch đó → Anh. Một lượt đọc cache ban đầu chậm và một lượt provider quá thời gian đã báo lỗi rõ; các lượt kiểm tra lại thành công. Đây là kiểm tra mẫu, không phải cam kết mọi bản dịch đều đúng tuyệt đối hay API luôn đáp ứng dưới một giây.

Sau deploy, mở web/app và chọn **Update app**. Vào Topics, kiểm tra ô **Dịch nghĩa sang** rồi bấm mắt. Không cần xóa dữ liệu app, đổi key hoặc sửa SQL.
