export const singular={products:'product',category_groups:'category group',categories:'category',variants:'variant',customers:'customer',addresses:'address',orders:'order',coupons:'coupon',banners:'banner',content_sections:'homepage section',pages:'page',reviews:'review',navigation:'menu link',gift_boxes:'gift box',settings:'setting',admins:'administrator'}
export const listColumns={products:['image','name','category_id','price_range','inventory','active'],category_groups:['name','sort_order','active'],categories:['image','name','group_id','parent_id','active'],variants:['product_id','weight','price','mrp','stock'],customers:['name','phone','email','created_at'],addresses:['customer_id','address','city','state','pincode'],orders:['order_number','customer_id','status','payment_status','total','created_at'],coupons:['code','type','value','min_cart','active'],banners:['image','title','placement','sort_order','active'],content_sections:['title','key','active'],pages:['title','active'],reviews:['product_id','customer_name','rating','approved'],navigation:['label','url','location','sort_order','active'],gift_boxes:['image','name','sku','price','stock','active'],settings:['key','value','description'],admins:['name','email','created_at'],audit:['admin_id','action','module','record_id','created_at']}
export const labelFor=(key,meta)=>({price_range:'Price',inventory:'Stock',customer_snapshot:'Delivery details',items:'Order items',created_at:'Created',updated_at:'Last updated',admin_id:'Administrator',record_id:'Record',active:'Status'}[key]||meta?.fields.find(f=>f.name===key)?.label||key.replaceAll('_',' '))
export const sectionFor=f=>f.type==='boolean'?'Visibility & options':/^(price|mrp|stock|sku|weight|weight_kg|length_cm|breadth_cm|height_cm|occasion)$/.test(f.name)?'Pricing & inventory':/^(image|alt|sort_order)$/.test(f.name)?'Images & display':/^(seo_|description|about_item|ingredients|storage|contents|personalisation|content|body|subtitle)/.test(f.name)?'Content & description':'Basic information'
function NestedValue({value}){
 if(value==null||value==='')return '—'
 if(Array.isArray(value))return <div className="admin-nested-list">{value.map((item,i)=><div key={i}><NestedValue value={item}/></div>)}</div>
 if(typeof value==='object')return <dl className="admin-details">{Object.entries(value).filter(([key])=>!key.includes('password')&&!key.includes('token')).map(([key,v])=><div key={key}><dt>{labelFor(key)}</dt><dd><NestedValue value={v}/></dd></div>)}</dl>
 return typeof value==='boolean'?(value?'Yes':'No'):String(value)
}
export function AdminDetails({row,module,meta,references,valueFor}){
 const sections={}
 for(const key of Object.keys(row)){
  if(['id','slug','image','items','customer_snapshot'].includes(key)||/password|token|secret/.test(key)||module==='navigation'&&['parent_id','menu_type'].includes(key))continue
  const f=meta?.fields.find(f=>f.name===key)||{name:key}
  const section=key.endsWith('_at')?'Record information':sectionFor(f)
  ;(sections[section] ||= []).push(key)
 }
 const variants=module==='products'?(references.variants||[]).filter(v=>v.product_id===row.id):[]
 const photos=module==='products'?(references.product_images||[]).filter(i=>i.product_id===row.id).sort((a,b)=>a.sort_order-b.sort_order):[]
 return <div className="admin-detail-body">
 {row.image&&<div className="admin-detail-hero"><img src={row.image} alt={row.name||row.title||'Record image'}/><div><span className="eyebrow">Primary image</span><p>{row.name||row.title}</p>{module==='products'&&<p>{valueFor(row,'price_range')} · {valueFor(row,'inventory')}</p>}</div></div>}
 {row.customer_snapshot&&<section className="admin-detail-section"><h3>Delivery details</h3><NestedValue value={row.customer_snapshot}/></section>}
 {row.items&&<section className="admin-detail-section"><h3>Order items</h3><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Product</th><th>Pack</th><th>Quantity</th><th>Unit price</th><th>Total</th></tr></thead><tbody>{row.items.map((item,i)=><tr key={item.id||i}><td>{item.product_name}</td><td>{item.weight}</td><td>{item.quantity}</td><td>₹{Number(item.price).toLocaleString('en-IN')}</td><td>₹{(item.price*item.quantity).toLocaleString('en-IN')}</td></tr>)}</tbody></table></div></section>}
 {Object.entries(sections).map(([title,keys])=><section className="admin-detail-section" key={title}><h3>{title}</h3><dl className="admin-details">{keys.map(key=><div key={key} className={meta?.fields.find(f=>f.name===key)?.type==='textarea'?'admin-field-wide':''}><dt>{labelFor(key,meta)}</dt><dd>{typeof row[key]==='object'?<NestedValue value={row[key]}/>:valueFor(row,key)}</dd></div>)}</dl></section>)}
 {module==='products'&&<section className="admin-detail-section"><h3>Variants & inventory</h3>{variants.length?<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Pack size</th><th>Price</th><th>MRP</th><th>Stock</th></tr></thead><tbody>{variants.map(v=><tr key={v.id}><td>{v.weight}</td><td>₹{Number(v.price).toLocaleString('en-IN')}</td><td>₹{Number(v.mrp).toLocaleString('en-IN')}</td><td>{v.stock}</td></tr>)}</tbody></table></div>:<p>Add a variant in Variants & Inventory to make this product available in the shop.</p>}</section>}
 {!!photos.length&&<section className="admin-detail-section"><h3>Product gallery</h3><div className="admin-gallery-grid">{photos.map(i=><figure key={i.id}><img src={i.image} alt={i.alt||'Product photo'}/><figcaption>{i.alt||'Product photo'}</figcaption></figure>)}</div></section>}
 </div>
}
