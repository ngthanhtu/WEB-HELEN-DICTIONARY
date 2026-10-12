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
    timezone:'Z',charset:'utf8mb4',connectionLimit:4,waitForConnections:true,queueLimit:64,connectTimeout:10000,
    multipleStatements:false,enableKeepAlive:true};
}
function createDatabase(env = process.env, dependencies = {}) {
  const persistence = {cacheWrites:0,vocabularyWrites:0,writeFailures:0,lastWriteAt:null,lastWriteError:null};
  let options, pool, speechPool, translationPool, aiPool, ready = false, schemaReady = false, initialization, retryAt = 0, lastCode, closed = false, reads = 0, writes = 0;
  const aiQuota={connected:false,recoveries:0,lastError:null};
  try {options = configuration(env);if (options) pool = (dependencies.createPool || require('mysql2/promise').createPool)(options);}
  catch (error) {lastCode = error.message === 'DATABASE_TLS_REQUIRED' ? 'DATABASE_TLS_REQUIRED' : 'DATABASE_CONFIG';}
  const configured = Boolean(env.MYSQL_HOST || env.DATABASE_URL);
  // Neither SQL values nor provider error messages (which may contain credentials) are logged.
  const safeCode = error => /^[A-Z_0-9]+$/.test(error?.code || '') ? error.code : 'DATABASE_UNAVAILABLE';
  async function query(sql, params = [], budget = 700, target = pool, textProtocol = false) {
    if (!target) throw Object.assign(new Error('DATABASE_UNAVAILABLE'),{code:lastCode || 'DATABASE_NOT_CONFIGURED'});
    let connection, timer, expired = false;
    const work = (async () => {
      connection = await target.getConnection();
      if (expired) {connection.release();connection = null;throw new Error('DATABASE_TIMEOUT');}
      // mysql2 query escapes bound values; avoid a PREPARE network round trip for speech.
      try {return await (textProtocol ? connection.query(sql,params) : connection.execute(sql,params));}
      finally {if (connection && !expired) connection.release();}
    })();
    try {return await Promise.race([work,new Promise((_,reject) => {timer = setTimeout(() => {
      expired = true;connection?.destroy();reject(Object.assign(new Error('DATABASE_TIMEOUT'),{code:'DATABASE_TIMEOUT'}));
    },budget);})]);}
    finally {clearTimeout(timer);}
  }
  function fail(error) {
    if (error.code === 'POOL_CONNLIMIT' || error.code === 'POOL_ENQUEUELIMIT') return;
    // A cache retry while initialization is pending must not postpone recovery.
    if (error.code === 'DATABASE_UNAVAILABLE' && !ready) return;
    // A foreground cache deadline is not evidence that the database is disconnected.
    // Keep writes available while a slow read falls back to the dictionary providers.
    if (error.code === 'DATABASE_TIMEOUT') return;
    ready = false;retryAt = Date.now() + 30000;lastCode = safeCode(error);
  }
  function writeSucceeded(kind) {
    persistence[kind]++;persistence.lastWriteAt=new Date().toISOString();persistence.lastWriteError=null;
  }
  function writeFailed(error) {
    persistence.writeFailures++;persistence.lastWriteError=safeCode(error);
    console.warn('Database write failed:',safeCode(error));fail(error);
  }
  async function initialize() {
    if (!pool) return false;
    if (initialization) return initialization;
    initialization = (async () => {
      try {
        for (const sql of statements()) await query(sql,[],5000);
        ready = true;schemaReady = true;lastCode = undefined;void cleanup();return true;
      } catch (error) {fail(error);return false;}
      finally {initialization = null;}
    })();
    return initialization;
  }
  function available() {
    if (!closed && !ready && pool && Date.now() >= retryAt) {retryAt = Date.now() + 30000;void initialize();}
    if(!closed && ready)void cleanup();
    return ready;
  }
  async function get(namespace, key, budget = 250) {
    if (!available() || reads >= 4 || writes >= 4) return null;
    reads++;
    try {
      const [rows] = await query('SELECT CAST(payload AS CHAR CHARACTER SET utf8mb4) AS payload, fresh_until FROM helen_cache WHERE namespace=? AND cache_key=?',[namespace,hash(key)],Math.min(2000,Math.max(250,budget)));
      if (!rows.length) return null;
      const value = typeof rows[0].payload === 'string' ? JSON.parse(rows[0].payload) : rows[0].payload;
      return {value,fresh:new Date(rows[0].fresh_until).getTime() > Date.now()};
    } catch (error) {fail(error);return null;}
    finally {reads--;}
  }
  function translationQuery(sql,params=[],budget=4500,prepared=false){
    if(!available())throw Object.assign(new Error('Translation storage unavailable'),{code:'DATABASE_UNAVAILABLE'});
    translationPool ||= (dependencies.createTranslationPool || dependencies.createPool || require('mysql2/promise').createPool)({...options,connectionLimit:2,maxIdle:2,idleTimeout:600000});
    return query(sql,params,budget,translationPool,!prepared);
  }
  function translationRows(rows){
    return rows.flatMap(row=>{try{const value=typeof row.payload==='string'?JSON.parse(row.payload):row.payload;return typeof value==='string' && value.trim() && value.length<=2400?[{namespace:row.namespace,key:row.cache_key,value}]:[];}catch{return [];}});
  }
  async function translationCache(limit=5000){
    if(!configured)return [];
    limit=Math.min(10000,Math.max(1,Number.isSafeInteger(limit)?limit:5000));
    try{
      const [rows]=await translationQuery(`SELECT namespace,cache_key,CAST(payload AS CHAR CHARACTER SET utf8mb4) AS payload FROM helen_cache WHERE namespace IN ('translation-v2','translation-semantic-v4') ORDER BY refreshed_at DESC LIMIT ${limit}`,[],8000);
      return translationRows(rows);
    }catch(error){fail(error);throw error;}
  }
  async function translationValues(namespace,keys){
    if(!configured)return [];
    if(!['translation-v2','translation-semantic-v4'].includes(namespace) || !Array.isArray(keys) || keys.length>40 || !keys.every(key=>typeof key==='string'))throw Error('INVALID_TRANSLATION_CACHE');
    if(!keys.length)return [];
    try{
      const hashes=[...new Set(keys.map(hash))];
      const [rows]=await translationQuery(`SELECT namespace,cache_key,CAST(payload AS CHAR CHARACTER SET utf8mb4) AS payload FROM helen_cache WHERE namespace=? AND cache_key IN (${hashes.map(()=>'?').join(',')})`,[namespace,...hashes]);
      return translationRows(rows);
    }catch(error){fail(error);throw error;}
  }
  async function setTranslations(items){
    if(!configured)return false;
    if(!Array.isArray(items) || !items.length || items.length>40 || !items.every(item=>['translation-v2','translation-semantic-v4'].includes(item.namespace) && typeof item.key==='string' && typeof item.value==='string' && item.value.trim() && item.value.length<=2400))throw Error('INVALID_TRANSLATION_CACHE');
    try{
      const until=new Date(Date.now()+86400000);
      // Provider/user text must use server-bound parameters, independent of
      // NO_BACKSLASH_ESCAPES or any future database SQL-mode configuration.
      await translationQuery(`INSERT INTO helen_cache (namespace,cache_key,payload,refreshed_at,fresh_until) VALUES ${items.map(()=>'(?,?,?,UTC_TIMESTAMP(3),?)').join(',')} ON DUPLICATE KEY UPDATE payload=VALUES(payload),refreshed_at=VALUES(refreshed_at),fresh_until=VALUES(fresh_until)`,items.flatMap(item=>[item.namespace,hash(item.key),JSON.stringify(item.value),until]),8000,true);
      writeSucceeded('cacheWrites');return true;
    }catch(error){writeFailed(error);return false;}
  }
  async function set(namespace, key, value, ttl = 86400000) {
    if (!available()) return false;
    writes++;
    try {
      const payload = JSON.stringify(value);
      if (Buffer.byteLength(payload) > 500000) return false;
      await query('INSERT INTO helen_cache (namespace,cache_key,payload,refreshed_at,fresh_until) VALUES (?,?,?,UTC_TIMESTAMP(3),?) ON DUPLICATE KEY UPDATE payload=VALUES(payload),refreshed_at=VALUES(refreshed_at),fresh_until=VALUES(fresh_until)',[namespace,hash(key),payload,new Date(Date.now() + ttl)],10000);
      writeSucceeded('cacheWrites');
      return true;
    } catch (error) {writeFailed(error);return false;}
    finally {writes--;}
  }
  async function vocabulary(word, entries, revision) {
    if (!available()) return false;
    writes++;
    try {
      await query('INSERT INTO helen_vocabulary (word,payload,revision,updated_at) VALUES (?,?,?,UTC_TIMESTAMP(3)) ON DUPLICATE KEY UPDATE payload=VALUES(payload),revision=VALUES(revision),updated_at=VALUES(updated_at)',[word,JSON.stringify(entries),revision],10000);writeSucceeded('vocabularyWrites');return true;
    } catch (error) {writeFailed(error);return false;}
    finally {writes--;}
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
  const serviceUnavailable=()=>Object.assign(new Error('Kết nối giới hạn API tạm gián đoạn. Nội dung vẫn được giữ; hãy thử lại.'),{status:503,code:'USAGE_UNAVAILABLE'});
  let aiPreparedDay,aiPreparation;
  function quotaAvailable(){
    // Once tables exist, a failure in the independent cache pool must not put
    // AI's healthy pool behind the general database's 30-second cooldown.
    if(!schemaReady)available();
    return !closed && schemaReady;
  }
  function aiConnections(){
    if(!quotaAvailable())throw serviceUnavailable();
    aiPool ||= (dependencies.createAIPool || dependencies.createPool || require('mysql2/promise').createPool)({...options,connectionLimit:1,maxIdle:1,idleTimeout:600000});
    return aiPool;
  }
  function aiQuery(sql,params){return query(sql,params,3500,aiConnections(),true);}
  async function prepareAI(at=Date.now()){
    const date=new Date(at),day=date.toISOString().slice(0,10);
    if(aiPreparedDay===day)return;
    if(aiPreparation){await aiPreparation;if(aiPreparedDay===day)return;}
    aiPreparation=(async()=>{
      await aiQuery('INSERT IGNORE INTO helen_usage_budget (bucket,key_hash,units,expires_at) VALUES (?,?,0,?)',['ai-day',hash(day),new Date(new Date(`${day}T00:00:00Z`).getTime()+86400000)]);
      aiPreparedDay=day;
    })();try{await aiPreparation;}finally{aiPreparation=null;}
  }
  async function reserveAI({at=Date.now(),units=1,limit}={}){
    if(!Number.isFinite(at) || at<0 || !Number.isSafeInteger(units) || units<1 || !Number.isSafeInteger(limit) || limit<1 || units>limit)return false;
    try{
      await prepareAI(at);
      const day=new Date(at).toISOString().slice(0,10);
      const [result]=await aiQuery('UPDATE helen_usage_budget SET units=units+? WHERE bucket=? AND key_hash=? AND units<=?',[units,'ai-day',hash(day),limit-units]);
      return result.affectedRows===1;
    }catch(error){fail(error);throw serviceUnavailable();}
  }
  const recoverableQuotaErrors=new Set(['ECONNRESET','ECONNREFUSED','ETIMEDOUT','EPIPE','PROTOCOL_CONNECTION_LOST','PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR','PROTOCOL_ENQUEUE_AFTER_QUIT','ER_LOCK_DEADLOCK','ER_LOCK_WAIT_TIMEOUT']);
  async function transaction(work,connectionPool=pool,{isolatedAI=false}={}) {
    if(!isolatedAI && !available())throw serviceUnavailable();
    let connection,timer,expired=false;
    const task=(async()=>{
      if(isolatedAI){
        // A request just after Render wakes can arrive during startup DDL. Wait
        // for that same initialization under this transaction's deadline.
        if(!quotaAvailable() && initialization)await initialization;
        if(!quotaAvailable() || expired)throw serviceUnavailable();
      }
      const target=typeof connectionPool==='function'?connectionPool():connectionPool;
      for(let attempt=0;attempt<2;attempt++){
        let began=false,committing=false,rolledBack=false,destroyed=false;
        try{
          connection=await target.getConnection();if(expired){connection.release();connection=null;throw serviceUnavailable();}
          await connection.beginTransaction();began=true;
          if(expired)throw serviceUnavailable();
          const result=await work(connection);
          if(expired)throw serviceUnavailable();
          // A lost COMMIT acknowledgement has an unknown debit outcome. Never
          // retry it: doing so could spend two allowances for one generation.
          committing=true;await connection.commit();
          if(isolatedAI){aiQuota.connected=true;aiQuota.lastError=null;}
          return result;
        }catch(error){
          if(!expired && began && !committing){try{await connection.rollback();rolledBack=true;}catch{}}
          if(connection && !expired && (committing || !began || !rolledBack || recoverableQuotaErrors.has(error.code))){connection.destroy();destroyed=true;}
          const retry=isolatedAI && attempt===0 && !expired && !committing && (!began || rolledBack) && recoverableQuotaErrors.has(error.code);
          if(!retry)throw error;
          aiQuota.recoveries++;
        }finally{if(connection && !expired && !destroyed)connection.release();connection=null;}
      }
    })();
    try{return await Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;connection?.destroy();reject(Object.assign(serviceUnavailable(),{code:'DATABASE_TIMEOUT'}));},3500);})]);}
    catch(error){
      if(isolatedAI){aiQuota.connected=false;aiQuota.lastError=safeCode(error);}
      else fail(error);
      throw serviceUnavailable();
    }finally{clearTimeout(timer);}
  }
  const ttsBudget=require('./tts-budget');let ttsPreparation,ttsPrepared=false;
  function speechQuery(sql,params=[]){
    // Short cache deadlines destroy connections in the general pool. Keep quota's
    // warmed connection separate so a cache miss cannot force another TLS handshake.
    speechPool ||= (dependencies.createSpeechPool || dependencies.createPool || require('mysql2/promise').createPool)({...options,connectionLimit:1,maxIdle:1,idleTimeout:600000});
    return query(sql,params,3500,speechPool,true);
  }
  async function prepareTTS(){
    if(ttsPrepared)return true;
    if(ttsPreparation)return ttsPreparation;
    if(!available())throw serviceUnavailable();
    ttsPreparation=(async()=>{
      const [existing]=await speechQuery('SELECT id FROM helen_tts_usage WHERE id=1');
      if(!existing.length){
        const at=Date.now(),window=ttsBudget.windowAt(at);
        const [rows]=await speechQuery("SELECT bucket,key_hash,units,expires_at FROM helen_usage_budget WHERE (bucket='tts-day' AND key_hash=?) OR (bucket='tts-month' AND key_hash=?) OR (bucket='tts-device' AND expires_at=?)",[ttsBudget.hash(window.day),ttsBudget.hash(window.month),new Date(window.end)]);
        await speechQuery('INSERT IGNORE INTO helen_tts_usage (id,day_key,month_key,day_units,month_units,devices) VALUES (1,?,?,?,?,?)',ttsBudget.legacy(rows,at));
      }
      ttsPrepared=true;return true;
    })();try{return await ttsPreparation;}catch(error){fail(error);throw serviceUnavailable();}finally{ttsPreparation=null;}
  }
  async function reserveTTS(options){
    if(!available())throw serviceUnavailable();
    try{await prepareTTS();const [result]=await speechQuery(ttsBudget.SQL,ttsBudget.parameters(options));return result.affectedRows===1;}
    catch(error){fail(error);throw serviceUnavailable();}
  }
  async function reserveUsage(rules,{isolatedAI=false}={}) {
    return transaction(async connection=>{
      // Reuse AI's warmed connection for speaking budgets. General cache
      // deadlines must not force a TLS handshake before each speaking turn.
      const execute=(sql,params)=>isolatedAI && connection.query?connection.query(sql,params):connection.execute(sql,params);
      const ordered=rules.slice().sort((a,b)=>a.bucket.localeCompare(b.bucket) || a.key.localeCompare(b.key));
      if(!ordered.length)return true;
      // Three SQL calls for all buckets; locks and debits stay in one transaction.
      await execute(`INSERT IGNORE INTO helen_usage_budget (bucket,key_hash,units,expires_at) VALUES ${ordered.map(()=>'(?,?,0,?)').join(',')}`,ordered.flatMap(rule=>[rule.bucket,rule.key,new Date(rule.expiresAt)]));
      const where=ordered.map(()=>'(?,?)').join(','),keys=ordered.flatMap(rule=>[rule.bucket,rule.key]);
      const [rows]=await execute(`SELECT bucket,key_hash,units FROM helen_usage_budget WHERE (bucket,key_hash) IN (${where}) ORDER BY bucket,key_hash FOR UPDATE`,keys);
      const counts=new Map(rows.map(row=>[`${row.bucket}:${row.key_hash}`,Number(row.units)]));
      if(ordered.some(rule=>!counts.has(`${rule.bucket}:${rule.key}`)))throw serviceUnavailable();
      if(ordered.some(rule=>counts.get(`${rule.bucket}:${rule.key}`)+rule.units>rule.limit))return false;
      await execute(`UPDATE helen_usage_budget SET units=units+CASE ${ordered.map(()=> 'WHEN bucket=? AND key_hash=? THEN ?').join(' ')} ELSE 0 END WHERE (bucket,key_hash) IN (${where})`,[...ordered.flatMap(rule=>[rule.bucket,rule.key,rule.units]),...keys]);
      return true;
    },isolatedAI?aiConnections:pool,{isolatedAI});
  }
  async function metrics(events) {
    return transaction(async connection=>{
      // Unique IDs make retrying an offline batch safe; no device IDs or searched words.
      for(const event of events.slice().sort((a,b)=>a.id.localeCompare(b.id))){
        const [inserted]=await connection.execute('INSERT IGNORE INTO helen_metric_events (event_id,created_at) VALUES (?,UTC_TIMESTAMP(3))',[event.id]);
        if(inserted.affectedRows)await connection.execute('INSERT INTO helen_metrics_daily (event_day,event_name,event_count) VALUES (?,?,1) ON DUPLICATE KEY UPDATE event_count=event_count+1',[event.day,event.name]);
      }
      return true;
    });
  }
  let cleanupAt=0;
  async function cleanup(){
    if(!ready || Date.now()<cleanupAt)return;cleanupAt=Date.now()+3600000;
    try{
      await query('DELETE FROM helen_usage_budget WHERE expires_at < UTC_TIMESTAMP(3) LIMIT 10000',[],3000);
      await query('DELETE FROM helen_metric_events WHERE created_at < UTC_TIMESTAMP(3) - INTERVAL 30 DAY LIMIT 10000',[],3000);
      await query('DELETE FROM helen_metrics_daily WHERE event_day < UTC_DATE() - INTERVAL 90 DAY LIMIT 10000',[],3000);
    }catch{}
  }
  return {initialize,get,set,translationCache,translationValues,setTranslations,vocabulary,history,saveHistory,reserveUsage,prepareTTS,reserveTTS,prepareAI,reserveAI,metrics,
    status:() => {available();return {configured,connected:ready,aiQuota:{...aiQuota},persistence:{...persistence},...(lastCode ? {code:lastCode} : {})};},
    close:() => {if(closed)return Promise.resolve();closed = true;ready = false;return Promise.all([...new Set([pool,speechPool,translationPool,aiPool].filter(Boolean))].map(value=>value.end()));}};
}
module.exports = {createDatabase,configuration,statements};
