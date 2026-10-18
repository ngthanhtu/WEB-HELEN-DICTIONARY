# Hủy lượt nói và báo cáo bốn tiêu chí

## Các lỗi đã sửa

Xóa chữ trước đây vẫn để lại object bản nháp và receipt ghi âm, làm End & see band tiếp tục yêu cầu gửi/xóa. Nút Discard reply (Hủy lượt nói trên giao diện tiếng Việt) giờ hủy riêng lượt chưa gửi: dừng micro, hủy nhận diện/yêu cầu đang chờ, xóa chữ, bản thu thử lại và bản nháp trên thiết bị. Hội thoại đã gửi và báo cáo không bị xóa. Xóa hết chữ trong bản nháp đang chỉnh cũng làm sạch trạng thái này. Các callback đến muộn bị loại trước khi được phép phục hồi nội dung. Cancel vẫn giữ câu nháp để người dùng thử lại; New session vẫn là thao tác bắt đầu hội thoại khác.

Hủy/xóa bản nháp không được thay đổi request ID của lần chấm đang thử lại. Kiểm thử trình duyệt kiểm tra cả lỗi tích hợp này để tránh trừ lượt chấm không cần thiết.

AI trước đây phải chép lại từng ký tự của câu trích dẫn. Chỉ khác dấu câu, dấu nháy hoặc chữ hoa cũng có thể làm server từ chối toàn bộ báo cáo. Giờ server tạo các đoạn dẫn chứng có ID từ **lời gốc**; AI chọn ID, server trả lại nguyên đoạn gốc. Output cũ có quote vẫn được đối chiếu theo từ đầy đủ, dung sai về dấu câu/chữ hoa/khoảng trắng, giữ nguyên chữ và số liệu. Không chấp nhận diễn giải khác nghĩa, đổi từ, mảnh của một từ hay ID không có thật.

Một tiêu chí không đủ dẫn chứng được để trống điểm và giải thích rõ; các tiêu chí hợp lệ còn lại vẫn hiện. Nếu cả hai tiêu chí ngôn ngữ đều không có dẫn chứng hợp lệ, server vẫn từ chối báo cáo. Summary và bước luyện của báo cáo một phần dùng lời trung tính do server tạo để không nhắc lại nhận định đã bị loại.

## Bốn tiêu chí IELTS

Mỗi thẻ có tên, mô tả, band khi đủ dữ liệu, nhận xét và đoạn dẫn chứng gốc khi có:

1. Fluency and coherence — độ trôi chảy, phát triển và liên kết ý.
2. Lexical resource — từ vựng chính xác, diễn đạt linh hoạt, collocations tự nhiên.
3. Grammatical range and accuracy — cấu trúc đa dạng và độ chính xác.
4. Pronunciation — mức dễ hiểu, âm, trọng âm và nhịp điệu.

Mỗi tiêu chí đóng góp 25% khi có đủ dữ liệu để tính tổng. Ngữ pháp/từ vựng có thể đánh giá từ câu đã gõ hoặc xác nhận. Tiêu chí âm thanh cần receipt có chữ ký và ít nhất 30 giây chứa quan sát hợp lệ cho cả fluency/pronunciation; không gộp 8 giây hợp lệ với 25 giây thiếu quan sát để vượt ngưỡng. Duration phải dương và không quá 180 giây mỗi lượt. Band tổng cần mọi lượt đều có bằng chứng âm thanh hợp lệ. Không tự suy ra phát âm từ văn bản hoặc câu đã được sửa.

Đây là **ước lượng luyện tập bằng AI**, không phải điểm IELTS chính thức hay đánh giá được hiệu chuẩn với giám khảo. Thay đổi là prompt/schema/kiểm tra dẫn chứng, không phải huấn luyện hoặc fine-tune một model. ID đúng xác minh nguồn trích dẫn; nó không tự chứng minh mọi nhận xét hoặc band của model đều chính xác về ngữ nghĩa.

## Giữ dữ liệu và giao diện

Luôn hiển thị bốn thẻ; phân biệt thiếu âm thanh và thiếu dẫn chứng. Tên, mô tả, thông báo hủy và tiêu chí chưa chấm có bản dịch tĩnh theo bảy ngôn ngữ giao diện. Câu nói gốc không bị dịch lại bởi UI.

Báo cáo cũ hợp lệ vẫn mở lại qua reload/ngoại tuyến. Báo cáo hỏng hoặc sai cấu trúc không được làm ứng dụng crash: chỉ bỏ phần báo cáo đó, giữ nguyên các lượt đã gửi để có thể chấm lại. Không thêm dependency của ứng dụng, API key, bảng SQL hoặc migration.

## Kiểm tra và nguồn tham khảo

467 kiểm thử đạt, 3 MySQL integration local chưa chạy do thiếu cấu hình. Browser QA có fixtures ở 390/1440 px kiểm tra hủy khi thu/chép lời/đợi AI, xóa nháp rồi chấm, callback muộn, hội thoại/báo cáo qua reload. QA báo cáo ở 320/390/1440 px kiểm tra chín lỗi API, retry ID, bốn thẻ và đọc ngoại tuyến. Axe AA light/dark không có vi phạm. Browser audio là mô phỏng; không coi đây là kiểm tra micro iPhone vật lý.

[Khung IELTS Speaking chính thức](https://ielts.org/cdn/ielts-guides/ielts-speaking-band-descriptors.pdf) đã được đối chiếu trong [tài liệu speaking-flow của dự án](speaking-flow-2026-10-12.md). Yêu cầu truy cập `https://luyennoi.com/` qua proxy của môi trường trả CONNECT 403; không đọc được giao diện hiện tại, không sao chép dữ liệu, tài sản hoặc khẳng định đã tham khảo thiết kế trực tiếp của trang này.

Sau deploy: mở web/app, bấm Update app. Bấm Hủy lượt nói để bỏ lượt hiện tại, rồi End & see band để chấm các lượt đã gửi. Không cần đổi key, chạy terminal hay chỉnh SQL.
