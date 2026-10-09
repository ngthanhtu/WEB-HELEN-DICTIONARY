(()=>{
  'use strict';
  const core=window.HelenBackup,$=id=>document.getElementById(id);let storage;try{storage=localStorage;}catch{}
  function message(value){$('backup-status').textContent=value;}
  function download(type){try{const value=core.snapshot(storage),extension=type==='json'?'json':type==='csv'?'csv':'tsv',text=type==='json'?JSON.stringify(value,null,2):type==='csv'?core.csv(value):core.anki(value);
    const url=URL.createObjectURL(new Blob([text],{type:type==='json'?'application/json;charset=utf-8':'text/plain;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download=`helen-learning-${window.HelenHabits.day()}.${extension}`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);message(`Đã xuất ${value.favorites.length} từ. Giữ file này để sao lưu.`);
  }catch(error){message(error.message);}}
  for(const name of ['json','csv','anki'])$(`backup-${name}`).onclick=()=>download(name);
  $('backup-import').onclick=()=>$('backup-file').click();
  $('backup-file').onchange=async()=>{const file=$('backup-file').files[0];if(!file)return;try{
      if(file.size>core.MAX_BYTES)throw Error('Bản sao lưu tối đa 5 MB.');const value=core.parse(await file.text());
      if(!confirm(`Nhập ${value.favorites.length} từ và ${value.library.decks.length} bộ từ? Dữ liệu sẽ được gộp; lịch ôn mới hơn được giữ.`))return;
      const restored=core.restore(storage,value);document.dispatchEvent(new CustomEvent('helen:restore'));window.dispatchEvent(new StorageEvent('storage',{key:'helen-favorites'}));window.dispatchEvent(new StorageEvent('storage',{key:window.HelenHabits.KEY}));message(`Đã nhập. Kho từ hiện có ${restored.favorites.length} từ; tiến độ đã lưu trên thiết bị này.`);
    }catch(error){message(error.message || 'Chưa nhập được file.');}finally{$('backup-file').value='';}};
})();
