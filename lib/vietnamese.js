// Short learner glosses, written for Helen Dictionary. Sentences still use the translation service.
// Include multiple common senses so a bare English word is not treated as a Vietnamese name.
const glosses = {
  'name after':'đặt tên theo tên của một người, địa điểm hoặc sự vật khác; đặt tên để tưởng nhớ hoặc tôn vinh',
  'named after':'được đặt tên theo; được đặt tên để tưởng nhớ hoặc tôn vinh',
  'look after':'chăm sóc, trông nom', 'look up':'tra cứu; cải thiện (tình hình)',
  'look up to':'ngưỡng mộ, kính trọng', 'look down on':'coi thường, khinh thường',
  'look forward to':'mong chờ, háo hức đón đợi', 'take after':'giống một người thân về ngoại hình hoặc tính cách',
  'give up':'từ bỏ; bỏ cuộc', 'put off':'hoãn lại; khiến mất hứng',
  'put up with':'chịu đựng, chấp nhận điều khó chịu', 'carry out':'thực hiện, tiến hành',
  'turn down':'từ chối; giảm âm lượng hoặc mức độ', 'turn up':'xuất hiện; tăng âm lượng hoặc mức độ',
  'run out of':'hết, dùng hết', 'come across':'tình cờ gặp hoặc tìm thấy; tạo ấn tượng',
  'get along with':'hòa thuận, có quan hệ tốt với', 'break down':'hỏng; suy sụp; chia nhỏ để phân tích',
  'break up':'chia tay; giải tán; chia nhỏ', 'bring up':'nuôi dưỡng; đề cập đến',
  'find out':'tìm ra, phát hiện', 'figure out':'hiểu ra; tìm ra cách giải quyết',
  'make up':'bịa ra; làm hòa; tạo thành; trang điểm', 'set up':'thiết lập, thành lập; sắp xếp',
  'take off':'cất cánh; cởi bỏ; phát triển nhanh', 'take care of':'chăm sóc; xử lý, lo liệu',
  'in spite of':'mặc dù, bất chấp', 'on behalf of':'thay mặt cho; vì lợi ích của',
  'by and large':'nhìn chung, nói chung', 'a piece of cake':'rất dễ, dễ như trở bàn tay',
  'once in a blue moon':'rất hiếm khi', 'under the weather':'cảm thấy không khỏe',
  intermediate:'trung gian; trung cấp; chất trung gian (hóa học); làm trung gian, hòa giải',
  loan:'khoản vay; cho vay, cho mượn; từ vay mượn',
  ban:'lệnh cấm; cấm, ngăn cấm',
  can:'có thể, có khả năng; lon, hộp kim loại',
  may:'có thể; được phép; tháng Năm (May)',
  do:'làm, thực hiện', to:'đến, tới; để; dấu hiệu trước động từ nguyên mẫu',
  an:'một (mạo từ đứng trước âm nguyên âm)', a:'một (mạo từ)',
  in:'trong, ở trong', on:'trên; đang bật; vào (ngày)',
  no:'không; không có', so:'vì vậy; như vậy; rất, đến mức',
  me:'tôi, mình (dạng tân ngữ)', go:'đi; diễn ra, vận hành',
  song:'bài hát', son:'con trai', chin:'cằm', long:'dài; lâu; mong mỏi',
  man:'người đàn ông; con người', men:'những người đàn ông',
  tan:'màu nâu vàng; làm da rám nắng, rám nắng', fan:'cái quạt; người hâm mộ',
  bank:'ngân hàng; bờ sông', mine:'của tôi; mỏ; quả mìn',
  rose:'hoa hồng; dạng quá khứ của rise (đã tăng, đã mọc)',
  name:'tên; đặt tên, gọi tên', tin:'thiếc; hộp kim loại',
  ham:'thịt giăm bông', dam:'đập nước; ngăn dòng nước',
  ram:'cừu đực; đâm mạnh', mom:'mẹ', dad:'bố, ba, cha',
  sun:'mặt trời', ten:'mười', den:'hang, ổ; phòng riêng',
  ran:'dạng quá khứ của run (đã chạy)', ton:'tấn',
  gun:'súng', van:'xe tải nhỏ, xe chở hàng', bin:'thùng đựng, thùng rác',
  pan:'chảo', pin:'ghim, đinh ghim; ghim lại',
  win:'thắng, giành chiến thắng', got:'dạng quá khứ của get (đã nhận, đã có)',
  hot:'nóng; cay; đang được chú ý', not:'không (từ phủ định)',
  fat:'mỡ, chất béo; béo', date:'ngày tháng; cuộc hẹn; quả chà là',
  use:'sử dụng; cách dùng, công dụng', but:'nhưng; ngoại trừ'
};
const shared = new Set(['internet','email','video','radio','taxi','robot','laser','radar','virus','wifi','wi-fi','karaoke','piano','jazz','rock','golf','tennis']);
const normalized = value => String(value).normalize('NFKC').trim().toLowerCase().replace(/[.!?]+$/,'').trim();
function vietnameseGloss(word) { const key=normalized(word);return Object.hasOwn(glosses,key)?glosses[key]:null; }
function usableTranslation(text, translated, from, to) {
  if(typeof translated!=='string' || !translated.trim()) return false;
  if(from==='en' && to==='vi' && normalized(text)===normalized(translated) && !shared.has(normalized(text))) return false;
  return true;
}
module.exports={vietnameseGloss,usableTranslation,glosses};
