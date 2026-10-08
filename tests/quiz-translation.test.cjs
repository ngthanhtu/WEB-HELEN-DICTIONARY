const {test}=require('node:test'),assert=require('node:assert/strict');
const quiz=require('../public/assets/quiz-translation');
test('quiz translates the whole definition and example after answering, and cloze uses the completed original sentence',async()=>{
  const calls=[],q={type:'cloze',word:'loan',prompt:'The bank approved a ____.',definition:'money that someone borrows',original:'The bank approved a loan.'};
  const rows=await quiz.translate(q,'vi',async(texts,from,to,context)=>{calls.push({texts,from,to,context});return texts.map(text=>text===q.definition?'số tiền một người vay':'Ngân hàng đã phê duyệt một khoản vay.');});
  assert.equal(rows[1].label,'Đề bài (đã điền đáp án)');assert.equal(rows[1].translation,'Ngân hàng đã phê duyệt một khoản vay.');
  assert.deepEqual(calls.map(call=>call.texts),[[q.definition],[q.original]]);assert.deepEqual(calls[0].context,{kind:'definition'});assert.ok(calls.every(call=>call.from==='en' && call.to==='vi'));
  assert.ok(!calls.some(call=>call.texts.includes(q.prompt)));
});
test('long study definitions and sentences are translated in full within the existing API limit',async()=>{
  const text=Array.from({length:90},(_,i)=>`word${i}`).join(' ');assert.ok(text.length>450 && text.length<650);
  let received=[];const rows=await quiz.translate({type:'type',prompt:text},'vi',async parts=>{received=parts;return parts.map(value=>`Dịch ${value}`);});
  assert.ok(received.every(part=>part.length<=450));assert.equal(received.join(' '),text);assert.ok(rows[0].translation.endsWith('word89'));
});
test('a failed example does not discard a successful definition, and retry remains possible',async()=>{
  const q={type:'choice',prompt:'a male sibling',original:'My brother is visiting today.'};let attempts=0;
  const translate=async parts=>{if(parts[0]===q.original && attempts++===0)throw Error('Kết nối chậm. Hãy thử lại.');return parts.map(text=>`vi:${text}`);};
  const first=await quiz.translate(q,'vi',translate);assert.equal(first[0].translation,'vi:a male sibling');assert.match(first[1].error,/Kết nối chậm/);
  const retry=await quiz.translate(q,'vi',translate);assert.ok(retry.every(row=>row.translation && !row.error));
});
test('quiz respects the selected translation language and English needs no request',async()=>{
  const q={type:'choice',prompt:'a woody plant'};let calls=0;
  assert.equal((await quiz.translate(q,'en',()=>{throw Error('unneeded network');}))[0].translation,q.prompt);
  const french=await quiz.translate(q,'fr',async(parts,from,to)=>{calls++;assert.equal(to,'fr');return ['une plante ligneuse'];});assert.equal(french[0].translation,'une plante ligneuse');assert.equal(calls,1);
});
test('unavailable offline translation and malformed output are reported without an invented translation',async()=>{
  const q={type:'choice',prompt:'a woody plant'};
  const missing=await quiz.translate(q,'vi',async()=>{throw Error('Bản dịch này chưa được lưu. Kết nối mạng để tải.');});assert.match(missing[0].error,/chưa được lưu/);assert.equal(missing[0].translation,undefined);
  for(const values of [[],[''],['one','two']])assert.ok((await quiz.translate(q,'vi',async()=>values))[0].error);
});
