// Short learner glosses, written for Helen Dictionary. Sentences still use the translation service.
// Include multiple common senses so a bare English word is not treated as a Vietnamese name.
const glosses = {
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
module.exports={vietnameseGloss,usableTranslation};
