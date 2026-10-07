const {test}=require('node:test'), assert=require('node:assert/strict'), crypto=require('node:crypto');
const {createDatabase,configuration}=require('../lib/database');
test('slow cache read does not disable subsequent durable writes',async()=>{
  const written=[];
  const db=createDatabase({MYSQL_HOST:'127.0.0.1',MYSQL_USER:'test',MYSQL_DATABASE:'test',MYSQL_SSL:'false'}, {
    createPool:()=>({getConnection:async()=>({
      execute:async(sql,params)=>{
        if(sql.startsWith('SELECT'))await new Promise(resolve=>setTimeout(resolve,350));
        if(sql.startsWith('INSERT'))written.push({sql,params});
        return [[]];
      },release(){},destroy(){}
    }),end:async()=>{}})
  });
  try {
    assert.equal(await db.initialize(),true);
    assert.equal(await db.get('dictionary-v2','serendipity'),null);
    assert.equal(db.status().connected,true);
    assert.equal(await db.set('dictionary-v2','serendipity',[{word:'serendipity'}]),true);
    assert.equal(await db.vocabulary('serendipity',[{word:'serendipity'}],2),true);
    assert.equal(written.length,2);
    assert.equal(db.status().persistence.cacheWrites,1);
    assert.equal(db.status().persistence.vocabularyWrites,1);
  } finally {await db.close();}
});
test('completed RAM entries are persisted and successful writes are deduplicated',async()=>{
  const {createDictionaryPersistence}=require('../lib/persist-dictionary');
  const writes=[];
  const persist=createDictionaryPersistence({status:()=>({configured:true}),
    set:async(...args)=>{writes.push(args);return true;},
    vocabulary:async(...args)=>{writes.push(args);return true;}
  },2);
  const entries=[{word:'serendipity',meanings:[]}];
  persist('serendipity',entries);persist('serendipity',entries);
  await new Promise(resolve=>setImmediate(resolve));
  persist('serendipity',entries);
  assert.equal(writes.length,2);
  assert.equal(writes[0][0],'dictionary-v2');
  assert.equal(writes[1][0],'serendipity');
});
test('MySQL configuration verifies remote TLS, preserves encoded URL values and never disables certificates',() => {
  assert.equal(configuration({}),null);
  const config=configuration({DATABASE_URL:'mysql://learner:p%40ss%3Aword@db.example:4000/helen'});
  assert.equal(config.password,'p@ss:word');assert.equal(config.port,4000);assert.equal(config.ssl.rejectUnauthorized,true);assert.equal(config.multipleStatements,false);
  assert.throws(()=>configuration({DATABASE_URL:'postgres://user:pass@db.example/helen'}),/DATABASE_CONFIG/);
  assert.throws(()=>configuration({DATABASE_URL:'mysql://user:pass@db.example/helen',MYSQL_SSL:'false'}),/DATABASE_TLS_REQUIRED/);
  assert.equal(configuration({MYSQL_HOST:'127.0.0.1',MYSQL_USER:'u',MYSQL_DATABASE:'d',MYSQL_SSL:'false'}).ssl,undefined);
});
test('missing or invalid databases fail open for cache and use safe actionable history errors',async() => {
  for(const env of [{},{DATABASE_URL:'mysql://private-password-bad-format'}]) {
    const db=createDatabase(env);assert.equal(await db.get('dictionary','word'),null);assert.equal(await db.set('dictionary','word',[]),false);
    await assert.rejects(()=>db.history('a'.repeat(64)),error=>error.code==='DATABASE_UNAVAILABLE' && !error.message.includes('private-password'));
    await db.close();
  }
});
test('real MySQL survives new connections, separates cache namespaces, refreshes stale results and makes history retries idempotent',{skip:process.env.HELEN_MYSQL_TEST!=='1'},async() => {
  const first=createDatabase(), second=createDatabase();
  const key=crypto.randomUUID(),token=crypto.randomBytes(32).toString('hex'), other=crypto.randomBytes(32).toString('hex');
  try {
    assert.equal(await first.initialize(),true);assert.equal(await first.initialize(),true);
    assert.equal(await first.set('test-translations',key,'fr:loan'),true);
    assert.equal(await first.set('test-context',key,{word:'loan'}),true);
    assert.equal(await first.set('test-expired',key,'old',-1),true);
    await first.close();assert.equal(await second.initialize(),true);
    assert.deepEqual(await second.get('test-translations',key),{value:'fr:loan',fresh:true});
    assert.deepEqual((await second.get('test-context',key)).value,{word:'loan'});
    assert.deepEqual(await second.get('test-expired',key),{value:'old',fresh:false});
    assert.equal(await second.get('test-translations','unseen'),null);
    const event=(action,word)=>({id:crypto.randomUUID(),action,word,at:new Date().toISOString()});
    const search=event('search',"x' OR 1=1 --");
    await second.saveHistory(token,[search]);await second.saveHistory(token,[search]);
    assert.equal((await second.history(token))[0].count,1);assert.deepEqual(await second.history(other),[]);
    const batch=[event('clear'),event('search','drawback')];await second.saveHistory(token,batch);await second.saveHistory(token,batch);
    assert.deepEqual((await second.history(token)).map(item=>item.word),['drawback']);
    assert.equal((await second.history(token))[0].count,1);
    await second.vocabulary('drawback',[{word:'drawback',meanings:[]}],2);
    const batchKeys=Array.from({length:40},(_,i)=>`${key}-${i}`);
    assert.ok((await Promise.all(batchKeys.map(item=>second.set('test-bulk',item,'cached')))).every(Boolean),'all successful translations in a batch must persist, not be dropped when four connections are occupied');
    for(const item of batchKeys)assert.equal((await second.get('test-bulk',item)).value,'cached');
  } finally {await second.close();}
});
