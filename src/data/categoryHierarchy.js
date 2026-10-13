export function categoryPath(categories, id) {
 const path=[], seen=new Set()
 let current=categories.find(c=>String(c.id)===String(id))
 while(current&&!seen.has(String(current.id))){
  path.unshift(current)
  seen.add(String(current.id))
  current=categories.find(c=>String(c.id)===String(current.parent_id))
 }
 return path
}
export function categoryGroup(categories, groups, id) {
 const path=categoryPath(categories,id)
 for(const category of path){
  const group=groups.find(g=>String(g.id)===String(category.group_id))||groups.find(g=>g.name===category.group_name)
  if(group)return String(group.id)
 }
 return ''
}
export function categoryOptions(categories, groups, groupId, parentId) {
 return categories.filter(c=>parentId?String(c.parent_id)===String(parentId):!Number(c.parent_id)&&categoryGroup(categories,groups,c.id)===String(groupId)).sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0)||a.name.localeCompare(b.name))
}
