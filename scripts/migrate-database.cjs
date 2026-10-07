require('dotenv').config({path:['.env','env'].map(file=>require('node:path').join(__dirname,'..',file)),quiet:true});
const database = require('../lib/database').createDatabase();
(async () => {
  if (!database.status().configured) throw new Error('Thêm MYSQL_HOST/MYSQL_USER/MYSQL_PASSWORD/MYSQL_DATABASE hoặc DATABASE_URL vào Environment trước.');
  if (!await database.initialize()) throw new Error(`Chưa kết nối hoặc tạo được bảng: ${database.status().code || 'DATABASE_UNAVAILABLE'}. Kiểm tra Environment, TLS và quyền CREATE TABLE.`);
  console.log('Database sẵn sàng: helen_cache, helen_vocabulary, helen_history, helen_history_events, helen_devices.');
})().catch(error => {console.error(error.message);process.exitCode = 1;}).finally(() => database.close());
