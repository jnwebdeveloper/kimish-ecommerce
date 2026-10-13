import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { loadEnv } from 'vite'
import { createApi } from './api.js'
const env={...loadEnv('development',process.cwd(),''),...process.env,AUTH_ORIGIN:'http://localhost:5173',RAZORPAY_KEY_ID:'rzp_test_qa',RAZORPAY_KEY_SECRET:'qa-secret'}
test('Razorpay checkout: abandoned payments restore stock, verified payments are marked paid',async()=>{
 const realFetch=globalThis.fetch,razorpay={orders:0,payments:[],payment:null}
 globalThis.fetch=async(url,init)=>{const u=String(url);if(!u.startsWith('https://api.razorpay.com/'))return realFetch(url,init);const reply=body=>new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}})
  if(u.endsWith('/v1/orders'))return reply({id:`order_qa${++razorpay.orders}`,amount:JSON.parse(init.body).amount,currency:'INR'})
  if(/\/v1\/orders\/[^/]+\/payments$/.test(u))return reply({items:razorpay.payments})
  if(u.includes('/v1/payments/'))return reply(razorpay.payment)
  throw new Error('Unexpected Razorpay call '+u)}
 const {api,pool}=createApi(env),server=api.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;let cookie='';const created=[]
 async function call(path,body,method){const response=await realFetch(base+path,{method:method||(body?'POST':'GET'),headers:{Origin:env.AUTH_ORIGIN,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json().catch(()=>null),headers:response.headers}}
 const add=async(m,body)=>{const r=await call('/api/admin/'+m,body);assert.equal(r.status,200,JSON.stringify(r));created.push([m,r.data.id]);return r.data.id}
 const stock=async id=>(await pool.query('SELECT stock FROM variants WHERE id=$1',[id])).rows[0].stock
 try {
 const login=await call('/api/admin/login',{email:env.ADMIN_EMAIL,password:env.ADMIN_PASSWORD});assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0]
 const category=await add('categories',{name:'QA Razorpay Category',slug:'qa-razorpay-category',group_name:'Nuts',active:true})
 const product=await add('products',{name:'QA Razorpay Product',slug:'qa-razorpay-product',category_id:category,image:'/products/kimish-cashew.png',active:true})
 const variant=await add('variants',{product_id:product,weight:'100g',price:600,mrp:700,stock:10})
 const order={customer:{name:'QA Razorpay',mobile:'9000000002',email:'qa-rzp@example.invalid',address:'Test street',city:'Test City',state:'Test State',pincode:'123456'},payment:'razorpay',items:[{variantId:variant,qty:3}]}

 // Abandoned payment: stock is held while the payment window is open, then restored exactly once
 let placed=await call('/api/orders',order);assert.equal(placed.status,201,JSON.stringify(placed));assert.equal(await stock(variant),7)
 const cancel={orderNumber:placed.data.id,razorpay_order_id:placed.data.razorpay.orderId}
 razorpay.payments=[{id:'pay_qa_pending',status:'authorized'}]
 assert.equal((await call('/api/payments/razorpay/cancel',cancel)).status,409);assert.equal(await stock(variant),7)
 razorpay.payments=[{id:'pay_qa_failed',status:'failed'}]
 let result=await call('/api/payments/razorpay/cancel',cancel);assert.equal(result.status,200);assert.equal(result.data.cancelled,true);assert.equal(await stock(variant),10)
 result=await call('/api/payments/razorpay/cancel',cancel);assert.equal(result.data.cancelled,false);assert.equal(await stock(variant),10)
 assert.equal((await call('/api/payments/razorpay/cancel',{...cancel,razorpay_order_id:'order_other'})).status,404)
 const cancelled=(await pool.query('SELECT o.status,o.payment_status,p.status payment FROM orders o JOIN payments p ON p.order_id=o.id WHERE o.order_number=$1',[placed.data.id])).rows[0]
 assert.deepEqual(cancelled,{status:'Cancelled',payment_status:'Unpaid',payment:'failed'})

 // Completed payment: signature and captured amount are verified before the order is marked paid
 placed=await call('/api/orders',order);assert.equal(placed.status,201);const rzpOrder=placed.data.razorpay.orderId
 razorpay.payment={id:'pay_qa_ok',order_id:rzpOrder,status:'captured',amount:placed.data.razorpay.amount,method:'upi'}
 const signature=createHmac('sha256',env.RAZORPAY_KEY_SECRET).update(`${rzpOrder}|pay_qa_ok`).digest('hex')
 assert.equal((await call('/api/payments/razorpay/verify',{orderNumber:placed.data.id,razorpay_order_id:rzpOrder,razorpay_payment_id:'pay_qa_ok',razorpay_signature:'0'.repeat(64)})).status,400)
 result=await call('/api/payments/razorpay/verify',{orderNumber:placed.data.id,razorpay_order_id:rzpOrder,razorpay_payment_id:'pay_qa_ok',razorpay_signature:signature});assert.equal(result.status,200,JSON.stringify(result))
 razorpay.payments=[]
 assert.equal((await call('/api/payments/razorpay/cancel',{orderNumber:placed.data.id,razorpay_order_id:rzpOrder})).data.cancelled,false)
 assert.equal((await pool.query('SELECT payment_status FROM orders WHERE order_number=$1',[placed.data.id])).rows[0].payment_status,'Paid');assert.equal(await stock(variant),7)
 } finally {
 globalThis.fetch=realFetch
 await pool.query("DELETE FROM orders WHERE customer_id IN (SELECT id FROM customers WHERE phone='+919000000002')")
 await pool.query("DELETE FROM addresses WHERE customer_id IN (SELECT id FROM customers WHERE phone='+919000000002')")
 await pool.query("DELETE FROM customers WHERE phone='+919000000002'")
 for(const [m,id] of created.reverse())await call(`/api/admin/${m}/${id}`,null,'DELETE')
 await new Promise(r=>server.close(r));await pool.end()
 }
})
