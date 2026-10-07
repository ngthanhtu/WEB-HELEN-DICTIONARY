const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const statements = () => fs.readFileSync(path.join(__dirname,'../database/schema.sql'),'utf8')
  .replace(/^--.*$/gm,'').split(';').map(sql => sql.trim()).filter(Boolean);
function configuration(env) {
  if (!env.MYSQL_HOST && !env.DATABASE_URL) return null;
  let url;
  if (env.DATABASE_URL) {
    try {url = new URL(env.DATABASE_URL);} catch {throw new Error('DATABASE_CONFIG');}
    if (url.protocol !== 'mysql:') throw new Error('DATABASE_CONFIG');
  }
  const host = env.MYSQL_HOST || url?.hostname;
  const user = env.MYSQL_USER || (url && decodeURIComponent(url.username));
  const password = env.MYSQL_PASSWORD ?? (url && decodeURIComponent(url.password));
  const database = env.MYSQL_DATABASE || (url && decodeURIComponent(url.pathname.slice(1)));
  const port = Number(env.MYSQL_PORT || url?.port || 3306);
  if (!host || !user || !database || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error('DATABASE_CONFIG');
  const local = ['localhost','127.0.0.1','::1','[::1]'].includes(host);
  if (env.MYSQL_SSL === 'false' && !local) throw new Error('DATABASE_TLS_REQUIRED');
  const ca = env.MYSQL_SSL_CA || (env.MYSQL_SSL_CA_FILE ? fs.readFileSync(env.MYSQL_SSL_CA_FILE,'utf8') : undefined);
  return {host:host.replace(/^\[|\]$/g,''),port,user,password,database,
    ssl:env.MYSQL_SSL === 'false' ? undefined : {rejectUnauthorized:true,verifyIdentity:true,...(ca ? {ca} : {})},
    timezone:'Z',charset:'utf8mb4',connectionLimit:4,waitForConnections:false,connectTimeout:1500,
    multipleStatements:false,enableKeepAlive:true};
}
function createDatabase(env = process.env) {
  let options, pool, ready = false, initialization, retryAt = 0, lastCode, closed = false;
  try {options = configuration(env);if (options) pool = require('mysql2/promise').createPool(options);}
  catch (error) {lastCode = error.message === 'DATABASE_TLS_REQUIRED' ? 'DATABASE_TLS_REQUIRED' : 'DATABASE_CONFIG';}
  const configured = Boolean(env.MYSQL_HOST || env.DATABASE_URL);
  // Neither SQL values nor provider error messages (which may contain credentials) are logged.
  const safeCode = error => /^[A-Z_0-9]+$/.test(error?.code || '') ? error.code : 'DATABASE_UNAVAILABLE';
  async function query(sql, params = [], budget = 700) {
    if (!pool) throw Object.assign(new Error('DATABASE_UNAVAILABLE'),{code:lastCode || 'DATABASE_NOT_CONFIGURED'});
    let connection, timer, expired = false;
    const work = (async () => {
      connection = await pool.getConnection();
      if (expired) {connection.release();connection = null;throw new Error('DATABASE_TIMEOUT');}
      try {return await connection.execute(sql,params);}
      finally {if (connection && !expired) connection.release();}
    })();
    try {return await Promise.race([work,new Promise((_,reject) => {timer = setTimeout(() => {
      expired = true;connection?.destroy();reject(Object.assign(new Error('DATABASE_TIMEOUT'),{code:'DATABASE_TIMEOUT'}));
    },budget);})]);}
    finally {clearTimeout(timer);}
  }
  function fail(error) {
    if (error.code === 'POOL_CONNLIMIT' || error.code === 'POOL_ENQUEUELIMIT') return;
    ready = false;retryAt = Date.now() + 30000;lastCode = safeCode(error);
  }
  async function initialize() {
    if (!pool) return false;
    if (initialization) return initialization;
    initialization = (async () => {
      try {
        for (const sql of statements()) await query(sql,[],5000);
        ready = true;lastCode = undefined;return true;
      } catch (error) {fail(error);return false;}
      finally {initialization = null;}
    })();
    return initialization;
  }
  function available() {
    if (!closed && !ready && pool && Date.now() >= retryAt) {retryAt = Date.now() + 30000;void initialize();}
    return ready;
  }
  async function get(namespace, key) {
    if (!available()) return null;
    try {
      const [rows] = await query('SELECT CAST(payload AS CHAR CHARACTER SET utf8mb4) AS payload, fresh_until FROM helen_cache WHERE namespace=? AND cache_key=?',[namespace,hash(key)],250);
      if (!rows.length) return null;
      const value = typeof rows[0].payload === 'string' ? JSON.parse(rows[0].payload) : rows[0].payload;
      return {value,fresh:new Date(rows[0].fresh_until).getTime() > Date.now()};
    } catch (error) {fail(error);return null;}
  }
  async function set(namespace, key, value, ttl = 86400000) {
    if (!available()) return false;
    try {
      const payload = JSON.stringify(value);
      if (Buffer.byteLength(payload) > 500000) return false;
      await query('INSERT INTO helen_cache (namespace,cache_key,payload,refreshed_at,fresh_until) VALUES (?,?,?,UTC_TIMESTAMP(3),?) ON DUPLICATE KEY UPDATE payload=VALUES(payload),refreshed_at=VALUES(refreshed_at),fresh_until=VALUES(fresh_until)',[namespace,hash(key),payload,new Date(Date.now() + ttl)]);
      return true;
    } catch (error) {fail(error);return false;}
  }
  async function vocabulary(word, entries, revision) {
    if (!available()) return false;
    try {
      await query('INSERT INTO helen_vocabulary (word,payload,revision,updated_at) VALUES (?,?,?,UTC_TIMESTAMP(3)) ON DUPLICATE KEY UPDATE payload=VALUES(payload),revision=VALUES(revision),updated_at=VALUES(updated_at)',[word,JSON.stringify(entries),revision]);return true;
    } catch (error) {fail(error);return false;}
  }
  const notReady = () => Object.assign(new Error('Lịch sử vẫn được lưu trên thiết bị. Database chưa kết nối; sẽ đồng bộ khi sẵn sàng.'),{status:503,code:'DATABASE_UNAVAILABLE'});
  async function history(token) {
    if (!available()) throw notReady();
    try {
      const [rows] = await query('SELECT word,last_seen AS at,search_count AS count FROM helen_history WHERE device_hash=? ORDER BY last_seen DESC,word LIMIT 40',[hash(token)],1500);
      return rows.map(row => ({word:row.word,at:new Date(row.at).toISOString(),count:Number(row.count)}));
    } catch (error) {fail(error);throw notReady();}
  }
  // Batch and event IDs make offline retries idempotent. Clear and searches commit together.
  async function saveHistory(token, events) {
    if (!available()) throw notReady();
    const device = hash(token);let connection, timer, expired = false;
    const work = (async () => {
      connection = await pool.getConnection();
      if (expired) {connection.release();connection = null;throw notReady();}
      try {
        await connection.beginTransaction();
        await connection.execute('INSERT IGNORE INTO helen_devices (device_hash,created_at) VALUES (?,UTC_TIMESTAMP(3))',[device]);
        await connection.execute('SELECT device_hash FROM helen_devices WHERE device_hash=? FOR UPDATE',[device]);
        const [known] = await connection.execute(`SELECT event_id FROM helen_history_events WHERE device_hash=? AND event_id IN (${events.map(()=>'?').join(',')})`,[device,...events.map(event=>event.id)]);
        const seen = new Set(known.map(row=>row.event_id));
        const unseen = events.filter(event=>{if(seen.has(event.id))return false;seen.add(event.id);return true;});
        if (unseen.length) {
          await connection.execute(`INSERT INTO helen_history_events (device_hash,event_id,created_at) VALUES ${unseen.map(()=>'(?,?,UTC_TIMESTAMP(3))').join(',')}`,unseen.flatMap(event=>[device,event.id]));
          const clearIndex = unseen.findLastIndex(event=>event.action==='clear');
          if (clearIndex>=0) await connection.execute('DELETE FROM helen_history WHERE device_hash=?',[device]);
          const grouped = new Map();
          for(const event of unseen.slice(clearIndex+1)) {
            if(event.action!=='search')continue;
            const old = grouped.get(event.word), at = new Date(event.at);
            grouped.set(event.word,{at:old && old.at>at ? old.at : at,count:(old?.count || 0)+1});
          }
          if(grouped.size)await connection.execute(`INSERT INTO helen_history (device_hash,word,last_seen,search_count) VALUES ${[...grouped].map(()=>'(?,?,?,?)').join(',')} ON DUPLICATE KEY UPDATE last_seen=GREATEST(last_seen,VALUES(last_seen)),search_count=search_count+VALUES(search_count)`,[...grouped].flatMap(([word,item])=>[device,word,item.at,item.count]));
        }
        await connection.commit();return true;
      } catch (error) {if (!expired) await connection.rollback().catch(() => {});throw error;}
      finally {if (connection && !expired) connection.release();}
    })();
    try {return await Promise.race([work,new Promise((_,reject) => {timer = setTimeout(() => {expired = true;connection?.destroy();reject(notReady());},4000);})]);}
    catch (error) {fail(error);throw notReady();}
    finally {clearTimeout(timer);}
  }
  return {initialize,get,set,vocabulary,history,saveHistory,
    status:() => {available();return {configured,connected:ready,...(lastCode ? {code:lastCode} : {})};},
    close:() => {closed = true;ready = false;return pool?.end() || Promise.resolve();}};
}
module.exports = {createDatabase,configuration,statements};
