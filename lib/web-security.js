'use strict';
const crypto=require('node:crypto');
const DEVICE=/^[a-f0-9]{64}$/;
// Express 4 does not forward rejected async handlers to its error middleware.
const asyncHandler=handler=>(req,res,next)=>Promise.resolve().then(()=>handler(req,res,next)).catch(next);
function createWebSecurity({production=false,random=()=>crypto.randomBytes(32).toString('hex')}={}){
 const name=production?'__Host-helen-device':'helen-device';
 function cookie(req){
  const value=String(req.headers.cookie || '').split(';').map(part=>part.trim()).find(part=>part.startsWith(name+'='))?.slice(name.length+1);
  return DEVICE.test(value || '')?value:null;
 }
 function headers(req,res,next){
  const nonce=crypto.randomBytes(18).toString('base64');res.locals.cspNonce=nonce;
  res.set({'Content-Security-Policy':`default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; media-src 'self' blob:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`,
   'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(), geolocation=(), microphone=(self)'});
  if(production && req.secure)res.set('Strict-Transport-Security','max-age=31536000');
  if(req.path.toLowerCase().startsWith('/api/')){
   res.set('Cache-Control','no-store');
   if(req.get('Sec-Fetch-Site')==='cross-site' || req.headers.origin && req.headers.origin!==`${req.protocol}://${req.get('host')}`)return res.status(403).json({error:'Yêu cầu phải gửi từ Helen Dictionary.',code:'REQUEST_ORIGIN'});
   if(['POST','PUT','PATCH','DELETE'].includes(req.method) && !req.is('application/json'))return res.status(415).json({error:'Nội dung yêu cầu không hợp lệ.',code:'REQUEST_CONTENT'});
   // API query fields are scalar strings. Nested keys and repeated values are
   // never legitimate inputs, and must not reach String(object) in a handler.
   const query=req.query;
   if(Object.keys(query).length>16 || Object.entries(query).some(([key,value])=>typeof value!=='string' || /[\[\]]/.test(key) || ['__proto__','constructor','prototype'].includes(key)))return res.status(400).json({error:'Tham số yêu cầu không hợp lệ.',code:'REQUEST_QUERY'});
  }
  next();
 }
 function session(req,res){
  const legacy=req.body?.legacyDevice;
  if(legacy!==undefined && (typeof legacy!=='string' || !DEVICE.test(legacy)))return res.status(400).json({error:'Mở lại website để đồng bộ lịch sử.',code:'HISTORY_DEVICE'});
  // The old random bearer identifies existing history. Import it once, then
  // keep the capability only in a host cookie; no JWT/account infrastructure.
  const token=cookie(req) || legacy || random();
  res.cookie(name,token,{httpOnly:true,secure:production,sameSite:'strict',path:'/',maxAge:365*86400000});
  res.json({ready:true});
 }
 function history(req,res,next){
  const token=cookie(req) || (!production?req.get('X-Helen-Device'):null);
  if(!DEVICE.test(token || ''))return res.status(401).json({error:'Mở lại website để đồng bộ lịch sử.',code:'HISTORY_DEVICE'});
  req.deviceToken=token;next();
 }
 return {headers,session,history};
}
module.exports={createWebSecurity,asyncHandler};
