import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { createAuthHandler, normalizePhone } from './auth.js'
const env={AUTH_ORIGIN:'http://localhost:5173',TWILIO_ACCOUNT_SID:'test',TWILIO_AUTH_TOKEN:'test',TWILIO_VERIFY_SERVICE_SID:'test'}
async function request(handler,path,body,cookie='',origin=env.AUTH_ORIGIN){const req=Readable.from(body?[JSON.stringify(body)]:[]);Object.assign(req,{url:'/api/auth/'+path,method:body?'POST':'GET',headers:{origin,'content-type':'application/json',cookie},socket:{remoteAddress:'test'}});let headers={},status,data;const res={setHeader(k,v){headers[k]=v},writeHead(s,h){status=s;Object.assign(headers,h)},end(v){data=JSON.parse(v)}};await handler(req,res);return {status,data,headers}}
test('Phone OTP fails closed, rejects bad codes, issues/revokes a session, expires and throttles',async()=>{
 assert.equal(normalizePhone('123'),null)
 const disabled=createAuthHandler({env:{}});assert.equal((await request(disabled,'send',{phone:'9000000001'})).status,503)
 let time=Date.now();const handler=createAuthHandler({env,now:()=>time,fetchImpl:async(url,options)=>({ok:true,json:async()=>({status:url.endsWith('/Verifications')?'pending':options.body.get('Code')==='123456'?'approved':'pending'})})})
 assert.equal((await request(handler,'send',{phone:'9000000001'},'','https://bad.invalid')).status,403)
 let r=await request(handler,'send',{phone:'9000000001'});assert.equal(r.status,200);const challenge=r.headers['Set-Cookie'].split(';')[0]
 assert.equal((await request(handler,'send',{phone:'9000000001'})).status,429)
 assert.equal((await request(handler,'verify',{code:'999999'},challenge)).status,400)
 r=await request(handler,'verify',{code:'123456'},challenge);assert.equal(r.status,200);const session=r.headers['Set-Cookie'][0].split(';')[0];assert.match(r.headers['Set-Cookie'][0],/HttpOnly/)
 assert.equal((await request(handler,'verify',{code:'123456'},challenge)).status,400)
 assert.equal((await request(handler,'session',null,session)).data.user.phone,'+919000000001')
 await request(handler,'logout',{},session);assert.equal((await request(handler,'session',null,session)).data.user,null)
 time+=61000;r=await request(handler,'send',{phone:'9000000001'});const expired=r.headers['Set-Cookie'].split(';')[0];time+=600001;assert.equal((await request(handler,'verify',{code:'123456'},expired)).status,400)
})
