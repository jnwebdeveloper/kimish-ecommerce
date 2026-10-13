import test from 'node:test'
import assert from 'node:assert/strict'
import { automaticSlug } from './slugs.js'
import { validate } from './modules.js'
test('automatic URLs accept accented, non-Latin and punctuation-only names',()=>{
 for(const name of ['Café & Nuts','काजू','!!!','a'.repeat(99)+' a']){
  const slug=automaticSlug(name)
  assert.match(slug,/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  assert.equal(validate('products',{name,slug,category_id:1},true).slug,slug)
 }
})
test('duplicate product names receive distinct URLs',()=>assert.notEqual(automaticSlug('Cashews'),automaticSlug('Cashews')))
